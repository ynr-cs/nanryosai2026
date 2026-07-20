# Google Analytics (GA4) イベントトラッキング仕様

**最終更新**: 2026-07-21 (v0.4.36)

## 概要

本プロジェクトでは Firebase Analytics (GA4) を使用し、来場者の行動データを収集する。
初期化は `main/auth.js` で一元管理（Single Source of Truth）。

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

## 実装済みイベント一覧（v0.4.36時点）

### コンバージョンファネル（最重要）

| ステップ | イベント名 | 送信場所 | パラメータ |
| :--- | :--- | :--- | :--- |
| ① ログインボタン押下 | `click_login` | `login.html` | `method: "Google" / "Guest"` |
| ② ログイン完了 | `login` | `auth.js` | `method: "Google"` |
| ③ 規約画面到達 | `funnel_terms` | `mobile-order.html` showScreen | - |
| ④ 店舗一覧到達 | `funnel_view_stores` | `mobile-order.html` showScreen | - |
| ⑤ メニュー画面到達 | `funnel_view_menu` | `mobile-order.html` showScreen | - |
| ⑥ 店舗選択 | `select_store` | `mobile-order.html` selectStore | `store_id`, `store_name` |
| ⑦ カート追加 | `add_to_cart` | `mobile-order.html` commitAddToCart | `item_id`, `item_name`, `price`, `quantity`, `currency` |
| ⑧ 確認画面到達 | `funnel_checkout` | `mobile-order.html` showScreen | - |
| ⑨ 注文確定 | `purchase` | `mobile-order.html` finalizeOrder | `transaction_id`, `value`, `currency`, `items[]` |

### QRコード流入（既存）

| イベント名 | 送信場所 | パラメータ |
| :--- | :--- | :--- |
| `qr_scan` | `auth.js` URLパラメータ解析 | `source_type: "poster" / "pamphlet" / "store_front" / "classroom" / "instagram"` |

### サイト内UI操作（data-track属性ベース）

| イベント名 | 対象 | 主な場所 |
| :--- | :--- | :--- |
| `click_nav_home/projects/order/stage/account` | ボトムナビ各タブ | `app-shell.js` |
| `click_venue` | リアルタイム情報カード | `index.html` |
| `click_mop_promo` | MOPプロモボタン | `index.html` |
| `click_gantt_day` | ガントチャートDAYボタン | `index.html` |
| `click_stage_day` | ステージDAYボタン | `stage-list.html` |
| `click_project_highlight` | 企画ハイライトカード | `index.html` |
| `click_stage_highlight` | ステージハイライトカード | `index.html` |
| `click_project` | 企画カードタイトル | `projects-list.html` |
| `click_detail` | 詳細ボタン | `projects-list.html` |
| `click_order_from_list` | オーダーボタン | `projects-list.html` |
| `click_favorite` | お気に入りボタン（企画） | `projects-list.html` |
| `click_favorite_stage` | お気に入りボタン（ステージ） | `stage-list.html` |
| `click_filter_grade` | 学年フィルター | `projects-list.html` |
| `click_filter_type` | ジャンルフィルター | `projects-list.html` |
| `click_gantt_event` | ガントチャートイベントバー | `index.html` (`event_id`, `time`, `place`等) |
| `click_gantt_popup_detail` | ガントチャートポップアップ詳細リンク | `index.html` (`event_id`, `time`, `place`等) |
| `close_gantt_popup` | ガントチャートポップアップ閉じる | `index.html` |
| `click_section_more` | 各セクションの「すべて見る」リンク | `index.html` (`section`名) |
| `click_stage_detail` | ステージ一覧の「詳細を見る」 | `stage-list.html` (`event_id`, `time`, `place`等) |
| `click_floating_vote` | フローティング投票ボタン | `projects-list.html`, `stage-list.html` |

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
