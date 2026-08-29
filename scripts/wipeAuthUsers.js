/**
 * scripts/wipeAuthUsers.js
 * 
 * Firebase Auth の全ユーザーを一括削除するスクリプト。
 * V4移行時のデータリセット用。
 * 
 * 実行方法:
 *   node scripts/wipeAuthUsers.js
 * 
 * 前提条件:
 *   scripts/serviceAccountKey.json (または環境変数 GOOGLE_APPLICATION_CREDENTIALS) が必要です。
 */
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} else {
  admin.initializeApp();
}

async function wipeAll(nextPageToken) {
  const page = await admin.auth().listUsers(1000, nextPageToken);
  const uids = page.users.map((u) => u.uid);
  if (uids.length > 0) {
    const deleteResult = await admin.auth().deleteUsers(uids);
    console.log(`Deleted ${deleteResult.successCount} users (errors: ${deleteResult.failureCount})`);
  }
  if (page.pageToken) {
    await wipeAll(page.pageToken);
  }
}

console.log("Starting Auth users wipeout...");
wipeAll()
  .then(() => console.log("Auth users wipeout complete."))
  .catch((err) => {
    console.error("Wipeout failed:", err);
    process.exit(1);
  });
