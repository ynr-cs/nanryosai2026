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
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { getMessaging } = require("firebase-admin/messaging");
const { google } = require("googleapis");

admin.initializeApp();
const db = admin.firestore();

// ============================================================
// ペナルティ免除対象（スーパー管理者等）
// ============================================================
const PENALTY_WHITELIST_EMAILS = ["ynrcs1000@gmail.com"];

// ============================================================
// Google Sheets 同期 共通設定・ヘルパー
// ============================================================

/** 共有フォルダ ID（オーナー=学校ドメインアカウント / SA=編集者 / 一般=ドメイン閲覧） */
const SHEET_FOLDER_ID = "1Rbe6SRErVZ0-8z7scsV12wzeHiUI4WYO";
const SHEET_TAB    = "注文履歴";
const SHEET_HEADER = [
  "注文ID", "呼出番号", "注文方法", "現在の状況", "合計金額",
  "商品詳細", "注文日時", "調理完了日時", "呼出開始日時", "完了/終了日時",
];

/** 認証クライアントのキャッシュ（毎回 getClient するとレイテンシ増） */
let _googleAuth = null;
async function getGoogleClients() {
  if (!_googleAuth) {
    _googleAuth = await google.auth.getClient({
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    });
  }
  return {
    sheets: google.sheets({ version: "v4", auth: _googleAuth }),
    drive:  google.drive({ version: "v3", auth: _googleAuth }),
  };
}

/** 数式インジェクション対策（valueInputOption:"RAW" との二重防御） */
function safeCell(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const STATUS_JA = {
  cooking:          "🍳 調理中",
  ready_to_serve:   "✅ 提供口で準備中",
  ready_for_pickup: "📢 呼び出し中",
  completed:        "🎉 提供完了",
  cancelled:        "❌ キャンセル",
  abandoned:        "⚠️ 放置終了",
};
const CHANNEL_JA = { pos: "POS", sok: "SOK", mobile: "モバイル" };

const SYNC_STATUSES = new Set(["cooking","ready_to_serve","ready_for_pickup","completed","cancelled","abandoned"]);

/** 
 * 同期対象ステータスか判定（null/undefined または指定6値以外を除外） 
 */
function isSyncTargetOrder(o) {
  return o != null && o.status != null && SYNC_STATUSES.has(o.status);
}

function formatDate(ts) {
  if (!ts || typeof ts.toDate !== "function") return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(ts.toDate()).replace(/-/g, "/");
}

/** シート1行分の配列を生成（列順は SHEET_HEADER と一致させる） */
function buildRow(orderId, o) {
  // 商品詳細: たこ焼きx2(トマト抜き, チーズ追加) の形式で連結
  const itemsStr = (o.items || [])
    .map((i) => {
      let text = `${i.name}x${i.quantity}`;
      if (i.customizations && i.customizations.length > 0) {
        const custs = i.customizations.map(c => {
          if (c.mode === "NO") return `${c.target}抜き`;
          if (c.mode === "ADD") return `${c.target}追加`;
          return c.target;
        }).join(", ");
        text += `(${custs})`;
      }
      return text;
    })
    .join(", ");

  // 注文日時 (SOKの場合は確定日時を優先)
  const orderDate = o.orderChannel === "sok" ? (o.sokConfirmedAt || o.createdAt) : o.createdAt;
  
  // 完了/終了日時 (completedAt ?? cancelledAt ?? abandonedAt)
  const finishedDate = o.completedAt || o.cancelledAt || o.abandonedAt;

  return [
    orderId,
    o.receiptNumber ?? "",
    CHANNEL_JA[o.orderChannel] || o.orderChannel || "不明",
    STATUS_JA[o.status] || o.status || "",
    o.totalPrice || 0,
    safeCell(itemsStr),
    formatDate(orderDate),
    formatDate(o.readyToServeAt),
    formatDate(o.readyForPickupAt),
    formatDate(finishedDate),
  ];
}

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
async function updateStoreActivity(storeId) {
  if (!storeId) return;
  try {
    const storeRef = db.collection("stores").doc(storeId);
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(storeRef);
      if (!doc.exists) return;
      
      const data = doc.data();
      const updates = { lastActivityAt: admin.firestore.FieldValue.serverTimestamp() };

      // 自動停止(suspended)中かつ緊急停止でなければ営業中(open)に自律復帰させる
      if (
        data.operationStatus === "suspended" &&
        data.isAutoSuspended === true &&
        !data.isEmergencyStopped
      ) {
        updates.operationStatus = "open";
        updates.isAutoSuspended = admin.firestore.FieldValue.delete();
        console.log(`updateStoreActivity: 店舗 ${storeId} が自動停止から復帰しました`);
      }
      
      transaction.update(storeRef, updates);
    });
  } catch (e) {
    console.error("updateStoreActivity Error:", e);
  }
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
      // Bug 5 修正: 二重注文防止（バックエンド最終ゲート）
      // UIでブロック済みでも、直接API呼び出しなどによる二重注文を確実に防ぐ
      const activeOrderSnap = await db.collection("orders")
        .where("userId", "==", uid)
        .where("status", "in", ["cooking", "ready_to_serve", "ready_for_pickup"])
        .limit(1)
        .get();
      if (!activeOrderSnap.empty) {
        throw new functions.https.HttpsError(
          "already-exists",
          "既に受付中の注文があります。注文状況をご確認ください。"
        );
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
      // --- 店舗ステータスチェック（緊急停止・一時停止中の注文をサーバー側でブロック）---
      const storeDoc = await db.collection("stores").doc(storeId).get();
      if (!storeDoc.exists) {
        throw new functions.https.HttpsError("not-found", "店舗が見つかりません。");
      }
      const storeData = storeDoc.data();
      if (storeData.operationStatus !== "open") {
        const reason = storeData.isEmergencyStopped
          ? "緊急停止中のため注文を受け付けられません。"
          : "この店舗は現在受付を停止しています。";
        throw new functions.https.HttpsError("failed-precondition", reason);
      }

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
 *              readyForPickupAt は5分放置ペナルティの基準時刻
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

    // ユーザーIDを取得（POSやSOKからの注文は userId: null のため早期リターン）
    const userId = newData.userId;
    if (!userId) {
      console.log(`Order ${orderId}: userId が null のため通知をスキップ (channel: ${newData.orderChannel})`);
      return;
    }

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

exports.onStoreCreated = onDocumentCreated(
  { document: "stores/{storeId}", region: "asia-northeast1" },
  async (event) => {
    const storeId = event.params.storeId;
    const storeData = event.data.data();
    if (storeData.spreadsheetId) return;
    console.warn(
      `[Sheet未設定] 店舗 ${storeId} (${storeData.name || "?"}) の売上シートが未作成です。` +
      `共有フォルダ内に手動でスプレッドシートを作成し、linkStoreSheet で紐付けてください。`
    );
  },
);

/**
 * 手動作成されたスプレッドシートを店舗に紐付ける
 */
exports.linkStoreSheet = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError("permission-denied", "管理者権限が必要です。");
    }

    const payload = data.data && typeof data.data === "object" ? data.data : data;
    const { storeId, spreadsheetId } = payload;
    if (!storeId || !spreadsheetId) {
      throw new functions.https.HttpsError("invalid-argument", "storeId と spreadsheetId は必須です。");
    }

    try {
      const { sheets, drive } = await getGoogleClients();

      // ① フォルダへのアクセス権限と、対象共有フォルダに含まれているか検証
      let fileMeta;
      try {
        const res = await drive.files.get({
          fileId: spreadsheetId,
          fields: "parents,owners(emailAddress)",
        });
        fileMeta = res.data;
      } catch (e) {
        throw new functions.https.HttpsError("not-found", "スプレッドシートが見つからないか、サービスアカウントに編集権限がありません。");
      }

      if (!fileMeta.parents || !fileMeta.parents.includes(SHEET_FOLDER_ID)) {
        throw new functions.https.HttpsError("failed-precondition", "スプレッドシートが指定された共有フォルダ内にありません。");
      }

      // ② タブ名変更と1行目固定
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [{
              updateSheetProperties: {
                properties: {
                  sheetId: 0,
                  title: SHEET_TAB,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: "title,gridProperties.frozenRowCount",
              },
            }],
          },
        });
      } catch (e) {
        throw new functions.https.HttpsError("internal", "タブ名の変更またはヘッダの固定に失敗しました。");
      }

      // ③ ヘッダの書き込み
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${SHEET_TAB}'!A1:J1`,
          valueInputOption: "RAW",
          resource: { values: [SHEET_HEADER] },
        });
      } catch (e) {
        throw new functions.https.HttpsError("internal", "ヘッダ行の書き込みに失敗しました。");
      }

      // ④ Firestoreの更新
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      await db.collection("stores").doc(storeId).update({
        spreadsheetId,
        spreadsheetUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, spreadsheetUrl };
    } catch (error) {
      console.error("linkStoreSheet Error:", error);
      // HttpsError の場合はそのまま投げる
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", "予期せぬエラーが発生しました。");
    }
  });


/**
 * 既存シートのヘッダを再初期化（管理者専用）
 */
exports.reinitSheetHeaders = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError("permission-denied", "管理者権限が必要です。");
    }

    try {
      const { sheets } = await getGoogleClients();
      const storesSnap = await db.collection("stores").get();
      let successCount = 0;

      for (const doc of storesSnap.docs) {
        const storeData = doc.data();
        const spreadsheetId = storeData.spreadsheetId;
        if (!spreadsheetId) continue;

        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
              requests: [{
                updateSheetProperties: {
                  properties: {
                    sheetId: 0,
                    title: SHEET_TAB,
                    gridProperties: { frozenRowCount: 1 },
                  },
                  fields: "title,gridProperties.frozenRowCount",
                },
              }],
            },
          });
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${SHEET_TAB}'!A1:J1`,
            valueInputOption: "RAW",
            resource: { values: [SHEET_HEADER] },
          });
          successCount++;
        } catch (e) {
          console.error(`Failed to reinit headers for store ${doc.id}:`, e);
        }
      }
      return { success: true, message: `${successCount} 店舗のヘッダを更新しました。` };
    } catch (error) {
      console.error("reinitSheetHeaders Error:", error);
      throw new functions.https.HttpsError("internal", "予期せぬエラーが発生しました。");
    }
  });

/**
 * 注文→スプレッドシート一括同期 (毎分実行)
 */
exports.syncOrdersToSheets = functions
  .region("asia-northeast1")
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    const metaRef = db.collection("sheet_sync_meta").doc("cursor");
    const now = Date.now();

    // 排他ロック (5分)
    const lockAcquired = await db.runTransaction(async (t) => {
      const metaDoc = await t.get(metaRef);
      if (metaDoc.exists) {
        const lockedAt = metaDoc.data().lockedAt;
        if (lockedAt) {
          const lockedMillis = lockedAt.toDate().getTime();
          if (now - lockedMillis < 5 * 60 * 1000) {
            return false;
          }
        }
      }
      t.set(metaRef, { lockedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });

    if (!lockAcquired) {
      console.warn("syncOrdersToSheets: 別のプロセスが実行中のためスキップします");
      return;
    }

    try {
      const metaDoc = await metaRef.get();
      
      // 起点時刻の計算: 前回実行時刻の90秒前、ただし最大24時間前まで
      const maxBackoff = now - 24 * 60 * 60 * 1000;
      let lastRunAt = metaDoc.exists && metaDoc.data().lastRunAt ? metaDoc.data().lastRunAt.toDate().getTime() : maxBackoff;
      let startTime = Math.max(lastRunAt - 90 * 1000, maxBackoff);

      console.log(`syncOrdersToSheets: startTime = ${new Date(startTime).toISOString()}`);

      // Firestoreから更新された注文を取得
      const ordersSnap = await db.collection("orders")
        .where("updatedAt", ">=", admin.firestore.Timestamp.fromMillis(startTime))
        .get();

      // 店舗ごとにグループ化、かつ対象ステータスのみフィルタ
    const storeOrders = {};
    for (const doc of ordersSnap.docs) {
      const orderData = doc.data();
      if (!isSyncTargetOrder(orderData)) continue;
      
      const storeId = orderData.storeId;
      if (!storeId) continue;
      if (!storeOrders[storeId]) storeOrders[storeId] = [];
      storeOrders[storeId].push({ id: doc.id, data: orderData });
    }

    const { sheets } = await getGoogleClients();
    let allSuccess = true;

    for (const storeId of Object.keys(storeOrders)) {
      const storeDoc = await db.collection("stores").doc(storeId).get();
      if (!storeDoc.exists || !storeDoc.data().spreadsheetId) {
        console.warn(`[Sheet未設定] 店舗 ${storeId} のスプレッドシートが未設定のためスキップ`);
        continue;
      }
      
      const spreadsheetId = storeDoc.data().spreadsheetId;
      const orders = storeOrders[storeId];
      
      let retryCount = 0;
      let success = false;
      while (retryCount < 3 && !success) {
        try {
          // A列から注文ID一覧を取得
          const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${SHEET_TAB}'!A:A`,
          });
          const rows = res.data.values || [];
          
          // orderId -> rowIndex のマップ (Sheetsは1-indexed)
          const rowIndexMap = {};
          for (let i = 1; i < rows.length; i++) { // 行1(ヘッダ)をスキップ
            if (rows[i] && rows[i][0]) rowIndexMap[rows[i][0]] = i + 1;
          }

          const updates = [];
          const appends = [];

          for (const order of orders) {
            const rowData = buildRow(order.id, order.data);
            if (rowIndexMap[order.id]) {
              updates.push({
                range: `'${SHEET_TAB}'!A${rowIndexMap[order.id]}:J${rowIndexMap[order.id]}`,
                values: [rowData],
              });
            } else {
              appends.push({ order, rowData });
            }
          }

          // 更新処理 (batchUpdate)
          if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId,
              resource: {
                valueInputOption: "RAW",
                data: updates,
              },
            });
          }

          // 新規追記処理 (append) - createdAt昇順にソート
          if (appends.length > 0) {
            appends.sort((a, b) => {
              const tA = a.order.data.createdAt?.toMillis() || 0;
              const tB = b.order.data.createdAt?.toMillis() || 0;
              return tA - tB;
            });
            const appendData = appends.map(a => a.rowData);
            await sheets.spreadsheets.values.append({
              spreadsheetId,
              range: `'${SHEET_TAB}'!A:J`,
              valueInputOption: "RAW",
              insertDataOption: "INSERT_ROWS",
              resource: { values: appendData },
            });
          }
          
          success = true;
        } catch (error) {
          const code = error?.response?.status ?? error?.code ?? error?.status;
          console.error(`Error syncing store ${storeId} (Attempt ${retryCount+1}):`, error);
          
          if ([400, 401, 403, 404].includes(code)) {
            // 恒久的なエラー: 失敗を記録してループを抜け、カーソルは止まらないようにする
            const failRef = db.collection("sheet_sync_failures").doc(`${storeId}_${code}`);
            const failDoc = await failRef.get();
            const firstSeenAt = failDoc.exists ? failDoc.data().firstSeenAt : admin.firestore.FieldValue.serverTimestamp();
            await failRef.set({
              storeId,
              spreadsheetId,
              errorCode: code,
              errorMessage: error.message,
              operation: "sync",
              firstSeenAt,
              lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
              count: admin.firestore.FieldValue.increment(1)
            }, { merge: true });

            success = true; // allSuccessを落とさないためにtrue扱いで進行
            break;
          }
          
          // 一時的エラー (429, 5xx) の場合はリトライ
          retryCount++;
          if (retryCount >= 3) {
            const failRef = db.collection("sheet_sync_failures").doc(`${storeId}_${code || "unknown"}`);
            const failDoc = await failRef.get();
            const firstSeenAt = failDoc.exists ? failDoc.data().firstSeenAt : admin.firestore.FieldValue.serverTimestamp();
            await failRef.set({
              storeId,
              spreadsheetId,
              errorCode: code || "unknown",
              errorMessage: error.message,
              operation: "sync_retry_exhausted",
              firstSeenAt,
              lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
              count: admin.firestore.FieldValue.increment(1)
            }, { merge: true });
            allSuccess = false; // カーソルを据え置く
          } else {
            // ジッタ付き指数バックオフ (1s -> 2s -> 4s)
            const delay = Math.pow(2, retryCount - 1) * 1000 + Math.random() * 500;
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }
      }

      if (allSuccess) {
        await metaRef.set({ 
          lastRunAt: admin.firestore.Timestamp.fromMillis(now),
          lockedAt: admin.firestore.FieldValue.delete()
        }, { merge: true });
      } else {
        console.warn("Some stores failed to sync with temporary errors. Cursor not advanced.");
        await metaRef.set({ lockedAt: admin.firestore.FieldValue.delete() }, { merge: true });
      }
    } catch (e) {
      await metaRef.set({ lockedAt: admin.firestore.FieldValue.delete() }, { merge: true });
      throw e;
    }
  });


/**
 * スプレッドシート復旧用 (スーパー管理者専用)
 */
exports.rebuildStoreSheet = functions
  .region("asia-northeast1")
  .runWith({ timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email !== "ynrcs1000@gmail.com") {
      throw new functions.https.HttpsError("permission-denied", "管理者権限が必要です。");
    }

    const payload = data.data && typeof data.data === "object" ? data.data : data;
    const { storeId } = payload;
    if (!storeId) {
      throw new functions.https.HttpsError("invalid-argument", "storeId は必須です。");
    }

    const storeDoc = await db.collection("stores").doc(storeId).get();
    if (!storeDoc.exists || !storeDoc.data().spreadsheetId) {
      throw new functions.https.HttpsError("not-found", "スプレッドシートが未設定です。");
    }
    const spreadsheetId = storeDoc.data().spreadsheetId;

    try {
      const ordersSnap = await db.collection("orders").where("storeId", "==", storeId).get();
      const validOrders = [];
      for (const doc of ordersSnap.docs) {
        const orderData = doc.data();
        if (isSyncTargetOrder(orderData)) {
          validOrders.push({ id: doc.id, data: orderData });
        }
      }

      validOrders.sort((a, b) => {
        const tA = a.data.createdAt?.toMillis() || 0;
        const tB = b.data.createdAt?.toMillis() || 0;
        return tA - tB;
      });

      const rows = validOrders.map(o => buildRow(o.id, o.data));

      const { sheets } = await getGoogleClients();

      // データ部分のクリア (A2:J)
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${SHEET_TAB}'!A2:J`,
      });

      if (rows.length > 0) {
        // 一括追記
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${SHEET_TAB}'!A2:J`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          resource: { values: rows },
        });
      }

      return { success: true, message: `${rows.length} 件の注文で再構築しました。` };
    } catch (error) {
      console.error("rebuildStoreSheet Error:", error);
      throw new functions.https.HttpsError("internal", "復旧処理に失敗しました。");
    }
  });



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
        isAutoSuspended: admin.firestore.FieldValue.delete(),       // 手動操作時に自動停止フラグをクリア
        isEmergencyStopped: admin.firestore.FieldValue.delete(),    // 手動「営業開始」時に緊急停止フラグをクリア
        emergencySuspendedAt: admin.firestore.FieldValue.delete(),  // 旧フィールドの掃除（既存ドキュメント対応）
        updatedAt: now,
      };

      // 「営業中」に変更する場合は lastActivityAt を更新 (活動開始基準)
      if (newStatus === "open") {
        storeUpdateData.lastActivityAt = now;
      }

      // 店舗ステータスを更新
      await db.collection("stores").doc(storeId).update(storeUpdateData);

      // 「営業中」に変更する場合、商品の isAvailable を更新
      if (newStatus === "open" && Array.isArray(availableItemIds)) {
        const itemsSnap = await db.collection("items")
          .where("storeId", "==", storeId)
          .get();

        if (!itemsSnap.empty) {
          const availableSet = new Set(availableItemIds);
          const batch = db.batch();

          itemsSnap.docs.forEach((doc) => {
            batch.update(doc.ref, {
              isAvailable: availableSet.has(doc.id),
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
            isAutoSuspended: true, // 自動停止フラグを立てる
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

// ============================================================
// ペナルティ自動執行バッチ（設計憲法§10.2 / penalty_system_CONTEXT 準拠）
// ============================================================

/**
 * @name abandonStaleOrders
 * @description 毎分実行。ready_for_pickup から5分超過した注文を abandoned に遷移させ、
 *              当該ユーザーを banned_users に登録する。
 *              安全弁: _metadata/system_alerts の penaltyEnabled が true の場合のみ執行。
 *              ホワイトリスト: PENALTY_WHITELIST_EMAILS のアカウントはBAN対象外。
 */
exports.abandonStaleOrders = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      // --- 安全弁チェック: penaltyEnabled フラグ ---
      const alertsDoc = await db.doc("_metadata/system_alerts").get();
      const penaltyEnabled = alertsDoc.exists && alertsDoc.data().penaltyEnabled === true;
      if (!penaltyEnabled) {
        // penaltyEnabled が false または未設定 → 何もしない
        return null;
      }

      // --- 5分超過の ready_for_pickup 注文を取得 ---
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const threshold = admin.firestore.Timestamp.fromDate(fiveMinutesAgo);

      const staleOrdersSnap = await db.collection("orders")
        .where("status", "==", "ready_for_pickup")
        .where("readyForPickupAt", "<=", threshold)
        .get();

      if (staleOrdersSnap.empty) {
        return null;
      }

      console.log(`abandonStaleOrders: ${staleOrdersSnap.size} 件の放置注文を検出`);

      // --- ホワイトリスト用: メールアドレスからUIDセットを構築 ---
      const whitelistUids = new Set();
      for (const email of PENALTY_WHITELIST_EMAILS) {
        try {
          const userRecord = await admin.auth().getUserByEmail(email);
          whitelistUids.add(userRecord.uid);
        } catch (e) {
          // ユーザーが存在しない場合は無視
          console.warn(`abandonStaleOrders: ホワイトリストのメール ${email} に対応するユーザーが見つかりません`);
        }
      }

      // --- 各注文を処理 ---
      const batch = db.batch();
      let processedCount = 0;

      for (const doc of staleOrdersSnap.docs) {
        const orderData = doc.data();
        const userId = orderData.userId;

        // userId が null（POS注文等）の場合はスキップ
        if (!userId) {
          console.log(`abandonStaleOrders: 注文 ${doc.id} は userId が null のためスキップ`);
          continue;
        }

        // ホワイトリスト除外
        if (whitelistUids.has(userId)) {
          console.log(`abandonStaleOrders: 注文 ${doc.id} はホワイトリスト対象のためスキップ (uid: ${userId})`);
          continue;
        }

        // ユーザーのメアドと名前を取得
        let userEmail = null;
        let userDisplayName = null;
        try {
          const userSnap = await db.collection("users").doc(userId).get();
          if (userSnap.exists) {
            const userData = userSnap.data();
            userEmail = userData.email || null;
            userDisplayName = userData.displayName || null;
          }
        } catch (e) {
          console.error(`abandonStaleOrders: ユーザー情報取得失敗 (uid: ${userId})`, e);
        }

        // 注文ステータスを abandoned に遷移
        batch.update(doc.ref, {
          status: "abandoned",
          abandonedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // banned_users に登録（既に存在する場合は上書き）
        const banRef = db.collection("banned_users").doc(userId);
        batch.set(banRef, {
          bannedBy: "auto_scheduler",
          reason: "商品受け取り放置 (ready_for_pickup 5分超過)",
          orderId: doc.id,
          receiptNumber: orderData.receiptNumber || null,
          storeId: orderData.storeId || null,
          userEmail: userEmail,
          userDisplayName: userDisplayName,
          bannedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        processedCount++;
        console.log(`abandonStaleOrders: 注文 ${doc.id} → abandoned, ユーザー ${userId} → BAN`);
      }

      if (processedCount > 0) {
        await batch.commit();
        console.log(`abandonStaleOrders: ${processedCount} 件の放置注文を処理完了`);
      }

      return null;
    } catch (error) {
      console.error("abandonStaleOrders Error:", error);
      return null;
    }
  });

// ============================================================
// unbanUser – スーパー管理者によるBAN解除 (Callable)
// ============================================================
exports.unbanUser = functions.region("asia-northeast1").https.onCall(async (data, context) => {
  // スーパー管理者のみ実行可能
  if (!context.auth || context.auth.token.email !== "ynrcs1000@gmail.com") {
    throw new functions.https.HttpsError("permission-denied", "スーパー管理者のみ実行可能です");
  }

  const requestData = data.data && typeof data.data === "object" ? data.data : data;
  const { uid } = requestData;
  if (!uid || typeof uid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "uid が必要です");
  }

  await db.collection("banned_users").doc(uid).delete();
  console.log(`unbanUser: UID ${uid} のBANを解除しました (by ${context.auth.token.email})`);
  return { success: true };
});

// ============================================================
// SOK（セルフオーダーキオスク）関連 Cloud Functions
// 設計憲法§5.2 / §4.1 準拠
// ============================================================

/**
 * @name createSokProvisional
 * @description iPad側で仮注文を作成する（スタッフ認証必須・スパム防止）
 *              設計憲法§5.2 Phase 1 対応
 *              引数: { storeId, items: [{ itemId, quantity, customizations }] }
 */
exports.createSokProvisional = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    // スタッフ認証必須（未ログインは拒否 → 無限スパム防止）
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "店舗スタッフのログインが必要です。");
    }
    // store_admin 権限チェック
    const token = context.auth.token;
    if (token.role !== "store_admin") {
      throw new functions.https.HttpsError("permission-denied", "店舗管理者権限が必要です。");
    }

    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { storeId, items } = requestData;

    if (!storeId || !Array.isArray(items) || items.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "storeId と items が必要です。");
    }
    // storeId と Custom Claims の storeId が一致することを確認
    if (token.storeId !== storeId) {
      throw new functions.https.HttpsError("permission-denied", "自店舗のSOK端末のみ操作可能です。");
    }

    try {
      // 店舗ステータスチェック
      const storeDoc = await db.collection("stores").doc(storeId).get();
      if (!storeDoc.exists) {
        throw new functions.https.HttpsError("not-found", "店舗が見つかりません。");
      }
      const storeData = storeDoc.data();
      if (storeData.operationStatus !== "open") {
        throw new functions.https.HttpsError("failed-precondition", "この店舗は現在受付を停止しています。");
      }

      // 商品情報のサーバーサイド検証と金額計算
      const itemRefs = items.map((i) => db.doc(`items/${i.itemId}`));
      const productDocs = await db.getAll(...itemRefs);
      const productMap = new Map(
        productDocs.filter((d) => d.exists).map((d) => [d.id, d.data()])
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
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new functions.https.HttpsError("invalid-argument", "数量は1以上の整数である必要があります。");
        }
        totalPrice += product.price * item.quantity;
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

      // 仮注文ドキュメント作成（status: null が SOK 仮注文の証）
      const orderRef = db.collection("orders").doc();
      const now = admin.firestore.FieldValue.serverTimestamp();
      await orderRef.set({
        status:             null,           // SOK仮注文は null — 設計憲法§5.2
        sokStatus:          "pending",
        orderChannel:       "sok",
        storeId,
        items:              orderItems,
        totalPrice,
        receiptNumber:      null,           // confirmSokOrder で発番
        userId:             null,           // claimSokOrder で設定
        createdBy:          context.auth.uid,
        paymentMethod:      "au_pay_manual",
        cancellationReason: null,
        note:               null,
        termsAgreedAt:      null,
        createdAt:          now,
        updatedAt:          now,
        sokClaimedAt:       null,
        sokConfirmedAt:     null,
        expiredAt:          null,
        readyToServeAt:     null,
        readyForPickupAt:   null,
        completedAt:        null,
        cancelledAt:        null,
        abandonedAt:        null,
      });

      updateStoreActivity(storeId);
      return { orderId: orderRef.id };
    } catch (error) {
      console.error("createSokProvisional Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

/**
 * @name claimSokOrder
 * @description 来場者がQRを読み取りログイン後、注文を自分のものとして紐付ける
 *              トランザクション使用で競合防止（同時読み取りの二重claim禁止）
 *              引数: { orderId }
 */
exports.claimSokOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
    }
    const uid = context.auth.uid;

    // BANチェック（サーバー側二層防御）
    const banDoc = await db.doc(`banned_users/${uid}`).get();
    if (banDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "利用が制限されています。");
    }

    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderId } = requestData;
    if (!orderId) {
      throw new functions.https.HttpsError("invalid-argument", "orderId が必要です。");
    }

    try {
      await db.runTransaction(async (tx) => {
        const orderRef = db.doc(`orders/${orderId}`);
        const orderSnap = await tx.get(orderRef);

        if (!orderSnap.exists) {
          throw new functions.https.HttpsError("not-found", "注文が見つかりません。");
        }
        const order = orderSnap.data();
        if (order.orderChannel !== "sok") {
          throw new functions.https.HttpsError("invalid-argument", "SOK注文ではありません。");
        }
        if (order.sokStatus !== "pending") {
          // 他の誰かが先にclaimした、または期限切れ
          throw new functions.https.HttpsError(
            "failed-precondition",
            order.sokStatus === "expired"
              ? "QRコードの有効期限が切れています。店舗のiPadで最初からやり直してください。"
              : "このQRコードはすでに使用されています。"
          );
        }

        tx.update(orderRef, {
          sokStatus:    "claimed",
          userId:       uid,
          sokClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return { success: true };
    } catch (error) {
      console.error("claimSokOrder Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

/**
 * @name confirmSokOrder
 * @description 来場者が規約同意後、注文を確定し受付番号を発番する
 *              claimed → confirmed + status: "cooking" へ昇格
 *              引数: { orderId }
 */
exports.confirmSokOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
    }
    const uid = context.auth.uid;

    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderId } = requestData;
    if (!orderId) {
      throw new functions.https.HttpsError("invalid-argument", "orderId が必要です。");
    }

    try {
      const result = await db.runTransaction(async (tx) => {
        const orderRef = db.doc(`orders/${orderId}`);
        const orderSnap = await tx.get(orderRef);

        if (!orderSnap.exists) {
          throw new functions.https.HttpsError("not-found", "注文が見つかりません。");
        }
        const order = orderSnap.data();

        if (order.sokStatus !== "claimed") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "先に注文の紐付け（claim）が必要です。"
          );
        }
        if (order.userId !== uid) {
          throw new functions.https.HttpsError("permission-denied", "この注文を確定する権限がありません。");
        }

        // 受付番号発番（SOK経路: 2000〜2999）
        const receiptNumber = await getNextReceiptNumber("sok", tx);
        const now = admin.firestore.FieldValue.serverTimestamp();

        tx.update(orderRef, {
          status:         "cooking",      // ← 通常注文フローに合流！
          sokStatus:      "confirmed",
          receiptNumber,
          termsAgreedAt:  now,
          sokConfirmedAt: now,
          updatedAt:      now,
        });

        return { receiptNumber, storeId: order.storeId };
      });

      updateStoreActivity(result.storeId);
      return { success: true, receiptNumber: result.receiptNumber };
    } catch (error) {
      console.error("confirmSokOrder Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

/**
 * @name expireSokOrders
 * @description 5分以上放置された SOK 仮注文を自動的に期限切れにする
 *              毎分実行のスケジュール関数
 *              ※ SOK失効はBANの対象外（来場者の都合によるため）
 */
exports.expireSokOrders = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 1 minutes")
  .onRun(async () => {
    try {
      const fiveMinutesAgo = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 5 * 60 * 1000)
      );

      const expiredSnap = await db.collection("orders")
        .where("orderChannel", "==", "sok")
        .where("sokStatus", "in", ["pending", "claimed"])
        .where("createdAt", "<=", fiveMinutesAgo)
        .get();

      if (expiredSnap.empty) return null;

      const batch = db.batch();
      expiredSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          sokStatus: "expired",
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      console.log(`[expireSokOrders] ${expiredSnap.size} 件の仮注文を期限切れに変更しました`);
      return null;
    } catch (error) {
      console.error("expireSokOrders Error:", error);
      return null;
    }
  });

/**
 * @name cancelSokOrder
 * @description 来場者スマホからSOKの仮注文を手動キャンセルする
 */
exports.cancelSokOrder = functions
  .region("asia-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
    }

    const requestData = data.data && typeof data.data === "object" ? data.data : data;
    const { orderId } = requestData;

    if (!orderId) {
      throw new functions.https.HttpsError("invalid-argument", "orderId が必要です。");
    }

    try {
      await db.runTransaction(async (tx) => {
        const orderRef = db.doc(`orders/${orderId}`);
        const orderSnap = await tx.get(orderRef);

        if (!orderSnap.exists) {
          throw new functions.https.HttpsError("not-found", "注文が見つかりません。");
        }
        const order = orderSnap.data();

        if (order.orderChannel !== "sok") {
          throw new functions.https.HttpsError("failed-precondition", "この注文はキャンセルできません。");
        }

        if (order.status != null) {
          throw new functions.https.HttpsError("failed-precondition", "確定後のキャンセルはできません。");
        }

        if (order.sokStatus !== "claimed") {
           throw new functions.https.HttpsError("failed-precondition", "この注文はキャンセルできません。");
        }

        if (order.userId !== context.auth.uid) {
           throw new functions.https.HttpsError("permission-denied", "この注文をキャンセルする権限がありません。");
        }

        tx.update(orderRef, {
          sokStatus: "cancelled",
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancellationReason: "user_cancelled_before_confirm",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      return { success: true };
    } catch (error) {
      console.error("cancelSokOrder Error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

// ============================================================
// 商品在庫状況の店舗データへの自動同期
// ============================================================
exports.syncStoreItemAvailability = onDocumentWritten({ document: "items/{itemId}", region: "asia-northeast1" }, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  // 変更がない、または isAvailable が変化していない場合はスキップ
  if (before && after && before.isAvailable === after.isAvailable) {
    return;
  }

  // 対象のstoreIdを特定
  const storeId = after ? after.storeId : before.storeId;
  if (!storeId) return;

  try {
    // 該当店舗の全アイテムを取得
    const itemsSnap = await db.collection("items").where("storeId", "==", storeId).get();
    
    let availableItemCount = 0;
    const totalItemCount = itemsSnap.size;

    itemsSnap.forEach(doc => {
      if (doc.data().isAvailable === true) {
        availableItemCount++;
      }
    });

    // 店舗ドキュメントを更新
    await db.collection("stores").doc(storeId).update({
      availableItemCount: availableItemCount,
      totalItemCount: totalItemCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
  } catch (error) {
    console.error(`syncStoreItemAvailability Error for store ${storeId}:`, error);
  }
});


