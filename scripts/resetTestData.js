/**
 * scripts/resetTestData.js
 * 
 * 開発・テスト用の Firestore 注文データ、ユーザーデータ、カウンター、BANデータを
 * 一括削除・リセットするスクリプト。
 * 
 * 実行方法:
 *   node scripts/resetTestData.js
 * 
 * 前提条件:
 *   scripts/serviceAccountKey.json (または環境変数 GOOGLE_APPLICATION_CREDENTIALS) が必要です。
 *   ※ serviceAccountKey がない場合、デフォルト認証（gcloud / ADC）を使用します。
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

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  try {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
      resolve();
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
      deleteQueryBatch(query, resolve, reject);
    });
  } catch (err) {
    reject(err);
  }
}

async function runReset() {
  const targetCollections = ["orders", "users", "counters", "banned_users"];
  console.log("Starting Firestore test data reset...");

  for (const col of targetCollections) {
    process.stdout.write(`Deleting '${col}' collection... `);
    try {
      await deleteCollection(col);
      console.log("DONE");
    } catch (err) {
      console.log("FAILED:", err.message);
    }
  }

  console.log("Firestore test data reset complete!");
}

runReset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset script fatal error:", err);
    process.exit(1);
  });
