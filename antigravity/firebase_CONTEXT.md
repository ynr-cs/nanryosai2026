---
title: Firebase アーキテクチャ コンテキスト
tags: [infra, context]
status: active
last_updated: 2026-04-26
---

# Firebase アーキテクチャ コンテキスト

> **Note**: システム全体の構成図は [[architecture_CONTEXT]] を参照してください。

## 1. プロジェクト情報

- **Project ID**: `nanryosai-2026-a4091`
- **Region**: `asia-northeast1` (Tokyo)

## 2. セキュリティ (App Check)

- **全体実装済み**: 不正なアクセスをブロックするため全域で有効化。
- **プロバイダー**:
  - `mobile-order.html`: **ReCaptcha Enterprise** (Key: `6LdVI4sqAAAAABsFgjK80A2MAiCg7X9K7uJ-gYQ6`)
  - 管理・モニター画面: **ReCaptcha v3**
- **デバッグ**: ローカル開発用トークンはソースコードにハードコーディングせず、プロジェクトルートの `config.local.js` に `window.LOCAL_ENV` として定義し、ブラウザから読み込む構成を採用（2026-04-28）。これにより GitHub へのトークン漏洩を防ぐ。現在の共有固定トークンは `a4eb006d-0867-45dc-b9f5-8026de0b17a0` （Firebase Consoleへの登録必須）。

- **認証方式**: **トリプルフォールバック戦略** (2026-04-27 v0.2.142)
  - **① `signInWithPopup`（最優先）**: ユーザージェスチャーを保持して即座に呼び出し。`login()` を `async` にしないことで、ブラウザがポップアップをユーザーの意図的操作と判断する。
  - **② `signInWithRedirect`（フォールバック）**: `auth/popup-blocked` エラー時のみリダイレクト方式にフォールバック。
  - **③ 外部ブラウザ誘導UI**: LINE/Instagram 等のアプリ内ブラウザ検出時は `confirm()` で標準ブラウザへの切り替えを案内。
  - **重要な教訓（GitHub Pages + signInWithRedirect の非互換性）**:
    - `signInWithRedirect` は `authDomain` (`firebaseapp.com`) とアプリのホスト (`github.io`) が異なるオリジンとなるため、Chrome 115+ 等のサードパーティCookie/ストレージ制限により `getRedirectResult` が常に `null` を返す。
    - GitHub Pages ではリバースプロキシ (`/__/auth/`) の設定が不可能なため、`signInWithRedirect` は**根本的に動作しない**。
    - `setPersistence(auth, browserLocalPersistence)` ではこの問題は解決できない（v0.2.141で試行・失敗）。
    - 解決にはホスティングをFirebase Hostingに移行するか、`signInWithPopup` を使用する必要がある。
  - **ユーザージェスチャー保持のルール**: `signInWithPopup` 呼び出し前に `await` を挟むとブラウザがポップアップをブロックする。ログイン関数を `async` にせず、同期的にPromiseを返す設計が必須。
- **モバイルオーダーのアクセス制御**:
  - **在校生判定**: メールアドレスが `@gl.pen-kanagawa.ed.jp` またはマスターアカウント（`ynrcs1000@gmail.com` 等）であるかを厳格に判定。
  - **対話型フロー**: ログイン前に「南陵生ですか？」の確認を挟み、はいの場合は「学校アカウントの選択」を促すワンクッション画面を表示。
  - **ゲストモード**: 一般来場者がログインした場合は、「利用対象外」と突き放すのではなく、お気に入り機能等のメリットを提示する歓迎画面（`step-guest-welcome`）を表示する設計に改善（2026-04-19）。
- **管理・運営画面のアクセス制御**:
  - **対象**: `pos.html`, `monitor.html`, `kitchen.html`, `presenter.html`
  - **認証ハブ**: `portal.html`
  - **除外**: `status.html`（来場者も使用するため制限なし）、`mobile-order.html`（別フロー実装済み）
  - **実装パターン (Auth Guard)**: 各スタッフ用ツール内で `onAuthStateChanged` を監視し、未認証・ドメイン不正・店舗ID不一致の場合はすべて `portal.html` へURLパラメータ (`?return=...&s=...`) 付きで強制リダイレクト。実際のログイン処理(`signInWithRedirect`)とエラー表示（不正ドメイン時の警告オーバーレイなど）は `portal.html` が一手に引き受ける構成に集約（2026-04-23）。
  - **SDK実装の統一**: 全認証箇所で `signInWithPopup` を基本とし、`popup-blocked` 時のみ `signInWithRedirect` にフォールバックする統一パターンを適用。
- **堅牢性**: 
  - **二重実行防止**: `onAuthStateChanged` と手動ログインの競合を防ぐため、実行フラグによる排他制御を実装。
  - **アプリ内ブラウザ対策**: LINE/Instagram等のブラウザでは標準ブラウザ（Chrome/Safari）への誘導を強化。
  - **エラーハンドリング**: ネットワークエラー等に対し、ユーザーが次に取るべき行動を明示した日本語エラーメッセージを表示。
- **同期**: ログイン時にユーザープロフィールを Firestore `users/{uid}` に保存。保存失敗時もUIがフリーズしないよう例外処理を徹底。

## 4. データベース (Firestore)

- **コレクション構成**:
  - `users/{uid}`: プロフィール + `cart` サブコレクション。
  - `stores/{storeId}`: 店舗メタデータ。
    - **Field Mappings** (Comparison with `data.js`):
      | Firestore Field | Meaning | Source in `data.js` |
      | :--- | :--- | :--- |
      | `name` | 団体名 (e.g. 3年1組) | `groupName` |
      | `teamName` | 店名・企画名 (e.g. やきそば屋) | `name` |
      | `description` | 説明文 | `description` |
      | - | 座標 (mapX/mapY) | **除外** (2026地図方式未定のため保留) |
  - `items/{itemId}`: 商品マスタデータ。
  - `orders/{orderId}`: 注文トランザクションデータ。
    - `paymentMethod`: `"online"` (アプリ決済), `"pos"` (POSでのQR手動確認). `"cash"` は廃止済み。
  - `counters/receipt`: レシート番号生成用アトミックカウンタ。
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
  - `orders`: 作成(**Create**)はクライアントから**禁止**（Function経由必須）。読み取りは管理者/本人/SuperAdminのみ。
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
  - `createOnlineOrder` (OnCall): 注文作成トランザクション。在庫チェック、レシート番号発番を行う。API直叩きでの不正利用を防ぐため、**`context.auth.token.email` を用いたドメイン検証**を必須要件としている。
  - `getNextReceiptNumber` (OnCall): POS用の安全なレシート番号発番。
  - `sendOrderUpdateNotification` (Trigger): 注文ステータス変更時にFCMプッシュ通知を送信。
  - `mockAuPayPayment` (OnCall): auPay決済のデモ用モック処理。注文ステータスを `authorized` へ変更する。
  - `bulkCreateSpreadsheets` (OnCall): 既存店舗のスプレッドシートを一括作成。タイムアウト540秒設定。
  - `syncOrderToSpreadsheet` (Firestore Trigger): 注文の新規作成・更新時にスプレッドシートへ追記。
  - `loginVenueAdmin` (OnCall): 会場管理用。URLトークンとパスワードを検証し、セッショントークンを発行。
  - `updateVenueStatus` (OnCall): セッショントークンを検証し、許可されたフィールド (`status`, `currentEventId`, `nextEventId`, `updatedAt`) のみ `venues/{venueId}` に安全にマージする。

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
