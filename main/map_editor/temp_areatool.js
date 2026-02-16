// ===================================
// エリアツール制御 (v0.6.0: AreaTool Class)
// ===================================
const AreaTool = {
  PUBLIC: "public_road",
  WALKWAY: "campus_walkway",
  FLAT: "flat_area",
  EDIT: "edit",
  DELETE: "delete",
};
let areaTool;

class AreaToolManager {
  constructor() {
    this.state = "idle"; // idle, dragging
    this.mode = AreaTool.PUBLIC;
    this.startNode = null;
    this.width = 6.0; // デフォルト幅

    // スナップ設定
    this.snapDistance = 2.0;

    // Visuals
    this.cursorMesh = null;
    this.ghostMesh = null;
    this.tooltip = null;
  }

  init() {
    // カーソル（緑の球）
    const cursorGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    this.cursorMesh = new THREE.Mesh(cursorGeo, cursorMat);
    this.cursorMesh.visible = false;
    this.cursorMesh.renderOrder = 999;
    scene.add(this.cursorMesh);

    // ゴーストメッシュ
    const ghostGeo = new THREE.BufferGeometry();
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x4caf50,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    this.ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    this.ghostMesh.visible = false;
    this.ghostMesh.renderOrder = 1;
    scene.add(this.ghostMesh);

    // ツールチップ
    this.tooltip = document.createElement("div");
    this.tooltip.id = "area-tooltip";
    Object.assign(this.tooltip.style, {
      position: "absolute",
      backgroundColor: "rgba(0,0,0,0.8)",
      color: "#4caf50",
      padding: "6px 10px",
      borderRadius: "4px",
      fontSize: "12px",
      pointerEvents: "none",
      display: "none",
      zIndex: "1000",
      whiteSpace: "pre-line",
      fontFamily: "monospace",
      border: "1px solid #4caf50",
    });
    document.body.appendChild(this.tooltip);
  }

  setMode(mode) {
    this.mode = mode;
    this.resetState();

    // UI更新
    document
      .querySelectorAll("#area-tools .btn-tool")
      .forEach((b) => b.classList.remove("active"));
    const btnIdMap = {
      [AreaTool.PUBLIC]: "btn-area-public",
      [AreaTool.WALKWAY]: "btn-area-walkway",
      [AreaTool.FLAT]: "btn-area-flat",
      [AreaTool.EDIT]: "btn-area-edit",
      [AreaTool.DELETE]: "btn-area-delete",
    };
    const btn = document.getElementById(btnIdMap[mode]);
    if (btn) btn.classList.add("active");

    const desc = document.getElementById("area-tool-desc");
    if (desc) {
      if (mode === AreaTool.PUBLIC)
        desc.innerHTML =
          "公道: 車道(白線あり)を作成します。<br>クリックで地点追加、右クリックで完了。";
      if (mode === AreaTool.WALKWAY)
        desc.innerHTML =
          "通路: 歩行者用通路を作成します。<br>クリックで地点追加、右クリックで完了。";
      if (mode === AreaTool.FLAT)
        desc.innerHTML =
          "広場: 自由な多角形エリアを作成します。<br>クリックで頂点追加、始点クリックで完了。";
      if (mode === AreaTool.EDIT)
        desc.innerHTML = "編集: エリアを選択して頂点移動や幅変更を行います。";
      if (mode === AreaTool.DELETE)
        desc.innerHTML = "削除: エリアをクリックして削除します。";
    }

    if (mode === AreaTool.EDIT || mode === AreaTool.DELETE) {
      this.cursorMesh.visible = false;
      this.tooltip.style.display = "none";
    }
  }

  resetState() {
    this.state = "idle";
    this.startNode = null;
    if (this.ghostMesh) this.ghostMesh.visible = false;
    if (this.cursorMesh) this.cursorMesh.visible = false;
    if (this.tooltip) this.tooltip.style.display = "none";
  }

  handleEvent(type, event) {
    if (this.mode === AreaTool.EDIT) return false;

    if (type === "pointermove") {
      this.onPointerMove(event);
      return true;
    }
    if (type === "click") {
      this.onClick(event);
      return true;
    }
    if (type === "contextmenu") {
      this.onRightClick(event);
      return true;
    }
    return false;
  }

  onPointerMove(event) {
    // 簡易実装: カーソル移動のみ
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const m = new THREE.Vector2(
      ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1,
      -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1,
    );
    raycaster.setFromCamera(m, camera);
    const ground = scene.getObjectByName("ground");
    if (!ground) return;

    const intersects = raycaster.intersectObject(ground);
    if (intersects.length > 0) {
      const p = intersects[0].point;
      // グリッドスナップ
      if (snapEnabled) {
        p.x = Math.round(p.x / snapSize) * snapSize;
        p.z = Math.round(p.z / snapSize) * snapSize;
      }
      this.cursorMesh.position.set(p.x, 0, p.z);
      this.cursorMesh.visible = true;

      // ツールチップ
      const screenPos = roadTool.toScreenPosition(p.x, 0, p.z); // RoadToolのヘルパー拝借
      this.tooltip.style.left = screenPos.x + 20 + "px";
      this.tooltip.style.top = screenPos.y + 20 + "px";
      this.tooltip.style.display = "block";
      this.tooltip.innerText = `Area Tool: ${Math.round(p.x)}, ${Math.round(p.z)}`;
    }
  }

  onClick(event) {
    // まだロジックなし
    // 将来的にはここでノード追加 -> createAreas() 呼び出し
    console.log("Area Click");
  }

  onRightClick(event) {
    event.preventDefault();
    this.resetState();
  }
}
