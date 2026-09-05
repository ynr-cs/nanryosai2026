# Webサイト・企画一覧・モバイルオーダー パフォーマンス最適化・オプティミスティック描画 仕様（知識ベース）

本ドキュメントは、南陵祭2026（`nanryosai-2026`）における回遊時のパフォーマンス低下（画像の遅延、企画一覧の遅延、モバイルオーダーの遅延）を解消するために実装されたアーキテクチャ・最適化仕様の永続化記録です。

---

## 1. 最適化アーキテクチャサマリー

| 機能領域 | 導入された最適化 | 実装ファイル | 効果 |
|---|---|---|---|
| **画像アセット** | `images/original/` 放り込み＋Git pre-commitフックによるWebP自動リサイズ＆圧縮 | `scripts/process-assets.js`, `.git/hooks/pre-commit` | 1.41MBの元画像が50KBへ（**-96.3%削減**） |
| **Changelog** | コミット時 `version.json` 自動生成 ＆ ドロワーメニュー開封時遅延フェッチ | `scripts/process-assets.js`, `main/app-shell.js` | 全ページロード時の初期通信量を **660KB → 0KB** に完全削減 |
| **企画一覧** | `data.js` による0秒先行描画 ＋ 400ms人工遅延撤廃 ＋ Firestoreステータス差分反映 | `main/projects-list.html` | ページアクセス時 **0msで即時全件表示**、タブ・フィルタ切り替えも瞬時反映 |
| **ステージ発表** | タイムラインリストの0秒先行描画 ＋ お気に入り星マーク差分反映 | `main/stage-list.html` | ガントチャートとタイムラインリストを **0msで同時即時表示** |
| **モバイルオーダー** | ウォークスルー閲覧中のメニュー先行プリロード ＆ プロファイル/FCM保存の非同期化 | `pos/mobile-order.html` | 規約同意ボタンを押した瞬間に **0秒でメニューが開く** |
| **共通インフラ** | Firestore IndexedDB 永続ローカルキャッシュ（`persistentLocalCache`） | `main/auth.js` | MPA回遊時のドキュメント再取得がキャッシュから即時返却 |

---

## 2. 各機能の詳細仕様

### (1) 画像自動WebP変換ワークフロー
- **運用方法**:
  - `images/original/` ディレクトリに元画像（JPG/PNG等）を配置する。
  - `git commit` を実行すると、pre-commit フック経由で `node scripts/process-assets.js` が自動起動。
  - 幅・高さ上限 800px（アスペクト比維持、拡大なし）にリサイズし、WebP品質82で `images/*.webp` を出力。
  - 生成された WebP ファイルおよび `version.json` が自動でステージングに追加されてコミットされる。

### (2) Changelog最新バージョン超軽量表示
- `CHANGELOG.md` を全ページアクセス時に fetch する旧実装を廃止。
- `scripts/process-assets.js` が `CHANGELOG.md` の先頭から最新バージョン番号（例: `0.5.225`）を抽出し、ルートに極小の `version.json`（約20バイト）を出力。
- `main/app-shell.js` は、ユーザーが右上のハンバーガーメニューを開いた瞬間（`toggleMenu`）に `version.json` を取得して `v0.5.xxx` を表示。取得結果は `sessionStorage` にキャッシュされるため、同一セッション内の通信は1回のみ。

### (3) 企画一覧（`projects-list.html`）
- **0秒先行描画（オプティミスティックUI）**:
  - 初期化時、スケルトン表示によるブロッキングを廃止し、ローカルの `data/data.js` から直ちに `applyFiltersAndSort(false)` を呼び出して全カードを画面展開。
  - カード画像は `images/${project.id}.webp` を参照し、`loading="lazy"` を付与。
  - 店舗営業ステータス（`stores`）とお気に入り星マークは、後から非同期で取得完了したタイミングで DOM を差分更新。
- **400ms 人工遅延の撤廃**:
  - フィルタ・ソート・学年タブの切り替え処理内の `setTimeout(..., 400)` を完全削除し、タップ即座に結果を反映。

### (4) ステージ発表一覧（`stage-list.html`）
- `initializePage()` 内で、認証（`watchUser`）およびお気に入り取得の完了を待たずに `renderPage(initialDay, true)` を直ちに実行。
- ガントチャートとタイムラインリストの両方が 0ms で画面に表示される。
- お気に入り星マーク（★）は、`watchUser` 解決後に最新の状態にパッチ更新される。

### (5) モバイルオーダー（`mobile-order.html`）
- **安全性と業務ロジックの100%維持**:
  - 生徒認証チェック（`getClaims`）、アクティブ注文の重複防止（`status.html` へのリダイレクト）、5画面ウォークスルーの毎回表示は一切崩さず維持。
- **メニュー先行プリロード**:
  - 生徒判定と注文チェックを通過したら、直ちにウォークスルーを表示（スピナー `global-loader` を解除）。
  - ウォークスルーが表示され、ユーザーがスライド1〜5を読んでいる裏側で、並行して `loadStores()` を実行してメモリ内に保持。
  - ユーザーがスライド5で「同意して注文へ進む」を押した際には、既にデータが揃っているため 0 秒で店舗・メニュー画面が即座に開く。
- **バックグラウンド処理の非同期化**:
  - `updateUserProfile` および `saveToken`（FCMトークン取得・保存）は直列 await を解除し、Fire-and-forget で非同期実行。
- **本番404エラーの解消**:
  - `config.local.js` を `location.hostname` 判定によりローカル環境のみ動的読み込みに変更。
  - オフライン調理団体カードの画像パスを `.webp` 参照に更新し、`loading="lazy"` を付与。

### (6) Firestore IndexedDB 永続キャッシュ (`main/auth.js`)
- `initializeFirestore` ＋ `persistentLocalCache`（`persistentMultipleTabManager`）を有効化。
- これにより、ブラウザをリロードしたり別ページへ遷移したりしても、一度取得した Firestore ドキュメント（`stores`, `orders`, `system_alerts` 等）が端末内の IndexedDB に残り、2回目以降のアクセスでは通信待ちなし（0ms）で即時データが返却される。

### (7) 画像WebP変換のピクセル制限撤廃とDOM差分パッチ化（v0.5.226）
- **ピクセル制限の撤廃**:
  - `scripts/process-assets.js` で `.resize()` を削除。元画像の解像度・アスペクト比を100%完全維持したまま高効率WebP圧縮を実施。
- **DOM差分パッチ化によるnoimage点滅解消**:
  - 初期化時（`applyFiltersAndSort`）で一度カードをDOM生成した後は、Firestoreの `stores` 取得や `watchUser` 解決時に `innerHTML` を全再生成するのを廃止。
  - `updateStoreStatusesDOM()` および `updateFavoritesDOM()` により、営業バッジとお気に入り星マークのみを差分パッチ。
  - カード画像要素（`<img>`）が再生成されず維持されるため、初期表示後の noimage 点滅（フリッカー）を100%根絶。

