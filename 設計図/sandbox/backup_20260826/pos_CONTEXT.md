---
title: POS (Point of Sales) アプリケーション共通仕様
tags: [pos, context, spec]
status: active
last_updated: 2026-04-26
---

# POS (Point of Sales) アプリケーション共通仕様

### 認証ガード (Auth Guard)
- **監視**: 全スタッフツール（`pos`, `monitor`, `kitchen`, `presenter`）の起動時に `onAuthStateChanged` を監視。
- **リダイレクト**: 以下の条件に該当する場合、`portal.html` へ強制リダイレクトする。
  - ログインしていない。
  - ログインドメインが `@gl.pen-kanagawa.ed.jp` ではない。
  - ログイン中の店舗ID (`storeId` Claim) と URLパラメータの `s` (Store ID) が一致しない。
- **パラメータの継承**: リダイレクト時、元のページURL (`return`) と店舗ID (`s`) をパラメータとして保持し、ポータルでのログイン後に元の画面へ戻れるように制御。
