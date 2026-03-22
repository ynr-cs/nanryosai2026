/**
 * SelectTool.js — 選択・編集・削除ツール
 * 
 * キャンバス上のオブジェクト（壁など）をクリックして選択し、
 * Deleteキーで削除する機能を提供する。
 */

import * as THREE from 'three';
import { getActiveCamera } from '../core/Renderer.js';
import { mapData } from '../core/MapData.js';
import { wallMeshGroup } from './WallTool.js';

let _onWallDeleted = null;

/** 壁削除時のコールバックを登録する */
export function setOnWallDeleted(callback) {
  _onWallDeleted = callback;
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

  // wallMeshGroupの子要素との交差判定
  const intersects = raycaster.intersectObjects(wallMeshGroup.children, false);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    selectMesh(hitMesh);
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
  originalMaterial = mesh.material;
  mesh.material = highlightMaterial;
  
  console.log(`[SelectTool] 選択: ${mesh.name || mesh.uuid}`);
}

/**
 * 選択状態を解除する
 */
export function clearSelection() {
  if (selectedMesh && originalMaterial) {
    selectedMesh.material = originalMaterial;
  }
  selectedMesh = null;
  originalMaterial = null;
}

/**
 * 選択中のメッシュを mapData と Scene の両方から削除する
 */
function deleteSelectedMesh() {
  if (!selectedMesh) return;

  const { type, wallId, floorId, buildingId } = selectedMesh.userData;

  if (type === 'wall') {
    let isDeleted = false;

    // mapData から該当の壁データを走査して削除
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
      
      // Scene からメッシュを削除・メモリ解放
      wallMeshGroup.remove(selectedMesh);
      selectedMesh.geometry.dispose();
      // 元のマテリアルは他の壁と共有されている可能性があるため dispose しない
      selectedMesh = null;
      originalMaterial = null;

      // コールバックを発火して UI (HierarchyTree等) を更新
      if (_onWallDeleted) _onWallDeleted();
    } else {
      console.warn(`[SelectTool] 削除対象の壁データが見つかりません: ${wallId}`);
    }
  }
}
