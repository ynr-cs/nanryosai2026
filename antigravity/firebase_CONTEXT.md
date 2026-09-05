---
title: Firebase アーキテクチャ コンテキスト
tags: [infra, context]
status: active
last_updated: 2026-09-06
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

- **認証方式**: **Google Identity Services (GIS) + ゼロ・ナレッジ匿名UIDアーキテクチャ (V4 / 2026-08-30)**
  - **① GISクライアント連携**: `main/auth.js` の `renderGoogleLoginButton` により、Google公式のOne Tap / Buttonコンポーネントを描画。
  - **② サーバー検証 & 匿名UID発行 (`authenticateWithGoogle` Callable Function)**:
    - クライアントから送信された Google ID トークン（JWT）を Google Auth ライブラリで暗号学的に検証。
    - ID トークンの `sub`（Google固有ID）から HMAC-SHA256（Firebase環境変数 `AUTH_PEPPER_SECRET` を使用）で一方向ハッシュ化し、不可逆な匿名 UID (`usr_` + 24文字) を生成。
    - ID トークン内のドメイン（`@gl.pen-kanagawa.ed.jp`）判定を行い、在校生には `identity: 'student'`、一般には `identity: 'guest'` の Custom Claims を設定。`admin.auth().setCustomUserClaims(uid, newClaims)` と同時に `admin.auth().createCustomToken(uid, newClaims)` にクレームを渡すことで、クライアント側サインイン直後の初期 ID トークンに即時反映させる。
    - **PII完全非保持**: メールアドレス・本名・プロフィール画像等の個人情報はデータベース、ログ、Authレコードのいずれにも一切保存しない。
  - **③ クライアントサインイン**: `signInWithCustomToken(auth, customToken)` により Firebase セッションを確立。
  - **④ 退会・アカウント完全消去 (`deleteMyAccount` Callable Function)**:
    - ユーザーがアカウント設定から退会を実行すると、Firestore上の `users/{uid}`、`users/{uid}/cart`、`orders`（当該ユーザーUIDの注文履歴）、および Firebase Auth 上の認証レコードを即座に完全消去。
- **モバイルオーダーのアクセス制御**:
  - **在校生判定**: Custom Claims (`identity == 'student'` または `identityOverride == 'student'` または `identity == 'super_admin'`) に基づき判定。`isEffectiveStudent(claims)` を利用。
  - **ログイン機能の集約**: 未認証・非在校生ユーザーは一律 `main/login.html?redirect=../pos/mobile-order.html&reason=mobile-order&mode=student` へリダイレクトされ、認証・ドメイン確認はすべて `login.html` で処理される。
- **管理・運営画面のアクセス制御**:
  - **対象**: `pos.html`, `monitor.html`, `kitchen.html`, `presenter.html`
  - **認証ハブ**: `portal.html`
  - **除外**: `status.html`（来場者も使用するため制限なし）、`mobile-order.html`（在校生専用）
  - **実装パターン (Auth Guard)**: 各スタッフ用ツール内で `onAuthStateChanged` を監視し、未認証・Custom Claims 在校生権限なし・店舗ID不一致の場合はすべて `portal.html` へURLパラメータ (`?return=...&s=...`) 付きで強制リダイレクト。
  - **Firestore更新の禁止**: クライアントから直接 `updateDoc` を呼ぶことは禁止。ステータス更新はすべて Cloud Functions (`kitchenComplete`, `callForPickup`, `completeOrder`, `adminUpdateOrderStatus`, `cancelOrder`) を使用する。
- **統一ログイン画面 (`main/login.html`)**:
  - **役割**: GIS 連携ログインボタンを表示する共通ログインページ。
  - **URLパラメータ**: `redirect`（安全なリダイレクト先）、`reason`（メッセージ切替: `favorite`/`mobile-order`/`account`）、`mode`（`student` で学校メール強調枠表示）
  - **安全なリダイレクトバリデーション**: 相対パスまたは同一オリジンのみ許可。外部URLと `login.html` を含むURL（ループ防止）は `./index.html` にフォールバック。
  - **FOUC防止**: 初期表示はローディングスピナーのみ。`watchUser()` で認証状態確認後、ログイン済みなら `window.location.replace()` で即時遷移（履歴汚染回避）。
- **同期**: ログイン時にユーザープロフィールを Firestore `users/{uid}` に保存（`nickname`, `lastLogin`, `fcmTokens`, `termsAgreedAt` のみ。PIIは保存不可）。

## 3. Firebase Analytics (GA4)

- **導入フェーズ1**: ページビュー等の基本トラッキングを全ページで実装。
  - `main/` 側: `main/auth.js` にて `getAnalytics(app)` を一括初期化し、`app-shell.js` を経由して全ページで計測を有効化。
  - `pos/` 側: `pos.html`, `portal.html` などの V9 モジュール利用ページ、および `presenter.html`, `kitchen.html` の Compat 利用ページそれぞれで Analytics 初期化を個別に追加。
- **プライバシーポリシー**: `main/privacy.html` を作成し、Google Analyticsの使用とCookieについて明記。`app-shell.js` のフッターホワイトリストに追加され、全ページのフッターから導線が確保されている。
- **導入フェーズ2（将来）**: 特定のUI操作（注文完了、エラー発生等）のカスタムイベント計測を追加予定。

## 4. データベース (Firestore)

- **コレクション構成**:
  - `users/{uid}`: プロフィール + `cart` サブコレクション。複数端末対応のためのPush通知トークン配列 `fcmTokens` と、利用規約の初回同意日時 `termsAgreedAt` を保持する。
    - **お気に入り機能**: `favoriteItemIds` (Array<string>) フィールドに、企画・ステージ等のIDを保存し、UIDベースで管理する（システムのメールアドレス仕様には依存しない）。
  - `_metadata/system_alerts`: ディレクトリ全体（main/pos）のグローバルアラート状態を管理するドキュメント（スーパーアドミン画面から編集）。
    - **フィールド一覧** (v0.3.18〜):
      | Field | Type | Description |
      | :--- | :--- | :--- |
      | `mainAlertActive` | boolean | Main（来場者）向けアラートの表示フラグ |
      | `mainAlertType` | string | `"error"` / `"warning"` / `"info"` |
      | `mainAlertMessage` | string | 来場者向けに表示するメッセージ |
      | `penaltyEnabled` | boolean | ペナルティ自動執行（`abandonStaleOrders`）の有効/無効フラグ。`true` の場合のみ放置注文の自動BAN処理が稼働する（安全弁） |
      | `posAlertActive` | boolean | POS（店舗スタッフ）向けアラートの表示フラグ |
      | `posAlertType` | string | `"error"` / `"warning"` / `"info"` |
      | `posAlertMessage` | string | 店舗スタッフ向けに表示するメッセージ |
      | `updatedAt` | string | ISO 形式の最終更新時刻 |
      | `emergencyStopAt` | string | 緊急停止が実行された時刻（緊急停止時のみ書き込まれる） |
    - **セキュリティ**: Firestore ルールで `write: if isSuperAdmin()` により `ynrcs1000@gmail.com` のみ書き込み可。URL が漏れても別アカウントからの書き込みはサーバー側で permission-denied になる。
    - **緊急停止の挙動** (v0.3.21〜):
      - `superadmin.html` の「全注文受付を停止する」ボタンを押すと、`system_alerts` の更新と全店舗の `operationStatus: "suspended"` + `isEmergencyStopped: true` + `isAutoSuspended: false` の変更を `writeBatch` で**アトミックに実行**する。旧フィールド `emergencySuspendedAt` は `deleteField()` で同時に削除される。
      - 緊急停止中は、POSからの注文もモバイルオーダーからの注文も、`createOrder` Function が `operationStatus` チェックにより**サーバー側で完全にブロック**される（クライアント側UIによる制御だけに依存しない二重防御）。
      - 緊急停止中に POS スタッフが調理完了・呼び出し等の操作をしても、`updateStoreActivity` の Auto-Resume は `isEmergencyStopped: true` により発動しない。
      - 「アラートを全解除する」は `mainAlertActive: false` / `posAlertActive: false` を書き込みつつ、全店舗の `isEmergencyStopped` を `deleteField()` で削除する（`operationStatus` と `isAutoSuspended` は変更しない）。
      - 各店舗スタッフがポータルから「営業開始」を押した時点で `operationStatus: "open"`, `isEmergencyStopped: deleted`, `isAutoSuspended: deleted` となり、モバイル・POSの注文受付が再開される。
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
      | `isAutoSuspended` | boolean | `true` | `manageStoreStatusAndWarmup` によって自動的に `"suspended"` にされた場合に `true` となるフラグ。手動操作時は削除される。このフラグがある状態で何らかの操作が起きた場合、システムが自律的に `"open"` に復帰する。**ただし `isEmergencyStopped: true` の場合は復帰しない。** |
      | `isEmergencyStopped` | boolean | `true` | SuperAdmin による緊急停止時に `true` となるフラグ（v0.3.21〜）。このフラグが立っている場合、`updateStoreActivity` の Auto-Resume が無効化される。全解除時に削除される。店舗スタッフの「営業開始」操作時にも削除される。 |

  - `items/{itemId}`: 商品マスタデータ。
  - `orders/{orderId}`: 注文トランザクションデータ。
    - `orderChannel`: `"mobile"`, `"sok"`, `"pos"` で注文経路を区別。
    - SOK専用: `sokStatus` (`"pending"`, `"claimed"`, `"confirmed"`, `"expired"`, `"cancelled"`) と `sokClaimedAt`。
    - `paymentMethod`: 経路によらず `"au_pay_manual"` に統一。
    - `readyForPickupAt`: 提供準備完了時刻。5分放置ペナルティの自動判定（`abandonStaleOrders` Scheduled Function）の基準として重要。
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
  - **【重要】スキーマ設計の禁止事項 (Zero-Trust Policy)**:
    1. **公開コレクションへの個人情報追加禁止**: `stores`, `orders`, `venues` は（一部または全部が）公開読み取り可能になっています。これらのコレクションには「氏名・電話番号・メールアドレス」などの個人情報（PII）を絶対に追加しないでください。追加した場合、ルール変更なしに即座に情報漏洩に直結します。
    2. **`users/{uid}` への信頼フィールド配置禁止**: ユーザーは自身の `users/{uid}` 配下を自由に書き込めます。そのため、システムが判定に用いる「信頼すべき値」（例: 権限フラグ、BANフラグ、購入回数制限など）をこの階層に配置してはいけません。必ず `banned_users` のような別コレクションか、Custom Claims を使用してください。
  - `orders`: 作成(**Create**)はクライアントから**禁止**（Function経由必須）。読み取りは設計憲法§8.1に基づき、「自身の注文」「SOKの未確定仮注文（`sokStatus == "pending"`）」「提供準備完了（`ready_for_pickup`）」「自店舗の管理者・スーパー管理者」のみ許可。
  - `banned_users`: 利用規約違反等によるアクセス制限ユーザーのUIDを記録。本人のみ読み取り可能で、書き込みはクライアントから完全禁止（設計憲法§10.2）。
  - `items`: 読み取りは誰でも可能。書き込みは管理者のみ。
  - `users`: 本人のみ読み書き可（V4: `email`, `displayName`, `photoURL` のPII書き込みはルール層で禁止。`delete` 時はUID一致のみで許可）。
  - `store_secrets`: 読み書き完全禁止。
  - `isSuperAdmin()`: `request.auth.token.identity == 'super_admin'` の Custom Claim で判定（V4移行によりトークン内のemail依存を全廃）。

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
  - `authenticateWithGoogle` (OnCall, V4): Google Identity Services の ID トークンを暗号学的に検証し、不可逆ハッシュ（HMAC-SHA256）による匿名 UID を生成して Custom Token を発行。在校生ドメイン判定により `identity: 'student'` または `'guest'` の Custom Claims を設定。PIIは完全非保持。
  - `grantIdentity` (OnCall, V4): SuperAdmin（`identity == 'super_admin'`）専用の権限管理関数。指定 UID または Google ID トークンハッシュに対して `identity`（`student`, `guest`, `super_admin`）を付与。
  - `deleteMyAccount` (OnCall, V4): ユーザー自身による退会・完全データ消去関数。`users/{uid}`, `users/{uid}/cart`, `orders`（本人の注文履歴）、および Firebase Auth レコードを完全削除。
  - `createOrder` (OnCall): mobile / pos 両経路を統合した注文作成関数。`banned_users` チェック（mobileのみ）、発番、初期ステータス（`cooking`）の設定を行う。
  - `kitchenComplete` (OnCall): cooking → ready_to_serve ステータス遷移（店舗管理者のみ）。
  - `callForPickup` (OnCall): ready_to_serve → ready_for_pickup ステータス遷移（店舗管理者のみ）。
  - `completeOrder` (OnCall): ready_for_pickup → completed ステータス遷移（店舗管理者のみ）。
  - `cancelOrder` (OnCall): キャンセル処理（店舗管理者のみ）。理由必須。
  - `adminUpdateOrderStatus` (OnCall): super_admin / store_admin による強制ステータス変更。
  - `createSokProvisional` (OnCall): SOKの仮注文を作成（`sokStatus: "pending"`, `status: null`, `userId: null`）。受付番号は未発番。
  - `claimSokOrder` (OnCall): SOKQR読み取り時に保有者を確定（`sokStatus: "claimed"`）。トランザクションで二重読み取りを防止。
  - `confirmSokOrder` (OnCall): SOKの最終確定（`sokStatus: "confirmed"`, `status: "cooking"`）。ここでSOK用（2000番台）の受付番号を発番。
  - `cancelSokOrder` (OnCall): SOKの未確定注文(`sokStatus: "claimed"`)を手動キャンセルする。所有者認証を強制し、`sokStatus: "cancelled"` へ遷移させる(`status`は`null`のまま)。
  - `abandonStaleOrders` (Schedule): 1分ごとに起動し、`ready_for_pickup` から**5分**超過した注文を `abandoned` に遷移させ、`banned_users` へ登録。`_metadata/system_alerts.penaltyEnabled` が `true` の場合のみ執行（安全弁）。`identity == 'super_admin'` のユーザーは対象外。
  - `expireSokOrders` (Schedule): 1分ごとに起動し、確定されずに5分超過したSOK仮注文を `expired` として自動キャンセル。
  - `sendOrderUpdateNotification` (Trigger): 注文ステータス変更時にFCMプッシュ通知を `fcmTokens` 配列に対して一斉送信。
  - `bulkCreateSpreadsheets` (OnCall): 既存店舗のスプレッドシートを一括作成。タイムアウト540秒設定。
  - `syncOrdersToSheets` (Scheduled, 毎分実行): 毎分ごとに、直近1時間以内に更新された対象ステータス（cooking, ready_to_serve, ready_for_pickup, completed, cancelled, abandoned）の注文を取得し、各店舗のスプレッドシートへ一括書き込み（バッチ同期）を行う。SOK仮注文は除外される。スプレッドシートの数式インジェクション防止エスケープ処理を含む。
  - `reinitSheetHeaders` (OnCall): スプレッドシートのヘッダを新しい10列構成に再初期化する。
  - `rebuildStoreSheet` (OnCall): 特定の店舗のスプレッドシートをクリアし、Firestoreの全対象履歴から再構築する（復旧用）。
  - `loginVenueAdmin` (OnCall): ステージ発表・催し物会場（venues）管理用。URLトークンとパスワードを検証し、セッショントークンを発行。
  - `updateVenueStatus` (OnCall): セッショントークンを検証し、許可されたフィールド (`status`, `currentEventId`, `nextEventId`, `updatedAt`) のみ `venues/{venueId}` に安全にマージする。
  - `updateStoreStatus` (OnCall, v0.3.12〜): 店舗の営業ステータスを変更する。`newStatus === "open"` の場合、`availableItemIds` に含まれる商品のみ `isAvailable: true` にし、それ以外を `false` にバッチ更新。同時に `operationStatus` と `lastActivityAt` を更新する。`store_admin` 権限が必要。
  - **コールドスタート対策（ウォームアップ機構）**:
    - `warmupOrderFunctions`: 内部ヘルパー関数。営業中の店舗が存在する場合に、注文関連のクリティカルパスとなる7つの関数（`createOrder`, `createSokProvisional`, `claimSokOrder`, `confirmSokOrder`, `kitchenComplete`, `callForPickup`, `completeOrder`）に対して、`{"data": {"warmup": true}}` のペイロードを持たせたHTTP POSTリクエストを一斉送信する。
    - **バイパス実装**: 上記7つの対象関数の先頭には、`if (requestData && requestData.warmup === true) return { warmup: true };` というバイパスロジックが組み込まれており、認証チェックやDBアクセスの前に即座にリターンする（処理を消費せずインスタンスだけを起動/保温する）。
  - `manageStoreStatusAndWarmup` (Scheduled, 毎分実行): `operationStatus === "open"` かつ `lastActivityAt` が15分以上前の店舗を自動的に `"suspended"` に変更する（放置検知）。また、活発な店舗がある場合は上記の `warmupOrderFunctions()` を呼び出して注文系 Functions を保温する。
  - `syncStoreItemAvailability` (Firestore Trigger, v0.5.56〜): `items/{itemId}` の作成・更新・削除時に自動発火し、該当店舗の全商品を取得して `availableItemCount` (販売中数) と `totalItemCount` (総数) を計算し `stores/{storeId}` に同期する。


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

## 8. 本番運用データ状態 (2026-09-06 時点)

- **公式移行完了**: 2026-09-06 の本番マスターデータ移行に伴い、テスト用注文・旧店舗・旧商品を一括パージ。
- **稼働中店舗**: `stores/301`（3年1組「アキコのひとくちカステラ」）のみ。合意済みの先行モバイルオーダー運用を実施。他店舗は `useMobileOrder: false`（店頭販売・展示）。
- **登録商品**: 3年1組の公式3商品（プレーン 100円、チョコソース 100円、抹茶 110円）のみ。
- **注文・カウンター**: `orders` は本番開始前クリーンアップにより 0 件。`counters`（`receipt_mobile`, `receipt_pos`, `receipt_sok`）は初期化され、初回注文時にそれぞれ 7000番, 100番, 2000番から自動発番される構成。
- **Cloud Storage**: テスト時の商品画像（101等）を全件パージ済み（バケット内残存 0 件）。

## 9. 関連ファイル構造

プロジェクト内の主要なFirebase関連ファイルは以下の通りです。

- **設定・ルール**: `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `cors.json`
- **初期化モジュール**: `main/auth.js` (SSOT), `main/firebase-messaging-sw.js`, `pos/firebase-messaging-sw.js`
- **Cloud Functions**: `functions/index.js`, `functions/package.json`, `functions/setupVenueAdmin.js`
- **主要な利用ページ**:
  - `main/`: `index.html`, `account.html`, `login.html`, `admin/venue.html`, `admin_sync.html`
  - `pos/`: `mobile-order.html`, `portal.html`, `pos.html`, `kitchen.html`, `monitor.html`, `status.html`, `presenter.html`, `training/pos.html`
- **開発・同期スクリプト**: `scripts/cleanupAndSyncOfficialData.js`, `scripts/resetTestData.js`, `scripts/grantSuperAdmin.js`, `scripts/wipeAuthUsers.js`, `admin-server.js`

