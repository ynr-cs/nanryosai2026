/**
 * 3D Map Editor V2 — editor.js
 * Nanryosai 2026 Project
 *
 * Three.js の初期セットアップとレンダリングループ
 * ES Modules で記述、Import Map 経由で Three.js をロード
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// グローバル変数
// ============================================
let scene, renderer;
let perspCamera, orthoCamera, activeCamera;
let controls;
let gridHelper, axesHelper;
let groundPlane;

// DOM要素
const container = document.getElementById('canvas-container');
const statusCursor = document.getElementById('status-cursor');
const statusTool = document.getElementById('status-tool');

// 状態管理
const state = {
  activeTool: 'select',
  is3DView: true,
  gridSize: 1,
  snapEnabled: true,
};

// マウス座標（NDC & ワールド）
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const groundPlaneForRaycast = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersectPoint = new THREE.Vector3();

// ============================================
// 初期化
// ============================================
function init() {
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

  // --- OrbitControls ---
  controls = new OrbitControls(activeCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // 地面の下に潜り込まない
  controls.minDistance = 2;
  controls.maxDistance = 500;
  controls.target.set(0, 0, 0);
  controls.update();

  // --- Lighting ---
  setupLighting();

  // --- Ground & Grid ---
  setupGround();

  // --- Axes Helper ---
  axesHelper = new THREE.AxesHelper(10);
  axesHelper.position.y = 0.01; // Z-Fighting 回避
  scene.add(axesHelper);

  // --- Event Listeners ---
  setupEventListeners();

  // --- ResizeObserver ---
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // --- アニメーション開始 ---
  animate();

  console.log('[Map Editor V2] 初期化完了 — Three.js r' + THREE.REVISION);
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
  gridHelper = new THREE.GridHelper(200, 200, 0x2a2a4a, 0x1e1e3a);
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
// イベントリスナー
// ============================================
function setupEventListeners() {
  // マウス移動 → ステータスバーの座標更新
  container.addEventListener('mousemove', onMouseMove);

  // ツールバーボタン
  document.querySelectorAll('#top-bar .tb-btn[id^="tool-"]').forEach(btn => {
    btn.addEventListener('click', () => onToolSelect(btn));
  });

  // カメラビュー切替
  document.getElementById('view-3d').addEventListener('click', () => switchCamera('3d'));
  document.getElementById('view-2d').addEventListener('click', () => switchCamera('2d'));
}

// ============================================
// マウスイベント
// ============================================
function onMouseMove(event) {
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Raycaster で地面平面との交点を計算
  raycaster.setFromCamera(mouse, activeCamera);
  if (raycaster.ray.intersectPlane(groundPlaneForRaycast, intersectPoint)) {
    // スナップ適用
    let x = intersectPoint.x;
    let y = intersectPoint.y;
    let z = intersectPoint.z;

    if (state.snapEnabled) {
      x = Math.round(x / state.gridSize) * state.gridSize;
      z = Math.round(z / state.gridSize) * state.gridSize;
    }

    statusCursor.textContent = `X: ${x.toFixed(2)}  Y: ${y.toFixed(2)}  Z: ${z.toFixed(2)}`;
  }
}

// ============================================
// ツール選択
// ============================================
function onToolSelect(btn) {
  // 全ツールボタンの active を解除
  document.querySelectorAll('#top-bar .tb-btn[id^="tool-"]').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  const toolId = btn.id.replace('tool-', '');
  state.activeTool = toolId;

  // ステータスバー更新
  const toolNames = {
    select: '選択',
    wall: '壁描画',
    opening: '開口部',
    zone: 'ゾーン',
    slope: '斜面',
  };
  statusTool.textContent = toolNames[toolId] || toolId;
}

// ============================================
// カメラ切替
// ============================================
function switchCamera(mode) {
  const btn3d = document.getElementById('view-3d');
  const btn2d = document.getElementById('view-2d');

  if (mode === '3d') {
    activeCamera = perspCamera;
    state.is3DView = true;
    btn3d.classList.add('active');
    btn2d.classList.remove('active');

    // OrbitControls を 3D モードに
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.enableRotate = true;
  } else {
    activeCamera = orthoCamera;
    state.is3DView = false;
    btn3d.classList.remove('active');
    btn2d.classList.add('active');

    // OrbitControls を 2D（トップダウン）モードに
    controls.maxPolarAngle = 0;
    controls.minPolarAngle = 0;
    controls.enableRotate = false;

    // カメラを真上から見下ろす位置にリセット
    orthoCamera.position.set(
      controls.target.x,
      100,
      controls.target.z
    );
    orthoCamera.lookAt(controls.target);
  }

  // OrbitControls のカメラオブジェクトを差し替え
  controls.object = activeCamera;
  controls.update();

  // リサイズ処理を即座に実行（アスペクト比の更新）
  onResize();
}

// ============================================
// リサイズ
// ============================================
function onResize() {
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

// ============================================
// アニメーションループ
// ============================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, activeCamera);
}

// ============================================
// 起動
// ============================================
init();
