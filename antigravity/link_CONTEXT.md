---
title: アクセス経路（リンクパラメータ）設計
tags: [analytics, marketing, qr]
status: active
last_updated: 2026-07-10
---

# アクセス経路（リンクパラメータ）設計

QRコードの読み取りやすさ（ドットの粗さ）を確保しつつ、アクセス経路をトラッキングするための短縮パラメータ（`?s=xxx`）の仕様。

## 1. 仕組み

1. 各媒体には `https://ynr-cs.github.io/nanryosai2026/main/index.html?s=●●` という短縮URLを掲載・QRコード化する。
2. `main/auth.js` 内でページロード時に `s` パラメータを検知する。
3. 検知した場合、Firebase Analytics に対して `qr_scan` イベントとして送信する（プロパティ: `source_type`）。
4. 送信直後に `history.replaceState` を用いてアドレスバーから `?s=xxx` を削除し、ユーザーにはクリーンなURLを見せる。

## 2. パラメータマッピング定義

以下は `main/auth.js` で定義されている短縮パラメータと送信されるデータのマッピングです。
新しい経路を追加する場合は、このドキュメントと `auth.js` の `sourceMap` の両方を更新してください。

| 流入経路 (媒体)     | 短縮パラメータ (`s=`) | Analytics送信時の `source_type` 値 | 備考・用途                                                |
| :------------------ | :-------------------- | :--------------------------------- | :-------------------------------------------------------- |
| **校内ポスターQR**  | `po`                  | `poster`                           | 階段や廊下などに貼るポスター用                            |
| **パンフレットQR**  | `pf`                  | `pamphlet`                         | 来場者全員に配布されるパンフレット用                      |
| **店舗前QR**        | `st`                  | `store_front`                      | 各団体の店舗の前に掲示するQR用                            |
| **Classroomリンク** | `cr`                  | `classroom`                        | 在校生向けにClassroom等で告知するリンク用                 |
| **Instagram**       | `ig`                  | `instagram`                        | 生徒会・南陵祭公式Instagramのプロフィールやストーリーズ用 |

> **Note**: Firebase Analytics 側では、イベント名 `qr_scan` とパラメータ `source_type` で集計を行います。
