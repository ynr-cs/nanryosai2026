/**
 * ToolManager.js — ツール状態管理
 * 
 * 現在選択中のツールの状態管理と、
 * マウスイベントをアクティブツールに委譲する。
 */

import { controls } from '../core/Controls.js';
import { cancelWallDrawing, isDrawing as isWallDrawing } from '../tools/WallTool.js';
import { clearSelection } from '../tools/SelectTool.js';
import { cancelZoneDrawing, isDrawing as isZoneDrawing } from '../tools/ZoneTool.js';
import { cancelOpeningPlacement, isPlacing as isOpeningPlacing } from '../tools/OpeningTool.js';
import { cancelSlopeDrawing, isDrawing as isSlopeDrawing } from '../tools/SlopeTool.js';

// ============================================
// ツール名一覧
// ============================================
const TOOL_NAMES = {
  select: '選択',
  wall: '壁描画',
  opening: '開口部',
  zone: 'ゾーン',
  slope: '斜面',
};

// ============================================
// ツール選択処理
// ============================================

/**
 * ツールを選択・切替する。
 * @param {HTMLElement} btn - クリックされたボタン要素
 * @param {object} state - アプリ全体の状態オブジェクト
 * @param {HTMLElement} container - キャンバスコンテナ
 */
export function selectTool(btn, state, container) {
  if (isWallDrawing()) cancelWallDrawing();
  if (isZoneDrawing()) cancelZoneDrawing();
  if (isOpeningPlacing()) cancelOpeningPlacement();
  if (isSlopeDrawing()) cancelSlopeDrawing();

  // 全ツールボタンの active を解除
  document.querySelectorAll('#top-bar .tb-btn[id^="tool-"]').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  const toolId = btn.id.replace('tool-', '');

  if (state.activeTool === 'select' && toolId !== 'select') {
    clearSelection();
  }

  state.activeTool = toolId;

  // ステータスバー更新
  const statusTool = document.getElementById('status-tool');
  statusTool.textContent = TOOL_NAMES[toolId] || toolId;

  // ツールに応じたカーソルクラス切替
  container.className = '';
  if (toolId !== 'select') {
    container.classList.add(`tool-${toolId}`);
  }

  // OrbitControls の制御
  if (toolId === 'select') {
    controls.enabled = true;
    controls.enableRotate = true;
  } else {
    controls.enabled = true;         // 完全無効化はしない
    controls.enableRotate = false;   // 左ドラッグ回転のみ無効
  }
}
