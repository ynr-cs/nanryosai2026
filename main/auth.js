/**
 * Nanryosai 2026
 * Version: 0.2.142
 * Last Modified: 2026-04-27
 * Author: Nanryosai 2026 Project Team
 *
 * Firebase Auth Module - Triple Fallback Strategy
 * ① signInWithPopup (即座呼び出し、ジェスチャー保持)
 * ② signInWithRedirect (popup-blocked フォールバック)
 * ③ アプリ内ブラウザ誘導UI (LINE/Instagram等)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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

/**
 * Handle Redirect Login Result (フォールバック用)
 * signInWithRedirect でフォールバックした場合にのみ結果が返る。
 * signInWithPopup でログインした場合は null が返る（正常）。
 */
getRedirectResult(auth)
  .then(async (result) => {
    if (result && result.user) {
      const user = result.user;
      console.log("[Auth] Redirect login success:", user.email);
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
    // auth/popup-closed-by-user は無視（ユーザーが閉じた場合）
    if (error.code === "auth/popup-closed-by-user") return;
    console.error("Redirect login failed:", error);
  });

/**
 * アプリ内ブラウザを検出する
 * @returns {boolean} アプリ内ブラウザの場合 true
 */
function detectInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return (
    ua.indexOf("FBAN") > -1 ||
    ua.indexOf("FBAV") > -1 ||
    ua.indexOf("Instagram") > -1 ||
    ua.indexOf("Line/") > -1 ||
    ua.indexOf("LINE/") > -1 ||
    (ua.indexOf("wv") > -1 && ua.indexOf("Android") > -1) // Android WebView
  );
}

/**
 * Initiates Google Login via Triple Fallback Strategy.
 *
 * ① signInWithPopup（即座呼び出し、非同期ギャップなし）
 * ② popup-blocked → signInWithRedirect にフォールバック
 * ③ アプリ内ブラウザ → 外部ブラウザ誘導UIを表示
 *
 * @returns {Promise<import("firebase/auth").User|null>} ログイン成功時は User、それ以外は null
 */
function login() {
  // 1. アプリ内ブラウザ検出 → 警告表示（ログインは試行させる）
  if (detectInAppBrowser()) {
    const proceed = confirm(
      "⚠️ アプリ内ブラウザが検出されました\n\n" +
      "LINEやInstagramのアプリ内ブラウザでは、ログインに失敗する場合があります。\n\n" +
      "【推奨】右上の「…」メニュー → 「ブラウザで開く」で標準ブラウザに切り替えてください。\n\n" +
      "このまま続行しますか？"
    );
    if (!proceed) return Promise.resolve(null);
  }

  // 2. Provider を先に準備
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // 3. 即座に signInWithPopup を呼ぶ（await/async なし＝ユーザージェスチャー保持）
  //    ※ この関数自体を async にしないことで、ポップアップブロックを回避
  return signInWithPopup(auth, provider)
    .then(async (result) => {
      if (result && result.user) {
        const user = result.user;
        console.log("[Auth] Popup login success:", user.email);
        // Firestore にユーザープロファイルを保存
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
        return user;
      }
      return null;
    })
    .catch(async (error) => {
      // ポップアップがブロックされた場合 → リダイレクトにフォールバック
      if (error.code === "auth/popup-blocked") {
        console.warn("[Auth] Popup blocked, falling back to redirect...");
        try {
          await signInWithRedirect(auth, provider);
          // リダイレクト後はページが再読み込みされるため、ここには戻らない
        } catch (redirectError) {
          console.error("[Auth] Redirect fallback failed:", redirectError);
          alert("ログインに失敗しました。ブラウザの設定でポップアップを許可するか、標準ブラウザで開いてください。");
        }
        return null;
      }

      // ユーザーがポップアップを閉じた場合 → 何もしない
      if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
        console.log("[Auth] User cancelled popup");
        return null;
      }

      // ネットワークエラー
      if (error.code === "auth/network-request-failed") {
        alert("ネットワークエラーが発生しました。通信環境を確認して再度お試しください。");
        return null;
      }

      // その他のエラー
      console.error("[Auth] Login failed:", error);
      alert("ログインエラー: " + error.message);
      throw error;
    });
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
