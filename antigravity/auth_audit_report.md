# 南陵祭2026 ログイン・認証システム 網羅的査読・依存関係分析報告書

**作成日時**: 2026年9月1日  
**対象バージョン**: v0.5.137 時点  
**ステータス**: 調査・監査完了 (コード実装なし)  

---

## 1. エグゼクティブサマリー

直近のコミット（v0.5.128 〜 v0.5.137）において、Firebase インスタンスの重複初期化の撤廃（`main/auth.js` への一本化・Single Source of Truth 化）、Google Identity Services (GIS) の連携改善、マイページ（`account.html`）やセルフオーダーキオスク（`sok-to.html`）の認証導線強化など、アーキテクチャの統一に向けた大幅な改修が行われました。

全体の設計思想（Google GIS + Cloud Functions による HMAC-SHA256 不可逆ハッシュ匿名 UID + Custom Claims ゼロトラスト認証）は極めて高度かつ堅牢に設計されています。

しかし、**直近のリファクタリングに伴う import 漏れや古いコードの残骸により、実行時にクラッシュする致命的なバグ（ReferenceError）が 3 箇所、Push通知が正常動作しなくなる設定不整合が 1 箇所、タイマー変数のシャドーイングによる画面表示不具合が 2 箇所** 発見されました。

これらはコードを修正すれば即座に解決可能ですが、現行のまま本番稼働させた場合は店舗運営や管理者操作に直接的な支障をきたします。本報告書では、全 19 ファイルの査読結果、依存関係の完全なマッピング、および問題点とその修正方針を網羅的に報告します。

---

## 2. 認証アーキテクチャと依存関係マップ

### 2.1 全体データ・認証フロー概要

```mermaid
flowchart TD
    subgraph Client ["クライアント層 (ブラウザ)"]
        GIS["Google Identity Services (GIS)<br/>client.js"]
        AuthJS["main/auth.js<br/>(Firebase SSOT)"]
        LoginPage["main/login.html"]
        PortalPage["pos/portal.html"]
        PosPages["pos/*.html<br/>(pos/kitchen/presenter/monitor)"]
        AppShell["main/app-shell.js"]
        MainPages["main/*.html<br/>(account/detail/projects/stage)"]
    end

    subgraph Backend ["バックエンド層 (Cloud Functions - asia-northeast1)"]
        AuthFn["authenticateWithGoogle<br/>(ID Token検証・HMAC-SHA256ハッシュ・Custom Token発行)"]
        StoreFn["loginStore<br/>(店舗パスワード検証・store_admin Claims付与)"]
        DeleteFn["deleteMyAccount<br/>(ユーザー・注文・Auth完全抹消)"]
        SokFn["claimSokOrder / confirmSokOrder"]
    end

    subgraph FirebaseServices ["Firebase サービス層"]
        FirebaseAuth["Firebase Auth<br/>(匿名UID セッション)"]
        Firestore["Cloud Firestore<br/>(users / orders / stores / banned_users)"]
        AppCheck["reCAPTCHA v3<br/>App Check"]
    end

    GIS -->|ID Token (Credential)| AuthJS
    AuthJS -->|Callable| AuthFn
    AuthFn -->|Custom Token| AuthJS
    AuthJS -->|signInWithCustomToken| FirebaseAuth
    FirebaseAuth -->|watchUser / onAuthStateChanged| LoginPage & PortalPage & MainPages & PosPages
    PortalPage -->|loginStore Callable| StoreFn
    StoreFn -->|getIdTokenResult force=true| FirebaseAuth
    AppShell -->|watchUser| Firestore
```

---

## 3. 全ファイル詳細査読結果

| ファイルパス | 役割・分類 | 認証依存関係 | 健全性 | 備考・問題点 |
| :--- | :--- | :--- | :---: | :--- |
| `main/auth.js` | Firebase初期化・認証共通モジュール (SSOT) | Firebase Auth, GIS, App Check, Firestore, Functions | ⚠️ 要微修正 | `requireLogin()` が未実装スタブ。BANリダイレクトのパスが絶対パス `/main/banned.html` に固定。 |
| `main/login.html` | 共通ログイン画面 (一般/在校生/SOK) | `auth.js`, GIS, `cancelSokOrder` | ✅ 良好 | 在校生フロー、ゲスト案内、SOKモード、アカウント切替等の状態遷移が適切に実装。 |
| `main/account.html` | マイページ・通知設定・退会 | `auth.js`, Firestore, `deleteMyAccount` | ⚠️ 注意 | `authTimeout` (2.5秒) が低速回線で短いリスク。その他は良好。 |
| `main/app-shell.js` | 共通ヘッダー・フッター・ナビゲーション | `auth.js`, Firestore | ✅ 良好 | 注文監視リスナー、未ログイン時ログイン誘導ポップオーバー、アカウントタブのダイレクト遷移正常。 |
| `main/banned.html` | BANユーザー警告・解除監視画面 | `auth.js`, Firestore (`banned_users`) | ⚠️ 要微修正 | `getFirestore()` を直接呼んでおり `auth.js` の `db` 未使用。 |
| `main/admin/superadmin.html` | 全体管理・緊急停止・BAN解除 | `auth.js`, Firestore, `unbanUser`, `grantIdentity` | ✅ 良好 | SuperAdmin Claims ガード、緊急停止バッチ処理、BAN解除正常。 |
| `main/admin/venue.html` | 会場ステータス管理 | `loginVenueAdmin`, `updateVenueStatus` (独自セッション) | ✅ 良好 | Firebase Auth を使わない独立セッション認証。正常。 |
| `main/admin_sync.html` | マスターデータ同期・店舗パスワード設定 | `auth.js`, Firestore, `batchUpdateStoreSecrets` | ❌ **重大バグ** | **L1129 で未定義変数 `loginContainer` を参照しクラッシュする。** |
| `pos/portal.html` | 店舗運営ハブ・店舗ログイン | `auth.js`, `loginStore`, GIS | ❌ **重大バグ** | **L3642 で `signOut(auth)` を呼び未定義エラー。GIS ロード待ち抜けリスクあり。** |
| `pos/pos.html` | POSレジ端末 | `auth.js`, Firestore, `createOrder` | ✅ 良好 | 在校生ガード、店舗ID照合、未認証時のポータル遷移正常。 |
| `pos/kitchen.html` | 厨房モニタ | `auth.js`, Firestore, `kitchenComplete` | ⚠️ 要修正 | **L638/L807 で `initialLoaderTimer` がシャドーイングされフォールバック解除不能。** |
| `pos/presenter.html` | 商品受渡モニタ | `auth.js`, Firestore, `callForPickup`, `completeOrder` | ⚠️ 要修正 | **L594/L719 で `initialLoaderTimer` がシャドーイングされフォールバック解除不能。** |
| `pos/monitor.html` | 呼出モニタ（大画面/キオスク） | `auth.js`, Firestore | ❌ **重大バグ** | **L713 で未 import の `logout()` を呼び未定義エラー。** |
| `pos/mobile-order.html` | モバイルオーダー | `auth.js`, Firestore, `createOrder`, FCM | ✅ 良好 | 在校生ガード、重複注文ガード、通知許可フロー正常。 |
| `pos/sok.html` | SOK発券キオスク | `auth.js`, `createSokProvisional` | ✅ 良好 | 店舗管理者権限ガード、仮注文作成正常。 |
| `pos/sok-to.html` | SOKスマホ確定画面 | `auth.js`, `claimSokOrder`, `confirmSokOrder` | ✅ 良好 | 規約同意、注文確定、FCMトークン保存正常。 |
| `pos/status.html` | 注文状況確認画面 | `auth.js`, Firestore (`orders`) | ⚠️ 軽微 | `watchUser` ではなく `onAuthStateChanged` を直接監視。 |
| `pos/training/pos.html` | POS操作練習画面 | `auth.js` (ダミー動作) | ✅ 良好 | 認証不要で完全ローカルシミュレーション。 |
| `main/firebase-messaging-sw.js` | メイン側 Push 通知サービスワーカー | Firebase Compat | ✅ 良好 | プロジェクト設定値一致。正常。 |
| `pos/firebase-messaging-sw.js` | POS側 Push 通知サービスワーカー | Firebase Compat | ❌ **重大バグ** | **プロジェクトID/送信者IDが古いダミー値（360316480856）のまま。** |
| `functions/index.js` | バックエンド認証・業務ロジック | Admin SDK, Google Auth Library, App Check | ✅ 良好 | HMAC-SHA256ハッシュ匿名UID生成、Claims付与、権限検証正常。 |
| `firestore.rules` | データベースセキュリティルール | Custom Claims (`store_admin`, `super_admin`, UID) | ✅ 良好 | ゼロトラスト設計、PII書き込み禁止、注文・BAN読み書き保護正常。 |

---

## 4. 発見された問題点・不具合・リスク一覧

### 🔴 【重大度：高】実行時エラー・クラッシュ・機能停止

#### 1. `pos/portal.html` のログアウト処理で `signOut is not defined` エラー
- **発生ファイル**: `pos/portal.html` L3640-3646
- **現象**: ログアウトボタンを押した際、`signOut(auth)` を実行しようとするが `signOut` が未定義のため `ReferenceError` でクラッシュする。
- **原因**: L3332 で `import { ..., logout } from "../main/auth.js"` しているにもかかわらず、独自で `signOut(auth)` を呼び出している。
- **修正方針**: `signOut(auth)` を `await logout()` に置き換える。

#### 2. `pos/monitor.html` のログアウト処理で `logout is not defined` エラー
- **発生ファイル**: `pos/monitor.html` L711-717
- **現象**: サイドバーの「ログアウト」ボタンを押した際、`ReferenceError: logout is not defined` が発生してログアウトできない。
- **原因**: L631 の `import { ... } from "../main/auth.js"` に `logout` が含まれていない。
- **修正方針**: `main/auth.js` からの import リストに `logout` を追加する。

#### 3. `main/admin_sync.html` の認証完了処理で `loginContainer is not defined` エラー
- **発生ファイル**: `main/admin_sync.html` L1129
- **現象**: SuperAdmin でログインした直後、`updateAuthUI` 内で `loginContainer` にアクセスしようとして `ReferenceError` が発生し、後続のUI描画が中断される。
- **原因**: 過去のログインコンテナ要素への参照行 `if (loginContainer) loginContainer.style.display = "none";` が残骸として残っている。
- **修正方針**: 該当の 1 行（L1129）を削除する。

#### 4. `pos/firebase-messaging-sw.js` の設定値不一致によるプッシュ通知失敗
- **発生ファイル**: `pos/firebase-messaging-sw.js` L20-21
- **現象**: モバイルオーダー（`pos/mobile-order.html`）や SOK（`pos/sok-to.html`）からプッシュ通知を有効化しようとした際、トークン取得やバックグラウンド受信に失敗する。
- **原因**: `messagingSenderId: "360316480856"` および `appId: "1:360316480856:web:1234567890abcdef"` という過去のダミー値が残存している。
- **修正方針**: `main/firebase-messaging-sw.js` と同一の本番値（`messagingSenderId: "93228414556"`, `appId: "1:93228414556:web:f64f90c13849fae9049899"`）に修正する。

#### 5. `pos/portal.html` における GIS スクリプト未完了時のボタン非表示リスク
- **発生ファイル**: `pos/portal.html` L3560-3568
- **現象**: 初回アクセス時やキャッシュなし環境で、Google ログインボタンが表示されず空の枠になる場合がある。
- **原因**: `<script src="https://accounts.google.com/gsi/client" async defer>` のロード完了前に `watchUser` コールバックが走り `renderGoogleLoginButton` が即時失敗する。`main/login.html` のような `window.addEventListener("load", ...)` 待機処理がない。
- **修正方針**: `google.accounts` が未ロードの場合は `window.addEventListener("load", ...)` でリトライする待機処理を追加する。

---

### 🟡 【重大度：中】予期せぬ表示不具合・タイマー暴走・仕様不整合

#### 6. `pos/kitchen.html` および `pos/presenter.html` のタイマー変数シャドーイング
- **発生ファイル**: 
  - `pos/kitchen.html` L638, L807, L819
  - `pos/presenter.html` L594, L719, L731
- **現象**: 画面が正常に読み込まれた後でも、8 秒後に突然「読み込みに時間がかかっています... (再読み込み)」というフォールバックメッセージが表示される。
- **原因**: インラインスクリプトで `let initialLoaderTimer = setTimeout(...)` を定義しているが、続く `<script type="module">` 内で `let initialLoaderTimer = null;` を再宣言しているため、モジュール内の `clearTimeout(initialLoaderTimer)` が外側のタイマーを解除できない。
- **修正方針**: `<script type="module">` 内での `let initialLoaderTimer = null;` の再宣言を削除し、グローバルの `window.initialLoaderTimer` を参照・クリアするように変更する。

#### 7. `main/auth.js` の `requireLogin()` スタブ
- **発生ファイル**: `main/auth.js` L399-415
- **現象**: 関数を呼び出しても `login.html` へのリダイレクトが行われず、警告ログを出力して `null` を返すだけになっている。
- **修正方針**: 現在 `app-shell.js` や各画面が直接 `AppShell.showLoginPrompt()` または `location.href = "login.html?redirect=..."` を呼んでいるため実害はないが、`requireLogin()` 内でも `window.location.href = ...` による正規のリダイレクト処理を実装するか、不要であれば非推奨コメントを明記する。

#### 8. `pos/monitor.html` および `pos/pos.html` のデッドコード（`domain-error-overlay`）
- **発生ファイル**: `pos/monitor.html` L549-562 / `pos/pos.html` L660-673
- **現象**: ドメインエラー用オーバーレイの HTML が存在するが、スクリプト側では即座に `portal.html` へリダイレクトするため一切表示されず、ボタンのイベントリスナーもバインドされていない。
- **修正方針**: 将来の保守性向上のため、不要なオーバーレイ HTML を整理するか、リダイレクト前に表示する仕様に統一する。

---

### 🟢 【重大度：低】エッジケース・堅牢性向上

#### 9. `main/auth.js` の BAN リダイレクトにおける絶対パス指定
- **発生ファイル**: `main/auth.js` L340, L362
- **現象**: `window.location.replace("/main/banned.html");` とルート直下 `/` から指定されているため、サブディレクトリ配下（GitHub Pages 等）で実行された場合に 404 となる可能性がある。
- **修正方針**: 現在のパス解決ロジックに合わせた相対パス（`./banned.html` や `resolvePath`）に変更する。

#### 10. `main/account.html` の `authTimeout` (2500ms)
- **発生ファイル**: `main/account.html` L1093
- **現象**: 弱電界環境で IndexedDB からの Firebase Auth セッション復元に 2.5 秒以上かかった場合、誤ってログイン画面へリダイレクトされる可能性がある。
- **修正方針**: タイムアウト時間を 4000ms 程度に緩和するか、セッション復元待ちローダーを維持する。

#### 11. `pos/status.html` の `onAuthStateChanged` 直接監視
- **発生ファイル**: `pos/status.html` L669
- **現象**: `main/auth.js` の `watchUser` ではなく `onAuthStateChanged` を直接呼んでいるため、BAN リスナーが登録されない。
- **修正方針**: `watchUser` による監視に統一する。

---

## 5. 次回実装時の修正チェックリスト

コード実装が解禁された際、以下の順序で修正を適用することを推奨します：

- [ ] **1. `pos/portal.html` の修正**:
  - `signOut(auth)` を `await logout()` に修正。
  - `renderGoogleLoginButton` 呼び出し部に GIS ロード完了待機（`load` リスナー / ポーリング）を追加。
- [ ] **2. `pos/monitor.html` の修正**:
  - `import { ..., logout } from "../main/auth.js"` を追加。
- [ ] **3. `main/admin_sync.html` の修正**:
  - L1129 の `if (loginContainer) loginContainer.style.display = "none";` を削除。
- [ ] **4. `pos/firebase-messaging-sw.js` の修正**:
  - `messagingSenderId: "93228414556"`, `appId: "1:93228414556:web:f64f90c13849fae9049899"` に更新。
- [ ] **5. `pos/kitchen.html` & `pos/presenter.html` の修正**:
  - モジュール内の `let initialLoaderTimer = null;` を削除し、`clearTimeout(window.initialLoaderTimer)` に統一。
- [ ] **6. `main/auth.js` の修正**:
  - BAN リダイレクト先を相対パスまたは環境依存しない解決パスに修正。
- [ ] **7. `main/banned.html` & `pos/status.html` の統一**:
  - `auth.js` の `db` および `watchUser` を使用する形にリファクタリング。

---
<!-- GOAL_COMPLETE -->
