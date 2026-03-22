/**
 * WallTool.js — 壁描画ツール
 * 
 * 壁の始点・終点管理、プレビュー線/Meshの生成、
 * 壁データ作成と3D Mesh生成を担当。
 */

import * as THREE from 'three';
import { scene } from '../core/Renderer.js';
import { mapData, generateWallId, getActiveFloor, getFloorWorldY } from '../core/MapData.js';
import { currentSnappedPos } from '../core/Controls.js';

// コールバック: 壁追加後にmain.jsがツリー更新を行うため
let _onWallAdded = null;

/** 壁追加時のコールバックを登録する */
export function setOnWallAdded(callback) {
  _onWallAdded = callback;
}

// ============================================
// 壁のデフォルトパラメータ
// ============================================
export const WALL_DEFAULTS = {
  height: 3.0,
  thickness: 0.2,
  color: 0x8899aa,
  previewColor: 0x6a11cb,
  previewOpacity: 0.4,
};

// 壁描画ツール用の内部状態
let wallStartPoint = null;    // 始点 {x, z}（スナップ済み）
let wallPreviewLine = null;   // プレビューライン (THREE.Line)
let wallPreviewMesh = null;   // プレビュー壁メッシュ

/** 全壁メッシュを格納するグループ（Scene に追加して使う） */
export const wallMeshGroup = new THREE.Group();
wallMeshGroup.name = '__walls__';

// ============================================
// 壁描画のクリック処理
// ============================================

/**
 * 壁描画のクリック処理（始点/終点の確定）。
 * @param {string} activeFloorId - 現在のアクティブフロアID
 */
export function handleWallClick(activeFloorId) {
  const x = currentSnappedPos.x;
  const z = currentSnappedPos.z;

  if (!wallStartPoint) {
    // === 始点の確定 ===
    wallStartPoint = { x, z };
    console.log(`[Wall] 始点確定: (${x}, ${z})`);
  } else {
    // === 終点の確定 ===
    const sx = wallStartPoint.x;
    const sz = wallStartPoint.z;

    // 同一点チェック（長さ0の壁を防止）
    if (sx === x && sz === z) {
      console.log('[Wall] 始点と終点が同一のためスキップ');
      return;
    }

    // 壁データを作成して mapData に保存
    const wallData = createWallData(sx, sz, x, z);
    const result = getActiveFloor(activeFloorId);
    if (!result) {
      console.error('[Wall] アクティブフロアが見つかりません');
      return;
    }

    result.floor.elements.walls.push(wallData);

    // 3D Mesh をシーンに追加
    const mesh = createWallMesh(wallData, result.building, result.floor);
    wallMeshGroup.add(mesh);

    console.log(`[Wall] 壁追加: ${wallData.id} (${sx},${sz}) → (${x},${z}) L=${wallData._length.toFixed(2)}m`);

    // コールバック通知（ツリー更新等）
    if (_onWallAdded) _onWallAdded(wallData);

    // プレビューをクリア
    clearWallPreview();

    // 連続描画: 終点を次の始点に
    wallStartPoint = { x, z };
  }
}

// ============================================
// 壁データ作成
// ============================================

/** 壁データオブジェクトを作成 */
function createWallData(sx, sz, ex, ez) {
  const id = generateWallId();
  const dx = ex - sx;
  const dz = ez - sz;
  const length = Math.sqrt(dx * dx + dz * dz);

  return {
    id,
    start: { x: sx, z: sz },
    end: { x: ex, z: ez },
    height: WALL_DEFAULTS.height,
    thickness: WALL_DEFAULTS.thickness,
    type: "standard",
    _length: length, // 内部用メタ（エクスポート時は除外する想定）
  };
}

// ============================================
// 壁3D Mesh 生成
// ============================================

/** 壁の 3D Mesh を生成 */
function createWallMesh(wallData, building, floor) {
  const { start, end, height, thickness } = wallData;

  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  // BoxGeometry: 長さ × 高さ × 厚さ
  const geometry = new THREE.BoxGeometry(length, height, thickness);
  const material = new THREE.MeshStandardMaterial({
    color: WALL_DEFAULTS.color,
    roughness: 0.7,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // 中点に配置
  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;
  const worldY = getFloorWorldY(building, floor);
  mesh.position.set(midX, worldY + height / 2, midZ);

  // Y軸周りに回転
  mesh.rotation.y = -angle;

  // userData に逆引き情報を格納
  mesh.userData = {
    type: 'wall',
    wallId: wallData.id,
    floorId: floor.id,
    buildingId: building.id,
  };

  mesh.name = wallData.id;

  return mesh;
}

// ============================================
// 壁プレビュー
// ============================================

/**
 * 壁プレビューの更新（マウス追従）。
 * @param {number} endX
 * @param {number} endZ
 * @param {string} activeFloorId
 */
export function updateWallPreview(endX, endZ, activeFloorId) {
  const sx = wallStartPoint.x;
  const sz = wallStartPoint.z;

  const result = getActiveFloor(activeFloorId);
  if (!result) return;
  const worldY = getFloorWorldY(result.building, result.floor);

  // --- プレビューライン ---
  if (wallPreviewLine) {
    scene.remove(wallPreviewLine);
    wallPreviewLine.geometry.dispose();
    wallPreviewLine.material.dispose();
  }

  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(sx, worldY + 0.02, sz),
    new THREE.Vector3(endX, worldY + 0.02, endZ),
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: WALL_DEFAULTS.previewColor,
    linewidth: 2,
  });
  wallPreviewLine = new THREE.Line(lineGeo, lineMat);
  wallPreviewLine.name = '__wall_preview_line__';
  scene.add(wallPreviewLine);

  // --- プレビュー壁メッシュ（半透明） ---
  if (wallPreviewMesh) {
    scene.remove(wallPreviewMesh);
    wallPreviewMesh.geometry.dispose();
    wallPreviewMesh.material.dispose();
  }

  const dx = endX - sx;
  const dz = endZ - sz;
  const length = Math.sqrt(dx * dx + dz * dz);

  if (length > 0.01) { // 最小長さチェック
    const angle = Math.atan2(dz, dx);
    const previewGeo = new THREE.BoxGeometry(length, WALL_DEFAULTS.height, WALL_DEFAULTS.thickness);
    const previewMat = new THREE.MeshStandardMaterial({
      color: WALL_DEFAULTS.previewColor,
      transparent: true,
      opacity: WALL_DEFAULTS.previewOpacity,
      depthWrite: false,
    });

    wallPreviewMesh = new THREE.Mesh(previewGeo, previewMat);
    const midX = (sx + endX) / 2;
    const midZ = (sz + endZ) / 2;
    wallPreviewMesh.position.set(midX, worldY + WALL_DEFAULTS.height / 2, midZ);
    wallPreviewMesh.rotation.y = -angle;
    wallPreviewMesh.name = '__wall_preview_mesh__';
    scene.add(wallPreviewMesh);
  }
}

/** 壁プレビューのクリア */
export function clearWallPreview() {
  if (wallPreviewLine) {
    scene.remove(wallPreviewLine);
    wallPreviewLine.geometry.dispose();
    wallPreviewLine.material.dispose();
    wallPreviewLine = null;
  }
  if (wallPreviewMesh) {
    scene.remove(wallPreviewMesh);
    wallPreviewMesh.geometry.dispose();
    wallPreviewMesh.material.dispose();
    wallPreviewMesh = null;
  }
}

/** 壁描画モードをキャンセル */
export function cancelWallDrawing() {
  wallStartPoint = null;
  clearWallPreview();
  console.log('[Wall] 描画キャンセル');
}

/** 壁描画中かどうか */
export function isDrawing() {
  return wallStartPoint !== null;
}
