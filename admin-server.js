const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 3001;

// JSONボディの解析を有効化（サイズ制限を設けるのが一般的ですが、マスタデータなので少し余裕を持たせます）
app.use(express.json({ limit: "10mb" }));

// mainディレクトリを静的ファイルとして配信（キャッシュ無効化）
app.use(
  express.static(path.join(__dirname, "main"), {
    setHeaders: (res, path) => {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  }),
);

// data.js 保存用API
app.post("/api/save-data", (req, res) => {
  try {
    const { projectData, stageData } = req.body;
    console.log("RECEIVED BODY VERSION:", req.body.version);

    if (!projectData) {
      return res.status(400).json({ error: "projectData is required" });
    }

    const filePath = path.join(__dirname, "main", "data", "data.js");
    const jsonData = JSON.stringify(projectData, null, 2);
    let dataVersion = req.body.version;
    if (!dataVersion) {
      console.log("⚠️ req.body.version is MISSING or FALSY. Using Date.now().");
      dataVersion = Date.now().toString();
    } else {
      console.log("✅ Using provided version:", dataVersion);
    }

    // stageDataの安全化（リクエスト優先、未指定・空なら既存data.jsから抽出して保持）
    let stageDataString = "[]";
    if (Array.isArray(stageData) && stageData.length > 0) {
      stageDataString = JSON.stringify(stageData, null, 2);
      console.log(`✅ Using provided stageData (${stageData.length} items)`);
    } else if (fs.existsSync(filePath)) {
      try {
        const existingContent = fs.readFileSync(filePath, "utf8");
        const match = existingContent.match(/(?:const|let|var)\s+stageData\s*=\s*(\[[\s\S]*?\]);/);
        if (match && match[1].trim() !== "[]") {
          stageDataString = match[1];
          console.log("✅ Preserved existing stageData from data.js");
        }
      } catch (readErr) {
        console.warn("⚠️ Failed to read existing stageData from data.js:", readErr);
      }
    }

    const fileContent = `/**
 * Nanryosai 2026
 * Version: 0.1.0
 * Last Modified: ${new Date().toISOString().split("T")[0]}
 * Author: Nanryosai 2026 Project Team (Auto-generated)
 */
// =======================================================
// ★★★ 2026年度南陵祭 公式企画データ (Synced from Firebase/Admin) ★★★
// =======================================================

console.log("data.js loading...");

// バージョン情報 (admin_syncで同期状態を確認するために使用)
const dataVersion = "${dataVersion}";

// 企画の名簿データ
const projectData = ${jsonData};

// ステージデータ (出演スケジュール)
const stageData = ${stageDataString};

console.log("data.js loaded: projectData count =", projectData.length, "version =", dataVersion);
console.log("data.js loaded: stageData count =", stageData.length);

// グローバルアクセス用に window オブジェクトに紐付け
window.projectData = projectData;
window.stageData = stageData;
`;

    fs.writeFileSync(filePath, fileContent, "utf8");

    console.log(
      `[Admin Server] Successfully saved data.js at ${new Date().toLocaleTimeString()}`,
    );
    res.json({ message: "Success: data.js updated locally." });
  } catch (error) {
    console.error("[Admin Server] Save Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`
==================================================
 南陵祭'26 管理用ローカルサーバー
 Running at: http://localhost:${port}/admin_sync.html
==================================================
`);
});
