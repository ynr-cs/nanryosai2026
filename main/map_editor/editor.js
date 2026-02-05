/**
 * Nanryosai 2026
 * Version: 0.1.0
 * Last Modified: 2026-02-05
 * Author: Nanryosai 2026 Project Team
 *
 * 3Dマップエディタ - メインスクリプト（押し出し機能改良版）
 */

// ===================================
// グローバル変数
// ===================================
let scene, camera, renderer, controls;
let dragControls;
let raycaster, mouse;
let gridHelper, bgPlane;

// 建物データ
let buildings = [];
let buildingMeshes = [];

let selectedBuilding = null;
let selectedMesh = null;

// 道路データ
let roads = [];
let roadMeshes = [];
let selectedRoad = null;
let selectedRoadMesh = null;

// 頂点編集モード
let vertexEditMode = false;
let vertexHandles = [];
let selectedVertexHandle = null;
let dragStartVertexIndex = -1;

// 押し出しモード
let extrudeState = "idle"; // idle, firstPoint, secondPoint, preview
let extrudeEdgeIndex = -1;
let extrudePoint1 = null; // ローカル座標
let extrudePoint2 = null; // ローカル座標
let extrudePreviewMesh = null;
let extrudeMarkers = [];
let extrudeOutwardDir = null; // 押し出し方向（ローカル座標）

// 状態
let isDragging = false;
let snapEnabled = true;
let snapSize = 1;
let snap90Enabled = true;

// 背景画像データ
let currentBgData = null;

// 建物カラー
const BUILDING_COLORS = {
  student: 0x667eea,
  gym: 0x43a047,
  staff: 0xff9800,
  budo: 0x9c27b0,
  health: 0xe91e63,
  default: 0x78909c,
};

// デフォルトの建物データ
const DEFAULT_BUILDINGS = [
  {
    id: "student",
    name: "生徒棟",
    x: 0,
    z: 0,
    width: 80,
    depth: 20,
    floors: 5,
    rotation: 0,
    category: "student",
  },
  {
    id: "gym",
    name: "体育館",
    x: -15,
    z: -35,
    width: 30,
    depth: 25,
    floors: 1,
    rotation: 0,
    category: "gym",
  },
  {
    id: "staff",
    name: "職員室棟",
    x: 5,
    z: 35,
    width: 25,
    depth: 18,
    floors: 2,
    rotation: 0,
    category: "staff",
  },
  {
    id: "budo",
    name: "武道場",
    x: -30,
    z: 35,
    width: 20,
    depth: 18,
    floors: 1,
    rotation: 0,
    category: "budo",
  },
  {
    id: "health",
    name: "健康福祉棟",
    x: -35,
    z: 65,
    width: 18,
    depth: 15,
    floors: 1,
    rotation: -30,
    category: "health",
  },
];

// ===================================
// 初期化
// ===================================
function init() {
  loadFromLocalStorage();

  initThreeJS();
  initControls();
  initEventListeners();

  createEnvironment();
  createBuildings();
  updateBuildingPalette();

  animate();

  updateStatus("準備完了 - 建物をクリックして選択、ドラッグで移動");
}

function initThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const container = document.getElementById("canvas-container");
  const aspect = container.clientWidth / container.clientHeight;
  const d = 2000; // 200 -> 2000 に拡大
  camera = new THREE.OrthographicCamera(
    -d * aspect,
    d * aspect,
    d,
    -d,
    1,
    20000, // 2000 -> 20000 に拡大
  );
  camera.position.set(300, 300, 300);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(100, 200, 100);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 4096; // 2048 -> 4096 (範囲拡大に伴い解像度アップ)
  sun.shadow.mapSize.height = 4096;
  sun.shadow.camera.left = -5000; // 300 -> 5000
  sun.shadow.camera.right = 5000;
  sun.shadow.camera.top = 5000;
  sun.shadow.camera.bottom = -5000;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xe8f4fd, 0.3);
  fill.position.set(-80, 60, -80);
  scene.add(fill);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  initEdgeHighlights();
}

// ハイライト用のライン
let hoverEdgeMesh = null;
let selectionLineMesh = null;

function initEdgeHighlights() {
  // ホバー用（水色）
  const hoverMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    linewidth: 2,
    depthTest: false,
  });
  const hoverGeo = new THREE.BufferGeometry();
  hoverEdgeMesh = new THREE.Line(hoverGeo, hoverMat);
  hoverEdgeMesh.renderOrder = 999;
  scene.add(hoverEdgeMesh);

  // 選択範囲用（黄色/緑）
  const selMat = new THREE.LineBasicMaterial({
    color: 0xffeb3b,
    linewidth: 3,
    depthTest: false,
  });
  const selGeo = new THREE.BufferGeometry();
  selectionLineMesh = new THREE.Line(selGeo, selMat);
  selectionLineMesh.renderOrder = 1000;
  scene.add(selectionLineMesh);
}

function updateEdgeHighlight(event) {
  if (!vertexEditMode || (!selectedBuilding && !selectedRoad)) {
    if (hoverEdgeMesh) hoverEdgeMesh.visible = false;
    if (selectionLineMesh) selectionLineMesh.visible = false;
    return;
  }

  // 道路の場合はハイライト無し (v0.3.0)
  if (selectedRoad) {
    if (hoverEdgeMesh) hoverEdgeMesh.visible = false;
    return;
  }

  const b = selectedBuilding;
  const rot = ((b.rotation || 0) * Math.PI) / 180;

  // 状態に応じて表示更新
  // 1. 幅決定中 (1点目〜マウス)
  if (extrudeState === "firstPoint" && extrudePoint1) {
    const b = selectedBuilding;
    const rot = ((b.rotation || 0) * Math.PI) / 180;

    hoverEdgeMesh.visible = false;

    // 現在のマウス位置（スナップなし）
    const gw = getGroundIntersectionFromEvent(event, false);
    if (!gw) return;

    const localPt = worldToLocal(gw.x, gw.z, b.x, b.z, rot);
    const edgeStart = b.path[extrudeEdgeIndex];
    const edgeEnd = b.path[(extrudeEdgeIndex + 1) % b.path.length];
    const currentProj = projectPointOnEdge(localPt, edgeStart, edgeEnd);

    // ライン更新 (1点目 〜 現在の射影点)
    updateLineMesh(
      selectionLineMesh,
      extrudePoint1,
      currentProj,
      b.x,
      b.z,
      rot,
      0xffeb3b, // 黄色（選択中）
    );
    selectionLineMesh.visible = true;
    return;
  }

  // 【追加】準備モード中もハイライトを消さない
  // これによりユーザーは「この辺の上をクリックすればいいんだな」とわかる
  if (extrudeState === "ready") {
    selectionLineMesh.visible = false;
    // 以下の通常Highlight処理へ流す
  } else if (extrudeState !== "idle" && extrudeState !== "ready") {
    // firstPointなど上記で処理されなかったステート（previewなど）はここでreturn
    // ただしpreviewは別途処理されている
  }

  // 2. 奥行き決定中 (preview)

  // 2. 奥行き決定中 (1点目〜2点目 固定)
  if (extrudeState === "preview" && extrudePoint1 && extrudePoint2) {
    hoverEdgeMesh.visible = false;
    updateLineMesh(
      selectionLineMesh,
      extrudePoint1,
      extrudePoint2,
      b.x,
      b.z,
      rot,
      0x4caf50, // 緑色（確定済み）
    );
    selectionLineMesh.visible = true;
    return;
  }

  // 3. 通常時（ホバーした辺をハイライト）
  selectionLineMesh.visible = false;

  const gw = getGroundIntersectionFromEvent(event, false);
  if (!gw) {
    hoverEdgeMesh.visible = false;
    return;
  }

  const localPt = worldToLocal(gw.x, gw.z, b.x, b.z, rot);
  const picked = pickClosestEdgeIndex(localPt, b.path);
  const EDGE_PICK_THRESHOLD = Math.max(1.5, snapSize * 1.5);

  if (
    picked.index !== -1 &&
    picked.distSq <= EDGE_PICK_THRESHOLD * EDGE_PICK_THRESHOLD
  ) {
    const p1 = b.path[picked.index];
    const p2 = b.path[(picked.index + 1) % b.path.length];
    updateLineMesh(hoverEdgeMesh, p1, p2, b.x, b.z, rot, 0x00ffff);
    hoverEdgeMesh.visible = true;
  } else {
    hoverEdgeMesh.visible = false;
  }
}

function updateLineMesh(mesh, p1Local, p2Local, bx, bz, rot, colorHex) {
  const w1 = localToWorld(p1Local, bx, bz, rot);
  const w2 = localToWorld(p2Local, bx, bz, rot);
  const height = selectedBuilding.floors * 3 + 0.1; // 少し浮かせる

  const points = [
    new THREE.Vector3(w1.x, height, w1.z),
    new THREE.Vector3(w2.x, height, w2.z),
  ];
  mesh.geometry.setFromPoints(points);
  if (colorHex !== undefined) mesh.material.color.setHex(colorHex);
}

function initControls() {
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minZoom = 0.05; // 0.3 -> 0.05
  controls.maxZoom = 50; // 3 -> 50
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.target.set(0, 0, 0);

  dragControls = new THREE.DragControls([], camera, renderer.domElement);

  dragControls.addEventListener("dragstart", onDragStart);
  dragControls.addEventListener("drag", onDrag);
  dragControls.addEventListener("dragend", onDragEnd);
}

function initEventListeners() {
  window.addEventListener("resize", onWindowResize);

  const container = document.getElementById("canvas-container");
  container.addEventListener("click", onClick);

  document.getElementById("btn-zoom-in").addEventListener("click", () => {
    camera.zoom = Math.min(camera.zoom * 1.2, 50); // 3 -> 50
    camera.updateProjectionMatrix();
  });

  document.getElementById("btn-zoom-out").addEventListener("click", () => {
    camera.zoom = Math.max(camera.zoom / 1.2, 0.05); // 0.3 -> 0.05
    camera.updateProjectionMatrix();
  });

  document.getElementById("btn-reset-view").addEventListener("click", () => {
    camera.position.set(300, 300, 300);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
  });

  document.getElementById("btn-top-view").addEventListener("click", () => {
    camera.position.set(0, 400, 0.01);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
  });

  const propInputs = [
    "prop-name",
    "prop-x",
    "prop-z",
    "prop-width",
    "prop-depth",
    "prop-floors",
    "prop-rotation",
  ];
  propInputs.forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("change", onPropertyChange);
    input.addEventListener("input", onPropertyChange);
  });

  document
    .getElementById("btn-delete-building")
    .addEventListener("click", deleteSelectedBuilding);

  document
    .getElementById("btn-edit-vertex")
    .addEventListener("click", toggleVertexEditMode);

  document
    .getElementById("btn-edit-vertex")
    .addEventListener("click", toggleVertexEditMode);

  document
    .getElementById("btn-add-building")
    .addEventListener("click", showNewBuildingModal);
  document.getElementById("btn-add-road").addEventListener("click", addNewRoad);

  document
    .getElementById("modal-close")
    .addEventListener("click", hideNewBuildingModal);
  document
    .getElementById("modal-cancel")
    .addEventListener("click", hideNewBuildingModal);
  document
    .getElementById("modal-confirm")
    .addEventListener("click", addNewBuilding);

  document.getElementById("opt-grid").addEventListener("change", toggleGrid);
  document.getElementById("opt-snap").addEventListener("change", toggleSnap);
  document
    .getElementById("opt-snap-size")
    .addEventListener("change", onSnapSizeChange);
  document.getElementById("opt-snap-90").addEventListener("change", (e) => {
    snap90Enabled = e.target.checked;
  });
  document
    .getElementById("opt-bg-image")
    .addEventListener("change", toggleBackgroundImage);
  document
    .getElementById("opt-bg-url")
    .addEventListener("change", updateBackgroundImage);
  document
    .getElementById("opt-bg-opacity")
    .addEventListener("input", updateBackgroundOpacity);

  document
    .getElementById("btn-bg-file")
    .addEventListener("click", () =>
      document.getElementById("bg-file-input").click(),
    );
  document
    .getElementById("bg-file-input")
    .addEventListener("change", handleBgFileSelect);
  document
    .getElementById("btn-bg-paste")
    .addEventListener("click", handleBgPaste);
  document
    .getElementById("btn-calibrate")
    .addEventListener("click", startCalibration);

  document
    .getElementById("bg-metric-width")
    .addEventListener("change", updateBackgroundTransform);
  document
    .getElementById("bg-offset-x")
    .addEventListener("input", updateBackgroundTransform);
  document
    .getElementById("bg-offset-z")
    .addEventListener("input", updateBackgroundTransform);
  document
    .getElementById("bg-rotation")
    .addEventListener("input", updateBackgroundTransform);

  document.addEventListener("paste", handlePasteEvent);

  document.getElementById("btn-export").addEventListener("click", exportJSON);
  document.getElementById("btn-import").addEventListener("click", importJSON);
  document
    .getElementById("btn-save")
    .addEventListener("click", saveToLocalStorage);

  // ESCキーで押し出しモードをキャンセル
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && extrudeState !== "idle") {
      cancelExtrudeMode();
      updateStatus("押し出しをキャンセルしました");
    }
  });
}

// ===================================
// 環境作成
// ===================================
function createEnvironment() {
  const groundGeo = new THREE.PlaneGeometry(20000, 20000); // 300 -> 20000
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2a3f5f });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);

  // GridHelper(size, divisions): interavl = size / divisions
  // 10m間隔にしたい: 20000 / 2000 = 10
  gridHelper = new THREE.GridHelper(20000, 2000, 0x4a5568, 0x2d3748);
  gridHelper.position.y = 0.05;
  scene.add(gridHelper);

  const originGeo = new THREE.SphereGeometry(1, 16, 16);
  const originMat = new THREE.MeshBasicMaterial({ color: 0xe94560 });
  const origin = new THREE.Mesh(originGeo, originMat);
  origin.position.set(0, 0.5, 0);
  scene.add(origin);

  const axesHelper = new THREE.AxesHelper(20);
  axesHelper.position.y = 0.1;
  scene.add(axesHelper);

  createScaleLabels();
}

function createScaleLabels() {
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x666666 });
  // 広範囲にラベルを置くと重いので、間隔を広げるか、主要な箇所だけにする
  // ここでは範囲を広げつつ、間隔も調整 (50mおき)
  for (let i = -1000; i <= 1000; i += 50) {
    if (i === 0) continue;
    const markerGeoX = new THREE.BoxGeometry(0.5, 0.5, 0.5); // 少し大きく
    const markerX = new THREE.Mesh(markerGeoX, markerMat);
    markerX.position.set(i, 0.25, 0);
    scene.add(markerX);

    // Z軸用も同様
    const markerGeoZ = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const markerZ = new THREE.Mesh(markerGeoZ, markerMat);
    markerZ.position.set(0, 0.25, i);
    scene.add(markerZ);
  }
}

// ===================================
// 建物作成
// ===================================
function createBuildings() {
  buildingMeshes.forEach((mesh) => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  buildingMeshes = [];

  buildings.forEach((building) => {
    const mesh = createBuildingMesh(building);
    scene.add(mesh);
    buildingMeshes.push(mesh);
  });

  updateDragControls();
}

function createRoads() {
  roadMeshes.forEach((mesh) => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  roadMeshes = [];

  roads.forEach((road) => {
    const mesh = createRoadMesh(road);
    scene.add(mesh);
    roadMeshes.push(mesh);
  });
}

function createRoadMesh(road) {
  if (!road.path || road.path.length < 2) return null;

  const width = road.width || 4.0;
  const halfWidth = width / 2;
  const points = road.path;

  const vertices = [];
  const indices = [];

  // 単純なリボン生成 (マイター結合などの高度な処理は省略し、セグメントごとに生成)
  // より綺麗にするなら曲線補間や結合処理が必要だが、まずは直線の連結で実装
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) continue;

    // 法線ベクトル
    const nx = -dz / len;
    const nz = dx / len;

    // 4頂点 (Y=0.02 で地面より少し上)
    const y = 0.02;

    // p1 left, p1 right, p2 left, p2 right
    // 頂点バッファに追加 (重複頂点は許容)
    // 0: p1-L
    vertices.push(p1.x + nx * halfWidth, y, p1.z + nz * halfWidth);
    // 1: p1-R
    vertices.push(p1.x - nx * halfWidth, y, p1.z - nz * halfWidth);
    // 2: p2-L
    vertices.push(p2.x + nx * halfWidth, y, p2.z + nz * halfWidth);
    // 3: p2-R
    vertices.push(p2.x - nx * halfWidth, y, p2.z - nz * halfWidth);

    const baseIndex = i * 4;
    // face 1 (0, 2, 1)
    indices.push(baseIndex + 0, baseIndex + 2, baseIndex + 1);
    // face 2 (1, 2, 3)
    indices.push(baseIndex + 1, baseIndex + 2, baseIndex + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color: road.color || 0x555555,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { roadId: road.id, type: "road" };

  return mesh;
}

function createBuildingMesh(building) {
  const FLOOR_HEIGHT = 3;
  const height = building.floors * FLOOR_HEIGHT;
  const color = BUILDING_COLORS[building.category] || BUILDING_COLORS.default;

  if (!building.path) {
    const w = (building.width || 20) / 2;
    const d = (building.depth || 20) / 2;
    building.path = [
      { x: -w, z: -d },
      { x: w, z: -d },
      { x: w, z: d },
      { x: -w, z: d },
    ];
  }

  const path = building.path;

  const shape = new THREE.Shape();
  shape.moveTo(path[0].x, -path[0].z);
  for (let i = 1; i < path.length; i++) {
    shape.lineTo(path[i].x, -path[i].z);
  }
  shape.closePath();

  const extrudeSettings = {
    depth: height,
    bevelEnabled: false,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshLambertMaterial({
    color: color,
    transparent: true,
    opacity: 0.9,
  });

  const mesh = new THREE.Mesh(geometry, material);

  const rot = ((building.rotation || 0) * Math.PI) / 180;
  mesh.position.set(building.x, 0, building.z);
  mesh.rotation.y = rot;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { buildingId: building.id, floorHeight: FLOOR_HEIGHT };

  const edges = new THREE.EdgesGeometry(geometry);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 1,
  });
  const line = new THREE.LineSegments(edges, lineMat);
  mesh.add(line);

  return mesh;
}

function updateDragControls() {
  if (dragControls) {
    dragControls.dispose();
  }
  dragControls = new THREE.DragControls(
    buildingMeshes,
    camera,
    renderer.domElement,
  );

  dragControls.enabled = !vertexEditMode;

  dragControls.addEventListener("dragstart", onDragStart);
  dragControls.addEventListener("drag", onDrag);
  dragControls.addEventListener("dragend", onDragEnd);
}

// ===================================
// 建物選択
// ===================================
function selectBuilding(building, mesh) {
  if (selectedMesh && selectedMesh !== mesh) {
    // 古い選択解除（道路の場合もあるので色戻しは厳密にやるべきだが一旦黒emissive）
    if (selectedMesh.userData.type === "road") {
      selectedMesh.material.color.setHex(
        (selectedRoad && selectedRoad.color) || 0x555555,
      );
    } else {
      selectedMesh.material.emissive = new THREE.Color(0x000000);
    }
  }

  // 道路選択の解除
  selectedRoad = null;

  selectedBuilding = building;
  selectedMesh = mesh;

  if (mesh) {
    mesh.material.emissive = new THREE.Color(0x333333);
  }

  if (vertexEditMode && selectedBuilding) {
    createVertexHandles();
  } else if (!selectedBuilding) {
    removeVertexHandles();
    cancelExtrudeMode();
    vertexEditMode = false;
    document.getElementById("btn-edit-vertex").classList.remove("active");
    document.getElementById("btn-edit-vertex").innerHTML =
      '<span class="material-icons">edit</span>頂点編集モード';
    document.getElementById("vertex-info").classList.remove("show");
  }

  updatePropertyPanel();
  updateBuildingPalette();
}

function selectRoad(road, mesh) {
  if (selectedMesh && selectedMesh !== mesh) {
    selectedMesh.material.emissive = new THREE.Color(0x000000);
  }

  // 建物の選択解除
  if (selectedBuilding) {
    const bMesh = buildingMeshes.find(
      (m) => m.userData.buildingId === selectedBuilding.id,
    );
    if (bMesh) bMesh.material.emissive = new THREE.Color(0x000000);
    selectedBuilding = null;
  }

  selectedRoad = road;
  selectedMesh = mesh;

  if (mesh) {
    mesh.material.color.setHex(0xffaa00); // 選択時は一時的に色変更（emissiveが効かないMaterialの場合あるので）
    // BasicMaterialにはemissiveがないが、roadはBasicMaterial
    mesh.material.color.setHex(0xaaaaaa); // 少し明るく
  }

  if (vertexEditMode && selectedRoad) {
    createVertexHandles();
  } else if (!selectedRoad) {
    removeVertexHandles();
    vertexEditMode = false;
    document.getElementById("btn-edit-vertex").classList.remove("active");
    document.getElementById("btn-edit-vertex").innerHTML =
      '<span class="material-icons">edit</span>頂点編集モード';
  }

  updatePropertyPanel();
}

function updatePropertyPanel() {
  const form = document.getElementById("property-form");
  const noSelection = document.getElementById("no-selection-msg");

  if (!selectedBuilding && !selectedRoad) {
    form.style.display = "none";
    noSelection.style.display = "block";
    return;
  }

  form.style.display = "flex";
  noSelection.style.display = "none";

  if (selectedBuilding) {
    // 既存の建物プロパティ表示
    document.getElementById("prop-id").value = selectedBuilding.id;
    document.getElementById("prop-name").value = selectedBuilding.name;
    document.getElementById("prop-x").value = Math.round(selectedBuilding.x);
    document.getElementById("prop-z").value = Math.round(selectedBuilding.z);
    document.getElementById("prop-width").value = Math.round(
      selectedBuilding.width,
    );
    document.getElementById("prop-depth").value = Math.round(
      selectedBuilding.depth,
    );
    document.getElementById("prop-floors").parentElement.style.display = "flex";
    document.getElementById("prop-floors").value = selectedBuilding.floors;
    document.getElementById("prop-rotation").parentElement.style.display =
      "flex";
    document.getElementById("prop-rotation").value =
      selectedBuilding.rotation || 0;

    // 入力不可にしておく（道路用と共有のため）
    document.getElementById("prop-x").disabled = false;
    document.getElementById("prop-z").disabled = false;
    document.getElementById("prop-depth").disabled = false;
  } else if (selectedRoad) {
    // 道路プロパティ表示
    document.getElementById("prop-id").value = selectedRoad.id;
    document.getElementById("prop-name").value = "道路"; // 名前フィールドがないので固定

    // 道路にX/Z/Depth/Rotation/Floorsはない
    document.getElementById("prop-x").value = "-";
    document.getElementById("prop-x").disabled = true;
    document.getElementById("prop-z").value = "-";
    document.getElementById("prop-z").disabled = true;

    document.getElementById("prop-width").value = selectedRoad.width;

    document.getElementById("prop-depth").value = "-";
    document.getElementById("prop-depth").disabled = true;

    document.getElementById("prop-floors").parentElement.style.display = "none";
    document.getElementById("prop-rotation").parentElement.style.display =
      "none";
  }
}

// ===================================
// 建物パレット
// ===================================
function updateBuildingPalette() {
  const palette = document.getElementById("building-palette");
  palette.innerHTML = "";

  buildings.forEach((building) => {
    const color = BUILDING_COLORS[building.category] || BUILDING_COLORS.default;
    const isSelected = selectedBuilding && selectedBuilding.id === building.id;

    const item = document.createElement("div");
    item.className = `building-item ${isSelected ? "selected" : ""}`;
    item.innerHTML = `
      <div class="building-color" style="background: #${color.toString(16).padStart(6, "0")}"></div>
      <div>
        <div class="building-name">${building.name}</div>
        <div class="building-info">${building.floors}F | ${Math.round(building.width)}×${Math.round(building.depth)}</div>
      </div>
    `;
    item.addEventListener("click", () => {
      const mesh = buildingMeshes.find(
        (m) => m.userData.buildingId === building.id,
      );
      selectBuilding(building, mesh);
    });
    palette.appendChild(item);
  });
}

// ===================================
// イベントハンドラー
// ===================================
function onClick(event) {
  if (isDragging || vertexEditMode) return;

  const container = document.getElementById("canvas-container");
  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // 1. 道路の判定
  const roadIntersects = raycaster.intersectObjects(roadMeshes);
  if (roadIntersects.length > 0) {
    const mesh = roadIntersects[0].object;
    const road = roads.find((r) => r.id === mesh.userData.roadId);
    selectRoad(road, mesh);
    return;
  }

  // 2. 建物の判定
  const intersects = raycaster.intersectObjects(buildingMeshes);
  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    const building = buildings.find((b) => b.id === mesh.userData.buildingId);
    selectBuilding(building, mesh);
  } else {
    // どちらも選択解除
    selectBuilding(null, null);
    selectRoad(null, null);
  }
}

function onDragStart(event) {
  const mesh = event.object;
  const building = buildings.find((b) => b.id === mesh.userData.buildingId);

  if (!building) {
    isDragging = false;
    return;
  }

  isDragging = true;
  controls.enabled = false;
  selectBuilding(building, mesh);

  updateStatus(`「${building.name}」をドラッグ中...`);
}

function onDrag(event) {
  const mesh = event.object;
  const building = buildings.find((b) => b.id === mesh.userData.buildingId);

  if (!building) return;

  mesh.position.y = 0;

  if (snapEnabled) {
    mesh.position.x = Math.round(mesh.position.x / snapSize) * snapSize;
    mesh.position.z = Math.round(mesh.position.z / snapSize) * snapSize;
  }

  building.x = mesh.position.x;
  building.z = mesh.position.z;

  updatePropertyPanel();
}

function onDragEnd(event) {
  isDragging = false;
  controls.enabled = true;

  const mesh = event.object;
  const building = buildings.find((b) => b.id === mesh.userData.buildingId);

  if (building) {
    updateStatus(
      `「${building.name}」を移動: X=${Math.round(building.x)}, Z=${Math.round(building.z)}`,
    );
    autoSave();
  }
}

function onPropertyChange(event) {
  if (!selectedBuilding || !selectedMesh) return;

  const id = event.target.id;
  const value = event.target.value;

  switch (id) {
    case "prop-name":
      selectedBuilding.name = value;
      break;
    case "prop-x":
      selectedBuilding.x = parseFloat(value) || 0;
      break;
    case "prop-z":
      selectedBuilding.z = parseFloat(value) || 0;
      break;
    case "prop-width":
      selectedBuilding.width = Math.max(1, parseFloat(value) || 10);
      const w = selectedBuilding.width / 2;
      const d = selectedBuilding.depth / 2;
      selectedBuilding.path = [
        { x: -w, z: -d },
        { x: w, z: -d },
        { x: w, z: d },
        { x: -w, z: d },
      ];
      break;
    case "prop-depth":
      selectedBuilding.depth = Math.max(1, parseFloat(value) || 10);
      const w2 = selectedBuilding.width / 2;
      const d2 = selectedBuilding.depth / 2;
      selectedBuilding.path = [
        { x: -w2, z: -d2 },
        { x: w2, z: -d2 },
        { x: w2, z: d2 },
        { x: -w2, z: d2 },
      ];
      break;
    case "prop-floors":
      selectedBuilding.floors = Math.max(1, Math.min(10, parseInt(value) || 1));
      break;
    case "prop-rotation":
      selectedBuilding.rotation = parseFloat(value) || 0;
      break;
  }

  rebuildSelectedBuilding();
  updateBuildingPalette();
  autoSave();

  if (vertexEditMode && selectedBuilding) {
    createVertexHandles();
  }
}

function onWindowResize() {
  const container = document.getElementById("canvas-container");
  const aspect = container.clientWidth / container.clientHeight;
  const d = 200;

  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();

  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ===================================
// 建物追加/削除
// ===================================
function showNewBuildingModal() {
  document.getElementById("modal-new-building").style.display = "flex";
  document.getElementById("new-id").value = `building${buildings.length + 1}`;
  document.getElementById("new-name").value = "";
  document.getElementById("new-id").focus();
}

function hideNewBuildingModal() {
  document.getElementById("modal-new-building").style.display = "none";
}

function addNewBuilding() {
  const id = document.getElementById("new-id").value.trim();
  const name = document.getElementById("new-name").value.trim() || "新規建物";

  if (!id) {
    alert("IDを入力してください");
    return;
  }

  if (buildings.some((b) => b.id === id)) {
    alert("このIDは既に使用されています");
    return;
  }

  const newBuilding = {
    id: id,
    name: name,
    x: 0,
    z: 0,
    width: 40,
    depth: 30,
    floors: 1,
    rotation: 0,
    category: "default",
  };

  buildings.push(newBuilding);

  const mesh = createBuildingMesh(newBuilding);
  scene.add(mesh);
  buildingMeshes.push(mesh);
  updateDragControls();

  selectBuilding(newBuilding, mesh);
  updateBuildingPalette();
  hideNewBuildingModal();
  autoSave();

  updateStatus(`「${name}」を追加しました`);
}

function addNewRoad() {
  const id = "road_" + Date.now();
  // 画面中央付近にデフォルトパスを作成
  const newRoad = {
    id: id,
    width: 4.0,
    path: [
      { x: -10, z: 0 },
      { x: 10, z: 0 },
    ],
    color: 0x555555,
  };

  roads.push(newRoad);
  const mesh = createRoadMesh(newRoad);
  scene.add(mesh);
  roadMeshes.push(mesh);

  // 選択状態にする (まだ実装してないのでログだけ)
  console.log("New road created:", newRoad);
  updateStatus("新しい道路を追加しました");
  autoSave();
}

function deleteSelectedBuilding() {
  if (!selectedBuilding || !selectedMesh) return;

  if (!confirm(`「${selectedBuilding.name}」を削除しますか？`)) return;

  const bIndex = buildings.indexOf(selectedBuilding);
  if (bIndex !== -1) buildings.splice(bIndex, 1);

  const mIndex = buildingMeshes.indexOf(selectedMesh);
  if (mIndex !== -1) buildingMeshes.splice(mIndex, 1);

  scene.remove(selectedMesh);
  selectedMesh.geometry.dispose();
  selectedMesh.material.dispose();

  updateDragControls();
  selectBuilding(null, null);
  updateBuildingPalette();
  autoSave();

  updateStatus("建物を削除しました");
}

// ===================================
// オプション
// ===================================
function toggleGrid(event) {
  gridHelper.visible = event.target.checked;
}

function toggleSnap(event) {
  snapEnabled = event.target.checked;
}

function onSnapSizeChange(event) {
  snapSize = parseFloat(event.target.value) || 1;
}

// ===================================
// 背景画像制御
// ===================================
let bgTexture = null;
let bgOriginalAspect = 1;
let calibrationMode = false;
let calibrationPoints = [];

function toggleBackgroundImage(event) {
  const controls = document.getElementById("bg-image-controls");
  controls.style.display = event.target.checked ? "block" : "none";

  if (!event.target.checked && bgPlane) {
    bgPlane.visible = false;
  } else if (bgPlane) {
    bgPlane.visible = true;
  } else if (
    event.target.checked &&
    document.getElementById("opt-bg-url").value
  ) {
    updateBackgroundImage();
  }
}

function handleBgFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => loadBgImage(e.target.result);
    reader.readAsDataURL(file);
  }
}

function handleBgPaste() {
  updateStatus("貼り付け待機中: Ctrl+V または Command+V を押してください");
}

function handlePasteEvent(event) {
  const items = event.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const blob = items[i].getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => {
        loadBgImage(e.target.result);
        document.getElementById("opt-bg-image").checked = true;
        document.getElementById("bg-image-controls").style.display = "block";
      };
      reader.readAsDataURL(blob);
      updateStatus("画像を貼り付けました");
      return;
    }
  }
}

function updateBackgroundImage() {
  const input = document.getElementById("opt-bg-url").value.trim();
  if (!input) return;

  const mapsRegex = /@([-0-9.]+),([-0-9.]+),([0-9.]+)([zm])/;
  const match = input.match(mapsRegex);

  if (match) {
    const lat = parseFloat(match[1]);
    const val = parseFloat(match[3]);
    const unit = match[4];
    let estimatedWidth = 100;

    if (unit === "z") {
      const zoom = val;
      const metersPerPixel =
        (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
      estimatedWidth = 1920 * metersPerPixel;
      updateStatus(
        `マップURL解析(z): ズーム${zoom} -> 幅約${Math.round(estimatedWidth)}m`,
      );
    } else if (unit === "m") {
      estimatedWidth = val * 1.5;
      updateStatus(
        `マップURL解析(m): 高度${val}m -> 幅約${Math.round(estimatedWidth)}m (推定)`,
      );
    }

    document.getElementById("bg-metric-width").value =
      Math.round(estimatedWidth);
    if (bgPlane) updateBackgroundTransform();

    if (input.includes("google") && input.includes("maps")) {
      createPlaceholderTexture("ここにスクリーンショットをペースト (Ctrl+V)");
      updateStatus(
        "URL解析完了。次に Google Maps の画面をスクショして貼り付けてください。",
      );
      return;
    }
  } else if (input.includes("earth.google.com")) {
    const earthRegex = /([0-9.]+)d/;
    const dMatch = input.match(earthRegex);

    if (dMatch) {
      const distance = parseFloat(dMatch[1]);
      const estimatedWidth = distance * 1.0;

      document.getElementById("bg-metric-width").value =
        Math.round(estimatedWidth);
      if (bgPlane) updateBackgroundTransform();

      createPlaceholderTexture("ここにGoogle Earthのスクショをペースト");
      updateStatus(
        `Earth URL解析: 距離${Math.round(distance)}m -> 幅約${Math.round(estimatedWidth)}m (推定)`,
      );
      return;
    }
  }

  loadBgImage(input);
}

function createPlaceholderTexture(message) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#333333";
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = "#FFFF00";
  ctx.lineWidth = 20;
  ctx.strokeRect(10, 10, 1004, 1004);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 60px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  bgTexture = texture;
  bgOriginalAspect = 1;

  if (bgPlane) {
    scene.remove(bgPlane);
    bgPlane.geometry.dispose();
  }

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });

  bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  bgPlane.rotation.x = -Math.PI / 2;
  bgPlane.position.y = 0.05;
  bgPlane.visible = document.getElementById("opt-bg-image").checked;
  scene.add(bgPlane);

  updateBackgroundTransform();
}

function loadBgImage(url) {
  const loader = new THREE.TextureLoader();
  loader.load(
    url,
    (texture) => {
      bgTexture = texture;
      bgOriginalAspect = texture.image.width / texture.image.height;
      if (
        url.startsWith("data:") ||
        url.startsWith("http") ||
        url.startsWith("https")
      ) {
        currentBgData = url;
      }

      if (bgPlane) {
        scene.remove(bgPlane);
        bgPlane.geometry.dispose();
      }

      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: parseFloat(document.getElementById("opt-bg-opacity").value),
        side: THREE.DoubleSide,
      });

      bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      bgPlane.rotation.x = -Math.PI / 2;
      bgPlane.position.y = 0.05;
      bgPlane.visible = document.getElementById("opt-bg-image").checked;
      scene.add(bgPlane);

      updateBackgroundTransform();
      updateStatus("背景画像を読み込みました");
    },
    undefined,
    (err) => {
      console.error("背景画像の読み込み失敗:", err);
      updateStatus("背景画像の読み込みに失敗しました");
    },
  );
}

function updateBackgroundTransform() {
  if (!bgPlane || !bgTexture) return;

  const width =
    parseFloat(document.getElementById("bg-metric-width").value) || 100;
  const height = width / bgOriginalAspect;

  bgPlane.scale.set(width, height, 1);

  const x = parseFloat(document.getElementById("bg-offset-x").value) || 0;
  const z = parseFloat(document.getElementById("bg-offset-z").value) || 0;
  bgPlane.position.x = x;
  bgPlane.position.z = z;

  const rot = parseFloat(document.getElementById("bg-rotation").value) || 0;
  bgPlane.rotation.z = (rot * Math.PI) / 180;
}

function updateBackgroundOpacity() {
  if (bgPlane) {
    bgPlane.material.opacity = parseFloat(
      document.getElementById("opt-bg-opacity").value,
    );
  }
}

function startCalibration() {
  if (!bgPlane) {
    updateStatus("まず背景画像を読み込んでください");
    return;
  }

  calibrationMode = true;
  calibrationPoints = [];
  updateStatus("キャリブレーション: 画像上の始点をクリックしてください");
}

document
  .getElementById("canvas-container")
  .addEventListener("click", (event) => {
    if (!calibrationMode) return;

    const container = document.getElementById("canvas-container");
    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();

    if (raycaster.ray.intersectPlane(plane, intersection)) {
      calibrationPoints.push(intersection.clone());

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff00ff }),
      );
      marker.position.copy(intersection);
      scene.add(marker);

      if (calibrationPoints.length === 1) {
        updateStatus("キャリブレーション: 終点をクリックしてください");
      } else if (calibrationPoints.length === 2) {
        const distance = calibrationPoints[0].distanceTo(calibrationPoints[1]);
        const userDist = prompt(
          `2点間の現在の距離: ${distance.toFixed(2)}m\n実際の距離(m)を入力してください:`,
          distance.toFixed(2),
        );

        if (userDist) {
          const trueDist = parseFloat(userDist);
          if (!isNaN(trueDist) && trueDist > 0) {
            const ratio = trueDist / distance;
            const currentWidth = parseFloat(
              document.getElementById("bg-metric-width").value,
            );
            const newWidth = currentWidth * ratio;

            document.getElementById("bg-metric-width").value =
              Math.round(newWidth);
            updateBackgroundTransform();
            updateStatus(
              `調整完了: 幅を ${Math.round(newWidth)}m に更新しました`,
            );
          }
        }

        calibrationMode = false;
        calibrationPoints = [];
        scene.children = scene.children.filter(
          (obj) =>
            !(
              obj.geometry instanceof THREE.SphereGeometry &&
              obj.material.color.getHex() === 0xff00ff
            ),
        );
      }
    }
  });

// ===================================
// JSON エクスポート/インポート
// ===================================
function exportJSON() {
  const data = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    buildings: buildings.map((b) => ({
      id: b.id,
      name: b.name,
      x: Math.round(b.x),
      z: Math.round(b.z),
      width: Math.round(b.width),
      depth: Math.round(b.depth),
      floors: b.floors,
      rotation: b.rotation || 0,
      category: b.category,
      path: b.path,
    })),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `map-buildings-${new Date().toISOString().split("T")[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  updateStatus("JSONをエクスポートしました");
}

function importJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.buildings && Array.isArray(data.buildings)) {
          buildings = data.buildings;
          createBuildings();
          updateBuildingPalette();
          selectBuilding(null, null);
          saveToLocalStorage();
          updateStatus(`${buildings.length}件の建物をインポートしました`);
        } else {
          throw new Error("Invalid format");
        }
      } catch (err) {
        console.error("インポートエラー:", err);
        alert("JSONのインポートに失敗しました。形式を確認してください。");
      }
    };
    reader.readAsText(file);
  };

  input.click();
}

// ===================================
// LocalStorage
// ===================================
function saveToLocalStorage() {
  const data = {
    buildings: buildings,
    roads: roads,
    savedAt: new Date().toISOString(),
    background: null,
  };

  // 背景データの保存
  if (bgPlane && bgPlane.visible && currentBgData) {
    data.background = {
      active: document.getElementById("opt-bg-image").checked,
      source: currentBgData,
      width:
        parseFloat(document.getElementById("bg-metric-width").value) || 100,
      offsetX: parseFloat(document.getElementById("bg-offset-x").value) || 0,
      offsetZ: parseFloat(document.getElementById("bg-offset-z").value) || 0,
      rotation: parseFloat(document.getElementById("bg-rotation").value) || 0,
      opacity:
        parseFloat(document.getElementById("opt-bg-opacity").value) || 0.5,
    };
  }

  try {
    localStorage.setItem("mapEditorData", JSON.stringify(data));
    const time = new Date().toLocaleTimeString("ja-JP");
    document.getElementById("status-save").textContent = `自動保存: ${time}`;
  } catch (e) {
    console.error("保存に失敗しました (容量オーバーの可能性があります):", e);
    document.getElementById("status-save").textContent =
      `保存失敗: 容量オーバー`;
  }
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem("mapEditorData");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.buildings && Array.isArray(data.buildings)) {
        buildings = data.buildings;

        // 背景データの復元
        if (data.background) {
          restoreBackgroundSettings(data.background);
        }

        console.log("LocalStorageから読み込み:", buildings.length, "件");

        if (data.roads && Array.isArray(data.roads)) {
          roads = data.roads;
          createRoads();
        }

        if (data.roads && Array.isArray(data.roads)) {
          roads = data.roads;
          createRoads();
        }

        // 背景画像の復元 (あれば)
        if (data.background) {
          restoreBackgroundSettings(data.background);
        }

        return;
      }
    } catch (err) {
      console.error("LocalStorageの読み込みエラー:", err);
    }
  }

  buildings = JSON.parse(JSON.stringify(DEFAULT_BUILDINGS));
}

function restoreBackgroundSettings(bgData) {
  if (!bgData || !bgData.source) return;

  // UI値の復元
  document.getElementById("opt-bg-image").checked = bgData.active !== false;

  if (bgData.width)
    document.getElementById("bg-metric-width").value = bgData.width;
  if (bgData.offsetX)
    document.getElementById("bg-offset-x").value = bgData.offsetX;
  if (bgData.offsetZ)
    document.getElementById("bg-offset-z").value = bgData.offsetZ;
  if (bgData.rotation)
    document.getElementById("bg-rotation").value = bgData.rotation;
  if (bgData.opacity) {
    document.getElementById("opt-bg-opacity").value = bgData.opacity;
  }

  // 初期表示切り替え
  toggleBackgroundImage({ target: { checked: bgData.active !== false } });

  // 画像ロード
  // loadBgImageは非同期だが、ロード完了後に updateBackgroundTransform が呼ばれるため
  // 正しい位置・サイズが適用されるはず
  loadBgImage(bgData.source);

  // 明示的に値をセットしているので、ロード完了を待たずにTransform更新関数内で
  // 以前の値が上書きされないように注意が必要だが、
  // updateBackgroundTransformはDOMの値を読むので、先にDOMをセットしておけばOK
}

function autoSave() {
  clearTimeout(window.autoSaveTimer);
  window.autoSaveTimer = setTimeout(saveToLocalStorage, 1000);
}

// ===================================
// ステータス更新
// ===================================
function updateStatus(text) {
  document.getElementById("status-text").textContent = text;
}

// ===================================
// 座標変換ユーティリティ
// ===================================
function localToWorld(pt, bx, bz, rot) {
  return {
    x: bx + pt.x * Math.cos(rot) + pt.z * Math.sin(rot),
    z: bz - pt.x * Math.sin(rot) + pt.z * Math.cos(rot),
  };
}

function worldToLocal(wx, wz, bx, bz, rot) {
  const dx = wx - bx;
  const dz = wz - bz;
  return {
    x: dx * Math.cos(rot) - dz * Math.sin(rot),
    z: dx * Math.sin(rot) + dz * Math.cos(rot),
  };
}

// 共通：地面(Y=0)への交点取得
function getGroundIntersectionFromEvent(event, applySnap = false) {
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, p)) return null;

  let x = p.x,
    z = p.z;

  // applySnapがtrueの場合のみスナップする
  if (applySnap && snapEnabled) {
    x = Math.round(x / snapSize) * snapSize;
    z = Math.round(z / snapSize) * snapSize;
  }
  return { x, z };
}

// 共通：クリック地点に一番近い “辺” を選ぶ
function pickClosestEdgeIndex(localPt, path) {
  let best = { index: -1, distSq: Infinity, projected: null };

  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const q = projectPointOnEdge(localPt, a, b);

    const dx = localPt.x - q.x;
    const dz = localPt.z - q.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < best.distSq) best = { index: i, distSq, projected: q };
  }

  return best;
}

// ===================================
// 頂点編集モード
// ===================================
let vertexListenersInitialized = false;

function toggleVertexEditMode() {
  if ((!selectedBuilding && !selectedRoad) || !selectedMesh) {
    updateStatus("頂点編集: まず建物または道路を選択してください");
    return;
  }

  vertexEditMode = !vertexEditMode;
  const btn = document.getElementById("btn-edit-vertex");

  if (vertexEditMode) {
    btn.classList.add("active");
    btn.innerHTML = '<span class="material-icons">check</span>頂点編集を終了';

    // controls.enabled = false; // 編集モード中でも視点移動可能にする
    dragControls.enabled = false;

    if (!vertexListenersInitialized) {
      initVertexDragListeners();
      vertexListenersInitialized = true;
    }

    createVertexHandles();
    updateStatus(
      "頂点編集: 🟡ドラッグで移動 | 🔵辺クリックで押し出し | ESCでキャンセル",
    );
    document.getElementById("vertex-info").classList.add("show");
  } else {
    btn.classList.remove("active");
    btn.innerHTML = '<span class="material-icons">edit</span>頂点編集モード';
    removeVertexHandles();
    cancelExtrudeMode();
    updateStatus("頂点編集を終了しました");

    controls.enabled = true;
    updateDragControls();

    document.getElementById("vertex-info").classList.remove("show");
  }
}

function createVertexHandles() {
  if ((!selectedBuilding && !selectedRoad) || !selectedMesh) return;

  removeVertexHandles();

  const handleGeo = new THREE.SphereGeometry(1.5, 16, 16);
  const handleMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  if (selectedRoad) {
    const r = selectedRoad;
    r.path.forEach((pt, index) => {
      const handle = new THREE.Mesh(handleGeo.clone(), handleMat.clone());
      handle.position.set(pt.x, 0.5, pt.z); // 地面より少し上
      handle.userData = {
        type: "vertex",
        index: index,
        roadId: r.id,
      };
      scene.add(handle);
      vertexHandles.push(handle);
    });
    return;
  }

  const b = selectedBuilding;
  const FLOOR_HEIGHT = 3;
  const height = b.floors * FLOOR_HEIGHT;
  const rot = ((b.rotation || 0) * Math.PI) / 180;

  if (!b.path) {
    const w = (b.width || 20) / 2;
    const d = (b.depth || 20) / 2;
    b.path = [
      { x: -w, z: -d },
      { x: w, z: -d },
      { x: w, z: d },
      { x: -w, z: d },
    ];
  }

  // 辺ハンドル用
  const edgeHandleGeo = new THREE.CylinderGeometry(0.8, 0.8, 2, 8);
  const edgeHandleMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });

  // 各頂点のハンドル
  b.path.forEach((pt, index) => {
    const world = localToWorld(pt, b.x, b.z, rot);

    const handle = new THREE.Mesh(handleGeo.clone(), handleMat.clone());
    handle.position.set(world.x, height + 2, world.z);
    handle.userData = {
      type: "vertex",
      index: index,
      buildingId: b.id,
    };
    scene.add(handle);
    vertexHandles.push(handle);
  });

  // 辺の中央に押し出しハンドル
  for (let i = 0; i < b.path.length; i++) {
    const p1 = b.path[i];
    const p2 = b.path[(i + 1) % b.path.length];

    const midLocal = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
    const world = localToWorld(midLocal, b.x, b.z, rot);

    const handle = new THREE.Mesh(edgeHandleGeo.clone(), edgeHandleMat.clone());
    handle.position.set(world.x, height + 2, world.z);
    handle.userData = {
      type: "edge",
      index: i,
      buildingId: b.id,
    };
    scene.add(handle);
    vertexHandles.push(handle);
  }
}

function removeVertexHandles() {
  vertexHandles.forEach((handle) => {
    scene.remove(handle);
    if (handle.geometry) handle.geometry.dispose();
    if (handle.material) handle.material.dispose();
  });
  vertexHandles = [];
  selectedVertexHandle = null;
}

function initVertexDragListeners() {
  const canvas = renderer.domElement;

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (!vertexEditMode || (!selectedBuilding && !selectedRoad)) return;

      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // 押し出しプレビュー中のクリック → 確定
      if (extrudeState === "preview") {
        event.stopImmediatePropagation();
        event.preventDefault();
        finalizeExtrude();
        return;
      }

      const intersects = raycaster.intersectObjects(vertexHandles);

      if (intersects.length > 0) {
        event.stopImmediatePropagation();
        event.preventDefault();
        controls.enabled = false; // 操作中は視点移動無効化

        const handle = intersects[0].object;

        if (handle.userData.type === "edge") {
          // 辺ハンドルクリック
          const b = selectedBuilding;
          const rot = ((b.rotation || 0) * Math.PI) / 180;
          const gw = getGroundIntersectionFromEvent(event, true); // ハンドルクリックはスナップ有効でOKだが
          if (gw) {
            const localPt = worldToLocal(gw.x, gw.z, b.x, b.z, rot);

            // 重要：ここで投影点(Projected)を計算し、handleEdgeClickByIndexに渡すが、
            // ステートが "ready" になるだけで、この座標は "extrudePoint1" にはならない（初回は）。
            // そのため、投影計算自体は正しいが、handleEdgeClickByIndex側でこれを無視するロジックになる。
            const edgeStart = b.path[handle.userData.index];
            const edgeEnd = b.path[(handle.userData.index + 1) % b.path.length];
            const projected = projectPointOnEdge(localPt, edgeStart, edgeEnd);
            handleEdgeClickByIndex(handle.userData.index, projected);
          }
          return;
        }

        // 頂点ドラッグ開始
        selectedVertexHandle = handle;
        dragStartVertexIndex = handle.userData.index;
        selectedVertexHandle.material.color.setHex(0xff6b6b);
        isDragging = true;
      } else {
        // ハンドルに当たらなかった場合：辺クリックとして扱う
        const b = selectedBuilding;
        if (!b || !selectedMesh) return;

        const rot = ((b.rotation || 0) * Math.PI) / 180;
        let clickX, clickZ;

        // 【修正】まず建物メッシュ自体（屋根・壁・枠線）との交差をチェック
        // これにより、高さのある建物の「上の辺」をクリックした際の視差ズレを解消
        const meshIntersects = raycaster.intersectObject(selectedMesh, true);

        if (meshIntersects.length > 0) {
          clickX = meshIntersects[0].point.x;
          clickZ = meshIntersects[0].point.z;
        } else {
          // 建物から外れている場合は地面(Y=0)との交差を使用
          // 【重要】スナップは無効(false)にして、見た目通りの位置を取得
          const gw = getGroundIntersectionFromEvent(event, false);
          if (!gw) return;
          clickX = gw.x;
          clickZ = gw.z;
        }

        const localPt = worldToLocal(clickX, clickZ, b.x, b.z, rot);
        const picked = pickClosestEdgeIndex(localPt, b.path);

        // 閾値を少し緩める (1.5m または スナップの1.5倍)
        const EDGE_PICK_THRESHOLD = Math.max(1.5, snapSize * 1.5);

        if (
          picked.index !== -1 &&
          picked.distSq <= EDGE_PICK_THRESHOLD * EDGE_PICK_THRESHOLD
        ) {
          event.stopImmediatePropagation();
          event.preventDefault();
          controls.enabled = false; // 操作中（押し出し開始候補）は視点移動無効化
          handleEdgeClickByIndex(picked.index, picked.projected);
        }
      }
    },
    true,
  );

  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!vertexEditMode) return;

      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

      // 押し出しプレビュー更新
      if (extrudeState === "preview") {
        updateExtrudePreview();
        // プレビュー中でもハイライト（選択範囲）は更新したい
        updateEdgeHighlight(event);
        return;
      }

      // ハイライト更新
      updateEdgeHighlight(event);

      if (!selectedVertexHandle || !isDragging) return;

      event.stopImmediatePropagation();
      event.preventDefault();

      raycaster.setFromCamera(mouse, camera);

      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();

      if (raycaster.ray.intersectPlane(plane, intersection)) {
        let targetX = intersection.x;
        let targetZ = intersection.z;

        let snapInfo = "";

        if (snapEnabled) {
          if (selectedBuilding) {
            // 【修正】回転している建物でも軸に合わせてスナップする
            const b = selectedBuilding;
            const rot = ((b.rotation || 0) * Math.PI) / 180;

            // ワールド -> ローカル
            const local = worldToLocal(targetX, targetZ, b.x, b.z, rot);

            // ローカルでスナップ
            local.x = Math.round(local.x / snapSize) * snapSize;
            local.z = Math.round(local.z / snapSize) * snapSize;

            // ローカル -> ワールド
            const world = localToWorld(local, b.x, b.z, rot);
            targetX = world.x;
            targetZ = world.z;
          } else if (selectedRoad) {
            // 道路はワールド座標でスナップ
            targetX = Math.round(targetX / snapSize) * snapSize;
            targetZ = Math.round(targetZ / snapSize) * snapSize;
          }
        }

        if (snap90Enabled) {
          // 【変更】180度スナップ等にも対応した拡張版を使用
          const snapped = applyAngleSnap(
            dragStartVertexIndex,
            targetX,
            targetZ,
          );
          targetX = snapped.x;
          targetZ = snapped.z;
          if (snapped.snapped) {
            snapInfo = ` | 📌 スナップ: ${snapped.angleType}`;
          }
        }

        updateVertexPosition(dragStartVertexIndex, {
          x: targetX,
          z: targetZ,
        });

        // 道路の場合は角度表示などをスキップ
        if (selectedRoad) {
          updateStatus(`頂点編集(道路): 🟡ドラッグ中${snapInfo}`);
          return;
        }

        // 【追加】リアルタイム角度表示
        const angleInfo = calculateVertexAngle(
          dragStartVertexIndex,
          targetX,
          targetZ,
        );
        updateStatus(
          `頂点編集: 🟡ドラッグ中${angleInfo ? ` | 📐 角度: ${angleInfo}` : ""}${snapInfo}`,
        );
      }
    },
    true,
  );

  canvas.addEventListener(
    "pointerup",
    (event) => {
      // 操作終了時に視点移動を有効化
      controls.enabled = true;

      if (!vertexEditMode) return;

      if (selectedVertexHandle) {
        selectedVertexHandle.material.color.setHex(0xfbbf24);
        selectedVertexHandle = null;
      }

      if (isDragging && selectedBuilding) {
        updateBuildingBounds(selectedBuilding);
        updatePropertyPanel();
        autoSave();
      }

      isDragging = false;
      dragStartVertexIndex = -1;
    },
    true,
  );
}

// ===================================
// 90度/180度スナップ & 角度計算
// ===================================
function applyAngleSnap(vertexIndex, targetWorldX, targetWorldZ) {
  const b = selectedBuilding;
  if (!b || !b.path)
    return { x: targetWorldX, z: targetWorldZ, snapped: false };

  const rot = ((b.rotation || 0) * Math.PI) / 180;
  const n = b.path.length;

  const prevIdx = (vertexIndex - 1 + n) % n;
  const nextIdx = (vertexIndex + 1) % n;

  // 目標点をローカルへ
  const tLocal = worldToLocal(targetWorldX, targetWorldZ, b.x, b.z, rot);

  const prev = b.path[prevIdx];
  const next = b.path[nextIdx];

  const threshold = snapSize * 2;

  let lx = tLocal.x;
  let lz = tLocal.z;
  let snapped = false;
  let angleType = "";

  // 1) ローカル軸で「直角/平行」(X揃え / Z揃え)
  if (Math.abs(lx - prev.x) < threshold) {
    lx = prev.x;
    snapped = true;
    angleType = "直角/平行(建物軸)";
  } else if (Math.abs(lz - prev.z) < threshold) {
    lz = prev.z;
    snapped = true;
    angleType = "直角/平行(建物軸)";
  }

  if (Math.abs(lx - next.x) < threshold) {
    lx = next.x;
    snapped = true;
    angleType = "直角/平行(建物軸)";
  } else if (Math.abs(lz - next.z) < threshold) {
    lz = next.z;
    snapped = true;
    angleType = "直角/平行(建物軸)";
  }

  // 2) ローカルで「直線(180°)」(prev-next直線へ投影)
  if (!snapped) {
    const vPNx = next.x - prev.x;
    const vPNz = next.z - prev.z;
    const lenSq = vPNx * vPNx + vPNz * vPNz;

    if (lenSq > 1e-6) {
      const vPTx = lx - prev.x;
      const vPTz = lz - prev.z;
      const t = (vPTx * vPNx + vPTz * vPNz) / lenSq;

      const projX = prev.x + t * vPNx;
      const projZ = prev.z + t * vPNz;

      const distSq = (lx - projX) ** 2 + (lz - projZ) ** 2;
      if (distSq < threshold * threshold) {
        lx = projX;
        lz = projZ;
        snapped = true;
        angleType = "直線(180°)";
      }
    }
  }

  // ローカル → ワールドへ戻す
  const w = localToWorld({ x: lx, z: lz }, b.x, b.z, rot);
  return { x: w.x, z: w.z, snapped, angleType };
}

function calculateVertexAngle(vertexIndex, currentX, currentZ) {
  const b = selectedBuilding;
  if (!b || !b.path) return null;

  const rot = ((b.rotation || 0) * Math.PI) / 180;
  const path = b.path;
  const n = path.length;

  const prevIdx = (vertexIndex - 1 + n) % n;
  const nextIdx = (vertexIndex + 1) % n;

  const prevWorld = localToWorld(path[prevIdx], b.x, b.z, rot);
  const nextWorld = localToWorld(path[nextIdx], b.x, b.z, rot);

  // Vector BA (Current -> Prev)
  const bax = prevWorld.x - currentX;
  const baz = prevWorld.z - currentZ;

  // Vector BC (Current -> Next)
  const bcx = nextWorld.x - currentX;
  const bcz = nextWorld.z - currentZ;

  const angBA = Math.atan2(baz, bax);
  const angBC = Math.atan2(bcz, bcx);

  let angleRad = Math.abs(angBA - angBC);
  // 0~PIの範囲に正規化（内角）
  if (angleRad > Math.PI) angleRad = 2 * Math.PI - angleRad;

  const degrees = (angleRad * 180) / Math.PI;
  return degrees.toFixed(1) + "°";
}

// 古い関数は削除または置換
// function apply90DegreeSnap(...)

// ===================================
// 押し出し機能（改良版）
// ===================================
// ===================================
// 押し出し機能（改良版）
// ===================================
function handleEdgeClickByIndex(edgeIndex, projectedLocal) {
  const b = selectedBuilding;
  if (!b || !b.path) return;

  const rot = ((b.rotation || 0) * Math.PI) / 180;

  // 1. 未選択 または 別の辺を選択 -> 準備モードへ移行
  if (
    extrudeState === "idle" ||
    extrudeState === "preview" || // プレビュー中ならキャンセルして新規開始とみなす
    extrudeEdgeIndex !== edgeIndex
  ) {
    cancelExtrudeMode(); // ステータスリセット
    extrudeState = "ready"; // 【変更】まず準備状態にする
    extrudeEdgeIndex = edgeIndex;

    extrudeOutwardDir = calculateOutwardDirectionRobust(b, edgeIndex);

    updateStatus("押し出し: 始点をクリックしてください");
    return;
  }

  // 2. 準備モード -> 1点目決定
  if (extrudeState === "ready" && extrudeEdgeIndex === edgeIndex) {
    extrudeState = "firstPoint";
    extrudePoint1 = projectedLocal;

    // マーカー表示（復活）
    const w = localToWorld(projectedLocal, b.x, b.z, rot);
    addExtrudeMarker(w.x, w.z, 0x22c55e); // 緑

    updateStatus("押し出し: 終点をクリックして幅を決定");
    return;
  }

  // 3. 1点目決定済み -> 2点目決定（幅確定）
  if (extrudeState === "firstPoint" && extrudeEdgeIndex === edgeIndex) {
    extrudePoint2 = projectedLocal;

    // 幅が極小なら無視
    const dx = extrudePoint2.x - extrudePoint1.x;
    const dz = extrudePoint2.z - extrudePoint1.z;
    if (dx * dx + dz * dz < 0.01) {
      updateStatus(
        "押し出し: 幅が小さすぎます。別の位置をクリックしてください",
      );
      return;
    }

    extrudeState = "preview";

    // マーカー表示（復活）
    const w = localToWorld(projectedLocal, b.x, b.z, rot);
    addExtrudeMarker(w.x, w.z, 0x22c55e);

    // p1とp2の順序を辺の方向に揃える
    orderExtrudePoints();

    updateStatus("押し出し: マウスを動かして奥行きを決定、クリックで確定");
  }
}

function projectPointOnEdge(point, edgeStart, edgeEnd) {
  const edgeDx = edgeEnd.x - edgeStart.x;
  const edgeDz = edgeEnd.z - edgeStart.z;
  const edgeLenSq = edgeDx * edgeDx + edgeDz * edgeDz;

  if (edgeLenSq === 0) return { ...edgeStart };

  const t =
    ((point.x - edgeStart.x) * edgeDx + (point.z - edgeStart.z) * edgeDz) /
    edgeLenSq;
  const tClamped = Math.max(0, Math.min(1, t));

  return {
    x: edgeStart.x + tClamped * edgeDx,
    z: edgeStart.z + tClamped * edgeDz,
  };
}

function polygonSignedAreaXZ(path) {
  let a = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const q = path[(i + 1) % path.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

function calculateOutwardDirectionRobust(b, edgeIndex) {
  const a = b.path[edgeIndex];
  const c = b.path[(edgeIndex + 1) % b.path.length];

  const dx = c.x - a.x;
  const dz = c.z - a.z;
  const len = Math.hypot(dx, dz) || 1;

  const area = polygonSignedAreaXZ(b.path);
  const isCCW = area > 0;

  // CCW: 外側は “右” 側、CW: 外側は “左” 側
  const nx = isCCW ? dz / len : -dz / len;
  const nz = isCCW ? -dx / len : dx / len;

  return { x: nx, z: nz };
}

function orderExtrudePoints() {
  const b = selectedBuilding;
  const edgeStart = b.path[extrudeEdgeIndex];
  const edgeEnd = b.path[(extrudeEdgeIndex + 1) % b.path.length];

  const edgeDx = edgeEnd.x - edgeStart.x;
  const edgeDz = edgeEnd.z - edgeStart.z;
  const edgeLenSq = edgeDx * edgeDx + edgeDz * edgeDz;

  if (edgeLenSq === 0) return;

  const t1 =
    ((extrudePoint1.x - edgeStart.x) * edgeDx +
      (extrudePoint1.z - edgeStart.z) * edgeDz) /
    edgeLenSq;
  const t2 =
    ((extrudePoint2.x - edgeStart.x) * edgeDx +
      (extrudePoint2.z - edgeStart.z) * edgeDz) /
    edgeLenSq;

  if (t1 > t2) {
    const temp = extrudePoint1;
    extrudePoint1 = extrudePoint2;
    extrudePoint2 = temp;
  }
}

function addExtrudeMarker(worldX, worldZ, color) {
  // マーカー表示復活
  const b = selectedBuilding;
  // const height = b.floors * 3; // これは今の高さ。押し出し作業中は地面付近でもいいが、とりあえず既存に合わせる

  // 視認性を良くするため、少し大きめのSphereにするか、目立つ色にする
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16), // サイズ調整: 1.2 -> 0.5
    new THREE.MeshBasicMaterial({
      color: color,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    }),
  );
  // 少し浮かせる
  const y = b.floors * 3 + 0.5;
  marker.position.set(worldX, y, worldZ);
  marker.renderOrder = 2000; // 最前面に
  scene.add(marker);
  extrudeMarkers.push(marker);
}

function updateExtrudePreview() {
  if (extrudeState !== "preview" || !extrudePoint1 || !extrudePoint2) return;

  const b = selectedBuilding;
  const rot = ((b.rotation || 0) * Math.PI) / 180;

  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, p)) return;

  let gx = p.x,
    gz = p.z;
  if (snapEnabled) {
    gx = Math.round(gx / snapSize) * snapSize;
    gz = Math.round(gz / snapSize) * snapSize;
  }

  const mouseLocal = worldToLocal(gx, gz, b.x, b.z, rot);

  // “元の辺” に対する垂直距離でdepthを決める
  const edgeStart = b.path[extrudeEdgeIndex];
  const edgeEnd = b.path[(extrudeEdgeIndex + 1) % b.path.length];
  const proj = projectPointOnEdge(mouseLocal, edgeStart, edgeEnd);

  let depth =
    (mouseLocal.x - proj.x) * extrudeOutwardDir.x +
    (mouseLocal.z - proj.z) * extrudeOutwardDir.z;

  // 外側だけにしたいなら負を0へ（好み）
  if (depth < 0) depth = 0;

  if (snapEnabled) depth = Math.round(depth / snapSize) * snapSize;

  if (depth < 1) depth = 1; // 最低1m

  // プレビューメッシュを更新
  updateExtrudePreviewMesh(depth);

  updateStatus(`押し出し: 奥行き ${Math.round(depth)}m | クリックで確定`);
}

function updateExtrudePreviewMesh(depth) {
  const b = selectedBuilding;
  const rot = ((b.rotation || 0) * Math.PI) / 180;
  const height = b.floors * 3;

  // 4つの頂点を計算（ローカル座標）
  const p1 = extrudePoint1;
  const p2 = extrudePoint2;
  const p3 = {
    x: p2.x + extrudeOutwardDir.x * depth,
    z: p2.z + extrudeOutwardDir.z * depth,
  };
  const p4 = {
    x: p1.x + extrudeOutwardDir.x * depth,
    z: p1.z + extrudeOutwardDir.z * depth,
  };

  // ワールド座標に変換
  const w1 = localToWorld(p1, b.x, b.z, rot);
  const w2 = localToWorld(p2, b.x, b.z, rot);
  const w3 = localToWorld(p3, b.x, b.z, rot);
  const w4 = localToWorld(p4, b.x, b.z, rot);

  // 既存のプレビューを削除
  if (extrudePreviewMesh) {
    scene.remove(extrudePreviewMesh);
    extrudePreviewMesh.geometry.dispose();
    extrudePreviewMesh.material.dispose();
  }

  // プレビュー用のShape
  const shape = new THREE.Shape();
  shape.moveTo(w1.x, -w1.z);
  shape.lineTo(w2.x, -w2.z);
  shape.lineTo(w3.x, -w3.z);
  shape.lineTo(w4.x, -w4.z);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshLambertMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.5,
  });

  extrudePreviewMesh = new THREE.Mesh(geometry, material);
  extrudePreviewMesh.position.set(0, 0, 0);
  extrudePreviewMesh.userData.depth = depth;
  scene.add(extrudePreviewMesh);
}

function finalizeExtrude() {
  if (
    extrudeState !== "preview" ||
    !extrudePreviewMesh ||
    !extrudePoint1 ||
    !extrudePoint2
  )
    return;

  const b = selectedBuilding;
  const depth = extrudePreviewMesh.userData.depth;

  // 4つの頂点を計算
  const p1 = { ...extrudePoint1 };
  const p2 = { ...extrudePoint2 };
  const p3 = {
    x: p2.x + extrudeOutwardDir.x * depth,
    z: p2.z + extrudeOutwardDir.z * depth,
  };
  const p4 = {
    x: p1.x + extrudeOutwardDir.x * depth,
    z: p1.z + extrudeOutwardDir.z * depth,
  };

  // 新しいパスを構築
  const newPath = [];
  for (let i = 0; i < b.path.length; i++) {
    newPath.push({ ...b.path[i] });
    if (i === extrudeEdgeIndex) {
      // p1, p4, p3, p2の順で挿入（時計回りまたは反時計回りを維持）
      newPath.push({ x: p1.x, z: p1.z });
      newPath.push({ x: p4.x, z: p4.z });
      newPath.push({ x: p3.x, z: p3.z });
      newPath.push({ x: p2.x, z: p2.z });
    }
  }

  b.path = newPath;

  // クリーンアップ
  cancelExtrudeMode();

  // 再構築
  updateBuildingBounds(b);
  rebuildSelectedBuilding();
  createVertexHandles();
  autoSave();

  updateStatus(`押し出し完了: 奥行き ${Math.round(depth)}m`);
}

function cancelExtrudeMode() {
  extrudeState = "idle";
  extrudeEdgeIndex = -1;
  extrudePoint1 = null;
  extrudePoint2 = null;
  extrudeOutwardDir = null;

  // マーカー削除
  extrudeMarkers.forEach((m) => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  extrudeMarkers = [];

  // プレビュー削除
  if (extrudePreviewMesh) {
    scene.remove(extrudePreviewMesh);
    extrudePreviewMesh.geometry.dispose();
    extrudePreviewMesh.material.dispose();
    extrudePreviewMesh = null;
  }
}

// ===================================
// 頂点位置更新
// ===================================
function updateVertexPosition(vertexIndex, worldPosition) {
  if (selectedRoad) {
    if (vertexIndex < 0 || vertexIndex >= selectedRoad.path.length) return;
    selectedRoad.path[vertexIndex].x = worldPosition.x;
    selectedRoad.path[vertexIndex].z = worldPosition.z;

    // ハンドル更新
    const handle = vertexHandles.find(
      (h) => h.userData.type === "vertex" && h.userData.index === vertexIndex,
    );
    if (handle) {
      handle.position.set(worldPosition.x, 0.5, worldPosition.z);
    }

    rebuildSelectedRoad(); // これから実装
    updateStatus(
      `頂点${vertexIndex}: (${Math.round(worldPosition.x)}, ${Math.round(worldPosition.z)})`,
    );
    return;
  }

  const b = selectedBuilding;
  if (!b || !b.path || vertexIndex < 0 || vertexIndex >= b.path.length) return;

  const rot = ((b.rotation || 0) * Math.PI) / 180;
  const local = worldToLocal(worldPosition.x, worldPosition.z, b.x, b.z, rot);

  b.path[vertexIndex].x = local.x;
  b.path[vertexIndex].z = local.z;

  // ハンドル位置を更新
  const handle = vertexHandles.find(
    (h) => h.userData.type === "vertex" && h.userData.index === vertexIndex,
  );
  if (handle) {
    const FLOOR_HEIGHT = 3;
    const height = b.floors * FLOOR_HEIGHT;
    handle.position.set(worldPosition.x, height + 2, worldPosition.z);
  }

  updateEdgeHandlePositions();
  rebuildSelectedBuilding();

  updateStatus(
    `頂点${vertexIndex}: (${Math.round(local.x)}, ${Math.round(local.z)})`,
  );
}

function rebuildSelectedRoad() {
  if (!selectedRoad || !selectedMesh) return;

  const index = roadMeshes.indexOf(selectedMesh);
  if (index === -1) return;

  scene.remove(selectedMesh);
  selectedMesh.geometry.dispose();
  selectedMesh.material.dispose();

  const newMesh = createRoadMesh(selectedRoad);
  // 選択色
  newMesh.material.color.setHex(0xaaaaaa);

  scene.add(newMesh);
  roadMeshes[index] = newMesh;
  selectedMesh = newMesh;
}

function updateEdgeHandlePositions() {
  const b = selectedBuilding;
  if (!b || !b.path) return;

  const rot = ((b.rotation || 0) * Math.PI) / 180;
  const FLOOR_HEIGHT = 3;
  const height = b.floors * FLOOR_HEIGHT;

  vertexHandles
    .filter((h) => h.userData.type === "edge")
    .forEach((handle) => {
      const i = handle.userData.index;
      if (i >= b.path.length) return;

      const p1 = b.path[i];
      const p2 = b.path[(i + 1) % b.path.length];

      const midLocal = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
      const world = localToWorld(midLocal, b.x, b.z, rot);
      handle.position.set(world.x, height + 2, world.z);
    });
}

function updateBuildingBounds(b) {
  if (!b.path || b.path.length === 0) return;

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;

  b.path.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });

  b.width = maxX - minX;
  b.depth = maxZ - minZ;
}

function rebuildSelectedBuilding() {
  if (!selectedBuilding || !selectedMesh) return;

  const index = buildingMeshes.indexOf(selectedMesh);
  if (index === -1) return;

  scene.remove(selectedMesh);
  selectedMesh.geometry.dispose();
  selectedMesh.material.dispose();

  const newMesh = createBuildingMesh(selectedBuilding);
  newMesh.material.emissive = new THREE.Color(0x333333);
  scene.add(newMesh);
  buildingMeshes[index] = newMesh;
  selectedMesh = newMesh;

  if (!vertexEditMode) {
    updateDragControls();
  }
}

// ===================================
// アニメーションループ
// ===================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// ===================================
// 起動
// ===================================
document.addEventListener("DOMContentLoaded", init);
