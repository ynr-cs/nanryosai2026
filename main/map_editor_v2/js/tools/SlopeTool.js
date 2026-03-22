/**
 * SlopeTool.js — スロープ・階段ツール
 * 
 * 校庭の段差や渡り廊下など、高低差を繋ぐスロープ（斜面）や
 * 階段を2点指定で生成する。WallToolと類似の2点クリック方式。
 */

import * as THREE from 'three';
import { scene } from '../core/Renderer.js';
import { mapData, generateSlopeId, getActiveFloor, getFloorWorldY } from '../core/MapData.js';
import { currentSnappedPos } from '../core/Controls.js';

// コールバック: スロープ追加後に main.js がツリー更新を行うため
let _onSlopeAdded = null;

/** スロープ追加時のコールバックを登録する */
export function setOnSlopeAdded(callback) {
  _onSlopeAdded = callback;
}

// ============================================
// デフォルトパラメータ
// ============================================
export const SLOPE_DEFAULTS = {
  width: 2.0,           // スロープの幅 (m)
  thickness: 0.15,      // スロープの厚さ (m)
  color: 0xccaa77,      // 色 (ウッド系ベージュ)
  previewColor: 0xccaa77,
  previewOpacity: 0.4,
  endY: 3.5,            // デフォルトの終点Y（1フロア分の高さ）
};

// ============================================
// 内部状態
// ============================================
let slopeStartPoint = null;   // 始点 {x, z}
let previewMesh = null;       // プレビューメッシュ
let previewLine = null;       // ガイドライン

/** 全スロープメッシュを格納するグループ */
export const slopeMeshGroup = new THREE.Group();
slopeMeshGroup.name = '__slopes__';

// ============================================
// クリック処理
// ============================================

/**
 * スロープの始点/終点クリック処理。
 * @param {string} activeFloorId
 */
export function handleSlopeClick(activeFloorId) {
  const x = currentSnappedPos.x;
  const z = currentSnappedPos.z;

  if (!slopeStartPoint) {
    // === 始点確定 ===
    slopeStartPoint = { x, z };
    console.log(`[SlopeTool] 始点確定: (${x}, ${z})`);
  } else {
    // === 終点確定 ===
    const sx = slopeStartPoint.x;
    const sz = slopeStartPoint.z;

    // 同一点チェック
    if (sx === x && sz === z) {
      console.log('[SlopeTool] 始点と終点が同一のためスキップ');
      return;
    }

    const result = getActiveFloor(activeFloorId);
    if (!result) {
      console.error('[SlopeTool] アクティブフロアが見つかりません');
      return;
    }
    const { building, floor } = result;

    // スロープデータ作成
    const slopeData = createSlopeData(sx, sz, x, z);

    // mapData に保存
    if (!floor.elements.stairs) floor.elements.stairs = [];
    floor.elements.stairs.push(slopeData);

    // 3D Mesh を生成してシーンに追加
    const mesh = createSlopeMesh(slopeData, building, floor);
    slopeMeshGroup.add(mesh);

    console.log(`[SlopeTool] スロープ確定: ${slopeData.id} (${sx},${sz}) → (${x},${z})`);

    // コールバック通知
    if (_onSlopeAdded) _onSlopeAdded(slopeData);

    // プレビュークリア & 状態リセット
    clearSlopePreview();
    slopeStartPoint = null;
  }
}

// ============================================
// データ作成
// ============================================

/**
 * スロープデータオブジェクトを作成する
 */
function createSlopeData(sx, sz, ex, ez) {
  const id = generateSlopeId();
  const horizontalDx = ex - sx;
  const horizontalDz = ez - sz;
  const horizontalDist = Math.sqrt(horizontalDx * horizontalDx + horizontalDz * horizontalDz);

  return {
    id,
    start: { x: sx, y: 0, z: sz },
    end: { x: ex, y: SLOPE_DEFAULTS.endY, z: ez },
    width: SLOPE_DEFAULTS.width,
    thickness: SLOPE_DEFAULTS.thickness,
    type: 'slope',
    _horizontalLength: horizontalDist, // 内部メタ
  };
}

// ============================================
// メッシュ生成
// ============================================

/**
 * スロープの3D Meshを生成する
 * @param {object} slopeData
 * @param {object} building
 * @param {object} floor
 * @returns {THREE.Mesh}
 */
export function createSlopeMesh(slopeData, building, floor) {
  const { id, start, end, width, thickness } = slopeData;
  const worldY = getFloorWorldY(building, floor);

  // XZ平面上の水平距離
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  // 高低差
  const dy = end.y - start.y;

  // スロープの実際の長さ (斜辺)
  const slopeLength = Math.sqrt(horizontalDist * horizontalDist + dy * dy);

  // XZ平面上のY軸回転角
  const yawAngle = Math.atan2(dz, dx);

  // 勾配角度 (X軸回転)
  const pitchAngle = Math.atan2(dy, horizontalDist);

  // BoxGeometry: 長さ × 厚さ × 幅
  const geometry = new THREE.BoxGeometry(slopeLength, thickness, width);
  const material = new THREE.MeshStandardMaterial({
    color: SLOPE_DEFAULTS.color,
    roughness: 0.6,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // 中点を計算
  const midX = (start.x + end.x) / 2;
  const midZ = (start.z + end.z) / 2;
  const midY = worldY + (start.y + end.y) / 2;

  mesh.position.set(midX, midY, midZ);

  // 回転を適用: まずY軸(方位角)、次にZ軸(勾配)で回転
  // Three.js のオイラー角は XYZ 順序なので、
  // Z軸で勾配角を立て、Y軸で方位角を回す
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = -yawAngle;
  mesh.rotation.x = pitchAngle;

  mesh.userData = {
    type: 'slope',
    slopeId: id,
    floorId: floor.id,
    buildingId: building.id,
  };
  mesh.name = id;

  return mesh;
}

// ============================================
// プレビュー
// ============================================

/**
 * マウス追従のスローププレビューを更新する
 * @param {number} endX
 * @param {number} endZ
 * @param {string} activeFloorId
 */
export function updateSlopePreview(endX, endZ, activeFloorId) {
  const sx = slopeStartPoint.x;
  const sz = slopeStartPoint.z;

  const result = getActiveFloor(activeFloorId);
  if (!result) return;
  const { building, floor } = result;
  const worldY = getFloorWorldY(building, floor);

  // --- ガイドライン ---
  if (previewLine) {
    scene.remove(previewLine);
    previewLine.geometry.dispose();
    previewLine.material.dispose();
  }

  const endY = SLOPE_DEFAULTS.endY;
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(sx, worldY + 0.02, sz),
    new THREE.Vector3(endX, worldY + endY, endZ),
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: SLOPE_DEFAULTS.previewColor,
    linewidth: 2,
  });
  previewLine = new THREE.Line(lineGeo, lineMat);
  previewLine.name = '__slope_preview_line__';
  scene.add(previewLine);

  // --- プレビューメッシュ ---
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    previewMesh.material.dispose();
  }

  const dx = endX - sx;
  const dz = endZ - sz;
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);

  if (horizontalDist > 0.1) {
    const dy = endY;
    const slopeLength = Math.sqrt(horizontalDist * horizontalDist + dy * dy);
    const yawAngle = Math.atan2(dz, dx);
    const pitchAngle = Math.atan2(dy, horizontalDist);

    const previewGeo = new THREE.BoxGeometry(slopeLength, SLOPE_DEFAULTS.thickness, SLOPE_DEFAULTS.width);
    const previewMat = new THREE.MeshStandardMaterial({
      color: SLOPE_DEFAULTS.previewColor,
      transparent: true,
      opacity: SLOPE_DEFAULTS.previewOpacity,
      depthWrite: false,
    });

    previewMesh = new THREE.Mesh(previewGeo, previewMat);

    const midX = (sx + endX) / 2;
    const midZ = (sz + endZ) / 2;
    const midY = worldY + dy / 2;

    previewMesh.position.set(midX, midY, midZ);
    previewMesh.rotation.order = 'YXZ';
    previewMesh.rotation.y = -yawAngle;
    previewMesh.rotation.x = pitchAngle;
    previewMesh.name = '__slope_preview_mesh__';
    scene.add(previewMesh);
  }
}

/** プレビューをクリアする */
function clearSlopePreview() {
  if (previewLine) {
    scene.remove(previewLine);
    previewLine.geometry.dispose();
    previewLine.material.dispose();
    previewLine = null;
  }
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    previewMesh.material.dispose();
    previewMesh = null;
  }
}

// ============================================
// キャンセル & ステート
// ============================================

/** スロープ描画をキャンセルする */
export function cancelSlopeDrawing() {
  slopeStartPoint = null;
  clearSlopePreview();
  console.log('[SlopeTool] 描画キャンセル');
}

/** スロープ描画中かどうか */
export function isDrawing() {
  return slopeStartPoint !== null;
}
