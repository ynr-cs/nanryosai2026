/**
 * Nanryosai 2026
 * 3Dマップエディタ - エリアツール (分離モジュール)
 *
 * このファイルは editor.js から分離されたエリアツール関連のコードです。
 *
 * 【外部依存 (editor.js のグローバルスコープ)】
 * - THREE (Three.js)
 * - scene, renderer, raycaster, camera
 * - roads, roadTool
 * - areas, areaMeshes, selectedArea, selectedAreaMesh
 * - snapEnabled, snapSize, snap90Enabled
 * - updateStatus(), autoSave(), saveToLocalStorage()
 * - selectBuilding(), selectRoad(), updatePropertyPanel()
 * - createVertexHandles()
 *
 * 【読み込み順序】
 * area_tool.js → editor.js (このファイルが先に読み込まれる)
 */

// ===================================
// エリアツール定数
// ===================================
const AreaTool = {
  DRAW_PATH: "draw_path",
  DRAW_POLYGON: "draw_polygon",
  EDIT: "edit",
  DELETE: "delete",
  IDLE: "idle",
};

// ===================================
// AreaToolManager クラス
// ===================================
class AreaToolManager {
  constructor() {
    this.mode = AreaTool.IDLE;
    this.subType = "public_road"; // public_road, campus_walkway, flat_area
    this.drawMode = AreaTool.DRAW_PATH; // path, polygon

    this.nodes = []; // 現在作成中のノード

    // Visuals
    this.cursorMesh = null;
    this.ghostMesh = null;
    this.ghostLineMesh = null;
    this.nodeSnapMesh = null;
    this.placedNodeMeshes = []; // 配置済みノードの丸マーカー

    // パス幅プレビュー用ゴースト
    this.pathGhostMesh = null;

    // ツールチップ (HTML DOM)
    this.tooltip = null;

    // Snapping
    this.snapDistance = 2.0;
    this.startSnapDistance = 3.0; // 始点へのスナップ距離（ポリゴン閉じ用）
  }

  init() {
    // 1. カーソル (緑色の丸)
    const cursorGeo = new THREE.SphereGeometry(1.0, 24, 24);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: 0x4caf50,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    this.cursorMesh = new THREE.Mesh(cursorGeo, cursorMat);
    this.cursorMesh.visible = false;
    this.cursorMesh.renderOrder = 999;
    scene.add(this.cursorMesh);

    // 2. スナップマーカー (オレンジの丸 - スナップ時に表示)
    const snapGeo = new THREE.SphereGeometry(1.2, 24, 24);
    const snapMat = new THREE.MeshBasicMaterial({
      color: 0xff9800,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });
    this.nodeSnapMesh = new THREE.Mesh(snapGeo, snapMat);
    this.nodeSnapMesh.visible = false;
    this.nodeSnapMesh.renderOrder = 2000;
    scene.add(this.nodeSnapMesh);

    // 3. ゴーストメッシュ（ポリゴン面プレビュー）
    const ghostGeo = new THREE.BufferGeometry();
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x81c784,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    this.ghostMesh.visible = false;
    this.ghostMesh.renderOrder = 1;
    scene.add(this.ghostMesh);

    // 4. ゴーストライン（枠線プレビュー）
    const ghostLineMat = new THREE.LineBasicMaterial({
      color: 0x4caf50,
      linewidth: 2,
      depthTest: false,
    });
    const ghostLineGeo = new THREE.BufferGeometry();
    this.ghostLineMesh = new THREE.Line(ghostLineGeo, ghostLineMat);
    this.ghostLineMesh.visible = false;
    this.ghostLineMesh.renderOrder = 2;
    scene.add(this.ghostLineMesh);

    // 5. パス幅プレビュー用ゴースト（道路風の帯表示）
    const pathGhostGeo = new THREE.BufferGeometry();
    const pathGhostMat = new THREE.MeshBasicMaterial({
      color: 0x81c784,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.pathGhostMesh = new THREE.Mesh(pathGhostGeo, pathGhostMat);
    this.pathGhostMesh.visible = false;
    this.pathGhostMesh.renderOrder = 1;
    scene.add(this.pathGhostMesh);

    // 6. ツールチップ (DOM要素)
    this.tooltip = document.createElement("div");
    this.tooltip.id = "area-tooltip";
    Object.assign(this.tooltip.style, {
      position: "absolute",
      backgroundColor: "rgba(0,0,0,0.85)",
      color: "white",
      padding: "6px 10px",
      borderRadius: "6px",
      fontSize: "12px",
      pointerEvents: "none",
      display: "none",
      zIndex: "1000",
      whiteSpace: "pre-line",
      fontFamily: "monospace",
      border: "1px solid rgba(76,175,80,0.6)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    });
    document.body.appendChild(this.tooltip);
  }

  // --- モード制御 ---

  setMode(mode) {
    this.mode = mode;
    this.resetState();
    updateStatus(`エリアツール: ${this.getModeName(mode)}`);

    // UIボタンのハイライト更新
    const areaButtons = [
      "btn-area-public",
      "btn-area-walkway",
      "btn-area-flat",
      "btn-area-edit",
      "btn-area-delete",
    ];

    areaButtons.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("active");
    });

    if (
      this.mode === AreaTool.DRAW_PATH ||
      this.mode === AreaTool.DRAW_POLYGON
    ) {
      if (this.subType === "public_road")
        document.getElementById("btn-area-public")?.classList.add("active");
      if (this.subType === "campus_walkway")
        document.getElementById("btn-area-walkway")?.classList.add("active");
      if (this.subType === "flat_area")
        document.getElementById("btn-area-flat")?.classList.add("active");
    } else if (this.mode === AreaTool.EDIT) {
      document.getElementById("btn-area-edit")?.classList.add("active");
    } else if (this.mode === AreaTool.DELETE) {
      document.getElementById("btn-area-delete")?.classList.add("active");
    }
  }

  setSubType(type) {
    this.subType = type;
    if (type === "flat_area") this.drawMode = AreaTool.DRAW_POLYGON;
    else this.drawMode = AreaTool.DRAW_PATH;

    updateStatus(`エリアタイプ変更: ${type}`);
  }

  setSnap(enabled) {
    // グローバル snapEnabled を使用
  }

  getModeName(mode) {
    switch (mode) {
      case AreaTool.DRAW_PATH:
        return "パス作成";
      case AreaTool.DRAW_POLYGON:
        return "ポリゴン作成";
      case AreaTool.EDIT:
        return "編集モード";
      case AreaTool.DELETE:
        return "削除モード";
      default:
        return "待機中";
    }
  }

  // --- 状態リセット ---

  resetState() {
    this.nodes = [];
    if (this.ghostMesh) this.ghostMesh.visible = false;
    if (this.ghostLineMesh) this.ghostLineMesh.visible = false;
    if (this.cursorMesh) this.cursorMesh.visible = false;
    if (this.nodeSnapMesh) this.nodeSnapMesh.visible = false;
    if (this.pathGhostMesh) this.pathGhostMesh.visible = false;
    if (this.tooltip) this.tooltip.style.display = "none";

    // 配置済みノードマーカーのクリーンアップ
    this.clearPlacedNodes();
  }

  clearPlacedNodes() {
    this.placedNodeMeshes.forEach((m) => {
      scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this.placedNodeMeshes = [];
  }

  // --- ノードマーカー表示（丸） ---

  addPlacedNodeMarker(x, z, isFirst = false) {
    const radius = isFirst ? 1.2 : 0.9;
    const color = isFirst ? 0x66bb6a : 0x4caf50;

    const geo = new THREE.CircleGeometry(radius, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.12, z);
    mesh.renderOrder = 500;
    scene.add(mesh);
    this.placedNodeMeshes.push(mesh);

    // 始点にはリング（白枠）を追加して目立たせる
    if (isFirst) {
      const ringGeo = new THREE.RingGeometry(radius * 0.7, radius * 1.1, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(x, 0.13, z);
      ringMesh.renderOrder = 501;
      scene.add(ringMesh);
      this.placedNodeMeshes.push(ringMesh);
    }
  }

  // --- 座標変換ヘルパー ---

  toScreenPosition(x, y, z) {
    const v = new THREE.Vector3(x, y, z);
    v.project(camera);
    const cvs = renderer.domElement;
    return {
      x: (v.x + 1) * 0.5 * cvs.clientWidth,
      y: -(v.y - 1) * 0.5 * cvs.clientHeight,
    };
  }

  // --- イベントハンドリング ---

  handleEvent(type, event) {
    // IDLE / EDIT モードではAreaToolは介入しない（グローバルonClickに委譲）
    if (this.mode === AreaTool.IDLE || this.mode === AreaTool.EDIT)
      return false;

    if (type === "pointermove") {
      this.onPointerMove(event);
      return true;
    }
    if (type === "pointerdown") {
      return this.onPointerDown(event);
    }
    if (type === "click") {
      // 描画中（ノードが1つ以上ある）ならグローバルonClickをブロック
      if (this.nodes.length > 0) return true;
      return false;
    }
    if (type === "contextmenu") {
      this.onRightClick(event);
      return true;
    }
    return false;
  }

  // --- ポインター移動 ---

  onPointerMove(event) {
    const pos = this.getRaycastPosition(event);
    if (!pos) return;

    const snap = this.calculateSnap(pos);
    const { x, z } = snap;

    // カーソル／スナップマーカーの表示切替
    if (
      snap.type === "VERTEX" ||
      snap.type === "NODE" ||
      snap.type === "START"
    ) {
      // スナップ中 → オレンジマーカー
      this.nodeSnapMesh.position.set(x, 0.15, z);
      this.nodeSnapMesh.visible = true;
      this.cursorMesh.visible = false;

      // 始点スナップは特別な色（黄緑）で強調
      if (snap.type === "START") {
        this.nodeSnapMesh.material.color.setHex(0x76ff03);
      } else {
        this.nodeSnapMesh.material.color.setHex(0xff9800);
      }
    } else {
      // 通常カーソル
      this.cursorMesh.position.set(x, 0.12, z);
      this.cursorMesh.visible = true;
      this.nodeSnapMesh.visible = false;
    }

    // ゴースト＆ツールチップ更新
    if (this.nodes.length > 0) {
      const currentNodes = [...this.nodes, { x, z }];
      this.updateGhost(currentNodes);
      this.updateTooltip(event, snap);
    } else {
      // 描画開始前でもツールチップに座標を表示
      this.updateTooltipBasic(event, snap);
    }
  }

  // --- ツールチップ ---

  updateTooltip(event, snap) {
    const { x, z } = snap;
    const prev = this.nodes[this.nodes.length - 1];
    const dx = x - prev.x;
    const dz = z - prev.z;
    const segLength = Math.hypot(dx, dz);

    // 全体の長さを計算
    let totalLength = 0;
    for (let i = 1; i < this.nodes.length; i++) {
      totalLength += Math.hypot(
        this.nodes[i].x - this.nodes[i - 1].x,
        this.nodes[i].z - this.nodes[i - 1].z,
      );
    }
    totalLength += segLength;

    // 角度計算
    let angleDeg = null;
    if (segLength > 0.5) {
      const angle = Math.atan2(dz, dx);
      angleDeg = Math.round((angle * 180) / Math.PI);
      // 0~360度に正規化
      if (angleDeg < 0) angleDeg += 360;
    }

    // 2点目以降: 折れ角を計算
    let bendAngle = null;
    if (this.nodes.length >= 2 && segLength > 0.5) {
      const pp = this.nodes[this.nodes.length - 2];
      const vPrev = { x: prev.x - pp.x, z: prev.z - pp.z };
      const vCurr = { x: dx, z: dz };
      const dot = vPrev.x * vCurr.x + vPrev.z * vCurr.z;
      const cross = vPrev.x * vCurr.z - vPrev.z * vCurr.x;
      bendAngle = Math.round((Math.atan2(cross, dot) * 180) / Math.PI);
    }

    // メッセージ組み立て
    let msg = `📏 ${segLength.toFixed(1)}m`;
    if (angleDeg !== null) msg += `  📐 ${angleDeg}°`;
    if (bendAngle !== null) msg += `\n↪ 折れ角 ${bendAngle}°`;
    msg += `\n全長 ${totalLength.toFixed(1)}m | ${this.nodes.length + 1}点`;

    if (snap.type !== "RAW" && snap.type !== "GRID") {
      msg += ` [${snap.type}]`;
    }

    // 始点スナップ時の特別表示
    if (snap.type === "START") {
      msg += "\n🔒 クリックで閉じる";
    }

    this.tooltip.innerText = msg;
    this.tooltip.style.left = event.clientX + 16 + "px";
    this.tooltip.style.top = event.clientY + 16 + "px";
    this.tooltip.style.display = "block";
  }

  updateTooltipBasic(event, snap) {
    const { x, z } = snap;
    let msg = `POS: ${Math.round(x)}, ${Math.round(z)}`;
    if (snap.type !== "RAW") msg += ` [${snap.type}]`;

    this.tooltip.innerText = msg;
    this.tooltip.style.left = event.clientX + 16 + "px";
    this.tooltip.style.top = event.clientY + 16 + "px";
    this.tooltip.style.display = "block";
  }

  // --- ポインタークリック ---

  onPointerDown(event) {
    if (event.button !== 0) return false; // 左クリックのみ

    const pos = this.getRaycastPosition(event);
    if (!pos) return false;

    // DELETEモード
    if (this.mode === AreaTool.DELETE) {
      this.deleteAreaAt(pos);
      return true;
    }

    const snap = this.calculateSnap(pos);

    // 始点スナップ → ポリゴン閉じ
    if (snap.type === "START" && this.nodes.length >= 3) {
      this.createArea();
      return true;
    }

    // ノード追加
    this.nodes.push({
      x: snap.x,
      z: snap.z,
      id: snap.targetNode ? snap.targetNode.id : null,
    });

    // 丸マーカーを配置
    this.addPlacedNodeMarker(snap.x, snap.z, this.nodes.length === 1);

    updateStatus(
      `エリアノード追加: ${this.nodes.length}点目 (右クリックで確定)`,
    );
    return true;
  }

  // --- 右クリック (完了 / キャンセル) ---

  onRightClick(event) {
    event.preventDefault();

    if (this.nodes.length >= 2) {
      this.createArea();
    } else {
      this.resetState();
      updateStatus("エリア作成キャンセル");
    }
  }

  // --- エリア作成 ---

  createArea() {
    if (this.nodes.length < 2) return;

    const newArea = {
      id: "area_" + Date.now(),
      type: "area",
      subType: this.subType,
      drawMode: this.drawMode,
      width: this.subType === "campus_walkway" ? 3.0 : 8.0,
      nodes: this.nodes.map((n) => ({
        x: n.x,
        z: n.z,
        id: n.id || "node_" + Date.now() + "_" + Math.random(),
      })),
      properties: {
        name: "新規エリア",
      },
    };

    areas.push(newArea);

    // メッシュ作成
    if (typeof createAreaMesh === "function") {
      const mesh = createAreaMesh(newArea);
      if (mesh) {
        scene.add(mesh);
        areaMeshes.push(mesh);
      }
    }

    this.resetState();
    updateStatus("エリアを作成しました ✓");

    if (typeof autoSave === "function") autoSave();
  }

  // --- ゴースト (プレビュー) 更新 ---

  updateGhost(nodes) {
    if (nodes.length < 2) {
      this.ghostMesh.visible = false;
      this.ghostLineMesh.visible = false;
      this.pathGhostMesh.visible = false;
      return;
    }

    // 1. 枠線の更新（常に描画）
    const linePoints = nodes.map((n) => new THREE.Vector3(n.x, 0.12, n.z));
    if (this.drawMode === AreaTool.DRAW_POLYGON) {
      linePoints.push(linePoints[0].clone());
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    this.ghostLineMesh.geometry.dispose();
    this.ghostLineMesh.geometry = lineGeo;
    this.ghostLineMesh.visible = true;

    // 2. ポリゴンモード: 面プレビュー
    if (this.drawMode === AreaTool.DRAW_POLYGON && nodes.length >= 3) {
      try {
        const shape = new THREE.Shape();
        shape.moveTo(nodes[0].x, -nodes[0].z);
        for (let i = 1; i < nodes.length; i++) {
          shape.lineTo(nodes[i].x, -nodes[i].z);
        }
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, 0.08, 0);

        this.ghostMesh.geometry.dispose();
        this.ghostMesh.geometry = geo;
        this.ghostMesh.visible = true;
      } catch (e) {
        this.ghostMesh.visible = false;
      }
      this.pathGhostMesh.visible = false;
    }
    // 3. パスモード: 幅付き帯プレビュー
    else if (this.drawMode === AreaTool.DRAW_PATH && nodes.length >= 2) {
      this.ghostMesh.visible = false;
      this.updatePathGhost(nodes);
    } else {
      this.ghostMesh.visible = false;
      this.pathGhostMesh.visible = false;
    }
  }

  // パス幅プレビュー（道路風の帯表示）
  updatePathGhost(nodes) {
    const width = this.subType === "campus_walkway" ? 3.0 : 8.0;
    const halfWidth = width / 2;
    const y = 0.06;

    const vertices = [];
    const indices = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;

      const nx = (-dz / len) * halfWidth;
      const nz = (dx / len) * halfWidth;

      const baseIndex = vertices.length / 3;
      vertices.push(p1.x + nx, y, p1.z + nz);
      vertices.push(p1.x - nx, y, p1.z - nz);
      vertices.push(p2.x + nx, y, p2.z + nz);
      vertices.push(p2.x - nx, y, p2.z - nz);

      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
    }

    if (vertices.length === 0) {
      this.pathGhostMesh.visible = false;
      return;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);

    this.pathGhostMesh.geometry.dispose();
    this.pathGhostMesh.geometry = geo;
    this.pathGhostMesh.visible = true;
  }

  // --- レイキャスト ---

  getRaycastPosition(event) {
    if (roadTool) return roadTool.getRaycastPosition(event);
    return null;
  }

  // --- スナップ計算 ---

  calculateSnap(pos) {
    let snappedPos = { x: pos.x, z: pos.z, type: "RAW" };
    const bestDistSq = this.snapDistance * this.snapDistance;

    // 0. 始点スナップ（ポリゴン閉じ判定）— 最優先
    if (this.drawMode === AreaTool.DRAW_POLYGON && this.nodes.length >= 3) {
      const first = this.nodes[0];
      const startDist = Math.hypot(pos.x - first.x, pos.z - first.z);
      if (startDist < this.startSnapDistance) {
        return {
          x: first.x,
          z: first.z,
          type: "START",
          targetNode: first,
        };
      }
    }

    // 1. 既存エリアの頂点へのスナップ (Vertex Snap)
    let nearestVertex = null;
    let minVertexDistSq = bestDistSq;

    for (const area of areas) {
      if (!area.nodes) continue;
      for (const node of area.nodes) {
        const dx = pos.x - node.x;
        const dz = pos.z - node.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < minVertexDistSq) {
          minVertexDistSq = d2;
          nearestVertex = node;
        }
      }
    }

    // 作成中のノードの頂点にもスナップ（始点は除く、別途処理済み）
    for (let i = 1; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const dx = pos.x - node.x;
      const dz = pos.z - node.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < minVertexDistSq) {
        minVertexDistSq = d2;
        nearestVertex = node;
      }
    }

    if (nearestVertex) {
      return {
        x: nearestVertex.x,
        z: nearestVertex.z,
        type: "VERTEX",
        targetNode: nearestVertex,
      };
    }

    // 2. 道路ノードスナップ
    if (roadTool) {
      const nodeSnap = roadTool.findClosestNode(pos, this.snapDistance);
      if (nodeSnap) {
        return {
          x: nodeSnap.x,
          z: nodeSnap.z,
          type: "NODE",
          targetNode: nodeSnap,
        };
      }
    }

    // 3. 角度スナップ
    if (this.nodes.length > 0 && (snapEnabled || snap90Enabled)) {
      const prev = this.nodes[this.nodes.length - 1];
      const dx = pos.x - prev.x;
      const dz = pos.z - prev.z;
      const dist = Math.hypot(dx, dz);

      if (dist > snapSize) {
        let baseAngle = 0;
        if (this.nodes.length > 1) {
          const pp = this.nodes[this.nodes.length - 2];
          baseAngle = Math.atan2(prev.z - pp.z, prev.x - pp.x);
        }

        const currentAngle = Math.atan2(dz, dx);
        let diff = currentAngle - baseAngle;

        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const step = Math.PI / 2;
        const snappedDiff = Math.round(diff / step) * step;

        if (Math.abs(diff - snappedDiff) < 0.15) {
          const finalAngle = baseAngle + snappedDiff;
          return {
            x: prev.x + Math.cos(finalAngle) * dist,
            z: prev.z + Math.sin(finalAngle) * dist,
            type: "ANGLE",
            targetNode: null,
          };
        }
      }
    }

    // 4. グリッドスナップ
    if (snapEnabled) {
      return {
        x: Math.round(pos.x / snapSize) * snapSize,
        z: Math.round(pos.z / snapSize) * snapSize,
        type: "GRID",
      };
    }

    return snappedPos;
  }

  // --- 削除 ---

  deleteAreaAt(pos) {
    let targetIndex = -1;

    for (let i = 0; i < areas.length; i++) {
      const area = areas[i];
      if (!area.nodes || area.nodes.length < 2) continue;

      if (
        area.drawMode === AreaTool.DRAW_POLYGON ||
        area.subType === "flat_area"
      ) {
        if (this.isPointInPolygon(pos, area.nodes)) {
          targetIndex = i;
          break;
        }
      } else {
        for (let j = 0; j < area.nodes.length - 1; j++) {
          const d = this.pointToSegmentDistance(
            pos,
            area.nodes[j],
            area.nodes[j + 1],
          );
          if (d < area.width / 2 + 1.0) {
            targetIndex = i;
            break;
          }
        }
        if (targetIndex !== -1) break;
      }
    }

    if (targetIndex !== -1) {
      areas.splice(targetIndex, 1);
      createAreas();
      updateStatus("エリアを削除しました");
      saveToLocalStorage();
    }
  }

  isPointInPolygon(p, polygon) {
    let isInside = false;
    let minX = polygon[0].x,
      maxX = polygon[0].x;
    let minZ = polygon[0].z,
      maxZ = polygon[0].z;

    for (let n = 1; n < polygon.length; n++) {
      const q = polygon[n];
      minX = Math.min(q.x, minX);
      maxX = Math.max(q.x, maxX);
      minZ = Math.min(q.z, minZ);
      maxZ = Math.max(q.z, maxZ);
    }
    if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) {
      return false;
    }

    let i = 0,
      j = polygon.length - 1;
    for (i, j; i < polygon.length; j = i++) {
      if (
        polygon[i].z > p.z !== polygon[j].z > p.z &&
        p.x <
          ((polygon[j].x - polygon[i].x) * (p.z - polygon[i].z)) /
            (polygon[j].z - polygon[i].z) +
            polygon[i].x
      ) {
        isInside = !isInside;
      }
    }
    return isInside;
  }

  pointToSegmentDistance(p, a, b) {
    const l2 = (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.z - a.z);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(
      p.x - (a.x + t * (b.x - a.x)),
      p.z - (a.z + t * (b.z - a.z)),
    );
  }
}

// ===================================
// エリア作成・更新
// ===================================
function createAreas() {
  areaMeshes.forEach((mesh) => {
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
  });
  areaMeshes = [];

  areas.forEach((area) => {
    const mesh = createAreaMesh(area);
    if (mesh) {
      scene.add(mesh);
      areaMeshes.push(mesh);
    }
  });
}

function createAreaMesh(area) {
  if (!area.nodes || area.nodes.length < 2) return null;

  const width = area.width || 4.0;
  const halfWidth = width / 2;
  const y = 0.05;

  // マテリアル決定
  let color = 0x555555;
  if (area.subType === "public_road") color = 0x333333;
  if (area.subType === "campus_walkway") color = 0xaaaaaa;
  if (area.subType === "flat_area") color = 0x8d6e63;

  const material = new THREE.MeshLambertMaterial({
    color: color,
    side: THREE.DoubleSide,
  });

  let geometry;

  if (area.drawMode === "draw_polygon" || area.subType === "flat_area") {
    const shape = new THREE.Shape();
    shape.moveTo(area.nodes[0].x, -area.nodes[0].z);
    for (let i = 1; i < area.nodes.length; i++) {
      shape.lineTo(area.nodes[i].x, -area.nodes[i].z);
    }
    shape.closePath();

    geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
  } else {
    const points = area.nodes.map((n) => new THREE.Vector3(n.x, 0, n.z));

    const vertices = [];
    const indices = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const dir = p2.clone().sub(p1).normalize();
      const normal = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(
        halfWidth,
      );

      const v1 = p1.clone().add(normal);
      const v2 = p1.clone().sub(normal);
      const v3 = p2.clone().add(normal);
      const v4 = p2.clone().sub(normal);

      const baseIndex = vertices.length / 3;
      vertices.push(v1.x, y, v1.z);
      vertices.push(v2.x, y, v2.z);
      vertices.push(v3.x, y, v3.z);
      vertices.push(v4.x, y, v4.z);

      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
    }

    geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { type: "area", id: area.id, object: area };

  // 公道には中心線を追加
  if (area.subType === "public_road") {
    const lineGeo = new THREE.BufferGeometry().setFromPoints(
      area.nodes.map((n) => new THREE.Vector3(n.x, y + 0.01, n.z)),
    );
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(lineGeo, lineMat);
    mesh.add(line);
  }

  return mesh;
}

// ===================================
// エリア選択
// ===================================
function selectArea(area, mesh) {
  if (selectedAreaMesh) {
    if (selectedAreaMesh.material) {
      let color = 0x555555;
      if (selectedArea && selectedArea.subType === "public_road")
        color = 0x333333;
      if (selectedArea && selectedArea.subType === "campus_walkway")
        color = 0xaaaaaa;
      if (selectedArea && selectedArea.subType === "flat_area")
        color = 0x8d6e63;
      selectedAreaMesh.material.color.setHex(color);
      if (selectedAreaMesh.material.emissive)
        selectedAreaMesh.material.emissive.setHex(0x000000);
    }
  }

  selectedArea = area;
  selectedAreaMesh = mesh;

  // UI update
  const roadTools = document.getElementById("road-tools");
  if (roadTools) roadTools.style.display = "none";
  const areaTools = document.getElementById("area-tools");
  if (areaTools) areaTools.style.display = "block";

  selectBuilding(null, null);
  selectRoad(null, null);

  if (area && mesh) {
    updateStatus(`エリアを選択: ${area.id}`);
    if (mesh.material) {
      if (mesh.material.emissive) mesh.material.emissive.setHex(0x444400);
      mesh.material.color.setHex(0xffeb3b);
    }
  }

  updatePropertyPanel();
}
