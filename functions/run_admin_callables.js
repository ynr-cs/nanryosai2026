const admin = require("firebase-admin");
const { reinitSheetHeaders, rebuildStoreSheet } = require("./index.js");

// Mock context
const context = {
  auth: { token: { email: "ynrcs1000@gmail.com" } }
};

async function run() {
  console.log("Running reinitSheetHeaders...");
  const res = await reinitSheetHeaders({ data: {} }, context);
  console.log("reinitSheetHeaders result:", res);

  console.log("Running rebuildStoreSheet...");
  const res2 = await rebuildStoreSheet({ data: { storeId: "_smoketest" } }, context);
  console.log("rebuildStoreSheet result:", res2);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
