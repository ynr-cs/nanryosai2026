# Google Analytics (GA4) イベントトラッキング仕様

**最終更新**: 2026-09-09 (v0.5.284)

## 概要

本プロジェクトでは Firebase Analytics (GA4) を使用し、来場者の行動データを収集する。
初期化は `main/auth.js` で一元管理（Single Source of Truth）。

> [!IMPORTANT]
> `firebaseConfig` には必ず公式の `measurementId: "G-1M5G95EXF0"` が明記されている必要があります。これがないと Firebase Web SDK が GA4 に正常接続できません（v0.5.284にて根本修正完了）。

## 実装アーキテクチャ

### 1. 共通クリックトラッキング基盤（`main/auth.js`）

`auth.js` の末尾に **イベント委譲（Event Delegation）** パターンで共通監視リスナーを設置している。

```javascript
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-track]");
  if (!target) return;
  const eventName = target.getAttribute("data-track");
  const params = {};
  for (const attr of target.attributes) {
    if (attr.name.startsWith("data-track-")) {
      const paramName = attr.name.replace("data-track-", "").replace(/-/g, "_");
      params[paramName] = attr.value;
    }
  }
  logEvent(analytics, eventName, params);
});
```

**使い方（HTML側）:**
```html
<button data-track="イベント名">ボタン</button>
<a data-track="click_project" data-track-project-id="1-1">1-1へ</a>
```
HTMLに `data-track` 属性を付けるだけで自動的にGA4に送信される。追加パラメータは `data-track-*` で設定する（ハイフンはアンダースコアに変換される）。

### 2. 個別イベント送信

`logEvent` は `auth.js` からexportされているため、他ファイルで個別のイベント送信も可能。

```javascript
import { analytics, logEvent } from "../main/auth.js";
logEvent(analytics, "purchase", { transaction_id: "...", value: 800, currency: "JPY" });
```

## 実装済みイベント一覧（v0.5.284時点 完全網羅）

### モバイルオーダー・コンバージョンファネル（`pos/mobile-order.html`）

| ステップ / 操作 | イベント名 (`data-track` / JS) | 送信場所 | パラメータ |
| :--- | :--- | :--- | :--- |
| ① チュートリアル表示 | `funnel_walkthrough` | JS `showScreen` | `step: 1〜4` |
| ② チュートリアル操作 | `click_mop_wt_next / prev / skip` | ボタン属性 | - |
| ③ 通知許諾要求 / 応答 | `request_notification_permission` / `notification_permission_result` | ボタン・JS | `result: "granted" / "denied"` |
| ④ 規約画面到達 / 同意 | `funnel_terms` / `click_mop_agree_terms` | JS `showScreen` / ボタン | - |
| ⑤ 規約全文アコーディオン | `toggle_mop_terms` | JS `toggleTermsAccordion` | `status: "open" / "closed"` |
| ⑥ 店舗一覧到達 | `funnel_view_stores` | JS `showScreen` | - |
| ⑦ 店舗カード選択 | `click_mop_store` | JS `selectStore` | `store_id`, `store_name` |
| ⑧ 準備中店舗クリック | `click_mop_offline_store` | 店舗カード | `store_id`, `store_name` |
| ⑨ メニュー画面到達 | `funnel_view_menu` | JS `showScreen` | `store_id` |
| ⑩ 商品選択（モーダル開く） | `click_mop_item` / `view_item` | カード / JS `openItemDetail` | `item_id`, `item_name`, `price` |
| ⑪ 売り切れ商品クリック | `click_mop_soldout_item` | アイテムカード | `item_id`, `item_name` |
| ⑫ カート追加 | `add_to_cart` | JS `commitAddToCart` | `item_id`, `item_name`, `price`, `quantity`, `currency` |
| ⑬ カートから削除 / 全消去 | `remove_from_cart` / `clear_cart` | JS `updateCartItemQuantity` / `clearCart` | `item_id`, `item_name` |
| ⑭ カート確認・レジへ進む | `begin_checkout_attempt` / `click_mop_checkout` | JS / ボタン | `item_count`, `total_price` |
| ⑮ 注文確認画面到達 | `funnel_checkout` | JS `showScreen` | - |
| ⑯ 注文確定（購入完了） | `purchase` | JS `finalizeOrder` | `transaction_id`, `value`, `currency`, `items[]` |
| ⑰ 注文エラー | `checkout_error` | JS `finalizeOrder` | `error_message`, `step` |

### 注文状況・ステータス（`pos/status.html`）

| 操作 | イベント名 | パラメータ |
| :--- | :--- | :--- |
| 手動更新ボタン | `click_status_manual_sync` | - |
| 店舗詳細リンク | `click_status_store_detail` | - |
| ログインボタン | `click_status_login` | - |
| 注文ステータス変更検知 | `order_status_update` | `order_id`, `status` (`pending`, `cooking`, `ready`, `completed`, `cancelled`) |

### 詳細ページ（`main/detail.html`）

| 操作 | イベント名 | パラメータ |
| :--- | :--- | :--- |
| モバイルオーダー注文ボタン | `click_order_from_detail` | `project_id` |
| マップ直行リンク | `click_detail_map_direct` | `project_id`, `room_id` |
| 全体マップリンク | `click_detail_map_general` | - |

### 企画一覧・ステージ発表（`main/projects-list.html`, `main/stage-list.html`）

| 操作 | イベント名 | パラメータ |
| :--- | :--- | :--- |
| 表示切替（グリッド/リスト） | `click_project_view_mode` | `mode: "grid" / "list"` |
| 企画カード内マップリンク | `click_project_card_map` | `project_id` |
| ステージ発表マップリンク | `click_stage_card_map` | `event_id` |
| お気に入り表示トグル | `toggle_stage_favorites` | - |
| 過去の発表表示トグル | `toggle_stage_past_events` | - |

### マイページ・アカウント（`main/account.html`）

| 操作 | イベント名 | パラメータ |
| :--- | :--- | :--- |
| ニックネーム編集 / 保存 / キャンセル | `click_account_edit_nickname` / `click_account_save_nickname` / `click_account_cancel_nickname` | - |
| UIDコピー | `click_account_copy_uid` | - |
| アカウント削除モーダル表示 / 確定 / 取消 | `click_account_menu (target: delete_account)` / `click_account_confirm_delete` / `click_account_cancel_delete` | - |
| 注文履歴カードクリック | `click_account_order_history_item` | `order_id` |
| お気に入りアイテムクリック / 解除 | `click_account_favorite_item` / `click_account_remove_favorite` | `id` |

### ログイン（`main/login.html`）

| 操作 | イベント名 | パラメータ |
| :--- | :--- | :--- |
| 在校生判定（はい / いいえ） | `click_login_student_yes` / `click_login_student_no` | - |
| 在校生注意事項確認（次へ / 戻る） | `click_login_student_confirm_next` / `click_login_student_confirm_back` | - |
| ゲスト利用選択 | `click_login_guest_login` | - |
| アカウント切替 | `click_login_switch_account` | - |
| ホーム戻るリンク | `click_login_back_home` / `click_login_guest_back_home` / `click_login_unauthorized_back_home` / `click_login_welcome_back_home` | - |
| SOKモード注文キャンセル | `click_login_sok_cancel` | - |

### ホーム・インデックス（`main/index.html`）

| 操作 | イベント名 | パラメータ |
| :--- | :--- | :--- |
| 学校案内パンフレット(PDF) | `click_pamphlet_pdf` | - |
| 公式入学希望者ページ | `click_admission_info` | - |
| UPDATESもっと見る | `click_index_updates_more` | - |

### QRコード・アクセストラッキング (`?s=`)

| イベント名 | 送信場所 | パラメータ (`source_type`) | 短縮URLパラメータ | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `qr_scan` | `auth.js` URLパラメータ解析 | `poster` | `?s=po` | 校内ポスターQR |
| | | `pamphlet` | `?s=pf` | 公式パンフレット・冊子QR |
| | | `store_front` | `?s=st` | 店頭・模擬店前掲示QR |
| | | `exhibition` | `?s=ex` | クラス・部活展示看板QR |
| | | `gate` | `?s=gt` | 校門・受付案内QR |
| | | `classroom` | `?s=cr` | Google Classroomリンク |
| | | `instagram` | `?s=ig` | 公式Instagramリンク |

### 動的・JavaScript送信イベント

| イベント名 | 対象 | 送信場所 | パラメータ |
| :--- | :--- | :--- | :--- |
| `search_project` | 検索実行時 | `projects-list.html` | `search_keyword` |
| `change_sort` | 並び替え変更時 | `projects-list.html` | `sort_type` |
| `toggle_favorites_filter` | お気に入り表示トグル | `projects-list.html`, `stage-list.html` | `status: "on" / "off"` |
| `toggle_past_events` | 過去のイベントトグル | `stage-list.html` | `status: "on" / "off"` |

## 新しいボタンをトラッキングする方法

`auth.js` がどのページにもロードされているため、HTMLに属性を追加するだけでOK：

```html
<!-- 静的HTML -->
<button data-track="click_xxx" data-track-param="value">ボタン</button>

<!-- 動的生成（テンプレートリテラル） -->
return <a href="..." data-track="click_project" data-track-project-id="">...</a>;
```

## BigQuery連携（TODO: 開催前に必須）

GA4のデータをBigQueryにエクスポートすることで、FirestoreのOrderデータと結合した高度な分析が可能。
**設定は開催前に必須（過去に遡ってデータ取得不可）。**

設定場所: Firebaseコンソール → Analytics → 「BigQueryリンク」をオン

## 検証方法

URLに `?debug_mode=1` を追加してアクセス → Firebase コンソール > Analytics > DebugView でリアルタイム確認。
