# 南陵祭2026 認証システム移行 実装計画 V4確定版

**第0章: 確定事項・全体アーキテクチャ**

- 版: V4-Final (2026-08-28 確定)
- 対象プロジェクト: `nanryosai-2026-a4091`
- 本番オリジン: `https://ynr-cs.github.io`(公開URL: `https://ynr-cs.github.io/nanryosai2026/`)
- 文化祭: 2026-09-11(金・非公開) / 09-12(土・一般公開 10:00-15:00)

本計画書は6分冊構成:

| 分冊              | 内容                                                      |
| ----------------- | --------------------------------------------------------- |
| 00_overview.md    | 本書。確定事項・claims設計・認証フロー                    |
| 01_backend.md     | Cloud Functions 新規/改修コード全文                       |
| 02_rules.md       | firestore.rules / storage.rules 改訂全文                  |
| 03_frontend.md    | 全HTMLファイルの行番号レベル変更指示                      |
| 04_ops.md         | データリセット手順・grantSuperAdmin.js・Secrets/OAuth設定 |
| 05_deploy_test.md | デプロイ順序・テストマトリクス                            |

現物検証の一次ソース: `docs/v4-source-verification.md`(実コード行番号との対応表)。

---

## 0.1 目的(絶対要件)

> **生徒・来場者のメールアドレスを、システムのどこにも保存せず、誰からも閲覧できなくする。**
> その上で全ユーザー(来場者含む)がログインでき、機能単位のアクセス制御を Custom Claims で行う。

- Google でログインはするが、Firebase Auth に google.com プロバイダを**リンクしない**
- メールは Cloud Functions 内で判定に使った直後に破棄。永続化ゼロ
- Firebase Console の Authentication 画面にもメールが並ばない(UIDのみの匿名レコード)
- Firestore の users / banned_users / orders / store_secrets / \_metadata からも PII を全廃

## 0.2 ユーザー確定事項(全決定済み・ブロッカーなし)

| #   | 論点                      | 決定                                                                                                                                                          |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | claimsスキーマ            | **案①**: `identity` + `identityOverride` + `role` + `storeId` の4キー                                                                                         |
| A-2 | 関数名                    | メイン認証=`authenticateWithGoogle` / 手動救済=`grantIdentity`                                                                                                |
| A-3 | portal教員問題            | **教員は使わない**。portalは identity ゲート(0014生徒)+店舗PWの二段構え                                                                                       |
| A-4 | FCM                       | **配列 `fcmTokens`** に全統一 + `sendEachForMulticast` + 失効掃除                                                                                             |
| A-5 | superadminフェイルセーフ  | claims一本化 + `scripts/grantSuperAdmin.js` を事前作成・検証                                                                                                  |
| A-6 | bannedのclaims化          | しない(伝播遅延1hのため)。banned_users の onSnapshot/サーバー照会を維持                                                                                       |
| A-7 | 生徒判定                  | **2条件のみ**: 末尾 `@gl.pen-kanagawa.ed.jp` **かつ** 先頭 `0014`(hd・文字数チェックは不採用)                                                                 |
| B   | データ移行                | 不要。**全ユーザーデータ破棄リセット**(未公開テスト段階のため)                                                                                                |
| —   | login.html の生徒確認画面 | **維持**(step-student-check / step-student-confirm)                                                                                                           |
| —   | OAuthクライアントID       | 作成済み: `93228414556-tm81uv1jir0hd9ofc4kooq3kr49mpc00.apps.googleusercontent.com`。本番オリジン登録済み。**ローカル用オリジンの追加が必要**(04_ops.md §4.4) |

## 0.3 Custom Claims 設計(確定)

```jsonc
{
  // ── 身体的アイデンティティ(authenticateWithGoogle が毎回再計算) ──
  "identity": "student" | "guest" | "super_admin",

  // ── 手動救済(grantIdentity でのみ設定。再計算で消されない) ──
  "identityOverride": "student",        // 任意。存在すれば identity=guest でも生徒扱い

  // ── 店舗権限(既存 loginStore が付与。identity とは独立・加算的) ──
  "role": "store_admin",
  "storeId": "store_xxx"
}
```

- `identity` はログインのたびにサーバーで再計算(卒業・退学等での剥奪が自動)
- `identityOverride` は authenticateWithGoogle が**保持**する(マージ時に消さない)
- `role`/`storeId` も同様に保持。loginStore(既存 index.js L352-441)は**変更ほぼ不要**
  (現物確認済み: `{...currentClaims, storeId, role}` の非破壊マージ + portal.html L3779 の `getIdToken(true)`)
- 有効生徒判定のクライアント/サーバー共通式:
  `isStudent = (identity === "student") || (identityOverride === "student") || (identity === "super_admin")`
- BAN は claims にしない(A-6)。従来どおり `banned_users/{uid}` を参照

## 0.4 生徒/管理者の判定ロジック(サーバー側・確定)

```js
// authenticateWithGoogle 内。payload は Google IDトークン検証済みペイロード
function classifyIdentity(payload) {
  const email = (payload.email || "").toLowerCase();
  if (payload.email_verified !== true) return "guest";
  if (email === "ynrcs1000@gmail.com") return "super_admin"; // 部の公開アドレス(非PII)
  if (email.endsWith("@gl.pen-kanagawa.ed.jp") && email.startsWith("0014")) {
    return "student"; // 神奈川県立高校共通ドメイン + 南陵の学校整理番号 0014
  }
  return "guest";
}
```

## 0.5 匿名UID導出(確定)

```
uid = "u_" + base64url( HMAC-SHA256( UID_PEPPER, google_sub ) ).slice(0, 32)
```

- `google_sub` は Google の恒久ユーザーID(メールではない — 学校メールは学年+出席番号で列挙可能なため sub を使う)
- `UID_PEPPER` は Secret Manager(`firebase functions:secrets:set UID_PEPPER`)。
  **漏洩・紛失すると全ユーザーのアカウントが別人になる。バックアップ必須**(04_ops.md §4.2)
- 同一 Google アカウント → 常に同一 UID(お気に入り・注文履歴・BANが再ログインでも維持される)
- UID からメール・sub の逆算は不可能(unlinkability)

## 0.6 認証フロー全体像(確定)

```
[ブラウザ]                              [Cloud Functions]              [Firebase Auth]
    │ 1. GIS renderButton                     │                             │
    │    (nonce 付き)                          │                             │
    │ 2. Google IDトークン取得                  │                             │
    ├── 3. authenticateWithGoogle ───────────▶│                             │
    │      {idToken, nonce}                   │ 4. OAuth2Client             │
    │                                         │    .verifyIdToken()         │
    │                                         │ 5. nonce / email_verified   │
    │                                         │    検証                      │
    │                                         │ 6. classifyIdentity()       │
    │                                         │ 7. uid = HMAC(pepper, sub)  │
    │                                         │    ★ここで payload 破棄★     │
    │                                         ├── 8. getUser/createUser ──▶│
    │                                         ├── 9. setCustomUserClaims ─▶│ (identity 等)
    │                                         ├── 10. createCustomToken ──▶│
    │◀── 11. {customToken, identity} ─────────┤                             │
    │ 12. signInWithCustomToken ──────────────────────────────────────────▶│
    │ 13. IDトークンに claims が最初から入っている(伝播遅延の影響なし)          │
```

技術要点(V4議論で確定済みの実装細則):

- GIS は `ux_mode: "popup"` + `renderButton()`。One Tap の `prompt()` は使わない(クールダウン・WebView問題)
- `use_fedcm_for_button: true`
- nonce: クライアントで `crypto.randomUUID()` を生成し sessionStorage に保持 → GIS `initialize` に SHA-256 ハッシュを渡し、callable には生値を送る。サーバーで `sha256(rawNonce) === payload.nonce` を検証(リプレイ対策)
- claims を **createCustomToken の前に** setCustomUserClaims(初回ログインから claims 有効 = 伝播遅延回避)
- `createCustomToken(uid)` に第2引数(developer claims)は渡さない(V3の欠陥修正)
- `createUser({uid})` の `auth/uid-already-exists` は競合として握りつぶして getUser にフォールバック
- **コーディング規約: IDトークン payload・email をいかなる console.log / エラーメッセージにも出さない**

## 0.7 スコープ内で同時に修正するバグ(現物検証で確定)

| #   | バグ                                                                             | 現物根拠                                                        | 修正先分冊 |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------- |
| 1   | FCM 書込/読出の単複不整合(account=配列, mobile-order/sok-to=単数, 読出=単数のみ) | index.js L879 / account L624 / mobile-order L1663 / sok-to L787 | 01 / 03    |
| 2   | `sok_redirect` パラメータを portal.html が未処理(自動復帰しない)                 | sok.html L1720 / portal.html L3503-3505                         | 03         |
| 3   | `abandonStaleOrders` の getUserByEmail 依存(V4後に silent fail)                  | index.js L1660-1668                                             | 01         |
| 4   | App Check サーバー側強制の欠落(context.app チェック皆無)                         | index.js 全体 grep                                              | 01         |
| 5   | banned_users / orders.note / updatedBy への PII 保存                             | index.js L842, L1719-1720, L257, L328 / admin_sync L1336        | 01 / 03    |
| 6   | portal.html の signInWithRedirect 残存(auth.js v0.4.0 方針と不整合)              | portal L3508-3521, L3730                                        | 03         |

## 0.8 やらないこと(明示的スコープ外)

- データ移行・ダウンタイムゼロ切替(全リセットで代替。04_ops.md)
- BAN の claims 化(A-6)
- 教員向けの特別な入口(A-3。必要になれば `grantIdentity` で個別救済可能)
- venue.html の認証改修(独立認証系 `loginVenueAdmin` + venues コレクション。email 非依存を確認済み)
- パスワードレス化等の追加機能

# V4確定版 — 第1章: Cloud Functions(バックエンド)

対象: `functions/index.js`(現行 v1 API, node 20, firebase-admin ^13.6.0, firebase-functions ^7.0.3)

## 1.0 依存関係の追加

```bash
cd functions
npm install google-auth-library
```

package.json に `"google-auth-library": "^10.x"` が追加されることを確認。

## 1.1 ファイル冒頭への追加(定数・共通ヘルパー)

既存の `const PENALTY_WHITELIST_EMAILS = ["ynrcs1000@gmail.com"];`(L23)を**削除**し、以下に置換:

```js
const { OAuth2Client } = require("google-auth-library");

// GCP OAuth ウェブクライアントID(公開情報のためハードコード可)
const OAUTH_CLIENT_ID =
  "93228414556-tm81uv1jir0hd9ofc4kooq3kr49mpc00.apps.googleusercontent.com";

// ペナルティ免除(UIDベース。V4以降 getUserByEmail は使用不可)
// super_admin の UID は grantSuperAdmin.js 実行後に確認して記入(04_ops.md §4.3)
const PENALTY_WHITELIST_UIDS = new Set([
  // "u_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
]);

// OAuth2Client はモジュールスコープで生成可(Secretは含まないため安全)
const oauthClient = new OAuth2Client(OAUTH_CLIENT_ID);

// ── 共通ヘルパー ───────────────────────────────

/** App Check 強制(全 callable の先頭で呼ぶ) */
function requireAppCheck(context) {
  if (!context.app) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "不正なアプリケーションからのアクセスです。",
    );
  }
}

/** super_admin 判定(email 比較を全廃) */
function isSuperAdminToken(token) {
  return token && token.identity === "super_admin";
}

/** 有効生徒判定(identityOverride / super_admin を含む) */
function isEffectiveStudent(token) {
  if (!token) return false;
  return (
    token.identity === "student" ||
    token.identityOverride === "student" ||
    token.identity === "super_admin"
  );
}

/** super_admin 必須ガード */
function requireSuperAdmin(context) {
  if (!context.auth || !isSuperAdminToken(context.auth.token)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "この操作を実行する権限がありません。",
    );
  }
}
```

> **コーディング規約(全関数共通)**: `payload`・`email`・IDトークンを console.log / エラー文言に**絶対に出さない**。既存の `console.error("...", error)` は維持してよいが、握った error に PII が含まれる箇所(verifyIdToken 失敗等)は `error.message` を出さず固定文言にする。

## 1.2 新規: `authenticateWithGoogle`(メイン認証)

```js
/**
 * @name authenticateWithGoogle
 * @description GIS IDトークンを検証し、匿名UIDのCustom Tokenを発行する。
 *              メールアドレスは判定に使った直後に破棄され、どこにも保存されない。
 * Secrets: UID_PEPPER
 */
exports.authenticateWithGoogle = functions
  .region("asia-northeast1")
  .runWith({ secrets: ["UID_PEPPER"], maxInstances: 20 })
  .https.onCall(async (data, context) => {
    requireAppCheck(context);

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const idToken = requestData.idToken;
    const rawNonce = requestData.nonce;

    if (
      !idToken ||
      typeof idToken !== "string" ||
      !rawNonce ||
      typeof rawNonce !== "string"
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "認証情報が不正です。",
      );
    }

    // 1. Google IDトークン検証
    let payload;
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: OAUTH_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      // 規約: e.message に PII が含まれ得るためログに出さない
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Google認証の検証に失敗しました。",
      );
    }

    // 2. nonce 検証(リプレイ対策): payload.nonce === sha256(rawNonce)
    const expectedNonce = crypto
      .createHash("sha256")
      .update(rawNonce)
      .digest("hex");
    if (!payload.nonce || payload.nonce !== expectedNonce) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "認証セッションが不正です。再度お試しください。",
      );
    }

    // 3. アイデンティティ分類(メールはここでのみ参照)
    const identity = classifyIdentity(payload);

    // 4. 匿名UID導出(sub ベース。メール非依存)
    const sub = payload.sub;
    if (!sub) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Google認証の検証に失敗しました。",
      );
    }
    const pepper = process.env.UID_PEPPER; // 関数内で遅延参照(規約)
    if (!pepper) {
      throw new functions.https.HttpsError(
        "internal",
        "サーバー設定エラーです。管理者に連絡してください。",
      );
    }
    const uid =
      "u_" +
      crypto
        .createHmac("sha256", pepper)
        .update(sub)
        .digest("base64url")
        .slice(0, 32);

    // ★ この時点以降 payload(メール等)は一切使わない ★
    payload = null;

    // 5. Auth ユーザーレコードの確保(匿名・プロバイダなし)
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        try {
          userRecord = await admin.auth().createUser({ uid });
        } catch (e2) {
          if (e2.code === "auth/uid-already-exists") {
            userRecord = await admin.auth().getUser(uid); // 同時ログイン競合
          } else {
            throw new functions.https.HttpsError(
              "internal",
              "アカウント作成に失敗しました。",
            );
          }
        }
      } else {
        throw new functions.https.HttpsError(
          "internal",
          "アカウント照会に失敗しました。",
        );
      }
    }

    // 6. claims 再計算マージ(identityOverride / role / storeId は保持)
    const current = userRecord.customClaims || {};
    const newClaims = { ...current, identity };
    await admin.auth().setCustomUserClaims(uid, newClaims);

    // 7. Custom Token 発行(developer claims 引数は渡さない)
    const customToken = await admin.auth().createCustomToken(uid);

    // 8. 有効 identity(override 込み)を返す ※クライアントのUI分岐用
    const effectiveIdentity =
      identity === "guest" && newClaims.identityOverride === "student"
        ? "student"
        : identity;

    return { customToken, identity: effectiveIdentity };
  });

/** 生徒/管理者 分類(0.4節の確定ロジック) */
function classifyIdentity(payload) {
  const email = (payload.email || "").toLowerCase();
  if (payload.email_verified !== true) return "guest";
  if (email === "ynrcs1000@gmail.com") return "super_admin";
  if (email.endsWith("@gl.pen-kanagawa.ed.jp") && email.startsWith("0014")) {
    return "student";
  }
  return "guest";
}
```

> 備考: `crypto` は既存 L184 で require 済みだが関数スコープ内。**モジュールトップの require 群(L7-15)の直後に移動**すること。

## 1.3 新規: `grantIdentity`(手動救済・super_admin専用)

```js
/**
 * @name grantIdentity
 * @description guest 判定されたユーザーに identityOverride を手動付与/剥奪する。
 *              例: 個人Gmailの実行委員、(将来必要になった場合の)教員。
 */
exports.grantIdentity = functions
  .region("asia-northeast1")
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data, context) => {
    requireAppCheck(context);
    requireSuperAdmin(context);

    const requestData =
      data.data && typeof data.data === "object" ? data.data : data;
    const targetUid = requestData.uid;
    const grant = requestData.grant === true; // true=付与 / false=剥奪

    if (!targetUid || typeof targetUid !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "uid が必要です。",
      );
    }

    let userRecord;
    try {
      userRecord = await admin.auth().getUser(targetUid);
    } catch (e) {
      throw new functions.https.HttpsError(
        "not-found",
        "ユーザーが見つかりません。",
      );
    }

    const current = userRecord.customClaims || {};
    let newClaims;
    if (grant) {
      newClaims = { ...current, identityOverride: "student" };
    } else {
      // V4ドラフトの FieldValue.delete バグ修正: キー除外で組み直す
      const { identityOverride, ...rest } = current;
      newClaims = rest;
    }
    await admin.auth().setCustomUserClaims(targetUid, newClaims);

    return { success: true, uid: targetUid, granted: grant };
  });
```

## 1.4 新規: `deleteMyAccount`(退会・クライアント deleteUser の置換)

```js
/**
 * @name deleteMyAccount
 * @description 本人によるアカウント削除。進行中注文がある場合は拒否。
 *              Firestore の users/{uid} を削除し、Auth レコードも削除する。
 *              注文履歴(orders)は匿名UIDのみで PII を含まないため残置(売上集計保全)。
 */
exports.deleteMyAccount = functions
  .region("asia-northeast1")
  .runWith({ maxInstances: 5 })
  .https.onCall(async (data, context) => {
    requireAppCheck(context);
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "ログインが必要です。",
      );
    }
    const uid = context.auth.uid;

    // 進行中注文チェック(ステータス名は現物確定値)
    const activeSnap = await db
      .collection("orders")
      .where("userId", "==", uid)
      .where("status", "in", ["cooking", "ready_to_serve", "ready_for_pickup"])
      .limit(1)
      .get();
    if (!activeSnap.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "進行中の注文があるため退会できません。受け取り完了後にお試しください。",
      );
    }

    // users/{uid} とサブコレクション(favorites 等)を削除
    await db.recursiveDelete(db.collection("users").doc(uid));

    // Auth レコード削除(claims ごと消える。BAN記録 banned_users/{uid} は残置)
    await admin.auth().deleteUser(uid);

    return { success: true };
  });
```

## 1.5 既存関数の改修(行番号は現行 index.js)

### (a) 全 callable 共通

各 callable の認証チェック直前に `requireAppCheck(context);` を追加。
**【重要】** `warmupOrderFunctions` からのコールドスタート保温リクエスト（App Check トークンなし）を受け取るため、ウォームアップ対象の7関数（`createOrder`, `createSokProvisional`, `claimSokOrder`, `confirmSokOrder`, `kitchenComplete`, `callForPickup`, `completeOrder`）では、必ず **`if (requestData && requestData.warmup === true) return { warmup: true };` の直後に `requireAppCheck(context);` を配置**すること（最先頭に置くと保温リクエストがエラーログを大量発生させるため）。
対象: `createStoreSecret` / `batchUpdateStoreSecrets` / `loginStore` / `createOrder` / `kitchenComplete` / `callForPickup` / `completeOrder` / `cancelOrder` / `adminUpdateOrderStatus` / `unbanUser` / `claimSokOrder` / `loginVenueAdmin` / sheet系 callable(L950/L1036/L1290 付近)

### (b) superadmin 判定の全置換(email → claims)

| 行                 | 旧                                                                                   | 新                                               |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| L228-234           | `const email = context.auth.token.email; if (email !== "ynrcs1000@gmail.com") {...}` | `requireSuperAdmin(context);`                    |
| L288-294           | 同上                                                                                 | `requireSuperAdmin(context);`                    |
| L814               | `const isSuperAdmin = token.email === "ynrcs1000@gmail.com";`                        | `const isSuperAdmin = isSuperAdminToken(token);` |
| L950, L1036, L1290 | `context.auth.token.email !== "ynrcs1000@gmail.com"` ガード                          | `requireSuperAdmin(context);`                    |
| L1745 (unbanUser)  | 同上                                                                                 | `requireSuperAdmin(context);`                    |

### (c) PII 保存の全廃

| 行   | 旧                                                              | 新                                         |
| ---- | --------------------------------------------------------------- | ------------------------------------------ |
| L257 | `updatedBy: email`                                              | `updatedBy: context.auth.uid`              |
| L328 | `updatedBy: email`                                              | `updatedBy: context.auth.uid`              |
| L842 | ``note: reason \|\| `管理者 (${token.email}) による手動変更` `` | `note: reason \|\| "管理者による手動変更"` |

### (d) createOrder の mobile 判定(L508-512)

```js
// 旧
const email = context.auth.token.email || "";
if (
  !email.endsWith("@gl.pen-kanagawa.ed.jp") &&
  email !== "ynrcs1000@gmail.com"
) {
  throw new functions.https.HttpsError(
    "permission-denied",
    "モバイルオーダーは在校生のみ利用可能です。",
  );
}
// 新
if (!isEffectiveStudent(context.auth.token)) {
  throw new functions.https.HttpsError(
    "permission-denied",
    "モバイルオーダーは在校生のみ利用可能です。",
  );
}
```

BANチェック(L514-517)・二重注文チェック(L520-530)・pos 経路の role/storeId チェック(L534-539)は**変更なし**。

### (e) sendOrderUpdateNotification(L856-927)— FCM配列化+失効掃除

L879-921 を置換:

```js
const fcmTokens = Array.isArray(userData?.fcmTokens) ? userData.fcmTokens : [];
if (fcmTokens.length === 0) {
  console.log(`User ${userId} has no FCM tokens.`);
  return;
}

// ...(title/body の switch は変更なし)...

const message = {
  notification: { title, body },
  data: { orderId, url: `/status.html?orderId=${orderId}` },
  tokens: fcmTokens,
};

try {
  const response = await getMessaging().sendEachForMulticast(message);
  // 失効トークンの掃除
  const invalidTokens = [];
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-argument"
      ) {
        invalidTokens.push(fcmTokens[i]);
      }
    }
  });
  if (invalidTokens.length > 0) {
    await db
      .collection("users")
      .doc(userId)
      .update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
    console.log(
      `Removed ${invalidTokens.length} invalid FCM tokens for ${userId}`,
    );
  }
  console.log(
    `Notification sent to ${userId} (${response.successCount}/${fcmTokens.length})`,
  );
} catch (error) {
  console.error("Error sending notification:", error);
}
```

### (f) abandonStaleOrders(L1630-1738)— getUserByEmail 廃止+PII除去

- L1658-1668(ホワイトリストUID解決ループ)を**削除**し、`whitelistUids` を `PENALTY_WHITELIST_UIDS` に置換
- L1690-1702(users から email/displayName 読み出し)を**削除**
- L1719-1720 の `userEmail` / `userDisplayName` フィールドを banned_users への set から**削除**
- 代わりに `nickname: userData?.nickname || null` を保存してよい(任意。superadmin での識別用)

### (g) claimSokOrder / loginVenueAdmin

- email 依存なし(検証済み)。`requireAppCheck` の追加のみ。

## 1.6 削除・非対象

- `PENALTY_WHITELIST_EMAILS`(L23): 削除(1.1で置換済み)
- `setupVenueAdmin.js`: 変更なし(Admin SDK 直実行スクリプト。grantSuperAdmin.js の雛形として流用)
- Sheets 連携(googleapis): 認可は superadmin 判定置換のみ。売上データに PII なし

## 1.7 関数一覧(V4後の全体像)

| 関数                                                          | 種別      | 状態                          |
| ------------------------------------------------------------- | --------- | ----------------------------- |
| **authenticateWithGoogle**                                    | callable  | **新規**(Secrets: UID_PEPPER) |
| **grantIdentity**                                             | callable  | **新規**                      |
| **deleteMyAccount**                                           | callable  | **新規**                      |
| loginStore                                                    | callable  | 微修正(requireAppCheckのみ)   |
| createOrder                                                   | callable  | 判定置換                      |
| kitchenComplete / callForPickup / completeOrder / cancelOrder | callable  | requireAppCheck追加           |
| adminUpdateOrderStatus                                        | callable  | 判定置換+note修正             |
| createStoreSecret / batchUpdateStoreSecrets                   | callable  | 判定置換+updatedBy修正        |
| unbanUser / sheet系×3                                         | callable  | 判定置換                      |
| claimSokOrder / loginVenueAdmin                               | callable  | requireAppCheck追加           |
| sendOrderUpdateNotification                                   | trigger   | FCM配列化                     |
| abandonStaleOrders                                            | scheduler | UID化+PII除去                 |
| onStoreCreated ほか triggers                                  | trigger   | 変更なし                      |

# V4確定版 — 第2章: セキュリティルール改訂

方針: 変更は **isSuperAdmin() の claims 化**と **users への PII 書込禁止バリデーション追加**の2点のみ。他は現行を維持(一括書換は行わない)。

## 2.1 firestore.rules の変更

### (1) isSuperAdmin()(現行 L20-29)を置換

```
    // スーパー管理者 (identity claim ベース — V4)
    // 【設計判断】V4移行によりトークンに email は存在しない。
    // ロックアウト時のフェイルセーフは scripts/grantSuperAdmin.js (Admin SDK直実行) に移管。
    // Firebase Console からは Custom Claims を編集できない点に注意(04_ops.md §4.3)。
    function isSuperAdmin() {
      return isAuthenticated()
             && request.auth.token.identity == 'super_admin';
    }
```

> 旧条件の `email_verified == true` は identity 分類時にサーバーで検証済みのため不要。

### (2) users の write に PII 禁止バリデーションを追加(現行 L113-116)

「二度と email が書かれない」ことをルール層でも保証する(多層防御)。
なお、`delete` 操作時は `request.resource` が `null` となるため評価エラーを避けるよう `allow delete` と `allow create, update` を明示的に分離する。

```
    match /users/{userId}/{document=**} {
      allow read: if (isAuthenticated() && request.auth.uid == userId) || isSuperAdmin();
      // delete 時: request.resource が null のため PII チェックは行わず UID 一致のみで許可
      allow delete: if isAuthenticated() && request.auth.uid == userId;
      // create, update 時のみ: PII フィールドの書き込みをルール層で禁止
      allow create, update: if isAuthenticated() && request.auth.uid == userId
                   && !request.resource.data.keys().hasAny(
                        ['email', 'displayName', 'photoURL']);
    }
```

> 注意: この条件はサブコレクション(favorites 等)のドキュメントにも適用される。
> favorites のフィールドは itemId/storeId 等のみ(auth.js 現物確認済み)のため影響なし。
> nickname / fcmTokens / deviceType / notificationEnabled / permissionStatus / lastLogin は引き続き書込可。

### (3) 変更しないもの(確認済み)

- `isStoreAdmin()`: すでに role/storeId claims ベース。変更なし
- orders / banned_users / counters / \_metadata / venues / store_secrets: isSuperAdmin() の定義変更が自動的に波及するのみ
- orders の「PII を含まないため公開可」という安全性の宣言(L69-71)は V4 で完全に真になる(現行は note に管理者メールが混入し得た — index.js L842 修正で解消)

## 2.2 storage.rules の変更

### isSuperAdmin()(現行 L16-18)を置換

```
    function isSuperAdmin() {
      return isAuthenticated() && request.auth.token.identity == 'super_admin';
    }
```

他は変更なし(isStoreAdmin は claims ベース済み)。

## 2.3 改訂後の権限マトリクス(要約)

| リソース          | guest                 | student(=identity/override) | store_admin  | super_admin          |
| ----------------- | --------------------- | --------------------------- | ------------ | -------------------- |
| stores/items 読み | ✅                    | ✅                          | ✅           | ✅                   |
| items 書き        | ✕                     | ✕                           | 自店のみ     | ✅                   |
| orders 読み       | ready_for_pickup のみ | 自分の注文+左記             | 自店         | ✅                   |
| orders 書き       | ✕(Functions経由)      | ✕(同)                       | ✕(同)        | ✅(コンソール緊急用) |
| users/{自分}      | ✅(PIIフィールド除く) | ✅(同)                      | ✅(同)       | 読みのみ全員分       |
| banned_users      | 自分のみ読み          | 自分のみ読み                | 自分のみ読み | ✅読み               |
| \_metadata 書き   | ✕                     | ✕                           | ✕            | ✅                   |
| products画像 書き | ✕                     | ✕                           | 自店         | ✅                   |

- モバイルオーダーの「在校生のみ」制限はルールではなく **createOrder(Functions)** が担う(orders create はルール上全面禁止のため)。
- portal 等の画面ゲートはフロント(03_frontend.md)+Functions の二層で担保。ルール変更は不要。

# V4確定版 — 第3章: フロントエンド変更指示(全ファイル)

行番号は `docs/refs/src/` にミラーした現物(2026-08-27時点)基準。

## 3.0 共通方針

1. **Googleログインの入口は auth.js の `login()` 一本に統一**。portal.html の独自 signInWithPopup/Redirect も廃止し auth.js を使う(または同一実装を移植)。
2. クライアントの生徒/管理者判定はすべて **`getIdTokenResult()` の claims** で行う。email 参照は全廃。
3. 有効生徒判定の共通式(auth.js に `isEffectiveStudent(claims)` としてexport):
   `claims.identity === "student" || claims.identityOverride === "student" || claims.identity === "super_admin"`
4. FCM トークンの保存は **`fcmTokens: arrayUnion(token)`** に統一。
5. 表示名はニックネーム(users/{uid}.nickname, ユーザー入力)または「ゲスト」。photoURL は使わない。

## 3.1 main/auth.js(v0.4.0 → v1.0.0)— 全面改修

### 削除

- `GoogleAuthProvider` / `signInWithPopup` のimportと使用箇所
- L223: `console.log("[Auth] Popup login success:", user.email)`(PIIログ)
- L225-233: users/{uid} への `displayName / email / photoURL` setDoc(**削除必須**)

### login() の置換(GIS + Custom Token)

```js
// <head> 側(各ログインUIを持つページ):
// <script src="https://accounts.google.com/gsi/client" async></script>

import { signInWithCustomToken } from ".../firebase-auth.js";
import { httpsCallable } from ".../firebase-functions.js";

const OAUTH_CLIENT_ID =
  "93228414556-tm81uv1jir0hd9ofc4kooq3kr49mpc00.apps.googleusercontent.com";

async function sha256hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * GISボタンを指定コンテナに描画する。
 * @param {HTMLElement} container ボタンを置く要素
 * @param {(result:{user, identity:string})=>void} onSuccess
 * @param {(error:Error)=>void} onError
 */
async function renderGoogleLoginButton(container, onSuccess, onError) {
  const rawNonce = crypto.randomUUID();
  sessionStorage.setItem("gis_nonce", rawNonce);
  const hashedNonce = await sha256hex(rawNonce);

  google.accounts.id.initialize({
    client_id: OAUTH_CLIENT_ID,
    nonce: hashedNonce,
    ux_mode: "popup",
    use_fedcm_for_button: true,
    callback: async (response) => {
      try {
        const authFn = httpsCallable(functions, "authenticateWithGoogle");
        const result = await authFn({
          idToken: response.credential,
          nonce: sessionStorage.getItem("gis_nonce"),
        });
        const { customToken, identity } = result.data;
        const cred = await signInWithCustomToken(auth, customToken);
        // 規約: email等のPIIをログに出さない
        console.log("[Auth] Login success. identity:", identity);
        logEvent(analytics, "login", { method: "Google" });
        onSuccess({ user: cred.user, identity });
      } catch (e) {
        console.error("[Auth] Login failed:", e.code || e.name);
        onError(e);
      }
    },
  });
  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    logo_alignment: "left",
    width: Math.min(container.clientWidth || 320, 400),
  });
}
```

- 旧 `login()` は残さない(呼び出し元を全て renderGoogleLoginButton へ移行)。
- `detectInAppBrowser()` の警告は renderGoogleLoginButton 呼び出し前に呼び出し側で実施(GISはWebView耐性が高いが警告は維持)。
- One Tap(`google.accounts.id.prompt()`)は**使用しない**。

### 追加 export

```js
/** IDトークンの claims を取得(forceRefresh 指定可) */
async function getClaims(force = false) {
  const u = auth.currentUser;
  if (!u) return null;
  return (await u.getIdTokenResult(force)).claims;
}

function isEffectiveStudent(claims) {
  return (
    !!claims &&
    (claims.identity === "student" ||
      claims.identityOverride === "student" ||
      claims.identity === "super_admin")
  );
}

function isSuperAdminClaims(claims) {
  return !!claims && claims.identity === "super_admin";
}
```

export 一覧(L472-489)に `renderGoogleLoginButton, getClaims, isEffectiveStudent, isSuperAdminClaims` を追加し、`login` を削除。

- `watchUser` / `logout` / `toggleFavorite` / `getFavorites` / BAN監視(onSnapshot)は**変更なし**(uidベースで既に PII 非依存)。
- `requireLogin`(L388)の TODO 実装は現行スコープ外のまま維持。

## 3.2 main/login.html(v0.2.0)

| 行                  | 変更                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<head>`            | `<script src="https://accounts.google.com/gsi/client" async></script>` を追加                                                                                                                                               |
| L451, L512, L587    | 「在校生アカウント(@gl.pen-kanagawa.ed.jp)」の説明文言は**維持**(ユーザーが自分の学校アカウントを選ぶ案内として有効)。「0014で始まる学校配布アカウント」の補足を追記                                                        |
| L756-762            | `isStudentEmail(email)` を削除 → `isEffectiveStudent(claims)`(auth.jsからimport)に置換                                                                                                                                      |
| ログインボタン      | 既存の「Googleでログイン」ボタン(popup-blocked-guidance含む)を `renderGoogleLoginButton(container, onSuccess, onError)` に置換。popup-blocked ガイダンスは GIS では原則不要だが、onError 時の汎用エラーメッセージとして流用 |
| L838-896            | `mode === "student"` フロー維持。判定材料を変更: onSuccess の `identity`(または `getClaims()` )で `student` なら step-student-confirm、そうでなければ step-student-check を表示                                             |
| L847 watchUser      | ログイン済み再訪時: `getClaims()` を取得して同じ分岐。`user.email` 参照(L854)を削除                                                                                                                                         |
| リダイレクト        | `getSafeRedirect()`(L775-)は健全のため**変更なし**                                                                                                                                                                          |
| mode=sok 分岐(L741) | 変更なし                                                                                                                                                                                                                    |

## 3.3 main/account.html(v0.2.0)

| 行               | 変更                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L530             | `import { deleteUser }` を削除                                                                                                                                                              |
| L624             | `fcmTokens: arrayUnion(token)` — **変更なし**(すでに配列)                                                                                                                                   |
| L680-694         | `.profile-email` 表示を削除。代わりに **ニックネーム UI** を実装: users/{uid}.nickname の表示+編集(setDoc merge)。未設定時は「ゲスト」+設定促し                                             |
| L934             | `await deleteUser(user)` → `await httpsCallable(functions, "deleteMyAccount")()` に置換。成功後 `signOut` → index.html へ。エラー `failed-precondition`(進行中注文あり)のハンドリングを追加 |
| プロフィール画像 | photoURL 表示があれば汎用アイコンに置換                                                                                                                                                     |

## 3.4 main/app-shell.js(v0.1.0)

| 行                  | 変更                                                                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L783-798 `initAuth` | `if (user && user.photoURL)` による分岐を **`if (user)` に統一**。`user.photoURL` 依存を撤廃して汎用アイコン（SVG）またはニックネーム頭文字を表示し、ログイン時は **`this.checkActiveOrder(user)` を確実に実行**（photoURL 消失に伴う注文バッジ監視停止を防止） |
| import              | `login` の import を削除(ログイン導線は login.html へ遷移させる方式は現状維持のため、`login()` 直呼びしている箇所があれば `location.href = "./login.html?redirect=..."` に置換)                                                                                 |

## 3.5 main/banned.html

| 行             | 変更                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| L545           | `userEmail = "guest@example.com"` 等の email 変数群を削除                                                                                            |
| L682, L892-912 | `{email}` 差し込み・final-email 表示を、**ニックネーム(なければ「名無しの南陵生」等)** ベースの演出に書換。ユーモア演出は維持しつつ email 要素を全廃 |

## 3.6 main/admin_sync.html(v0.2.86)

| 行         | 変更                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------- |
| L877       | import に `getClaims, isSuperAdminClaims` を追加、`login` を GIS 方式に置換                        |
| L1117-1121 | `updateAuthUI` 内 `user.email === "ynrcs1000@gmail.com"` → `isSuperAdminClaims(await getClaims())` |
| L1336      | `updatedBy: currentUser.email` → `updatedBy: currentUser.uid`                                      |

## 3.7 main/admin/superadmin.html

| 行                   | 変更                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| L643, L658           | `ALLOWED_EMAIL` ガード → `isSuperAdminClaims(await getClaims())`                                                                                  |
| L884, L942-943, L982 | `fillMissingBanInfo` と userEmail/userDisplayName 表示列を**削除**(サーバー側でフィールド廃止)。BAN一覧は uid + nickname(あれば) + 注文情報で表示 |
| 追加                 | **grantIdentity 操作UI**(任意・推奨): uid 入力 → grantIdentity callable 呼び出し(付与/剥奪)。運用は 04_ops.md §4.5                                |

## 3.8 pos/portal.html(v0.2.69)— 最大の改修

### (a) 認証部の置換

- L3508-3521 `getRedirectResult` ブロック: **削除**
- L3682-3735 `btn-google-login` の signInWithPopup/signInWithRedirect: **削除** → `renderGoogleLoginButton()` に置換(portal は独自 Firebase init のため、auth.js を import できる構成に寄せるか、同実装をインライン移植。**推奨: `../main/auth.js` を import して二重init を解消**)
- L3585-3595 `ALLOWED_DOMAIN` / `MASTER_ACCOUNTS` / `isAuthorizedUser(user)`: **削除** → 置換:

```js
async function isAuthorizedUser(user) {
  if (!user) return false;
  const claims = (await user.getIdTokenResult()).claims;
  return isEffectiveStudent(claims); // 0014生徒 / override / super_admin
}
```

- L3619-3626 `onAuthStateChanged` 内の呼び出しを `await isAuthorizedUser(user)` に変更(async化)
- L3596-3602 `showDomainError`: 文言を「南陵生の学校アカウント(0014...@gl.pen-kanagawa.ed.jp)でログインしてください」に更新(email表示はすでに除去済みを確認)

### (b) 二段構えゲート(A-3確定)

1. **第一段**: 上記 identity ゲート(教員は通れない — 割切り確定)
2. **第二段**: 既存の店舗選択+パスワード(`loginStore` callable L3771-3772、`getIdToken(true)` L3779)。
   **【整合性強化】** L3631-3651 の自動ログイン処理において、`localStorage.getItem("nanryosai_store_id")` が存在する場合でも無条件に画面を開かず、`(await user.getIdTokenResult()).claims` を照合して `claims.role === "store_admin" && claims.storeId === cachedId`（または `claims.identity === "super_admin"`）であることを検証してから `startApp()` を実行する。権限が一致しない場合はキャッシュを無視して店舗選択・PW入力画面（`step-store`）を表示する。

### (c) sok_redirect バグ修正

- L3812-3813 の `returnUrl` 処理は維持しつつ、**sok.html 側を修正**する(3.10参照)。portal 側は変更不要(`?return=` に一本化)

### (d) 文言

- L2392, L2434 のドメイン案内: 「0014で始まる学校アカウント」補足を追記

## 3.9 pos/mobile-order.html(v0.4.0)

| 行                           | 変更                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| L1497-1518 init()            | `user.email` ドメイン再チェック(L1501-1504)→ `isEffectiveStudent((await user.getIdTokenResult()).claims)` に置換 |
| L1633-1648 updateUserProfile | `email: currentUser.email,` と `displayName: currentUser.displayName,` の2行を**削除**(deviceType 等は維持)      |
| L1663 saveToken              | `fcmToken: token,` → `fcmTokens: arrayUnion(token),`(firestore import に arrayUnion 追加)                        |
| L1521-1527 redirectToLogin   | 変更なし(login.html?mode=student への遷移は維持)                                                                 |

## 3.10 pos/sok.html・sok-to.html

**sok.html**
| 行 | 変更 |
|---|---|
| L1720 | `portal.html?sok_redirect=...` → **`portal.html?return=${encodeURIComponent(window.location.href)}`**(バグ修正。portal は `return` のみ処理) |
| L1725-1727 | claims 判定は既存のまま(role/storeId)。**変更なし** |

**sok-to.html**
| 行 | 変更 |
|---|---|
| L637 | `${user.displayName \|\| user.email} としてログイン中` → ニックネーム(users/{uid}.nickname)または「ログイン中」に置換 |
| L787 | `fcmToken: token,` → `fcmTokens: arrayUnion(token),` |
| ログイン導線 | login.html 往復方式(mode=sok)は維持。login.html 側の GIS 化で自動対応 |

## 3.11 pos/pos.html・kitchen.html・monitor.html・presenter.html

4ファイル同型(pos L911-916 / kitchen L803-808 / monitor L707-712 / presenter L717-722):

- `ALLOWED_DOMAIN` / `MASTER_ACCOUNTS` 定数を削除
- `isAuthorizedUser(user)` を claims 判定に置換:
  - **主判定**: `claims.role === "store_admin" && claims.storeId === targetStoreId`
  - **補助**: `claims.identity === "super_admin"`
  - 理由: これらは店舗運営端末であり、portal で店舗ログイン済みであることが前提。identity(生徒)だけでは店舗データにアクセスできない(rules上も無意味)ため、role + storeId ゲートが正しい
- **Modular SDK (`pos.html`, `monitor.html`)**:
  `import { getIdTokenResult } from ".../firebase-auth.js";` を追加し、`onAuthStateChanged` を async 化:
  ```js
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      redirectToPortal();
      return;
    }
    const claims = (await getIdTokenResult(user)).claims;
    if (
      claims.identity !== "super_admin" &&
      (claims.role !== "store_admin" || claims.storeId !== storeId)
    ) {
      redirectToPortal();
      return;
    }
    startApp();
  });
  ```
- **Compat SDK (`kitchen.html`, `presenter.html`)**:
  `firebase.auth().onAuthStateChanged` を async 化:
  ```js
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      redirectToPortal();
      return;
    }
    const claims = (await user.getIdTokenResult()).claims;
    if (
      claims.identity !== "super_admin" &&
      (claims.role !== "store_admin" || claims.storeId !== storeId)
    ) {
      redirectToPortal();
      return;
    }
    startApp();
  });
  ```
- 案内文言(kitchen L619 / monitor L556 / pos L667 / presenter L576): 「portalで店舗ログインしてから開いてください」に更新
- training/pos.html: 認証非依存（モック完結）を確認済みのため変更なし

## 3.12 pos/status.html

- L679-683 の `login()` 直呼び出し箇所を、未定義エラー回避のため **`window.location.href = "../main/login.html?redirect=" + encodeURIComponent(window.location.href);`** に置換。claims 依存なし・注文は uid 照合のため他は変更なし。

## 3.13 main/index.html・detail.html

- お気に入り(toggleFavorite/getFavorites)は uid ベースで**変更なし**
- `login()` 直呼びがあれば login.html 遷移 or renderGoogleLoginButton に置換
- ヘッダーは app-shell.js 経由のため 3.4 で自動対応

## 3.14 文書ページの更新

### main/privacy.html(プライバシーポリシー)

- 「Googleアカウントのメールアドレス・氏名・プロフィール画像を取得・保存しない」ことを明記
- 取得する情報: 匿名化された内部ID(復元不能なハッシュ)、ニックネーム(任意入力)、通知トークン、注文内容
- Google でのログイン時にGoogleから提供される情報は認証判定のみに利用し即時破棄する旨を明記

### main/terms.html

- アカウントの定義を「Google アカウントに紐づく匿名IDによる利用登録」に更新
- 退会(deleteMyAccount)と BAN 記録の残置(匿名IDのみ)について記述

### main/mobile-order-guide.html(技術仕様書)

- L597, L768: `fcmToken: String` → `fcmTokens: Array<String>`
- データモデル節に匿名UID設計(HMAC / PII非保存)の概要を追記

## 3.15 変更不要と確認済みのファイル

| ファイル                    | 理由                                                   |
| --------------------------- | ------------------------------------------------------ |
| main/admin/venue.html       | 独立認証(loginVenueAdmin + PW)。email 非依存を確認済み |
| pos/pos-alert.js            | 認証非依存                                             |
| firebase-messaging-sw.js ×2 | トークン保存形式に非依存                               |
| main/style.css              | ニックネームUI追加時に必要なら小規模追記のみ           |

# V4確定版 — 第4章: 運用・環境設定・データリセット

## 4.1 データリセット手順(移行に代わる全削除)

前提: 未公開テスト段階のため既存ユーザーデータは全破棄してよい(ユーザー確定)。
**タイミング: Functions/Rules デプロイ直前(05_deploy_test.md の Step 3)**

### (1) Firebase Auth 全ユーザー削除

```bash
# scripts/wipeAuthUsers.js(Admin SDK, 要サービスアカウント鍵)
node scripts/wipeAuthUsers.js
```

```js
// scripts/wipeAuthUsers.js
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});

async function wipeAll(nextPageToken) {
  const page = await admin.auth().listUsers(1000, nextPageToken);
  const uids = page.users.map((u) => u.uid);
  if (uids.length > 0) {
    await admin.auth().deleteUsers(uids);
    console.log(`deleted ${uids.length} users`);
  }
  if (page.pageToken) await wipeAll(page.pageToken);
}
wipeAll().then(() => console.log("done"));
```

これで google.com プロバイダ紐付けの旧アカウント(メール可視)が全消滅する。

### (2) Firestore の PII コレクション削除

Firebase CLI で再帰削除:

```bash
firebase firestore:delete users --recursive --project nanryosai-2026-a4091 --force
firebase firestore:delete banned_users --recursive --project nanryosai-2026-a4091 --force
firebase firestore:delete orders --recursive --project nanryosai-2026-a4091 --force
```

- `orders` はテスト注文のみのため全削除(note への管理者メール混入・userId の旧UID参照を一掃)
- `stores` / `items` / `store_secrets` / `counters` / `venues` / `_metadata` は保持。ただし:
  - `store_secrets/*.updatedBy` と `_metadata/master_sync.updatedBy` にメールが残っていれば該当**フィールド**をコンソール等で削除(または admin_sync 再実行で uid に上書き)
  - `counters` はテスト注文の連番をリセットしたければ削除可(任意)

### (3) Cloud Logging の過去ログ

```
GCPコンソール → Logging → ログストレージ → _Default バケット
```

- 保持期間を最短(1日〜)に一時変更するか、`gcloud logging logs delete` で過去ログを削除
- V4デプロイ後は新規ログに PII が出ない(コーディング規約)ため、保持期間は既定に戻してよい

### (4) Firestore エクスポート/バックアップ

- 過去に `gcloud firestore export` を実行していれば、GCS 上のエクスポートファイルに PII が残る → 該当 GCS オブジェクトを削除
- 実行していなければ対応不要

## 4.2 Secret: UID_PEPPER

```bash
# 生成(64バイトランダム)
openssl rand -base64 64
# 登録
firebase functions:secrets:set UID_PEPPER --project nanryosai-2026-a4091
# (プロンプトに上記の値を貼り付け)
```

**バックアップ必須**: 値を部の物理金庫等に控える(紙+オフラインUSB推奨)。

- 紛失時: 全ユーザーの UID が変わる = 全員のお気に入り・履歴・BANが消失(再ログインで新規アカウント化)
- 漏洩時: sub を知る攻撃者が UID を計算可能になる(sub 自体が秘匿情報のため実害は限定的だが、ローテーションを検討)
- デプロイ時に `runWith({ secrets: ["UID_PEPPER"] })` が authenticateWithGoogle に付いていることを確認

## 4.3 super_admin フェイルセーフ: scripts/grantSuperAdmin.js

**背景(確定事項)**: Firebase Console からは Custom Claims を閲覧・編集**できない**。
V4後は rules も Functions も claims 判定のため、claims が消えると superadmin 操作が全部不能になる。
復旧手段として Admin SDK 直実行スクリプトを**事前に作成し、リセット直後に動作確認しておく**。

```js
// scripts/grantSuperAdmin.js
// 使い方: node scripts/grantSuperAdmin.js <uid>
// uid は ynrcs1000@gmail.com で一度ログインした後の匿名UID
// (Functions ログ or Firebase Console Authentication のUID列で確認)
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});

const uid = process.argv[2];
if (!uid) {
  console.error("usage: node grantSuperAdmin.js <uid>");
  process.exit(1);
}

(async () => {
  const user = await admin.auth().getUser(uid);
  const claims = { ...(user.customClaims || {}), identity: "super_admin" };
  await admin.auth().setCustomUserClaims(uid, claims);
  console.log(`OK: ${uid} に identity=super_admin を付与しました`);
  console.log("現在のclaims:", JSON.stringify(claims));
})();
```

- 通常運用では**不要**(ynrcs1000@gmail.com でログインすれば authenticateWithGoogle が毎回 super_admin を再付与する)
- 想定利用場面: classifyIdentity のバグ等で super_admin が付かなくなった緊急時
- `serviceAccountKey.json` は **絶対に git にコミットしない**(.gitignore 登録を確認)
- 同梱の `setupVenueAdmin.js` と同じ実行環境(functions ディレクトリの node_modules)で動く

### super_admin UID の確認と PENALTY_WHITELIST_UIDS への記入

1. V4デプロイ後、ynrcs1000@gmail.com でログイン
2. Firebase Console → Authentication → 唯一の(または該当時刻の)`u_...` UID を確認
3. `functions/index.js` の `PENALTY_WHITELIST_UIDS` に記入して再デプロイ
   (記入するまでの間、super_admin もペナルティ対象になる点に注意 — テスト時のみ影響)

## 4.4 GCP OAuth クライアント設定

クライアントID: `93228414556-tm81uv1jir0hd9ofc4kooq3kr49mpc00.apps.googleusercontent.com`

**「承認済みの JavaScript 生成元」に以下を全て登録**(本番は登録済み・確認済み):

```
https://ynr-cs.github.io        ← 登録済み
http://localhost:3000
http://localhost:3001
http://localhost:5500
http://127.0.0.1:5500
http://localhost                ← GIS はポート付きlocalhostでもこの登録を推奨
http://127.0.0.1
```

- リダイレクトURIは不要(ux_mode: "popup" のため)
- 反映に数分〜数時間かかることがある(GISのエラー `origin_mismatch` が出たら待つ)
- **注意**: GitHub Pages はパス(`/nanryosai2026/`)を含むが、オリジンはホストまでなので追加登録は不要

## 4.5 identityOverride の運用(grantIdentity)

- 対象想定: 個人 Gmail しか持たない実行委員、(将来方針が変われば)教員
- 手順:
  1. 対象者に一度サイトでログインしてもらう(guest として匿名UID が作られる)
  2. 対象者に **アカウント画面の UID 表示**(account.html に uid 表示を追加するか、コンソールで直接確認)を読み上げてもらう
  3. superadmin.html の grantIdentity UI(3.7で追加)に uid を入力して付与
  4. 対象者が**再ログイン**(または `getIdToken(true)`)すると反映
- 剥奪も同UIから(grant: false)

## 4.6 App Check

- クライアント: 既存の reCAPTCHA v3 実装(auth.js L96-107)を維持
- サーバー: 01_backend.md の `requireAppCheck` で全 callable 強制
- **デバッグトークン**: ローカル開発時は Firebase Console → App Check → デバッグトークンを登録し、`self.FIREBASE_APPCHECK_DEBUG_TOKEN` を設定(既存運用があればそのまま)
- portal.html 等が auth.js を import する構成に寄せる(3.8)ことで App Check 初期化も一元化される

## 4.7 ドキュメント類の更新(コード外)

| ファイル                       | 更新内容                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ |
| docs/firebase_CONTEXT.md       | 認証戦略の章を V4 アーキテクチャ(GIS + Custom Token + 匿名UID)に全面書換 |
| docs/account_CONTEXT.md        | email表示廃止・ニックネーム・deleteMyAccount 化を反映                    |
| docs/portal_CONTEXT.md         | 二段構えゲート(identity + 店舗PW)・GIS化を反映                           |
| docs/penalty_system_CONTEXT.md | banned_users から PII フィールド廃止・ホワイトリストUID化を反映          |

## 4.8 変更履歴(CHANGELOG)・バージョニング運用ルール

- **1タスク 1パッチの原則**: サブエージェントであっても、ファイル編集や実装タスクを1つ行うごとに、直ちに `CHANGELOG.md` に詳細を記録し、パッチバージョン（例: `0.5.114` ➜ `0.5.115` ...）をインクリメントする。
- **Git コミットの自動実行**: パッチのインクリメントと同時にコミットを行う。コミットメッセージには余計な文字列を含めず、**採番したパッチバージョンのみ**（例: `0.5.114`）をそのまま記載する。
- **競合検知・作業停止・階層的エスカレーション手順**:
  - **即時検知と報告**: サブエージェント（または作業者）がパッチ番号の重複やコミットの競合を感知した場合、**勝手に上書きや強行コミットをせず、直ちに親エージェントに報告**する。
  - **作業の一時停止と調停**: 報告を受けた親エージェントは、配下にあるサブエージェントの作業を一旦停止させ、パッチ番号やコミット履歴の競合を修正・整合させてから作業を再開させる。
  - **上位親へのエスカレーション**: 別系統の親エージェントまたはその配下のサブエージェントが先行進行しているなど、自身の権限・スコープ内で解決できないと親エージェントが判断した場合は、**さらに上位の親エージェントへ即座にエスカレーション**して調停・判断を委ねる。
- **マイナーバージョンの更新基準**: 移行・実装作業中は `0.5.x` のパッチインクリメントを継続し、全作業が完了してユーザーが明示的に「完全に使える状態になった」と判断・承認した時点で初めて `0.6.0` に引き上げる（AIによる独断のマイナー更新は厳禁）。

# V4確定版 — 第5章: デプロイ順序・テストマトリクス・スケジュール

## 5.1 実装順序(コード作業)

| #   | 作業                                                                                                               | 依存 |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| 1   | `functions/`: google-auth-library 追加、新関数3本+既存改修(01章)                                                   | —    |
| 2   | `firestore.rules` / `storage.rules` 改訂(02章)                                                                     | —    |
| 3   | `main/auth.js` v1.0.0(GIS化)(03章 3.1)                                                                             | —    |
| 4   | login.html / account.html / app-shell.js / banned.html / admin_sync.html / superadmin.html                         | 3    |
| 5   | portal.html / mobile-order.html / sok.html / sok-to.html / pos / kitchen / monitor / presenter / status / training | 3    |
| 6   | privacy.html / terms.html / mobile-order-guide.html / CONTEXT.md 群                                                | —    |
| 7   | scripts/wipeAuthUsers.js / grantSuperAdmin.js 作成(04章)                                                           | —    |

## 5.2 デプロイ手順(本番切替。V3計画の順序を踏襲+リセット挿入)

```
Step 0. 事前準備
  - UID_PEPPER を Secret Manager に登録+物理バックアップ(04 §4.2)
  - OAuth クライアントにローカルオリジン追加(04 §4.4)
  - App Check デバッグトークン確認

Step 1. Functions デプロイ(旧フロントは旧関数を使い続けるため無害)
  $ firebase deploy --only functions
  ※ authenticateWithGoogle に UID_PEPPER がバインドされたことをログで確認

Step 2. 動作予備確認(ローカル)
  - localhost:5500 で新 auth.js を読むテストページから一連のログインを確認
    (GIS ボタン → callable → signInWithCustomToken → claims 確認)

Step 3. データリセット(04 §4.1)★ここが不可逆点★
  - Auth 全ユーザー削除 / users・banned_users・orders 削除 / updatedBy 掃除
  - Cloud Logging 過去ログ処理

Step 4. Rules デプロイ
  $ firebase deploy --only firestore:rules,storage
  ※ この瞬間から旧 email ベース superadmin は無効(旧フロントの管理画面が使えなくなる)

Step 5. フロントエンド一括公開(GitHub Pages に push)
  ※ Step 4→5 の間は管理系が一時停止するだけで、一般向けは元々未公開のため影響なし

Step 6. super_admin 初期化
  - ynrcs1000@gmail.com でログイン → identity=super_admin が自動付与されることを確認
  - UID を控え、PENALTY_WHITELIST_UIDS に記入 → functions 再デプロイ
  - grantSuperAdmin.js の動作確認(1回実行してみる)

Step 7. 店舗パスワード再設定
  - superadmin から createStoreSecret / batchUpdateStoreSecrets を再実行
    (updatedBy が uid で記録されることを確認)
```

## 5.3 テストマトリクス

### M1: 認証コア

| #   | ケース                                       | 期待結果                                                               |
| --- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | 0014xxxx@gl.pen-kanagawa.ed.jp でログイン    | identity=student。login.html mode=student で step-student-confirm 表示 |
| 2   | 0014以外の同ドメイン(他校生を模擬できる場合) | identity=guest。student フローで step-student-check 表示               |
| 3   | 個人 Gmail でログイン                        | identity=guest。閲覧・お気に入り可                                     |
| 4   | ynrcs1000@gmail.com                          | identity=super_admin                                                   |
| 5   | 同一アカウントで再ログイン(別ブラウザ)       | **同一 UID**(お気に入りが引き継がれる)                                 |
| 6   | Firebase Console → Authentication            | **メール欄が全ユーザー空**であること(最重要確認)                       |
| 7   | users/{uid} ドキュメント                     | email/displayName/photoURL が存在しない                                |
| 8   | nonce 改ざん(devtoolsで別値送信)             | unauthenticated エラー                                                 |
| 9   | App Check なしの直接 curl 呼び出し           | failed-precondition                                                    |
| 10  | ログアウト→再ログイン                        | claims が最初のIDトークンから有効(伝播遅延なし)                        |

### M2: 権限ゲート

| #   | ケース                                                      | 期待結果                                                        |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | guest が mobile-order.html 直開き                           | login.html?mode=student へ                                      |
| 2   | guest が createOrder を直接呼ぶ(claims偽装不能の確認)       | permission-denied                                               |
| 3   | student が portal.html                                      | 第一段通過→店舗PW画面                                           |
| 4   | guest が portal.html                                        | domain-error 表示(文言更新済み)                                 |
| 5   | 店舗PW正解 → pos/kitchen/monitor/presenter                  | role=store_admin で全て入れる。storeId 不一致の sok.html は拒否 |
| 6   | store_admin claims のまま identity 再計算(再ログイン)       | role/storeId が**消えない**(マージ確認)                         |
| 7   | grantIdentity で guest に付与→再ログイン                    | 生徒機能が使える。identity 再計算後も override が残る           |
| 8   | superadmin.html を student が開く                           | 拒否                                                            |
| 9   | firestore.rules: student が他人の users/{uid} 読み          | 拒否                                                            |
| 10  | users への email フィールド書込(コンソールからの誤操作模擬) | rules で拒否                                                    |

### M3: 注文・通知・ペナルティ

| #   | ケース                                          | 期待結果                                                                |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | student がモバイルオーダー完走(通知許可)        | fcmTokens 配列に追加される                                              |
| 2   | iPad+スマホの2台でログイン                      | fcmTokens に2要素。**両方に通知が届く**(FCMバグ修正確認)                |
| 3   | ready_for_pickup 遷移                           | 全端末にプッシュ通知                                                    |
| 4   | 無効トークン混入(アプリ再インストール模擬)      | 送信後に配列から自動除去(ログ確認)                                      |
| 5   | 5分放置(penaltyEnabled=true)                    | abandoned + banned_users 登録(**userEmail/userDisplayName が無い**こと) |
| 6   | BAN 状態でログイン                              | banned.html へ(ニックネーム演出・email 非表示)                          |
| 7   | PENALTY_WHITELIST_UIDS の uid                   | BAN されない                                                            |
| 8   | unbanUser(superadmin)                           | 解除される                                                              |
| 9   | 退会(deleteMyAccount)— 注文なし                 | users 削除+Auth 削除。再ログインで新規扱い(同UIDだが空データ)           |
| 10  | 退会 — 進行中注文あり                           | failed-precondition でブロック+適切なUI表示                             |
| 11  | SOK フロー: sok.html 未ログイン → portal → 復帰 | `?return=` で自動復帰(sok_redirect バグ修正確認)                        |
| 12  | sok-to.html: 通知トークン保存                   | fcmTokens 配列                                                          |

### M4: PII 残留の最終監査(リリース判定)

| #   | 確認対象                 | 方法                                                                   |
| --- | ------------------------ | ---------------------------------------------------------------------- |
| 1   | Firebase Auth            | Console で全ユーザーの識別子欄が空                                     |
| 2   | Firestore 全コレクション | `@` を含む文字列の検索(エクスポート→grep、または目視)                  |
| 3   | Cloud Logging(新規分)    | ログエクスプローラで `@gl.pen-kanagawa` / `@gmail` 検索 → 0件          |
| 4   | フロント配信物           | リポジトリ grep: `user.email` / `displayName` / `photoURL` → 表示系0件 |
| 5   | orders.note              | 手動ステータス変更後に note へメールが入らない                         |

## 5.4 リリース判定基準(Go/No-Go)

- M1-#6(Auth にメールが並ばない)と M4 全項目が **必須(No-Go 条件)**
- M3-#2(複数端末通知)が不合格の場合、通知は片端末のみで Go 可(注文機能自体は影響なし)
- grantSuperAdmin.js の動作確認(Step 6)が未実施なら No-Go(ロックアウトリスク)
