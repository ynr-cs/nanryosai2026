/**
 * Controls.js — カメラ操作 & Raycasting
 * 
 * OrbitControls の初期化、2D/3D切り替え、
 * Raycaster による地面平面との交差判定とスナップロジックを担当。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  perspCamera, orthoCamera, activeCamera, setActiveCamera, getActiveCamera,
  renderer, handleResize
} from './Renderer.js';

// ============================================
// エクスポートされるオブジェクト
// ============================================
export let controls;

// Raycast 用の定数
const groundPlaneForRaycast = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();

/** 現在のスナップ済みワールド座標 */
export const currentSnappedPos = { x: 0, z: 0 };

// ============================================
// 初期化
// ============================================

/**
 * OrbitControls を初期化する。
 * @param {HTMLElement} container - キャンバスコンテナのDOM要素
 */
export function initControls(container) {
  controls = new OrbitControls(activeCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // 地面の下に潜り込まない
  controls.minDistance = 2;
  controls.maxDistance = 500;
  controls.target.set(0, 0, 0);
  controls.update();
}

// ============================================
// マウス→ワールド座標変換
// ============================================

/**
 * マウスイベントからスナップ済みワールド座標を更新する。
 * @param {MouseEvent} event
 * @param {HTMLElement} container
 * @param {object} state - { gridSize, snapEnabled }
 * @returns {{ x: number, y: number, z: number } | null} 交差しなかった場合 null
 */
export function updateMouseWorldPos(event, container, state) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, getActiveCamera());
  if (raycaster.ray.intersectPlane(groundPlaneForRaycast, intersectPoint)) {
    let x = intersectPoint.x;
    let z = intersectPoint.z;

    if (state.snapEnabled) {
      x = Math.round(x / state.gridSize) * state.gridSize;
      z = Math.round(z / state.gridSize) * state.gridSize;
    }

    currentSnappedPos.x = x;
    currentSnappedPos.z = z;

    return { x, y: intersectPoint.y, z };
  }
  return null;
}

// ============================================
// カメラ切替
// ============================================

/**
 * 3D パース / 2D 俯瞰ビューを切り替える。
 * @param {'3d' | '2d'} mode
 * @param {HTMLElement} container
 * @returns {boolean} is3DView
 */
export function switchCamera(mode, container) {
  const btn3d = document.getElementById('view-3d');
  const btn2d = document.getElementById('view-2d');

  if (mode === '3d') {
    setActiveCamera(perspCamera);
    btn3d.classList.add('active');
    btn2d.classList.remove('active');

    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.enableRotate = true;

    controls.object = perspCamera;
    controls.update();
    handleResize(container);
    return true; // is3DView
  } else {
    setActiveCamera(orthoCamera);
    btn3d.classList.remove('active');
    btn2d.classList.add('active');

    controls.maxPolarAngle = 0;
    controls.minPolarAngle = 0;
    controls.enableRotate = false;

    orthoCamera.position.set(
      controls.target.x,
      100,
      controls.target.z
    );
    orthoCamera.lookAt(controls.target);

    controls.object = orthoCamera;
    controls.update();
    handleResize(container);
    return false; // is3DView
  }
}
