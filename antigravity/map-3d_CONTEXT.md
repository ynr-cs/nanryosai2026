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
| `editor.html` | UIシェル（3ペイン+トップバー+ステータスバー）。Import MapでThree.jsを読み込み、`<script type="module" src="js/main.js">` を実行 |
| `editor.css` | CSS Grid レイアウト。ダークネイビー系テーマ。CSS変数で全色管理 |
| `js/main.js` | エントリーポイント。イベント配線と状態管理。ロジックは `js/core/`, `js/tools/`, `js/ui/` にモジュール分割済み |

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

## 6. 壁描画ツール (Wall Tool — Phase 5)

### 6-1. 操作フロー
1. ツールバー「🧱 壁描画」選択 → OrbitControls 無効化、カーソルが crosshair に変更
2. キャンバスクリック → Raycaster で地面交点取得 → グリッドスナップ適用 → **始点確定**
3. マウス移動 → 始点〜現在位置に半透明 BoxGeometry プレビュー + ガイドライン描画
4. 再度クリック → **終点確定** → 壁 Mesh 生成 + mapData 保存 + ツリー更新
5. 終点 → 次の始点（連続描画）。Escape or 右クリックで中断

### 6-2. 壁 Mesh 生成ロジック (`createWallMesh`)
- `BoxGeometry(length, height=3.0, thickness=0.2)` を動的生成
- XZ平面上の中点に配置、`Math.atan2(dz, dx)` で Y軸回転
- Y座標 = `building.position.y + floor.yOffset + height / 2`
- `mesh.userData = { type: 'wall', wallId, floorId, buildingId }` で逆引き可能
- 影(cast/receive)有効
- 壁色: `0x8899aa`（MeshStandardMaterial, roughness: 0.7, metalness: 0.1）

### 6-3. データフロー
```
ユーザークリック → WallTool.js: createWallData() → mapData.floor.elements.walls.push()
                → WallTool.js: createWallMesh() → wallMeshGroup.add(mesh)
                → main.js: _onWallAdded コールバック発火
                → HierarchyTree.js: renderHierarchyTree() → 左サイドバー更新
```

### 6-4. 階層ツリー動的レンダリング
- `renderHierarchyTree()` が mapData 全体を走査して HTML を生成
- フロアクリックで `state.activeFloorId` を切替
- 壁はフロア配下に `🧱 w_001 (L=5.00m)` のような子ノードとして表示
- 建物・フロアに壁数バッジを表示

## 7. ES Module アーキテクチャ (Phase 6)

### 7-1. 背景
- 単一ファイル(`editor.js`)が数百〜数千行に肥大化すると、AIがコンテキストを維持できずバグ修正が困難になる
- Phase 6 で ES Module (`import/export`) を使って論理的に分割

### 7-2. ファイル構成
```
map_editor_v2/
├── editor.html          ← <script type="module" src="js/main.js">
├── editor.css
└── js/
    ├── main.js           ← エントリーポイント（状態管理・イベント配線・アニメーションループ）
    ├── core/
    │   ├── MapData.js    ← mapDataオブジェクト、ID生成、フロア検索
    │   ├── Renderer.js   ← Scene/Camera/Light/Grid/Resize
    │   └── Controls.js   ← OrbitControls, Raycaster, カメラ切替
    ├── tools/
    │   ├── ToolManager.js ← ツール選択・切替・OrbitControls連動
    │   ├── WallTool.js    ← 壁描画（プレビュー・Mesh生成・データ保存）
    │   ├── SelectTool.js  ← 選択・編集・削除
    │   └── ZoneTool.js    ← ゾーン（空間ボリューム）描画と生成
    └── ui/
        └── HierarchyTree.js ← 左サイドバーの階層ツリーDOM生成
```

### 7-3. 依存関係
```
main.js → Renderer.js, Controls.js, WallTool.js, SelectTool.js, ZoneTool.js, ToolManager.js, HierarchyTree.js
Controls.js → Renderer.js
WallTool.js → Renderer.js, MapData.js, Controls.js
SelectTool.js → Renderer.js, MapData.js, WallTool.js
ZoneTool.js → Renderer.js, MapData.js, Controls.js
ToolManager.js → Controls.js, WallTool.js, SelectTool.js, ZoneTool.js
HierarchyTree.js → MapData.js
```

### 7-4. 設計原則
- **ツールはUIを直接呼ばない**: `WallTool` は壁追加後に `_onWallAdded` コールバックを発火し、`main.js` がツリー更新を委譲する
- **カメラ参照は `getActiveCamera()` ゲッター経由**: ES Module の live binding に依存せず、安全にカメラ切替後の参照を取得
- **状態(`state`)は `main.js` に集約**: 各モジュールは引数でstateを受け取る（グローバル状態の分散を防止）
