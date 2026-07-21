import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  authDomain: "nanryosai-2026.firebaseapp.com",
  projectId: "nanryosai-2026",
  storageBucket: "nanryosai-2026.firebasestorage.app",
  messagingSenderId: "36724338483",
  appId: "1:36724338483:web:5316dbb690740a167ac364",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const snap = await getDocs(collection(db, "items"));
  snap.forEach(doc => {
    console.log(`ID: ${doc.id}, Name: ${doc.data().name}`);
  });
  process.exit(0);
}
main();
