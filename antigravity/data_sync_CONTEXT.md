---
title: データ同期アーキテクチャ分析レポート
tags: [infra, context, spec]
status: active
last_updated: 2026-09-05
---

# データ同期アーキテクチャ分析レポート

本ドキュメントは、`data.js`、`admin_sync.html`、および Firebase (Firestore) 間のデータ同期メカニズムに関する詳細な分析結果です。`antigravity/main/[[data_CONTEXT]]` および [[architecture_CONTEXT]] の内容も統合されています。

> [!IMPORTANT]
> ## データ設計の基本原則 (2026-04-20 確定)
> 
> `projectData` と `stageData` の役割は**完全に分離**されています。
> 
> | データ | 役割 | スケジュール情報 |
> |:---|:---|:---|
> | `projectData` | 団体マスタ（名前・場所・説明・メニュー等） | **持たない** |
> | `stageData` | ステージ出演スケジュールの**唯一の情報源 (SSOT)** | **ここで一元管理** |
> 
> **NG**: `projectData` に `schedule` プロパティを追加すること。
> **OK**: ステージ団体を追加する場合は、`stageData` にのみ出演枠を追加する。


## 1. 全体像と役割分担

本システムのデータ管理は、開発効率と本番運用のバランスを取るため、以下の3層構造を採用しています。

| 層               | コンポーネント         | 役割                                                          | 永続性         |
| :--------------- | :--------------------- | :------------------------------------------------------------ | :------------- |
| **開発/マスタ**  | `main/data/data.js`    | 開発用シードデータ、コードベース管理される正本。Git管理対象。 | **Static**     |
| **ブリッジ**     | `main/admin_sync.html` | `data.js` と Firestore を手動または自動で同期する管理ツール。 | Temporary      |
| **開発サーバー** | `admin-server.js`      | `npm run admin` で起動。`data.js` の自動保存APIを提供。       | **Local Tool** |
| **本番運用**     | **Firestore**          | アプリ (`mobile-order.html`) が実際に参照するデータソース。   | **Dynamic**    |

## 2. 同期の詳細仕様

### 自動同期ワークフロー (Auto Sync)

`admin_sync.html` の「💾 一括保存＆同期」ボタンを使用することで、以下の操作がワンクリックで完了します。

1. **ローカル保存**: `admin-server.js` (Express) の API を経由して、ブラウザ上の編集内容を `main/data/data.js` に直接書き込みます。
2. **Firestore同期**: 続いて `syncStores` および `syncItems` が走り、Firestore 上のデータも最新状態に更新されます。

> [!IMPORTANT]
> この機能を使用するには、ローカルで `npm run admin` (ポート 3001) を実行している必要があります。通常の静的ファイル配信や Firebase Hosting 上ではローカルファイル保存は動作しません。

**重要:** `data.js` の全てのデータが Firestore に同期されるわけではありません。用途（モバイルオーダー）に必要なデータのみが選択的に同期されます。

### A. 店舗情報 (`syncStores`)

`data.js` の `projectData` から Firestore `stores` コレクションへの同期。

- **同期対象:** `useMobileOrder: true` の団体のみ。
  - 展示 (`exhibit`)、ステージ (`stage`)、物販 (`shop`) のみの団体や、食品でも現金手売りのみ (`useMobileOrder: false`) の団体は Firestore には同期されません。
  - **注意**: 以前は `contentType: 'menu'` で判定していたが、メニュー表示UIを使う非モバイルオーダー団体（茶道部・美術部等）が誤同期される問題があり、2026-07-09 に `useMobileOrder` フラグに移行しました。
- **フィールドマッピング:**
  - 以下のようにフィールド名が変換、または**除外**されます。

| data.js (`projectData`) | Sync Logic (`admin_sync.html`) | Firestore (`stores`) | 備考                          |
| :---------------------- | :----------------------------- | :------------------- | :---------------------------- |
| `id`                    | (`doc.id` として使用)          | **Document ID**      | 例: `301`, `brass`            |
| `groupName`             | `→`                            | `name`               | **名称変更** (例: 3年1組)     |
| `name`                  | `→`                            | `teamName`           | **名称変更** (例: やきそば屋) |
| `description`           | `→`                            | `description`        |                               |
| `loginId`               | `→`                            | `loginId`            |                               |
| `place`                 | **除外**                       | -                    | モバイルオーダーでは未使用    |
| `floor`                 | **除外**                       | -                    | モバイルオーダーでは未使用    |
| `catchphrase`           | **除外**                       | -                    | Web広報用（同期対象外）       |
| `tags`                  | **除外**                       | -                    | Web広報用（同期対象外）       |
| `schedule`              | **除外**                       | -                    | Web広報用（同期対象外）       |
| `image` (廃止)          | **参照なし**                   | -                    | `images/{id}.png` を自動解決  |

### B. メニュー情報 (`syncItems`)

- **完全洗い替え**: 指定店舗 (`storeId`) に紐づく `items` ドキュメントは、同期時に**一度すべて削除され、`data.js` の内容で再作成**されます。Firsestore 上での手動編集は保存されません。
- **価格データ**: 文字列（`"300円"`）から数値（`300`）への変換が行われます。
- **商品画像**: `data.js` に `imageUrl` (Firebase Storage URL) が含まれている場合は同期されます。

### C. パスワード管理 (`store_secrets`)

- `data.js` にはパスワードを含みません（セキュリティリスク回避）。
- `admin_sync.html` 上の機能で、Cloud Functions を経由して Firestore `store_secrets` コレクション（管理者のみ読み書き可）に設定します。
- **一括同期**: テスト環境構築用として、全店舗のパスワードを `storeId` と同じ値にリセットする機能があります。

## 3. 画像管理ワークフロー (Image Management)

画像の種類によって、管理方法と保存場所が異なります。

| 種類             | 保存場所              | ファイル形式 | 管理／アップロード方法                                                                                                                                                             |
| :--------------- | :-------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **店舗アイコン** | ローカル (`/images/`) | `ID.png`     | Git管理。開発者が手動で `nanryosai-2026/images/` フォルダに配置・コミットする。アプリは `images/{id}.png` を自動参照。                                                             |
| **商品写真**     | Cloud Storage         | `.webp`      | **店舗ポータル (`pos/portal.html`)** または **`admin_sync.html` (メニュー編集)** 経由でアップロード。クライアントで圧縮・変換され、Storage URL が Firestore `items` に保存される。 |

### 商品写真運用の注意点

- `admin_sync.html` で「Firestore同期 (メニュー)」を実行すると、Firestore 上の `items` が再作成されるため、**ポータルでアップロードした写真のリンク情報が一時的に消えるリスク**があります。
- **正しい運用フロー**:
  1.  `data.js` でメニューの基本情報（名前・価格）を定義＆同期。
  2.  各店舗がポータル (`pos/portal.html`) にログインし、写真をアップロードする、あるいは管理者が `admin_sync.html` からアップロードする。
  3.  **重要**: 将来的に `data.js` を更新する際は、`admin_sync.html` で「現在のモードから読込」または「本番から読込」を実行し、Firestore から最新データ（写真URL含む）をマージしてから `data.js` を再生成（出力）・コピペする必要があります。そうしないと、写真リンクが消失します。

## 4. 運用・開発フローに関する知見

### ID 命名規則 (2026年度版)

- **クラス**: `301` などの数値文字列。
- **部活**: `kado` (華道), `keion` (軽音) などの英単語 ID。
  - ※ 旧仕様（`900` 番台）から変更されています。

### 画像の扱い

- 以前は `data.js` に `image` プロパティがありましたが、現在は廃止されています。
- フロントエンド (`mobile-order.html`) は `images/{id}.png` を自動的に参照します。同期時に画像パスデータは Firestore に保存されません。

### テスト環境 (`_test` コレクション)

- `admin_sync.html` の「テストモード」チェックボックスにより、同期先を `stores_test`, `items_test` に切り替え可能です。
- 「本番から読込」機能を使うことで、本番データ (`stores`) を一旦ローカルに取り込み、テストモードで同期することで、安全にテストデータを作成できます。

## 5. 結論

- **モバイルオーダーアプリは Firestore 依存**: アプリの動作確認には Firestore へのデータ同期が必須です。
- **情報の一元管理は `data.js`**: マスタデータはコードベースで管理されていますが、同期ロジックによる「フィルタリング（情報の切り捨て）」があることを認識しておく必要があります。
- **データフローの双方向性**: 基本は `data.js` -> Firestore ですが、商品写真のみ Firestore (Portal) -> `data.js` (Export) という逆流が必要になります。

---

## 6. データ読み込み待機パターン (Wait for Data Load)

`data.js` は巨大なファイルであり、ブラウザによるパースが完了して `window` オブジェクト（`window.projectData` や `window.stageData`）が利用可能になる前に、他のスクリプトが初期化を開始してしまうリスクがあります。

### `ensureData()` パターン (2026-04-20 導入)

`ReferenceError` を防ぎ、データ準備完了を待機するための再帰的チェックパターンです。

```javascript
/**
 * 外部読み込みの data.js が準備できるまで待機する
 */
async function ensureData(target = "stageData") {
  return new Promise((resolve) => {
    const check = () => {
      if (window[target]) {
        resolve(window[target]);
      } else {
        console.log(`Waiting for ${target}...`);
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// 使用例
async function init() {
  const data = await ensureData("stageData");
  populateUI(data);
}
```

このパターンにより、スクリプトの配置順序やネットワーク遅延に関わらず、確実にデータが存在する状態でUIを構築できます。

---

## 7. イベントリスナーの重複防止 (Double-Listener Prevention)

シングルページアプリケーション（SPA）風の画面遷移や、ログイン・ログアウトの繰り返しを伴う画面では、`window.onAuthStateChanged` 等の中でイベントリスナーを登録すると、遷移のたびにリスナーが増殖するバグが発生します。

- **解決策**: `isListenersAttached` 等のフラグ変数を導入し、一度登録したら二度目はスキップするガード節を設けること。

---

## 8. stageData の完全保持・消失防止仕様 (2026-09-05 改修)

`data.js` 保存時および JSON 出力時における `stageData`（ステージ出演枠マスタ）の消失事故を防止するため、以下の防護機構が実装されています。

### 改修の背景
従来の `admin-server.js` および `admin_sync.html` の `generateJSON` / `saveAllWithSync` では、`const stageData = [];` と空配列がハードコードされていたため、管理画面から保存・出力を行うと手動登録されたステージマスタ（全25枠）が空で上書きされる致命的な問題がありました。

### 実装された二重防護機構
1. **クライアント側 (`admin_sync.html`)**:
   - `saveAllWithSync`: `window.stageData` を取得し、`/api/save-data` への POST リクエストペイロードに `stageData` として含めて送信する。
   - `generateJSON`: `window.stageData` をシリアライズして出力コードに埋め込み、末尾に `window.stageData = stageData;` も含める。
2. **サーバー側 (`admin-server.js`)**:
   - リクエストボディに `stageData` が配列として存在すればそれを優先保存する。
   - 万が一リクエストに含まれない、または空配列だった場合でも、サーバー上の既存 `main/data/data.js` から正規表現で既存の `stageData` を抽出し、空で上書きせず維持する（二重フェイルセーフ）。
   - 末尾に `window.projectData = projectData; window.stageData = stageData;` を確実に書き出す。

## 参照ファイル

- `main/data/data.js`
- `main/admin_sync.html`
- `admin-server.js`
- `pos/mobile-order.html`
- `pos/portal.html` (商品画像アップロード)
