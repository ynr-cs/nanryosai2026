/**
 * scripts/grantSuperAdmin.js
 * 
 * スーパー管理者権限(identity: "super_admin")を直接付与するフェイルセーフスクリプト。
 * 
 * 実行方法:
 *   node scripts/grantSuperAdmin.js <uid>
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

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/grantSuperAdmin.js <uid>");
  process.exit(1);
}

(async () => {
  try {
    const user = await admin.auth().getUser(uid);
    const currentClaims = user.customClaims || {};
    const newClaims = { ...currentClaims, identity: "super_admin" };
    await admin.auth().setCustomUserClaims(uid, newClaims);
    console.log(`OK: ${uid} に identity=super_admin を付与しました。`);
    console.log("現在のClaims:", JSON.stringify(newClaims, null, 2));
  } catch (err) {
    console.error("grantSuperAdmin failed:", err);
    process.exit(1);
  }
})();
