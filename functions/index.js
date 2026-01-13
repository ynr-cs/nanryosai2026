// Last updated: 2025-12-10 22:08
const functions = require("firebase-functions/v1");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");

admin.initializeApp();
const db = admin.firestore();

/**
 * @name getNextReceiptNumber
 * @description 【最終版】全ての完了・キャンセル済みステータスを考慮し、
 *              アクティブな注文で使われていない次の受付番号を安全に発行する。
 */
exports.getNextReceiptNumber = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    try {
      console.log("getNextReceiptNumber called with:", data);

      const counterRef = db.collection("counters").doc("receipt");
      const ordersRef = db.collection("orders");

      // 注文タイプごとの設定
      // POS: 100-999 (デフォルト)
      // SOK: 2000-2999
      // Mobile: 7000-7999
      // Gen 2 (CallableRequest) か Gen 1 かを判定してデータを取得
      const requestData =
        data.data && typeof data.data === "object" ? data.data : data;

      const orderType = requestData.orderType || "POS";

      let minNum, maxNum, fieldName;

      switch (orderType) {
        case "SOK":
          minNum = 2000;
          maxNum = 2999;
          fieldName = "currentNumber_SOK";
          break;
        case "MOBILE":
          minNum = 7000;
          maxNum = 7999;
          fieldName = "currentNumber_MOBILE";
          break;
        case "POS":
        default:
          minNum = 100;
          maxNum = 999;
          fieldName = "currentNumber"; // 既存互換のため POS は currentNumber を使用
          break;
      }

      const newNumber = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists) {
          throw new Error(
            "counters/receipt ドキュメントが存在しません。Firestoreを確認してください。"
          );
        }

        const docData = counterDoc.data();
        let nextNumber = docData[fieldName];

        // 初回などでフィールドがない、または範囲外の場合は初期値をセット
        if (!nextNumber || nextNumber < minNum || nextNumber > maxNum) {
          nextNumber = minNum - 1;
        }

        // 安全装置: 範囲のサイズ分試行 (例: 900回)
        const rangeSize = maxNum - minNum + 1;

        for (let i = 0; i < rangeSize; i++) {
          nextNumber++;
          if (nextNumber > maxNum) {
            nextNumber = minNum;
          }

          // 【修正点】完了済みの全ステータスを指定する
          // これら"以外"がアクティブな注文とみなされる
          const completedStatuses = [
            "completed_at_store", // 店舗での提供完了
            "completed_online", // オンライン注文の提供完了
            "cancelled", // キャンセル済み
            "abandoned_and_paid", // 放置・決済済み
          ];

          const query = ordersRef
            .where("receiptNumber", "==", nextNumber)
            .where("status", "not-in", completedStatuses);

          const snapshot = await transaction.get(query);

          if (snapshot.empty) {
            transaction.update(counterRef, { [fieldName]: nextNumber });
            return nextNumber;
          }
        }

        throw new Error(`利用可能な受付番号がありません (${orderType})。`);
      });

      return {
        receiptNumber: newNumber,
        _debug_orderType: orderType,
        success: true,
      };
    } catch (error) {
      console.error("Function Error:", error);
      // クライアントでエラー内容を確認できるように詳細を返す
      return {
        success: false,
        error: error.message || "Internal Server Error",
        // stack: error.stack, // Removed for security (Information Leak)
        code: 500,
      };
    }
  });

/**
 * @name createOnlineOrder
 * @description モバイルオーダーからの注文を作成する
 *              receiptNumberの発行と注文作成をトランザクションで実行
 */
exports.createOnlineOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 1. 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "ログインが必要です。"
      );
    }

    const uid = context.auth.uid;
    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const storeId = requestData.storeId;

    if (!storeId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "店舗IDが指定されていません。"
      );
    }

    try {
      // 2. カートの中身と商品情報を取得
      const cartSnapshot = await db.collection(`users/${uid}/cart`).get();

      if (cartSnapshot.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "カートが空です。"
        );
      }

      const orderItems = [];
      let totalPrice = 0;

      // カート内容をパースして必要な商品IDを収集
      const cartItems = [];
      const productIds = new Set();

      cartSnapshot.forEach((doc) => {
        const d = doc.data();
        // 数量とproductIdがあるものだけ対象
        if (d.quantity > 0 && d.productId) {
          cartItems.push({
            productId: d.productId,
            quantity: d.quantity,
            customizations: d.customizations || [],
          });
          productIds.add(d.productId);
        }
      });

      if (cartItems.length === 0) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "有効な商品がありません。"
        );
      }

      // 商品マスタを一括取得
      const itemRefs = Array.from(productIds).map((id) =>
        db.collection("items").doc(id)
      );
      const productDocs = await db.getAll(...itemRefs);
      const productMap = new Map();

      productDocs.forEach((doc) => {
        if (doc.exists) {
          productMap.set(doc.id, doc.data());
        }
      });

      // 注文明細の構築
      for (const item of cartItems) {
        const pData = productMap.get(item.productId);

        if (!pData) continue; // 商品マスタが存在しない（削除済みなど）

        // バリデーション: 店舗一致チェック
        // ※String/Numberの型不一致を防ぐため == で比較、あるいは String()変換
        if (String(pData.storeId) !== String(storeId)) continue;

        // [Medium] 売り切れチェック
        if (!pData.isAvailable) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `商品「${pData.name}」は売り切れのため注文できません。`
          );
        }

        const subTotal = pData.price * item.quantity;
        totalPrice += subTotal;

        orderItems.push({
          itemId: item.productId, // 注文履歴上の互換性のため itemId とする
          productId: item.productId,
          name: pData.name,
          price: pData.price,
          quantity: item.quantity,
          options: pData.options || [],
          customizations: item.customizations,
        });
      }

      if (orderItems.length === 0) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "注文可能な商品がありません（店舗ID不一致または商品削除）。"
        );
      }

      // 3. トランザクション：受付番号発行 -> 注文作成
      const result = await db.runTransaction(async (transaction) => {
        // --- A. 受付番号発行ロジック (Mobile: 7000-7999) ---
        const counterRef = db.collection("counters").doc("receipt");
        const counterDoc = await transaction.get(counterRef);

        let nextNumber = 6999;
        if (counterDoc.exists && counterDoc.data().currentNumber_MOBILE) {
          nextNumber = counterDoc.data().currentNumber_MOBILE;
        }

        const minNum = 7000;
        const maxNum = 7999;
        const maxNumLoop = 7999;

        if (nextNumber < minNum || nextNumber >= maxNum) {
          nextNumber = minNum - 1;
        }

        let determinedNumber = null;
        const rangeSize = maxNum - minNum + 1; // 1000
        const loopLimit = 50; // 安全のため50回試行

        for (let i = 0; i < loopLimit; i++) {
          nextNumber++;
          if (nextNumber > maxNumLoop) nextNumber = minNum;

          const ordersRef = db.collection("orders");
          const completedStatuses = [
            "completed_at_store",
            "completed_online",
            "cancelled",
            "abandoned_and_paid",
          ];

          // Transaction Query
          const dupQuery = ordersRef
            .where("receiptNumber", "==", nextNumber)
            .where("status", "not-in", completedStatuses);

          const dupSnap = await transaction.get(dupQuery);

          if (dupSnap.empty) {
            determinedNumber = nextNumber;
            break;
          }
        }

        if (!determinedNumber) {
          throw new functions.https.HttpsError(
            "resource-exhausted",
            "受付番号の空きがありません (混雑中)"
          );
        }

        // カウンター更新
        transaction.set(
          counterRef,
          { currentNumber_MOBILE: determinedNumber },
          { merge: true }
        );

        // --- B. 注文作成 ---
        const newOrderRef = db.collection("orders").doc();
        const orderData = {
          userId: uid,
          storeId: storeId,
          receiptNumber: determinedNumber,
          items: orderItems,
          totalPrice: totalPrice,
          status: "authorized",
          paymentMethod: "ONLINE",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        transaction.set(newOrderRef, orderData);
        return { orderId: newOrderRef.id, receiptNumber: determinedNumber };
      });

      // 4. カートをクリア
      const batch = db.batch();
      cartSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      return {
        success: true,
        orderId: result.orderId,
        receiptNumber: result.receiptNumber,
      };
    } catch (error) {
      console.error("Order Creation Error:", error);
      // HttpsErrorならそのまま投げる
      if (error.code && error.details) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

// 1. cryptoモジュールの読み込み
const crypto = require("crypto");

/**
 * パスワードをハッシュ化するユーティリティ関数
 * @param {string} password - 平文のパスワード
 * @returns {object} { derivedKey, salt } - ハッシュ化されたパスワードとソルト (ともにHex文字列)
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return { derivedKey, salt };
}

/**
 * パスワードを検証するユーティリティ関数
 * @param {string} password - 入力された平文パスワード
 * @param {string} originalHash - 保存されているハッシュ (Hex)
 * @param {string} salt - 保存されているソルト (Hex)
 * @returns {boolean} 一致すれば true
 */
function verifyPassword(password, originalHash, salt) {
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return derivedKey === originalHash;
}

/**
 * @name createStoreSecret
 * @description 店舗のログイン用パスワードを設定する（Super Admin Only）
 *              平文パスワードを受け取り、ハッシュ化して store_secrets に保存する
 */
exports.createStoreSecret = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 1. 認証チェック (Super Admin Only)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "ログインが必要です。"
      );
    }
    const email = context.auth.token.email;
    if (email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "この操作を実行する権限がありません。"
      );
    }

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const storeId = requestData.storeId;
    const plainPassword = requestData.plainPassword;

    if (!storeId || !plainPassword) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "storeId と plainPassword が必要です。"
      );
    }

    try {
      // 2. パスワードハッシュ生成
      const { derivedKey, salt } = hashPassword(plainPassword);

      // 3. store_secrets に保存
      await db.collection("store_secrets").doc(storeId).set({
        hash: derivedKey,
        salt: salt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: email,
      });

      return {
        success: true,
        message: `店舗ID [${storeId}] のパスワードを設定しました。`,
      };
    } catch (error) {
      console.error("createStoreSecret Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "パスワード設定中にエラーが発生しました。"
      );
    }
  });

/**
 * @name batchUpdateStoreSecrets
 * @description 複数の店舗パスワードを一括設定する（Super Admin Only）
 *              引数: { secrets: [{ storeId, plainPassword }, ...] }
 */
exports.batchUpdateStoreSecrets = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 1. 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "ログインが必要です。"
      );
    }
    const email = context.auth.token.email;
    if (email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "この操作を実行する権限がありません。"
      );
    }

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const secrets = requestData.secrets || [];

    if (!Array.isArray(secrets) || secrets.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "secrets 配列が必要です。"
      );
    }

    if (secrets.length > 500) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "一度に更新できるのは500件までです。"
      );
    }

    try {
      const batch = db.batch();
      const secretsRef = db.collection("store_secrets");

      for (const item of secrets) {
        if (!item.storeId || !item.plainPassword) continue;

        const { derivedKey, salt } = hashPassword(item.plainPassword);
        const docRef = secretsRef.doc(item.storeId);

        batch.set(docRef, {
          hash: derivedKey,
          salt: salt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: email,
        });
      }

      await batch.commit();

      return {
        success: true,
        message: `${secrets.length} 件のパスワードを一括更新しました。`,
      };
    } catch (error) {
      console.error("batchUpdateStoreSecrets Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "一括更新中にエラーが発生しました。"
      );
    }
  });

/**
 * @name loginStore
 * @description 店舗ログイン処理 (サーバーサイド)
 *              パスワードを検証し、正しければCustom Claimsを設定する
 */
exports.loginStore = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 1. ユーザー認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "ログインが必要です。"
      );
    }

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const storeId = requestData.storeId;
    const password = requestData.password;

    if (!storeId || !password) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "店舗IDとパスワードが必要です。"
      );
    }

    try {
      // 2. store_secrets から認証情報を取得
      // 【セキュリティ強化】stores コレクションへのフォールバックは廃止しました
      const secretDoc = await db.collection("store_secrets").doc(storeId).get();

      if (!secretDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "店舗が見つかりません、または認証情報が設定されていません。"
        );
      }

      const secretData = secretDoc.data();

      // 3. パスワード検証
      let isValid = false;

      // 新方式: ハッシュ化されたパスワードがある場合
      if (secretData.hash && secretData.salt) {
        isValid = verifyPassword(password, secretData.hash, secretData.salt);
      }
      // 旧方式: 平文パスワードがまだ残っている場合 (移行過渡期用)
      // ※ データ移行が完了したらこの分岐も削除推奨
      else if (secretData.password) {
        isValid = String(secretData.password) === String(password);
      } else {
        // パスワード情報が何もない
        throw new functions.https.HttpsError(
          "failed-precondition",
          "パスワードが設定されていません。"
        );
      }

      if (!isValid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "パスワードが間違っています。"
        );
      }

      // 4. Custom Claims 設定
      const uid = context.auth.uid;
      const currentClaims =
        (await admin.auth().getUser(uid)).customClaims || {};

      const newClaims = {
        ...currentClaims,
        storeId: storeId,
        role: "store_admin",
      };

      await admin.auth().setCustomUserClaims(uid, newClaims);

      return {
        success: true,
        message: "認証に成功しました。",
        storeId: storeId,
      };
    } catch (error) {
      console.error("Login Error:", error);
      if (error.code && error.details) throw error;
      throw new functions.https.HttpsError(
        "internal",
        "ログイン処理中にエラーが発生しました。"
      );
    }
  });

/**
 * @name createPOSOrder
 * @description POSレジからの注文を作成する（サーバーサイド価格計算）
 *              receiptNumberの発行と注文作成をトランザクションで実行
 */
exports.createPOSOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 1. 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "ログインが必要です。"
      );
    }

    // 店舗管理者権限チェック
    const token = context.auth.token;
    if (token.role !== "store_admin" || !token.storeId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "店舗管理者権限が必要です。"
      );
    }

    const storeId = token.storeId;
    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const items = requestData.items || [];

    if (items.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "商品が含まれていません。"
      );
    }

    try {
      // 2. 商品情報の取得と合計金額計算
      const itemRefs = items.map((i) =>
        db.collection("items").doc(i.productId)
      );
      if (itemRefs.length === 0) throw new Error("Item refs empty");

      const productDocs = await db.getAll(...itemRefs);
      const productMap = new Map();
      productDocs.forEach((d) => {
        if (d.exists) productMap.set(d.id, d.data());
      });

      let totalPrice = 0;
      const orderItems = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) continue; // 商品が存在しない場合はスキップまたはエラー

        // [Critical] 数量バリデーション
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "数量が不正です (1以上の整数である必要があります)。"
          );
        }

        // 店舗IDの一致確認
        if (product.storeId !== storeId) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "他店舗の商品は注文できません。"
          );
        }

        // [Medium] 売り切れチェック
        if (!product.isAvailable) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `商品「${product.name}」は売り切れのため注文できません。`
          );
        }

        const subTotal = product.price * item.quantity;
        totalPrice += subTotal;

        orderItems.push({
          productId: item.productId,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          customizations: item.customizations || [], // トッピング情報などはそのまま保存（価格変動なし前提）
        });
      }

      // 3. トランザクション：受付番号発行 -> 注文作成
      const result = await db.runTransaction(async (transaction) => {
        // 受付番号発行 (POS: 100-999)
        const counterRef = db.collection("counters").doc("receipt");
        const counterDoc = await transaction.get(counterRef);

        let nextNumber = 99;
        // 既存互換：POSは currentNumber を使用
        if (counterDoc.exists && counterDoc.data().currentNumber) {
          nextNumber = counterDoc.data().currentNumber;
        }

        const minNum = 100;
        const maxNum = 999;
        const maxNumLoop = 999;

        if (nextNumber < minNum || nextNumber >= maxNum) {
          nextNumber = minNum - 1;
        }

        let determinedNumber = null;
        const loopLimit = 50;

        for (let i = 0; i < loopLimit; i++) {
          nextNumber++;
          if (nextNumber > maxNumLoop) nextNumber = minNum;

          const ordersRef = db.collection("orders");
          // POS注文でレシート被りを防ぐためにstatusチェック
          const completedStatuses = [
            "completed_at_store",
            "cancelled",
            "abandoned_and_paid",
          ];

          const dupQuery = ordersRef
            .where("receiptNumber", "==", nextNumber)
            .where("status", "not-in", completedStatuses); // 終わってない注文と被らないように

          const dupSnap = await transaction.get(dupQuery);

          if (dupSnap.empty) {
            determinedNumber = nextNumber;
            break;
          }
        }

        if (!determinedNumber) {
          throw new functions.https.HttpsError(
            "resource-exhausted",
            "受付番号の空きがありません"
          );
        }

        // カウンター更新
        transaction.set(
          counterRef,
          { currentNumber: determinedNumber },
          { merge: true }
        );

        // 注文作成
        const newOrderRef = db.collection("orders").doc();
        const orderData = {
          storeId: storeId,
          receiptNumber: determinedNumber,
          items: orderItems,
          totalPrice: totalPrice,
          status: "unpaid_at_pos", // POSからの注文は未払い開始
          paymentMethod: "cash", // 仮でcash。実運用に合わせて
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          // userId は POS操作者（店員）のIDになるが、注文者としては記録しない、あるいは店員IDとして記録
          createdBy: context.auth.uid,
        };

        transaction.set(newOrderRef, orderData);
        return { orderId: newOrderRef.id, receiptNumber: determinedNumber };
      });

      return {
        success: true,
        orderId: result.orderId,
        receiptNumber: result.receiptNumber,
      };
    } catch (error) {
      console.error("POS Order Error:", error);
      if (error.code && error.details) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

exports.sendOrderUpdateNotification = onDocumentUpdated(
  {
    document: "orders/{orderId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const newData = event.data.after.data();
    const previousData = event.data.before.data();
    const orderId = event.params.orderId;

    // ステータスが変わっていなければ何もしない
    if (newData.status === previousData.status) return;

    // ユーザーIDを取得
    const userId = newData.userId;

    // ユーザーのFCMトークンをFirestoreから取得
    const userSnapshot = await db.collection("users").doc(userId).get();
    const userData = userSnapshot.data();
    const fcmToken = userData?.fcmToken;

    if (!fcmToken) {
      console.log(`User ${userId} has no FCM token.`);
      return;
    }

    // ステータスに応じたメッセージ内容
    let title = "";
    let body = "";

    switch (newData.status) {
      case "ready_for_pickup":
        title = "🍳 商品の準備ができました！";
        body = `ご注文（受付番号: ${newData.receiptNumber}）の準備ができました。提供口までお越しください。`;
        break;

      case "cancelled":
        title = "⚠️ ご注文キャンセルのお知らせ";
        body =
          "申し訳ありません。店舗の都合によりご注文がキャンセルされました。";
        break;

      default:
        return; // その他のステータス変更では通知しない
    }

    // 通知メッセージの構築
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        orderId: orderId,
        url: `/status.html?orderId=${orderId}`,
      },
      token: fcmToken,
    };

    // 送信
    try {
      await getMessaging().send(message);
      console.log(`Notification sent to ${userId} for order ${orderId}`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
);
