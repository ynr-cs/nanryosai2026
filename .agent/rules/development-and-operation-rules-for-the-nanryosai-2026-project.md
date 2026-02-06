---
trigger: always_on
---

---

## 南陵祭2026プロジェクト（nanryosai-2026）専用の開発・運用ルール

# 南陵祭2026 (Nanryosai 2026) 開発ルール

このプロジェクトは、南陵祭2026の公式Webサイトおよび運営システム（ポータル・POS）を構築するものです。
`japanese_workflow` スキルをベースに、本プロジェクト特有の構成（Firebase, Vanilla JS/CSS, 3部構成のアプリ）に最適化されています。

## 基本方針

1.  **全言語日本語**: コミュニケーション、ドキュメント、コミットメッセージ等は**全て日本語**で行う。
2.  **Mobile First**: 文化祭来場者の大多数はスマートフォンを使用する。全てのUIは**スマホでの操作性**を最優先する。
3.  **Security First**: Firebase（Firestore/Storage）のセキュリティルールを厳守し、意図しないデータ流出や改ざんを防ぐ。
4.  **Vanilla Web Standard**: ビルドツールに過度に依存せず、標準的な HTML/CSS/JavaScript で構成する。

## プロジェクト構成の理解

開発を行う際は、以下のディレクトリ構成と役割を意識してください：

- **`main/` (来場者用)**: 一般公開されるWebサイト。高速な読み込みと魅力的なUI/UXが必要。
  - `style.css`: 全体のデザインシステム。これを再利用する。
- **`pos/` (店舗運営用)**: 模擬店などが使用するモバイルオーダー・管理画面。実用性と堅牢性が重要。
- **`admin/` (実行委員用)**: 全体を管理するダッシュボード。
- **`functions/`**: 決済処理や集計などのバックエンドロジック。
- **`antigravity/`**: プロジェクトの知識ベース。**ここに仕様を永続化する。**

## 開発ワークフロー

### 1. 前提知識の確認 (Context Loading)

タスク開始前に `antigravity/` 内の `_CONTEXT.md` ファイルを確認し、既存の仕様や設計思想を把握する。

### 2. タスク管理 (Task Management)

`task_boundary` を使用し、`task.md` でタスクを定義する。
**軽微な修正(Fast Track)を除き、必ず実装計画を作成する。**

### 3. 実装計画 (Implementation Plan)

`implementation_plan.md` を作成する際、以下の点は特に注意して記述する：

- **Firebaseへの影響**: `firestore.rules`, `storage.rules`, Indexes などの変更が必要か？
- **UI/UXへの影響**: ダークモード時の表示、レスポンシブ挙動（特にスマホ幅）。
- **既存コードとの整合性**: `main/style.css` や `main/auth.js` などの共通資産を利用しているか。

### 4. ユーザー承認 & 実装

`notify_user` で計画を提示し、承認後に実装を行う。

### 5. 知識の永続化 (Knowledge Sync) - **最重要**

タスク完了後、作業中の `task.md` や `implementation_plan.md` は捨て、**`antigravity/` フォルダ内の適切な md ファイルに知識を統合する。**

- **`antigravity/firebase_CONTEXT.md`**: DB設計、セキュリティルール、Functions仕様
- **`antigravity/mobile-order_CONTEXT.md`**: モバイルオーダー仕様
- **`antigravity/design_CONTEXT.md`**: デザインシステム、UIガイドライン
- **その他適切なファイル**: なければ新規作成する。

## 特記事項 (Nanryosai Special Rules)

- **ダークモード完全対応**: `var(--bg-color)` などのCSS変数を活用し、システム設定に連動させる。
- **パフォーマンス**: 画像はWebP推奨、不要なライブラリ読み込みを避ける。
- **エラーハンドリング**: ネットワーク不安定な環境（学校祭当日）を想定し、通信エラー時の再試行やユーザーへのフィードバックを実装する。

---

**合言葉は「生徒も来場者も使いやすく、安全に」**
