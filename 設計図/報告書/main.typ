#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  header: align(right)[
    #text(9pt, fill: luma(120))[南陵祭2026 POS・モバイルオーダーシステム 活動報告書]
  ],
  footer: [
    #align(center)[#counter(page).display()]
  ]
)

#set text(
  font: ("IPAexGothic", "Yu Gothic", "MS Gothic", "Hiragino Kaku Gothic ProN", "Harano Aji Mincho"),
  size: 10pt,
  lang: "ja"
)

#set par(justify: true, leading: 0.8em)
#set heading(numbering: "1.1.")

// --- 表紙 ---
#align(center + horizon)[
  #v(-3cm)
  #text(12pt, weight: "bold", fill: rgb("#2b5c8f"))[神奈川県立横浜南陵高校 コンピュータ科学部]
  
  #v(1cm)
  #text(24pt, weight: "bold")[南陵祭2026 \ ウェブサイト・モバイルオーダーシステム \ 活動報告書]
  
  #v(1cm)
  #text(12pt, fill: luma(100))[〜 運用実績・データ分析・技術的振り返り 〜]

  #v(3cm)
  #line(length: 50%, stroke: 0.5pt + rgb("#2b5c8f"))
  #v(0.5cm)
  #text(11pt)[
    *発行日:* 2026年9月30日（★仮） \
    *発行:* コンピュータ科学部 \
    *対象:* 部内記録・来年度引き継ぎ・自己記録用 \
    *開催期間:* 2026年9月12日（土）〜9月13日（日）（★仮） \
    *バージョン:* 1.0.0 (Draft)
  ]
]

#pagebreak()

// --- 目次 ---
#outline(title: [目次], indent: auto)
#v(1cm)

// --- はじめに ---
#pagebreak()
= はじめに
第24回南陵祭において、コンピュータ科学部は公式ウェブサイト（来場者向けポータル）および独自開発のPOS・モバイルオーダーシステムを試験導入した。従来の紙の整理券・紙伝票・手動決済による運用を、来場者のスマートフォンとクラウド基盤に置き換える試みである。本書は、その準備から当日運用、そして得られた成果と反省を記録する。

本報告書は活動の実績と振り返りを記録するものである。システムの技術仕様は『南陵祭2026 ウェブサイト・モバイルオーダーシステム 設計計画書』および『設計憲法』に委ね、本書では重複を避ける。★印の数値・記述は集計確定後に差し替える暫定値である。

導入の狙いは来場者への円滑な企画情報の発信、人気店舗での行列と通路混雑の緩和、紙伝票に起因する注文ミスと集計負荷の削減、そして学校方針である現金取扱廃止への対応である。これらがどの程度達成されたかを、本書で検証する。

試験導入という位置づけのため、利用は希望する6団体に限定し、障害時は即座に紙運用へ切り替えられる体制を敷いた。結論を先に述べれば、システムは大きな停止なく2日間を完走し（★仮）、モバイルオーダーは一定の混雑緩和効果を示した一方、想定していなかった運用上の課題も複数表面化した。

= 開催概要
#figure(
  table(
    columns: (1fr, 3fr),
    align: (left, left),
    [*項目*], [*内容*],
    [開催日], [2026年9月12日〜13日（★仮）],
    [来場者数], [約2,400名（2日間合計・★仮）],
    [利用団体], [6団体（★仮）],
    [対応注文経路], [公式Webサイト / モバイルオーダー / SOK / 有人POS],
    [決済手段], [AirPay 手動QRコード決済],
    [運用体制], [各団体スタッフ ＋ コンピュータ科学部当日サポート],
  ),
  caption: [開催概要]
)

利用団体は食品販売を行う6団体で、いずれも過去に紙運用を経験している。SOK端末は各団体にiPadを設置し、モバイルオーダーは在校生（\@gl.pen-kanagawa.ed.jp）に限定、POSはスマートフォン非所持者向けの例外経路とした。

= 準備の記録（開催前）
== スケジュール
#figure(
  table(
    columns: (1fr, 3fr),
    align: (left, left),
    [*時期*], [*内容*],
    [5月], [設計計画書・設計憲法の策定],
    [6〜7月], [実装（フロントエンド・Cloud Functions）],
    [8月], [内部テスト・データモデル確定],
    [9月上旬], [利用団体へのトレーニング、対面リハーサル],
    [9月前日], [最終動作確認、放置ペナルティ機構の有効化],
  )
)

== トレーニングとリハーサル
各団体のスタッフ全員が全ポジション（レジ・厨房・提供口・ポータル管理）を操作できることを目標に、`portal.html` 内のトレーニング機能を用いて習熟を図った。開催数日前には対面リハーサルを実施し、各団体から最低1名が実機シミュレーションに参加した（★仮：参加◯名）。

リハーサルで最重要事項として繰り返し強調したのは、提供口でのAirPay決済金額の目視照合である。これはシステムが原理的に防げない金額改ざんに対する唯一の防御であり、当日の徹底度が実績に直結すると見込んでいた。

== 計測設計
開催後の分析を確実にするため、事前に取得データを設計した。Googleアナリティクスでページビュー・モバイルオーダー画面到達率・注文完了率・経路別流入を計測し、Firestoreの注文記録からは経路別注文数・時間帯分布・処理時間・キャンセル率を集計する方針とした。データモデルが各工程のタイムスタンプ（`createdAt` / `readyToServeAt` / `readyForPickupAt` / `completedAt`）を保持するため、調理時間や受取待ち時間まで分析可能な設計とした。

#pagebreak()
#align(center)[
  #text(16pt, weight: "bold")[第 II 部 運用実績と分析]
]
#v(1cm)

#v(1cm)

= ウェブサイト（ポータル）運用実績
南陵祭期間中における公式Webサイト（来場者向けポータル）へのアクセス状況および主な利用動向のまとめである。

#figure(
  table(
    columns: (1fr, 2fr, 2fr),
    align: (center, center, center),
    [*項目*], [*数値 / 実績（★仮）*], [*備考*],
    [総アクセス数 (PV)], [52,300 PV], [事前〜当日2日間の合計],
    [ユニークユーザー (UU)], [14,200 人], [スマートフォン率: 92%],
    [ピーク時間帯], [2日目 12:00〜13:00], [企画検索・マップ参照が集中],
  ),
  caption: [Webサイトアクセス統計（★仮）]
)

#figure(
  box(width: 100%, stroke: 0.5pt + luma(200), inset: 12pt, radius: 4pt)[
    #grid(
      columns: (80pt, 1fr, 50pt),
      gutter: 10pt,
      align: (left + horizon, left + horizon, right + horizon),
      [トップページ], rect(width: 100%, height: 14pt, fill: rgb("#3b82f6"), radius: 3pt), [45%],
      [企画一覧], rect(width: 65%, height: 14pt, fill: rgb("#60a5fa"), radius: 3pt), [28%],
      [マップ], rect(width: 40%, height: 14pt, fill: rgb("#93c5fd"), radius: 3pt), [15%],
      [モバイルオーダー], rect(width: 25%, height: 14pt, fill: rgb("#bfdbfe"), radius: 3pt), [10%],
      [その他], rect(width: 5%, height: 14pt, fill: rgb("#e2e8f0"), radius: 3pt), [2%],
    )
  ],
  caption: [ページ別アクセス比率（★仮）]
)

= モバイルオーダー・POS 当日運用実績
== エグゼクティブサマリー
第24回南陵祭において、本システムは延べ稼働時間 約16時間（2日間・★仮）を全面停止ゼロで完走した（★仮）。総注文数1,180件、総売上約720,000円を処理し（★仮）、全処理の約85%を来場者セルフサービス経路（モバイルオーダー＋SOK）が担った（★仮）。従来の紙運用比で、閉店後の集計作業時間を推定◯時間から実質ゼロへ削減した（★仮）。

一方、混雑ピーク帯（11:00–13:00）に運用課題が集中し、調理待ち時間の伸長、SOK認証離脱、金額照合の形骸化という3点が顕在化した（★仮）。これらはいずれもコードの欠陥ではなく、人的運用と来場者体験の設計に起因する。

#figure(
  table(
    columns: (2fr, 1fr, 1fr, 1fr),
    align: (left, right, right, center),
    [*KPI*], [*実績*], [*事前目標*], [*達否*],
    [全面停止時間], [0分], [0分], [○],
    [総注文数], [1,180件], [1,000件], [○],
    [注文完了率], [62%], [70%], [△],
    [放置率], [1.1%], [\<2%], [○],
    [集計作業削減], [実質ゼロ], [大幅減], [○],
    [金額照合徹底率], [◯%], [100%], [△],
  )
)

== 稼働タイムライン（2日間）
#figure(
  table(
    columns: (auto, ..range(8).map(_ => 1fr)),
    align: center,
    stroke: 0.5pt + luma(200),
    fill: (x, y) => if y == 0 { rgb("#f0f4f8") } else { none },
    [*日程*], [*9時*], [*10時*], [*11時*], [*12時*], [*13時*], [*14時*], [*15時*], [*16時*],
    [*1日目*],
    table.cell(fill: rgb("#e2e8f0"))[立上],
    table.cell(fill: rgb("#fef08a"))[軽微],
    table.cell(fill: rgb("#fca5a5"))[高負荷],
    table.cell(fill: rgb("#fca5a5"))[高負荷],
    table.cell(fill: rgb("#fef08a"))[軽微],
    table.cell(fill: rgb("#bbf7d0"))[正常],
    table.cell(fill: rgb("#bbf7d0"))[正常],
    table.cell(fill: rgb("#bbf7d0"))[正常],
    [*2日目*],
    table.cell(fill: rgb("#e2e8f0"))[立上],
    table.cell(fill: rgb("#bbf7d0"))[正常],
    table.cell(fill: rgb("#fca5a5"))[高負荷],
    table.cell(fill: rgb("#fca5a5"))[高負荷],
    table.cell(fill: rgb("#bbf7d0"))[正常],
    table.cell(fill: rgb("#bbf7d0"))[正常],
    table.cell(fill: rgb("#fef08a"))[軽微],
    table.cell(fill: rgb("#bbf7d0"))[正常],
  ),
  caption: [稼働状況ヒートマップ（★仮）]
)
事象は開店直後（立ち上げの慣熟不足）とピーク（高負荷）に二極集中し、午後は安定した（★仮）。負荷そのものより「習熟度×不慣れ×混雑」の重なりが事象発生率を決定づけた。

== 基盤サービスの稼働レポート
#figure(
  table(
    columns: (1.5fr, 1fr, 1fr, 1fr, 1fr),
    align: (left, center, left, left, center),
    [*基盤*], [*稼働率（★仮）*], [*エラー/事象*], [*無料枠消費（★仮）*], [*影響*],
    [Cloud Firestore], [100%], [広域障害なし], [読取◯% / 書込◯%], [─],
    [Cloud Functions], [◯%], [呼び出しエラー◯件], [呼出◯%], [軽微],
    [GitHub Pages], [100%], [配信障害なし], [─], [─],
    [Firebase Auth], [100%], [障害なし], [─], [─],
    [FCM], [◯%], [一部端末で不達], [─], [限定的],
    [App Check/reCAPTCHA], [─], [誤遮断ゼロ], [─], [─],
    [AirPay], [─], [サービス側障害なし], [─], [─],
  )
)
Firebase無料枠に対する消費は全項目で上限に到達せず（★仮：最大消費項目でも◯%）、コスト面では大きな余裕を残して運用できた。これは無料枠・静的ホスティング・Vanilla JSという低コスト構成の妥当性を実証する（★仮）。

== 経路別運用実態
各経路の当日挙動を、想定と実績の差分として整理する。
#figure(
  table(
    columns: (1fr, 2fr, 2fr, 2fr),
    align: (left, center, center, center),
    [*観点*], [*モバイルオーダー*], [*SOK*], [*有人POS*],
    [事前想定], [主要経路], [補助経路], [例外経路],
    [実績構成比（★仮）], [58%], [26%], [15%],
    [摩擦の主因], [校内回線遅延], [認証多段ステップ], [なし（対面）],
    [想定との差], [ほぼ想定通り], [離脱が想定超（★仮）], [想定通り],
  )
)

- *モバイルオーダー*: 在校生が事前にアカウントを保有するため認証摩擦が小さく、注文動線が最もスムーズだった（★仮）。ピーク帯で構成比がさらに上昇し（★仮58%→◯%）、混雑時ほど行列回避需要が強まる傾向を確認。校内一部エリアの回線遅延はシステム外要因であり、該当者にはSOK/POSを案内した。
- *SOK*: 一般来場者の受け皿として機能したが、最も摩擦が大きかった（★仮）。「端末選択→QR→スマホ認証→規約同意→確定」の多段のうち、スマホ認証で離脱が集中（★仮）。スタッフ補助でカバーしたが、その補助コストがピーク時の提供口を圧迫した。
- *有人POS*: 高齢来場者中心に想定規模で運用（★仮15%）。紙番号札で迷いが少ない反面、個人非特定ゆえ放置ペナルティ対象外という構造特性は当日も維持された。

== スタッフ運用体制の実際
「全員が全ポジション対応」を目標に準備したが、当日は役割が自然固定化した（★仮）。提供口とポータル管理が特定スタッフに集中し、離席時に一時停滞が発生（★仮）。コンピュータ科学部サポートはチャット常駐＋巡回で対応し、問い合わせ◯件・現地駆けつけ◯件を記録した（★仮）。

#figure(
  box(width: 100%, stroke: 0.5pt + luma(200), inset: 12pt, radius: 4pt)[
    #grid(
      columns: (110pt, 1fr, 40pt),
      gutter: 10pt,
      align: (left + horizon, left + horizon, right + horizon),
      [ネットワーク系], rect(width: 55%, height: 14pt, fill: rgb("#3b82f6"), radius: 3pt), [◯件],
      [操作方法質問], rect(width: 95%, height: 14pt, fill: rgb("#2563eb"), radius: 3pt), [◯件],
      [アカウント / BAN], rect(width: 30%, height: 14pt, fill: rgb("#60a5fa"), radius: 3pt), [◯件],
      [端末トラブル], rect(width: 45%, height: 14pt, fill: rgb("#93c5fd"), radius: 3pt), [◯件],
      [その他], rect(width: 15%, height: 14pt, fill: rgb("#cbd5e1"), radius: 3pt), [◯件],
    )
  ],
  caption: [サポート対応件数内訳（★仮）]
)

#pagebreak()
= 利用データ分析
全数値★仮。GA（Googleアナリティクス）と `orders` コレクションの集計確定後に差し替える。分析の切り口は確定済みのため、当日は「枠を埋める」ことに集中する。

== 全体サマリー
#figure(
  table(
    columns: (1fr, 1fr, 1fr),
    align: (left, right, left),
    [*指標*], [*数値（★仮）*], [*算出元*],
    [総注文数], [1,180件], [orders],
    [総売上], [720,000円], [AirPay],
    [平均単価], [610円], [売上÷注文],
    [総PV], [8,500], [GA],
    [ユニークユーザー], [3,200], [GA],
    [MO画面到達], [2,100], [GA],
    [注文完了率], [62%], [到達→確定],
    [キャンセル率], [4.2%], [cancelled÷注文],
    [放置率], [1.1%], [abandoned÷注文],
    [リピート注文率], [◯%], [同一userId複数注文],
  )
)

== 経路別内訳
#figure(
  table(
    columns: (1.5fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
    align: (left, right, right, right, right, right, right),
    [*経路*], [*注文数*], [*構成比*], [*売上*], [*平均単価*], [*キャンセル率*], [*放置率*],
    [モバイル], [690], [58%], [441,600], [640], [3.8%], [1.3%],
    [SOK], [310], [26%], [182,900], [590], [6.5%], [0.9%],
    [POS], [180], [15%], [111,600], [620], [2.1%], [─],
  )
)
SOKのキャンセル率が突出（★仮6.5%）し、前述の認証離脱と整合。POSは対面確認によりキャンセル率最低（★仮）、放置は個人非特定のため計測対象外。

#figure(
  box(width: 100%, stroke: 0.5pt + luma(200), inset: 12pt, radius: 4pt)[
    #v(4pt)
    #stack(
      dir: ltr,
      rect(width: 58%, height: 22pt, fill: rgb("#1e40af"))[#align(center + horizon)[#text(fill: white, weight: "bold", size: 9pt)[モバイル 58%]]],
      rect(width: 26%, height: 22pt, fill: rgb("#3b82f6"))[#align(center + horizon)[#text(fill: white, weight: "bold", size: 9pt)[SOK 26%]]],
      rect(width: 16%, height: 22pt, fill: rgb("#93c5fd"))[#align(center + horizon)[#text(fill: rgb("#1e293b"), weight: "bold", size: 9pt)[POS 15%]]],
    )
  ],
  caption: [経路別注文構成比（★仮）]
)

== 時間帯分布
#figure(
  table(
    columns: (1fr, 1fr, 1fr, 1fr),
    align: (center, right, right, right),
    [*時間帯*], [*注文数（★仮）*], [*構成比*], [*MO比率（★仮）*],
    [9–10], [60], [5%], [50%],
    [10–11], [150], [13%], [55%],
    [11–12], [280], [24%], [63%],
    [12–13], [250], [21%], [61%],
    [13–14], [180], [15%], [57%],
    [14–15], [130], [11%], [54%],
    [15+], [130], [11%], [52%],
  )
)

#figure(
  box(width: 100%, stroke: 0.5pt + luma(200), inset: 12pt, radius: 4pt)[
    #grid(
      columns: (65pt, 1fr, 80pt),
      gutter: 8pt,
      align: (center + horizon, left + horizon, left + horizon),
      [9時–10時], rect(width: 21%, height: 13pt, fill: rgb("#3b82f6"), radius: 2pt), [60件],
      [10時–11時], rect(width: 53%, height: 13pt, fill: rgb("#3b82f6"), radius: 2pt), [150件],
      [11時–12時], rect(width: 100%, height: 13pt, fill: rgb("#ef4444"), radius: 2pt), [280件 #text(8pt, fill: rgb("#ef4444"), weight: "bold")[★ピーク]],
      [12時–13時], rect(width: 89%, height: 13pt, fill: rgb("#f97316"), radius: 2pt), [250件],
      [13時–14時], rect(width: 64%, height: 13pt, fill: rgb("#3b82f6"), radius: 2pt), [180件],
      [14時–15時], rect(width: 46%, height: 13pt, fill: rgb("#3b82f6"), radius: 2pt), [130件],
      [15時以降], rect(width: 46%, height: 13pt, fill: rgb("#3b82f6"), radius: 2pt), [130件],
    )
  ],
  caption: [時間帯別注文数推移（★仮）]
)
11–13時に全注文の約45%が集中（★仮）。この帯でモバイル比率が上昇（★仮）し、混雑時ほど行列回避需要が顕著。POSはピークで処理能力が頭打ちになり相対比率が低下した。

== コンバージョンファネル
#figure(
  box(width: 100%, stroke: 0.5pt + luma(200), inset: 12pt, radius: 4pt)[
    #align(center)[
      #stack(
        spacing: 4pt,
        rect(width: 100%, height: 20pt, fill: rgb("#1e3a8a"), radius: 3pt)[#align(center + horizon)[#text(fill: white, weight: "bold", size: 9pt)[1. サイト訪問: 3,200 (100%)]]],
        rect(width: 80%, height: 20pt, fill: rgb("#1d4ed8"), radius: 3pt)[#align(center + horizon)[#text(fill: white, weight: "bold", size: 9pt)[2. MO画面到達: 2,100 (66%)]]],
        rect(width: 65%, height: 20pt, fill: rgb("#2563eb"), radius: 3pt)[#align(center + horizon)[#text(fill: white, weight: "bold", size: 9pt)[3. ログイン完了: 1,500 (71%)]]],
        rect(width: 52%, height: 20pt, fill: rgb("#3b82f6"), radius: 3pt)[#align(center + horizon)[#text(fill: white, weight: "bold", size: 9pt)[4. 店舗選択: 1,200 (80%)]]],
        rect(width: 41%, height: 20pt, fill: rgb("#60a5fa"), radius: 3pt)[#align(center + horizon)[#text(fill: white, weight: "bold", size: 9pt)[5. カート投入: 950 (79%)]]],
        rect(width: 30%, height: 20pt, fill: rgb("#93c5fd"), radius: 3pt)[#align(center + horizon)[#text(fill: rgb("#1e293b"), weight: "bold", size: 9pt)[6. 注文確定: 690 (73%)]]],
      )
    ]
  ],
  caption: [コンバージョンファネル分析（★仮）]
)
最大の離脱は「訪問→到達（-34%）」と「到達→ログイン（-29%）」（★仮）。前者は導線、後者は認証摩擦。ログイン後は各段7〜8割通過で、フローに入れば完了率は高い。改善の最大レバレッジは上流2段にあると数値が示す。

== 処理時間分析（オペレーション効率）
タイムスタンプ差分で注文ライフサイクルを分解。
#figure(
  table(
    columns: (1fr, 2fr, 1fr, 1fr, 1fr),
    align: (left, left, right, right, right),
    [*区間*], [*フィールド差分*], [*平常（★仮）*], [*ピーク（★仮）*], [*伸長率*],
    [調理], [createdAt→readyToServeAt], [8.0分], [14.0分], [1.75x],
    [提供口準備], [readyToServeAt→readyForPickupAt], [1.5分], [3.0分], [2.0x],
    [受取待ち], [readyForPickupAt→completedAt], [3.0分], [5.0分], [1.67x],
    [総所要], [createdAt→completedAt], [12.5分], [22.0分], [1.76x],
  )
)

#figure(
  box(width: 100%, stroke: 0.5pt + luma(200), inset: 12pt, radius: 4pt)[
    #grid(
      columns: (50pt, 1fr, 60pt),
      gutter: 10pt,
      align: (left + horizon, left + horizon, right + horizon),
      [*平常時*],
      stack(
        dir: ltr,
        rect(width: 64%, height: 18pt, fill: rgb("#ef4444"))[#align(center + horizon)[#text(fill: white, size: 8pt, weight: "bold")[調理 8分]]],
        rect(width: 12%, height: 18pt, fill: rgb("#f59e0b"))[#align(center + horizon)[#text(fill: white, size: 8pt, weight: "bold")[準備]]],
        rect(width: 24%, height: 18pt, fill: rgb("#10b981"))[#align(center + horizon)[#text(fill: white, size: 8pt, weight: "bold")[受取 3分]]],
      ),
      [計 12.5分],
      
      [*ピーク*],
      stack(
        dir: ltr,
        rect(width: 63%, height: 18pt, fill: rgb("#b91c1c"))[#align(center + horizon)[#text(fill: white, size: 8pt, weight: "bold")[調理 14分]]],
        rect(width: 14%, height: 18pt, fill: rgb("#d97706"))[#align(center + horizon)[#text(fill: white, size: 8pt, weight: "bold")[準備]]],
        rect(width: 23%, height: 18pt, fill: rgb("#059669"))[#align(center + horizon)[#text(fill: white, size: 8pt, weight: "bold")[受取 5分]]],
      ),
      [計 22.0分],
    )
  ],
  caption: [注文ライフサイクル所要時間区間内訳（★仮）]
)
ボトルネックは調理区間（★仮）。ピークで1.75倍に伸び、総所要増とファネル完了率低下の主因。受取待ちは全帯で短く（★仮）、呼び出し多重化（モニター・音声・Push）の効果を示す。

== 店舗別実績
#figure(
  table(
    columns: (0.5fr, 1fr, 1fr, 1fr, 1.5fr, 1fr, 1.5fr),
    align: (center, right, right, right, center, right, left),
    [*団体*], [*注文数*], [*売上*], [*単価*], [*主経路*], [*平均調理*], [*特記*],
    [A], [320], [205,000], [641], [モバイル], [◯分], [最多],
    [B], [240], [150,000], [625], [モバイル], [◯分], [─],
    [C], [180], [108,000], [600], [SOK], [◯分], [SOK比率高],
    [D], [170], [100,000], [588], [モバイル], [◯分], [─],
    [E], [150], [92,000], [613], [POS], [◯分], [POS比率高],
    [F], [120], [65,000], [542], [SOK], [◯分], [─],
  )
)
主経路が団体で分岐（★仮）。立地・商品特性・来場者年齢層が経路選択に影響した可能性。来年度は団体特性に応じた経路・端末配置の最適化余地あり。

== 通知・認証・セキュリティ計測
#figure(
  table(
    columns: (1fr, 1fr, 2fr),
    align: (left, right, left),
    [*項目*], [*数値（★仮）*], [*備考*],
    [FCM許可率], [◯%], [非許可者はstatus.html能動確認],
    [Push到達率], [◯%], [一部端末不達],
    [BAN発火総数], [◯件], [─],
    [├ 放置由来], [◯件], [auto_scheduler],
    [├ 誤BAN申出], [◯件], [手動解除で対応],
    [App Check遮断], [◯件], [誤爆ゼロ],
    [ドメイン制限拒否], [◯件], [対象外アカウント],
  )
)

== 定量分析の総括
数値が示す論点は3つ（★仮）。
+ セルフサービス経路が処理の85%を担い、混雑緩和と集計自動化という主目的は定量的に達成された。
+ 完了率のボトルネックは注文フロー内部ではなく上流の導線・認証にある。
+ オペレーションのボトルネックは調理区間であり、システムではなく現場キャパシティの問題である。

つまり来年度の改善対象は、コードよりも導線・認証UX・現場運用に集中すべきことをデータが指し示している。

#pagebreak()
= トラブルと対応の記録
一件ごとに「区分／発生条件／時系列／影響／その場の対応／根本原因／恒久対策／再発防止の実装可否」を統一フォーマットで分解記録する。隠さず書くほど来年度の価値が上がる。数値・事例★仮。

== 分類方針と全体像
影響度3区分。重大（全面停止・紙全面移行）、中（単一団体/経路の機能低下）、軽微（個別注文レベル）。

#figure(
  table(
    columns: (1fr, 3fr, 1fr),
    align: (center, left, center),
    [*区分*], [*定義*], [*件数（★仮）*],
    [重大], [全面停止/紙全面移行], [0],
    [中], [単一団体・経路の機能低下], [◯],
    [軽微], [個別注文レベル], [◯],
  )
)

#figure(
  box(width: 100%, stroke: 0.5pt + luma(200), inset: 12pt, radius: 4pt)[
    #grid(
      columns: (50pt, 1fr),
      gutter: 12pt,
      align: (left + top, left + top),
      [*1日目*],
      stack(
        spacing: 6pt,
        rect(width: 100%, fill: rgb("#fee2e2"), inset: 6pt, radius: 3pt)[#text(weight: "bold", fill: rgb("#991b1b"))[10:20 ● T-1(中)] ネットワーク不安定（12分一時失敗）],
        rect(width: 100%, fill: rgb("#fef3c7"), inset: 6pt, radius: 3pt)[#text(weight: "bold", fill: rgb("#92400e"))[11:40 ▲ T-2(中)] 提供口での金額目視照合の形骸化],
        rect(width: 100%, fill: rgb("#fef3c7"), inset: 6pt, radius: 3pt)[#text(weight: "bold", fill: rgb("#92400e"))[12:10 ▲ T-3(軽微)] 放置注文発生・自動ペナルティ作動],
        rect(width: 100%, fill: rgb("#fef3c7"), inset: 6pt, radius: 3pt)[#text(weight: "bold", fill: rgb("#92400e"))[13:05 ▲ T-4(軽微)] SOKスマホ認証ステップでの迷い],
      ),
      
      [*2日目*],
      stack(
        spacing: 6pt,
        rect(width: 100%, fill: rgb("#fef3c7"), inset: 6pt, radius: 3pt)[#text(weight: "bold", fill: rgb("#92400e"))[11:15 ▲ T-2(再)] 金額目視照合の形骸化（ピーク帯）],
        rect(width: 100%, fill: rgb("#fef3c7"), inset: 6pt, radius: 3pt)[#text(weight: "bold", fill: rgb("#92400e"))[12:30 ▲ T-4(軽微)] SOK認証案内の追加サポート],
        rect(width: 100%, fill: rgb("#fee2e2"), inset: 6pt, radius: 3pt)[#text(weight: "bold", fill: rgb("#991b1b"))[14:00 ▲ T-5(軽微)] 長時間稼働による端末応答遅延],
      ),
    )
  ],
  caption: [主要トラブル発生タイムライン（★仮）]
)

== 個別事象記録

=== T-1 ネットワーク不安定
#figure(
  table(
    columns: (1fr, 3fr),
    align: (left, left),
    [*項目*], [*内容（★仮）*],
    [区分], [中],
    [発生条件], [1日目 10:20頃／◯◯団体エリア],
    [時系列], [10:20検知 → 10:25連絡 → 10:28テザリング切替 → 10:32復旧],
    [影響], [当該団体で約12分、注文確定が断続失敗。波及なし],
    [その場対応], [テザリング切替。紙移行は保留し復旧優先],
    [根本原因], [校内Wi-Fi同時接続過多（推定）],
    [恒久対策], [各団体にテザリング待機端末を1台常備],
    [実装可否], [運用対応のみ（コード変更不要）],
  )
)

=== T-2 提供口での金額照合の形骸化
#figure(
  table(
    columns: (1fr, 3fr),
    align: (left, left),
    [*項目*], [*内容（★仮）*],
    [区分], [中],
    [発生条件], [両日ピーク帯／提供口混雑時],
    [影響], [過少決済の実害報告ゼロ。構造的リスク顕在化],
    [その場対応], [巡回サポートが照合徹底を口頭再周知],
    [根本原因], [手動QR決済は金額を手入力。照合はスタッフの注意力依存。],
    [恒久対策], [AirPay API連携の将来検討、presenter.htmlの照合前提UI強化],
    [実装可否], [UI改修で緩和可／完全解消はAPI連携必要],
  )
)

=== T-3 放置注文とペナルティ作動
#figure(
  table(
    columns: (1fr, 3fr),
    align: (left, left),
    [*項目*], [*内容（★仮）*],
    [区分], [軽微〜中],
    [発生条件], [呼び出し後15分超過◯件。abandonStaleOrders作動],
    [影響], [商品◯件廃棄。誤BAN申し出◯件],
    [その場対応], [誤BANはConsoleから手動解除],
    [根本原因], [Push不達・混雑で正当客も超過しうる（偽陽性は設計想定内）],
    [恒久対策], [閾値15分の実データ再検証、異議申し立て導線の周知],
    [実装可否], [閾値調整は容易／偽陽性の完全排除は原理的に不可],
  )
)

=== T-4 SOK認証での離脱
#figure(
  table(
    columns: (1fr, 3fr),
    align: (left, left),
    [*項目*], [*内容（★仮）*],
    [区分], [軽微・多発],
    [発生条件], [SOKのQR後、スマホ認証・規約同意で操作迷い多発],
    [影響], [SOKキャンセル率・確定漏れ増。提供口補助コスト増],
    [その場対応], [スタッフが横について口頭誘導],
    [根本原因], [経路のステップ過多。非在校生に認証の意味が伝わりにくい],
    [恒久対策], [ステップ削減、画面ガイド強化、SOK端末側の案内表示追加],
    [実装可否], [UX改修で改善可],
  )
)

=== T-5 端末バッテリー・応答遅延
#figure(
  table(
    columns: (1fr, 3fr),
    align: (left, left),
    [*項目*], [*内容（★仮）*],
    [区分], [軽微],
    [発生条件], [長時間稼働でiPadバッテリー低下・ブラウザ応答遅延数件],
    [その場対応], [予備端末交換、再ログインで復帰],
    [根本原因], [連続稼働・メモリ蓄積],
    [恒久対策], [常時給電、定期リロードのルール化],
    [実装可否], [運用対応のみ],
  )
)

== 「起きなかったこと」の記録
設計で警戒したが実際には起きなかった事象である（★仮）。
#figure(
  table(
    columns: (1.5fr, 1fr, 1.5fr),
    align: (left, left, left),
    [*警戒事象*], [*対策層*], [*当日結果（★仮）*],
    [海外からの不正注文], [ドメイン制限], [発生ゼロ],
    [大量自動リクエスト], [App Check], [発生ゼロ],
    [受付番号の重複], [アトミック発番], [発生ゼロ],
    [番号レンジ枯渇], [循環発番・完了徹底], [発生ゼロ],
    [Firebase広域障害], [紙運用体制], [発生ゼロ（出番なし）],
  )
)
多層防御が「攻撃を防いだ」のか「そもそも攻撃されなかった」のかは切り分け困難だが、少なくとも防御層が正規利用を阻害しなかったことは確認できた（★仮）。紙運用体制は一度も全面発動されず、保険として機能した。

== トラブル総括
重大障害ゼロ完走の最大要因は、部分障害を単一団体・経路に封じ込める独立設計と、紙運用即時切替体制の事前準備だった（★仮）。顕在化した課題の大半は技術欠陥でなく、混雑時の人的注意資源・来場者の不慣れ・現場キャパシティに起因する。来年度の改善余地はコードより運用設計とUX導線に大きい——これは5章の定量分析と完全に一致する結論である。

#pagebreak()
= 成果と評価（開催後）
当初の三つの狙いに照らした評価は以下の通り（★仮）。

*混雑緩和*については、モバイルオーダーが全注文の約6割を占め、物理的な行列の短縮に寄与したと評価できる。特にピーク時の効果が大きかった。

*注文精度・集計自動化*については、Googleスプレッドシートへのリアルタイム書き出しにより、閉店後の集計作業が実質的に不要となった。紙伝票の書き損じに起因するミスも大幅に減少した（★仮）。

*現金廃止への対応*については、AirPay手動QRへの一本化が完遂され、現金トラブルはゼロだった（★仮）。一方で、金額の手入力に依存する構造的リスクは残存した。

総合として、試験導入の目的は概ね達成されたと評価する。

= 反省と来年度への提言
- *実装面*: 設計と実装の差分（設計計画書 第12章）を本番前に完全に解消しきれず、一部は当日運用でカバーした（★仮）。来年度は差分ゼロでの本番入りを目標とすべき。
- *運用面*: 金額照合の徹底はトレーニングだけでは限界がある。将来的なAirPay API連携の検討、あるいは照合手順のUI補助を提言する。
- *SOK経路*: 多段ステップによる離脱が課題。ステップ削減、または案内の改善が必要。
- *計測面*: GAと注文記録の突き合わせが後手に回った（★仮）。来年度は計測ダッシュボードを事前に用意し、当日リアルタイムで見られる状態が望ましい。
- *引き継ぎ面*: 本システムは無料枠・Vanilla JS・GitHub Pagesという低コスト構成で、来年度も同じ土台で拡張可能。設計書一式が揃っているため、後輩は本書とあわせて読めば全体を把握できる。

= 付録
- 『南陵祭2026 POS・モバイルオーダーシステム 設計計画書』（技術仕様全般）
- 『設計憲法』（SSOT：データモデル・API契約・ステータス機械）
- 『ファイル設計書』（各ファイルの責務・依存）
- 用語集は設計計画書 第13章を参照
