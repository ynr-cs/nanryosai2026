# 変更履歴 (Change Log)

本プロジェクトにおけるすべての重要な変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づき、
バージョン管理は [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠します。

## [0.1.0] 変更履歴システムの始動 - 2026-02-05

### メタ情報

- **時刻**: 17:40
- **AIモデル**: Gemini 3.0 Pro
- **筆者**: User (uokun)

### 追加 (Added)

- `CHANGELOG.md` の作成と運用ルールの策定
- Semantic Versioning (v0.1.0) の導入
- `404.html`: 存在しないページへのアクセス時に表示されるエラーページ (v0.1.0 バージョンヘッダー適用)
- `debug_firestore_custom.js`: Firestore のデータを取得・確認するためのデバッグ用ユーティリティスクリプト (v0.1.0 バージョンヘッダー適用)
- `generate_hash.js`: 店舗用パスワードのハッシュとソルトを生成するためのユーティリティスクリプト (v0.1.0 バージョンヘッダー適用)
- `functions/index.js`: 受付番号発行、注文作成、決済処理、店舗認証などのコアロジックを担う Cloud Functions (v0.1.0 バージョンヘッダー適用)

### 変更 (Changed)

- `japanese_workflow` に変更履歴記録プロセスを追加
