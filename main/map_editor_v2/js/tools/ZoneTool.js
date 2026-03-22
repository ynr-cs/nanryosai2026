/**
 * ZoneTool.js — ゾーン定義ツール
 * 
 * 物理的な壁とは独立した空間ボリューム（ポリゴン）を作図し、
 * 企画などと連携するためのUUIDを持つ Zone データを作成する。
 */

import * as THREE from 'three';
import { scene } from '../core/Renderer.js';
import { mapData, getActiveFloor, getFloorWorldY } from '../core/MapData.js';
import { currentSnappedPos } from '../core/Controls.js';

let _onZoneAdded = null;

export function setOnZoneAdded(callback) {
  _onZoneAdded = callback;
}

// ============================================
// 定数・パラメータ
// ============================================
export const ZONE_DEFAULTS = {
  height: 3.0,
  color: 0x00ffaa,
  opacity: 0.3,
  lineColor: 0x00ffaa,
};

// ============================================
// 内部状態
// ============================================
let zonePoints = []; // {x, z} の配列
let previewLine = null;
let previewMesh = null;
let currentPreviewPoint = null;

export const zoneMeshGroup = new THREE.Group();
zoneMeshGroup.name = '__zones__';

// UUID の生成 (ブラウザ標準機能)
export function generateZoneId() {
  return 'zone_' + crypto.randomUUID();
}

// ============================================
// イベントハンドラ
// ============================================

/**
 * キャンバスクリック処理（頂点追加・確定）
 */
export function handleZoneClick(activeFloorId) {
  const x = currentSnappedPos.x;
  const z = currentSnappedPos.z;

  // 最初の点がない場合は開始
  if (zonePoints.length === 0) {
    zonePoints.push({ x, z });
    console.log(`[ZoneTool] 描画開始: (${x}, ${z})`);
    return;
  }

  // 直前のポイントと同じならスキップ
  const lastPt = zonePoints[zonePoints.length - 1];
  if (lastPt.x === x && lastPt.z === z) return;

  // 始点付近をクリックしたか、またはダブルクリック判定 (3点以上ある場合)
  const firstPt = zonePoints[0];
  const distToFirst = Math.hypot(firstPt.x - x, firstPt.z - z);

  if (zonePoints.length >= 3 && distToFirst < 0.5) {
    // === 完了 ===
    finishZoneDrawing(activeFloorId);
  } else {
    // 頂点追加
    zonePoints.push({ x, z });
    console.log(`[ZoneTool] 頂点追加: (${x}, ${z}) [計${zonePoints.length}点]`);
  }
}

/**
 * ゾーン描画を完了して確定する
 */
export function finishZoneDrawing(activeFloorId) {
  if (zonePoints.length < 3) {
    console.warn('[ZoneTool] ポリゴンは3点以上必要です');
    cancelZoneDrawing();
    return;
  }

  const result = getActiveFloor(activeFloorId);
  if (!result) return;
  const { building, floor } = result;

  const id = generateZoneId();
  const zoneData = {
    id,
    points: [...zonePoints],
    height: ZONE_DEFAULTS.height,
  };

  // mapData に保存
  if (!floor.zones) floor.zones = [];
  floor.zones.push(zoneData);

  // Scene に追加
  const mesh = createZoneMesh(zoneData, building, floor);
  zoneMeshGroup.add(mesh);

  console.log(`[ZoneTool] Zone確定: ${id} (${zonePoints.length}頂点)`);

  if (_onZoneAdded) _onZoneAdded(zoneData);

  // 状態クリア
  cancelZoneDrawing();
}

/**
 * メウスムーブによるプレビューの更新
 */
export function updateZonePreview(endX, endZ, activeFloorId) {
  if (zonePoints.length === 0) return;

  const result = getActiveFloor(activeFloorId);
  if (!result) return;
  const worldY = getFloorWorldY(result.building, result.floor);

  currentPreviewPoint = { x: endX, z: endZ };
  const allPoints = [...zonePoints, currentPreviewPoint];

  // --- プレビューライン ---
  if (previewLine) {
    scene.remove(previewLine);
    previewLine.geometry.dispose();
    previewLine.material.dispose();
  }

  const vecPoints = allPoints.map(p => new THREE.Vector3(p.x, worldY + 0.03, p.z));
  // ポリゴンを閉じるように始点に戻る線も引く（3点以上の場合）
  if (allPoints.length >= 3) {
    vecPoints.push(new THREE.Vector3(allPoints[0].x, worldY + 0.03, allPoints[0].z));
  }

  const lineGeo = new THREE.BufferGeometry().setFromPoints(vecPoints);
  const lineMat = new THREE.LineBasicMaterial({
    color: ZONE_DEFAULTS.lineColor,
    linewidth: 2,
  });
  previewLine = new THREE.Line(lineGeo, lineMat);
  scene.add(previewLine);

  // --- プレビューポリゴンメッシュ ---
  if (previewMesh) {
    scene.remove(previewMesh);
    previewMesh.geometry.dispose();
    previewMesh.material.dispose();
    previewMesh = null;
  }

  if (allPoints.length >= 3) {
    const shape = new THREE.Shape();
    shape.moveTo(allPoints[0].x, allPoints[0].z);
    for (let i = 1; i < allPoints.length; i++) {
      shape.lineTo(allPoints[i].x, allPoints[i].z);
    }

    const extrudeSettings = { depth: ZONE_DEFAULTS.height, bevelEnabled: false };
    const previewGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // X軸周りに90度回転させることで、XZ平面上で正しく展開し、-Y方向へ押し出される
    previewGeo.rotateX(Math.PI / 2);

    const previewMat = new THREE.MeshStandardMaterial({
      color: ZONE_DEFAULTS.color,
      transparent: true,
      opacity: ZONE_DEFAULTS.opacity,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    previewMesh = new THREE.Mesh(previewGeo, previewMat);
    // 押し出し方向（-Y）を加味して、高さを足した位置に置く
    previewMesh.position.set(0, worldY + ZONE_DEFAULTS.height, 0);
    scene.add(previewMesh);
  }
}

/**
 * ゾーンの3DMesh(確定版)を生成する
 */
export function createZoneMesh(zoneData, building, floor) {
  const { points, height, id } = zoneData;
  const worldY = getFloorWorldY(building, floor);

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].z);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].z);
  }

  const extrudeSettings = { depth: height, bevelEnabled: false };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.rotateX(Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: ZONE_DEFAULTS.color,
    transparent: true,
    opacity: ZONE_DEFAULTS.opacity,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, worldY + height, 0);

  mesh.userData = {
    type: 'zone',
    zoneId: id,
    floorId: floor.id,
    buildingId: building.id,
  };
  mesh.name = id;

  return mesh;
}

/**
 * 描画のキャンセルとリセット
 */
export function cancelZoneDrawing() {
  zonePoints = [];
  currentPreviewPoint = null;

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

/**
 * ゾーン描画中かどうか判定
 */
export function isDrawing() {
  return zonePoints.length > 0;
}
