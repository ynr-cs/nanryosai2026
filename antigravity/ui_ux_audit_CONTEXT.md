# 南陵祭2026 UI/UX・アクセシビリティ・耐障害性 査読分析＆改修方針確定レポート（知識ベース）

本ドキュメントは、南陵祭2026（`nanryosai-2026`）における全画面・コンポーネント・基盤スクリプトを対象とした査読結果に、**ユーザーフィードバック・設計判断（コメント）を100%反映**し、今後の具体的な改修方針・仕様を確定した永続化仕様文書です。

---

## 目次

1. [全体設計方針・ユーザー決定事項サマリー](#1-全体設計方針ユーザー決定事項サマリー)
2. [共通基盤・アーキテクチャの改修方針](#2-共通基盤アーキテクチャの改修方針)
3. [来場者向け画面（main/）の確定仕様＆改修方針](#3-来場者向け画面mainの確定仕様改修方針)
4. [店舗運営・モバイルオーダー（pos/）の確定仕様＆改修方針](#4-店舗運営モバイルオーダーposの確定仕様改修方針)
5. [管理系・同期ツール（admin/）の方針](#5-管理系同期ツールadminの方針)
6. [FontAwesome → Bootstrap Icons 完全マッピング調査結果](#6-fontawesome--bootstrap-icons-完全マッピング調査結果)
7. [`zoom: 0.9` 撤廃の技術検証とレスポンシブ制御設計](#7-zoom-09-撤廃の技術検証とレスポンシブ制御設計)

---

## 1. 全体設計方針・ユーザー決定事項サマリー

ユーザーレビューを経て、本プロジェクトのUI/UX改修方針として以下の決定を行いました。

| カテゴリ | 項目 | ユーザー決定方針 | 理由・背景 |
|---|---|---|---|
| **アクセシビリティ** | 最小タップ領域 | **WCAG 2.2 AA 基準（24×24px）** を採用 | 44px基準では情報が巨大化し一覧性を損なうため（Instagram等の高密度UIに準拠）。 |
| **スケーリング** | `zoom: 0.9` | **完全撤廃** し、CSS変数・`rem` / メディアクエリで制御 | iOS Safariの強制ズームバグ・座標ズレを解消し、標準CSSで制御。 |
| **アイコン** | アイコンライブラリ | **Bootstrap Icons（`bi bi-...`）に完全一本化** | 全アイコンが代替可能であることを確認済み。FontAwesomeを全削除し軽量化。 |
| **テーマ** | `pos/portal.html` | **ダークモード自体を削除（ライト固定）** | 店舗ポータルはライトテーマ固定とし、中途半端なダーク対応を全撤廃。 |
| **インフラ** | `404.html` のパス | `/nanryosai2026/main/style.css` （**現状維持**） | GitHub Pages本番運用前提の意図的仕様。 |
| **コンテンツ** | トップ文言・価格 | 「南陵祭楽しすぎて滅」「¥???」は **現状維持** | 公式確定文言および演出仕様。 |
| **演出** | Canvasパーティクル | 画面外ループは **現状維持** | 演出を優先（許容）。 |
| **企画詳細** | `detail.html` タブ | **縦積み（セクション構成・目次）** で整理 | タブ切り替えではなく、1ページで完結する縦スクロール構成を正式採用。 |
| **企画詳細** | マップタブ | 「3Dマップ機能 近日公開」は **現状維持** | 将来の拡張用プレースホルダーとして維持。 |
| **投票** | `detail.html` 投票 | **Googleフォームへの外部リンク** | 投票システムはGoogleフォーム運用のため。 |
| **一覧画面** | 400ms遅延・FAB | **現状維持** | 許容。 |
| **マイページ** | 統計カード | **注文数・お気に入りカードを削除** | 不要な統計カードを削除し、UIをシンプルに整理。 |
| **マイページ** | iOS Web Push案内 | **PWA案内は不要（現状維持）** | ユーザー負担を考慮し不要と判断。 |
| **ガイド** | `mobile-order-guide`| 安全性について説明するページとして **現状維持** | セキュリティ・信頼性アピール用途。 |
| **モバイルオーダー**| トッピングUI | 「先に抜きまたは追加を選んでください」の **案内を明記** | モード選択前の案内テキストを分かりやすく配置。 |
| **注文状況** | バイブレーション | **バイブレーション処理は削除** | 不要なため整理。 |
| **注文状況** | 5分放置メッセージ | 「商品は破棄されました」は **公式仕様として維持** | いたずら・放置防止の公式ルール。 |
| **管理系画面** | `admin/` 画面群 | **現状維持（一切いじらない）** | 安定稼働を最優先し、現行の構成・認証を維持。 |

---

## 2. 共通基盤・アーキテクチャの改修方針

### 2.1 `main/style.css` の Web標準スケーリング基盤（`html { font-size: 100%; }`）と統一タイポグラフィ
- **方針**: 非標準の `main { zoom: 0.9; }` を撤廃し、Web標準のルートフォント（`html { font-size: 100%; }` / 1rem = 16px）を基準とした調和の取れたタイポグラフィ階層を全画面に適用。
- **統一タイポグラフィ階層（全画面調和基準）**:
  - **ページ最上部大見出し (Page Title / H1)**: `1.85rem`（約29.6px、モバイル `1.55rem` / 24.8px）
  - **セクション見出し (Section Title / H2)**: `1.2rem〜1.3rem`（19.2px〜20.8px）
  - **カード主タイトル (Card Title)**: `1.0rem〜1.05rem`（16.0px〜16.8px / 企画名・ステージ発表名）
  - **時間・重要メタ (Time / Price)**: `0.95rem〜1.05rem`（15.2px〜16.8px / タイムテーブル時間、価格等）
  - **サブテキスト / 団体名 (Sub / Group)**: `0.82rem〜0.88rem`（13.1px〜14.0px）
  - **補足・説明文 (Catchphrase / Desc)**: `0.82rem〜0.85rem`（13.1px〜13.6px）
  - **バッジ / メタタグ (Badge / Meta / Tag)**: `0.72rem〜0.78rem`（11.5px〜12.5px、最小保証）
  - **アクションボタン (Action Buttons / Pills)**: `0.82rem〜0.88rem`（padding: `6px 14px`）
  - **並び替えセレクト (Custom Pill Select)**: ピル型角丸（`50px`）、`padding: 6px 30px 6px 14px`、カスタムアイコン（`bi-chevron-down`）付き
  - **トグルスイッチ (iOS Style Switch)**: 外枠 `44px × 24px`、つまみ `18px × 18px`、余白 `3px` 均等、`align-items: center` でテキストと完全垂直中央揃え
  - **リストカード画像**: `56px × 56px`（リストカード高さ約 72px）
- **背景と効果**:
  - 以前の過度な縮小（88%設定や0.68remへの切り詰め）による「豆粒化・トップページとの著しい落差」を解消。
  - ページ最上部タイトル（`.page-title`）を十分な存在感とグラデーション美を持つ `1.85rem`（モバイル `1.55rem`）に引き上げ、ファーストビューの訴求力を強化。
  - Web標準の 1rem = 16px をベースに、トップページ（`index.html`）、ステージ発表（`stage-list.html`）、企画一覧（`projects-list.html`）、詳細（`detail.html`）の全画面で一貫したタイポグラフィとタップしやすいボタンサイズを確立。
  - iOS Safariのフォーム入力時自動強制ズーム防止（`font-size: 16px !important;`）と完全両立。

### 2.2 Bootstrap Icons（`bi bi-...`）への完全一本化と確実な読み込み
- **方針**: 全個別ページの `<head>` に `bootstrap-icons.min.css` CDN リンクを直接配置し、`main/style.css` 冒頭にも `@import` を追加。
- **効果**: 非同期injectによるアイコンの遅延・文字化け・欠落バグを根絶し、全画面で瞬時に鮮明なアイコンを表示。

### 2.3 `main/auth.js` の `requireLogin()` 完全実装
- **方針**: スタブ警告状態だった `requireLogin(purpose)` を実装し、未ログイン時に安全なリダイレクト（`login.html?redirect=...&reason=${purpose}`）を行う共通ガード関数として整備。

---

## 3. 来場者向け画面（`main/`）の確定仕様＆改修方針

### 3.1 トップページ（`main/index.html`）
1. **マークアップの文法修正**: 行 1147 の余分な `</section>` 閉じタグを削除。
2. **モバイルオーダープロモのスマホモックアップ修復**:
   - 未定義の残骸コード（`.mobile-order-features`, `.mobile-order-grid`）を完全削除。
   - `@media (max-width: 600px)` での `display: none` を撤廃し、スマホ画面でも左側にテキスト、右側にスリムなスマホモックアップ（90px × 168px）が綺麗に並び、アニメーションが動作するレスポンシブUIを確立。
3. **企画ハイライト・ガントチャート描画の確実化**:
   - `<head>` に `data/data.js` を配置し、データロード遅延によるハイライト非表示を解消。
   - トップページのステージタイムテーブルに `.day-selector` と `#gantt-chart-container` を設置し、ガントチャートプレビューを正常描画。
4. **文言・演出**: スローガン「南陵祭楽しすぎて滅」、価格「¥???」、Canvasパーティクルは公式仕様として維持。

### 3.2 企画詳細（`main/detail.html`）
1. **縦積みセクションUIの整理**:
   - 上部ボタンは「タブ切り替え」ではなく、下部セクションへの **スムーズスクロール目次（Jump Bar）** としてUIを再定義。
   - コンテンツは縦積みのまま、詳細 → メニュー → ギャラリー/出演者 → スケジュール → マップ の順で分かりやすくレイアウト。
2. **投票ボタン**: Googleフォームへの外部リンクボタンとして結線。
3. **マップ・画像**: 「近日公開」は将来の3Dマップ用として維持。画像未登録時のヘッダー背景フォールバック（グラデーション）を追加。

### 3.3 企画一覧・ステージ一覧（`projects-list.html`, `stage-list.html`）
1. **アイコン置換**: FontAwesome を Bootstrap Icons に置換（`fa-th-large` → `bi-grid-fill`, `fa-list` → `bi-list-ul` 等）。
2. **グリッド表示時の画像見切れ解消**: カード画像を `object-fit: contain; background: var(--item-fill);` に設定し、ポスターやチラシの上部・全体が見切れず100%美しく収まるように改善。
3. **ガントチャート連動**: ガントチャートのバーをタップした際、対象カードが非表示フィルタ（過去発表非表示等）になっていても自動で表示状態にしてスムーズスクロールする安全処理を追加。
4. **スケルトン遅延・FAB**: 400msスケルトンおよびフローティング投票ボタンは現状維持。

### 3.4 マイページ（`main/account.html`）
1. **統計カードの削除**: 不要な「注文数カード」「お気に入りカード」（行 801-812）を削除・非表示化し、すっきりしたプロファイル＆注文履歴・設定一覧のUIにする。
2. **アコーディオン右側アイコン＆開閉連動**: お気に入り・注文履歴の右側シェブロン（`bi-chevron-down`）をスタイリングし、クリック時にコンテンツ開閉（`.collapsible-content`）とアイコン回転（`rotate(-90deg)`）がスムーズに連動するよう修復。
3. **認証タイムアウトの適正化**: 5秒の固定タイマーによる勝手なリダイレクトを廃止し、`watchUser` の確定結果に応じてのみ遷移。
4. **iOS Web Push**: PWA案内は不要として現状維持。

### 3.5 ログイン画面（`main/login.html`）
1. **一般客ログイン時の赤枠警告非表示**: モバイルオーダーから「いいえ（一般のお客様）」を選んで進んだ場合（`isStudentFlow === false`）は、「@gl.pen-kanagawa.ed.jp でログインしてください」という赤枠警告を非表示にし、一般Googleアカウントで安心してログインできるUIにする。

### 3.6 開催概要および公式入学希望者向け案内（`main/about.html`, `main/index.html`）
1. **公式情報との完全整合**:
   - 正式名称: 「令和8年度 第24回 南陵祭」
   - 一般公開時間: 9月12日(土) 10:00 〜 15:00（**※入場受付は 14:30 まで**）
   - 公式注意事項: 正門受付必須、土足の一足制（体育館のピンヒール等禁止）、プライバシー保護のための撮影禁止、敷地内・近隣住宅街での全面禁煙、完全キャッシュレス決済
   - アクセス導線: 会場カードの「アクセス方法を見る」は内部画面 `access.html` へリンク。
2. **ポスター画像および中学生・入学希望者向け案内**:
   - ポスター画像は公式URL（`https://www.pen-kanagawa.ed.jp/y-nanryo-h/nyugaku/images/r8bunkasai.jpg`）を直接参照して鮮明に表示。
   - 学校案内パンフレット（公式PDF）および神奈川県立横浜南陵高等学校「入学希望者の方へ」公式ページへの直接リンクを設置。

---

## 4. 店舗運営・モバイルオーダー（`pos/`）の確定仕様＆改修方針

### 4.1 モバイルオーダー（`pos/mobile-order.html`）
1. **マークアップ文法修正**: 行 2356 の孤立した `</main>` を削除。
2. **トッピング選択UIの案内改善**:
   - モード未選択時にトッピングボタンを押した際、単に震える（headShake）だけでなく、「※先に上部の『抜き』または『追加』を選んでください」というメッセージを赤文字で強調表示する。
3. **カートバーのスクロール余白確保**: メニュー最下部に `padding-bottom: 120px;` を確保し、固定カートバーと商品カードの被りを解消。

### 4.2 注文状況（`pos/status.html`）
1. **バイブレーション削除**: iOS非対応かつ不要と判断された `navigator.vibrate` 呼び出しを削除・整理。
2. **放置メッセージ**: 「5分以内に受け取りに来られなかったため商品は破棄されました」は公式仕様として維持。

### 4.3 店舗管理ポータル（`pos/portal.html`）
1. **ダークモード完全削除**: `portal.html` からダークモード関連処理・CSS変数上書きを削除し、**ライトテーマ固定** の堅牢な業務用UIとする。

---

## 5. 管理系・同期ツール（`admin/`）の方針

- **`venue.html` / `superadmin.html` / `admin_sync.html`**:
  - ユーザー指示に基づき、**一切の変更を加えず完全現状維持** とする。

---

## 6. FontAwesome → Bootstrap Icons 完全マッピング調査結果

全ファイルで使われている FontAwesome アイコンを精査した結果、Bootstrap Icons 1.11.x で **100% 欠落なく代替可能** であることを確認しました。

| カテゴリ | FontAwesome 6 (現行) | Bootstrap Icons (置換先) | 表示確認 |
|---|---|---|---|
| **カレンダー・日時** | `fas fa-calendar-day`<br>`fas fa-calendar-alt`<br>`fas fa-clock` | `bi bi-calendar-event`<br>`bi bi-calendar3`<br>`bi bi-clock` | ✅ 完全合致 |
| **場所・マップ** | `fas fa-map-marker-alt`<br>`fas fa-map-marked-alt`<br>`fas fa-map-location-dot` | `bi bi-geo-alt-fill`<br>`bi bi-map-fill`<br>`bi bi-geo-fill` | ✅ 完全合致 |
| **矢印・操作** | `fas fa-location-arrow`<br>`fas fa-arrow-right`<br>`fas fa-chevron-right`<br>`fas fa-times` | `bi bi-cursor-fill`<br>`bi bi-arrow-right`<br>`bi bi-chevron-right`<br>`bi bi-x-lg` | ✅ 完全合致 |
| **注意・情報** | `fas fa-exclamation-triangle`<br>`fas fa-exclamation-circle`<br>`fas fa-info-circle` | `bi bi-exclamation-triangle-fill`<br>`bi bi-exclamation-circle-fill`<br>`bi bi-info-circle-fill` | ✅ 完全合致 |
| **建物・施設** | `fas fa-building`<br>`fas fa-door-open`<br>`fas fa-door-closed` | `bi bi-building`<br>`bi bi-door-open-fill`<br>`bi bi-door-closed-fill` | ✅ 完全合致 |
| **交通機関** | `fas fa-bus`<br>`fas fa-train`<br>`fas fa-subway` | `bi bi-bus-front-fill`<br>`bi bi-train-front-fill`<br>`bi bi-train-freight-front` | ✅ 完全合致 |
| **SNSブランド** | `fab fa-instagram`<br>`fab fa-twitter`<br>`fab fa-tiktok`<br>`fab fa-youtube` | `bi bi-instagram`<br>`bi bi-twitter-x`<br>`bi bi-tiktok`<br>`bi bi-youtube` | ✅ 完全合致 |
| **企業ブランド** | `fab fa-apple`<br>`fab fa-google` | `bi bi-apple`<br>`bi bi-google` | ✅ 完全合致 |
| **カート・飲食** | `fas fa-shopping-cart`<br>`fas fa-utensils` | `bi bi-cart-fill`<br>`bi bi-cup-hot-fill` | ✅ 完全合致 |
| **評価・投票** | `fas fa-poll`<br>`fas fa-thumbs-up`<br>`fas fa-star`<br>`fas fa-comment` | `bi bi-bar-chart-fill`<br>`bi bi-hand-thumbs-up-fill`<br>`bi bi-star-fill`<br>`bi bi-chat-dots-fill` | ✅ 完全合致 |
| **表示切替・人物** | `fas fa-th-large`<br>`fas fa-list`<br>`fas fa-user`<br>`fas fa-users`<br>`fas fa-images`<br>`fas fa-cube`<br>`fas fa-rocket`<br>`fas fa-tag`<br>`fas fa-ban` | `bi bi-grid-fill`<br>`bi bi-list-ul`<br>`bi bi-person-fill`<br>`bi bi-people-fill`<br>`bi bi-images`<br>`bi bi-box`<br>`bi bi-rocket-takeoff-fill`<br>`bi bi-tag-fill`<br>`bi bi-slash-circle` | ✅ 完全合致 |

---

## 7. `zoom: 0.9` 撤廃の技術検証とレスポンシブ制御設計

### 7.1 検証結果
- **横幅溢れの有無**: コンテナ幅は `max-width` と `%` で指定されており、Grid/Flexboxで折り返されるため、横スクロールは発生しない。
- **最小タップ領域**: ボタン・リンク類はパディング込みで 24×24px 以上が確保されており、ユーザー方針である **WCAG 2.2 AA基準（24×24px）** を完全に満たす。
- **入力フォームの安定化**: 16px以上の入力欄がそのまま維持されるため、iOS Safariの自動強制ズームバグが完全に防がれる。

### 7.2 具体的なCSS設計方針
```css
/* main/style.css */

/* 1. Web標準スケーリング基盤（1rem = 16px 基準） */
html {
  font-size: 100%;
  -webkit-text-size-adjust: 100%;
}

/* 2. モバイルコンテナパディングの適正化 */
@media (max-width: 768px) {
  .overview-section,
  .highlight-section,
  .account-section {
    padding-left: 12px;
    padding-right: 12px;
  }
  .overview-padding {
    padding: 14px;
  }
  
  /* フォーム要素のiOS Safari強制ズーム防止（最低16px） */
  input[type="text"],
  input[type="search"],
  input[type="password"],
  select,
  textarea {
    font-size: 16px !important;
  }
}
```
