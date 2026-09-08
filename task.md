# タスク: マップ機能の準備中状態への変更（未完成に伴う導線・UIの準備中化）

- [x] 影響箇所の調査と洗い出し
  - [x] `main/detail.html`（マップタブ・ボタン）
  - [x] `main/projects-list.html`（企画カードの場所リンク）
  - [x] `main/stage-list.html`（ステージカードの場所リンク）
  - [x] `main/app-shell.js`（ハンバーガーメニュー、フッターリンク）
  - [x] `main/map.html`（開発用直接アクセスの維持）
- [x] 実装計画の作成 (`implementation_plan.md`)
- [x] ユーザー承認
- [x] 実装
  - [x] `data.js` に `IS_MAP_ENABLED = false` フィーチャーフラグを設置
  - [x] `detail.html` のマップタブを「準備中」プレースホルダーへ切り替え
  - [x] `projects-list.html` の場所リンクをフラグ連動で非リンク化
  - [x] `stage-list.html` の場所リンクをフラグ連動で非リンク化
  - [x] `app-shell.js` のメニュー・フッターのマップリンクに「準備中」を明記＆トースト案内
- [x] 動作確認と検証
- [ ] CHANGELOG.md (v0.5.244) の更新
- [ ] antigravity 知識の同期
