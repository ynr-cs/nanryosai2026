/**
 * Nanryosai 2026
 * Version: 0.1.0
 * Last Modified: 2026-02-05
 * Author: Nanryosai 2026 Project Team
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

/* ==============================
   Firebase Configuration
   (Shared with Mobile Order)
   ============================== */
const firebaseConfig = {
  apiKey: "AIzaSyA-Ijkbo-9rgrNKbDlRJ-rQVYdSXR_a9Do",
  authDomain: "nanryosai-2026-a4091.firebaseapp.com",
  projectId: "nanryosai-2026-a4091",
  storageBucket: "nanryosai-2026-a4091.firebasestorage.app",
  messagingSenderId: "93228414556",
  appId: "1:93228414556:web:f64f90c13849fae9049899",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global User State
let currentUser = null;

// Handle Redirect Login Result
getRedirectResult(auth)
  .then(async (result) => {
    if (result && result.user) {
      const user = result.user;
      // Save/Update user profile in Firestore
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          lastLogin: serverTimestamp(),
        },
        { merge: true },
      );
    }
  })
  .catch((error) => {
    console.error("Redirect login failed:", error);
    if (error.code === "auth/network-request-failed") {
      alert("ネットワークエラーが発生しました。通信環境を確認して再度お試しください。");
    } else if (error.code === "auth/internal-error") {
      alert("認証サーバーでエラーが発生しました。しばらく時間を置いてから再度お試しください。");
    } else {
      alert("ログインエラー: " + error.message);
    }
  });

/**
 * Initiates Google Login via Redirect using GoogleAuthProvider.
 * Includes In-App Browser detection to warn users.
 */
async function login() {
  // 1. Detect In-App Browsers (LINE, Instagram, Facebook, etc.)
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isInApp =
    ua.indexOf("FBAN") > -1 ||
    ua.indexOf("FBAV") > -1 ||
    ua.indexOf("Instagram") > -1 ||
    ua.indexOf("Line") > -1;

  if (isInApp) {
    alert(
      "⚠️ 注意: アプリ内ブラウザではログインが正常に動作しない場合があります。\n\nもしログインできない場合は、右上のメニューから「ブラウザで開く」を選択してください。",
    );
  }

  try {
    const provider = new GoogleAuthProvider();

    // Force account selection to avoid "auto-login loop" confusion
    provider.setCustomParameters({
      prompt: "select_account",
    });

    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error("Login trigger failed:", error);
    alert("ログイン画面への遷移に失敗しました。");
    throw error;
  }
}

/**
 * Logs out the current user
 */
async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

/**
 * Subscribes to auth state changes.
 * @param {Function} callback - Function to call with (user|null)
 */
function watchUser(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
}

/**
 * Get current user (synchronous, might be null if not yet loaded)
 */
function getCurrentUser() {
  return currentUser;
}

// Export everything needed
export { app, auth, db, login, logout, watchUser, getCurrentUser };
