/**
 * SelectTool.js — 選択・編集・削除ツール
 * 
 * キャンバス上のオブジェクト（壁、開口部、スロープなど）をクリックして選択し、
 * Deleteキーで削除する機能を提供する。
 */

import * as THREE from 'three';
import { getActiveCamera } from '../core/Renderer.js';
import { mapData } from '../core/MapData.js';
import { wallMeshGroup } from './WallTool.js';
import { openingMeshGroup } from './OpeningTool.js';
import { slopeMeshGroup } from './SlopeTool.js';

let _onWallDeleted = null;
let _onOpeningDeleted = null;
let _onSlopeDeleted = null;

/** 壁削除時のコールバックを登録する */
export function setOnWallDeleted(callback) {
  _onWallDeleted = callback;
}

/** 開口部削除時のコールバックを登録する */
export function setOnOpeningDeleted(callback) {
  _onOpeningDeleted = callback;
}

/** スロープ削除時のコールバックを登録する */
export function setOnSlopeDeleted(callback) {
  _onSlopeDeleted = callback;
}

// ============================================
// 内部状態
// ============================================
let selectedMesh = null;
let originalMaterial = null;

// ハイライト用マテリアル
const highlightMaterial = new THREE.MeshStandardMaterial({
  color: 0xffaa00,
  emissive: 0x332200,
  roughness: 0.5,
  metalness: 0.2,
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ============================================
// イベントハンドラ
// ============================================

/**
 * キャンバスクリック時の選択処理
 * @param {MouseEvent} event 
 * @param {HTMLElement} container 
 */
export function handleSelectClick(event, container) {
  // マウス座標を -1 から +1 の範囲に正規化
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // レイキャスト更新
  raycaster.setFromCamera(mouse, getActiveCamera());

  // 全オブジェクトグループとの交差判定
  const allTargets = [
    ...wallMeshGroup.children,
    ...openingMeshGroup.children,
    ...slopeMeshGroup.children,
  ];

  // openingMeshGroup の子は THREE.Group なので recursive=true で内部メッシュも判定
  const intersects = raycaster.intersectObjects(allTargets, true);

  if (intersects.length > 0) {
    // ヒットしたオブジェクトから、userData.type を持つ最も近い親を探す
    let hitObject = intersects[0].object;
    while (hitObject && !hitObject.userData?.type) {
      hitObject = hitObject.parent;
    }
    if (hitObject && hitObject.userData?.type) {
      selectMesh(hitObject);
    } else {
      clearSelection();
    }
  } else {
    clearSelection();
  }
}

/**
 * キーボード入力時の処理（削除など）
 * @param {KeyboardEvent} event 
 */
export function handleSelectKeyDown(event) {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedMesh) {
      deleteSelectedMesh();
    }
  }
}

// ============================================
// コントロールロジック
// ============================================

/**
 * メッシュを選択状態にする
 */
function selectMesh(mesh) {
  if (selectedMesh === mesh) return;

  clearSelection();

  selectedMesh = mesh;

  // グループ（Opening）の場合は最初の子メッシュのマテリアルを変更
  if (mesh instanceof THREE.Group && mesh.children.length > 0) {
    const panelMesh = mesh.children[0];
    if (panelMesh instanceof THREE.Mesh) {
      originalMaterial = panelMesh.material;
      panelMesh.material = highlightMaterial;
    }
  } else if (mesh instanceof THREE.Mesh) {
    originalMaterial = mesh.material;
    mesh.material = highlightMaterial;
  }
  
  console.log(`[SelectTool] 選択: ${mesh.name || mesh.uuid} (type: ${mesh.userData?.type})`);
}

/**
 * 選択状態を解除する
 */
export function clearSelection() {
  if (selectedMesh) {
    if (selectedMesh instanceof THREE.Group && selectedMesh.children.length > 0) {
      const panelMesh = selectedMesh.children[0];
      if (panelMesh instanceof THREE.Mesh && originalMaterial) {
        panelMesh.material = originalMaterial;
      }
    } else if (selectedMesh instanceof THREE.Mesh && originalMaterial) {
      selectedMesh.material = originalMaterial;
    }
  }
  selectedMesh = null;
  originalMaterial = null;
}

/**
 * 選択中のメッシュを mapData と Scene の両方から削除する
 */
function deleteSelectedMesh() {
  if (!selectedMesh) return;

  const { type } = selectedMesh.userData;

  if (type === 'wall') {
    deleteWall();
  } else if (type === 'opening') {
    deleteOpening();
  } else if (type === 'slope') {
    deleteSlope();
  }
}

// ============================================
// 削除ロジック（型別）
// ============================================

/** 壁を削除する */
function deleteWall() {
  const { wallId, floorId, buildingId } = selectedMesh.userData;
  let isDeleted = false;

  for (const building of mapData.site.buildings) {
    if (building.id !== buildingId) continue;
    for (const floor of building.floors) {
      if (floor.id !== floorId) continue;
      const wallIndex = floor.elements.walls.findIndex(w => w.id === wallId);
      if (wallIndex !== -1) {
        floor.elements.walls.splice(wallIndex, 1);
        isDeleted = true;
        break;
      }
    }
    if (isDeleted) break;
  }

  if (isDeleted) {
    console.log(`[SelectTool] 壁データ削除: ${wallId}`);
    wallMeshGroup.remove(selectedMesh);
    selectedMesh.geometry.dispose();
    selectedMesh = null;
    originalMaterial = null;
    if (_onWallDeleted) _onWallDeleted();
  } else {
    console.warn(`[SelectTool] 削除対象の壁データが見つかりません: ${wallId}`);
  }
}

/** 開口部を削除する */
function deleteOpening() {
  const { openingId, floorId, buildingId } = selectedMesh.userData;
  let isDeleted = false;

  for (const building of mapData.site.buildings) {
    if (building.id !== buildingId) continue;
    for (const floor of building.floors) {
      if (floor.id !== floorId) continue;
      if (!floor.elements.openings) continue;
      const index = floor.elements.openings.findIndex(o => o.id === openingId);
      if (index !== -1) {
        floor.elements.openings.splice(index, 1);
        isDeleted = true;
        break;
      }
    }
    if (isDeleted) break;
  }

  if (isDeleted) {
    console.log(`[SelectTool] 開口部データ削除: ${openingId}`);
    openingMeshGroup.remove(selectedMesh);
    // Group の子を個別に dispose
    selectedMesh.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    selectedMesh = null;
    originalMaterial = null;
    if (_onOpeningDeleted) _onOpeningDeleted();
  } else {
    console.warn(`[SelectTool] 削除対象の開口部データが見つかりません: ${openingId}`);
  }
}

/** スロープを削除する */
function deleteSlope() {
  const { slopeId, floorId, buildingId } = selectedMesh.userData;
  let isDeleted = false;

  for (const building of mapData.site.buildings) {
    if (building.id !== buildingId) continue;
    for (const floor of building.floors) {
      if (floor.id !== floorId) continue;
      if (!floor.elements.stairs) continue;
      const index = floor.elements.stairs.findIndex(s => s.id === slopeId);
      if (index !== -1) {
        floor.elements.stairs.splice(index, 1);
        isDeleted = true;
        break;
      }
    }
    if (isDeleted) break;
  }

  if (isDeleted) {
    console.log(`[SelectTool] スロープデータ削除: ${slopeId}`);
    slopeMeshGroup.remove(selectedMesh);
    selectedMesh.geometry.dispose();
    selectedMesh = null;
    originalMaterial = null;
    if (_onSlopeDeleted) _onSlopeDeleted();
  } else {
    console.warn(`[SelectTool] 削除対象のスロープデータが見つかりません: ${slopeId}`);
  }
}
