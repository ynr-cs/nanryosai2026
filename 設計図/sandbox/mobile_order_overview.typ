#set page(
  paper: "a4",
  margin: (x: 1.0cm, top: 0.65cm, bottom: 0.65cm),
  header: align(right)[
    #text(8.5pt, fill: rgb("#64748b"))[南陵祭2026 3年1組「アキコのひとくちカステラ」 店舗運用フロー]
  ],
  footer: align(center)[
    #text(8.5pt, fill: rgb("#94a3b8"))[- 1 / 1 -]
  ]
)

#set text(
  font: ("Yu Gothic", "Meiryo", "MS Gothic"),
  size: 10.5pt,
  lang: "ja"
)

#set par(justify: true, leading: 0.52em)

// ==========================================
// ヘッダー・タイトル
// ==========================================
#align(center)[
  #block(
    fill: rgb("#eff6ff"),
    stroke: 1.2pt + rgb("#3b82f6"),
    inset: (x: 14pt, y: 3.5pt),
    radius: 4pt,
    text(10.5pt, weight: "bold", fill: rgb("#1d4ed8"))[🎪 南陵祭2026 3年1組「アキコのひとくちカステラ」]
  )
  #v(1pt)
  #text(21pt, weight: "bold", fill: rgb("#0f172a"))[モバイルオーダー＆店舗運用 1枚概略図] \
  #v(-3pt)
  #text(12.5pt, weight: "bold", fill: rgb("#2563eb"))[〜 画面タップで進む！注文・調理・呼び出し・お渡しフロー 〜]
]

#v(2pt)

// ==========================================
// STEP 1: 3つの注文窓口
// ==========================================
#block(
  fill: rgb("#f8fafc"),
  stroke: 1.5pt + rgb("#cbd5e1"),
  inset: 8pt,
  radius: 7pt,
  width: 100%
)[
  #text(12pt, weight: "bold", fill: rgb("#1e293b"))[🛒 【STEP 1: 注文】選べる3つの注文窓口]
  #v(3pt)
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 7pt,
    // 窓口1
    block(
      fill: rgb("#ffffff"),
      stroke: 1.5pt + rgb("#60a5fa"),
      inset: 7pt,
      radius: 6pt
    )[
      #align(center)[
        #text(18pt)[📱] \
        #text(11.5pt, weight: "bold", fill: rgb("#1d4ed8"))[校内モバイルオーダー] \
        #text(8.5pt, fill: rgb("#64748b"))[【南陵生・生徒向け】]
      ]
      #v(2pt)
      #text(9.5pt, fill: rgb("#334155"))[
        生徒がスマホからどこでも事前注文！列に並ばずサクッと注文。
      ]
    ],
    // 窓口2
    block(
      fill: rgb("#ffffff"),
      stroke: 1.5pt + rgb("#34d399"),
      inset: 7pt,
      radius: 6pt
    )[
      #align(center)[
        #text(18pt)[🪄] \
        #text(11.5pt, weight: "bold", fill: rgb("#047857"))[店頭セルフオーダー] \
        #text(8.5pt, fill: rgb("#64748b"))[【一般来場者向け】]
      ]
      #v(2pt)
      #text(9.5pt, fill: rgb("#334155"))[
        店頭のiPadでタッチ注文！写真を見ながら自分で番号札を発行。
      ]
    ],
    // 窓口3
    block(
      fill: rgb("#ffffff"),
      stroke: 1.5pt + rgb("#f59e0b"),
      inset: 7pt,
      radius: 6pt
    )[
      #align(center)[
        #text(18pt)[💻] \
        #text(11.5pt, weight: "bold", fill: rgb("#b45309"))[店頭有人POSレジ] \
        #text(8.5pt, fill: rgb("#64748b"))[【サポート・それ以外】]
      ]
      #v(2pt)
      #text(9.5pt, fill: rgb("#334155"))[
        操作に迷うお客様にはスタッフが口頭で聞いて画面から代理入力！
      ]
    ]
  )
]

#v(1pt)
#align(center)[
  #text(13pt, fill: rgb("#2563eb"))[$arrow.b$]
  #h(5pt)
  #text(10.5pt, weight: "bold", fill: rgb("#2563eb"))[注文がリアルタイムでキッチンモニター（厨房iPad）へ自動送信！]
  #h(5pt)
  #text(13pt, fill: rgb("#2563eb"))[$arrow.b$]
]
#v(-3pt)

// ==========================================
// STEP 2: 厨房・焼きブース
// ==========================================
#block(
  fill: rgb("#fffbeb"),
  stroke: 1.5pt + rgb("#f59e0b"),
  inset: 8pt,
  radius: 7pt,
  width: 100%
)[
  #grid(
    columns: (1fr, auto),
    gutter: 4pt,
    [#text(11pt, weight: "bold", fill: rgb("#92400e"))[👨‍🍳 【STEP 2: 調理・カップ詰め】画面を見て焼く ＆ 「調理完了」！]],
    [
      #box(
        fill: rgb("#fee2e2"),
        stroke: 1.2pt + rgb("#ef4444"),
        inset: (x: 5pt, y: 2.5pt),
        radius: 3pt
      )[
        #text(8.5pt, weight: "bold", fill: rgb("#b91c1c"))[🛡 衛生: トングで詰める・カップ外側だけ持つ]
      ]
    ]
  )

  #v(3pt)
  #grid(
    columns: (1fr, 1.2fr),
    gutter: 8pt,
    // 左: モニター確認
    block(
      fill: rgb("#ffffff"),
      stroke: 1.2pt + rgb("#fcd34d"),
      inset: 7pt,
      radius: 5pt
    )[
      #text(11pt, weight: "bold", fill: rgb("#b45309"))[📺 ① モニターの注文を見て焼く] \
      #v(2pt)
      #text(9.5pt, fill: rgb("#78350f"))[
        厨房iPad（キッチンモニター）に注文が自動表示。 \
        *表示例*: 「#101 プレーン 2個、チョコ 1個」 \
        $arrow.r$ 注文を確認してカステラを焼きます！
      ]
    ],
    // 右: 焼き上げと置き場
    block(
      fill: rgb("#ffffff"),
      stroke: 1.5pt + rgb("#f59e0b"),
      inset: 7pt,
      radius: 5pt
    )[
      #text(11pt, weight: "bold", fill: rgb("#b45309"))[🥞 ② トングでカップに詰めて「調理完了」！] \
      #v(2pt)
      #text(9.5pt, fill: rgb("#78350f"))[
        - *焼き上がったカステラはトングでカップに入れます。*
        - #text(weight: "bold", fill: rgb("#b91c1c"))[食品には素手で触れない。カップの外側だけ持つ！]
        - 完成品を受渡口の*「完成品置き場」*へ置く。
        - 👉 #text(weight: "bold", fill: rgb("#b91c1c"))[キッチンモニターの画面をタップして「調理完了」！]
      ]
    ]
  )
]

#v(1pt)
#align(center)[
  #text(13pt, fill: rgb("#d97706"))[$arrow.b$]
  #h(5pt)
  #text(10.5pt, weight: "bold", fill: rgb("#d97706"))[受渡口へスライド！トングで盛り付け・モニタータップで呼出]
  #h(5pt)
  #text(13pt, fill: rgb("#d97706"))[$arrow.b$]
]
#v(-3pt)

// ==========================================
// STEP 3: 受渡口・プレゼンター
// ==========================================
#block(
  fill: rgb("#f0fdf4"),
  stroke: 1.5pt + rgb("#10b981"),
  inset: 8pt,
  radius: 7pt,
  width: 100%
)[
  #grid(
    columns: (1fr, auto),
    gutter: 5pt,
    [#text(11.5pt, weight: "bold", fill: rgb("#065f46"))[🎁 【STEP 3: 盛り付け・提供】モニターをタップしてお客様を呼出！]],
    [
      #box(
        fill: rgb("#dcfce7"),
        stroke: 1.2pt + rgb("#16a34a"),
        inset: (x: 5pt, y: 2.5pt),
        radius: 3pt
      )[
        #text(8.5pt, weight: "bold", fill: rgb("#15803d"))[🛡 衛生: 盛り付けはトング使用・素手厳禁]
      ]
    ]
  )
  #v(3pt)
  #grid(
    columns: (1fr, 1.15fr, 1fr),
    gutter: 6pt,
    // 仕上げ
    block(
      fill: rgb("#ffffff"),
      stroke: 1.2pt + rgb("#86efac"),
      inset: 6pt,
      radius: 5pt
    )[
      #text(10.5pt, weight: "bold", fill: rgb("#166534"))[① トングで盛り付け] \
      #v(2pt)
      #text(9pt, fill: rgb("#14532d"))[
        注文に合わせてトッピング！
        - *盛り付けはトングを使用*
        - *チョコ*: チョコソース
        - *抹茶*: 抹茶ソース
        - *プレーン*: そのまま！
      ]
    ],
    // 呼出（タップ操作を強調）
    block(
      fill: rgb("#ffffff"),
      stroke: 1.5pt + rgb("#10b981"),
      inset: 6pt,
      radius: 5pt
    )[
      #text(10.5pt, weight: "bold", fill: rgb("#166534"))[② モニタータップ呼出！] \
      #v(2pt)
      #text(9pt, fill: rgb("#14532d"))[
        👉 #text(weight: "bold", fill: rgb("#b91c1c"))[モニターの「呼び出し」を押す！] \
        $arrow.r$ 呼出表示＆スマホ通知！ \
        🗣 声で*「#101 のお客様！」*とお呼び出し。
      ]
    ],
    // 会計とお渡し
    block(
      fill: rgb("#ffffff"),
      stroke: 1.2pt + rgb("#86efac"),
      inset: 6pt,
      radius: 5pt
    )[
      #text(10.5pt, weight: "bold", fill: rgb("#166534"))[③ AirPay決済・お渡し] \
      #v(2pt)
      #text(9pt, fill: rgb("#14532d"))[
        お客様が来たらAirPayで決済！ \
        （カップ外側を持って商品をお渡し） \
        画面の「提供完了」を押して終了！✨
      ]
    ]
  )
]

#v(2pt)

// ==========================================
// 現場での案内手順 ＆ 衛生管理
// ==========================================
#block(
  fill: rgb("#f8fafc"),
  stroke: 1.5pt + rgb("#3b82f6"),
  inset: 8pt,
  radius: 7pt,
  width: 100%
)[
  #text(11pt, weight: "bold", fill: rgb("#1e40af"))[💡 【現場の対応手順】注文済みのお客様への案内 ＆ 衛生管理]
  #v(3pt)
  #grid(
    columns: (1.3fr, 1fr),
    gutter: 7pt,
    block(
      fill: rgb("#ffffff"),
      stroke: 1.2pt + rgb("#93c5fd"),
      inset: 7pt,
      radius: 5pt
    )[
      #text(10.5pt, weight: "bold", fill: rgb("#1e40af"))[💰 注文済みのお客様が来たら？（案内手順）] \
      #v(2pt)
      #text(9pt, fill: rgb("#1e3a8a"))[
        モバイルオーダーやセルフオーダーは商品受取時決済のため、*事前に現金のお支払いは発生していません*。 \
        万一注文がキャンセルされたお客様が来られたら、次のようにご案内してください： \
        #v(2pt)
        #block(
          fill: rgb("#eff6ff"),
          stroke: 0.8pt + rgb("#bfdbfe"),
          inset: 4pt,
          radius: 4pt
        )[
          🗣 #text(9pt, weight: "bold", fill: rgb("#b91c1c"))[「注文がリセットされました。お支払いは発生していませんので、お手数ですがこちらの有人レジで紙にて再度ご注文をお願いします！」]
        ]
      ]
    ],
    block(
      fill: rgb("#ffffff"),
      stroke: 1.2pt + rgb("#86efac"),
      inset: 7pt,
      radius: 5pt
    )[
      #text(10.5pt, weight: "bold", fill: rgb("#166534"))[🧼 全工程で食品に素手で触れない] \
      #v(2pt)
      #text(9pt, fill: rgb("#14532d"))[
        - *カップ詰め*: 焼き上がりは必ずトングを使用
        - *盛り付け*: トッピングも必ずトングを使用
        - *提供時*: カップの外側のみを持つ \
        $arrow.r$ 調理からお渡しまで食品に一切素手で触れない衛生管理を徹底します。
      ]
    ]
  )
]




