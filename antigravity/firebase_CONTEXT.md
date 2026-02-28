# Firebase アーキテクチャ コンテキスト

> **Note**: システム全体の構成図は [architecture_CONTEXT.md](architecture_CONTEXT.md) を参照してください。

## 1. プロジェクト情報

- **Project ID**: `nanryosai-2026-a4091`
- **Region**: `asia-northeast1` (Tokyo)

## 2. セキュリティ (App Check)

- **全体実装済み**: 不正なアクセスをブロックするため全域で有効化。
- **プロバイダー**:
  - `mobile-order.html`: **ReCaptcha Enterprise** (Key: `6LdVI4sqAAAAABsFgjK80A2MAiCg7X9K7uJ-gYQ6`)
  - 管理・モニター画面: **ReCaptcha v3**
- **デバッグ**: ローカル開発用トークン `b20b2da1-c68d-4cd9-a34f-5f65e2d0bdae`。

## 3. 認証 (Authentication)

- **方式**: Google Sign-In (Popup)。
- **アプリ内ブラウザ対策**: LINE/Instagramブラウザでのアクセス時に警告を表示するロジックあり。
- **同期**: ログイン時にユーザープロフィール（名前、メール）を Firestore `users/{uid}` に同期。

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

## 5. バックエンド (Cloud Functions)

- **配置**: `functions/index.js` (`asia-northeast1` にデプロイ)
- **関数一覧**:
  - `createOnlineOrder` (OnCall): 注文作成トランザクション。在庫チェック、レシート番号発番を行う。
  - `getNextReceiptNumber` (OnCall): POS用の安全なレシート番号発番。
  - `sendOrderUpdateNotification` (Trigger): 注文ステータス変更時にFCMプッシュ通知を送信。
  - `mockAuPayPayment` (OnCall): auPay決済のデモ用モック処理。注文ステータスを `authorized` へ変更する。
  - `bulkCreateSpreadsheets` (OnCall): 既存店舗のスプレッドシートを一括作成。タイムアウト540秒設定。
  - `syncOrderToSpreadsheet` (Firestore Trigger): 注文の新規作成・更新時にスプレッドシートへ追記。

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
