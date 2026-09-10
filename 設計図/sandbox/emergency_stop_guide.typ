#set page(
  paper: "a4",
  margin: (x: 1.0cm, top: 0.7cm, bottom: 0.7cm),
  header: align(right)[
    #text(9pt, fill: rgb("#64748b"))[南陵祭2026 3年1組「アキコのひとくちカステラ」 現場貼り出し用]
  ],
  footer: align(center)[
    #text(9pt, fill: rgb("#94a3b8"))[- 1 / 1 -]
  ]
)

#set text(
  font: ("Yu Gothic", "Meiryo", "MS Gothic"),
  size: 11pt,
  lang: "ja"
)

#set par(justify: true, leading: 0.58em)

// ==========================================
// ヘッダー・タイトル
// ==========================================
#align(center)[
  #block(
    fill: rgb("#fee2e2"),
    stroke: 1.5pt + rgb("#ef4444"),
    inset: (x: 16pt, y: 5pt),
    radius: 6pt,
    text(11.5pt, weight: "bold", fill: rgb("#b91c1c"))[🚨 【緊急時対応】トラブル・混雑時の紙注文切り替えマニュアル]
  )
  #v(2pt)
  #text(23pt, weight: "bold", fill: rgb("#0f172a"))[もしエラーが起きたらどうする？] \
  #v(-2pt)
  #text(13.5pt, weight: "bold", fill: rgb("#2563eb"))[〜 一時停止を押して、紙注文に切り替える手順 〜]
]

#v(4pt)

// ==========================================
// 1. 判断基準
// ==========================================
#block(
  fill: rgb("#f8fafc"),
  stroke: 1.5pt + rgb("#cbd5e1"),
  inset: 9pt,
  radius: 8pt,
  width: 100%
)[
  #text(13pt, weight: "bold", fill: rgb("#1e293b"))[🛑 こんな時は迷わず営業停止にする！（2つのサイン）]
  #v(5pt)
  #grid(
    columns: (1fr, 1fr),
    gutter: 10pt,
    block(
      fill: rgb("#ffffff"),
      stroke: 1.5pt + rgb("#fca5a5"),
      inset: 9pt,
      radius: 6pt
    )[
      #text(12pt, weight: "bold", fill: rgb("#dc2626"))[① 注文がパンクした時] \
      #v(3pt)
      #text(10.5pt, fill: rgb("#334155"))[
        注文が殺到して焼き上がりが追いつかず、待機列が溢れそうになった時。
      ]
    ],
    block(
      fill: rgb("#ffffff"),
      stroke: 1.5pt + rgb("#fca5a5"),
      inset: 9pt,
      radius: 6pt
    )[
      #text(12pt, weight: "bold", fill: rgb("#dc2626"))[② 注文できなくなった時] \
      #v(3pt)
      #text(10.5pt, fill: rgb("#334155"))[
        iPadが固まった、通信が切れた等、何かしらの理由で注文できなくなった時。
      ]
    ]
  )
]

#v(2pt)
#align(center)[#text(16pt, fill: rgb("#ef4444"))[$arrow.b$]]
#v(-2pt)

// ==========================================
// 2. 操作手順（実ファイル pos/portal.html 完全再現）
// ==========================================
#block(
  fill: rgb("#f0fdf4"),
  stroke: 1.8pt + rgb("#10b981"),
  inset: 10pt,
  radius: 8pt,
  width: 100%
)[
  #grid(
    columns: (1.1fr, 1.25fr),
    gutter: 10pt,
    [
      #text(12.5pt, weight: "bold", fill: rgb("#065f46"))[📱 管理画面（iPad）での操作]
      #v(5pt)
      #block(
        fill: rgb("#ffffff"),
        stroke: 1.8pt + rgb("#f59e0b"),
        inset: 9pt,
        radius: 6pt
      )[
        #text(12.5pt, weight: "bold", fill: rgb("#b91c1c"))[
          「一時停止をタップして、\ 営業停止にしてください」
        ]
        #v(4pt)
        #text(10.5pt, fill: rgb("#334155"))[
          右の画面の黄色いボタンを1回押すだけで、お客様からの新規注文が瞬時に完全ストップします！
        ]
      ]
    ],
    [
      // 実ファイル（pos/portal.html）の営業中パネル完全再現
      #block(
        fill: rgb("#ffffff"),
        stroke: 2pt + rgb("#10b981"),
        inset: 10pt,
        radius: 9pt,
        width: 100%
      )[
        #align(left)[
          #text(9.5pt, weight: "bold", fill: rgb("#6b7280"))[🏪 現在の営業ステータス]
          #v(3pt)
          #box(
            fill: rgb("#d1fae5"),
            inset: (x: 12pt, y: 4pt),
            radius: 999pt
          )[
            #box(circle(radius: 3.5pt, fill: rgb("#10b981")))
            #h(4pt)
            #text(11.5pt, weight: "bold", fill: rgb("#065f46"))[🟢 営業中]
          ]
          #v(6pt)
          #grid(
            columns: (1fr, 1fr),
            gutter: 8pt,
            // 営業停止（一時停止）ボタン（赤枠強調）
            block(
              fill: rgb("#f59e0b"),
              stroke: 2.2pt + rgb("#dc2626"),
              inset: (x: 6pt, y: 8pt),
              radius: 6pt
            )[
              #align(center)[#text(11.5pt, weight: "bold", fill: rgb("#ffffff"))[🟡 一時停止]]
            ],
            // 営業終了ボタン
            block(
              fill: rgb("#6b7280"),
              inset: (x: 6pt, y: 8pt),
              radius: 6pt
            )[
              #align(center)[#text(11.5pt, weight: "bold", fill: rgb("#ffffff"))[⚫ 営業終了]]
            ]
          )
        ]
        #v(3pt)
        #align(center)[
          #text(9.5pt, weight: "bold", fill: rgb("#dc2626"))[↑ トラブル時はこの「🟡 一時停止」を押す！]
        ]
      ]
    ]
  )
]

#v(2pt)
#align(center)[#text(16pt, fill: rgb("#ef4444"))[$arrow.b$]]
#v(-2pt)

// ==========================================
// 3. 紙注文への移行フロー（3ステップ）
// ==========================================
#text(13pt, weight: "bold", fill: rgb("#0f172a"))[📋 【その後の対応】紙注文への切り替え手順]
#v(4pt)

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 8pt,
  // STEP 1
  block(
    fill: rgb("#eff6ff"),
    stroke: 1.5pt + rgb("#93c5fd"),
    inset: 9pt,
    radius: 7pt
  )[
    #text(11.5pt, weight: "bold", fill: rgb("#1e40af"))[STEP 1: 口頭で受ける] \
    #v(3pt)
    #text(10pt, fill: rgb("#1e3a8a"))[
      付箋などの紙注文票を用意し、お客様から口頭で注文を聞き、通し番号（例: #101〜）を記入。半券をお客様に渡し、本票を焼きへ手渡し。
    ]
  ],
  // STEP 2
  block(
    fill: rgb("#fff7ed"),
    stroke: 1.5pt + rgb("#fdba74"),
    inset: 9pt,
    radius: 7pt
  )[
    #text(11.5pt, weight: "bold", fill: rgb("#9a3412"))[STEP 2: 声で呼出・会計] \
    #v(3pt)
    #text(10pt, fill: rgb("#7c2d12"))[
      カステラが焼き上がったら、声で「注文番号 #101 のお客様！」とお呼び出し。AirPayに金額を手入力して会計し、商品をお渡し。
    ]
  ],
  // STEP 3
  block(
    fill: rgb("#faf5ff"),
    stroke: 1.5pt + rgb("#d8b4fe"),
    inset: 9pt,
    radius: 7pt
  )[
    #text(11.5pt, weight: "bold", fill: rgb("#6b21a8"))[STEP 3: 落ち着いたら再開] \
    #v(3pt)
    #text(10pt, fill: rgb("#581c87"))[
      焼きの遅れが解消し、端末が安定したら、画面の #text(weight: "bold", fill: rgb("#059669"))[「🟢 営業開始」] をタップして通常通りに再開！
    ]
  ]
)

#v(4pt)

// ==========================================
// 4. 困ったときはすぐ連絡 ＆ 注文済みのお客様への対応手順
// ==========================================
#grid(
  columns: (1.35fr, 1fr),
  gutter: 8pt,
  block(
    fill: rgb("#f0fdf4"),
    stroke: 1.5pt + rgb("#10b981"),
    inset: 9pt,
    radius: 7pt
  )[
    #text(11pt, weight: "bold", fill: rgb("#065f46"))[🙋 すでに注文していたお客様が来たら？（対応手順）] \
    #v(3pt)
    #text(9.5pt, fill: rgb("#047857"))[
      停止前にスマホやセルフで注文済みのお客様が来られた場合、注文は自動キャンセルされています。 \
      *お支払いはまだ発生していない*（お渡し時決済のため）ので、次のようにご案内してください： \
      #v(3pt)
      #block(
        fill: rgb("#ffffff"),
        stroke: 1pt + rgb("#86efac"),
        inset: 6pt,
        radius: 5pt
      )[
        🗣 #text(10pt, weight: "bold", fill: rgb("#166534"))[「システム停止のため注文がリセットされました。お支払いは発生していませんので、お手数ですがこちらの有人レジで紙にて再度ご注文をお願いします！」]
      ]
      $arrow.r$ 返金等の手続きは一切不要で、紙注文で受け直すだけでOK！
    ]
  ],
  block(
    fill: rgb("#fef2f2"),
    stroke: 1.5pt + rgb("#fca5a5"),
    inset: 9pt,
    radius: 7pt
  )[
    #text(11pt, weight: "bold", fill: rgb("#991b1b"))[📞 困ったときはすぐ連絡！] \
    #v(3pt)
    #text(9.5pt, fill: rgb("#7f1d1d"))[
      自力で直そうとせず、すぐに連絡してください！ \
      *コンピュータ科学部 公式Instagram*: \
      #text(12.5pt, weight: "bold", fill: rgb("#b91c1c"))[\@ynr_cs] （DMまたは近くの部員へ） \
      #v(3pt)
      #text(9pt, fill: rgb("#991b1b"))[🛡 *衛生*: 全工程で食品に素手で触れずトングを使用]
    ]
  ]
)

