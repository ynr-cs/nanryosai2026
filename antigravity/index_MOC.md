---
title: インデックス（MOC）
tags: [index, moc]
status: active
last_updated: 2026-03-19
---

# 南陵祭2026 知識ベース (MOC)

このページは `antigravity/` フォルダにあるすべてのドキュメントへのインデックス（Map of Content）です。
ここから各仕様書へアクセスしてください。

## ⚙️ 共通アーキテクチャ・基盤設定
- [[architecture_CONTEXT]]: 全体のシステム構成と設計方針
- [[設計図/南陵祭2026 POS・モバイルオーダーシステム 設計計画書.md]]: POS・モバイルオーダーの詳細設計計画書
- [[設計図/南陵祭2026 モバイルオーダー・POSシステム 導入提案書.md]]: 学校側への導入提案用ドキュメント
- [[設計図/scrap/README]]: アイデア・備忘録 (scrap)
- [[firebase_CONTEXT]]: データベース設計、認証、セキュリティルール、Functions
- [[data_sync_CONTEXT]]: キャッシュ戦略、オフライン対応、データ同期機構
- [[design_CONTEXT]]: デザインシステム、共通CSS、UIガイドライン
- [[migration_CONTEXT]]: v0.1.0への移行や仕様変更のガイド
- [[AI_CONTEXT]]: AIエージェントの基本振る舞いやルール
- [[obsidian_GUIDE]]: Obsidian 使用ガイド（本最適化の基準）

## 🌐 メインサイト (main/)
一般来場者向けのWebアプリケーション。
- [[main\index_CONTEXT]]: トップページ仕様
- [[main\account_CONTEXT]]: アカウント管理、ログイン
- [[main\data_CONTEXT]]: メインサイト用のデータ構造とフック
- [[main\list_pages_CONTEXT]]: 一覧ページ（模擬店、企画など）
- [[main\info_pages_CONTEXT]]: 詳細ページ（各店舗・企画の詳細）
- [[main\map_implementation_CONTEXT]]: マップ・ルート案内の実装 (V1)
- [[map-2d_CONTEXT]]: 2Dキャンパスマップシステム アーキテクチャ (V3 Leaflet版)
- [[map_v3_master_record_CONTEXT]]: 2Dキャンパスマップ (V3) 試作開発・設計・全262件テスト・監査完全マスターレコード
- [[map_v3_test_specifications]]: 2Dキャンパスマップ (V3) 全262件 E2Eテスト仕様 & 検証一覧
- [[map_system_status]]: マップシステム変遷 & ステータス
- [[map-3d_CONTEXT]]: 3Dマップシステム アーキテクチャ (V2エディタ基盤)
- [[main\mobile-order-guide_CONTEXT]]: モバイルオーダーの利用ガイド
- [[main\terms_CONTEXT]]: 利用規約・プライバシーポリシー

## 🍔 POS・運営システム (pos/)
模擬店や運営が使用する管理システム。
- [[pos\portal_CONTEXT]]: 店舗用ポータルサイト（ダッシュボード）
- [[pos\pos_CONTEXT]]: POSレジ画面
- [[pos\kitchen_CONTEXT]]: キッチン用オーダー管理画面
- [[pos\mobile-order_status_CONTEXT]]: モバイルオーダーのステータス管理
- [[pos\monitor_CONTEXT]]: 顧客向け呼出モニター畫面

## ✍️ ワークフロー・手順書
- [[WORKFLOW_add_store]]: 店舗・企画の追加手順（admin連携）

---
※リンクをクリックして各詳細ページへ移動してください。
