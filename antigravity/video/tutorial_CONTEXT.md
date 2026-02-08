# 団体向けマニュアル動画 (Tutorial Video)

## 概要

店舗運営者（生徒・団体）向けのモバイルオーダーシステム利用マニュアル動画。
NASA「Artemis」計画の構成をオマージュし、システムの壮大さと堅牢性を訴求するコンテンツ。

## 構成 (Phase Based)

`src/MainVideo.tsx` に全体の Composition が定義されている。
BGM: `Artemis_-_How_We_Are_Going_To_the_Moon.mp3` に合わせて展開する。

| Phase   | コンポーネント        | 時間      | 内容                                                                                                           |
| :------ | :-------------------- | :-------- | :------------------------------------------------------------------------------------------------------------- |
| **1**   | `Phase1_History`      | 0:00-0:38 | **History & Mission**<br>過去の課題（混雑・行列）と新たな使命（行列のない世界へ）                              |
| **2**   | `Phase2_WholePicture` | 0:39-1:19 | **The Entire Picture**<br>全校規模の同期システム（Guest - Server - Store）の図解                               |
| **3**   | `Phase3_OrderFlow`    | 1:20-4:27 | **Order Flow**<br>注文(Launch) -> 転送(Liftoff) -> 受信(Orbit) -> 調理(Status) -> 呼出(Call) -> 受渡(Handover) |
| **End** | `Conclusion`          | 4:28-5:25 | **Conclusion**<br>導入のお願いとフィナーレ                                                                     |

## プロジェクト構造

```
video/src/
├── components/
│   ├── Mock/       # MockButton, MockOrderCard, MockDashboard
│   └── Common/     # 汎用パーツ
├── scenes/
│   ├── Phase1_History/
│   ├── Phase2_WholePicture/
│   ├── Phase3_OrderFlow/
│   └── Conclusion/
├── styles/
│   └── global.css  # Webサイト(main/style.css)のデザインシステムを移植
├── MainVideo.tsx   # 全体を結合するComposition
└── Root.tsx        # Remotionエントリーポイント
```

## 技術的要点

- **Mock UI**: `src/components/Mock` に実装。HTML/CSSで実際のアプリ画面を再現し、高解像度かつ修正容易なUIを実現。
- **Global Styles**: `main` プロジェクトのCSS変数を `global.css` に移植し、ブランドカラー（Webサイト）との完全な一致を保証。
- **Timeline Sync**: `MainVideo.tsx` 内で `<Series>` を使用し、BGMの展開に合わせて各フェーズを厳密にスケジューリングしている。
