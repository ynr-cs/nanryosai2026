import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Helper logging
const log = (msg) => console.log(`[DEBUG] ${msg}`);

// Firebase Config (from existing code)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_PLACEHOLDER_IF_NEEDED", // Assuming env or default auth works for public read if rules allow, or we use existing auth
  authDomain: "nanryosai-2026.firebaseapp.com",
  projectId: "nanryosai-2026",
  storageBucket: "nanryosai-2026.firebasestorage.app",
  messagingSenderId: "36724338483",
  appId: "1:36724338483:web:5316dbb690740a167ac364",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStore(collectionName, docId) {
  try {
    const ref = doc(db, collectionName, docId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      console.log(`\n--- Collection: ${collectionName} | Doc: ${docId} ---`);
      console.log(JSON.stringify(snap.data(), null, 2));
    } else {
      console.log(`\n--- Collection: ${collectionName} | Doc: ${docId} ---`);
      console.log("(Document does not exist)");
    }
  } catch (e) {
    console.error(`Error fetching ${collectionName}/${docId}:`, e.message);
  }
}

async function main() {
  log("Checking store 101...");
  await checkStore("stores", "101");
  await checkStore("stores_test", "101");
  log("Check complete.");
  process.exit(0);
}

main();
