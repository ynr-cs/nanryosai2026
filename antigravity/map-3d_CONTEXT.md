---
title: 3Dマップシステム アーキテクチャ (3D Map Architecture)
tags: [map, 3d, editor, context]
status: active
last_updated: 2026-03-23
---

# 3Dマップシステム アーキテクチャ (3D Map Architecture)

本ドキュメントは、南陵祭2026プロジェクトにおける「3Dマップエディタ（map_editor_v2）」および「来場者向け3Dビューア（map.html）」の基盤アーキテクチャと設計思想を記録するものです。

## 1. コア設計思想 (Core Philosophies)

1. **Vanilla Web Standard**:
   - ビルドツールや複雑なフレームワーク（React等）に依存せず、Vanilla JavaScript (ES Modules) と標準の `Three.js` (CDN経由等) を使用する。
   - `main/style.css` の既存デザインシステム（Glassmorphism等）をそのまま流用し、プロジェクト全体でUIの統一感を保つ。

2. **エキスパート向け特化 (Expert-Centric Editor)**:
   - マップエディタは、素人（一般の実行委員）ではなく、開発者本人がすべてのデータ構築・保守を行うことを前提として設計されている。
   - 直感的な「自動部屋認識」などのバグの温床となる便利機能を廃止し、Y座標やスナップを手動で正確に制御できる**ネイティブ3D空間でのダイレクトエディット**機能を提供する。

## 2. データアーキテクチャ (JSON Schema Architecture)

フラットなJSONから、Three.jsでの描画・管理に直結しやすい**階層型データ構造 (V2 Schema)**を採用する。

### 2-1. 階層構造
*   **Site (Global)**: マップ全体の原点。屋外地形や建物を持たない独立オブジェクト（屋外テント等）を配置。
*   **Buildings**: 各棟（生徒棟、管理棟など）。原点座標、角度、屋根（Roof）タイプなどのグローバルプロパティを持つ。
*   **Floors**: 建物内の各階。親BuildingからのY座標（高さ）オフセットを持つ。
*   **Elements (Wall/Floor/Stairs)**: 実際の物理的な3Dメッシュとなる構成要素。必ず親（Floor等）からの**ローカル座標（相対座標）**で保存され、建物の丸ごと移動を容易にする。
*   **Zones (Rooms/Tents) [最重要]**: 
    - 物理的な壁（Wall）とは完全に切り離され、独立した「空間ボリューム（目に見えない箱）」として定義される。
    - 各Zoneは不変のUUIDを持ち、企画データ（Firebase）と一意にリンクする。これにより、建物の壁を描き直しても企画紐付けデータが破損しない。

## 3. レンダリング・パフォーマンス最適化 (Performance)

モバイルブラウザ（特に学校祭当日の過負荷通信環境・低スペック端末）での60fps描画を維持するための最適化戦略。

1. **メッシュ結合 (Geometry Merging)**:
   - エディタが吐き出した大量の壁や床のJSONオブジェクトを、ビューア起動時に `Three.js (BufferGeometryUtils.mergeGeometries)` を用いて「建物ごと・階層ごと」の**単一の静的メッシュ（Static Mesh）**へとBake（結合）する。
   - これによりドローコールを劇的に削減する。
2. **インタラクションの分離**:
   - 結合された壁メッシュは単なる「風景」となり、クリック判定（Raycaster）は紐付けられた「透明なZoneオブジェクト」に対してのみ行われる。

## 4. 特殊モデリング機能 (Advanced Tools)

*   **斜面・経路生成ツール (Slope/Ramp Tool)**: 
    - 洋光台北口ルート（全長300m、高低差21m）などの長大なアクセスルートをリアルスケールで再現するため、始点と終点のY座標を指定して滑らかなスロープや階段を自動生成するツールを完備。
*   **Z-Fighting自動補正**: 
    - 重なり合った床やオブジェクトの描画チラつきを防ぐため、システム内でZバッファへの微小なオフセット（あるいはY座標の自動加算0.01m等）をプログラム処理で適用する。
*   **スライス表示（階層カット）の限定化**:
    - ビューア側で「2階の平面図を見る」処理を行った際、透過・非表示化されるのは**生徒棟のみ**とする。周囲の高台にある校庭や別棟が一緒に消えてしまう視覚バグを防ぐため。

## 5. エディタ実装詳細 (Editor Implementation — Phase 4 Prototype)

`main/map_editor_v2/` に以下の3ファイルで初期構成を確立。

### 5-1. ファイル構成
| ファイル | 役割 |
|---|---|
| `editor.html` | UIシェル（3ペイン+トップバー+ステータスバー）。Import Map でThree.js r170をCDN (esm.sh) 経由ロード |
| `editor.css` | CSS Grid レイアウト。ダークネイビー系テーマ。CSS変数で全色管理 |
| `editor.js` | Three.js 初期化、カメラ、コントロール、ライティング、グリッド、イベント処理 |

### 5-2. Three.js インポート方式
```html
<script type="importmap">
{
  "imports": {
    "three": "https://esm.sh/three@0.170.0",
    "three/addons/": "https://esm.sh/three@0.170.0/examples/jsm/"
  }
}
</script>
```
- npm/バンドラー不使用。`import * as THREE from 'three'` で直接利用可能。
- OrbitControls, BufferGeometryUtils 等のaddonsも `three/addons/` プレフィックスで import 可能。

### 5-3. カメラ構成
- **PerspectiveCamera**: デフォルト（3Dビュー）。FOV 50°。
- **OrthographicCamera**: 2D俯瞰ビュー。frustumSize 80。`up = (0,0,-1)` で北を上に。
- ワンタッチ切替。OrbitControls のカメラオブジェクトを差し替えて対応。

### 5-4. Z-Fighting 対策の具体値
- 地面メッシュ: Y = 0
- メイングリッド（1m刻み）: Y = 0.005
- サブグリッド（10m刻み太線）: Y = 0.006
- AxesHelper: Y = 0.01

