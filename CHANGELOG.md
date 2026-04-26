# 変更履歴 (Change Log)

<!-- [AI警告] 更新前に必ずこのファイルの冒頭80行を読み、最新 energetic な [0.x.X] を確認して重複を避けること。必ず最上部に挿入すること。 -->

本プロジェクトにおけるすべての重要な変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づき、
バージョン管理は [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠しますが、以下の独自基準を最優先します。

### バージョニング基準

- **最上位基準**: ユーザーがプロダクトとして「完全に使える状態になった」と判断したかどうか。
- **メジャー (Major / x)**: ユーザーがすべてのファイルを精査し、「南陵祭本番で稼働できる」と判断した時のみ更新。
- **パッチ (Patch / z)**: 開発中のあらゆる変更（不具合修正、機能追加、調整等）。実用可能な「完成」に至るまでの試行錯誤のログ。
- **マイナー (Minor / y)**: ユーザーとAIの試行錯誤を経て、ユーザーが「完了・一区切り」を宣言・承認した時のみ更新。
- **承認プロセス**: AIからの提案に対し、ユーザーが「承認」することでマイナーバージョンを繰り上げる。

## [0.2.140] Auth Hub: Redirect-Based Firebase Authentication - 2026-04-23

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **Firebase Authentication**:
  - `signInWithPopup` から `signInWithRedirect` への完全移行。
  - **背景**: モバイル端末（特にアプリ内ブラウザ）でのポップアップブロックによる認証失敗を根本的に解消するため。
- **`pos/portal.html`**:
  - **認証ハブ化**: すべてのスタッフ用ツール（POS、モニター、キッチン、プレゼンター）の認証処理を集約。
  - **Auth Guard 実装**: 未認証や不正ドメイン（@gl.pen-kanagawa.ed.jp 以外）でのアクセスを検知し、ポータルへリダイレクトする共通ロジックを各ツールに展開。
- **`main/auth.js`**:
  - 共通認証モジュールのロジックを `Redirect` SDK に準拠するよう刷新。
- **UI/UX**:
  - 不正ドメインログイン時の専用エラーオーバーレイを `portal.html` に追加。在校生用アカウント（@gl.pen-kanagawa.ed.jp）での再試行を促すフローを確立。

## [0.2.139] Data Architecture: 完全分離 projectData / stageData - 2026-04-20

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **`main/data/data.js`**:
  - `projectData` 内の3団体（軽音楽部・吹奏楽部・ダンス部）から `schedule` プロパティを削除。
  - **背景/原因**: `projectData`（団体マスタ）と `stageData`（ステージ出演スケジュール）の両方に同じスケジュール情報が二重定義されており、これが重複表示バグの根本原因だった。場当たり的な重複判定ロジックでは完全に解消できなかった。
  - **解決策**: スケジュール情報の「唯一の情報源（SSOT）」を `stageData` に定め、`projectData` は団体の基本情報（名前・場所・説明・メニュー）のみを保持するという役割分担を徹底した。
  - **得られた知見**: データの重複はロジックで吸収しようとせず、データ側の正規化で解決するのが正しいアプローチ。将来 `stageData` に団体を追加する際も `projectData.schedule` は追加しないこと。

- **`main/detail.html`**:
  - スケジュール生成ロジック（約60行）を大幅に簡素化（約30行）。
  - **変更前**: `project.schedule` を先に取得し、`stageData` からも探して複雑な正規化・重複判定・マージを行っていた。
  - **変更後**: `stageData` から `groupName` で一致する出演枠を直接取得するだけ。重複判定ロジックを完全に撤去。フォールバックとして `project.schedule` が残っている場合のみそちらを使う安全策を残した（現状は該当なし）。

## [0.2.138] Detail Page: Prevent Schedule Duplication - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/detail.html`**:
  - ステージ企画などにおいて、「体育館」などのスケジュール表示が重複して表示されるバグを修正。
  - **背景/原因**: プロジェクト固有のスケジュールデータ(`project.schedule`)と、全体のステージスケジュールデータ(`stageData`)の両者に同じイベントが登録されている場合、単純な追記処理により二重にレンダリングされていた。
  - **解決策**: `stageData` からスケジュールを追記する際、配列内にすでに同じ `day` と `time` の要素が存在するか検査する処理を追加。重複する場合は、より詳細な情報を持つ `stageData` 側の内容で上書き更新（マージ）するように修正し、重複表示を排除した。

## [0.2.137] Venue UI: Real-Time Info Modal Expansion - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **`main/index.html` & `main/style.css`**:
  - **モーダル拡張機能**: リアルタイム情報セクション（体育館・音楽室・視聴覚室）の各カードをタップした際に、画面全体を覆う拡大モーダルを表示する機能を追加。
  - **動的データバインディング**: `openVenueModal` および `closeVenueModal` のJS関数を実装し、現在および次回のイベント情報をモーダル内に動的に代入する処理を追加。
  - **プレミアムデザイン**: モーダル背景に `backdrop-filter` を適用した Glassmorphism スタイルを導入し、既存のダークモード/ライトモード設計と完全に調和するように調整。カードホバー時の浮き上がりアニメーションも実装。

## [0.2.136] Venue UI: Header Unification & Card Layout Restore - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/index.html`**:
  - **カードレイアウトの復元**: 3列表示での視認性と情報の密度を優先し、カード内部（団体名、タイトル、時間、矢印）のデザインを従来の左揃え・横並び構成に戻しました。
  - **一貫性の調整**: セクション見出しのテキストスタイルと装飾（highlight-header, highlight-title）のみを他のセクション（企画展示ハイライト等）と統一し、ページ全体の構造的な整合性を確保しました。
  - **リンク挙動の維持**: 矢印アイコンを右端に配置し直し、クリック領域を一目で判別できる直感的なUIを再構築しました。

## [0.2.134] Venue UI: Event Titles & Universal Arrows - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/index.html`**:
  - **イベントタイトルの表示**: 団体名だけでなく、ステージイベントの名称（例: 「南陵ブラス・コンサート」）を併記するように変更。
  - **矢印アイコンの全件表示**: 企画詳細ページの有無に関わらず、すべてのリアルタイム情報カードに矢印アイコンを表示するように修正。
  - **リンク先の設定**: 企画詳細ページがない「有志ライブ」などのイベントについては、ステージ一覧ページへ遷移するように再設定。
  - **UI調整**: 3列グリッドの狭いスペースに合わせて、フォントサイズと行間を微調整。

## [0.2.133] Venue UI: Link Matching & Fallback Fix - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/index.html`**:
  - **マッチングロジックの強化**: 団体名の一致判定に加え、ステージIDの接頭辞（例: `dance_d1`）とプロジェクトID（例: `dance`）の照合ロジックを追加。これにより、ステージ企画から関連する企画詳細ページへの遷移を確実に。
  - **リンク動作の正常化**: 企画詳細が見つからない場合に不用意に「ステージ一覧」へ飛ばないよう修正。遷移先がない場合はリンク化せず、単なる表示に留めることでユーザーの混乱を防止。
  - **コードのクリーンアップ**: 重複していたHTML生成ロジックを整理し、保守性を向上。

## [0.2.132] Venue UI: Data Injection Sync - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/index.html`**:
  - **HTML・JS構造の同期**: 新しいプレミアムデザインおよびレスポンシブなグリッドレイアウトに合わせて、Firestoreデータを受け取ってDOMに注入するJavaScriptロジック（`getStageHTML`）を更新。
  - **リンクブロックの採用**: 既存の分離したボタンではなく、カード全体（`venue-link-block`, `venue-next-block`）をクリッカブルな領域として構成し、矢印アイコン（`fa-chevron-right`）を追加することで直感的な操作性を実現。
  - **ダミーデータの更新**: プレースホルダーのHTMLも新しいリンクブロックの構造に合わせ、データロード前でもレイアウトが崩れないように修正。

## [0.2.131] Venue UI: Ultra-Compact Grid & Button Optimization - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/index.html`**:
  - **CSS構文エラー修正**: 不要な文字列や閉じ括弧の不足を修正。
  - **超コンパクト・3カラムグリッド**: スマホでも「体育館・音楽室・視聴覚室」が横に3つ並ぶようにグリッドを固定し、各要素（フォント、パディング、ドット等）を最小サイズに調整。
  - **ボタン配置の最適化**: 「企画詳細」ボタンを「開催中」のカードにのみ表示し、NEXTからは削除。不要な「予定時間:」ラベルも削除して視認性を向上。
  - **ブラウザ互換性の向上**: `line-clamp` 標準プロパティを追加し、CSS警告を解消。

### 変更 (Changed)

- **`main/data/data.js`**:
  - **データクリーンアップ**: `stageData` の時間表記から「Day1」「Day2」を削除し、純粋な時間のみを表示するように変更。

## [0.2.130] Venue UI: Mobile Carousel (Non-Stacking) - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/index.html`**:
  - **モバイルカルーセル表示**: スマートフォンでカードを縦積みにせず、280pxの固定幅で横にスワイプできるカルーセル（横スクロール）形式に変更。これにより1画面を占有せず、コンパクトかつ一覧性の高いUIに改善。
  - **スクロール体験の向上**: `scroll-snap` を導入し、スワイプ時にカードがピタッと止まるように調整。

## [0.2.129] Real-time Venue UI: Light Mode & Full Responsive - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/index.html`**:
  - **ライト/ダークモード完全対応**: ハードコードされていた色をCSS変数 (`--card-bg`, `--text-main` 等) に置き換え、システムのカラーモード設定に連動するよう修正。
  - **セクション全体のサイズ最適化**: セクションタイトルやカード内のフォントサイズ、余白をさらに微調整。セクション全体が主張しすぎず、自然に溶け込むサイズ感に改善。
  - **レスポンシブ・グリッドの刷新**: 固定カラム数から `auto-fit` を用いた動的グリッドに変更。タブレットや大画面PCなど、あらゆるデバイスで最適なカラム数で表示されるようレスポンシブ設計を強化。

## [0.2.128] Venue UI Mobile Optimization & Next Link - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/index.html`**:
  - **モバイル表示の最適化**: スマートフォン表示時にカードやフォントが大きすぎる問題を修正。パディングやフォントサイズを調整し、1画面に収まりやすい情報密度に改善。

### 追加 (Added)

- **`main/index.html`**:
  - **NEXT企画リンク**: 現在開催中の企画だけでなく、次に開催予定の企画にも詳細ページへのリンクボタン（「企画詳細」）を追加。

## [0.2.127] Real-time Venue UI Polish & Mobile Fix - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/index.html`**:
  - **デザイン刷新**: リアルタイム情報セクションにグラスモーフィズムとグラデーションを活用したプレミアムデザインを適用。昨年度のビジュアルを超える視認性と美しさを実現。
  - **UIコンポーネント**: 状態（ステータス）を直感的に示す発光ドットインジケーター、および「詳しく見る」用の鮮やかなグラデーションボタンを導入。
  - **レスポンシブ対応**: スマートフォン表示時に3列が潰れてしまう問題を修正。画面幅768px以下で自動的に1カラムの縦積みレイアウトに切り替わるよう改善。
  - **表示ロジック**: Firebaseからの動的取得データと連動するHTML生成ロジックを新デザインに合わせて最適化。

## [0.2.126] Venue Admin Simplification & Bug Fix - 2026-04-20

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/admin/venue.html`**:
  - **究極の簡素化**: プロジェクト共通CSS (`style.css`) を外し、完全に独立した最小限のスタイルに刷新。白背景（ダークモード対応）に黒文字、標準的な境界線のみの実用本位なUIへ移行。
  - **バグ修正**:
    - `isListenersAttached` フラグを導入し、ログイン・ログアウトの繰り返しによるイベントリスナーの二重登録（多重実行）を防止。
    - `ensureData()` 関数を追加し、`data.js` の読み込みを待機してから初期化を実行するように改善。
    - 演目リスト生成前に既存のオプションを確実にクリアし、項目の重複を防止。
  - **UX改善**: 保存時のフィードバックを簡素なテキストベースに変更。

## [0.2.125] Simple Version Display - 2026-04-19

### 修正 (Fixed)

- **main/app-shell.js**: バージョン表示のデザインをさらにシンプル化。
  - 中央揃え、標準フォントを採用し、`v0.x.y` 形式で「Powered By」のすぐ下に配置されるよう修正。

## [0.2.124] Version Display UI Polish - 2026-04-19

### 修正 (Fixed)

- **main/app-shell.js**: ハンバーガーメニュー内のバージョン表示デザインを調整。
  - `BUILD: x.y.z` 形式に変更し、等幅フォント（monospace）と控えめな不透明度を採用して、よりシステムメタデータらしい洗練された外観に修正。

## [0.2.123] Auto Version Display - 2026-04-19

### 追加 (Added)

- **main/app-shell.js**: ハンバーガーメニューのフッターに、`CHANGELOG.md` から自動取得した最新バージョン番号を表示する機能を追加。
  - 実行時に `CHANGELOG.md` をフェッチし、正規表現で最新のバージョンタグ (`## [x.y.z]`) を抽出して表示します。

## [0.2.122] Mobile Order UI/UX Polish - 2026-04-19

### 修正 (Fixed)

- **mobile-order.html**: モバイル表示でのコンテンツ見切れを修正。
  - `#app-container` に `padding-bottom` (safe-area考慮) を追加し、ボトムナビとの重なりを解消。
  - スクロール領域を `body` から `#app-container` に完全に移行し、`showScreen` 時のスクロールリセット挙動を修正。
- **ダークモード対応**: 最近追加された認証・案内画面の配色を修正。
  - `text-muted`, `text-dark` などのハードコードされたクラスを CSS 変数 (`var(--text-sub)`, `var(--text-main)`) に置き換え。
  - `backdrop-filter` を活用した Glassmorphism の適用により、ダークモード時のプレミアム感を向上。

### 変更 (Changed)

- **HTML構造**: セマンティックな構造化と `main/style.css` のスケーリング適用のた、`#app-container` を `main` タグに変更。

## [0.2.121] Domain Restriction for Admin/Staff Screens - 2026-04-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **`pos/pos.html`**: `@gl.pen-kanagawa.ed.jp` ドメイン制限を追加。ログイン画面にドメイン案内文、ドメインエラーオーバーレイを実装。
- **`pos/portal.html`**: 同上。ステップ画面のサブタイトルをドメイン案内文に変更。
- **`pos/monitor.html`**: 同上。Auth ビューにドメイン案内文を追加。
- **`pos/kitchen.html`**: Compat SDK パターンで同上を実装。
- **`pos/presenter.html`**: Compat SDK パターンで同上を実装。
- 全画面共通: ドメイン不一致時に「在校生専用システム」エラーオーバーレイを表示し、「別のアカウントでログインする」ボタンでサインアウト→ログイン画面へ戻るフローを実装。

### 設計上の注意

- ドメインチェックは `onAuthStateChanged` の `if(user)` ブロック最先頭で実行し、全処理の前にブロックする。
- `presenter.html` / `kitchen.html` は Compat SDK (`firebase.auth()`) を使用。`signOut` は `auth.signOut()` で呼び出す。
- `status.html` は来場者用のため対象外。

---

## [0.2.120] Auth Robustness & Error Handling - 2026-04-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`pos/mobile-order.html` & `main/auth.js`**:
  - **ログインエラー対応の強化**: ネットワークエラー (`auth/network-request-failed`) やサーバーエラー (`auth/internal-error`) に対する分かりやすい日本語メッセージを追加。
  - **二重実行防止**: `onAuthStateChanged` とログイン処理完了後の両方で `checkFlow()` が呼ばれることによる二重実行・レースコンディションを、フラグ管理により防止。
  - **ローディング解除の保証**: Firestoreの保存失敗やService Worker登録エラーが発生しても、`finally` ブロックで確実にローディング画面が消えるように改善。
  - **例外処理の追加**: `saveToken()` (通知設定) や `updateUserProfile()` が失敗しても、注文画面への遷移を止めないよう個別で `try-catch` を追加。

## [0.2.119] UI Polish & Loader Update - 2026-04-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`pos/mobile-order.html`**:
  - **ローディングアニメーションの刷新**: 従来の「円が広がる」アニメーションを、より一般的で視認性の高い「円形スピン（標準的なスピナー）」に変更。
  - **不要な要素の削除**: ゲスト向け案内画面から「MAP連動」の項目を削除（前回の指示の反映漏れ確認）。

## [0.2.118] Guest Experience Improvement & Flow Refinement - 2026-04-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`pos/mobile-order.html`**:
  - **ゲスト体験の向上**: 一般来場者がログインした際、「利用対象外」と突き放すのではなく、お気に入り機能などを活用してもらうための歓迎画面（`step-guest-welcome`）を追加。
  - **判定ロジックの改善**: `isStudentFlow` フラグを導入。明示的に「はい（在校生）」を選択した上でドメインが不一致だった場合のみ警告を表示し、それ以外（最初からログイン済みやゲスト案内からログイン）はゲスト用案内を表示するよう最適化。
  - **UI調整**: 制限画面（`step-unauthorized-logged-in`）のボタン配置を見直し。ユーザーの意図に合わせて「アカウントの切り替え」をメイン（塗りつぶし）に、「ホームに戻る」をサブ（アウトライン）に変更。
  - **メッセージの改善**: ゲスト向けに「お気に入り登録」のメリットを提示するセクションを追加。

## [0.2.117] Mobile Order Access Restriction (Students Only) - 2026-04-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **`pos/mobile-order.html`**: モバイルオーダーの在校生限定アクセス制限フローを実装。
  - **新規画面**:
    - `step-student-check`: 初回アクセス時に在校生か確認するワンクッション画面。
    - `step-guest-guidance`: 一般来場者へお気に入り機能等の利用を促す案内画面。
    - `step-unauthorized-logged-in`: 制限対象外ドメインでログインした際の警告画面。

### 変更 (Changed)

- **`pos/mobile-order.html`**:
  - 認証フローの改修。未ログイン時は直接ログイン画面を出さず、属性確認から開始するよう変更。
  - 在校生判定（「はい」選択時）に、学校アカウント必須であることを再確認させる「ワンクッション画面（`step-student-confirm`）」を追加。
  - **不具合修正**: `showScreen` 関数がモジュールスコープに閉じ込められ、HTMLの `onclick` から呼び出せなかった問題を修正（`window.showScreen` へのエクスポート）。
  - `checkFlow()` 内で `@gl.pen-kanagawa.ed.jp` ドメインの検証ロジックを追加。
  - アカウント切り替えを容易にするため、制限画面からの `logoutAndRetry` （ログアウト＆再試行）機能を実装。
  - 一般ユーザーがログインしても強制ログアウトせず、他のMy Page機能（お気に入り等）を利用し続けられるようUXを最適化。
  - **不具合修正**: `mobile-order.html` において、URLに `storeId` がない場合にアクセスを遮断していた不要なチェック（`checkStoreIdInit`）を削除。来場者用ページでは店舗選択ステップがあるため、IDなしでのアクセスを許可。
  - **不具合修正**: `init()` 関数が定義されているだけで呼び出されていなかった問題を修正し、アプリケーションが正常に開始されるように改善。
- **`main/account.html`**:
  - **不具合修正**: ログアウトボタン（`btn-logout`）とアカウント削除ボタン（`btn-delete-account`）にイベントリスナーが設定されていなかった問題を修正。
  - Firestore上のユーザー情報の削除と、Firebase Authのアカウント削除を連携。再ログインが必要な際のエラーハンドリングを追加。
- **`functions/index.js`**:
  - `createOnlineOrder` 関数にサーバーサイドのドメインバリデーションを追加。フロントエンドをバイパスした不正な注文送信を強力にブロック。
- **`antigravity/firebase_CONTEXT.md`**:
  - 今回実装したドメイン制限の仕様、UIフロー、セキュリティロジックをナレッジベースに同期。

---

## [0.2.116] Mobile Display Scale Down - 2026-04-10

### メタ情報

- **AIモデル**: Claude
- **筆者**: AI

### 変更 (Changed)

- **`main/style.css`**:
  - スマホ表示で全体的にUIが大きすぎるとのフィードバックに対応。
  - **背景/原因**: 各セクションのパディングやフォントサイズが個別に調整済みだが、全体として画面に対する要素の占有率が高く、窮屈に感じられていた。
  - **解決策**: `@media (max-width: 768px)` で `main { zoom: 0.9; }` を適用。CSS `zoom` プロパティにより、`px`・`rem` 等の単位に関係なくコンテンツ領域を均一に90%スケーリング。`html` ではなく `main` に適用することで、`position: fixed` のヘッダー・ボトムナビ・ハンバーガーメニューへの副作用（背景の拡張、メニューが画面下まで届かない問題）を回避。また `zoom` 縮小でコンテンツ末尾のpadding-bottomも縮まりボトムナビ下にコンテンツが途切れる問題に対し、`padding-bottom: calc((--bottom-nav-height + --safe-area-bottom) / 0.9)` で逆数補正。
  - **解決策**: `@media (max-width: 768px)` で `main { zoom: 0.9; }` を適用。`main` のデフォルト `padding-bottom` も `calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 20px)` を付与することで、ボトムナビへのコンテンツ隠れを防止。
  - **得られた知見**: `zoom` を `html` に適用すると、`position: fixed` 要素のviewport解釈が変わり、ボトムナビの浮いた見た目が崩れたり、ハンバーガーメニューの `100vh` が実際の画面高さと一致しなくなる。`zoom` はコンテンツ領域（`main`）に限定し、固定UIは元のサイズを維持するのが安全。

### 修正 (Fixed)

- **ボトムナビ後ろの背景帯が見える問題を修正**（zoom とは無関係の既存問題）:
  - **背景/原因**: `body` に `padding-bottom: calc(--bottom-nav-height + --safe-area-bottom)` が設定されており、この領域に `body` の背景色 (`--bg-color`) が表示され、ボトムナビ（`position: fixed`、pill形状）の後ろに背景の帯が見えていた。
  - **解決策**: `body` の `padding-bottom` を `0` に変更。代わりに `main` に `padding-bottom` を付与することでコンテンツがボトムナビに隠れないようにした。
- **ハンバーガーメニュー下部「Powered by コンピュータ科学部」がスマホで見えない問題を修正**:
  - **背景/原因**: `.app-menu-overlay` と `.app-menu-content` が `height: 100vh` を使用。iOSモバイルブラウザでは `100vh` がアドレスバーを含む高さになるため、実際の表示領域より大きくなり、`margin-top: auto` で下に配置されたフッターが画面外に押し出されていた。
  - **解決策**: `100dvh` (dynamic viewport height) を追加。`100vh` をフォールバックとして残しつつ、`100dvh` で実際の表示領域にフィットさせた。

---

## [0.2.115] Account Menu Refinement & Cleanup - 2026-04-09

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`account.html`**:
  - 「ログアウト」と「アカウント削除」の順序を入れ替え。
  - 「アカウント削除」の赤色指定を削除し、他のメニュー項目と完全に同じ外観（統一デザイン）に修正。
  - 不要なCSSクラス `.logout-item` と `.logout-btn` をクリーンアップ。

---

## [0.2.114] Account Page Section Layout & Compact Orders - 2026-04-09

### メタ情報

- **AIモデル**: Antigravity (Claude Opus 4.6)
- **筆者**: AI

### 変更 (Changed)

- **`style.css`**: `.compact-page`（ページ全体の幅制限）を廃止し、`.account-section`（セクション単位の幅制限 max-width: 640px）に変更。ヘッダーやナビはフル幅のまま、コンテンツ部分のみ適切に制御。
- **`account.html`**:
  - `<main>` から `compact-page` クラスを削除。
  - お気に入り・注文履歴・設定の各セクションを `account-section` クラスで個別に幅制限。
  - 注文履歴カードを大幅にコンパクト化（横並びレイアウト：左にアイコン、右に店名・商品・金額・ステータスを1行ずつ）。
  - ダッシュボード統計カード（注文数・お気に入り数）をプロフィール直下に追加。
  - セクションタイトルのフォントサイズ微調整（1.2rem → 1.05rem）。

---

## [0.2.113] PC Display Optimization & Consistency Fix - 2026-04-09

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **`style.css`**: PC表示時にコンテンツ幅を制限するための `.compact-page` ユーティリティクラスを追加。

### 修正 (Fixed)

- **`account.html`**:
  - `main` タグに `.compact-page` を適用し、PCでの視認性と操作性を向上。
  - ログアウトボタンのアイコンが他のメニュー項目とずれていた問題を修正。

## [0.2.112] Account Page Density Optimization - 2026-04-09

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`account.html`**:
  - マイページ（プロファイル、ダッシュボード）の各カードサイズを縮小し、情報密度を向上。
  - 余白を調整し、モバイル端末でのスクロール量を削減。

## [0.2.111] Hero Section Size Optimization - 2026-04-09

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/style.css`**:
  - トップページのヒーローセクション（「南陵祭 2026」部分）が大きすぎるとのフィードバックに基づき、全体的にサイズを縮小。
  - **調整内容**:
    - `.hero-container` の上下パディングを削減（`60px/80px` -> `32px/48px`）。
    - `.hero-title` の最大フォントサイズを `5rem` から `3.2rem` へ縮小。
    - `.hero-slogan` のサイズを微調整。
    - 各要素間の `gap` を `16px` から `8px` へ短縮。
    - 背景の装飾円（Orbs）のサイズをタイトルに合わせて縮小。

---

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`main/style.css`**:
  - ハンバーガーメニュー内の「Powered by コンピュータ科学部」がスマホ表示で隠れてしまう問題を修正。
  - **背景/原因**: 全画面オーバーレイ形式のメニューにおいて、下部のセーフエリア（iPhoneのホームインジケーター等）が考慮されておらず、またメニュー項目の高さが画面高を超えた際にフッターまでスクロールできない設定になっていた。
  - **解決策**:
    - `.app-menu-content` の下部パディングに `var(--safe-area-bottom)` を統合。
    - `overflow-y: auto` を付与し、小画面デバイスでも全メニュー項目とフッターへアクセス可能にした。
  - **得られた知見**: 固定位置のオーバーレイメニューでは、`100vh` 指定だけでなく、セーフエリア対応とオーバーフロースクロール設定をセットで行うことがモバイルファースト設計の鉄則である。

---

## [0.2.109] POS Portal — 24hトレンド詳細の平滑化と名称変更 - 2026-03-28

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`pos/portal.html`**:
  - 「タイムライン・インスペクター」を **「24h トレンド詳細」** に改称。
  - チャートの描画ロジックを最適化。
    - ドラッグ/ズーム時にチャートを破棄せず、`pulseChart.update('none')` による差分更新に変更。
    - `requestAnimationFrame` を導入し、ドラッグ時の追随性を大幅に向上（60fps相当）。
    - 描画パフォーマンス向上のため、ドラッグ中のアニメーションを完全に無効化。
  - ヘルプテキストをより直感的な表現に更新。

---

## [0.2.108] POS Training Portal — マネージャー画面 モックUI & ステータス完全同期 - 2026-03-28

### メタ情報

- **AIモデル**: Antigravity (Claude Sonnet)
- **筆者**: AI

### 追加 (Added)

- **`pos/training/manager.html`**:
  - 商品管理の **新規追加・編集モーダル** (`item-modal`) をモックで完全実装。
    - 「＋ 新規商品を追加」ボタンから空フォームのモーダルを開き、オンメモリの `mockItems` に追加可能。
    - 編集ボタン（✏️）から既存商品の名前・価格・説明を変更可能。
    - 削除ボタンから該当商品を `mockItems` から除去。
  - 注文検索の **注文詳細・ステータス変更モーダル** (`order-modal`) をモックで実装。
    - 注文行をクリックするとモーダルが開き、注文内容とステータスプルダウンを表示。
    - 「変更を保存」でオンメモリの `mockOrders` のステータスを更新し画面に反映。
  - 注文検索に **ステータスフィルタプルダウン** を追加。キーワードとの複合フィルタリングが可能に。
  - **ステータス定義の完全同期**:
    - 検索フィルタ、モーダル選択肢、バッジ文言、クラス名を本番の `portal.html` と完全に一致させた。
    - `unpaid_at_pos`, `cooking`, `ready_for_pickup` 等の本番用ステータス値を採用。
  - モック操作の結果を通知する **トーストメッセージ** を実装。
  - バッジ表示を本番ポータルと同一の `.badge.status-*` クラスに統一。

### 変更 (Changed)

- `mockOrders` のデータ構造を、items を配列（`{name, qty, price}`）で持つ形式に変更し、注文詳細モーダルで商品ごとの金額を表示できるようにした。
- `modal-overlay` の開閉を `class="open"` のトグルに統一し、モバイルでのボトムシート表示に対応。

---

## [0.2.107] POS Training Portal — マネージャー画面UI統一 - 2026-03-28

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`pos/training/manager.html`**:
  - 管理者向けトレーニングポータルのシミュレーターUIを、本番ポータル（`pos/portal.html`）のデザインシステム・レイアウトに完全に統合。
  - レガシーな独自クラス（`sim-`プレフィックスなど）を排除し、本番と同一のCSSクラスとCSS変数を導入。
  - JavaScript内のDOM参照を新しいHTML構造に合わせて修正し、商品ステータスのトグルや注文キャンセルなどのモックシミュレーション機能を維持。
- **`antigravity/pos/portal_CONTEXT.md`**:
  - トレーニングポータルのUIデザインが本番同等であることを明記し、知識を永続化。

## [0.2.106] POS Training Portal — システム概要デザイン刷新 - 2026-03-28

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`pos/training/index.html`**:
  - 「システム概要」セクションにおいて、暗い背景 (`#333`) に暗い文字が表示され視認性が著しく低かった問題を修正。
  - 背景を Glassmorphism 風（`rgba(255, 255, 255, 0.8)` + `backdrop-filter`）に変更し、文字色を濃色 (`--text-color`) に統一。
  - 各ステップにホバー時のリフトアップアニメーションと影の強調を追加し、プレミアムな質感を実現。
  - 工程を示す矢印 (`.flow-arrow`) の配置と配色を最適化し、スマホ表示時（縦並び）のレイアウト崩れを防止。

### 変更 (Changed)

- **`antigravity/design_CONTEXT.md`**:
  - 今回採用した「Glassmorphism セクション」の設計パターン（背景透過度、ぼかし、ホバーインタラクション等）を共通ガイドラインとして追記し、知識を永続化。

## [0.2.105] About Us Page — 共通デザイン統合 - 2026-03-23

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/about-us.html`**:
  - 他ページと同じ共通パターン（`window.CURRENT_PAGE` 宣言 + `app-shell.js` 読み込み）に統合。
  - 独自のナビゲーション（`.page-top-nav`）を削除し、共通のヘッダー・ボトムナビが正しく表示されるように修正。
  - ページ固有のスタイルを `<style>` タグ内に集約し、`var(--card-bg)`, `var(--border-color)` 等の共通CSS変数を利用。
  - 各セクションのデザインを `account.html` や `projects-list.html` と統一（角丸カード + `var(--shadow-color)`）。
- **`main/style.css`**:
  - 前回追加した About Us 専用スタイル（`.page-top-nav`, `.back-btn`, `.section-label` 等 約200行）を削除。

## [0.2.104] About Us Page Redesign & Simplification - 2026-03-23

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/about-us.html`**:
  - 過度なグリッチエフェクトや動的な背景アニメーション（`.scanline`, `.bg-grid`, `.bg-orb`）を削除。
  - ファイル内の長大なインラインスタイル設定（`<style>`）を分離・削減し、全体的なコード量を大幅に削減（800行→約100行）。
  - 技術用語の羅列を避け、「来場者への提供価値」や「プロジェクトのミッション」に焦点を当てたコンテンツ構成へ刷新。
- **`main/style.css`**:
  - `about-us.html` 用のスタイル（`about-container`, `about-section`, `feature-card` など）を `style.css` の末尾に追記。
  - 共通のCSS変数（`--accent-color`, `--card-bg` など）を活用し、他のページとのデザインの統一感（Glassmorphismベース）を図った。

## [0.2.103] Hamburger Menu "Powered by" Design Refinement - 2026-03-23

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/app-shell.js`**:
  - ハンバーガーメニュー内の「Powered by コンピュータ科学部」セクションからインラインスタイルとアイコンを削除。
  - セクション全体を `.menu-footer` クラスでラップし、リンクに `.menu-footer-link` クラスを適用。
- **`main/style.css`**:
  - `.menu-footer` および `.menu-footer-link` クラスを新規定義。
  - 他のメニュー項目との視覚的整合性を保ちつつ、スマホ幅での見切れが発生しないようパディングとフォントサイズを最適化。
  - ホバー/アクティブ時のフィードバックを追加し、シンプルかつ洗練されたデザインに刷新。
  - **背景/原因**: 固定幅のメニュー内で大きなパディングを持つボタン形式だったため、スマホ幅で文字が見切れる問題が発生していた。また、ユーザーより「強調しすぎず、他のメニューと同様の扱いにしたい」とのフィードバックを受けたため、アイコンを廃止しデザインを簡素化した。

## [0.2.102] 3D Map Editor V2 — Phase 8 ツール統合 (UI・イベント配線) - 2026-03-23

### メタ情報

- **AIモデル**: Claude
- **筆者**: AI

### 変更 (Changed)

- **`ToolManager.js`**: OpeningTool/SlopeToolのキャンセル処理をツール切替時のクリーンアップに追加
- **`SelectTool.js`**: 壁に加え、開口部(Group型メッシュ)・スロープの選択ハイライト・Delete削除に対応。`setOnOpeningDeleted`/`setOnSlopeDeleted` コールバックを追加。Raycasterの交差判定対象に3グループ全てを含めるよう拡張
- **`HierarchyTree.js`**: ツリー表示に🚪(開口部)と🎢(スロープ)ノードを追加、バッジ合計数にopenings/stairsを含む
- **`main.js`**: OpeningTool/SlopeToolの完全統合 — import, scene.add, 7個のコールバック登録, click/mousemove/rightclick/Escapeイベント配線
- **`editor.css`**: `#canvas-container.tool-opening` にcrosshairカーソルを追加
- **得られた知見**: OpeningToolは他ツールと異なりRaycasterで壁メッシュに交差検出するため、click時にMouseEventを受け取る必要がある（WallTool/SlopeToolはcurrentSnappedPosで十分）。SelectToolではGroup型メッシュの子要素マテリアルを操作するため、instanceof THREE.Group の分岐が必要

## [0.2.101] 3D Map Editor V2 — Phase 8 OpeningTool・SlopeTool コア作成 - 2026-03-23

### メタ情報

- **AIモデル**: Claude
- **筆者**: AI

### 追加 (Added)

- **開口部ツール (`js/tools/OpeningTool.js`) の新規作成**:
  - 壁をRaycasterでクリック→交点検出→壁始点からのオフセット距離を自動算出→色違い板メッシュ＋EdgesGeometry枠線で開口表現
  - CSG不使用方式: パフォーマンスを維持しつつ、ビューア側での将来的なBake対応の余地を残す設計
  - データは `floor.elements.openings[]` に保存（`wallId`, `offset`, `width`, `height`, `sillHeight`, `type`）
- **スロープツール (`js/tools/SlopeTool.js`) の新規作成**:
  - WallToolと類似の2点クリック方式で始点・終点を指定
  - XZ平面角度(yaw)と勾配角度(pitch)の2軸回転でBoxGeometryを傾斜させるメッシュ生成ロジック
  - データは `floor.elements.stairs[]` に保存（`start{x,y,z}`, `end{x,y,z}`, `width`, `thickness`, `type`）

### 変更 (Changed)

- **`MapData.js`**: `generateOpeningId()` と `generateSlopeId()` を追加

## [0.2.100] 3D Map Editor V2 — Phase 7 Zone & Select Tools - 2026-03-23

### メタ情報

- **AIモデル**: Antigravity (Gemini) / Other AI
- **筆者**: AI

### 追加 (Added)

- **選択・削除ツール (SelectTool)**:
  - キャンバス上の壁などのオブジェクトをクリックして選択状態（オレンジ色へのハイライト）にする機能を実装。
  - 選択状態で `Delete` または `Backspace` キーを押すと、シーン上および内部の `mapData` の両方から要素を完全に削除できる機能を実装。
- **ゾーン定義ツール (ZoneTool)**:
  - 物理的な壁とは独立した空間ボリュームを作成できるツールを追加。
  - 床面上を順にクリックして多角形の頂点を設定し、始点付近のクリックまたは3点以上でのスナップによる確定操作で、高さ（デフォルト3.0m）を持つ半透明のゾーンメッシュを生成。
  - 内部 `mapData` の `zones` 配列へ保存され、Firestore上の企画データなどと紐づけるためのUUIDを持つ。

### 変更 (Changed)

- **UIとの統合**:
  - `main.js` と `HierarchyTree.js` を更新し、ゾーン追加や壁削除が行われた際に左サイドバーのツリー画面がリアルタイムに更新されるように配線（コールバックパターンの活用）。
  - 各建物のツリーバッジに、壁とゾーンの合計数が表示されるように最適化。

## [0.2.99] 3D Map Editor V2 — Phase 6 ES Moduleリファクタリング - 2026-03-23

### メタ情報

- **AIモデル**: Gemini (Antigravity)
- **筆者**: AI

### 変更 (Changed)

- **エディタのモジュール化**:
  - 肥大化した単一ファイル `editor.js` (約800行) を7つの独立したES Moduleに論理分割し、可読性とAIのコンテキスト維持性を大幅に向上。
  - `js/main.js`: エントリーポイント、全体の状態管理とイベント配線。
  - `js/core/MapData.js`: データマネージャー（階層構造管理、ID生成）。
  - `js/core/Renderer.js`: Three.jsの基盤部分（Scene、Camera、Renderer、ResizeObserver）。
  - `js/core/Controls.js`: OrbitControls、Raycastingによるスナップ座標取得、カメラ切替。
  - `js/tools/WallTool.js`: 壁の描画ロジック全般、3Dメッシュ生成。
  - `js/tools/ToolManager.js`: ツールの切り替えロジック。
  - `js/ui/HierarchyTree.js`: 左サイドバーの階層ツリーレンダリング。

### 追加 (Added)

- **疎結合なイベント通知**:
  - ツール（`WallTool.js`）がUI層（`HierarchyTree.js`）を直接呼ばず、コールバック（`setOnWallAdded`）を介して `main.js` がツリー更新を委譲するイベント駆動アーキテクチャを導入。
- **安全な状態参照**:
  - カメラ切り替え時のES Module `live binding` 挙動を確実にするため `getActiveCamera()` ゲッターを導入。

### 削除 (Removed)

- **旧モノリスファイルの削除**:
  - 動作検証完了に伴い、旧 `editor.js` を削除。
  - `editor.html` のスクリプトの参照先を `js/main.js` へ変更（対応済み）。

## [0.2.98] 3D Map Editor V2 — Phase 5 状態管理と壁描画ツール - 2026-03-23

### メタ情報

- **AIモデル**: Claude
- **筆者**: AI

### 追加 (Added)

- **データマネージャー（mapData）の初期化**:
  - `context.md` §8-3 準拠の階層型データ構造を JS メモリ上に構築（Site > Building > Floor > Elements）
  - 初期データとして生徒棟（3階建て）、管理棟（1階）、体育館（1階）を定義
  - `state.activeFloorId` によるアクティブフロア管理と `getActiveFloor()` ヘルパー

- **壁描画ツール (Wall Tool)**:
  - 操作フロー: 始点クリック → マウス追従プレビュー（半透明 BoxGeometry + ガイドライン）→ 終点クリック → 壁 Mesh 確定
  - `createWallMesh()`: start/end 座標から長さ・角度を算出し、BoxGeometry(length, 3.0m, 0.2m) を動的生成。影あり。
  - 連続描画モード: 終点が自動的に次の始点になり、連続して壁を描ける
  - Escape / 右クリックで描画を中断
  - 壁描画モード中は OrbitControls を無効化し、操作の競合を防止
  - 壁データは `mapData` のアクティブフロアの `elements.walls` 配列に自動保存

- **階層ツリーの動的レンダリング**:
  - 静的 HTML プレースホルダーを廃止し、`renderHierarchyTree()` で mapData から動的生成
  - 壁追加時にリアルタイム更新（壁ノード `🧱 w_001 (L=5.00m)` がフロア下に追加）
  - フロアクリックで `activeFloorId` を切替、アクティブフロアを紫ボーダーで強調表示
  - 建物・フロアに壁数バッジを表示

- **CSS追加**: 壁描画時の crosshair カーソル、アクティブフロア強調スタイル、壁カウントバッジ

## [0.2.97] 3D Map Editor V2 — Phase 4 プロトタイプ初期セットアップ - 2026-03-23

### メタ情報

- **AIモデル**: Claude
- **筆者**: AI

### 追加 (Added)

- **3Dマップエディタ V2 のスキャフォールディング (`main/map_editor_v2/`)**:
  - `editor.html`: Import Map によるThree.js r170のCDN読み込み（esm.sh経由）。`context.md` §8-3 に準拠した3ペイン＋トップバー＋ステータスバーのUIシェルを構築。
  - `editor.css`: CSS Grid による5領域レイアウト（TopBar / LeftSidebar / CenterCanvas / RightSidebar / StatusBar）。3Dエディタの慣例に合わせたダークネイビー系テーマ。`main/style.css` のCSS変数パターン（ブランドカラー、フォント）を踏襲。
  - `editor.js`: Three.jsの初期セットアップ。ES Modules構成。
    - **デュアルカメラ**: PerspectiveCamera（3Dビュー）+ OrthographicCamera（2D俯瞰）のワンタッチ切替
    - **OrbitControls**: ダンピング付き。地面下への潜り込み防止
    - **3灯ライティング**: AmbientLight + DirectionalLight(影あり) + HemisphereLight
    - **地面**: MeshStandardMaterial の暗色プレーン + 200m四方のデュアルグリッド（1m刻み＋10m刻み太線）
    - **AxesHelper**: 原点にRGB座標軸（デバッグ用）
    - **Raycaster**: マウスの地面交点をリアルタイム計算し、ステータスバーに座標表示。スナップ対応
    - **ツール切替**: 選択/壁描画/開口部/ゾーン/斜面のボタンUI（ロジックは未実装）
    - **ResizeObserver**: ウィンドウリサイズ時のキャンバス追従
  - **得られた知見**: `<script type="importmap">` + `esm.sh` の組み合わせにより、npm/バンドラー無しでThree.jsのES Modules構成を実現。OrbitControlsや将来的な`BufferGeometryUtils`等のaddonsもCDN経由で直接importできる。Z-Fighting対策として、グリッドやAxesHelperのY座標に0.005m〜0.01mの微小オフセットを適用。

## [0.2.96] 3D Map Editor Architecture Finalization - 2026-03-23

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **3Dマップエディタ仕様の確立 (`main/map_editor_v2/context.md`)**:
  - 旧来の2D/フラットJSONから完全脱却し、「ネイティブ3D空間での階層型データ構造（Site > Building > Floor > Elements/Zones）」を基本とする設計へ移行。
  - Z-Fighting防止の自動Yオフセット機能、スマホ描画負荷を軽減するためのフロア単位でのMesh Merging（ジオメトリ結合）仕様を追加。
  - 壁やドアなどの物理要素(Elements)とは独立して、イベントUUIDと紐づく見えない空間ボリューム(Zones)を配置するツール仕様を追加し、旧アーキテクチャのポリゴン内包判定バグを根本解決。
  - 勾配の激しい洋光台北口ルート等を再現するための「斜面・階段ツール」仕様を追加。
  - 効率的な開発者向け3ペイン＋トップバーのUIレイアウト案（Center Canvas, Left Hierarchy, Right Inspector）を策定。

### 変更 (Changed)

- **座標系の表記修正**:
  - Three.js の標準である `Y-up` 座標系に合わせ、高さを示す記述をすべて「Z座標」から「Y座標」へ修正。
- **知識の永続化 (`antigravity/map-3d_CONTEXT.md`)**:
  - これらのコアアーキテクチャの思想・決定事項を、未来のAIエージェントへの指示書としてコンテキストファイルへ永続化・同期。

## [0.2.95] Obsidian Integration (Frontmatter & MOC) - 2026-03-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **Obsidian連携用メタデータの一括付与**:
  - `antigravity/` 直下および `main/`, `pos/` サブディレクトリ内の全 `_CONTEXT.md` ファイルに対し、YAML Frontmatter（`title`, `tags`, `status`, `last_updated`）を一括追加。
  - プロパティによるドキュメントの構造化と、Dataviewプラグイン等での集計を可能にした。
- **インデックス (MOC) ドキュメントの新規作成**:
  - `antigravity/index_MOC.md` を作成し、全コンテキストファイルへの目次を構築。
  - 共通基盤、メインサイト、POS等、論理的なグループ分けを行いアクセス性を向上。
- **内部双方向リンクの構築**:
  - 既存の `_CONTEXT.md` ファイル内に他のコンテキストを参照する記述がある箇所へ、Obsidian独自のリンク記法 `[[ファイル名]]` を自動適用するスクリプトを実行。
  - ファイル間の依存関係をグラフビューで可視化しやすい状態にした。

## [0.2.94] 404 Page Navigation Fix - 2026-03-03

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **404ページおよび深層階層でのナビゲーション不具合を修正**:
  - `main/app-shell.js` 内の `resolvePath` 関数を改修。`window.location` に依存した相対パス計算から、`import.meta.url` を基準とした絶対URL生成方式へ移行。
  - これにより、`https://ynr-cs.github.io/nanryosai2026/invalid-path` のような予期せぬURL階層で 404 ページが表示された際も、ロゴやメニューのリンク（`index.html` 等）が正しくメイン階層を指すように改善。

## [0.2.93] Spreadsheet Localization and Cleanup - 2026-02-28

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **スプレッドシート出力の日本語対応とフォーマット修正**:
  - `functions/index.js` の追記処理におけるヘッダー、システムステータス（`completed_at_store` → `提供済(店頭)` など）、および支払方法（`ONLINE` → `オンライン決済` など）を日本語化。
  - 既存のスプレッドシート群に対して、データリセット、注意書き挿入、列幅調整、見出しの日本語化を行うGASスクリプト (`functions/run_gas_format.md`) を提供。

### セキュリティと整理 (Removed / Security)

- **不要ファイルと機密情報の削除**:
  - `sa-key.json`, `test_sa.json`, `test_sa.txt` などのローカルテスト・デバッグで使ったサービスアカウント秘密鍵ファイルを完全に削除。
  - プロジェクト直下の一時ログファイル (`diagnostic_check.txt`、`detailed_log.txt` など) 10点、不要なテスト用スクリプト群を削除し、プロジェクトツリーをクリーンアップ。
- **不要なCloud Functionsコードの削除**:
  - スプレッドシート作成の手動運用への切り替えに伴い、`functions/index.js` から不要となった `onStoreCreated` （店舗作成時のスプレッドシート自動生成）および `bulkCreateSpreadsheets` （一括作成API）のコードを削除。
- **ポータルUIからの不要コード削除**:
  - `pos/portal.html` 内に残っていた、店舗管理用の一括バッチ実行ボタン（`run-bulk-btn`）と対応するJavaScript関数（`runBulk`）を完全に削除。

## [0.2.92] Automatic Spreadsheet Integration (Manual Fallback) - 2026-02-28

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **注文データのスプレッドシート自動追記機能**:
  - `functions/index.js` に Firestore の `onCreate` / `onUpdate` トリガー (`syncOrderToSpreadsheet`) を実装し、各店舗の注文が専用スプレッドシートの末尾にリアルタイムで追記されるシステムを構築。
  - ポータル画面 (`pos/portal.html`) にリンクボタンを追加し、1クリックで店舗専用のスプレッドシートを開けるように改善。

### 経緯と設計変更 (Architectural Decisions)

- **「高度な保護機能プログラム (APP)」とサービスアカウントの制限への対応**:
  - 当初、Google Drive API / Sheets API 等を使用しシステム側（Cloud Functions / ローカル Node.js スクリプト）から「各店舗のスプレッドシートを全自動一括作成」するアプローチを試みた。
  - しかし、ユーザーアカウントの強力なセキュリティ制限（APPによる未確認アプリの完全ブロック）と、GCPの個人向け制約（サービスアカウントの無料Drive容量が0GB）という2つの壁により、プログラムによるファイル作成が不可能であることが判明。
  - 代替案として「個人のサブアカウント（Gmail）を用いて GAS (Google Apps Script) でファイルのみ一括作成し、そのURLをシステム側のFirestoreに登録、その後ロボットアカウントに編集権限を与える」という **[手動作成＋自動紐付けフロー (`MANUAL_WORKAROUND.md`)]** へ完全に方向転換し、実運用を確立させた。

## [0.2.91] POS Password Input Improvements - 2026-02-26

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **POS共通の店舗パスワード入力の改善**:
  - 対象: `portal.html`, `pos.html`, `monitor.html`, `kitchen.html`, `presenter.html`
  - スマホでの使い勝手向上のため、`inputmode="numeric"` および `pattern="[0-9]*"` を付与し、数字キーボードが優先して表示されるように調整。
  - `input` イベントで入力内容をリアルタイム監視し、全角英数字が入力された場合に自動で半角英数字へ変換する処理を追加。また、英数字以外の文字を自動で削除。
  - パスワード表示/非表示を切り替える「目玉アイコン」のトグルボタンを実装し、入力ミスを防ぐプレビュー機能を提供。

## [0.2.90] Monitor Internal Refactoring - 2026-02-25

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`monitor.html` の内部コード整理**:
  - ファイル分割を行わず、単一ファイル構成のまま「スパゲティ化」を解消するリファクタリングを実施。
  - **CSS**: 定義を役割・画面別に見やすくグループ化、無駄な記述の整理。
  - **JavaScript**: ファットメソッドとなっていた `init()`, `startApp()`, `keyEnter()` などを機能別（`setupAuthListeners`, `subscribeReadyOrders`, `handleOrderUpdate` など）に小分けにして可読性を向上。
  - キャッシュレスフロー移行に伴う不要な「デッドコード」や古いコメントを一部クリーンアップ。機能や操作性への変更はなし。

## [0.2.89] POS Cashless Transition & QR Flow - 2026-02-25

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **POS QR決済フローの完全導入**:
  - お客様がモニターでQRコードを読み取って決済し、提供スタッフに完了画面を提示するシミュレーションフローを正式実装。

### 変更 (Changed)

- **POS注文の決済情報定義 (`functions/index.js`)**:
  - デフォルトの `paymentMethod` を `"cash"` から `"pos"` へ変更。システムから「現金」の概念を廃止。
- **モニター画面案内 (`monitor.html`)**:
  - POS注文時、 auPay QRコードの読み取りと、**「提供スタッフへの完了画面提示」**を促す明確な案内に刷新。
  - 完了時のテキストを「ありがとうございます」から「**Thank you**」に変更。
- **提供スタッフ画面 (`presenter.html`, `training/presenter.html`)**:
  - 「現金 完了」ボタンを削除。
  - 「QR 完了」ボタンを横幅100%の大型ボタン **「QR決済 完了（画面確認）」** に統一し、オペレーションミスを防止。

## [0.2.88] 404 Page Layout Fix - 2026-02-25

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **`404.html` のレイアウト崩れを修正**:
  - **`main` タグに `flex: 1` を追加**: `body` が `display: flex` のコンテナのため、`main` が残りの縦スペースを正しく確保できず、コンテンツが垂直中央に配置されなかった問題を解消。
  - **`error-container` に `max-width: 480px` を追加**: コンテンツが画面幅いっぱいに広がり、`404` の数字が異常に大きく表示されていた問題を解消。
  - **装飾オーブを `position: fixed` に変更**: `position: absolute` + `z-index: -1` の組み合わせが、`position: relative` の親要素との積み重ねコンテキストにより意図せずコンテンツに干渉していた問題を解消。

## [0.2.87] Sync Status Visualization - 2026-02-24

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **`main/admin_sync.html` への Sync Status UI フル追加**:
  - `Firebase --- Admin GUI --- data.js` 間のデータ同期状態がひと目で分かるウィジェットを上部メニュー直下に追加。
  - ノード間を繋ぐ線が「緑（同期済）」か「赤/黄（未同期・変更あり）」にリアルタイムで変化するステータス連動機能を実装。
  - ローカル編集（データテーブルの変更など）を検知し、`isGuiModified` フラグによって状態を更新するロジックを統合。

### 変更 (Changed)

- **`admin-server.js` および `data.js` 生成ロジック**:
  - `data.js` の書き出し時に、現在時刻のタイムスタンプに基づく一意のバージョン (`dataVersion`) を定数として直書きするように改修。
- **Firestore 同期ロジック (`admin_sync.html`)**:
  - `saveAllWithSync` を実行完了後、Firestore の `_metadata/master_sync` ドキュメントに現在のバージョン情報を自動発行して保持する仕組みを追加。
  - `admin_sync.html` の Import 時に `getDoc` を用いて、初期ロード時と同期後に Firebase 側のバージョンを取得し、UIへ即座に反映させる処理を追加。

## [0.2.86] Admin Sync UI: Dark Theme Redesign - 2026-02-24

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/admin_sync.html` のUI全面刷新**:
  - **ダークテーマ化**: 背景を `#0f1117` ベースのダッシュボード風UIに変更。CSS変数によるデザインシステムを導入。
  - **ヘッダー**: ロゴアイコン（紫グラデーション＋グロー）、"Internal" バッジ、ゴーストスタイルのログインボタンに刷新。
  - **アクションバー**: ツールバーを目的別セクション（操作 / モード）にグリッド分割。メインアクション「⚡ 一括保存 & 同期」を紫グラデーションで最も目立つ位置に配置。
  - **トグルスイッチ**: テストモードのチェックボックスをカスタムトグルスイッチ + パルスアニメーション付きステータスピルに置換。
  - **テーブル**: 入力フィールドにフォーカス時の紫グローリング、ヘッダーのアッパーケース化、ホバー効果を追加。
  - **JSON出力**: 折りたたみ式（クリックで展開）に変更。コードフォントを `Cascadia Code / Fira Code` に。
  - **全体**: Inter フォント導入、カスタムスクロールバー、ボタンのホバーアニメーション（リフト＋シャドウ）を追加。

## [0.2.85] Data Sync Automation: data.js + Firebase - 2026-02-24

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **管理者用ローカルサーバー (`admin-server.js`)**:
  - Expressを使用した軽量な開発用サーバーを導入。
  - `POST /api/save-data` エンドポイントにより、ブラウザ上の編集内容をローカルの `main/data/data.js` に自動保存する機能を実装。
- **`package.json` スクリプト**:
  - `npm run admin` コマンドで管理者用サーバー（ポート 3001）を即座に起動可能に。

### 変更 (Changed)

- **`main/admin_sync.html` の機能拡張**:
  - 「💾 一括保存＆同期 (data.js + Firebase)」ボタンを追加。
  - ワンクリックで「ローカルファイル保存」と「Firestore同期（店舗・商品）」を連続実行するワークフローを確立。
  - ファイル上書き時の最終更新日を ISO 形式から日付のみ (`YYYY-MM-DD`) に整形するように改善。
- **`antigravity/data_sync_CONTEXT.md` の更新**:
  - 自動同期ワークフローと新サーバーの存在をシステム知識として永続化。

## [0.2.84] Remotion Video Phase 1 Montage & Asset Tuning - 2026-02-24

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **Phase1_History - モビリティ・モンタージュ演出の追加**:
  - 20秒付近（「2026年」パート）に、モバイルオーダーシステムの主要画面5枚を高速で切り替える演出を追加。
  - **演出詳細**: 各画像を0.8秒ごとにカット切り替えし、表示中に 1.0 -> 1.1 のズーム（拡大）アニメーションを適用。
  - **視認性向上**: 画像レイヤーの上にダークオーバーレイ（`rgba(0,0,0,0.5)`）を配置し、背面で画像が躍動しつつ、前面のメインテキストの可読性を確保。
- **アセット管理**:
  - `video/public/` 内の長大なキャプチャ画像ファイル名を、開発効率向上のためリネーム（例: `mock_portal.png`, `mock_monitor.png` 等）。

## [0.2.83] エリアツール描画UX改善 - 2026-02-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **エリアツール - 描画UX大幅改善**:
  - 配置済みノードを丸いマーカー（`CircleGeometry`）で表示。始点は白リング付きで強調。
  - ツールチップ追加: カーソル追従で📏長さ、📐角度、↪折れ角、全長、ノード数を表示。
  - 始点スナップ（`START`タイプ）: ポリゴンモードで3点以上配置後に始点近くでクリックすると自動閉じ。
  - パスモードで道幅プレビュー（帯状ゴースト）を表示。公道=8m幅、通路=3m幅。
  - スナップマーカーの色分け: 通常スナップ=オレンジ、始点スナップ=黄緑。
  - `toScreenPosition()` メソッドを `AreaToolManager` に内蔵化。

## [0.2.82] AreaTool分離リファクタ - 2026-02-19

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **マップエディタ - AreaToolの分離リファクタリング**:
  - `editor.js`（5,362行）から約676行のエリアツール関連コードを `area_tool.js` に分離。
  - 移動対象: `AreaTool` 定数、`AreaToolManager` クラス、`createAreas()`, `createAreaMesh()`, `selectArea()`。
  - グローバル変数（`areas`, `areaMeshes` 等）は `editor.js` に残し、スクリプト読み込み順序で依存関係を解決。

### 削除 (Removed)

- **`temp_areatool.js`**: 開発中の一時ファイルを削除。

## [0.2.81] Unified Store ID Error Handling - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **POS共通 - 店舗IDエラー表示の統一**:
  - `monitor.html`, `portal.html`, `kitchen.html`, `pos.html`, `mobile-order.html`, `presenter.html` において、`storeId` が未指定の場合のエラー表示を全画面オーバーレイに統一。
  - デザインを `monitor.html` に準拠させ、操作を完全にブロックするように変更。

### 修正 (Fixed)

- **mobile-order.html**:
  - `init()` 関数の競合を解消するため、店舗IDチェック用関数を `checkStoreIdInit()` にリネーム。
  - CSSの構文エラーを修正。

## [0.2.80] Timeline Inspector Label Data Sync Fix - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - タイムライン・インスペクターのラベル取得バグ修正**:
  - `ticks.callback` において、相対的な `index` ではなく絶対的な `value` を使用してラベルを参照するように修正。
  - ズームした際に、グラフの開始時刻とX軸のラベル（時刻）が一致しない問題を解消。

## [0.2.79] Timeline Inspector Scroll Sync Fix - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - タイムライン・インスペクターのスクロール同期ズレ修正**:
  - `min`/`max` の設定をインデックス値（整数）からラベル文字列（"HH:mm"）に変更。
  - チャートの表示範囲（X軸）が、上部の表示ラベル（例: "3:58 - 19:42"）と正しく同期するように修正。

## [0.2.78] Search Form Design Standardization - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - 検索フォームのデザイン崩れ修正**:
  - 全ての入力欄（`.input-field`）に共通の高さ（44px）、パディング、配色を適用。
  - テキスト入力、日付選択、プルダウンの見た目を統一し、ガタつきや色の不一致を解消。
  - プルダウン（Select）の不要なスタイル（青文字など）をダークグレーに統一。

## [0.2.77] Timeline Inspector Label Improvement - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - タイムライン・インスペクターの目盛り改善**:
  - X軸（時間）のラベル表示間隔を、ズームレベルに応じて動的調整するように変更。
  - 10時間以上表示時は1時間毎、ズームイン時は15分・10分・5分刻みと切り替わり、視認性を向上。

## [0.2.76] Live Feed Implementation - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - 最近の注文 (Live Feed)**:
  - 売上ビューに直近20件の注文を表示するリストカードを追加。
  - リアルタイムで更新され、「商品名」「時刻」「金額」を確認可能。
  - 長い商品名は省略表示、リストはスクロール可能。

## [0.2.75] iPad Zoom & Sales Overflow Fix - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - iPad画面回転時のズーム防止**:
  - viewport metaに `maximum-scale=1.0, user-scalable=no` を追加。
- **portal.html - 売上ビューの横スクロール防止**:
  - `.main-content` に `overflow-x: hidden` を追加。
  - `.view-section` に `min-width: 0` と `overflow: hidden` を追加し、flexアイテムがはみ出すのを防止。

## [0.2.74] Search Form iPad Layout Fix - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - iPad/タブレットでの検索フォームレイアウト崩れを修正**:
  - **1024px以下**: 3カラムから2カラム（キーワード全幅 + 日付/ステータス横並び）に変更。
  - **768px以下**: 完全な1カラムスタックに変更。
  - フォーム要素を `font-size: 16px` に設定し、iOSでのズーム問題を防止。
  - タッチターゲットを `min-height: 44px` に拡大（Apple HIG準拠）。

## [0.2.73] Order Status Label Refinement - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - ステータス表示文言の改善**:
  - **背景**: 「POS受付(未払)」などが実際の運用フロー（モバイルとPOSの区別など）に対して曖昧だった。
  - **変更内容**:
    - `unpaid_at_pos`: 「POS注文済み」に変更。
    - `authorized`: 「モバイルセルフ注文済み」に変更。
    - `ready_to_serve`: 「調理完了(呼び出し前)」に変更。
    - `ready_for_pickup`: 「お呼び出し中」に変更。
    - その他、「キャンセル」「受取期限切れ」などに統一。

## [0.2.72] Order Number Font Refinement - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - 受取番号のフォント修正**:
  - **背景**: 受取番号に使用していた `Courier New` が、他のモダンなUIコンポーネントと調和しておらず「おかしい」とのフィードバックを受けた。
  - **解決策**:
    - `.font-mono` クラスから `Courier New` を削除し、メインフォントの `Inter` に切り替え。
    - `font-variant-numeric: tabular-nums` を指定し、等幅フォントの利点である「数字の縦揃え」を維持しつつ、デザインのモダンさを向上。
    - 番号のフォントウェイトや色味を微調整し、視認性とプレミアム感を両立させた。

## [0.2.71] Search Results Column Reordering - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html - 注文検索結果の列順序変更**:
  - **背景**: ユーザーからの「番号 時刻 内容 ステータス 金額 の順にしたい」というフィードバックに基づく調整。
  - **対応**:
    - テーブルヘッダー（`<thead>`）の並び順を変更。
    - JavaScriptのレンダリングロジック（`renderSearchTable`）を更新し、セルの並びとレスポンシブ用の `data-label` を新しい順序に適合させた。

## [0.2.70] Search UI Modernization & Mobile Card View - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html - 注文検索画面のUI刷新**:
  - **背景/原因**: 従来の検索画面はデザインが古く、特にスマートフォンでの視認性・操作性が低かった（テーブルが画面からはみ出るなど）ため。
  - **解決策**:
    - **検索フォームのグリッド化**: キーワード、日付、ステータスの入力欄を整理し、カード型のコンテナ（`.search-form-card`）に格納。
    - **Modern Table**: テーブルにスティッキーヘッダーとホバーエフェクトを適用し、視認性を向上。
    - **モバイルカードビュー**: スマホ（768px以下）ではテーブルを行ごとのカード形式に自動変換し、各セルにデータラベル（「時刻」「番号」等）を表示するレスポンシブデザインを実装。
  - **得られた知見**: `td::before { content: attr(data-label); }` を活用することで、HTML構造を大きく変えずにテーブルをカードリスト風に見せる手法が有効。

## [0.2.69] Responsive Layout (iPad/Mobile) - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - レスポンシブ対応（iPad/スマートフォン）**:
  - **Safari対応**: `100dvh` (Dynamic Viewport Height) を使用し、Safari のアドレスバーによるレイアウト崩れを解消。
  - **タブレット (≤1024px)**: サイドバーを画面下部のナビゲーションバーに自動変換。メインコンテンツ領域を最大化し、スクロール可能に。
  - **小型タブレット (≤768px)**: カード/グラフのパディング縮小、サマリーカードを2列グリッドに調整。
  - **スマートフォン (≤480px)**: サマリーを1列表示に変更、ヘッダーをよりコンパクトに。
  - **スクロール修正**: `min-height: 0` と `-webkit-overflow-scrolling: touch` を適用し、flexboxコンテナ内のスクロール問題を根本解決。

## [0.2.68] Product Sales Chart Labels - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - 商品別売上チャートへの詳細ラベル追加**:
  - **常時ラベル表示**: 円グラフの各セグメント上に「金額」と「構成比（%）」を2行で常時表示するよう修正。
  - **視認性の最適化**: グラフが煩雑にならないよう、全体比が4%以上の商品に絞ってラベルを描画。
  - **ChartDataLabelsプラグインの高度な利用**: `formatter` を用いて、通貨形式とパーセンテージを動的に組み合わせて表示。

## [0.2.67] Critical Script Error Fix - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - 変数名の重複による動作停止の修正**:
  - **原因**: `renderSalesDashboard` 関数内で `now` 変数を再宣言していたため、JavaScriptの SyntaxError が発生し、ログイン機能やダッシュボード描画全体が停止していた。
  - **対応**: 競合する変数を `currentDate` に改名し、スクリプトの実行可能性を復旧。

## [0.2.66] Chart Visibility Improvements - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html - 累積売上チャートの表示改善**:
  - **表示範囲の制限**: 当日表示の場合、未来の時間帯（まだ来ていない時間）をグラフから隠し、現在時刻までの推移にフォーカスするよう修正。過去の日付を表示した場合は24時間分を表示。
- **portal.html - 商品別売上チャートの視覚的改善**:
  - **配色改善**: 8色のカラーパレットを採用し、各セグメントの判別を容易化。
  - **ChartDataLabelsプラグイン導入**: グラフ上への外部ラベル表示機能を有効化。

## [0.2.65] Sales Analysis Tooltips - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - 売上分析ヘルプ機能 (Tooltips)**:
  - **概要**: 専門的な分析指標（セット率、瞬間風速、併売など）の意味や活用方法を解説する「？」アイコンを各タイトル横に追加。
  - **操作性**: PCではクリック/ホバー、スマホではタップで解説がポップアップ表示されるよう実装。
  - **内容**:
    - **セット率**: 合わせ買いの成果指標であることを説明。
    - **客数**: 商品点数ではなく会計回数であることを明記。
    - **瞬間風速**: 直近30分のトレンド把握用であることを説明。
    - **併売分析**: メニュー配置の参考になることを説明。
    - **混雑予報**: 色の濃さが注文集中度を表すことを説明。
    - **Timeline Inspector**: ドラッグ・ズーム操作が可能であることを案内。

### 変更 (Changed)

- **UI調整**: 解説アイコン (`.help-icon`) を追加し、視覚的な邪魔にならないよう控えめなグレーのデザインを採用。スマホでの誤タップを防ぐため、十分なタップ領域を確保。

## [0.2.64] Daily Growth (DoD) Display - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - 売上サマリーへの前日比（DoD）表示**:
  - **前日実績の自動取得**: 基準日（本日など）の変更に合わせて、その前日の累計実績をFirestoreから自動的に取得・計算するロジックを実装。
  - **比較バッジ表示**: 累計売上と注文数の横に「前日比 19% ↑」のような形式で、昨日との比較結果をリアルタイム表示。
  - **UI/UX改善**: 増加時は緑の上向き矢印（↑）、減少時は赤の下向き矢印（↓）を表示し、直感的な把握を可能に。

## [0.2.62] View Switching Fix & HTML Structure - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - ビュー切り替え（注文検索・トレーニング）の不具合修正**:
  - **原因**: 前回のタイムライン・インスペクター実装時に `view-sales` セクションの閉じタグ (`</div>`) が不足しており、以降のセクションが入れ子構造になっていたため、表示が正しく切り替わっていなかった。
  - **対応**: 閉じタグを補完し、HTML構造を正常化。
- **portal.html - スクリプト実行エラーの修正**:
  - スクリプト末尾の不要な `window.switchView` への再代入（ReferenceErrorの原因）を削除。

## [0.2.61] Timeline Touch & Drag Support - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - タイムライン・インスペクターの直感的操作対応**:
  - **ドラッグ/スワイプ移動**: チャート上をマウスでドラッグ、または指でスワイプすることで、時間軸をスムーズに移動（パン）できるように実装。
  - **ピンチ/ホイールズーム**: スマホでのピンチイン/アウト、およびマウスホイール操作によるズームイン/アウトに対応。
  - **カーソル表示**: 操作可能性を示唆するため、チャート上のカーソルを `grab` / `grabbing` に変更。

### 変更 (Changed)

- **ズームロジックの刷新**: `zoomTimeline` 関数を「現在の表示範囲に対する倍率（factor）」を受け取る方式に変更し、ピンチ操作などの連続的なズーム入力に対応。

## [0.2.60] 1-Minute Precision Analytics - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 改善 (Improved)

- **portal.html - 売上トレンド分析の解像度向上**:
  - **解像度の詳細化**: タイムライン・インスペクターの集計解像度を10分単位から「1分単位」へ引き上げ。1日を1440点（24時間×60分）で詳細に可視化。
  - **ズームエンジンの再設計**: 1分単位のデータ密度に合わせてズーム・スクロールのスケールを調整。
  - **動的ラベル表示**: ズーム倍率に応じてX軸の目盛り（1時間ごと / 30分ごと / 10分ごと）を自動的に切り替え、視認性を確保。
  - **高密度プロッティング**: 1分ごとの細かな注文発生パターンを正確にエリアグラフとして描画。

## [0.2.59] Timeline Inspector (Zoomable Chart) - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - タイムライン・インスペクターの導入**:
  - **新機能**: 従来のヒートマップを廃止し、10分単位の注文数を可視化するズーム機能付き詳細トレンドグラフを実装。
  - **拡大・縮小機能**: 拡大（+）ボタンで時間軸を絞り込み（1日 → 4時間 → 1時間）、注文の「波」をミクロに分析可能。縮小（-）ボタンで全体俯瞰に戻る。
  - **ナビゲーション**: 左右ボタン（◀/▶）によるタイムラインのスクロール移動機能を搭載。
  - **リセット機能**: 瞬時に標準表示（8:00 - 18:00）へ復帰。
  - **レスポンシブ対応**: スマホ・iPad環境では操作ボタンを最適化して配置。

## [0.2.58] Scrolling & Mobile Bottom Padding Fix - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - iPad/スマホ環境でのスクロール不備修正**:
  - **原因**: `.view-section` に `height: 100%` が設定されていたため、コンテンツが親要素の高さに制限され、内部スクロールが正常に機能しない場合があった。また、モバイル用ボトムナビによって最下部の要素（ヒートマップの凡例など）が隠れていた。
  - **対応**:
    - `.view-section` の `height: 100%` を削除し `min-height: 100%` に変更。コンテンツ量に応じた自然な伸長を許可。
    - `@media (max-width: 768px)` における `.main-content` の `padding-bottom` を `70px` -> `100px` へ増量。ボトムナビの上方に十分な余白を確保し、最下部まで確実にスクロールしきれるように改善。

## [0.2.57] Mobile Navigation Fix - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 修正 (Fixed)

- **portal.html - スマホ用ボトムナビゲーションの表示復旧**:
  - **原因**: 前回のUI調整時に余分な `</div>`（閉じタグ）が混入し、ボトムナビゲーションがアプリケーションのメインコンテナ (`#app`) の外側に追い出されていた。また、CSSの定義順序が不適切で、メディアクエリによる表示設定がベーススタイルで上書きされていた。
  - **対応**:
    - 不要な閉じタグを削除し、ボトムナビを `#app` 内の正しい位置に復旧。
    - CSSの定義順序を整理（ベーススタイル → メディアクエリの順）し、モバイル環境での `display: flex !important` が確実に適用されるよう修正。
    - ボトムナビの `z-index` を `1050` に引き上げ、他要素への背後への回り込みを防止。

## [0.2.56] UI Extra-Scale Refinement - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html - 売上ビューの全体的なUI拡大**:
  - **背景/原因**: デスクトップ画面を含め「全体的に小さくて読みづらい」という深刻な視認性の課題を解決するため。
  - **解決策**:
    - **サマリー値**: フォントサイズを `2.2rem` へ大幅強化。フォントウェイトも `800` に上げ、遠くからでも一目で数字がわかるように。
    - **分析ランキング**: フォントサイズを `1.1rem` に拡大し、行間（パディング）も大幅に拡張。店舗運営中にチラ見するだけで内容が把握できるように改善。
    - **混雑予報ヒートマップ**: 1行の横長表示を廃止し、**3カラム（デスクトップ）/ 2カラム（モバイル）のグリッド形式**に変更。1つ1つのセルを大きく (`40px~44px` 高) し、文字もハッキリ見えるサイズに調整。
    - **カード・余白**: 全体的なパディングを `24px` 基準にスケーリングし、UI全体に余裕を持たせつつ、情報の重みを強調。

## [0.2.55] UI Scale & Readability Improvements - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html - 売上ビューのUIサイズ調整**:
  - **背景/原因**: 高度な分析機能の追加に伴い、表示情報を優先するあまり各要素（文字・余白）を縮小しすぎて視認性が低下していた。
  - **解決策**:
    - **サマリーカード**: スマホ表示時の文字サイズを `0.8rem` -> `1rem` 〜 `1.1rem` へ拡大。パディングも増やして押しやすさを向上。
    - **分析セクション**: 瞬間風速/併売分析のランキング文字サイズを `0.75rem` -> `0.9rem` へ拡大。
    - **ヒートマップ**: セルの高さを `24px` -> `32px` へ拡大し、時間ラベルの文字サイズを `0.5rem` -> `0.65rem` へ引き上げ。
    - **全体**: コンテナ間のマージンやカードのパディングを適正化し、窮屈な印象（"小さすぎる"感）を解消。

## [0.2.54] Advanced Sales Analytics Dashboard - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html - 高度な売上分析機能**:
  - **前時間比 (HoH) バッジ**: 売上カード・注文数カードの横に、直近1時間 vs 前1時間の変化率を `+15% ▲` / `-5% ▼` のバッジで色分け表示。リアルタイムで「波が来てるか」を直感的に把握可能に。
  - **セット率（Items per Transaction）カード**: 4つ目のサマリーカードとして「平均 1.4品 / 人」のような指標を追加。アップセル/クロスセルの効果測定に。
  - **瞬間風速ランキング（Real-time Pace）**: 直近30分間の商品売上ランキング（TOP 5）をメダル付きで表示。「今この瞬間何が売れているか」を把握し、呼び込みに活用。
  - **併売分析（Basket Analysis）**: 注文内の商品ペア出現回数を集計し、「最強の組み合わせ」ランキングとして表示。セット販売の提案根拠に。
  - **10分刻み混雑予報ヒートマップ**: 8:00〜18:00の10分間隔で注文集中度を色分け（青:暇 → 黄:普通 → 橙:忙 → 赤:激混み）で表示。スタッフの休憩タイミングやシフト交代の判断材料に。

## [0.2.53] Sales Trends Visualization - 2026-02-19

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html の売上トレンド可視化機能**:
  - **背景/原因**: 単純な売上合計だけでは、「いつ忙しいか」「目標ペースに対してどう推移しているか」が把握しづらかったため。
  - **解決策**:
    - **時間別売上・注文数 複合グラフ**: 従来の時間別売上棒グラフ（左軸）に、**時間別注文数**の折れ線グラフ（右軸）を重ねて表示。売上金額と客数（忙しさ）の相関を一目で確認可能に。
    - **累積売上推移グラフ** (エリアチャート): 時間経過に伴う売上の積み上がりを表示するグラフを追加。0時から24時までの累積金額を可視化。
    - **レスポンシブ配置**: 3つのグラフ（時間別・累積・商品別）をフレックスボックスで適切に配置し、スマホ時は縦積み、PC時は横並び（2段組）になるよう調整。

## [0.2.52] Sales UI Refinement & Chart Ratio Optimization - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html の売上表示のさらなる最適化**:
  - **背景/原因**: 前回のレスポンシブ対応後も、スマホ画面で売上サマリーが縦に並んで場所を取りすぎたり、グラフが横に間延びして見づらいというフィードバックがあった。
  - **解決策**:
    - **売上サマリー**: 小型画面でも縦積みにせず、3カラムの横並びを維持。パディングとフォントサイズを極限まで絞り、高さを大幅に圧縮。
    - **グラフ表示**: `canvas` の高さをCSSで厳格にコントロール(`140px`-`160px`)し、コンテナの `max-width` を `500px` に設定して中央寄せにすることで、横長すぎる表示を解消。
    - **日付ピッカー**: ヘッダーのマージンを調整し、よりコンパクトに。
  - **得られた知見**: チャートライブラリ（Chart.js等）を使用する場合、親コンテナのサイズだけでなく、`canvas` 要素自体のCSSでの高さ指定を `!important` で制御することが、アスペクト比の維持に有効。

## [0.2.51] Portal Full Responsive Overhaul - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html の全面レスポンシブ対応**:
  - **背景/原因**: 各ビュー（売上、商品管理、検索等）でスマホ表示時にデザインが崩れる問題が複数箇所で発生していた。
  - **解決策**:
    - **2段階ブレークポイント導入**: `768px`（タブレット・スマホ）+ `480px`（超小型画面）の2段階で全ビューをカバー。
    - **売上ページ**: 日付ピッカーのスタック化、チャートの縦積み表示、サマリーカードの柔軟な幅調整。
    - **商品管理**: カードのコンパクト化、480px以下ではアクションボタンの縦積み。
    - **注文検索**: フィルタをカラム方向にスタック化し、固定幅(`width:150px`)をCSS側で`100%`にオーバーライド。入力欄は16pxフォント（iOSズーム防止）。
    - **モーダル**: スマホ時はボトムシート風（画面下から表示、角丸は上だけ）に変更。
    - **ヘッダー**: 480px以下ではストアバッジとユーザー名を非表示にしてコンパクト化。
    - **テーブル**: 横スクロール対応と`white-space: nowrap`でセル内の折り返しを防止。
    - **トレーニングビュー**: パディングとフォントサイズのモバイル最適化。
    - **認証画面**: マージンとパディングのモバイル調整。
  - **得られた知見**: インラインスタイルで固定幅を指定している要素は、メディアクエリで`!important`付きのオーバーライドが必要。設計段階からCSS変数やクラスベースのサイジングを使うべき。

## [0.2.50] Sales Dashboard Date Selector Implementation - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 追加 (Added)

- **portal.html の売上ダッシュボードへの日付選択機能**:
  - **背景/原因**: 文化祭当日（2日間）以外の開発中のデータや、過去の売上実績を確認できるようにするため。
  - **解決策**:
    - 売上ビューに `input[type="date"]` を追加。
    - `setupRealtimeListeners` 関数を拡張し、引数で渡された日付の `00:00:00` から `23:59:59` までの注文データを Firestore からクエリするように修正。
    - 日付変更時に既存のリスナー（`onSnapshot`）を正しく解除（`unsubscribe`）し、新しい条件で再設定するロジックを実装。
  - **得られた知見**: リアルタイムリスナーを動的に切り替える場合、古いリスナーを確実に解除しないと、複数の期間のデータが混ざって集計されたり、メモリリークの原因となる。

## [0.2.49] Item Modal Design Improvement - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html の商品追加・編集モーダルのデザイン改善**:
  - **背景/原因**: 説明文のテキストエリアがリサイズ可能であったため、操作によってモーダルのレイアウトが崩れる問題があった。
  - **解決策**:
    - `textarea` に `resize: none;` を設定し、リサイズを禁止。
    - 各入力項目（商品名、価格、説明文、画像）を独立した `div` で囲み、適切な垂直方向の余白（`margin-bottom: 15px;`）を設定。
    - モーダルのヘッダーとフッターに区切り線を追加し、視覚的な構造を整理。
    - 保存・キャンセル・削除ボタンの配置とスタイルを調整し、UXを向上。
  - **得られた知見**: `flex` や `grid` レイアウトを使用しているモーダル内では、ユーザーによる動的な要素のリサイズが全体の整合性を壊すリスクがあるため、意図的に制限することが品質維持に繋がる。

## [0.2.48] Portal UI Minor Adjustments - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **portal.html のヘッダー表示改善**:
  - **背景/原因**: 店舗ID表示のみでは直感性に欠けるため。
  - **解決策**: Firestoreから店舗情報を取得し、「団体名 - 店舗名」を表示するように変更。`startApp`関数を非同期化。
  - **得られた知見**: 起動時の初期化フロー（StartApp）に非同期処理を組み込むことで、動的なマスタデータの解決がスムーズになる。

- **portal.html の商品画像未登録表示の追加**:
  - **背景/原因**: 画像がない場合にデザインが崩れる、または何も表示されないのを防ぐため。
  - **解決策**: `imageUrl`が未指定の場合に「画像が登録されていません」と表示するプレースホルダーを実装。
  - **得られた知見**: fallback表示をCSSで適切にスタイリング（flexboxによる中央配置）することで、コンテンツ不足時もUIの品質を維持できる。

## [0.2.47] Monitor Security Update - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **monitor.html の storeId 必須化**: URLパラメータ `storeId` を必須とし、未指定時のデフォルト動作（101番）を廃止
  - デフォルト値 `"101"` の削除
  - StoreID未指定時にエラー画面（警告オーバーレイ）を表示するようロジックとスタイルを追加
  - 他のPOSアプリ（kitchen.html等）との整合性とセキュリティを向上

## [0.2.46] Monitor UI Light Theme Update - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **monitor.html のライトテーマ化**: 屋外iPadでの視認性向上のため、白背景×黒文字のデザインに変更
  - 背景色をダークテーマ（#0a0a0a）からライトテーマ（#ffffff）に変更
  - 番号およびテキスト色を黒（#1a1a1a）に統一し、コントラストを最大化
  - 各ビュー（待機、入力、確認、完了、サイドメニュー、モーダル）の配色を明るいトーンへ刷新
  - 決済オーバーレイを白半透明に変更

## [0.2.45] Monitor UI Overhaul - 2026-02-18

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **Monitor UI Overhaul**: 屋外10インチiPad向けのデザインを大幅刷新
  - 背景を白からダークテーマ（#0a0a0a）に変更し、反射を抑制
  - 番号フォントサイズを大幅拡大（Ready: 8rem, Preparing: 4rem）
  - ハイコントラストな配色（緑/オレンジ）を採用
  - フッターにパルスアニメーション付きのCTA（タップ案内）を追加
  - テンキーおよび確認画面の各UIパーツを大型化

## [0.2.44] Monitor Payment & Status Display Enhancement - 2026-02-17

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **monitor.html の案内文言と表示ロジックの修正**
  - **背景/原因**: 現金支払いが不可となり auPay QR に一本化されたこと、および調理完了 (`ready_to_serve`) 状態を「準備中」として可視化する必要があったため。
  - **解決策**:
    - **支払い案内**: 「右の auPay QRコードでお支払いください」に変更し、現金に関する記述を削除。
    - **準備中リスト**: 表示対象ステータスに `ready_to_serve` を追加。これにより調理が終わって提供口に運ばれるまでの間も番号が表示されるようになった。
  - **得られた知見**: 決済手段の変更はユーザーの混乱を招きやすいため、特定のロゴやサービス名（auPay）を明記することが、物理的な掲示物との照合を助け、UXを向上させる。

## [0.2.43] Monitor Payment Flow Text Update - 2026-02-17

### メタ情報

- **AIモデル**: Gemini
- **筆者**: AI

### 変更 (Changed)

- **monitor.html の注文確認画面の文言修正**
  - **背景/原因**: `diagram.puml` の支払いフローおよび現地の物理的セットアップ（物理QRコード掲示など）と、画面上の案内文言が一致していなかったため。
  - **解決策**:
    - オンライン注文時: ボタン文言を「auPay で支払う (デモ)」から「**この内容で決済を確定する**」に変更。
    - POS注文時: メッセージを「お会計はレジにてお願いします」から「お会計は **¥[金額]** 円です。<br>右のQRコード、または現金でお支払いください。」に変更し、金額を動的に表示するように修正。
  - **得られた知見**: 物理的な掲示物と画面内の案内を連携させる場合、画面上の指示が物理的なアクション（「右を見る」など）を明確に促す必要がある。

## [0.2.42] エリア選択ツールの致命的バグ修正 - 2026-02-17

### メタ情報

- **AIモデル**: Claude
- **筆者**: AI

### 修正 (Fixed)

- **`selectedAreaMesh` 未宣言バグ (致命的)**:
  - **背景/原因**: L34 のグローバル変数宣言で `selectedArea` は宣言されていたが、`selectedAreaMesh` が宣言されておらず、`selectArea()` 呼び出し時に `ReferenceError` が発生していた。
  - **解決策**: グローバル変数に `let selectedAreaMesh = null;` を追加。
  - **得られた知見**: 選択状態を管理する変数ペア（data + mesh）は必ずセットで宣言するべき。

- **`handleEvent("click")` が常に `false` を返す問題**:
  - **背景/原因**: AreaToolManager の `handleEvent` で `click` イベントに対して常に `false` を返していたため、描画中（ノード配置中）でもグローバル `onClick` が発火し、建物や道路の選択が実行されてしまっていた。
  - **解決策**: `this.nodes.length > 0`（描画中）なら `true` を返しグローバル `onClick` をブロック。また EDIT モードでは `handleEvent` を通さずグローバル `onClick` のレイキャスト判定に委譲するよう、条件に `AreaTool.EDIT` を追加。

- **描画モード時のカメラ操作競合**:
  - **背景/原因**: `pointerdown` イベントで `stopImmediatePropagation()` が DELETE モードのみに適用されており、描画モード（DRAW_PATH / DRAW_POLYGON）時にはカメラドラッグが有効なままだった。
  - **解決策**: 条件に `AreaTool.DRAW_PATH` と `AreaTool.DRAW_POLYGON` を追加。

- **`selectArea` の emissive 参照エラー**:
  - **背景/原因**: `MeshLambertMaterial` は `emissive` プロパティを持つが、将来的にマテリアルが変更された場合や条件次第で存在しない可能性があった。
  - **解決策**: 選択時・選択解除時の両方で `mesh.material.emissive` の存在チェックを追加。

## [0.2.41] エリアツールのUX改善と機能拡張 - 2026-02-17

### 追加 (Added)

- **頂点スナップの視覚化 (Vertex Snap Visualization)**:
  - 既存の頂点や道路ノードに吸着する際、**緑色の円形マーカー**を表示し、吸着を視覚的にフィードバックするように改善。
- **辺の押し出し (Edge Extrusion)**:
  - 頂点編集モードでエリアの辺（青色のハンドル）をクリックし、領域を拡張する機能を実装。
- **ツール解除UXの改善**:
  - **トグル動作**: 「新規エリア」ボタンの再クリックで作成モードを終了できるように改善。
  - **Escapeキー対応**: `Esc` キー押下により、作成中の状態をリセットして即座にツールを終了できるように対応。

### 修正 (Fixed)

- **致命的な構文エラーの修正**: `editor.js` の `calculateSnap` 実装時に発生していた括弧の重複（1877行目のエラー）を修正。
- **プロパティ連携の強化**: エリア選択時および作成直後にプロパティパネルが正しく更新されない不具合を修正。

## [0.2.40] エリア編集機能の統合とスナップ動作の共通化 - 2026-02-17

### 変更 (Changed)

- **スナップロジックの刷新 (Snapping Logic Overhaul)**:
  - 独自実装していた「Magnet Snapping（吸着）」を廃止し、建物編集と共通の「Angle Snap（角度スナップ）」と「Grid Snap（グリッドスナップ）」に変更。
  - これにより、エリア作成時も直前のノードに対して90度/180度の位置にガイドが表示され、直角や直線を簡単に描けるようになった。
  - 道路との接続用として、道路端点（Node）へのスナップ機能のみ維持。

### 追加 (Added)

- **Vertex Edit Mode Extension (頂点編集モードの拡張)**:
  - 建物の「頂点編集モード」をエリアにも適用可能に変更。
  - エリア選択時に「頂点編集」ボタンを押すと、各頂点に黄色のハンドルが表示され、ドラッグで形状を微調整できるようになった。
  - 操作感（スナップ挙動など）を建物編集と完全に統一。

## [0.2.39] エリア機能のバグ修正とUI改善 (Part 2) - 2026-02-17

### 修正 (Fixed)

- **AreaTool (エリアツール) の不具合修正**:
  - 新規エリアボタンのID欠落を修正 (`index.html`) し、ツールパネルの表示を復元。
  - ポリゴン作成時のプレビュー表示ロジックを改善。常に枠線を表示し、3点以上で面を表示するように変更 (`editor.js`)。
  - ツール（公道、通路、広場、編集、削除）の選択状態に応じたボタンのハイライト（`active`クラス）が正しく切り替わるように修正。
  - エリア選択時にプロパティパネルが更新されるように連動を強化。
- **背景設定保存の修正**:
  - `localStorage` への保存条件を緩和し、背景画像が表示されていない状態でもキャリブレーション情報を保持するように修正。

## [0.2.38] エリア機能のバグ修正とUI改善 - 2026-02-17

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更の背景

v0.2.37 で導入されたエリアツールにおいて、以下の致命的な不具合が報告されました。

1.  「新規エリア」ボタンを押してもサブメニューが表示されず、詳細なエリア種別を選択できない。
2.  ボタンが常にアクティブ（緑色）のまま固定されてしまう。
3.  ポリゴンモード（広場作成）において、4点目以降のプレビューが正しく更新されない。
4.  作成したエリアを選択してもプロパティパネルが表示されない。

### 解決策

#### 1. エリア用ツールパネルの追加 (`index.html`)

`index.html` に不足していた `area-tools` IDを持つツールパネルを追加しました。これにより、「公道」「学内通路」「広場」の切り替えや、削除・編集モードへの移行が可能になりました。

#### 2. UI状態管理の適正化 (`editor.js`)

「新規エリア」ボタンのスタイル制御を、DOM要素への直接的な `style` 操作から、`active` クラスの着脱による管理に変更しました。これにより、ツール切り替え時の見た目の整合性が保たれるようになりました。

#### 3. 描画ロジックとプロパティ判定の修正 (`editor.js`)

- `AreaToolManager.updateGhost`: ポリゴン描画時のプレビュー更新ロジックを見直し、頂点追加ごとに正しく形状が再計算されるようにしました。
- `updatePropertyPanel`: プロパティパネルの表示条件に `selectedArea` を追加し、エリア選択時にも正しく情報が表示・編集（幅など）できるようにしました。

#### 4. 背景画像設定（キャリブレーション）の保存漏れ修正

`saveToLocalStorage` および `exportJSON` において、`background` 属性（位置、幅、回転、透明度等）がデータオブジェクトに含まれていなかった不具合を修正しました。これにより、リロード後や再インポート時にもキャリブレーション済みの背景画像が正しく復元されます。

#### 5. サイドバーUIの構造崩れ修復

修正作業中に誤って削除されていた `road-tools` パネルの閉じタグ (`</div>`) を復元しました。これにより、階層構造の乱れによって隠れていた「オプション（背景貼り付け/キャリブレーション）」や「頂点編集ボタン」が再度表示されるようになりました。

#### 6. クリーンアップ

開発中に生成された一時ファイル (`temp_areatool.js` 等) を削除し、プロジェクト構成を整理しました。

### 得られた知見

- **UIとロジックの同期**: 新しいツールを追加する際は、HTML側の要素IDとJS側のイベントハンドラが完全に一致していることを、実装直後に確認するプロセスの重要性を再認識しました。
- **プレビューの重要性**: 3Dエディタにおいて、操作中の「次にどうなるか」を示すゴースト/プレビュー表示の正確性は、ユーザー体験に直結します。

---

## [0.2.37] エリア機能（広域スペース・通路）の実装 - 2026-02-17

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **エリアツール (Area Tool) の実装 (`main/map_editor/editor.js`)**:
  - **背景/原因**: 従来の道路（Road）機能では表現が難しかった「広場」「グラウンド」「学内通路（歩道）」などの多様な空間を正確に描画するため、新しいデータ構造とツールを導入。
  - **解決策**:
    - `AreaToolManager` クラスを新規実装し、ノードベースのパス描画（Path）と多角形描画（Polygon）をサポート。
    - サブタイプとして 「公道」「学内通路」「広場/グラウンド」を定義し、それぞれ異なる舗装色や属性（白線の有無等）を自動適用。
    - 既存の道路ツールからスナップ・ノード結合ロジックを継承・改良し、道路と通路のシームレスな接続を実現。
  - **得られた知見**:
    - 道路とエリアで異なる `position.y` オフセットを設定することで、重なり（Z-fighting）を回避しつつ、アスファルトの上に白線を引くといった多層表現が可能になった。
    - 頂点ハンドル (Vertex Handles) を動的に生成する際、以前のハンドルの dispose 漏れがあると、メモリリークやイベント重複の原因となるため、確実なクリーンアップが不可欠。
- **ビューア連携の強化 (`main/map3d.html`)**:
  - **背景/原因**: エディタで作成した詳細なエリア・道路データを一般来場者向けの3Dマップにも反映させるため。
  - **解決策**:
    - `localStorage` から `areas` / `roads` データを読み込む処理を追加。
    - エディタと共通の `createAreaMesh` / `createRoadMesh` ロジックをビューア側にもポーティングし、一貫した見た目（白線等）を実現。

## [0.2.36] システム構成図のドキュメント化 - 2026-02-16

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **システム構成図 (`antigravity/architecture_CONTEXT.md`)**:
  - **概要**: Mermaid記法を用いて、システム全体のアーキテクチャとデータフローを可視化したドキュメントを新規作成。
  - **内容**:
    1. **全体アーキテクチャ**: GitHub, Client (Pos/Visitor), Firebase (Auth/Firestore/Functions/Storage) の関係図。
    2. **データフロー**: マスタ同期、モバイルオーダー取引、画像アップロードの3つの主要シナリオのシーケンス図。
  - **目的**: テキストベースでの構成管理を可能にし、開発者がシステムの全体像を即座に把握できるようにするため。

## [0.2.35] 団体向け運用マニュアル動画（Remotion）の実装 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **長尺チュートリアル動画 (`video/src/Tutorial`)**:
  - **概要**: モバイルオーダーシステムの導入促進と操作教育を目的とした、全6章構成のマニュアル動画を実装。
  - **構成**:
    1. **Intro**: 導入
    2. **Mechanism**: サーバー連携のデータフロー図解（アニメーション）
    3. **Workflow**: POS画面の操作シミュレーション（ReactコンポーネントによるMock UI）
    4. **Features**: 在庫管理・分析機能の紹介
    5. **Trouble**: トラブルシューティング
    6. **Ending**: エンディング
  - **技術的特徴**: スクリーンショット画像を使わず、Remotion上でHTML/CSSを用いてUIを再構築（Mock）することで、文字の修正や高解像度出力に強い設計とした。

## [0.2.34] Remotion (動画生成) 導入 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **`video/` ディレクトリ (Remotion)**:
  - **概要**: インフォグラフィックアニメーション制作のため、Reactベースの動画フレームワーク Remotion を導入。
  - **テンプレート**: `helloworld` を採用し、学習コストを低減。
  - **起動方法**: `cd video` -> `npm run dev` でプレビューが可能。
  - **技術背景**: Web技術(HTML/CSS/React)で動画を作れるため、Webサイトのデザイン資産を流用しやすい利点がある。

### 修正 (Fixed)

- **インストール手順の不備**:
  - `create-remotion` パッケージが 404 エラーとなったため、代替手段として `npx create-video@latest` ではなく、公式テンプレートのリポジトリを直接 `git clone` することで確実に環境構築を行った。

## [0.2.33] About Usページのスクロールバー非表示修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Claude)
- **筆者**: AI

### 修正 (Fixed)

- **スクロールバー非表示の強化**:
  - `style.css` からのスタイル適用により、ローカルCSSだけでは非表示設定が効かない問題を修正。
  - `!important` を使用した強制オーバーライドと、ワイルドカードセレクタ (`*::-webkit-scrollbar`) で全要素に適用。

## [0.2.32] About Usページの刷新とUI改善 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **`main/about-us.html` のリニューアル**:
  - **Premium Japanese Digital Style**: 従来の和モダンに、グリッチ、スキャンライン、等幅フォントなどの「デジタル/サイバー」要素を融合した新デザインを適用。
  - **History Timeline**: 2025年10月のプロジェクト発足からの開発軌跡を可視化するタイムラインを追加。
  - **レスポンシブ対応**: モバイルファーストなGridレイアウト調整と、PCでのスクロールバー非表示化を実施。
- **フッターの統合と改善**:
  - ハンバーガーメニュー内の "Devloped by" と "Created by" の重複を解消し、**"Powered By コンピュータ科学部"** に統一。
  - アイコン付きのリンクボタンデザインに変更し、視認性と美しさを向上。
  - "NanryosaiExe2026" 表記を削除。

### 修正 (Fixed)

- **ハンバーガーメニューの視認性修正**:
  - `about-us.html` においてダークテーマ変数を強制適用した際、メニュー内のテキストが背景と同化する問題を、ローカル変数オーバーライドで修正。

## [0.2.31] データ定義の整合性確保 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **ドキュメントとコードの定義統一**:
  - `main/data/data.js` の `groupName` / `name` プロパティに対し、Firestore 上でのフィールド名 (`stores.name` / `stores.teamName`) を明記する注釈を追加。
  - `antigravity/firebase_CONTEXT.md` に `data.js` と Firestore のフィールドマッピング表を追加し、データ変換ルールを明確化。
  - **再発防止策 (Guardrails)**:
    - `main/admin_sync.html` の同期ボタン付近と `pos/mobile-order.html` の店舗データ取得処理内に、フィールドマッピングに関する重要警告コメントを追加。将来的な意図しない変更を防止。
  - **仕様変更**:
    - `mapX`, `mapY` (地図座標) について、2026年度の地図方式が未確定のため「要件定義待ち・対象外」とし、`data.js` 上でコメントアウト等の処置を実施。
  - **背景**: モバイルオーダーシステム等のドキュメントと実装コード間で、団体名の呼び方が混在していたため、定義を統一し混乱を防ぐ目的。

## [0.2.30] About Usページの作成 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **`main/about-us.html`**:
  - **概要**: コンピュータ科学部の紹介ページを、ストーリーと技術的背景を軸に大幅拡充。
  - **コンテンツ**:
    - **Our Story**: 開発の動機と「来場者体験の最大化」という想いを記述。
    - **Evolution**: 2025年から2026年にかけての技術的飛躍（3D・Firebase・AI共創）を対比。
    - **Tech Stack**: 各技術の具体的な役割（堅牢性、表現力、開発スピード）を詳細に解説。
    - **Behind the Scenes**: AI先輩エンジニアとの開発体験など、エモーショナルなQ&Aを追加。
  - **UI/UX大幅アップデート (Digital History Style)**:
    - **コンセプト**: 「Digital Traditional」。和の品格に、グリッチやモノスペースフォント等のデジタル要素を加えたサイバーな世界観へ。
    - **History追加**: 2025年10月のプロジェクト発足からの開発史をタイムライン形式で実装。
    - **レイアウト修正**: レスポンシブ時のパディングやフォントサイズを見直し、どんなデバイスでも美しく表示されるよう調整。
    - **演出**: スキャンライン、グリッド背景、オーブなど、エンジニア集団らしい「デジタル感」を強調。

## [0.2.29] ロードマップのチェックリスト化 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **技術ドキュメントの改善**: `antigravity/main/map_implementation_CONTEXT.md` の将来タスク一覧をチェックボックス形式 (`- [ ]`) に変更。

## [0.2.28] 将来の拡張ロードマップの策定 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **技術ドキュメントの更新**: `antigravity/main/map_implementation_CONTEXT.md` を v0.6.0 へ更新。
  - ユーザーからの要望に基づき、広場、ピロティ、校門、バス停、接続点、敷地境界などの将来タスクをロードマップに追加。

## [0.2.27] 建物の頂点削除機能の実装 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
  - **筆者**: AI

### 追加 (Added)

- **頂点削除機能**: 頂点編集モードにおいて、黄色の頂点ハンドル (🟡) を**右クリック**することで頂点を削除できる機能を実装。
  - **最小頂点数の保護**: 形状（三角形）を維持するため、頂点数が3点以下の場合は削除を制限し、ステータスバーに警告を表示するガード処理を導入。
  - **自動再構築**: 削除後、即座に境界計算（Bounds）、メッシュ生成、および編集ハンドルの再構築を行い、シームレスな編集継続を可能にした。

## [0.2.26] 道路ツールUXの抜本的改善と不具合修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **クリック誤爆防止ロジック**: カメラ操作のためのドラッグ終了時に意図せず道路が引かれるのを防ぐため、マウスの移動距離（閾値5px）に基づくクリックキャンセル機能を実装。
- **初期起動時の安全設計**: エディタ起動時にいきなり道路建設モード（LINE）にならないよう、デフォルトのモードを「編集（EDIT）」に変更。

### 変更 (Changed)

- **右クリック挙動の洗練**: 右クリックを「現在の建設作業のキャンセル・リセット」のみに限定。右クリックしただけで勝手に編集モードへ遷移しないようにし、連続した作業を妨げないように改善。

### 修正 (Fixed)

- **接線計算とガイドライン**: 曲線末端の接線取得精度向上、および点線ガイドが表示されない不具合を解消（v0.2.25の内容を包括）。

## [0.2.25] 接線計算の精度向上とガイドライン修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **接線引き継ぎの精度向上**: 曲線から連続して次の道路を引く際、曲線の終端における接線方向をベジェ曲線の数式 ($P_2 - P_1$) に基づいて計算するように改善。これにより、曲線と直線の接続がより滑らかに。
- **ガイドライン表示の修正**: `updateGuideLine` でジオメトリを毎フレーム置換するようにし、点線ガイドが表示されない問題を解決。

## [0.2.24] 曲線モードの機能強化と不具合修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **接線拘束 (Tangent Constraint)**: Cities Skylines同様、既存道路から曲線を開始する際、最初の制御点を既存道路の接線方向に自動的に拘束する機能を実装（Shiftキーで解除可能）。これにより、常に滑らかな接続が可能に。
- **State 2 ガイドライン**: 制御点決定後の終点選択中（State 2）にも、制御点からマウス位置へのガイドラインを表示するように変更し、視認性を向上。
- **角度表示の統合**: 曲線モードでも建設中の角度をリアルタイムに表示。

### 修正 (Fixed)

- **プレビュー消失バグ**: 連続して曲線を作成する際、2回目以降にベジェ曲線のプレビューが表示されなくなる（または接線情報が正しく引き継がれない）不具合を修正。
- **状態管理の安定化**: 曲線建設完了後のステート遷移を整理。

## [0.2.23] 道路プレビューの位置ずれ修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **道路プレビューの吸着不具合**: 曲線モード（ベジェ曲線）を使用した後に直線モードに切り替えると、道路のプレビューが原点 (0,0,0) を参照して巨大な三角形になってしまう問題を修正。
  - **原因**: 共通の `ghostMesh` を使用する際、曲線モードでセットされたインデックス付きジオメトリが直線モードでもそのまま参照され続けていたため。
  - **解決策**: `updateGhost` メソッドで毎フレームジオメトリを dispose し、新規に生成して置換するように変更。これにより、古いインデックス情報が残留することを完全に排除。

## [0.2.22] ベジェ曲線道路システム実装 (Cities Skylinesスタイル) - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Claude)
- **筆者**: AI

### 追加 (Added)

- **3ステップ入力システム**: Cities Skylinesに倣い、ベジェ曲線道路を直感的に作成できるステートマシンを実装。
  - **State 0 (始点)**: クリックで始点 (P0) を決定。既存ノードにスナップ時は接線を自動取得。
  - **State 1 (制御点)**: マウス移動でガイドライン（点線）表示。クリックで制御点 (P1) を決定。
  - **State 2 (終点)**: マウス移動でベジェ曲線のリアルタイムプレビュー表示。クリックで終点 (P2) を決定、曲線セグメント生成。
- **ガイドライン表示**: 始点から制御点方向への点線ガイド (`THREE.LineDashedMaterial`)。
- **リアルタイムプレビュー**: `THREE.QuadraticBezierCurve3` によるベジェ曲線に沿った道路メッシュをゴースト表示。
- **連続建設モード**: 曲線作成後、終点を次の始点として連続的に曲線道路を作成可能。
- **右クリックで1ステップ戻る**: 曲線モード中に右クリックで状態を1つ前に戻せる (終点待ち→制御点待ち→始点待ち)。
- **曲線長表示**: ツールチップにベジェ曲線の推定長をリアルタイム表示。

### 新規メソッド (`RoadToolManager` クラス)

- `onCurveClick(rawPos, isShiftPressed)`: 曲線モード専用クリックハンドラ
- `createCurveSegment(n0, nControl, n1)`: 曲線セグメントをデータ構造に追加
- `updateGuideLine(start, end)`: ガイドライン（点線）の更新
- `updateCurveGhost(p0, p1, p2)`: ベジェ曲線ゴーストプレビューの更新
- `createBezierMeshGeometry(p0, p1, p2, width, segments)`: ベジェ曲線に沿った帯状メッシュの生成
- `estimateBezierLength(p0, p1, p2)`: ベジェ曲線長の推定
- `calculateTangentFromNode(node)`: ノードから既存セグメントの接線ベクトル取得

### 技術詳細

- **ベジェ曲線数式**: $B(t) = (1-t)^2 P_0 + 2(1-t)t P_1 + t^2 P_2$
- **データ構造**: `segments` 配列の要素に `control` フィールド（制御点ノードID）を追加
- **描画**: `createRoadMesh` 関数は既にベジェ曲線に対応済み、追加修正不要

## [0.2.21] 道路建設のスナップ修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **道路建設の不具合**: 道路ツール (`LINE`/`CURVE`) 使用時に既存の道路や建物を選択しようとするロジックが優先され、既存ノードからの建設開始が阻害されていた問題を修正。ツール使用中は建設を最優先するように整理。
- **ロジックエラー**: `createSegment` 内での道路タイプ判定ミス (`!targetRoad.type === "road"`) を修正。

## [0.2.20] 道路削除の体験改善 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Claude)
- **筆者**: AI

### 修正 (Fixed)

- **クリック削除の閾値改善**: `deleteRoadAt` の閾値を `2.0` 固定から `road.width / 2 + 1.0` に変更。道路端の近くをクリックしても削除できるようになりました。また `<` を `<=` に変更。
- **範囲削除の交差判定**: `deleteRoadsInRange` で、矩形が道路セグメントを横切る場合も削除されるように `segmentIntersectsRect` ヘルパーを追加。

### 追加 (Added)

- **`segmentIntersectsRect` メソッド**: 線分と矩形のAABB交差判定ユーティリティ。

## [0.2.19] 道路削除の安全性向上とUI改善 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **Legacyデータ保護**: `deleteRoadAt` / `deleteRoadsInRange` のクリーンアップループで `roads[i].segments` の存在チェックを追加。古い形式の道路データ（`path`のみ等）が混在していてもクラッシュしないように修正。
- **削除モード中の選択操作**: `RoadToolManager.handleEvent` を修正し、`DELETE` モード中でもクリックイベントを透過（`return false`）させることで、グローバルの `onClick` が発火し、選択解除などができるように改善。

### 変更 (Changed)

- **イベントハンドリング**: `handleEvent` の戻り値を厳密化。`pointerdown/up` は `DELETE` モード時のみ `true` (伝播阻止) を返し、それ以外は `false` を返して他機能（OrbitControls等）と共存しやすく整理。

## [0.2.18] editor.js リファクタリングと道路削除の完全修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **道路削除機能の堅牢化**:
  - **曲線対応**: ベジェ曲線の点列を展開して距離判定を行うロジック (`getDistanceToRoadSegment`) を導入し、曲がった道路の上をクリックしても正しく削除できるように修正。
  - **データ不整合対策**: `road.segments` や `road.nodes` が欠落しているLegacyデータが存在してもクラッシュせず、安全にスキップまたは削除するようにガード処理を追加。
- **選択ロジックの改善**:
  - `getRoadIdFromHitObject` ヘルパーを導入し、道路メッシュ（`THREE.Group`）の子要素（白線やサイドライン）をクリックしても、親グループを遡って正しく道路IDを特定できるように修正。これにより削除や選択の判定ミスを解消。

### 変更 (Changed)

- **コードリファクタリング**:
  - `editor.js` 末尾に残存していたLegacyなグローバル関数 (`addNewRoad`, `setupRoadToolInteractions` 等) を削除・整理。
  - ツール制御を `RoadToolManager` クラスに完全に一本化し、コードの重複と競合リスクを排除。

## [0.2.17] 道路削除ツールの競合修正 (Pointer Events 移行) - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **OrbitControls との競合解消**:
  - 道路削除モードでのドラッグ（範囲選択）がカメラの視点移動と競合する問題を根本解決。
  - イベントリスナーを `mousedown`/`mousemove`/`mouseup` から `pointerdown`/`pointermove`/`pointerup` へ移行。
  - `pointerdown` イベントをキャプチャフェーズ (`capture: true`) で捕捉し、削除モード時は `stopImmediatePropagation()` を実行することで、後続の `OrbitControls` へイベントが伝播するのを完全に遮断。
- **操作性の向上**:
  - ポインターイベントへの移行により、タッチデバイス等での将来的な操作性向上にも寄与。

## [0.2.16] 道路スナップと削除UIの修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **相対角度スナップの実装**:
  - 角度スナップが絶対座標（0度、90度...）ではなく、接続元の道路の延長線を基準とした相対角度（直進、右折90度...）で機能するように修正。
  - 基準となる延長線をグレーの点線で表示し、0度の方向を明確化。
- **角度表示位置の調整**:
  - 角度ラベルの表示位置を円弧の中心付近に移動し、より直感的に配置。
- **バグ修正 (UI/UX)**:
  - 削除ボタンが反応しない問題を修正（イベントリスナーの追加漏れを解消）。
  - 道路接続時の黄色いノードスナップマーカーが表示されなくなっていた問題を修正（初期化漏れのガードを追加）。
  - 削除モードでのドラッグ（範囲選択）が視点移動（OrbitControls）と競合して機能しない問題を修正（キャプチャイベントでの制御を追加）。

## [0.2.15] 道路削除機能と範囲選択ツールの追加 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **道路削除モード (DELETE)**:
  - 道路を個別に、または範囲指定でまとめて削除できる新しいツールを追加。
- **範囲選択（矩形選択）**:
  - `mousedown` からのドラッグで赤い選択枠を表示し、枠内に含まれる道路を一括削除する機能を実装。
- **データクリーンアップロジック**:
  - セグメントが削除された際、どこにも繋がっていない孤立したノード (Orphan Nodes) を自動的に検出・削除し、データを健全に保つ仕組みを導入。

### 変更 (Changed)

- **UIの更新**:
  - 道路ツールパネルに「削除」ボタンを追加。
  - 削除モード中はカーソルが赤色に変化し、視覚的にモードを判別可能に。

## [0.2.14] 角度表示の Cities: Skylines スタイル化 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **情報タグ（ツールチップ）の整理**:
  - 表示内容を**座標 (POS)** と **距離 (Length)** のみに限定し、 Cities: Skylines 風のシンプルな外見に調整。
- **3D角度ガイドの導入**:
  - 角度情報をツールチップではなく、3D空間上の**円弧（アーク）と専用ラベル**で表示するように変更。
  - 既存の道路と新しい道路の間に青色の点線アークが表示され、その角度をリアルタイムに視覚化。
  - **リファレンス検知**: 接続元のノードに繋がっている既存道路の方向を自動検知し、それに対する相対角を算出。

## [0.2.13] 道路ツールのUX向上（ノード吸着・角度表示） - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **ノード吸着の視覚化**:
  - **機能**: 既存の道路ノードにカーソルがスナップした際、青いカーソルではなく**オレンジ色の点（Sphere）**を表示するように変更。
  - **目的**: 確実に接続できるポイントをユーザーが直感的に識別できるようにするため。
- **角度情報の表示**:
  - **機能**: 直線モード等での建設中に、現在のセグメントの長さだけでなく**角度（Angle）**をツールチップにリアルタイム表示。
  - **目的**: 正確な角度での道路敷設や、既存道路との位置関係の把握を容易にするため。

## [0.2.12] 道路プレビュー（ゴースト）のバグ修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **道路建設中のプレビュー（ゴースト）非表示バグ**:
  - **背景/原因**:
    1. 建設中の道路プレビュー（青い半透明メッシュ）において、頂点座標の更新後にバウンディングボックス/スフィアの再計算が行われていなかったため、Three.js のカリング（描画範囲外判定）によって非表示になっていた。
    2. 色が濃紺の地面に対して暗い青（`0x3b82f6`）だったため、背景に溶け込んで視認性が著しく低かった。
  - **解決策**:
    - `updateGhost` 関数内で `computeBoundingSphere()` と `computeBoundingBox()` を追加。
    - プレビューの色をより発色の良いシアン（`0x00ffff`）に変更し、不透明度を調整。
    - Z-fighting 防止のため、地面からの高さをわずかに引き上げ。
  - **得られた知見**: 動的に形状が変わるジオメトリを使用する場合、属性値の更新だけでなくバウンディング情報の更新を忘れると、カリングによって表示が不安定になる。

## [0.2.11] 道路の視認性・デザイン向上 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **道路レンダリングの高度化**:
  - **背景/原因**: 以前の道路（グレー単色）は地面の色と近く、重なりや方向が判別しにくかった。
  - **解決策**:
    - **マテリアル刷新**: `MeshLambertMaterial` を採用し、環境光や影が反映されるリアルな質感に変更。
    - **アスファルト色**: 基本色を `0x555555` から深い `0x333333` に変更。
    - **中央線の追加**: 道路中央に白いラインを追加し、車線や方向性を強調。
    - **エッジラインの追加**: 道路の縁にグレーの境界線を追加し、地面とのコントラストを明確化。
    - **選択ハイライトの強化**: 選択時に道路全体が黄色く発光（Emissive）するように変更し、操作対象であることを分かりやすくした。
  - **得られた知見**: 単純な平面メッシュでも、多層的なライン（中央線・縁取り）を重ねることで、3D空間における「意味のある構造物」としての存在感が劇的に向上する。

## [0.2.10] 道路ツールUIのデザイン改善 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **道路ツールUIの刷新**:
  - **背景/原因**: アイコンのみのUIで機能が分かりにくく、デザインも未整備だった。
  - **解決策**:
    - ボタンにテキストラベル（直線、曲線、編集）を追加。
    - 各モードの説明文をパネル内に追加。
    - プレミアムなダークモードスタイル（アクティブ時のグロー効果、ホバー時の挙動）を実装。
    - 視点切替ボタンを既存のボタンコンポーネントと共通化し、レイアウトを最適化。
  - **得られた知見**: アイコンは空間を節約できるが、複雑なツールにおいてはテキストラベルの併用がユーザーの学習コストを劇的に下げる。デザインシステム（変数）を徹底的に活用することで、一貫性のある「プレミアム感」を維持できる。

## [0.2.9] 道路ツールUI表示不具合の修正 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **新規道路作成時のUI非表示バグ**:
  - **背景/原因**: `addNewRoad` 関数内で、道路ツール用パネル（`#road-tools`）を表示する処理が欠落していたため、ボタンを押してもツールバーが出現せず操作不能になっていた。
  - **解決策**: 関数内に `selectBuilding(null, null)` 等による選択解除処理と、`document.getElementById("road-tools").style.display = "block"` を明示的に追加。
  - **得られた知見**: モード切替を伴う機能実装時は、状態遷移（State Transition）だけでなく、それに紐づくUIの表示/非表示（View Update）が正しく行われているかを必ずセットで確認する必要がある。

## [0.2.8] Road Toolの高度化（Cities: Skylines風ロジック） - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **Cities: Skylines風道路建設システム**:
  - **背景/原因**: 以前の道路生成コードは挙動が不安定で、自由な道路網の構築が困難だった。
  - **解決策**:
    - **ステートマシン導入**: `Idle`（始点未決定）と `Dragging`（建設中）の状態を厳密に管理。
    - **スマートスナップ機能**:
      - **Node Snap**: 既存ノード（交差点）へ2m以内で吸着。
      - **Angle Snap**: 90度/180度への角度補正。
      - **Grid Snap**: 上記以外はグリッド（1m）へ吸着。
    - **トレースモード (Shiftキー)**: `Shift` を押している間のみ全スナップを無効化し、航空写真等のトレースを容易にした。
    - **連続建設モード (Chaining)**: 道路の終点を次の始点として即座にセット。右クリックで解除。
  - **描画・UI**:
    - 青い球体によるカーソル表示。
    - 建設中のゴースト（半透明メッシュ）表示。
    - リアルタイムな長さ（m）とコスト（¥）のツールチップ表示。
  - **得られた知見**:
    - 3D空間での自由な配置において、複数のスナップ優先度（ノード > 角度 > グリッド）を設定することで、直感的な操作感が得られる。
    - 右クリックによる「1段階戻る（始点リセット）」操作は、ユーザーの試行錯誤を妨げない。

## [0.2.7] 3Dマップエディタドキュメントの整備 - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI
- [x] コンテンツの拡充 (想いや技術的背景を詳細に)
- [x] 動作確認・微調整
- [x] ドキュメント更新 (antigravity/ への反映)
- [x] CHANGELOG.md の更新

### 追加 (Added)

- **AI向けコンテキストドキュメント (`antigravity/map_editor_CONTEXT.md`)**:
  - `main/map_editor/` の技術仕様、データモデル、UIコンポーネントID、座標系の詳細をまとめた内部ドキュメントを作成。
  - **背景/原因**: 他のAIエージェントがエディタの改修を行う際、`index.html` や `editor.js` の解析コストを下げるため。
  - **解決策**: 開発に必要な情報を「コンテキストファイル」として集約・永続化。

## [0.2.6] 道路ツールのバグ修正（初期化・選択処理） - 2026-02-07

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **起動時のクラッシュ修正**:
  - `setupRoadToolInteractions` が `renderer` 初期化前に呼び出されていたため、`domElement` 参照エラーが発生していた問題を修正。
- **選択時のTypeError修正**:
  - 道路（`THREE.Group`）を選択・解除する際、存在しない `.material` プロパティにアクセスしてクラッシュする問題を修正。
  - グループ内の全セグメント（Children）を走査して色を変更するようにロジックを変更。

## [0.2.5] 道路ツールの高度化（ベジェ曲線・2D編集） - 2026-02-05

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **ベジェ曲線（Bezier Curve）対応**:
  - 道路データ構造を単純なパスから「ノード・セグメント」形式（`testroad1.html`準拠）に刷新。
  - 2次ベジェ曲線による滑らかなカーブの描画をサポート。
- **2D平面編集モード**:
  - 道路編集時に自動的にカメラをトップダウン視点に切り替える機能（3Dへ戻るボタンあり）。
  - クイックツールバー（直線・曲線・編集モード）の実装。

### 修正 (Fixed)

- **ファイル破損の復旧**:
  - `editor.js` の保存時に発生したバイナリ混入（`cat`コマンドのエンコーディング不備）をGit復元とBOMなしUTF-8再保存により解決。
- **頂点編集の統合**:
  - 建物の頂点編集と道路の編集ロジックを統合し、`toggleVertexEditMode` でシームレスに切り替え可能にした。

---

## [0.2.4] 道路ツールの実装 - 2026-02-05

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **道路作成機能**:
  - サイドバーに「新規道路」ボタンを追加。
  - 幅を持った帯状のメッシュ（Y=0.02）として描画し、自由に配置可能にした。
- **道路の頂点編集**:
  - 建物の頂点編集モードを拡張し、道路のパス（経路）もドラッグで変更できるようにした。
  - グリッドスナップに対応（道路はワールド座標系でスナップ）。

### 変更 (Changed)

- **エディタコアのリファクタリング**:
  - `selectedBuilding` に依存していたロジックを修正し、`selectedRoad` との共存・切り替えを可能にした。
  - プロパティパネルを動的に切り替え、道路選択時は幅のみ編集可能にした。

---

## [0.2.3] 回転座標変換のバグ修正 - 2026-02-05

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 修正 (Fixed)

- **座標変換関数の符合修正**:
  - **背景/原因**: `localToWorld` および `worldToLocal` 関数において、回転行列の符号が Three.js の座標系（Y軸回転：右手法）と逆になっていた。これにより、回転した建物の頂点ハンドルが誤った位置に表示され、ドラッグ操作も逆方向に飛ぶ現象が発生していた。
  - **解決策**: Three.js の `Euler` (XYZ順) および `Matrix4` の内部計算と一致するように、回転行列の $sin$ 項の符号を反転させた。
  - **得られた知見**: 3Dライブラリ（Three.js）と独自計算を混用する場合、回転軸と符号の定義（右手法か左手法か）を厳密に一致させる必要がある。

## [0.2.2] ワークフローの強化（パッチノート記録の義務化） - 2026-02-05

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 変更 (Changed)

- **「1タスク = 1パッチ」ルールの導入**:
  - **背景/原因**: AIの会話が新しくなると過去のデバッグ知見が失われ、同様のバグ（例：特定条件下での頂点編集の不具合）に何度も直面する問題があった。
  - **解決策**: 1つのタスク（依頼）を完了するごとに必ずバージョン（v0.x.X）のパッチ番号を上げること、および `CHANGELOG.md` に技術的な背景・原因・解決策を濃密に記述することを `SKILL.md` で義務化した。
  - **得られた知見**: `antigravity/` 配下の複数ファイルに知見を分散させるとAIが混乱するため、`CHANGELOG.md` を「技術的な航海日誌」として唯一の真実（SSOT）に設定するのが最も効率的である。

## [0.2.1] 背景トレース保存機能の実装 - 2026-02-05

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 追加 (Added)

- **背景トレースの永続化**:
  - 設定した背景画像（DataURL形式）およびキャリブレーション設定（幅、位置、回転、透明度）を `localStorage` に保存。
  - 次回起動時に、前回作業していた地図の状態が自動で復元される機能。
- **UI/UXの改善**:
  - `loadBgImage` 時に現在のチェックボックスの状態（表示/非表示）を尊重するように修正。読み込み直後に意図せず画像が表示されてしまう挙動を防止。

### 修正 (Fixed)

- **回転した建物の頂点編集バグ**:
  - グリッドスナップがワールド座標基準で行われていたため、回転した建物の頂点をドラッグすると意図しない位置にズレる問題を修正。ローカル座標基準でスナップするように変更。

## [0.2.0] 3Dマップエディタの大規模機能強化 - 2026-02-05

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI + Uokun

### 追加 (Added)

- **多角形（ExtrudeGeometry）のサポート**:
  - 建物の形状を従来の「矩形（BoxGeometry）」から「自由な多角形（ExtrudeGeometry）」ベースに刷新。
  - **頂点編集モード**: 各頂点の位置を個別にドラッグして調整可能に。
  - **頂点追加機能**: 辺の中央にあるハンドル（緑色）をクリックして、新しい角を自由に追加可能に。
- **背景画像トレース機能の強化**:
  - **Google Maps URL連携**: URL（`...z` 形式および `...m` 形式）を入力するだけで、縮尺（m/px）を自動推定・適用する機能。
  - **Google Earth URL連携**: URL（`...d` 形式）からカメラ距離を解析し、表示幅を自動設定する機能。
  - **クリップボード貼り付け (Ctrl+V)**: ブラウザ上の地図画像をスクリーンショットし、エディタに直接ペーストして背景として設定可能に。
  - **キャリブレーション**: 画像上の2点間をクリックし、実距離を入力することでスケールを正確に補正する機能。
  - **プレースホルダー表示**: URL入力時に、次に何をすべきか（スクショ貼り付け）を案内するガイド画像を表示。
- **UI/UXの改善**:
  - **メートル単位への完全移行**: すべての座標・サイズ表示を「メートル(m)」基準に統一し、Google Earth等の実測値と整合。
  - **プロパティパネル**: 各座標や回転、階数の数値を直接入力・編集可能に。
  - **ステータスバー**: 現在の操作（ドラッグ中、頂点編集中など）や解析結果をリアルタイムに表示。

### 変更 (Changed)

- `map_implementation_CONTEXT.md`: 最新の仕様（多角形データ構造 `path` プロパティの追加など）を反映して更新。
- **内部座標系の刷新**:
  - 建物の重心（Centroid）を常に基準点（Pivot）とするようにロジックを変更。
  - 頂点編集中に形状が変わっても、回転軸がずれないように自動補正(`recenterBuilding`)する仕組みを導入。

### 修正 (Fixed)

- **重大なバグ修正**:
  - 頂点編集モード中に建物を移動できてしまう/パラメーターが効かなくなる問題を修正。
  - 頂点ハンドル再生成時にドラッグ操作が中断される不具合を修正。
  - ExtrudeGeometry使用時に選択枠（白枠）とメッシュの位置がずれる描画上の不整合を修正。
  - `ReferenceError` (未定義関数) によるクラッシュを修正。

---

## [0.1.1] 移行フェーズの完了とクリーンアップ - 2026-02-05

### メタ情報

- **AIモデル**: Antigravity (Gemini)
- **筆者**: AI

### 削除 (Removed)

- `antigravity/v0.1.0_MIGRATION_CHECKLIST.md`: 全ファイルの移行（ヘッダー付与）が完了したため削除。

### 追加 (Added)

- `antigravity/migration_CONTEXT.md`: v0.1.0 移行作業の完了記録と、今後の運用方針をまとめた知見。

## [0.1.0] 変更履歴システムの始動 - 2026-02-05

### メタ情報

- **AIモデル**: Gemini
- **筆者**: Uokun

### 追加 (Added)

- `CHANGELOG.md` の作成と運用ルールの策定
- Semantic Versioning (v0.1.0) の導入
- `404.html`: 存在しないページへのアクセス時に表示されるエラーページ (v0.1.0 バージョンヘッダー適用)
- `debug_firestore_custom.js`: Firestore のデータを取得・確認するためのデバッグ用ユーティリティスクリプト (v0.1.0 バージョンヘッダー適用)
- `generate_hash.js`: 店舗用パスワードのハッシュとソルトを生成するためのユーティリティスクリプト (v0.1.0 バージョンヘッダー適用)
- `functions/index.js`: 受付番号発行、注文作成、決済処理、店舗認証などのコアロジックを担う Cloud Functions (v0.1.0 バージョンヘッダー適用)
- `main/index.html`: カウントダウン、リアルタイム情報、モバイルオーダー紹介、企画ハイライトを含むトップページ (v0.1.0 バージョンヘッダー適用)
- `main/style.css`: デザインシステム、ダークモード対応、共通コンポーネント、アニメーションを定義するベーススタイルシート (v0.1.0 バージョンヘッダー適用)
- `main/app-shell.js`: ヘッダー、ボトムナビゲーション、認証状態の監視、テーマ切り替えなどのアプリ共通シェル機能 (v0.1.0 バージョンヘッダー適用)
- `main/auth.js`: Firebase Authentication を使用した Google ログイン、ログアウト、ユーザー状態の監視を担うモジュール (v0.1.0 バージョンヘッダー適用)
- `main/account.html`: ユーザープロフィール、注文履歴、通知設定、アカウント管理を行うマイページ (v0.1.0 バージョンヘッダー適用)
- `main/admin_sync.html`: 企画データやメニュー情報の編集、Firestoreへの同期、data.jsの生成を行う管理ツール (v0.1.0 バージョンヘッダー適用)
- `main/detail.html`: 企画や模擬店の詳細情報、メニューリスト、ギャラリー、モバイルオーダー連携ボタンを表示する詳細ページ (v0.1.0 バージョンヘッダー適用)
- `main/map.html`: 校内の各フロア（1F〜5F）を3Dパース表示し、企画場所や施設の位置を確認できるフロアマップ 。実験段階の機能であり、`map-experiments/` フォルダと連携して開発中(v0.1.0 バージョンヘッダー適用)
- `main/map3d.html`: Three.js を使用した校内（キャンパス全体、生徒棟、体育館等）の3Dモデル探索が可能な立体マップ。実験段階の機能であり、`map-experiments/` フォルダと連携して開発中 (v0.1.0 バージョンヘッダー適用)
- `main/mobile-order-guide.html`: モバイルオーダーシステムのアーキテクチャ、セキュリティ設計、技術スタックを解説する技術仕様書 (v0.1.0 バージョンヘッダー適用)
- `main/projects-list.html`: 企画・展示の横断検索、カテゴリ・団体別フィルタリング、並び替え、表示形式（グリッド/リスト）切り替えが可能な企画一覧ページ (v0.1.0 バージョンヘッダー適用)
- `main/terms.html`: 注文後の商品の受け取り期限（15分）、禁止事項、免責事項、個人情報の取り扱いなどを定めた利用規約ページ (v0.1.0 バージョンヘッダー適用)
- `main/firebase-messaging-sw.js`: プッシュ通知をバックグラウンドで受信し、通知を表示するためのサービスワーカー (v0.1.0 バージョンヘッダー適用)
- `main/data/data.js`: 企画情報、メニュー、展示ギャラリー、ステージスケジュールなどの全コンテンツデータを保持するマスターデータファイル (v0.1.0 バージョンヘッダー適用)
- `pos/portal.html`: 各店舗の売上統計、商品管理、注文検索、および各運営画面（POS/キッチン等）へのアクセスを統合した管理用ポータル (v0.1.0 バージョンヘッダー適用)
- `pos/mobile-order.html`: 来場者がスマートフォンから商品を注文・決済するためのモバイルオーダー・クライアントUI (v0.1.0 バージョンヘッダー適用)
- `pos/monitor.html`: 調理完了・準備中の注文番号をリアルタイムに表示し、来場者へ商品の受け取りを促す digital signage 画面 (v0.1.0 バージョンヘッダー適用)
- `pos/kitchen.html`: 調理中の注文を一覧表示し、経過時間の監視やステータス更新（調理完了）を行う厨房用モニター画面 (v0.1.0 バージョンヘッダー適用)
- `pos/presenter.html`: 商品の受け渡し口で、お客様の呼び出しや対面決済（現金・QR）、受取完了処理を行うプレゼンター用画面 (v0.1.0 バージョンヘッダー適用)
- `pos/status.html`: 注文後の来場者が、調理・準備の進捗状況をリアルタイムに確認できるマイページ用注文ステータス画面 (v0.1.0 バージョンヘッダー適用)
- `pos/pos.html`: 店舗スタッフが対面で注文を受け付け、レジ会計処理を行うためのPOSシステム画面 (v0.1.0 バージョンヘッダー適用)
- `pos/simulator.html`: モバイルオーダーやSOK（券売機）の注文データをランダム生成し、Firestoreへ書き込む開発用注文シミュレーター (v0.1.0 バージョンヘッダー適用)
- `pos/animation.html`: 調理中、準備中、商品完成などの注文ステータスを可視化するアニメーション確認用画面 (v0.1.0 バージョンヘッダー適用)
- `pos/firebase-messaging-sw.js`: 店舗運営用（POS）セクションにおいて、プッシュ通知をバックグラウンドで受信するためのサービスワーカー (v0.1.0 バージョンヘッダー適用)
- `pos/training/index.html`: レジ担当、キッチン担当、呼び出し担当などの各ロールごとに操作方法を学習できるPOSトレーニングポータル (v0.1.0 バージョンヘッダー適用)
- `pos/training/kitchen.html`: 調理中の注文確認、カスタマイズ（抜き・追加）の把握、調理完了操作の流れを練習するためのキッチン担当用トレーニング画面 (v0.1.0 バージョンヘッダー適用)
- `pos/training/manager.html`: 売上確認、在庫切れ（Sold Out）設定、注文キャンセルなどの管理者・責任者限定機能を練習するための管理ポータルシミュレーター (v0.1.0 バージョンヘッダー適用)
- `pos/training/pos.html`: 模擬店スタッフが商品選択、カスタマイズ適用、会計確定までのレジ操作フローを習得するためのPOSレジトレーニング画面 (v0.1.0 バージョンヘッダー適用)
- `pos/training/presenter.html`: キッチンからの通知受信、お客様の番号呼び出し、対面決済および商品の受け渡し完了処理を練習するためのプレゼンター用トレーニング画面 (v0.1.0 バージョンヘッダー適用)
- `main/map_editor/index.html`: Three.js を用いた校内3Dモデル作成のためのエディタUI画面 (v0.1.0 バージョンヘッダー適用)
- `main/map_editor/editor.js`: 建物の配置、形状編集（頂点操作・押し出し）、プロパティ管理、JSONエクスポート等のエディタ機能を制御するメインロジック (v0.1.0 バージョンヘッダー適用)
- `main/map_editor/editor.css`: エディタのツールバー、サイドパネル、頂点編集用補助UIなどのデザインを定義する専用スタイルシート (v0.1.0 バージョンヘッダー適用)
- `main/lastyear/`: 前年度（南陵祭'25）の公式サイトのアーカイブ資料（`index.html`, `data.js`等） (v0.1.0 バージョンヘッダー適用)
- `main/map_admin/editor.html`: MapLibre GL JS を使用した、フロアマップのエリア定義（GeoJSON）作成・編集ツール (v0.1.0 バージョンヘッダー適用)
- `map-experiments/`: 3Dマップの表示・操作・AI連携（Gemini）などの技術検証用プロトタイプ（`testmap1.html`, `testmap2.html`） (v0.1.0 バージョンヘッダー適用)

### 変更 (Changed)

- `japanese_workflow` に変更履歴記録プロセスを追加

### �ǉ� (Added)

- `main/stage-list.html`: ��N�x�̃f���A���r���[ UI (�K���g�`���[�g + �^�C�����C�����X�g) ���ڐA���A2026�N�� App Shell ����уf�U�C���V�X�e�� (�O���X���[�t�B�Y���A�_�[�N���[�h) �ɓK���������X�e�[�W���\�ꗗ�y�[�W��ǉ�

- `main/stage-list.html`: ��於�� (projectData) �ɂȂ��c�̂ł��ڍ׃y�[�W���Q�Ƃł���悤�A�ڍ׃{�^�������ׂẴX�e�[�W�C�x���g�ɕ\������悤���P
