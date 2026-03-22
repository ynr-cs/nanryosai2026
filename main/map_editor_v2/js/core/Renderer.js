/**
 * Renderer.js — Three.js レンダリングインフラ
 * 
 * Scene, Camera(Persp/Ortho), Renderer, Lighting, Ground/Grid の初期化を担当。
 */

import * as THREE from 'three';

// ============================================
// エクスポートされる Three.js オブジェクト
// ============================================
export let scene;
export let renderer;
export let perspCamera, orthoCamera;
export let activeCamera;
export let groundPlane;

/** activeCamera を外部から切り替えるためのセッター */
export function setActiveCamera(cam) {
  activeCamera = cam;
}

/** 現在の activeCamera を取得するゲッター（live binding が不安定な環境用） */
export function getActiveCamera() {
  return activeCamera;
}

// ============================================
// 初期化
// ============================================

/**
 * Three.js の Scene, Camera, Renderer, Lighting, Ground を初期化する。
 * @param {HTMLElement} container - キャンバスコンテナのDOM要素
 * @returns {{ scene, renderer, perspCamera, orthoCamera, activeCamera }}
 */
export function initRenderer(container) {
  // --- Scene ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.FogExp2(0x0d1117, 0.003);

  // --- Perspective Camera (デフォルト: 3Dビュー) ---
  const aspect = container.clientWidth / container.clientHeight;
  perspCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000);
  perspCamera.position.set(30, 40, 50);
  perspCamera.lookAt(0, 0, 0);

  // --- Orthographic Camera (2D俯瞰ビュー用) ---
  const frustumSize = 80;
  orthoCamera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    2000
  );
  orthoCamera.position.set(0, 100, 0);
  orthoCamera.lookAt(0, 0, 0);
  orthoCamera.up.set(0, 0, -1); // 北を上にする

  activeCamera = perspCamera;

  // --- Renderer ---
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // --- Lighting ---
  setupLighting();

  // --- Ground & Grid ---
  setupGround();

  // --- Axes Helper ---
  const axesHelper = new THREE.AxesHelper(10);
  axesHelper.position.y = 0.01; // Z-Fighting 回避
  scene.add(axesHelper);

  return { scene, renderer, perspCamera, orthoCamera, activeCamera };
}

// ============================================
// ライティング
// ============================================
function setupLighting() {
  // 環境光（全体を柔らかく照らす）
  const ambientLight = new THREE.AmbientLight(0xccccff, 0.6);
  scene.add(ambientLight);

  // メインの方向光源（太陽光シミュレーション）
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(50, 80, 30);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 300;
  dirLight.shadow.camera.left = -100;
  dirLight.shadow.camera.right = 100;
  dirLight.shadow.camera.top = 100;
  dirLight.shadow.camera.bottom = -100;
  scene.add(dirLight);

  // 半球光（空と地面の色差による自然な陰影）
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444422, 0.4);
  scene.add(hemiLight);
}

// ============================================
// 地面 & グリッド
// ============================================
function setupGround() {
  // 地面メッシュ（Raycasting 用 + 視覚的な参照用）
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1f2e,
    roughness: 0.95,
    metalness: 0.0,
  });
  groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2; // XZ平面に寝かせる
  groundPlane.receiveShadow = true;
  groundPlane.name = '__ground__';
  scene.add(groundPlane);

  // メイングリッド（100m四方、1m刻み）
  const gridHelper = new THREE.GridHelper(200, 200, 0x2a2a4a, 0x1e1e3a);
  gridHelper.position.y = 0.005; // 地面より僅かに上（Z-Fighting回避）
  scene.add(gridHelper);

  // サブグリッド（10m刻みの太線）
  const subGrid = new THREE.GridHelper(200, 20, 0x3a3a6a, 0x3a3a6a);
  subGrid.position.y = 0.006;
  subGrid.material.opacity = 0.5;
  subGrid.material.transparent = true;
  scene.add(subGrid);
}

// ============================================
// リサイズ
// ============================================

/**
 * コンテナサイズに合わせてカメラとレンダラーのアスペクト比を更新する。
 * @param {HTMLElement} container
 */
export function handleResize(container) {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (width === 0 || height === 0) return;

  const aspect = width / height;

  // PerspectiveCamera
  perspCamera.aspect = aspect;
  perspCamera.updateProjectionMatrix();

  // OrthographicCamera
  const frustumSize = 80;
  orthoCamera.left = -frustumSize * aspect / 2;
  orthoCamera.right = frustumSize * aspect / 2;
  orthoCamera.top = frustumSize / 2;
  orthoCamera.bottom = -frustumSize / 2;
  orthoCamera.updateProjectionMatrix();

  renderer.setSize(width, height);
}
