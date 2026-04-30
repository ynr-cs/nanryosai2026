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
`mobile-order.html` は Firebase 認証に強く依存しています。

- リダイレクト認証時のセッション復帰を確実にするため、`browserLocalPersistence` を使用します。
- ローカル開発時 (`localhost`, `127.0.0.1`) は、App Check を突破するために `config.local.js` を読み込み、共有のデバッグトークンを利用してアクセスします。

## 3. ダークモードとパフォーマンス
- 端末のシステム設定に応じたダークモードに完全対応（CSS変数 `var(--bg-color)` 等を使用）。
- JavaScriptによる不必要なリサイズ計算や描画のブロックを廃止し、パフォーマンスを向上させています。
