/**
 * main.js — エントリーポイント
 * 3D Map Editor V2 — Nanryosai 2026
 * 
 * 各モジュール(core/tools/ui)を統合し、
 * 初期化・イベントリスナー・アニメーションループを管理する。
 */

// === Core ===
import { initRenderer, scene, renderer, getActiveCamera, handleResize } from './core/Renderer.js';
import { initControls, controls, updateMouseWorldPos, switchCamera, currentSnappedPos } from './core/Controls.js';

// === Tools ===
import { wallMeshGroup, handleWallClick, updateWallPreview, cancelWallDrawing, isDrawing as isWallDrawing, setOnWallAdded } from './tools/WallTool.js';
import { handleSelectClick, handleSelectKeyDown, clearSelection, setOnWallDeleted } from './tools/SelectTool.js';
import { zoneMeshGroup, handleZoneClick, updateZonePreview, cancelZoneDrawing, isDrawing as isZoneDrawing, setOnZoneAdded } from './tools/ZoneTool.js';
import { selectTool } from './tools/ToolManager.js';

// === UI ===
import { initHierarchyTree, renderHierarchyTree } from './ui/HierarchyTree.js';

// ============================================
// アプリケーション状態
// ============================================
const state = {
  activeTool: 'select',
  activeFloorId: 'f_student_1f',  // デフォルト: 生徒棟1F
  is3DView: true,
  gridSize: 1,
  snapEnabled: true,
};

// DOM要素
const container = document.getElementById('canvas-container');
const statusCursor = document.getElementById('status-cursor');

// ============================================
// 初期化
// ============================================
function init() {
  // --- Three.js セットアップ ---
  initRenderer(container);

  // --- OrbitControls ---
  initControls(container);

  // --- 壁/Zone Mesh グループをシーンに追加 ---
  scene.add(wallMeshGroup);
  scene.add(zoneMeshGroup);

  // --- 追加・削除時のコールバック登録 ---
  setOnWallAdded(() => {
    renderHierarchyTree(state.activeFloorId, onFloorSelect);
  });
  setOnWallDeleted(() => {
    renderHierarchyTree(state.activeFloorId, onFloorSelect);
  });
  setOnZoneAdded(() => {
    renderHierarchyTree(state.activeFloorId, onFloorSelect);
  });

  // --- 階層ツリー ---
  initHierarchyTree();
  renderHierarchyTree(state.activeFloorId, onFloorSelect);

  // --- イベントリスナー ---
  setupEventListeners();

  // --- ResizeObserver ---
  const resizeObserver = new ResizeObserver(() => handleResize(container));
  resizeObserver.observe(container);

  // --- アニメーション開始 ---
  animate();

  console.log('[Map Editor V2] モジュール版 初期化完了');
}

// ============================================
// イベントリスナー
// ============================================
function setupEventListeners() {
  // マウス移動 → ステータスバーの座標更新 + 壁プレビュー
  container.addEventListener('mousemove', onMouseMove);

  // キャンバスクリック → ツール別処理
  container.addEventListener('click', onCanvasClick);

  // 右クリック → 壁描画キャンセル
  container.addEventListener('contextmenu', onCanvasRightClick);

  // キーボード
  document.addEventListener('keydown', onKeyDown);

  // ツールバーボタン
  document.querySelectorAll('#top-bar .tb-btn[id^="tool-"]').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn, state, container));
  });

  // カメラビュー切替
  document.getElementById('view-3d').addEventListener('click', () => {
    state.is3DView = switchCamera('3d', container);
  });
  document.getElementById('view-2d').addEventListener('click', () => {
    state.is3DView = switchCamera('2d', container);
  });
}

// ============================================
// マウスイベント
// ============================================
function onMouseMove(event) {
  const worldPos = updateMouseWorldPos(event, container, state);

  if (worldPos) {
    statusCursor.textContent = `X: ${worldPos.x.toFixed(2)}  Y: ${worldPos.y.toFixed(2)}  Z: ${worldPos.z.toFixed(2)}`;

    // 壁描画中ならプレビュー更新
    if (state.activeTool === 'wall' && isWallDrawing()) {
      updateWallPreview(worldPos.x, worldPos.z, state.activeFloorId);
    }
    // Zone描画中ならプレビュー更新
    if (state.activeTool === 'zone' && isZoneDrawing()) {
      updateZonePreview(worldPos.x, worldPos.z, state.activeFloorId);
    }
  }
}

// ============================================
// キャンバスクリック
// ============================================
function onCanvasClick(event) {
  if (event.button !== 0) return;

  if (state.activeTool === 'wall') {
    handleWallClick(state.activeFloorId);
  } else if (state.activeTool === 'select') {
    handleSelectClick(event, container);
  } else if (state.activeTool === 'zone') {
    handleZoneClick(state.activeFloorId);
  }
}

// ============================================
// 右クリック
// ============================================
function onCanvasRightClick(event) {
  event.preventDefault();

  if (state.activeTool === 'wall' && isWallDrawing()) {
    cancelWallDrawing();
  } else if (state.activeTool === 'zone' && isZoneDrawing()) {
    cancelZoneDrawing();
  }
}

// ============================================
// キーボード
// ============================================
function onKeyDown(event) {
  if (event.key === 'Escape') {
    if (state.activeTool === 'wall' && isWallDrawing()) {
      cancelWallDrawing();
    } else if (state.activeTool === 'zone' && isZoneDrawing()) {
      cancelZoneDrawing();
    } else if (state.activeTool === 'select') {
      clearSelection();
    }
  }

  if (state.activeTool === 'select') {
    handleSelectKeyDown(event);
  }
}

// ============================================
// フロア選択コールバック
// ============================================
function onFloorSelect(floorId) {
  state.activeFloorId = floorId;
  renderHierarchyTree(state.activeFloorId, onFloorSelect);
  console.log(`[Hierarchy] アクティブフロア変更: ${state.activeFloorId}`);
}

// ============================================
// アニメーションループ
// ============================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, getActiveCamera());
}

// ============================================
// 起動
// ============================================
init();
