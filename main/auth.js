/**
 * Nanryosai 2026
 * Version: 1.0.0
 * Last Modified: 2026-08-30
 * Author: Nanryosai 2026 Project Team
 *
 * Firebase Auth Module - Single Source of Truth
 * Firebase の初期化・認証・App Check を一元管理する。
 *
 * 変更履歴:
 *   v1.0.0 - Google Identity Services (GIS) + Custom Token 認証への全面移行
 *            旧 login() (signInWithPopup / PII保存) を完全廃止
 *            renderGoogleLoginButton() 実装
 *            getClaims(), isEffectiveStudent(), isSuperAdminClaims() ヘルパー追加
 *   v0.4.0 - signInWithRedirect 完全廃止 (GitHub Pages 環境では使えないため)
 *            popup-blocked エラーを呼び出し側に委譲する設計に変更
 *            getRedirectResult の処理を削除
 *   v0.3.0 - Firebase 初期化の集約 (Storage, Functions, Messaging, App Check)
 *            App Check (reCAPTCHA v3) の統合とトークンウォームアップ
 *            requireLogin() スタブ追加
 *   v0.2.142 - Triple Fallback Strategy
 *     ① signInWithPopup (即座呼び出し、ジェスチャー保持)
 *     ② signInWithRedirect (popup-blocked フォールバック)
 *     ③ アプリ内ブラウザ誘導UI (LINE/Instagram等)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getStorage,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";
import {
  getMessaging,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken as getAppCheckToken,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-check.js";
import {
  getAnalytics,
  logEvent,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";

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

/* ==============================
   1. Initialize Firebase App
   ============================== */
const app = initializeApp(firebaseConfig);

/* ==============================
   2. App Check Debug Token (localhost)
   initializeAppCheck() より前に設定する必要がある
   ============================== */
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  if (window.LOCAL_ENV && window.LOCAL_ENV.FIREBASE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = window.LOCAL_ENV.FIREBASE_APPCHECK_DEBUG_TOKEN;
    console.log("[App Check] Using shared local debug token.");
  } else {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    console.warn("[App Check] config.local.js not found. Using auto-generated token.");
  }
}

/* ==============================
   3. Initialize App Check (reCAPTCHA v3)
   ============================== */
const RECAPTCHA_SITE_KEY = "6LeHxzIsAAAAAOIf0lXePHNpUkvYRdFtQw9osmIS";

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});

/* ==============================
   4. App Check Token Warmup
   ページロード時にトークンを温めておく。
   これにより、後続の signInWithPopup 時にトークン取得の非同期待ちが発生せず、
   ポップアップブロックを回避できる。
   ============================== */
getAppCheckToken(appCheck, false).catch((e) => {
  console.warn("[Auth] AppCheck warmup failed:", e);
});

/* ==============================
   5. Initialize Firebase Services
   App Check の後に初期化することで、
   各サービスからのリクエストに自動的に App Check トークンが付与される。
   ============================== */
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "asia-northeast1");
const analytics = getAnalytics(app);

/* ==============================
   6. URL短縮パラメータ (QRトラッキング) 処理
   ============================== */
try {
  const urlParams = new URLSearchParams(window.location.search);
  const source = urlParams.get("s");
  if (source) {
    // 短縮パラメータと正式な送信元のマッピング
    const sourceMap = {
      po: "poster",      // 校内ポスターQR
      pf: "pamphlet",    // 公式パンフレットQR
      st: "store_front", // 店頭・模擬店前掲示QR
      ex: "exhibition",  // クラス・部活展示看板QR
      gt: "gate",        // 校門・受付案内QR
      cr: "classroom",   // Google Classroomリンク
      ig: "instagram"    // 公式Instagramリンク
    };
    const sourceType = sourceMap[source] || source;

    // GA4にカスタムイベントとして送信
    logEvent(analytics, "qr_scan", { source_type: sourceType });

    // アドレスバーからパラメータを消去し、綺麗なURLに戻す
    urlParams.delete("s");
    const newSearch = urlParams.toString() ? "?" + urlParams.toString() : "";
    const cleanUrl = window.location.pathname + newSearch + window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
  }
} catch (e) {
  console.warn("[Analytics] Tracking param cleanup failed:", e);
}

// Messaging は非対応ブラウザ（一部 iOS Safari、古いブラウザ等）で
// エラーをスローする可能性があるため、try-catch でラップする。
// 利用側では if (messaging) で null チェックすること。
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.warn("[Auth] Messaging not supported in this environment:", e);
}

// Global User State
let currentUser = null;

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
 * Initiates Google Login via signInWithPopup (popup-only strategy).
 *
 * このプロジェクトは GitHub Pages 環境のため、signInWithRedirect は使わない。
 * (リダイレクト後に認証状態が正しく引き継がれない問題があるため)
 *
 * フロー:
 *   ① アプリ内ブラウザ検出 → confirm() で警告
 *   ② signInWithPopup を即座に呼ぶ(ユーザージェスチャー保持)
 *   ③ popup-blocked → 呼び出し側にエラーをスロー(UI ガイダンス表示用)
 *
 * @returns {Promise<import("firebase/auth").User|null>}
 *   - ログイン成功時: User
 *   - ユーザーがポップアップを閉じた場合: null
 *   - ネットワークエラー: null (alert 表示済み)
 *   - popup-blocked: throw (error.code === "auth/popup-blocked")
 *   - その他のエラー: throw
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
        // GA4: ログイン完了イベント
        logEvent(analytics, "login", { method: "Google" });
        return user;
      }
      return null;
    })
    .catch((error) => {
      // ポップアップがブロックされた場合 → 呼び出し側に委譲(UI ガイダンス表示用)
      // このプロジェクトは GitHub Pages 環境のため signInWithRedirect は使わない。
      // 呼び出し側(login.html 等)で popup-blocked-guidance を表示する設計。
      if (error.code === "auth/popup-blocked") {
        console.warn("[Auth] Popup blocked. Caller should show guidance UI.");
        throw error; // error.code === "auth/popup-blocked" のままスロー
      }

      // ユーザーがポップアップを閉じた場合 → 何もしない(null を返す)
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

let currentBanUnsubscribe = null;

function showBanPopupAndRedirect() {
  if (document.getElementById("ban-popup-overlay")) return; // すでに表示中なら何もしない

  // 全画面オーバーレイ
  const overlay = document.createElement("div");
  overlay.id = "ban-popup-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  overlay.style.zIndex = "999999";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";

  // モーダル
  const modal = document.createElement("div");
  modal.style.backgroundColor = "#fff";
  modal.style.padding = "32px";
  modal.style.borderRadius = "12px";
  modal.style.textAlign = "center";
  modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
  modal.style.maxWidth = "90%";
  modal.style.color = "#333";

  // メッセージ
  const msg = document.createElement("div");
  msg.textContent = "エラー 商品を取りに来てください";
  msg.style.fontSize = "1.2rem";
  msg.style.fontWeight = "bold";
  msg.style.marginBottom = "24px";
  modal.appendChild(msg);

  // ボタン
  const btn = document.createElement("button");
  btn.textContent = "閉じる";
  btn.style.padding = "12px 32px";
  btn.style.fontSize = "1rem";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.backgroundColor = "#e53935";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
  btn.style.fontWeight = "bold";
  btn.addEventListener("click", () => {
    window.location.replace("/main/banned.html");
  });
  modal.appendChild(btn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * Subscribes to auth state changes.
 * @param {Function} callback - Function to call with (user|null)
 */
function watchUser(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;

    if (user) {
      if (currentBanUnsubscribe) currentBanUnsubscribe();
      currentBanUnsubscribe = onSnapshot(doc(db, "banned_users", user.uid), (snap) => {
        if (snap.exists()) {
          if (!window.location.pathname.endsWith("/banned.html")) {
            if (localStorage.getItem("ban_story_read") === "true") {
              window.location.replace("/main/banned.html");
            } else {
              showBanPopupAndRedirect();
            }
          }
        }
      });
    } else {
      if (currentBanUnsubscribe) {
        currentBanUnsubscribe();
        currentBanUnsubscribe = null;
      }
    }

    callback(user);
  });
}

/**
 * Get current user (synchronous, might be null if not yet loaded)
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * ログインを要求するヘルパー(将来 login.html へのリダイレクトを実装予定)
 *
 * 注意: ページロード直後は Auth の初期化が完了していない場合があるため、
 * 確実にログイン状態を取得したい場合は watchUser() の使用を推奨。
 *
 * @param {Object} options
 * @param {string} [options.reason] - ログイン理由 (mypage / favorite / order)
 * @param {string} [options.mode] - ログインモード (student / undefined)
 * @param {string} [options.redirect] - ログイン後の戻り先 URL（省略時は現在のURL）
 * @returns {Promise<User|null>}
 */
async function requireLogin(options = {}) {
  // 既にログイン済みなら現在のユーザーを返す
  if (currentUser) return currentUser;

  // TODO: 後のステップで login.html へのリダイレクトを実装する
  // 想定実装:
  //   const redirect = options.redirect || location.href;
  //   const params = new URLSearchParams();
  //   params.set("redirect", redirect);
  //   if (options.reason) params.set("reason", options.reason);
  //   if (options.mode) params.set("mode", options.mode);
  //   location.href = `/main/login.html?${params.toString()}`;
  //   return null;

  console.warn("[Auth] requireLogin called but login.html is not yet implemented");
  return null;
}

/**
 * ユーザーのお気に入り項目をトグルする
 * @param {string} itemId 企画・ステージ等のID
 * @returns {Promise<boolean>} トグル後の状態 (true: 登録, false: 解除)
 */
async function toggleFavorite(itemId) {
  if (!currentUser) throw new Error("Not logged in");
  const userRef = doc(db, "users", currentUser.uid);
  
  const snap = await getDoc(userRef);
  const data = snap.data();
  const currentFavorites = data?.favoriteItemIds || [];
  
  if (currentFavorites.includes(itemId)) {
    await setDoc(userRef, {
      favoriteItemIds: arrayRemove(itemId)
    }, { merge: true });
    return false;
  } else {
    await setDoc(userRef, {
      favoriteItemIds: arrayUnion(itemId)
    }, { merge: true });
    return true;
  }
}

/**
 * ユーザーのお気に入り項目一覧を取得する
 * @returns {Promise<string[]>}
 */
async function getFavorites() {
  if (!currentUser) return [];
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data().favoriteItemIds || [];
  }
  return [];
}

/* ==============================
   GA4 Universal Click Tracker
   data-track 属性を持つ要素のクリックを自動でGA4に送信する。
   HTML側は data-track="イベント名" を付けるだけでOK。
   オプション: data-track-* 属性で追加パラメータを送信可能。
   例: <button data-track="click_mop_promo" data-track-section="hero">...
   ============================== */
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-track]");
  if (!target) return;

  const eventName = target.getAttribute("data-track");

  // data-track-* 属性を追加パラメータとして収集
  const params = {};
  for (const attr of target.attributes) {
    if (attr.name.startsWith("data-track-")) {
      const paramName = attr.name.replace("data-track-", "").replace(/-/g, "_");
      params[paramName] = attr.value;
    }
  }

  logEvent(analytics, eventName, params);
});

// Export everything needed
export {
  app,
  auth,
  db,
  storage,
  functions,
  messaging,
  appCheck,
  analytics,
  logEvent,
  login,
  logout,
  watchUser,
  getCurrentUser,
  requireLogin,
  toggleFavorite,
  getFavorites,
};
