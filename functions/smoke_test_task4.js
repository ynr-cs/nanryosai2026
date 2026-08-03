const admin = require("firebase-admin");
admin.initializeApp({ projectId: "nanryosai-2026-a4091" });
const db = admin.firestore();

async function runTest() {
  const storeId = "_smoketest";
  
  // 1. SOK仮注文を作成 (status: null)
  const sokOrderRef = db.collection("orders").doc("test_sok_order");
  await sokOrderRef.set({
    storeId,
    orderChannel: "sok",
    status: null,
    totalPrice: 1500,
    items: [
      { name: "テスト商品", quantity: 1 }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("Created SOK provisional order: test_sok_order");

  // 2. 通常の注文を作成（カスタマイズ付き＆インジェクション文字）
  const posOrderRef = db.collection("orders").doc("test_pos_order");
  await posOrderRef.set({
    storeId,
    orderChannel: "pos",
    status: "cooking",
    receiptNumber: "P-101",
    totalPrice: 2000,
    items: [
      { 
        name: "焼きそば", 
        quantity: 2,
        customizations: [
          { mode: "NO", target: "紅生姜" },
          { mode: "ADD", target: "マヨネーズ" }
        ]
      },
      {
        name: "=IMPORTDATA(\"https://example.com\")",
        quantity: 1
      }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("Created POS order: test_pos_order");
  
  console.log("Wait for 70 seconds to allow syncOrdersToSheets to run...");
  await new Promise(r => setTimeout(r, 70000));
  
  // 3. Update status (cooking -> ready_to_serve)
  await posOrderRef.update({
    status: "ready_to_serve",
    readyToServeAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("Updated POS order to ready_to_serve");
  
  console.log("Wait for 70 seconds to allow syncOrdersToSheets to run...");
  await new Promise(r => setTimeout(r, 70000));
  
  // 4. Update status (ready_to_serve -> completed)
  await posOrderRef.update({
    status: "completed",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("Updated POS order to completed");

  console.log("Wait for 70 seconds to allow syncOrdersToSheets to run...");
  await new Promise(r => setTimeout(r, 70000));
  
  // 5. Check failures and cursor
  const cursorDoc = await db.collection("sheet_sync_meta").doc("cursor").get();
  console.log("Cursor lastRunAt:", cursorDoc.data()?.lastRunAt?.toDate());
  
  const failuresSnap = await db.collection("sheet_sync_failures").get();
  console.log("Failures count:", failuresSnap.size);
  failuresSnap.forEach(d => console.log("Failure:", d.data()));
  
  console.log("Since local ADC is not available, please verify the actual sheet contents for `_smoketest` yourself.");
}

runTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
