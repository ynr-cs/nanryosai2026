---
title: Firebase アーキテクチャ コンテキスト
tags: [infra, context]
status: active
last_updated: 2026-05-07
---

# Firebase アーキテクチャ コンテキスト

> **Note**: システム全体の構成図は [[architecture_CONTEXT]] を参照してください。

## 1. プロジェクト情報

- **Project ID**: `nanryosai-2026-a4091`
- **Region**: `asia-northeast1` (Tokyo)

## 2. セキュリティ (App Check)

- **全体実装済み**: 不正なアクセスをブロックするため全域で有効化。
- **Single Source of Truth**: `main/auth.js` が全 Firebase サービス（App, Auth, Firestore, Storage, Functions, Messaging, App Check）の初期化を一元管理（v0.3.0〜）。
- **プロバイダー**:
  - `main/auth.js`（共通モジュール）: **ReCaptcha v3** (Key: `6LeHxzIsAAAAAOIf0lXePHNpUkvYRdFtQw9osmIS`)
  - `mobile-order.html`: 独自初期化で **ReCaptcha Enterprise** (Key: `6LdVI4sqAAAAABsFgjK80A2MAiCg7X9K7uJ-gYQ6`) を使用（将来的に auth.js に統合予定）
  - 管理・モニター画面: **ReCaptcha v3**
- **App Check トークンウォームアップ**: ページロード時に `getAppCheckToken(appCheck, false)` を fire-and-forget で呼び、トークンをキャッシュしておく。これにより `signInWithPopup` 時にトークン取得の非同期待ちが発生せず、ポップアップブロックを回避できる。
- **デバッグ**: ローカル開発用トークンはソースコードにハードコーディングせず、プロジェクトルートの `config.local.js` に `window.LOCAL_ENV` として定義し、ブラウザから読み込む構成を採用（2026-04-28）。`auth.js` 内で localhost 判定し `self.FIREBASE_APPCHECK_DEBUG_TOKEN` を設定。現在の共有固定トークンは `a4eb006d-0867-45dc-b9f5-8026de0b17a0` （Firebase Consoleへの登録必須）。
- **messaging のエラー耐性**: `getMessaging(app)` を try-catch でラップ。非対応ブラウザ（一部 iOS Safari 等）ではクラッシュせず `messaging = null` を export。利用側で null チェックが必要。

- **認証方式**: **Popup-only 戦略** (2026-05-07 v0.4.0)
  - **① アプリ内ブラウザ誘導UI**: LINE/Instagram 等のアプリ内ブラウザ検出時は `confirm()` で標準ブラウザへの切り替えを案内。
  - **② signInWithPopup**: 即座呼び出し、ユーザージェスチャー保持。
  - **③ popup-blocked 委譲**: `auth/popup-blocked` 時、呼び出し側にエラーをスローし、ユーザーに「ポップアップ解除手順」を提示するUIを表示。
  - **重要な教訓（GitHub Pages + signInWithRedirect の非互換性）**:
    - `signInWithRedirect` は `authDomain` (`firebaseapp.com`) とアプリのホスト (`github.io`) が異なるオリジンとなるため、Chrome 115+ 等のサードパーティCookie/ストレージ制限により `getRedirectResult` が常に `null` を返す。
    - GitHub Pages ではリバースプロキシ (`/__/auth/`) の設定が不可能なため、`signInWithRedirect` は**根本的に動作しない**。そのため、v0.4.0 にて完全に廃止した。
    - 解決にはホスティングをFirebase Hostingに移行するか、現行の `signInWithPopup` + ガイダンスUIを使用する必要がある。
  - **ユーザージェスチャー保持のルール**: `signInWithPopup` 呼び出し前に `await` を挟むとブラウザがポップアップをブロックする。ログイン関数を `async` にせず、同期的にPromiseを返す設計が必須。
- **モバイルオーダーのアクセス制御**:
  - **在校生判定**: メールアドレスが `@gl.pen-kanagawa.ed.jp` またはマスターアカウント（`ynrcs1000@gmail.com` 等）であるかを厳格に判定。`watchUser` を通じて `mobile-order.html` 側でも検証され、条件を満たさない場合は `login.html` にリダイレクトされる。
  - **ログイン機能の集約**: 以前存在した `mobile-order.html` 内部の対話型フローやゲスト歓迎画面は完全に廃止（Phase E-2）。未認証・非対象ユーザーは一律 `main/login.html?redirect=../pos/mobile-order.html&reason=mobile-order&mode=student` へリダイレクトされ、認証・ドメイン確認はすべて `login.html` で処理される。
- **管理・運営画面のアクセス制御**:
  - **対象**: `pos.html`, `monitor.html`, `kitchen.html`, `presenter.html`
  - **認証ハブ**: `portal.html`
  - **除外**: `status.html`（来場者も使用するため制限なし）、`mobile-order.html`（別フロー実装済み）
  - **実装パターン (Auth Guard)**: 各スタッフ用ツール内で `onAuthStateChanged` を監視し、未認証・ドメイン不正・店舗ID不一致の場合はすべて `portal.html` へURLパラメータ (`?return=...&s=...`) 付きで強制リダイレクト。
  - **Firestore更新の禁止**: クライアントから直接 `updateDoc` を呼ぶことは禁止。ステータス更新はすべて Cloud Functions (`kitchenComplete`, `callForPickup`, `completeOrder`, `adminUpdateOrderStatus`, `cancelOrder`) を使用する。
  - **SDK実装の統一**: 全認証箇所で `signInWithPopup` を唯一の方式とし、`popup-blocked` 時は専用のガイダンスUI (`#popup-blocked-guidance`) を表示してユーザーに設定変更と再試行を促すパターンを徹底。
- **統一ログイン画面 (`main/login.html`)** (v0.2.153, Phase C):
  - **役割**: `auth.js` の `login()` を呼び出す共通ログインページ。Phase D/E で `account.html` / `mobile-order.html` がリダイレクト先として使用する予定。
  - **URLパラメータ**: `redirect`（安全なリダイレクト先）、`reason`（メッセージ切替: `favorite`/`mobile-order`/`account`）、`mode`（`student` で学校メール強調枠表示）
  - **安全なリダイレクトバリデーション**: 相対パスまたは同一オリジンのみ許可。外部URLと `login.html` を含むURL（ループ防止）は `./index.html` にフォールバック。
  - **FOUC防止**: 初期表示はローディングスピナーのみ。`watchUser()` で認証状態確認後、ログイン済みなら `window.location.replace()` で即時遷移（履歴汚染回避）。
  - **デザインの最終調整 (v0.2.157)**: `app-shell.js` による共通ヘッダー・ナビゲーションの適用を確認し、`login.html` 固有のヒーローセクションとの視覚的整合性を確保。ログインページがアプリの一部として自然に見えるよう、余白と配置を最適化した。
  - 「`main/account.html` v0.2.0 (2026-05-07): 未ログイン時のゲスト画面を廃止し、`login.html?redirect=./account.html&reason=account` へリダイレクトに統一 (Phase D)。」
  - **堅牢なログインボタンの状態管理**: ログイン処理中はボタンを無効化し「処理中...」を表示するが、`try...finally` を用いて、処理完了後（成功・失敗・キャンセル・ポップアップ閉鎖を問わず）に確実にボタンを再活性化させる。これにより、部外者アカウントでのログイン失敗後のアカウント切り替え再試行などを妨げない設計とする（2026-05-07）。
- **同期**: ログイン時にユーザープロフィールを Firestore `users/{uid}` に保存。保存失敗時もUIがフリーズしないよう例外処理を徹底。

## 4. データベース (Firestore)

- **コレクション構成**:
  - `users/{uid}`: プロフィール + `cart` サブコレクション。複数端末対応のためのPush通知トークン配列 `fcmTokens` と、利用規約の初回同意日時 `termsAgreedAt` を保持する。
  - `_metadata/system_alerts`: ディレクトリ全体（main/pos）のグローバルアラート状態を管理するドキュメント（スーパーアドミン画面から編集）。
  - `stores/{storeId}`: 店舗メタデータ。
    - **Field Mappings** (Comparison with `data.js`):
      | Firestore Field | Meaning | Source in `data.js` |
      | :--- | :--- | :--- |
      | `name` | 団体名 (e.g. 3年1組) | `groupName` |
      | `teamName` | 店名・企画名 (e.g. やきそば屋) | `name` |
      | `description` | 説明文 | `description` |
      | - | 座標 (mapX/mapY) | **除外** (2026地図方式未定のため保留) |
    - **営業ステータス関連フィールド** (v0.3.12〜):
      | Field | Type | Values | Description |
      | :--- | :--- | :--- | :--- |
      | `operationStatus` | string | `"suspended"` / `"open"` / `"closed"` | 初期値は `"suspended"`（準備中・一時停止中）。来場者向けのモバイルオーダー注文可否に連動する。 |
      | `lastActivityAt` | Timestamp | サーバー時刻 | 注文やステータス変更等の「最新のシステム利用時刻」。15分以上更新がなければ `manageStoreStatusAndWarmup` が放置と判定し `"suspended"` に自動変更する。 |
      | `isAutoSuspended` | boolean | `true` | `manageStoreStatusAndWarmup` によって自動的に `"suspended"` にされた場合に `true` となるフラグ。手動操作時は削除される。このフラグがある状態で何らかの操作が起きた場合、システムが自律的に `"open"` に復帰する。 |

  - `items/{itemId}`: 商品マスタデータ。
  - `orders/{orderId}`: 注文トランザクションデータ。
    - `orderChannel`: `"mobile"`, `"sok"`, `"pos"` で注文経路を区別。
    - SOK専用: `sokStatus` (`"pending"`, `"claimed"`, `"confirmed"`, `"expired"`) と `sokClaimedAt`。
    - `paymentMethod`: 経路によらず `"au_pay_manual"` に統一。
    - `readyForPickupAt`: 提供準備完了時刻。15分放置ペナルティの自動判定（Scheduled Function）の基準として重要。
  - `counters/receipt_{channel}`: 経路別（`receipt_pos`, `receipt_sok`, `receipt_mobile`）のレシート番号生成用アトミックカウンタ。
  - `store_secrets/{storeId}`: 店舗パスワード等の機密情報 (Functions管理)。
  - **Spreadsheet Integration**:
    - **手法**: プログラムによる一括作成は高度な保護機能プログラム(APP)によりブロックされるため、別アカウント（個人のGmail）で手動で作成したスプレッドシートのURLを紐づける方式を採用。
    - **権限設定**: 作成者アカウントから、システム用サービスアカウント（例: `nanryosai-2026-a4091@appspot...` 及びローカル開発用 `932284...`）に編集(Editor)権限を付与することで、Cloud Functionsからの自動追記を実現。
    - `stores/{storeId}.spreadsheetId`: 作成されたGoogleスプレッドシートのID。
    - `stores/{storeId}.spreadsheetUrl`: スプレッドシートへの直接リンク。
  - `venues/{venueId}`: 会場（体育館、音楽室など）のリアルタイムステータス。
    - `status`: "preparing" | "soon" | "live" | "ended"
    - `currentEventId`: 現在の演目ID（data.js の stageData と紐付け）
    - `nextEventId`: 次の演目ID
  - `venue_admin_config/settings`: 会場管理画面のログイン用設定（URLトークン、パスワードのハッシュ・ソルト）。Firebase Authを使わない独立した認証に使用。
  - `venue_admin_sessions/{sessionToken}`: 会場管理の有効なセッショントークン。
- **セキュリティルール**:
  - `orders`: 作成(**Create**)はクライアントから**禁止**（Function経由必須）。読み取りは設計憲法§8.1に基づき、「自身の注文」「SOKの未確定仮注文（`sokStatus == "pending"`）」「提供準備完了（`ready_for_pickup`）」「自店舗の管理者・スーパー管理者」のみ許可。
  - `banned_users`: 利用規約違反等によるアクセス制限ユーザーのUIDを記録。本人のみ読み取り可能で、書き込みはクライアントから完全禁止（設計憲法§10.2）。
  - `items`: 読み取りは誰でも可能。書き込みは管理者のみ。
  - `users`: 本人のみ読み書き可。
  - `store_secrets`: 読み書き完全禁止。

- **インデックス (Indexes)**:
  - **複合インデックス**: 売上ダッシュボードの前日比（DoD）機能のため、以下のインデックスが必要。
    - コレクション: `orders`
    - フィールド: `storeId` (Ascending), `createdAt` (Ascending)
    - 備考: `portal.html` から前日のデータを集計する際に使用。

## 4.5. 独自セッション認証 (会場ステータス管理)

会場ステータス管理 (`admin/venue.html`) は、学校の先生が共有端末等で即座にアクセスできるよう、**Firebase Auth を使用しない独自の認証フロー**を採用しています。
- **ログイン**: URLパラメータの `token` と手入力のパスワードをCloud Function (`loginVenueAdmin`) に送信し、PBKDF2でハッシュ照合。成功時にセッショントークンを発行して `venue_admin_sessions` に保存。
- **ステータス更新**: クライアントは `updateVenueStatus` Functionを呼び出し、セッショントークンを検証した上で `venues` を更新。Firestoreへの直接書き込みはルールで全拒否。

## 5. バックエンド (Cloud Functions)

- **配置**: `functions/index.js` (`asia-northeast1` にデプロイ)
- **関数一覧**:
  - `createOrder` (OnCall): mobile / pos 両経路を統合した注文作成関数。`banned_users` チェック（mobileのみ）、発番、初期ステータス（`cooking`）の設定を行う。
  - `kitchenComplete` (OnCall): cooking → ready_to_serve ステータス遷移（店舗管理者のみ）。
  - `callForPickup` (OnCall): ready_to_serve → ready_for_pickup ステータス遷移（店舗管理者のみ）。
  - `completeOrder` (OnCall): ready_for_pickup → completed ステータス遷移（店舗管理者のみ）。
  - `cancelOrder` (OnCall): キャンセル処理（店舗管理者のみ）。理由必須。
  - `adminUpdateOrderStatus` (OnCall): super_admin / store_admin による強制ステータス変更。
  - `createSokProvisional` (OnCall): SOKの仮注文を作成（`sokStatus: "pending"`, `userId: null`）。受付番号2000番台を発番。
  - `claimSokOrder` (OnCall): SOKQR読み取り時に保有者を確定（`sokStatus: "claimed"`）。
  - `confirmSokOrder` (OnCall): SOKの最終確定（`sokStatus: "confirmed"`, `status: "cooking"`）。
  - `abandonStaleOrders` (Schedule): 1分ごとに起動し、`ready_for_pickup` から15分超過した注文を `abandoned` に遷移させ、`banned_users` へ登録。
  - `expireSokOrders` (Schedule): 1分ごとに起動し、確定されずに5分超過したSOK仮注文を `expired` として自動キャンセル。
  - `sendOrderUpdateNotification` (Trigger): 注文ステータス変更時にFCMプッシュ通知を `fcmTokens` 配列に対して一斉送信。
  - `bulkCreateSpreadsheets` (OnCall): 既存店舗のスプレッドシートを一括作成。タイムアウト540秒設定。
  - `syncOrderToSpreadsheet` (Firestore Trigger): 注文の新規作成・更新時にスプレッドシートへ追記。
  - `loginVenueAdmin` (OnCall): ステージ発表・催し物会場（venues）管理用。URLトークンとパスワードを検証し、セッショントークンを発行。
  - `updateVenueStatus` (OnCall): セッショントークンを検証し、許可されたフィールド (`status`, `currentEventId`, `nextEventId`, `updatedAt`) のみ `venues/{venueId}` に安全にマージする。
  - `warmupPing` (OnRequest): Cloud Functions のコールドスタートを防ぐための軽量なダミー関数。スケジュール関数から定期的に叩かれる。
  - `updateStoreStatus` (OnCall, v0.3.12〜): 店舗の営業ステータスを変更する。`newStatus === "open"` の場合、`availableItemIds` に含まれる商品のみ `isAvailable: true` にし、それ以外を `false` にバッチ更新。同時に `operationStatus` と `lastActivityAt` を更新する。`store_admin` 権限が必要。
  - `manageStoreStatusAndWarmup` (Scheduled, 毎分実行): `operationStatus === "open"` かつ `lastActivityAt` が15分以上前の店舗を自動的に `"suspended"` に変更する（放置検知）。また、活発な店舗がある場合は `warmupPing` へリクエストを送信して Functions を保温する。


## 6. クラウドストレージ (Cloud Storage)

- **バケット**: `nanryosai-2026-a4091.firebasestorage.app`
- **用途**: 店舗管理者による商品画像のアップロード。
- **パス構造**: `products/{storeId}/{timestamp}_{filename}.webp`
- **フロー**:
  1. `portal.html` からアップロード
     - **クライアントサイド圧縮**: Canvas APIで長辺1200pxにリサイズし、**WebP (q=0.8)** に変換。
  2. Storage に `image/webp` として保存。
  3. 公開URL (`getDownloadURL`) を生成し、Firestore `items.imageUrl` に保存。
  4. `mobile-order.html` で表示。
- **セキュリティルール**:
  - `products/{storeId}/` 配下は、その店舗の管理者（Custom Claim `storeId` 一致）のみ書き込み許可。読み取りは全公開。

## 7. リソース使用量試算 (1操作あたり)

- **モバイルオーダー完了フロー (1回)**:
  - **Reads**: 約58 (Auth 0, Stores 20, Items 30, Function 8)
  - **Writes**: 約6 (Auth 1, Cart 3, Function 2)
  - **Function Calls**: 1
- **トップページ閲覧**: 0 Reads/Writes.
- **ステータス確認**: 1 Read (+更新ごとに1).
- **備考**: 店舗・商品全件取得のためRead数が多め。規模拡大時はクライアントキャッシュ推奨。

## 8. 現在のデータ量 (2026-02-02 時点)

- **合計ドキュメント数**: 42 (Stores 7, Items 19, Orders 6, Users 10)
- **推定データサイズ**: 約 84 KB (0.00008 GiB)
- **算出根拠**:
  - 各ドキュメント(インデックス込)を平均 2KB と仮定。
  - 開発環境のテストデータのみであるため、課金発生ライン (1GiB/日) には遠く及ばない。

## 9. 関連ファイル構造

プロジェクト内の主要なFirebase関連ファイルは以下の通りです。

- **設定・ルール**: `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `cors.json`
- **初期化モジュール**: `main/auth.js` (SSOT), `main/firebase-messaging-sw.js`, `pos/firebase-messaging-sw.js`
- **Cloud Functions**: `functions/index.js`, `functions/package.json`, `functions/setupVenueAdmin.js`
- **主要な利用ページ**:
  - `main/`: `index.html`, `account.html`, `login.html`, `admin/venue.html`, `admin_sync.html`
  - `pos/`: `mobile-order.html`, `portal.html`, `pos.html`, `kitchen.html`, `monitor.html`, `status.html`, `presenter.html`, `training/pos.html`
- **開発・同期スクリプト**: `admin-server.js`, `debug_firestore_custom.js`, `generate_hash.js`
