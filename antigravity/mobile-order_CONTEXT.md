# モバイルオーダー (Mobile Order) 仕様と設計知識

このドキュメントでは、南陵祭2026プロジェクトにおける `pos/mobile-order.html`（モバイルオーダーアプリ）の仕様・レイアウト設計の重要な意思決定を記録します。

## 1. UI・レイアウト設計の基本方針 (UI/UX Architecture)

モバイルオーダー画面は、ブラウザ内で「ネイティブアプリのような挙動」を再現するための専用のレイアウト構造を持っています。

### 1.1 Fluid CSS Layout & viewport制御
過去に存在した「JavaScriptでの強制縮小 (`adjustScale()`)」は完全に廃止されました。現在は以下のCSSによる自然なフレックスレイアウトが基本です。

- `body` は `height: 100dvh`, `overflow: hidden` に設定され、ブラウザ本来のスクロールを禁止しています。
- 各画面は `#app-container` 内部の `.screen` クラス単位で管理され、`.screen` 内部で `overflow-y: auto` により個別にスクロールさせます。

### 1.2 iPhone Notch (Safe Area) と上部見切れの防止
iPhoneなどのノッチ（動的アイランド）によるUI見切れを防ぐため、`body` に対して環境変数を用いたパディングを適用しています。
```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```
これにより、「店舗を選択」や「モバイルオーダー」などのヘッダーテキストがノッチ領域に隠れる問題（上部見切れ）を防いでいます。

### 1.3 `justify-content: center` の罠
`.screen` や各ステップのコンテナにおいて、垂直方向の中央揃えを目的として `justify-content: center` を**使用してはいけません**。
画面高が足りない場合、`justify-content: center` を使うと要素が上部方向に押し上げられ、スクロール不可能な不可視領域（画面外）にはみ出してしまいます。
代わりに、余白を自動分配する `margin: auto 0` や、下部要素への `mt-auto` (margin-top: auto) を活用して、要素が溢れた際は通常の `flex-start` と同様に下スクロールで対応できるように設計しています。

### 1.4 下部固定要素 (Modal Footer / Floating Bar) の見切れ防止
モーダル（`.modal` クラス）や画面内にフローティングで配置される要素（カートバー `.bottom-cart-bar` など）は、`#app-container` の通常のスクロール制御外となる場合があります。
そのため、最下部にあるボタン（「カートに追加」「レジへ進む」等）が、画面下部のメニューバーやOSのホームインジケータと重なる問題が発生します。
これを防ぐため、以下の対応を行い安全な余白を確保しています：
- モーダルのフッター要素（`.modal-footer`）に対して、`padding: 10px 14px;`、下部安全マージンを設定。
- フローティングカートバー（`.bottom-cart-bar`）に対して、`bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 20px);` を設定。

### 1.5 UIコンパクト化と操作性の最適化 (2026-09-02 更新)
- **スクリーン余白**: `.screen` のパディングを `16px 14px`、下部余白を適正化し、スマホ画面での間延び感を解消。
- **ボタンサイズ**: `.btn-primary-custom`（`padding: 11px 18px; font-size: 0.92rem; border-radius: 12px;`）および注文確定ボタンのサイズを引き締め、操作性と視認性を両立。
- **店舗カード & トッピング**: 店舗カード（`.store-card`）のパディング・アイコンサイズ、トッピングボタン（`.topping-btn` のフォント `0.85rem`、パディング `6px 12px`）をスリム化し、一覧性とスクロール体験を向上。

### 1.6 最下部余白体系化とモーダル重複制御 (2026-09-05 更新)
- **最下部クリアランス変数の導入**:
  - `:root` に `--mobile-bottom-clearance: calc(var(--bottom-nav-height, 80px) + env(safe-area-inset-bottom, 20px) + 50px);` を定義。
  - `.screen` や `#app-container` の `padding-bottom` をこの変数で統一し、下部固定バー（`.app-bottom-nav`）の高さ変動やセーフエリアに対しても常にスクロール末尾の十分な余白を確保。
- **大量注文時のボタン埋まり防止**:
  - 注文確認画面（`#step-checkout`）末尾に `height: var(--mobile-bottom-clearance)` を持つ不可視スペーサー要素を配置。注文アイテムが多数存在しスクロールが発生した場合でも、「注文を確定する」ボタンがボトムナビの真下に埋もれることなく確実にスクロールして押下可能。
- **商品詳細・カートモーダル展開時の浮遊カートバー非表示制御**:
  - メニュー画面でカートに商品が存在する状態で商品詳細モーダル（`#itemModal`）を開いた際、浮遊カートバー（`#bottom-bar`）がモーダル下部に居座り、「カートに追加」ボタンと衝突・重なってしまう問題を解決。
  - CSS: `body.modal-open #bottom-bar { display: none !important; }` を適用。
  - JS: `itemModal` および `cartModal` の `show.bs.modal` / `hidden.bs.modal` イベントと連動させ、モーダル表示中は `#bottom-bar` を確実に非表示化し、モーダルが閉じた際にカートが空でなければ復元する二重防御を実装。

## 2. 認証とセッション管理 (Authentication)
`mobile-order.html` の認証フローは `main/auth.js` と `main/login.html` に完全統合されています（SSOT: Single Source of Truth）。

- **リダイレクト強制**: 未ログイン、または Custom Claims 在校生権限（`isEffectiveStudent(claims)`）を持たないユーザーがアクセスした場合、自動的に `../main/login.html?redirect=../pos/mobile-order.html&reason=mobile-order&mode=student` へリダイレクトされます。
- **UIの分離**: `mobile-order.html` 内部にはログイン画面やゲスト向け案内画面は存在しません。認証はすべて `login.html` が担い、本ページは「認証済みユーザー（在校生）」向けの注文機能のみに特化しています。
- **状態監視**: `auth.js` の `watchUser()` および `getClaims()` を用いて認証状態・権限をリアクティブに監視し、状態変更に応じてUIを切り替えたりリダイレクトを行ったりします。
- **個人情報非保持**: ユーザー情報保存時、メールアドレスや本名は保存せず、`lastLogin` および `fcmTokens`（配列）のみを更新します。
- ローカル開発時 (`localhost`, `127.0.0.1`) は、App Check を突破するために `config.local.js` を読み込み、共有のデバッグトークンを利用してアクセスします。

## 3. ダークモードとパフォーマンス
- 端末のシステム設定に応じたダークモードに完全対応（CSS変数 `var(--bg-color)` 等を使用）。
- **視認性の確保**: Bootstrap標準の `text-muted` や `text-secondary` などのユーティリティクラスは、ダークモード時の背景色（`#0f172a`）に対してコントラストが不足する場合がある。
  - 設計指針として、説明テキストや補助的な情報にはプロジェクト独自のCSS変数 `var(--text-sub)` (#94a3b8) を使用し、`.text-sub-custom` 等のクラスで一貫した視認性を担保する。
- JavaScriptによる不必要なリサイズ計算や描画のブロックを廃止し、パフォーマンスを向上させています。

## 4. 注文確定フロー (Order Creation)

設計憲法§5.1に準拠した注文フローの仕様（フェーズ3にて確定）。

### 4.1 カート管理方針

- **カートはローカル変数（メモリ上）のみで管理する。**
- Firestoreへのカートデータの書き込みは**禁止**（`users/{uid}/cart` コレクションへのアクセスは廃止済み）。
- `writeBatch` および関連するFirestoreカート操作はコードに含めてはならない。

### 4.2 注文確定の実装

注文確定時（`finalizeOrder` 関数）は `createOrder` Cloud Function を直接呼び出す：

```javascript
const createOrderFn = httpsCallable(functions, "createOrder");
const result = await createOrderFn({
  orderChannel: "mobile",
  storeId: currentStoreId,
  items: cart.map((c) => ({
    itemId: c.productId,  // ※ Firestore の items コレクションの ID
    quantity: c.quantity,
    customizations: c.customizations || [],
  })),
});
// result.data = { success: true, orderId: "...", receiptNumber: 7001, ... }
window.location.href = `status.html?orderId=${result.data.orderId}`;
```

### 4.3 items フィールドのマッピング

`cart` 配列の各要素と Cloud Function に渡す `items` 要素のフィールド名マッピング：

| cart の属性 | createOrder の items フィールド | 説明 |
|---|---|---|
| `c.productId` | `itemId` | FirestoreのitemsドキュメントID |
| `c.quantity` | `quantity` | 数量 |
| `c.customizations` | `customizations` | カスタマイズ配列（`{mode, target}` 形式） |

`name`, `price` はサーバー側（Cloud Function）が Firestore の `items` コレクションから取得し、スナップショットとして注文に記録する。クライアントからは**送らない**。

## 5. SOK (セルフオーダーキオスク) の設計
設計憲法§5.2に基づく、混雑解消・来場者向けのキオスクシステム仕様。

### 5.1 アーキテクチャの分離
- **`pos/sok.html` (iPad用)**:
  - スタッフ認証必須。`portal.html` から起動。
  - 初期表示は「スタートアップ画面」（「SOKを起動する」ボタン押し込みで全画面表示＆ライトテーマで動作）。
  - レイアウトはiPad向けSplit View（左：メニュー一覧 / 右：リアルタイムカート＆注文確認）で固定表示。
  - 画像非設定時/ロードエラー時は `noimage.png` を `object-fit: contain` で枠内に綺麗に収めて表示。
  - カート機能・トッピングカスタマイズ等のUXはモバイルオーダーと同等。
  - 「注文を確認する」ボタン押下時、`createSokProvisional` 関数を呼び出し、`status: null`, `sokStatus: pending` の仮注文ドキュメントを作成。QR生成ライブラリは `cdnjs` 経由で取得。
  - 20秒でQR表示後、確認モーダル（10秒）を経て自動リセット。
- **`pos/sok.css` に関する制約（将来の時限爆弾）**:
  - `sok.css` のスコープ化は `html, body, *` のみ `[data-sok]` 対応としており、`.app-header` などのクラスはグローバルのままです。
  - 現在は `login.html` で `mode=sok` の時のみ動的ロードしているため通常モードへの影響はありませんが、将来的に `sok.css` を常時ロードする仕様に変更した場合、デザインが即座に破綻する点に注意してください。

- **`pos/sok-to.html` (来場者スマホ用) と往復リダイレクト型ログイン**:
  - 対話アニメーション型UX（1画面内でシームレスに遷移）。
  - **Step 1 (未ログイン可能)**: QRからアクセス直後に注文内容を表示。ユーザーに安心感を与える。その後、「この内容でOK」タップで `login.html?mode=sok` へリダイレクト。
  - **Step 2 (login.html 側)**: `mode=sok` 専用のログイン画面（SOKデザインで描画、app-shell抑制）が表示され、ユーザージェスチャーとして「Googleでログイン」ボタンを押させる（ポップアップブロック回避のため）。ドメインチェックなしで全Googleアカウントを許可し、認証成功後は元の `sok-to.html` へクエリを維持して戻る。
  - ログイン後自動的に `claimSokOrder` を呼び出し（`sokStatus: claimed` へ昇格）、トランザクションで二重読み取りを防止。
  - **Step 3 / 4**: 規約同意と通知設定を経て `confirmSokOrder` で確定。ここで初めて受付番号が発番され、`status: cooking` へ移行し通常注文フローに合流する。
  - 確定後2.5秒のディレイで `status.html` へ遷移。

### 5.2 安全性の確保
- **フロントエンドのエラー耐性**: `pos/status.html` は `status: null` や `sokStatus: expired` などの一時的・失効ステータスのオーダーを受け取ってもクラッシュしないよう、エラーハンドリング（nullチェック）が実装されている。
- **タイムアウト処理**: Firebase側の Scheduled Function (`expireSokOrders`) により、作成から5分経過した仮注文は自動的に `expired` になり無効化される。QRコードスキャンの遅延や放置による不正注文を防ぐ。

## 6. 公式利用ガイド・安心解説 (`main/mobile-order-guide.html`) (2026-09-05 更新)

来場者および生徒向けに、オーダーシステムの利用手順と安心・安全の仕組みを分かりやすく解説する公式ページ。
従来の論文調（技術コード掲載中心）から、`main/privacy.html` と同一のデザインシステム（カードUI、ヘッダーグラデーション、Bootstrap Icons、完全レスポンシブ・ダークモード対応）を採用した親しみやすいガイドに全面改訂された。

- **構成**:
  1. **第1部：一般来場者向け（SOKキオスク）**: 店頭iPad（`pos/sok.html`）での選択・自動リセット、スマホ（`pos/sok-to.html`）での未ログイン確認、一般Googleアカウントログインと二重読み取り防止クレーム（`claimSokOrder`）、放置QRの自動失効（5分タイマー）。
  2. **第2部：在校生向け（モバイルオーダー）**: スマホ最適化 Fluid CSS Layout（`pos/mobile-order.html`）、アクティブ注文検知による二重注文防止、直前リアルタイム営業・在庫再検証、メモリ完結カートとACIDトランザクション決済（`createOrder`）。
  3. **第3部：共通の安心・安全設計**: 個人情報ゼロ設計（不可逆暗号HMAC-SHA256ハッシュ匿名ID、`main/auth.js`）、電波切れ・画面スリープからの多層防御自動同期リカバリ（`pos/status.html`）、受取呼出モニター（`pos/monitor.html`）と5分タイマー、Firebase App Check & 厳格なセキュリティルールによる不正排除。

## 7. 店舗オペレーションと注文〜提供フロー設計 (2026-09-05 確定)

非技術者（生徒・模擬店スタッフ・来場者）にもわかりやすい現場オペレーションの標準フロー：

- **3系統の注文受付**: モバイルオーダー（在校生スマホ）、店頭セルフオーダー（店頭iPad＋スマホQR）、対面レジ（店頭口頭注文）
- **厨房オペレーション**: キッチン（調理 →「調理完了」）とプレゼンター（トッピング盛り付け仕上げ →「呼び出し」）の2段階分担
- **店頭呼出＆決済**: 店頭呼出モニター（iPad）およびスマホ画面での呼出、受取カウンターでの受付番号提示・AirPay端末決済・「受取完了」押下による商品引き渡し

## 8. 2026年度 先行試験運用とプロモーション設計 (2026-09-05 更新)

学校現場におけるシステムの確実な安定稼働と安全検証のため、2026年度のモバイルオーダー・キオスク運用は以下のプロモーション・広報方針を適用する：

- **3年1組「アキコのひとくちカステラ」限定での先行試験運用**:
  - 全店舗一斉導入ではなく、校内公募で熱意ある要望をいただいた3-1とのタッグによるパイロット運用。
  - 来場者や生徒が「すべての模擬店で使える」と誤解することを防ぐため、トップページ（`main/index.html`）および公式ガイド（`main/mobile-order-guide.html`）で対象店舗（3年1組）を明確に告知。
- **利用窓口の大型強調表示**:
  - **在校生**: スマートフォンからの事前注文（学校Googleアカウント限定）。
  - **一般来場者**: 3-1店頭の注文端末（セルフオーダーキオスクiPad）を利用。
  - トップページのプロモセクション内に専用の大型強調案内枠（`.promo-notice-box`）を設け、黄色ハイライトと太字で視覚的に明記。
- **UI・ビジュアル連動**:
  - アクションボタンを「在校生はこちら（モバイルオーダー）」とし、一般の方のログイン混乱を防止。
  - スマホモックアップ内のスライドショーをカステラメニュー（プレーン・チョコ・抹茶）に統一し、3-1とのコラボレーションを直感的に伝達。
- **店舗選択画面における店頭注文（対象外）団体の一覧とお詫び案内**:
  - `pos/mobile-order.html` の店舗選択画面（`#step-stores`）において、モバイルオーダー対応店舗の下部に、その他の調理・食品団体（`category: 'food' && !p.useMobileOrder`）に関するお詫び・案内ボックス（`.offline-stores-notice`）を設置。
  - 「以下の団体はモバイルオーダーに対応しておりません。大変恐れ入りますが、直接各店舗（店頭）までお越しいただき、ご注文をお願いいたします」と丁寧に案内。
  - その直下に、店頭注文の調理・食品団体（3年2組、3年3組、茶道部等）の一覧カード（`.offline-store-card`）を動的生成し、「モバイルオーダー不可」バッジと開催場所（教室・テント）を表示。カードタップ時に該当団体の企画詳細ページ（`../main/detail.html?id=XXX`）へ直接遷移し、メニューや紹介・場所を確認できる。
  - ※テスト検証用モックとして、1年1組（`id: "101"`）は `useMobileOrder: true` を維持。

## 9. 在校生モバイルオーダー向けオンボーディング・ウォークスルー仕様 (2026-09-05 更新)

現場オペレーションの混乱（「注文後に遠くへ行ってしまい受け取れない」「5分経過で廃棄された」等のトラブル）を防止するため、ログイン完了後・規約同意前のタイミングで `pos/sok-to.html` と同等のスライド型ウォークスルー（`#walkthrough`）を導入：

- **表示タイミング & フロー制御 (`proceedToTerms`)**:
  - モバイルオーダー画面へのアクセス時、規約同意に進む前に**毎回自動展開**。
  - スキップしたいユーザーは右上の「スキップ」ボタンをタップすると、説明（Slide 1〜4）をスキップして**直接 Slide 5（規約同意）へジャンプ**し、同意チェックを確実に通過させる。
- **AppShell（グローバルヘッダー・ボトムナビゲーション）との共存仕様**:
  - `#walkthrough` の `z-index` は `950`（AppShell の `.app-header` や `.app-bottom-nav` の `1000` より背面）に設定。
  - 上端は `top: calc(var(--header-height, 60px) + env(safe-area-inset-top, 0px))` とし、グローバルヘッダーの真下から開始することでロゴやハンバーガーメニューとの干渉を物理的に排除。
  - 左上のブランド表示（「南陵祭'26 モバイルオーダー」）はヘッダーと重複するため削除し、ヘッダー直下の右上に押しやすいピル型「スキップ」ボタンを配置。
  - 下端は `padding-bottom: calc(var(--bottom-nav-height, 70px) + env(safe-area-inset-bottom, 20px) + 24px)` を確保し、**ホーム・企画・オーダー・ステージ・アカウントのボトムナビが最前面に残り、ウォークスルー表示中もいつでも自由にタブ遷移可能**とする。
- **スライド構成（全5枚）と規約完全統合**:
  1. **ようこそ**: 並ばずにスマホで注文！できたてを受け取り。
  2. **STEP 1**: メニューを選んでカートに追加（3年1組「アキコのひとくちカステラ」）。
  3. **STEP 2**: **注文確定したら団体の前へ移動！**（校内を離れてしまう誤解を防ぎ、3-1店頭近くで待機することを明記）。
  4. **STEP 3**: **番号提示で受取＆お支払い**（Airペイ端末によるキャッシュレス決済限定。**現金決済は利用不可**）。
  5. **IMPORTANT (利用規約同意)**:
     - 呼出から5分で自動廃棄（キャンセル・返金不可）
     - 完全キャッシュレス（現金不可）
     - 不正・迷惑行為は全サービスから永久BAN
     - **同意チェックボックス (`#wt-check-terms`)**: チェックを入れるまで次へボタン（`#wt-next`）が disabled となり進行不可。
- **2重表示の完全解消と直接遷移**:
  - Slide 5 でチェックを入れて「同意して注文へ進む」を押すと、中間画面 `step-terms` を介さず**直接店舗一覧・メニュー画面（`loadStores()`）へ遷移**。規約確認が2回発生する冗長性を完全に解消。
- **DOM構造・オーバーレイ独立性の重要規約**:
  - `#error-overlay`、`#walkthrough`、`<main id="app-container">` はそれぞれ独立した兄弟要素でなければならない。
  - `#error-overlay` は通常時 `display: none;` であるため、閉じタグが欠落して後続の `#walkthrough` や `#app-container` を内包してしまうとアプリ全画面が不可視化（真っ黒）になる。タグ整合性の維持を厳格に順守すること。

