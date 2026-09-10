# タスク: 団体写真追加に向けた関連ファイル分析と受入・反映体制の整備

- [x] 関連ファイル・画像仕様の調査と分析 <!-- id: 0 -->
  - [x] 画像配置・変換ワークフロー（`images/original/`, `scripts/process-assets.js`）の確認
  - [x] 画面別（`detail.html`, `projects-list.html`, `index.html`, `account.html`）の画像読み込み仕様の分析
  - [x] 企画IDと団体名・企画名のマッピング整理（全47団体）
- [x] フォーム提出画像（images/form）の完全分析と対応表の作成 <!-- id: 1 -->
  - [x] CSV回答（9件・8団体）と提出ファイル（メイン9件、ギャラリー25件、商品2件）の照合
  - [x] 各画像の解像度・フォーマット（HEIC/JPEG/PNG）および企画IDとの紐付け特定
  - [x] 1年7組の再提出（差分・最新版判定）の精査
  - [x] ギャラリー画像の格納仕様・命名設計の策定
- [x] ユーザー承認後の画像反映作業 <!-- id: 2 -->
  - [x] メイン画像（8団体）の `images/original/` への配置と `process-assets` (WebP化)
  - [x] ギャラリー画像（計21枚）の配置・WebP化と `data.js` の `gallery` 配列への登録
  - [x] 1年7組のアイス商品画像・メニュー登録
  - [x] `index.html` および `account.html` の WebP 優先読み込み対応
  - [x] 全画像アセットリンクの実在・整合性自動検証
  - [x] 知識の永続化（`data_CONTEXT.md`, `performance_audit_CONTEXT.md`）と `CHANGELOG.md` (v0.5.299) の更新
