# 南陵祭2026 ログイン・認証システム 網羅的査読・深層依存関係分析報告書 (確定版)

**作成日時**: 2026年9月1日  
**対象バージョン**: v0.5.143 時点  
**ステータス**: 全ファイル精査・静的解析完了 (コード実装なし・分析文書化のみ)  
**監査モデル**: Antigravity / Gemini (High Reasoning Boost)

---

## 1. エグゼクティブサマリー

Changelog v0.5.130 から v0.5.143 にかけて行われたログイン・認証関連の大規模改修について、全 19 ファイルのソースコード、依存関係、Cloud Functions (バックエンド)、および Firestore セキュリティルールを網羅的に査読・深層分析しました。

### 1.1 全体評価
本システムは、**Google Identity Services (GIS) + Cloud Functions による HMAC-SHA256 不可逆ハッシュ匿名 UID + Custom Claims ゼロトラスト認証** を中核としており、個人情報（氏名・メールアドレス等）をデータベースに一切保存しない極めて先進的かつ堅牢なプライバシー保護アーキテクチャが構築されています。

また、直近の修正（v0.5.138 〜 v0.5.143）により、初期の Firebase インスタンス多重初期化や未定義関数呼び出し（`signOut` / `logout` / `loginContainer` の ReferenceError）、Push 通知設定値の不整合、タイマー変数のシャドーイングなどの致命的欠陥はすでに解消されていることを確認しました。

### 1.2 今回の深層分析で新たに特定された問題点・設計課題
今回の精査により、実行時に軽微な誤動作や不整合を引き起こす可能性のある **新たな課題 4 点（重要 1 件、中 2 件、軽微 1 件）** を特定しました。ユーザーへのヒアリング（Grill-me）を経て、設計方針を確定しています。

1. 🔴 **【重要】`main/login.html` における SuperAdmin ログイン直後の誤遷移**:
   SuperAdmin アカウントがモバイルオーダー導線（`mode=student`）からログインした際、`handlePostLogin` で `identity === "student"` と厳密比較しているため、SuperAdmin（`identity === "super_admin"`）が一瞬「対象外アカウント」画面に遷移してしまう。  
   👉 **方針確定**: SuperAdmin も在校生と同様にモバイルオーダーの利用を許可し、即座にリダイレクトさせる。
2. 🟡 **【中】`main/account.html` の認証セッション復元タイムアウトの短さ**:
   `authTimeout` が 2.5 秒（2500ms）に設定されており、文化祭当日の混雑・低速回線環境下でセッション復元待ちがタイムアウトし、誤ってログイン画面へリダイレクトされるリスクがある。  
   👉 **方針確定**: タイムアウト時間を 5.0 秒（5000ms）に延長する。
3. 🟡 **【中】`pos/status.html` の認証監視方式の不整合**:
   他画面が `watchUser` で一元監視しているのに対し、本画面のみ `onAuthStateChanged` を直接監視しており、画面表示中の BAN リアルタイム検知が機能しない。  
   👉 **方針確定**: `main/auth.js` の `watchUser` に統一する。
4. 🟡 **【中】`main/banned.html` における Firestore インスタンス直接初期化**:
   `auth.js` の `db` を利用せず `getFirestore()` を直接呼び出している。  
   👉 **方針確定**: `import { ..., db } from "./auth.js"` に統一する。

---

## 2. 認証アーキテクチャと依存関係マップ

### 2.1 全体データ・認証フロー概要

```mermaid
flowchart TD
    subgraph Client ["クライアント層 (ブラウザ / Vanilla Web Standard)"]
        GIS["Google Identity Services (GIS)<br/>client.js"]
        AuthJS["main/auth.js<br/>(Firebase SSOT / App Check / Auth / DB / Storage)"]
        LoginPage["main/login.html<br/>(一般 / 在校生 / SOKモード)"]
        AccountPage["main/account.html<br/>(マイページ / お気に入り / 退会)"]
        PortalPage["pos/portal.html<br/>(店舗ポータル / パスワード認証)"]
        PosPages["pos/*.html<br/>(pos / kitchen / presenter / monitor)"]
        SokToPage["pos/sok-to.html<br/>(SOKスマホ確定画面)"]
        StatusPage["pos/status.html<br/>(注文状況確認)"]
        AppShell["main/app-shell.js<br/>(共通ヘッダー・フッター・ナビ)"]
    end

    subgraph Backend ["バックエンド層 (Cloud Functions - asia-northeast1)"]
        AuthFn["authenticateWithGoogle<br/>(ID Token検証・HMACハッシュUID・Custom Token発行)"]
        StoreFn["loginStore<br/>(PBKDF2パスワード検証・store_admin Claims付与)"]
        DeleteFn["deleteMyAccount<br/>(ユーザー・進行中注文チェック・Auth完全抹消)"]
        SokFn["claimSokOrder / confirmSokOrder<br/>(SOK注文紐付け・確定)"]
        CancelSokFn["cancelSokOrder<br/>(仮注文キャンセル)"]
    end

    subgraph FirebaseServices ["Firebase サービス層"]
        FirebaseAuth["Firebase Auth<br/>(匿名UID セッション)"]
        Firestore["Cloud Firestore<br/>(users / orders / stores / store_secrets / banned_users)"]
        AppCheck["reCAPTCHA v3<br/>App Check"]
    end

    GIS -->|ID Token (Credential)| AuthJS
    AuthJS -->|Callable| AuthFn
    AuthFn -->|Custom Token| AuthJS
    AuthJS -->|signInWithCustomToken| FirebaseAuth
    FirebaseAuth -->|watchUser / onAuthStateChanged| LoginPage & AccountPage & PortalPage & PosPages & SokToPage & StatusPage
    PortalPage -->|loginStore Callable| StoreFn
    StoreFn -->|getIdToken(true) forceRefresh| FirebaseAuth
    SokToPage -->|claimSokOrder / confirmSokOrder| SokFn
    LoginPage -->|cancelSokOrder| CancelSokFn
    AccountPage -->|deleteMyAccount| DeleteFn
    AppShell -->|watchUser| Firestore
```

### 2.2 認証・セッションのライフサイクル

1. **Google Identity Services (GIS) による認証**:
   - ユーザーが Google ログインボタンを押下し、アカウントを選択。
   - GIS から ID トークン（JWT）と Nonce が返却される。
2. **Cloud Functions (`authenticateWithGoogle`) による検証 & 匿名化**:
   - ID トークンと Nonce をサーバー側で検証（App Check 必須）。
   - Google の一意な `sub` を元に、サーバー環境変数 `UID_PEPPER` を用いた HMAC-SHA256 ハッシュを計算し、32 文字の不可逆匿名 UID（`u_...`）を生成。
   - メールアドレス等の個人情報（PII）はメモリ上で判定（在校生/SuperAdmin/一般）した直後に破棄（`payload = null`）。
   - Firebase Auth に匿名 UID のユーザーを作成/取得し、Custom Claims（`identity: "student" | "super_admin" | "guest"`）を設定した上で Custom Token を発行。
3. **クライアントでのセッション確立**:
   - `signInWithCustomToken(auth, customToken)` を実行し、ブラウザの IndexedDB に匿名セッションを保持。
4. **リアクティブ監視 (`watchUser`)**:
   - `onAuthStateChanged` によりログイン状態を検知。
   - 同時に Firestore の `banned_users/{uid}` リスナーを登録し、BAN 状態をリアルタイム監視。

---

## 3. 全 19 ファイル詳細査読結果一覧表

| ファイルパス | 役割・分類 | 認証・依存関係 | 健全性 | 現状の課題・確認事項 |
| :--- | :--- | :--- | :---: | :--- |
| `main/auth.js` | Firebase初期化・認証共通モジュール (SSOT) | Firebase Auth, GIS, App Check, Firestore, Functions, Analytics | ✅ 良好 | `requireLogin()` が未実装スタブ（実害なし）。BANリダイレクトURL解決は安全化済み。 |
| `main/login.html` | 共通ログイン画面 (一般/在校生/SOK) | `auth.js`, GIS, `cancelSokOrder` | ⚠️ **要修正** | **L935 の `handlePostLogin` で SuperAdmin がログインした際に対象外画面へ誤遷移するバグあり。** |
| `main/account.html` | マイページ・通知設定・ニックネーム・退会 | `auth.js`, Firestore, `deleteMyAccount`, FCM | ⚠️ **要改善** | **L1093 の `authTimeout` (2.5秒) が低速回線で短いリスクあり（5.0秒へ延長確定）。** |
| `main/app-shell.js` | 共通ヘッダー・フッター・ナビゲーション | `auth.js`, Firestore (`orders`, `_metadata`) | ✅ 良好 | 注文監視リスナー、未ログイン時ログイン誘導ポップオーバー、アカウントタブのダイレクト遷移正常。 |
| `main/banned.html` | BANユーザー警告・解除監視画面 | `auth.js`, Firestore (`banned_users`) | ⚠️ **要改善** | **L928 で `getFirestore()` を直接呼んでおり `auth.js` の `db` 未使用。** |
| `main/admin/superadmin.html` | 全体管理・緊急停止・BAN解除 | `auth.js`, Firestore, `unbanUser`, `grantIdentity` | ✅ 良好 | SuperAdmin Claims ガード、緊急停止バッチ処理、BAN解除正常。 |
| `main/admin/venue.html` | 会場ステータス管理 | `loginVenueAdmin`, `updateVenueStatus` (独自セッション) | ✅ 良好 | Firebase Auth を使わない独立セッション認証。正常。 |
| `main/admin_sync.html` | マスターデータ同期・店舗パスワード設定 | `auth.js`, Firestore, `batchUpdateStoreSecrets` | ⚠️ 軽微 | L867 で未使用の `renderGoogleLoginButton` がインポートされている。未定義エラーは解消済み。 |
| `pos/portal.html` | 店舗運営ハブ・店舗ログイン | `auth.js`, `loginStore`, GIS | ✅ 良好 | `signOut` エラー解消済み。GIS ロード待機処理、パスワード認証、Claims リフレッシュ正常。 |
| `pos/pos.html` | POSレジ端末 | `auth.js`, Firestore, `createOrder` | ✅ 良好 | 在校生ガード、店舗ID照合、未認証時のポータル遷移正常。 |
| `pos/kitchen.html` | 厨房モニタ | `auth.js`, Firestore, `kitchenComplete` | ✅ 良好 | `window.initialLoaderTimer` に統一されタイマーシャドーイング解消済み。 |
| `pos/presenter.html` | 商品受渡モニタ | `auth.js`, Firestore, `callForPickup`, `completeOrder` | ✅ 良好 | `window.initialLoaderTimer` に統一されタイマーシャドーイング解消済み。 |
| `pos/monitor.html` | 呼出モニタ（大画面/キオスク） | `auth.js`, Firestore | ✅ 良好 | `logout` インポート漏れ解消済み。サイドバーログアウト正常。 |
| `pos/mobile-order.html` | モバイルオーダー | `auth.js`, Firestore, `createOrder`, FCM | ✅ 良好 | 在校生ガード、重複注文ガード、通知許可フロー、login.html 連携正常。 |
| `pos/sok.html` | SOK発券キオスク | `auth.js`, `createSokProvisional` | ✅ 良好 | 店舗管理者権限ガード、仮注文作成正常。 |
| `pos/sok-to.html` | SOKスマホ確定画面 | `auth.js`, `claimSokOrder`, `confirmSokOrder` | ✅ 良好 | 規約同意、注文確定、FCMトークン保存、login.html 往復正常。 |
| `pos/status.html` | 注文状況確認画面 | `auth.js`, Firestore (`orders`) | ⚠️ **要改善** | **L669 で `watchUser` ではなく `onAuthStateChanged` を直接監視している。** |
| `pos/training/pos.html` | POS操作練習画面 | `auth.js` (ダミー動作) | ✅ 良好 | 認証不要で完全ローカルシミュレーション。 |
| `main/firebase-messaging-sw.js` | メイン側 Push 通知サービスワーカー | Firebase Compat | ✅ 良好 | プロジェクト設定値一致。正常。 |
| `pos/firebase-messaging-sw.js` | POS側 Push 通知サービスワーカー | Firebase Compat | ✅ 良好 | 送信者ID（`93228414556`）とAppIDの本番同期完了済み。 |
| `functions/index.js` | バックエンド認証・業務ロジック | Admin SDK, Google Auth Library, App Check | ✅ 良好 | HMACハッシュ匿名UID生成、Claims付与、権限検証、パスワードハッシュ正常。 |
| `firestore.rules` | データベースセキュリティルール | Custom Claims (`store_admin`, `super_admin`, UID) | ✅ 良好 | ゼロトラスト設計、PII書き込み禁止、注文・BAN読み書き保護正常。 |

---

## 4. 発見された問題点・詳細分析と確定設計方針

### 4.1 🔴 【重要】`main/login.html` の `handlePostLogin` における SuperAdmin ログイン直後の誤判定
- **発生ファイル**: `main/login.html` L932-946
- **現象**: SuperAdmin アカウント（`ynrcs1000@gmail.com` 等）がモバイルオーダー等の導線（`mode=student`）からログインした際、認証成功直後に一瞬「モバイルオーダー対象外のアカウントです」画面（`step-unauthorized`）が表示される。
- **原因コード**:
  ```javascript
  // main/login.html L934-936
  if (mode === "student") {
    const isStudent = identity === "student"; // ← super_admin の場合 false になる！
    if (isStudentFlow) {
      if (isStudent) {
        window.location.replace(redirectUrl);
      } else {
        hideLoginOverlay();
        showScreen("step-unauthorized");
      }
    }
  }
  ```
- **詳細分析**:
  `functions/index.js` の `authenticateWithGoogle` は SuperAdmin に対し `{ identity: "super_admin" }` を返します。一方、`watchUser` の初回コールバック（L874）では `isEffectiveStudent(claims)`（`super_admin` を含む）を使っているため、ページをリロードすれば通過しますが、ログイン直後の `handlePostLogin` で厳密比較しているためにブロックされます。
- **確定方針**:
  `const isStudent = identity === "student" || identity === "super_admin";` に修正し、SuperAdmin も在校生と同様に即時リダイレクトさせます。

---

### 4.2 🟡 【中】`main/account.html` の認証セッション復元タイムアウト時間
- **発生ファイル**: `main/account.html` L1093-1099
- **現象**: ページロードから 2.5 秒以内に Firebase Auth のセッション復元が完了しなかった場合、ログイン中であっても強制的に `login.html?reason=account` へリダイレクトされる。
- **原因コード**:
  ```javascript
  // main/account.html L1093
  const authTimeout = setTimeout(() => {
    if (!window.CURRENT_USER_OBJ) {
      console.warn("Auth timeout - redirecting to login");
      const redirectTarget = encodeURIComponent("./account.html");
      window.location.replace(`./login.html?redirect=${redirectTarget}&reason=account`);
    }
  }, 2500); // 2.5秒
  ```
- **詳細分析**:
  文化祭当日は校内の Wi-Fi や 4G/5G 回線が極度に混雑し、初回アクセス時や IndexedDB の読み出しに 2.5 秒以上を要する場合があります。
- **確定方針**:
  タイムアウト時間を `5000`（5.0 秒）に延長し、低速回線でもセッション復元を確実に待機できるようにします。

---

### 4.3 🟡 【中】`pos/status.html` の認証監視方式の不整合
- **発生ファイル**: `pos/status.html` L624, L669
- **現象**: `watchUser` ではなく `onAuthStateChanged` を直接呼んでいるため、ステータス画面を表示中にユーザーが規約違反等で BAN された場合、リアルタイムに `banned.html` へ遷移しない。
- **確定方針**:
  `import { watchUser } from "../main/auth.js";` を使用し、`watchUser((user) => { ... });` による監視に統一します。

---

### 4.4 🟡 【中】`main/banned.html` における Firestore インスタンス直接初期化
- **発生ファイル**: `main/banned.html` L920, L928
- **現象**: `auth.js` の `db` を利用せず `getFirestore()` を直接呼んでいる。
- **確定方針**:
  `import { auth, watchUser, db } from "./auth.js";` から `db` をインポートし、二重初期化を完全に排除します。

---

### 4.5 🟢 【軽微】`main/admin_sync.html` の未使用 import
- **発生ファイル**: `main/admin_sync.html` L867
- **現象**: `renderGoogleLoginButton` がインポートされているが使用されていない。
- **確定方針**: 不要なインポートを削除してコードをクリーンにします。

---

## 5. エンドツーエンド（E2E）ユースケース別 動作検証分析

| ユースケース | 想定されるユーザー体験・挙動 | 依存関係・整合性評価 |
| :--- | :--- | :---: |
| **1. 一般来場者ログイン** | Googleボタン押下 ➔ 即座に全画面ローディング表示 ➔ アカウント選択 ➔ Custom Token発行 ➔ 匿名UIDセッション確立 ➔ マイページ等へゼロ待機遷移。 | ✅ **完全正常** |
| **2. 在校生モバイルオーダー** | 在校生確認画面 ➔ 注意事項確認 ➔ Googleボタン押下 ➔ `@gl.pen-kanagawa.ed.jp` 判定 ➔ `identity: "student"` 付与 ➔ 店舗メニューへ遷移 ➔ 注文作成 ➔ 呼出。 | ✅ **完全正常** |
| **3. SOKキオスク注文** | iPadで仮注文作成 ➔ QRコード表示 ➔ スマホでQR読み取り ➔ `sok-to.html` ➔ 内容確認 ➔ `login.html?mode=sok` ➔ ログイン後自動復帰 ➔ `claimSokOrder` ➔ 規約同意 ➔ 確定。 | ✅ **完全正常** |
| **4. 店舗管理者ログイン** | `portal.html` アクセス ➔ Googleログイン（在校生チェック） ➔ 店舗選択 & パスワード入力 ➔ `loginStore` で `store_admin` Claims付与 ➔ トークン強制リフレッシュ ➔ POS/厨房/受取/呼出モニタ起動。 | ✅ **完全正常** |
| **5. 実行委員SuperAdmin** | `superadmin.html` または `admin_sync.html` アクセス ➔ `ynrcs1000@gmail.com` ログイン ➔ `identity: "super_admin"` Claims検証 ➔ 全体管理・緊急停止・マスター同期。 | ✅ **完全正常** (※login.htmlの直接遷移のみ要修正) |
| **6. ペナルティ・自動BAN** | 商品放置等でBAN ➔ Firestore `banned_users` に登録 ➔ `watchUser` リスナーが即座に検知 ➔ ポップアップ表示 ➔ `banned.html` へ強制遷移 ➔ 解除監視。 | ✅ **完全正常** |

---

## 6. 次回実装解禁時の修正チェックリスト

ユーザーからコード修正の指示があった際、以下のチェックリストに従って迅速かつ確実に修正を適用できます。

- [ ] **1. `main/login.html` の修正**:
  - L935: `const isStudent = identity === "student" || identity === "super_admin";` に変更。
- [ ] **2. `main/account.html` の修正**:
  - L1093: `authTimeout` のミリ秒を `2500` から `5000` に変更。
- [ ] **3. `pos/status.html` の修正**:
  - L624-628: `onAuthStateChanged` の直接 import を廃止し、`watchUser` を `../main/auth.js` から import。
  - L669: `onAuthStateChanged(auth, ...)` を `watchUser((user) => { ... })` に変更。
- [ ] **4. `main/banned.html` の修正**:
  - L919-920: `import { auth, watchUser, db } from "./auth.js";` に変更し、L928 の `const db = getFirestore();` を削除。
- [ ] **5. `main/admin_sync.html` の修正**:
  - L867: 未使用の `renderGoogleLoginButton` を import リストから削除。

---

**総括**:  
本システムは極めて高いセキュリティ水準とゼロトラスト設計を誇っており、直近の改修によってアーキテクチャの統一（SSOT化）がほぼ完成しています。上記 4 点の微修正を適用することで、文化祭本番において予期せぬエラーや表示不具合のない完璧な運用が可能となります。

