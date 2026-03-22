/**
 * OpeningTool.js — 開口部ツール (ドア/窓)
 * 
 * 既存の壁に対してドアや窓などの開口部を配置する。
 * 壁をクリックして交点を検出し、壁の始点からのオフセット距離を自動算出する。
 * CSGは使用せず、壁表面に色違いメッシュ＋枠線をオーバーレイ配置する方式。
 */

import * as THREE from 'three';
import { scene, getActiveCamera } from '../core/Renderer.js';
import { mapData, generateOpeningId, getActiveFloor, getFloorWorldY } from '../core/MapData.js';
import { wallMeshGroup } from './WallTool.js';

// コールバック: 開口部追加後に main.js がツリー更新を行うため
let _onOpeningAdded = null;

/** 開口部追加時のコールバックを登録する */
export function setOnOpeningAdded(callback) {
  _onOpeningAdded = callback;
}

// ============================================
// デフォルトパラメータ
// ============================================
export const OPENING_DEFAULTS = {
  width: 1.0,          // 開口幅 (m)
  height: 2.0,         // 開口高さ (m)
  sillHeight: 0.0,     // 開口下端の床面からの高さ (ドア=0, 窓=1.0)
  doorColor: 0x4a90d9, // ドアの色 (青系)
  frameColor: 0x333333, // 枠線の色
  previewColor: 0x4a90d9,
  previewOpacity: 0.5,
};

// ============================================
// 内部状態
// ============================================
let targetWallMesh = null;     // 選択された壁メッシュ
let targetWallData = null;     // 選択された壁のデータ
let hitPoint = null;           // Raycaster の交点
let previewMesh = null;        // プレビューメッシュ
let previewFrame = null;       // プレビュー枠線
let isInPlacementMode = false; // 壁選択後の配置モード

/** 全開口部メッシュを格納するグループ */
export const openingMeshGroup = new THREE.Group();
openingMeshGroup.name = '__openings__';

// Raycaster (壁との交差判定用)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ============================================
// クリック処理
// ============================================

/**
 * 開口部ツールのクリック処理。
 * 1回目: 壁を選択 → 2回目: 配置を確定
 * @param {MouseEvent} event
 * @param {HTMLElement} container
 * @param {string} activeFloorId
 */
export function handleOpeningClick(event, container, activeFloorId) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, getActiveCamera());

  if (!isInPlacementMode) {
    // === ステップ1: 壁を選択 ===
    const intersects = raycaster.intersectObjects(wallMeshGroup.children, false);
    if (intersects.length === 0) {
      console.log('[OpeningTool] 壁が見つかりません');
      return;
    }

    const hit = intersects[0];
    targetWallMesh = hit.object;
    hitPoint = hit.point.clone();

    // 壁データを取得
    const { wallId, floorId, buildingId } = targetWallMesh.userData;
    targetWallData = findWallData(buildingId, floorId, wallId);

    if (!targetWallData) {
      console.warn('[OpeningTool] 壁データが見つかりません');
      return;
    }

    isInPlacementMode = true;
    console.log(`[OpeningTool] 壁選択: ${wallId}`);

    // 初回プレビューを表示
    showPreview(activeFloorId);

  } else {
    // === ステップ2: 開口部を確定 ===
    finishPlacement(activeFloorId);
  }
}

/**
 * マウス移動時のプレビュー更新
 * @param {MouseEvent} event
 * @param {HTMLElement} container
 * @param {string} activeFloorId
 */
export function updateOpeningPreview(event, container, activeFloorId) {
  if (!isInPlacementMode || !targetWallMesh) return;

  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, getActiveCamera());

  // 壁への再交差判定
  const intersects = raycaster.intersectObject(targetWallMesh, false);
  if (intersects.length > 0) {
    hitPoint = intersects[0].point.clone();
    showPreview(activeFloorId);
  }
}

// ============================================
// プレビュー表示
// ============================================

/**
 * 交点位置にプレビューメッシュを表示する
 */
function showPreview(activeFloorId) {
  clearPreview();

  if (!targetWallData || !hitPoint) return;

  const result = getActiveFloor(activeFloorId);
  if (!result) return;
  const { building, floor } = result;
  const worldY = getFloorWorldY(building, floor);

  // 壁の始点・終点からオフセットを算出
  const wallStart = targetWallData.start;
  const wallEnd = targetWallData.end;
  const wallDx = wallEnd.x - wallStart.x;
  const wallDz = wallEnd.z - wallStart.z;
  const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz);
  const wallAngle = Math.atan2(wallDz, wallDx);

  // ヒットポイントを壁の線分に投影してオフセットを算出
  const offset = computeOffset(wallStart, wallEnd, hitPoint);

  // オフセットを壁の範囲内にクランプ
  const halfWidth = OPENING_DEFAULTS.width / 2;
  const clampedOffset = Math.max(halfWidth, Math.min(wallLength - halfWidth, offset));

  // 開口部の中心位置 (壁の始点から壁方向にoffset分進んだ位置)
  const dirX = wallDx / wallLength;
  const dirZ = wallDz / wallLength;
  const centerX = wallStart.x + dirX * clampedOffset;
  const centerZ = wallStart.z + dirZ * clampedOffset;
  const centerY = worldY + OPENING_DEFAULTS.sillHeight + OPENING_DEFAULTS.height / 2;

  // --- プレビューメッシュ (半透明) ---
  const geo = new THREE.BoxGeometry(
    OPENING_DEFAULTS.width,
    OPENING_DEFAULTS.height,
    targetWallData.thickness + 0.02 // 壁より少し厚くして視認性確保
  );
  const mat = new THREE.MeshStandardMaterial({
    color: OPENING_DEFAULTS.previewColor,
    transparent: true,
    opacity: OPENING_DEFAULTS.previewOpacity,
    depthWrite: false,
  });

  previewMesh = new THREE.Mesh(geo, mat);
  previewMesh.position.set(centerX, centerY, centerZ);
  previewMesh.rotation.y = -wallAngle;
  previewMesh.name = '__opening_preview__';
  scene.add(previewMesh);

  // --- 枠線 (EdgesGeometry) ---
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: OPENING_DEFAULTS.frameColor });
  previewFrame = new THREE.LineSegments(edges, lineMat);
  previewFrame.position.copy(previewMesh.position);
  previewFrame.rotation.copy(previewMesh.rotation);
  previewFrame.name = '__opening_preview_frame__';
  scene.add(previewFrame);
}

// ============================================
// 配置確定
// ============================================

/**
 * 開口部を確定して mapData に保存する
 */
function finishPlacement(activeFloorId) {
  if (!targetWallData || !hitPoint) {
    cancelOpeningPlacement();
    return;
  }

  const result = getActiveFloor(activeFloorId);
  if (!result) return;
  const { building, floor } = result;

  const wallStart = targetWallData.start;
  const wallEnd = targetWallData.end;
  const wallDx = wallEnd.x - wallStart.x;
  const wallDz = wallEnd.z - wallStart.z;
  const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz);

  // オフセット算出 & クランプ
  const offset = computeOffset(wallStart, wallEnd, hitPoint);
  const halfWidth = OPENING_DEFAULTS.width / 2;
  const clampedOffset = Math.max(halfWidth, Math.min(wallLength - halfWidth, offset));

  // 開口部データ作成
  const openingData = {
    id: generateOpeningId(),
    wallId: targetWallData.id,
    offset: parseFloat(clampedOffset.toFixed(2)),
    width: OPENING_DEFAULTS.width,
    height: OPENING_DEFAULTS.height,
    sillHeight: OPENING_DEFAULTS.sillHeight,
    type: 'door',
  };

  // mapData に保存
  if (!floor.elements.openings) floor.elements.openings = [];
  floor.elements.openings.push(openingData);

  // 3D Mesh を生成してシーンに追加
  const mesh = createOpeningMesh(openingData, targetWallData, building, floor);
  openingMeshGroup.add(mesh);

  console.log(`[OpeningTool] 開口部確定: ${openingData.id} (wallId=${openingData.wallId}, offset=${openingData.offset}m)`);

  // コールバック通知
  if (_onOpeningAdded) _onOpeningAdded(openingData);

  // 状態リセット
  cancelOpeningPlacement();
}

// ============================================
// メッシュ生成
// ============================================

/**
 * 開口部の3D Meshを生成する
 * @param {object} openingData - 開口部データ
 * @param {object} wallData - 親壁データ
 * @param {object} building - 親建物
 * @param {object} floor - 親フロア
 * @returns {THREE.Group} 開口部のメッシュグループ(板+枠線)
 */
export function createOpeningMesh(openingData, wallData, building, floor) {
  const { id, offset, width, height, sillHeight } = openingData;
  const worldY = getFloorWorldY(building, floor);

  // 壁のジオメトリ情報
  const wallStart = wallData.start;
  const wallEnd = wallData.end;
  const wallDx = wallEnd.x - wallStart.x;
  const wallDz = wallEnd.z - wallStart.z;
  const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz);
  const wallAngle = Math.atan2(wallDz, wallDx);

  // 壁方向の単位ベクトル
  const dirX = wallDx / wallLength;
  const dirZ = wallDz / wallLength;

  // 開口中心位置
  const centerX = wallStart.x + dirX * offset;
  const centerZ = wallStart.z + dirZ * offset;
  const centerY = worldY + sillHeight + height / 2;

  // --- メイン板メッシュ ---
  const geo = new THREE.BoxGeometry(width, height, wallData.thickness + 0.02);
  const mat = new THREE.MeshStandardMaterial({
    color: OPENING_DEFAULTS.doorColor,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });

  const panelMesh = new THREE.Mesh(geo, mat);
  panelMesh.position.set(centerX, centerY, centerZ);
  panelMesh.rotation.y = -wallAngle;
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;

  // --- 枠線 ---
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: OPENING_DEFAULTS.frameColor, linewidth: 2 });
  const frame = new THREE.LineSegments(edges, lineMat);
  frame.position.copy(panelMesh.position);
  frame.rotation.copy(panelMesh.rotation);

  // グループにまとめる
  const group = new THREE.Group();
  group.add(panelMesh);
  group.add(frame);

  group.userData = {
    type: 'opening',
    openingId: id,
    wallId: wallData.id,
    floorId: floor.id,
    buildingId: building.id,
  };
  group.name = id;

  return group;
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * ヒットポイントを壁の線分に投影し、始点からのオフセット距離を計算する。
 */
function computeOffset(wallStart, wallEnd, point) {
  const wallDx = wallEnd.x - wallStart.x;
  const wallDz = wallEnd.z - wallStart.z;
  const wallLenSq = wallDx * wallDx + wallDz * wallDz;

  const px = point.x - wallStart.x;
  const pz = point.z - wallStart.z;

  // 壁ベクトルへの射影
  const t = (px * wallDx + pz * wallDz) / wallLenSq;
  const clampedT = Math.max(0, Math.min(1, t));

  return clampedT * Math.sqrt(wallLenSq);
}

/**
 * buildingId, floorId, wallId から壁データを検索する
 */
function findWallData(buildingId, floorId, wallId) {
  for (const building of mapData.site.buildings) {
    if (building.id !== buildingId) continue;
    for (const floor of building.floors) {
      if (floor.id !== floorId) continue;
      return floor.elements.walls.find(w => w.id === wallId) || null;
    }
  }
  return null;
}

// ============================================
// キャンセル & ステート
// ============================================

/** プレビューをクリアする */
function clearPreview() {
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    previewMesh.material.dispose();
    previewMesh = null;
  }
  if (previewFrame) {
    scene.remove(previewFrame);
    previewFrame.geometry.dispose();
    previewFrame.material.dispose();
    previewFrame = null;
  }
}

/** 配置モードをキャンセルする */
export function cancelOpeningPlacement() {
  clearPreview();
  targetWallMesh = null;
  targetWallData = null;
  hitPoint = null;
  isInPlacementMode = false;
  console.log('[OpeningTool] 配置キャンセル');
}

/** 配置モード中かどうか */
export function isPlacing() {
  return isInPlacementMode;
}
