# 南陵祭 2026 POS システム解析レポート

## 1. システム概要

本システムは、南陵祭 2026 向けに構築された分散型 Web POS システムです。
Firebase (Firestore, Auth, Functions) をバックエンドに採用しており、注文受付から調理、提供、顧客呼び出しまでのフローをリアルタイムに連携させることが可能です。
SPA (Single Page Application) ライクな構成ですが、ビルド不要の Vanilla JS (ES Modules) で記述されており、保守性が高くシンプルな構成となっています。

## 2. モジュール構成と役割 (ファイル別)

`pos/` ディレクトリ内の主要 HTML ファイルの役割は以下の通りです。

| ファイル名         | 役割・機能概要                                                                                                                                                                               | 対象ユーザー         |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------- |
| **portal.html**    | **[管理・入口]**<br>・Google 認証および店舗ログイン<br>・各機能(POS, Kitchen 等)へのリンク生成<br>・商品メニューの登録・編集・削除 (画像アップロード含む)<br>・商品の品切れ/販売再開切り替え | 店舗責任者<br>管理者 |
| **pos.html**       | **[レジ]**<br>・対面注文の入力<br>・トッピング(No/Add)対応<br>・Cloud Functions を用いたユニークなレシート番号の発行<br>・注文データ送信 (`unpaid_at_pos`)                                   | レジ担当             |
| **kitchen.html**   | **[厨房・KDS]**<br>・調理待ち注文のリアルタイム表示<br>・調理完了処理 (`ready_to_serve`へ更新)<br>・新規注文時の通知音 (Web Audio API)<br>・提供履歴の確認                                   | 厨房スタッフ         |
| **presenter.html** | **[提供口・呼び出し]**<br>・調理完了品の確認<br>・顧客呼び出し (`ready_for_pickup`へ更新)<br>・受渡完了処理 (現金/QR/オンライン)<br>・緊急キャンセル機能                                     | 受渡担当             |
| **monitor.html**   | **[客用モニター]**<br>・呼び出し中のレシート番号を大画面表示<br>・客自身による番号入力とステータス確認<br>・セルフ受取完了処理 (モバイル/事前決済注文のみ)                                   | 来場者 (客)          |
| **simulator.html** | **[開発・テスト用]**<br>・モバイルオーダーや券売機(SOK)からの注文をシミュレート発行<br>・`authorized` ステータスの注文を生成                                                                 | 開発者               |

## 3. 業務フローとデータステータス遷移

注文データ (`orders` コレクション) の `status` フィールドが業務の進行状態を管理しています。

### ステータス遷移図

1.  **注文発生 (Entry)**

    - **POS**: `status: "unpaid_at_pos"` (レジ入力)
    - **Mobile / SOK**: `status: "authorized"` (事前決済・承認済み)
    - ※ `kitchen.html` はこれら両方のステータスを「調理待ち」として表示します。

2.  **調理完了 (Cooked)**

    - **Kitchen** で「完了」ボタン押下
    - -> `status: "ready_to_serve"`
    - ※ `presenter.html` に「呼び出し待ち（準備完了）」として表示されます。

3.  **呼び出し (Call)**

    - **Presenter** で「呼び出し」ボタン押下
    - -> `status: "ready_for_pickup"`
    - ※ `monitor.html` の呼び出し番号リストに表示されます。

4.  **受取完了 (Done)**
    - **Presenter** (手渡し) または **Monitor** (セルフチェック) で完了操作
    - -> `status: "completed_at_store"` (店舗で完了) または `"completed_online"`
    - ※ 取引終了。履歴として残ります。

## 4. データベース設計 (Firestore Schema)

主なコレクション構造は以下の通りです。

### `stores` (店舗情報)

- Document ID: 自動または手動 ID
- `teamName`: 団体名 (例: 3 年 1 組)
- `name`: 店舗名 (例: 焼きそば屋)
- `password`: 簡易ログイン用パスワード

### `items` (商品マスタ)

- `storeId`: 紐付く店舗の ID
- `name`: 商品名
- `price`: 価格 (Number)
- `description`: 説明文
- `imageUrl`: Firebase Storage の画像 URL
- `allowedToppings`: 文字列配列 (可能なトッピング)
- `isAvailable`: Boolean (売り切れフラグ)
- `isRecommended`: Boolean (おすすめフラグ)

### `orders` (注文トランザクション)

- `storeId`: 店舗 ID
- `receiptNumber`: レシート番号 (連番)
- `items`: 注文商品リスト (配列)
  - `productId`: 商品 ID
  - `name`, `price`, `quantity`
  - `customizations`: トッピング情報 (`mode`: "ADD"/"NO", `target`: "マヨネーズ" 等)
- `totalPrice`: 合計金額
- `status`: 現在のステータス文字列
- `paymentMethod`: "cash", "qr", "online", "kiosk" 等
- `isPrepaid`: Boolean (モバイル/券売機の場合 true)
- `createdAt`: 作成日時 (ServerTimestamp)
- `completedAt`: 完了日時
- `updatedAt`: 更新日時

## 5. 技術・実装の特徴

- **リアルタイム同期**:
  - `onSnapshot` を使用し、データベースの変更を全クライアントへ即座に反映させています。ポーリング(定期リロード)ではないため、遅延の少ないスムーズなオペレーションが可能です。
- **認証 (Authentication)**:
  - Firebase Auth (Google Sign-In) を必須としています。開発者やスタッフは Google アカウントでログインしないとデータを読み書きできません。
  - `portal.html` では `localStorage` に店舗 ID を保存し、セッション維持のような挙動を実現しています。
- **サーバーレス (Serverless)**:
  - `getNextReceiptNumber` は Firebase Cloud Functions (Callable) として実装されており、排他制御のかかった連番発行を行っていると推測されます。
- **UI/UX**:
  - **POS**: タッチ操作に最適化された大きなボタン、長押し防止、連打防止のローディング表示。
  - **Monitor**: 視認性の高い巨大な番号表示、キーパッド入力。
  - **Kitchen/Presenter**: 視覚的なステータス色分け、通知音によるオペレーション補助。

以上が現在の POS システムの詳細な解析結果です。
