# タスク: projects-list.html の場所クリック時のマップ遷移削除

- [x] 現状の調査と仕様確認
  - [x] `main/projects-list.html` 内の場所表示 (`card-place`) のリンク処理特定
- [x] `main/projects-list.html` の修正
  - [x] 場所表示の `<a>` リンクタグを削除し、クリックしても map.html へ遷移しない `<div class="card-place">` へ変更
- [x] 動作確認・検証
  - [x] E2Eテストスイート実行（49/49 100% PASS）
- [x] 知識の永続化と変更履歴の記録
  - [x] `CHANGELOG.md` の更新（v1.0.16）
  - [x] `version.json` の更新（1.0.16）
