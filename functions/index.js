// Last updated: 2025-12-10 22:08
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

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

      // 商品詳細を取得（Parallel Fetch）
      const itemRefs = [];
      const cartItemsMap = {}; // itemId -> quantity

      cartSnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.quantity > 0) {
          itemRefs.push(db.collection("items").doc(doc.id));
          // fix: Store customizations as well
          cartItemsMap[doc.id] = {
            quantity: d.quantity,
            customizations: d.customizations || [],
          };
        }
      });

      if (itemRefs.length === 0) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "有効な商品がありません。"
        );
      }

      const productDocs = await db.getAll(...itemRefs);

      productDocs.forEach((pDoc) => {
        if (!pDoc.exists) return; // 商品削除済みなど
        const pData = pDoc.data();

        // バリデーション: 店舗一致チェックなど
        if (pData.storeId !== storeId) return;

        const cartInfo = cartItemsMap[pDoc.id];
        const qty = cartInfo.quantity;

        // [Critical] 数量バリデーション
        if (!Number.isInteger(qty) || qty <= 0) {
          // Skip invalid quantity items or throw error. Here we skip.
          console.warn(`Invalid quantity for item ${pDoc.id}: ${qty}`);
          return;
        }

        // [Medium] 売り切れチェック
        if (!pData.isAvailable) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `商品「${pData.name}」は売り切れのため注文できません。`
          );
        }

        const subTotal = pData.price * qty;

        orderItems.push({
          itemId: pDoc.id,
          name: pData.name,
          price: pData.price,
          quantity: qty,
          options: pData.options || [], // 商品マスタのオプション定義（もしあれば）
          customizations: cartInfo.customizations,
        });

        totalPrice += subTotal;
      });

      if (orderItems.length === 0) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "注文可能な商品がありません。"
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
      // A. まず安全な store_secrets を確認
      let storedPassword = null;
      const secretDoc = await db.collection("store_secrets").doc(storeId).get();

      if (secretDoc.exists) {
        storedPassword = secretDoc.data().password;
      } else {
        // B. なければ従来の stores を確認 (移行期間用)
        const storeDoc = await db.collection("stores").doc(storeId).get();
        if (storeDoc.exists) {
          storedPassword = storeDoc.data().password;
        }
      }

      if (!storedPassword) {
        throw new functions.https.HttpsError(
          "not-found",
          "店舗が見つかりません、またはパスワードが設定されていません。"
        );
      }

      // 3. パスワード検証
      if (String(storedPassword) !== String(password)) {
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
