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
- モーダルのフッター要素（`.modal-footer`）に対して、`padding-bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 20px) !important;` を設定。
- フローティングカートバー（`.bottom-cart-bar`）に対して、`bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 20px);` を設定。

## 2. 認証とセッション管理 (Authentication)
`mobile-order.html` の認証フローは `main/auth.js` と `main/login.html` に完全統合されています（SSOT: Single Source of Truth）。

- **リダイレクト強制**: 未ログイン、または許可されていないドメイン（非在校生アカウント）でアクセスした場合、自動的に `../main/login.html?redirect=../pos/mobile-order.html&reason=mobile-order&mode=student` へリダイレクトされます。
- **UIの分離**: `mobile-order.html` 内部にはログイン画面やゲスト向け案内画面は存在しません。認証はすべて `login.html` が担い、本ページは「認証済みユーザー（在校生）」向けの注文機能のみに特化しています。
- **状態監視**: `auth.js` の `watchUser()` を用いて認証状態をリアクティブに監視し、状態変更に応じてUIを切り替えたりリダイレクトを行ったりします。
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
