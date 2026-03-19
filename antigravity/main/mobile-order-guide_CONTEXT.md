---
title: Mobile Order Guide Context (Japanese Edition)
tags: [main, guide, tech]
status: active
last_updated: 2026-03-19
---

# Mobile Order Guide Context (Japanese Edition)

## 概要

`main/mobile-order-guide.html` は、南陵祭モバイルオーダーシステムの技術仕様書である。
ユーザーの指示により、FAQを廃止し、より技術的な「数値表現とフロート化」に関する章へ差し替えた。また、特定の組織名表記を削除し、純粋な技術文書としての体裁を整えている。

## 章構成

1-12章 (Standard Tech Stack + Internal API)

- 詳細は前版サマリを参照。

13. **技術用語集 (Glossary)**
    - ACID, Idempotency, etc.

14. **数値表現とフロート化 (Numeric Precision)**
    - **IEEE 754**: JSの浮動小数点数仕様。
    - **Currency Arithmetic**: `0.1 + 0.2` 問題と、整数化 (`Math.floor`) による解決策。
    - **Data Type**: Firestore上の `Integer` 型強制。

## 意図

「よくある質問」のような一般的なコンテンツを排し、代わりに「浮動小数点数の丸め誤差」という、より低レイヤーでエンジニアリング色の強いトピックを配置することで、ドキュメント全体の「技術的重厚感」を演出する。
