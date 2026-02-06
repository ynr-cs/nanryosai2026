# 団体向けマニュアル動画 (Tutorial Video)

## 概要

店舗運営者（生徒・団体）向けのモバイルオーダーシステム利用マニュアル動画。
システムの仕組み、操作方法、便利機能を網羅した長尺（5分以上）のコンテンツ。

## 構成

`src/Tutorial/Main.tsx` に全体の Composition が定義されている。
各章は `src/Tutorial/Chapters/` に分割されている。

| 章  | コンポーネント    | 内容                                            |
| :-- | :---------------- | :---------------------------------------------- |
| 1   | `Chap1_Intro`     | イントロダクション                              |
| 2   | `Chap2_Mechanism` | システムの仕組み（データフロー図解）            |
| 3   | `Chap3_Workflow`  | 基本操作フロー（Mock UIによるシミュレーション） |
| 4   | `Chap4_Features`  | 便利機能（ダッシュボード、在庫管理）            |
| 5   | `Chap5_Trouble`   | トラブルシューティング                          |
| 6   | `Chap6_Ending`    | エンディング                                    |

## 共通コンポーネント

`src/Shared/UIComponents/` に、POS画面を模倣したコンポーネントを配置。

- `MockButton`: 汎用ボタン
- `MockOrderCard`: 注文カード（ステータス変化対応）
- `MockDashboard`: 管理画面（売上、在庫スイッチ）

## 技術的要点

- **Remotion**: Reactベースの動画生成フレームワーク
- **lucide-react**: アイコン素材
- **Animation**: `interpolate`, `spring` を使用したプログラマティックなアニメーション
- **Mock UI**: スクリーンショットではなく、HTML/CSS (=React) で画面を構築することで、高解像度かつ修正容易なUIを実現している。
