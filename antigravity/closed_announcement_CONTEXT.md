---
title: 文化祭全日程終了に伴う終了お知らせ画面・全頁リダイレクト仕様
tags: [closed, announcement, redirect, lastyear]
status: active
last_updated: 2026-09-13
---

# 文化祭全日程終了に伴う終了お知らせ画面・全頁リダイレクト仕様

## 1. 概要

南陵祭2026（スローガン「南陵祭楽しすぎて滅」）が全日程（校内発表・一般公開・後夜祭）を終了したことに伴い、全来場者向け画面へのアクセスを終了お知らせ画面（`main/closed.html`）へ自動リダイレクトし、感謝メッセージと各種アンケート（コンピュータ科学部アンケート、生徒会人気投票）を案内する仕様。

---

## 2. デザイン設計（lastyear/index.html 準拠）

前年度（南陵祭2025: `main/lastyear/index.html`）の設計思想を踏襲：

- **ナビゲーションUIの完全撤廃**:
  - グローバルヘッダー（ハンバーガーメニュー含む）は読み込まない・表示しない。
  - ボトムナビゲーション（タブバー）は表示しない。
  - フッターサイトマップは表示しない。
  - `app-shell.js` を読み込まず、完全なスタンドアロン構成とする。
- **視覚表現（南陵祭2026デザインシステム準拠）**:
  - フルスクリーン中央配置（`min-height: 100vh; display: flex; align-items: center; justify-content: center;`）
  - `main/style.css` のセマンティックカラー（`--bg-color`, `--card-bg`, `--text-main`, `--text-sub` 等）およびブランドカラー（`--primary-color: #6a11cb`, `--primary-gradient`）に完全準拠
  - 背景に今年のアンビエントオーブ（パープル・ブルーのふんわりとした光のボケ効果）
  - 右上にライト／ダークモード切替ボタン（`#theme-toggle`）を配置し、`localStorage('app-theme')` および `data-theme` 属性と連動
  - ステータスバッジ（`全日程終了`）
  - 大見出し（`南陵祭'26 Webサイト ご利用ありがとうございました！`）
  - 感謝メッセージ（スローガン「南陵祭楽しすぎて滅」の結びと感謝）
  - 2大CTAボタン（`white-space: nowrap` で文字折り返しを抑止）:
    - **コンピュータ科学部 アンケート**: サイトやシステムへの意見・感想（Google Forms）
    - **生徒会 人気投票**: 推し企画・ベスト企画への投票（Google Forms）
  - クレジット（`制作・運営：横浜南陵高校 コンピュータ科学部`）

---

## 3. 全頁リダイレクト仕様

- **実装箇所**:
  1. `main/app-shell.js`:
     - `checkClosedRedirect()` メソッドを `init()` の先頭で実行。
     - アクセス先が `closed.html` 以外であり、管理系（`admin/` 配下、`admin_sync.html`）でなく、かつ URL クエリパラメータに `bypass`（例: `?bypass=1`）が存在しない場合、`window.location.replace(this.resolvePath("closed.html"))` により即座に転送。
  2. `main/index.html`:
     - `<head>` 内のインラインスクリプトにより、HTMLパース初期段階で即座に `closed.html` へ転送（高速化・画面チラつき防止）。
- **開発・検証用バイパス**:
  - URL に `?bypass=1`（または `?bypass=true`）を付与することで、リダイレクトを回避して各ページの表示確認が可能。

---

## 4. 関連ファイル

- `main/closed.html`: 終了お知らせページ本体
- `main/app-shell.js`: 全頁リダイレクト制御
- `main/index.html`: トップページ即座リダイレクト
- `main/lastyear/index.html`: 参考元の前年終了ページ
