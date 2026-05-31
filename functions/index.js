/**
 * Nanryosai 2026
 * Version: 0.1.0
 * Last Modified: 2026-02-05
 * Author: Nanryosai 2026 Project Team
 */
const functions = require("firebase-functions/v1");
const {
  onDocumentUpdated,
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");
const { google } = require("googleapis");

admin.initializeApp();
const db = admin.firestore();

// ============================================================
// 受付番号発番ユーティリティ（プライベート関数）
// 設計憲法§7 準拠: 経路別カウンター + アクティブ判定
// ============================================================

/**
 * 経路ごとに安全な受付番号を発番する（内部専用）
 * @param {string} channel - "pos" | "mobile" | "sok"
 * @param {FirebaseFirestore.Transaction} transaction - Firestore トランザクション
 * @returns {Promise<number>} 発番された受付番号
 */
async function getNextReceiptNumber(channel, transaction) {
  const ranges = {
    pos:    { min: 100,  max: 999  },
    mobile: { min: 7000, max: 7999 },
    sok:    { min: 2000, max: 2999 },
  };

  if (!ranges[channel]) {
    throw new functions.https.HttpsError("invalid-argument", `不正な経路: ${channel}`);
  }

  const { min, max } = ranges[channel];
  const rangeSize = max - min + 1;

  const counterRef = db.doc(`counters/receipt_${channel}`);
  const counterSnap = await transaction.get(counterRef);
  let candidate = (counterSnap.exists && counterSnap.data().current != null)
    ? counterSnap.data().current + 1
    : min;

  // アクティブステータス（設計憲法§7.3）: これらの注文と番号が衝突してはならない
  const activeStatuses = ["cooking", "ready_to_serve", "ready_for_pickup"];

  for (let attempt = 0; attempt < rangeSize; attempt++) {
    if (candidate > max) candidate = min;

    const dupQuery = db.collection("orders")
      .where("receiptNumber", "==", candidate)
      .where("status", "in", activeStatuses);
    const dupSnap = await transaction.get(dupQuery);

    if (dupSnap.empty) {
      transaction.set(
        counterRef,
        { current: candidate, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      return candidate;
    }
    candidate++;
  }

  throw new functions.https.HttpsError("resource-exhausted", `受付番号の空きがありません (${channel})`);
}

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
        "ログインが必要です。",
      );
    }
    const email = context.auth.token.email;
    if (email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "この操作を実行する権限がありません。",
      );
    }

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const storeId = requestData.storeId;
    const plainPassword = requestData.plainPassword;

    if (!storeId || !plainPassword) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "storeId と plainPassword が必要です。",
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
        "パスワード設定中にエラーが発生しました。",
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
        "ログインが必要です。",
      );
    }
    const email = context.auth.token.email;
    if (email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "この操作を実行する権限がありません。",
      );
    }

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const secrets = requestData.secrets || [];

    if (!Array.isArray(secrets) || secrets.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "secrets 配列が必要です。",
      );
    }

    if (secrets.length > 500) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "一度に更新できるのは500件までです。",
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
        "一括更新中にエラーが発生しました。",
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
        "ログインが必要です。",
      );
    }

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const storeId = requestData.storeId;
    const password = requestData.password;

    if (!storeId || !password) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "店舗IDとパスワードが必要です。",
      );
    }

    try {
      // 2. store_secrets から認証情報を取得
      // 【セキュリティ強化】stores コレクションへのフォールバックは廃止しました
      const secretDoc = await db.collection("store_secrets").doc(storeId).get();

      if (!secretDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "店舗が見つかりません、または認証情報が設定されていません。",
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
          "パスワードが設定されていません。",
        );
      }

      if (!isValid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "パスワードが間違っています。",
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
        "ログイン処理中にエラーが発生しました。",
      );
    }
  });

// ============================================================
// ヘルパー: 店舗活動時刻の更新 (自動停止・保温の判定基準)
// ============================================================
function updateStoreActivity(storeId) {
  if (!storeId) return;
  db.collection("stores").doc(storeId)
    .update({ lastActivityAt: admin.firestore.FieldValue.serverTimestamp() })
    .catch((e) => console.error("updateStoreActivity Error:", e));
}

// ============================================================
// 注文作成（統合関数）
// 設計憲法§4.1 / §3.1 準拠
// ============================================================

/**
 * @name createOrder
 * @description mobile / pos 両経路を統合した注文作成関数
 *              設計憲法§4.1: createOrder({ orderChannel, storeId, items })
 */
exports.createOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
    }

    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderChannel, storeId, items } = requestData;

    // --- バリデーション ---
    if (!["mobile", "pos"].includes(orderChannel)) {
      throw new functions.https.HttpsError("invalid-argument", "orderChannel は mobile または pos である必要があります。");
    }
    if (!storeId || !Array.isArray(items) || items.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "storeId と items が必要です。");
    }

    const uid = context.auth.uid;

    // mobile はドメイン制限 + BANチェック（設計憲法§9, §10.2）
    if (orderChannel === "mobile") {
      const email = context.auth.token.email || "";
      if (!email.endsWith("@gl.pen-kanagawa.ed.jp") && email !== "ynrcs1000@gmail.com") {
        throw new functions.https.HttpsError("permission-denied", "モバイルオーダーは在校生のみ利用可能です。");
      }
      // BAN チェック（サーバー側二層防御）
      const banDoc = await db.doc(`banned_users/${uid}`).get();
      if (banDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "利用が制限されています。");
      }
    }

    // pos は store_admin 権限チェック
    if (orderChannel === "pos") {
      const token = context.auth.token;
      if (token.role !== "store_admin" || token.storeId !== storeId) {
        throw new functions.https.HttpsError("permission-denied", "店舗管理者権限が必要です。");
      }
    }

    try {
      // --- 商品情報取得 & 金額サーバーサイド計算 ---
      const itemRefs = items.map((i) => db.doc(`items/${i.itemId}`));
      const productDocs = await db.getAll(...itemRefs);
      const productMap = new Map(
        productDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]),
      );

      let totalPrice = 0;
      const orderItems = [];
      for (const item of items) {
        const product = productMap.get(item.itemId);
        if (!product) continue;

        if (product.storeId !== storeId) {
          throw new functions.https.HttpsError("permission-denied", "他店舗の商品は注文できません。");
        }
        if (!product.isAvailable) {
          throw new functions.https.HttpsError("failed-precondition", `「${product.name}」は売り切れです。`);
        }
        // 数量バリデーション
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new functions.https.HttpsError("invalid-argument", "数量は1以上の整数である必要があります。");
        }

        totalPrice += product.price * item.quantity;
        // 設計憲法§3.1.1 フィールドのみ
        orderItems.push({
          itemId: item.itemId,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          customizations: item.customizations || [],
        });
      }

      if (orderItems.length === 0) {
        throw new functions.https.HttpsError("failed-precondition", "注文可能な商品がありません。");
      }

      // --- トランザクション: 受付番号発番 + 注文作成 ---
      const result = await db.runTransaction(async (tx) => {
        const receiptNumber = await getNextReceiptNumber(orderChannel, tx);

        const orderRef = db.collection("orders").doc();
        const now = admin.firestore.FieldValue.serverTimestamp();
        // 設計憲法§3.1 フィールド辞書に完全準拠
        const orderData = {
          status:             "cooking",
          orderChannel,
          storeId,
          items:              orderItems,
          totalPrice,
          receiptNumber,
          userId:             orderChannel === "mobile" ? uid : null,
          createdBy:          orderChannel === "pos"    ? uid : null,
          paymentMethod:      "au_pay_manual",
          // SOK専用（mobile/posでは null）
          sokStatus:          null,
          sokClaimedAt:       null,
          sokConfirmedAt:     null,
          expiredAt:          null,
          // キャンセル・メモ
          cancellationReason: null,
          note:               null,
          // 規約同意（§10.1: mobile必須, pos不要）
          termsAgreedAt:      orderChannel === "mobile" ? (requestData.termsAgreedAt || now) : null,
          // タイムスタンプ群
          createdAt:          now,
          updatedAt:          now,
          readyToServeAt:     null,
          readyForPickupAt:   null,
          completedAt:        null,
          cancelledAt:        null,
          abandonedAt:        null,
        };
        tx.set(orderRef, orderData);
        return { orderId: orderRef.id, receiptNumber };
      });

      updateStoreActivity(storeId);
      return { success: true, orderId: result.orderId, receiptNumber: result.receiptNumber };
    } catch (error) {
      console.error("createOrder Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

// ============================================================
// ステータス遷移関数（設計憲法§4.2 準拠）
// ============================================================

/**
 * ステータス遷移の共通ヘルパー
 * @param {object} context - Cloud Functions コンテキスト
 * @param {string} orderId - 注文ID
 * @returns {Promise<{orderRef, orderData}>} 注文リファレンスとデータ
 */
async function getOrderForTransition(context, orderId) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
  }
  if (!orderId) {
    throw new functions.https.HttpsError("invalid-argument", "orderId が必要です。");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new functions.https.HttpsError("not-found", "注文が見つかりません。");
  }

  const orderData = orderDoc.data();
  const token = context.auth.token;

  // store_admin 権限チェック + storeId 一致チェック
  if (token.role !== "store_admin" || token.storeId !== orderData.storeId) {
    throw new functions.https.HttpsError("permission-denied", "店舗管理者権限が必要です。");
  }

  return { orderRef, orderData };
}

/**
 * @name kitchenComplete
 * @description cooking → ready_to_serve（設計憲法§1.2）
 */
exports.kitchenComplete = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderRef, orderData } = await getOrderForTransition(context, requestData.orderId);

    if (orderData.status !== "cooking") {
      throw new functions.https.HttpsError("failed-precondition", `現在のステータスが cooking ではありません (${orderData.status})。`);
    }

    await orderRef.update({
      status: "ready_to_serve",
      readyToServeAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    updateStoreActivity(orderData.storeId);
    return { success: true };
  });

/**
 * @name callForPickup
 * @description ready_to_serve → ready_for_pickup（設計憲法§1.2）
 *              readyForPickupAt は15分放置ペナルティの基準時刻
 */
exports.callForPickup = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderRef, orderData } = await getOrderForTransition(context, requestData.orderId);

    if (orderData.status !== "ready_to_serve") {
      throw new functions.https.HttpsError("failed-precondition", `現在のステータスが ready_to_serve ではありません (${orderData.status})。`);
    }

    await orderRef.update({
      status: "ready_for_pickup",
      readyForPickupAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    updateStoreActivity(orderData.storeId);
    return { success: true };
  });

/**
 * @name completeOrder
 * @description ready_for_pickup → completed（設計憲法§1.2）
 */
exports.completeOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderRef, orderData } = await getOrderForTransition(context, requestData.orderId);

    if (orderData.status !== "ready_for_pickup") {
      throw new functions.https.HttpsError("failed-precondition", `現在のステータスが ready_for_pickup ではありません (${orderData.status})。`);
    }

    await orderRef.update({
      status: "completed",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    updateStoreActivity(orderData.storeId);
    return { success: true };
  });

/**
 * @name cancelOrder
 * @description 任意 → cancelled（設計憲法§1.2）
 *              reason は必須
 */
exports.cancelOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderRef, orderData } = await getOrderForTransition(context, requestData.orderId);

    const reason = requestData.reason;
    if (!reason) {
      throw new functions.https.HttpsError("invalid-argument", "キャンセル理由 (reason) が必要です。");
    }

    // 完了済み/キャンセル済み/放置済みからのキャンセルは不可
    if (["completed", "cancelled", "abandoned"].includes(orderData.status)) {
      throw new functions.https.HttpsError("failed-precondition", `ステータス ${orderData.status} の注文はキャンセルできません。`);
    }

    await orderRef.update({
      status: "cancelled",
      cancellationReason: reason,
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    updateStoreActivity(orderData.storeId);
    return { success: true };
  });

/**
 * @name adminUpdateOrderStatus
 * @description 任意 → 任意（設計憲法§4.2）
 *              super_admin または store_admin 権限で強制ステータス変更
 */
exports.adminUpdateOrderStatus = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
    }

    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderId, newStatus, reason } = requestData;

    if (!orderId || !newStatus) {
      throw new functions.https.HttpsError("invalid-argument", "orderId と newStatus が必要です。");
    }

    const validStatuses = ["cooking", "ready_to_serve", "ready_for_pickup", "completed", "cancelled", "abandoned"];
    if (!validStatuses.includes(newStatus)) {
      throw new functions.https.HttpsError("invalid-argument", `不正なステータス: ${newStatus}`);
    }

    const token = context.auth.token;
    const isSuperAdmin = token.email === "ynrcs1000@gmail.com";

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError("not-found", "注文が見つかりません。");
    }

    const orderData = orderDoc.data();

    // super_admin でなければ store_admin + storeId 一致チェック
    if (!isSuperAdmin) {
      if (token.role !== "store_admin" || token.storeId !== orderData.storeId) {
        throw new functions.https.HttpsError("permission-denied", "権限がありません。");
      }
    }

    // ステータスに応じたタイムスタンプを設定
    const timestampMap = {
      ready_to_serve: { readyToServeAt: admin.firestore.FieldValue.serverTimestamp() },
      ready_for_pickup: { readyForPickupAt: admin.firestore.FieldValue.serverTimestamp() },
      completed: { completedAt: admin.firestore.FieldValue.serverTimestamp() },
      cancelled: { cancelledAt: admin.firestore.FieldValue.serverTimestamp(), cancellationReason: reason || "管理者による強制変更" },
      abandoned: { abandonedAt: admin.firestore.FieldValue.serverTimestamp() },
    };

    const updateData = {
      status: newStatus,
      note: reason || `管理者 (${token.email}) による手動変更`,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(timestampMap[newStatus] || {}),
    };

    await orderRef.update(updateData);

    updateStoreActivity(orderData.storeId);
    return { success: true, message: `ステータスを ${newStatus} に変更しました。` };
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
  },
);

// --- Google Sheets Integration ---

/**
 * 店舗作成時のスプレッドシート自動作成
 */
exports.onStoreCreated = onDocumentCreated(
  {
    document: "stores/{storeId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const storeId = event.params.storeId;
    const storeData = event.data.data();

    // 既にスプレッドシートがある場合はスキップ
    if (storeData.spreadsheetId) return;

    try {
      const auth = await google.auth.getClient({
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive",
        ],
      });
      const sheets = google.sheets({ version: "v4", auth });
      const drive = google.drive({ version: "v3", auth });

      // スプレッドシート作成
      const spreadsheet = await sheets.spreadsheets.create({
        resource: {
          properties: {
            title: `[Nanryosai] ${storeData.name || storeId} 管理シート`,
          },
        },
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId;
      const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

      // リンクを知っている全員に閲覧権限を付与
      await drive.permissions.create({
        fileId: spreadsheetId,
        resource: {
          type: "anyone",
          role: "reader",
        },
      });

      // ヘッダー行と注意書きをセット
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1:G1",
        valueInputOption: "RAW",
        resource: {
          values: [
            [
              "注文ID",
              "呼出番号",
              "状況",
              "合計金額",
              "注文方法",
              "注文日時",
              "商品詳細",
            ],
          ],
        },
      });

      // 1行目を固定し、注意書きとして背景色を付ける (オプションだが視認性向上のため)
      // 注意書きはGAS側で対応し、ここではヘッダーの日本語化のみとする

      // Firestoreに保存
      await db.collection("stores").doc(storeId).update({
        spreadsheetId,
        spreadsheetUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Spreadsheet created for store ${storeId}`);
    } catch (error) {
      console.error("Error creating spreadsheet for store:", storeId, error);
    }
  },
);

/**
 * 既存店舗向けスプレッドシート一括作成機能 (Callable)
 */
exports.bulkCreateSpreadsheets = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // 権限チェック (Super Adminのみ)
    if (!context.auth || context.auth.token.email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    }

    try {
      const storesSnap = await db.collection("stores").get();
      const auth = await google.auth.getClient({
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive",
        ],
      });
      const sheets = google.sheets({ version: "v4", auth });
      const drive = google.drive({ version: "v3", auth });

      let createdCount = 0;

      for (const doc of storesSnap.docs) {
        const storeData = doc.data();
        if (storeData.spreadsheetId) continue;

        const spreadsheet = await sheets.spreadsheets.create({
          resource: {
            properties: {
              title: `[Nanryosai] ${storeData.name || doc.id} 管理シート`,
            },
          },
        });

        const spreadsheetId = spreadsheet.data.spreadsheetId;
        const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

        await drive.permissions.create({
          fileId: spreadsheetId,
          resource: {
            type: "anyone",
            role: "reader",
          },
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "A1:G1",
          valueInputOption: "RAW",
          resource: {
            values: [
              [
                "注文ID",
                "呼出番号",
                "状況",
                "合計金額",
                "注文方法",
                "注文日時",
                "商品詳細",
              ],
            ],
          },
        });

        await doc.ref.update({
          spreadsheetId,
          spreadsheetUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        createdCount++;
      }

      return { success: true, createdCount };
    } catch (error) {
      console.error("bulkCreateSpreadsheets Error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

/**
 * 注文新規作成時にスプレッドシートへ追記
 */
exports.onOrderCreatedSpreadsheet = onDocumentCreated(
  {
    document: "orders/{orderId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const orderId = event.params.orderId;
    const orderData = event.data.data();
    const storeId = orderData.storeId;

    if (!storeId) return;

    try {
      const storeDoc = await db.collection("stores").doc(storeId).get();
      const storeData = storeDoc.data();

      // スプレッドシートが存在しない場合は何もしない
      if (!storeData || !storeData.spreadsheetId) return;

      const auth = await google.auth.getClient({
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth });

      const itemsStr = (orderData.items || [])
        .map((i) => `${i.name}x${i.quantity}`)
        .join(", ");

      let createdAtStr = new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      });
      if (orderData.createdAt && orderData.createdAt.toDate) {
        createdAtStr = orderData.createdAt.toDate().toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        });
      }

      // ステータスの日本語化（新ステータス + 旧ステータス後方互換）
      const statusMap = {
        // 新ステータス（設計憲法§1.1）
        cooking: "🍳 調理中",
        ready_to_serve: "✅ 提供口で準備中",
        ready_for_pickup: "📢 呼び出し中",
        completed: "🎉 提供完了",
        cancelled: "❌ キャンセル",
        abandoned: "⚠️ 放置終了",
        // 旧ステータス（後方互換）
        unpaid_at_pos: "未払い(POS)",
        authorized: "決済枠確保(オンライン)",
        paid_online: "支払済(オンライン)",
        completed_online: "提供済(オンライン)",
        completed_at_store: "提供済(店頭)",
        abandoned_unpaid: "放置/未払い",
        abandoned_and_paid: "放置/支払済",
        refunded: "返金済",
        payment_failed: "決済失敗",
      };

      const channelMap = {
        pos: "POS",
        sok: "SOK",
        mobile: "モバイル",
      };

      const statusJa = statusMap[orderData.status] || orderData.status || "";
      const channelJa =
        channelMap[orderData.orderChannel] || orderData.orderChannel || "不明";

      const row = [
        orderId,
        orderData.receiptNumber || "",
        statusJa,
        orderData.totalPrice || 0,
        channelJa,
        createdAtStr,
        itemsStr,
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: storeData.spreadsheetId,
        range: "A:G",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [row],
        },
      });
    } catch (error) {
      console.error(`Error appending order ${orderId} to spreadsheet:`, error);
    }
  },
);

/**
 * 注文更新時にスプレッドシートの行を更新
 */
exports.onOrderUpdatedSpreadsheet = onDocumentUpdated(
  {
    document: "orders/{orderId}",
    region: "asia-northeast1",
  },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const orderId = event.params.orderId;

    // ステータスや注文方法が変更された時のみ更新
    if (
      newData.status === oldData.status &&
      newData.orderChannel === oldData.orderChannel
    ) {
      return;
    }

    const storeId = newData.storeId;
    if (!storeId) return;

    try {
      const storeDoc = await db.collection("stores").doc(storeId).get();
      const storeData = storeDoc.data();

      if (!storeData || !storeData.spreadsheetId) return;

      const auth = await google.auth.getClient({
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = storeData.spreadsheetId;

      // OrderId列（A列）を取得して行番号を特定
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "A:A",
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return;

      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i][0] === orderId) {
          rowIndex = i + 1; // Sheetsの行は1-indexed
          break;
        }
      }

      // 該当行が見つかった場合は上書き更新
      if (rowIndex !== -1) {
        const itemsStr = (newData.items || [])
          .map((i) => `${i.name}x${i.quantity}`)
          .join(", ");

        let createdAtStr = new Date().toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        });
        if (newData.createdAt && newData.createdAt.toDate) {
          createdAtStr = newData.createdAt.toDate().toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo",
          });
        }

        // ステータスの日本語化（新ステータス + 旧ステータス後方互換）
        const statusMap = {
          // 新ステータス（設計憲法§1.1）
          cooking: "🍳 調理中",
          ready_to_serve: "✅ 提供口で準備中",
          ready_for_pickup: "📢 呼び出し中",
          completed: "🎉 提供完了",
          cancelled: "❌ キャンセル",
          abandoned: "⚠️ 放置終了",
          // 旧ステータス（後方互換）
          unpaid_at_pos: "未払い(POS)",
          authorized: "決済枠確保(オンライン)",
          paid_online: "支払済(オンライン)",
          completed_online: "提供済(オンライン)",
          completed_at_store: "提供済(店頭)",
          abandoned_unpaid: "放置/未払い",
          abandoned_and_paid: "放置/支払済",
          refunded: "返金済",
          payment_failed: "決済失敗",
        };

        const channelMap = {
          pos: "POS",
          sok: "SOK",
          mobile: "モバイル",
        };

        const statusJa = statusMap[newData.status] || newData.status || "";
        const channelJa =
          channelMap[newData.orderChannel] || newData.orderChannel || "不明";

        const row = [
          orderId,
          newData.receiptNumber || "",
          statusJa,
          newData.totalPrice || 0,
          channelJa,
          createdAtStr,
          itemsStr,
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `A${rowIndex}:G${rowIndex}`,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [row],
          },
        });
      }
    } catch (error) {
      console.error(`Error updating order ${orderId} in spreadsheet:`, error);
    }
  },
);

/**
 * @name loginVenueAdmin
 * @description 会場ステータス管理ログイン。URLトークンとパスワードを検証し、セッショントークンを発行。
 */
exports.loginVenueAdmin = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { urlToken, password } = requestData;

    if (!urlToken || !password) {
      throw new functions.https.HttpsError("invalid-argument", "URLトークンとパスワードが必要です。");
    }

    try {
      const configDoc = await db.collection("venue_admin_config").doc("settings").get();
      if (!configDoc.exists) {
        throw new functions.https.HttpsError("failed-precondition", "管理設定が初期化されていません。");
      }

      const config = configDoc.data();
      if (config.accessToken !== urlToken) {
        throw new functions.https.HttpsError("permission-denied", "無効なURLです。");
      }

      const isValid = verifyPassword(password, config.hash, config.salt);
      if (!isValid) {
        throw new functions.https.HttpsError("permission-denied", "パスワードが間違っています。");
      }

      const sessionToken = crypto.randomBytes(32).toString("hex");
      await db.collection("venue_admin_sessions").doc(sessionToken).set({
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, sessionToken };
    } catch (error) {
      console.error("loginVenueAdmin Error:", error);
      // Custom Error handling
      if (error instanceof functions.https.HttpsError) {
          throw error;
      }
      throw new functions.https.HttpsError("internal", "ログイン中にエラーが発生しました。");
    }
  });

/**
 * @name updateVenueStatus
 * @description セッショントークンを検証し、会場ステータスを更新する
 */
exports.updateVenueStatus = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { sessionToken, venueId, updates } = requestData;

    if (!sessionToken || !venueId || !updates) {
      throw new functions.https.HttpsError("invalid-argument", "必要なパラメータが不足しています。");
    }

    try {
      const sessionDoc = await db.collection("venue_admin_sessions").doc(sessionToken).get();
      if (!sessionDoc.exists) {
        throw new functions.https.HttpsError("unauthenticated", "セッションが無効か期限切れです。");
      }

      const createdAt = sessionDoc.data().createdAt.toDate();
      const now = new Date();
      const diffHours = (now - createdAt) / (1000 * 60 * 60);
      
      if (diffHours > 24) {
        await sessionDoc.ref.delete(); // expired
        throw new functions.https.HttpsError("unauthenticated", "セッションの有効期限が切れています。");
      }

      // 許可するフィールドのみ抽出
      const allowedUpdates = {
        status: updates.status, // "preparing" | "soon" | "live" | "ended"
        currentEventId: updates.currentEventId || null,
        nextEventId: updates.nextEventId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("venues").doc(venueId).set(allowedUpdates, { merge: true });

      return { success: true, message: "更新しました" };
    } catch (error) {
      console.error("updateVenueStatus Error:", error);
      if (error instanceof functions.https.HttpsError) {
          throw error;
      }
      throw new functions.https.HttpsError("internal", "更新中にエラーが発生しました。");
    }
  });

// ============================================================
// 店舗ステータス管理 & Functionsコールドスタート防止
// ============================================================

/**
 * @name warmupPing
 * @description Cloud Functions のコールドスタートを防ぐための軽量関数。
 *              スケジュール関数から定期的に叩かれる。
 */
exports.warmupPing = functions
  .region("asia-northeast1")
  .https.onRequest((req, res) => {
    res.status(200).send("pong");
  });

/**
 * @name updateStoreStatus
 * @description 店舗の営業ステータスを変更する。
 *              newStatus が "open" の場合、availableItemIds にある商品を isAvailable: true に、
 *              それ以外を false にバッチ更新する。
 *              引数: { storeId, newStatus: "open"|"suspended"|"closed", availableItemIds?: string[] }
 */
exports.updateStoreStatus = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
    }

    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { storeId, newStatus, availableItemIds } = requestData;

    if (!storeId || !newStatus) {
      throw new functions.https.HttpsError("invalid-argument", "storeId と newStatus が必要です。");
    }

    const validStatuses = ["open", "suspended", "closed"];
    if (!validStatuses.includes(newStatus)) {
      throw new functions.https.HttpsError("invalid-argument", `不正なステータス: ${newStatus}`);
    }

    // store_admin 権限チェック
    const token = context.auth.token;
    if (token.role !== "store_admin" || token.storeId !== storeId) {
      throw new functions.https.HttpsError("permission-denied", "店舗管理者権限が必要です。");
    }

    try {
      const now = admin.firestore.FieldValue.serverTimestamp();
      const storeUpdateData = {
        operationStatus: newStatus,
        updatedAt: now,
      };

      // 「営業中」に変更する場合は lastActivityAt を更新 (活動開始基準)
      if (newStatus === "open") {
        storeUpdateData.lastActivityAt = now;
      }

      // 店舗ステータスを更新
      await db.collection("stores").doc(storeId).update(storeUpdateData);

      // 「営業中」に変更する場合、商品の isAvailable を更新
      if (newStatus === "open") {
        const itemsSnap = await db.collection("items")
          .where("storeId", "==", storeId)
          .get();

        if (!itemsSnap.empty) {
          const availableSet = new Set(availableItemIds || []);
          const batch = db.batch();

          itemsSnap.docs.forEach((doc) => {
            const shouldBeAvailable = availableSet.size === 0
              ? true // availableItemIds が空の場合は全商品を販売中に
              : availableSet.has(doc.id);
            batch.update(doc.ref, {
              isAvailable: shouldBeAvailable,
              updatedAt: now,
            });
          });

          await batch.commit();
        }
      }

      return { success: true, newStatus };
    } catch (error) {
      console.error("updateStoreStatus Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

/**
 * @name manageStoreStatusAndWarmup
 * @description 毎分実行される定期ジョブ。
 *              「営業中 (open)」であるにもかかわらず lastActivityAt が15分以上前の店舗を
 *              自動的に「一時停止中 (suspended)」に変更する。
 *              活発な店舗が存在する場合は、Functions のコールドスタートを防ぐために
 *              自身のダミーエンドポイントへリクエストを送信する。
 */
exports.manageStoreStatusAndWarmup = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const threshold = admin.firestore.Timestamp.fromDate(fifteenMinutesAgo);

    try {
      const openStoresSnap = await db.collection("stores")
        .where("operationStatus", "==", "open")
        .get();

      if (openStoresSnap.empty) {
        return null;
      }

      const batch = db.batch();
      let hasActiveStore = false;

      openStoresSnap.docs.forEach((doc) => {
        const data = doc.data();
        const lastActivityAt = data.lastActivityAt;

        if (!lastActivityAt || lastActivityAt.toMillis() < threshold.toMillis()) {
          console.log(`manageStoreStatusAndWarmup: 店舗 ${doc.id} を suspended に変更 (放置検知)`);
          batch.update(doc.ref, {
            operationStatus: "suspended",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          hasActiveStore = true;
        }
      });

      await batch.commit();

      if (hasActiveStore) {
        // ウォームアップリクエストを送信 (Node.js標準の https モジュールを使用)
        const https = require("https");
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "nanryosai-2026-a4091";
        const url = `https://asia-northeast1-${projectId}.cloudfunctions.net/warmupPing`;
        
        https.get(url, (res) => {
          res.on("data", () => {}); // データを消費してコネクションをクリーンアップ
        }).on("error", (e) => {
          console.error("Warmup ping error:", e);
        });
      }

      return null;
    } catch (error) {
      console.error("manageStoreStatusAndWarmup Error:", error);
      return null;
    }
  });
