/**
 * Nanryosai 2026
 * Version: 0.5.143
 * Last Modified: 2026-09-01
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
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
  logEvent as firebaseLogEvent,
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
  measurementId: "G-1M5G95EXF0",
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
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = "a4eb006d-0867-45dc-b9f5-8026de0b17a0";
    console.log("[App Check] Using registered fallback debug token.");
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
// Firestore with IndexedDB Persistence (Multi-tab support)
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (e) {
  console.warn("[Auth] Firestore persistence initialization fallback:", e);
  db = getFirestore(app);
}
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

const OAUTH_CLIENT_ID =
  "93228414556-tm81uv1jir0hd9ofc4kooq3kr49mpc00.apps.googleusercontent.com";

/**
 * SHA-256 ハッシュを計算して 16進数文字列で返す
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * GISボタンを指定コンテナに描画する。
 * @param {HTMLElement} container ボタンを置く要素
 * @param {(result:{user: import("firebase/auth").User, identity:string})=>void} [onSuccess]
 * @param {(error:Error)=>void} [onError]
 * @param {()=>void} [onStart] 認証処理開始時（ポップアップ選択直後）のコールバック
 */
async function renderGoogleLoginButton(container, onSuccess, onError, onStart) {
  const rawNonce = crypto.randomUUID();
  sessionStorage.setItem("gis_nonce", rawNonce);
  const hashedNonce = await sha256hex(rawNonce);

  if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    const err = new Error("Google Identity Services is not loaded.");
    console.error("[Auth]", err);
    if (onError) onError(err);
    return;
  }

  google.accounts.id.initialize({
    client_id: OAUTH_CLIENT_ID,
    nonce: hashedNonce,
    ux_mode: "popup",
    auto_select: false,
    use_fedcm_for_button: false,
    callback: async (response) => {
      if (onStart) onStart();
      try {
        const authFn = httpsCallable(functions, "authenticateWithGoogle");
        const result = await authFn({
          idToken: response.credential,
          nonce: sessionStorage.getItem("gis_nonce"),
        });
        const { customToken, identity } = result.data;
        const cred = await signInWithCustomToken(auth, customToken);
        await cred.user.getIdToken(true);
        console.log("[Auth] Login success. identity:", identity);
        logEvent(analytics, "login", { method: "Google" });
        if (onSuccess) onSuccess({ user: cred.user, identity });
      } catch (e) {
        console.error("[Auth] Login failed:", e.code || e.name || e.message);
        if (onError) onError(e);
      }
    },
  });
  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    logo_alignment: "left",
    width: Math.min(container.clientWidth || 280, 320),
  });
}

/** IDトークンの claims を取得(forceRefresh 指定可) */
async function getClaims(force = false) {
  const u = auth.currentUser;
  if (!u) return null;
  return (await u.getIdTokenResult(force)).claims;
}

function isEffectiveStudent(claims) {
  return (
    !!claims &&
    (claims.identity === "student" ||
      claims.identityOverride === "student" ||
      claims.identity === "super_admin")
  );
}

function isSuperAdminClaims(claims) {
  return !!claims && claims.identity === "super_admin";
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
    const bannedUrl = new URL("./banned.html", import.meta.url).href;
    window.location.replace(bannedUrl);
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
            const bannedUrl = new URL("./banned.html", import.meta.url).href;
            if (localStorage.getItem("ban_story_read") === "true") {
              window.location.replace(bannedUrl);
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

  const redirect = options.redirect || (window.location.pathname + window.location.search);
  const params = new URLSearchParams();
  params.set("redirect", redirect);
  if (options.reason) params.set("reason", options.reason);
  if (options.mode) params.set("mode", options.mode);

  // 相対パスで login.html へ安全に遷移（main/ 内または pos/ 内からのアクセスに対応）
  const isPos = window.location.pathname.includes("/pos/");
  const loginPath = isPos ? "../main/login.html" : "./login.html";
  window.location.href = `${loginPath}?${params.toString()}`;
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
   GA4 Universal Analytics & Big Data Tracking System
   全イベントへの自動メタデータ付与（端末・環境・ネットワーク・セッション）
   および自動エンゲージメント計測（有効滞在時間、スクロール深度、通信検知、コピー検知）
   ============================== */

// 1. Session ID Management (sessionStorage)
function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem("nanryo_sid");
    if (!sid) {
      sid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID().slice(0, 18)
        : (Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8));
      sessionStorage.setItem("nanryo_sid", sid);
    }
    return sid;
  } catch (e) {
    return "unknown";
  }
}

// 2. Client Environment Detection
function detectEnvironment() {
  try {
    const ua = navigator.userAgent || "";
    let os = "other";
    if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Win/i.test(ua)) os = "Windows";
    else if (/Mac/i.test(ua)) os = "macOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    let browser = "other";
    if (/Line\//i.test(ua)) browser = "LINE";
    else if (/Instagram/i.test(ua)) browser = "Instagram";
    else if (/Twitter|Twitter for/i.test(ua)) browser = "Twitter";
    else if (/Edg/i.test(ua)) browser = "Edge";
    else if (/Chrome|CriOS/i.test(ua)) browser = "Chrome";
    else if (/Safari/i.test(ua)) browser = "Safari";
    else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";

    const isMobile = /Mobi|Android|iPhone|iPod/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua) || (os === "macOS" && navigator.maxTouchPoints > 1);
    const deviceType = isTablet ? "tablet" : (isMobile ? "mobile" : "desktop");

    return { os, browser, deviceType };
  } catch (e) {
    return { os: "unknown", browser: "unknown", deviceType: "unknown" };
  }
}

// 3. Rich Context Enrichment
function getAnalyticsContext() {
  try {
    const env = detectEnvironment();
    const theme = document.documentElement.getAttribute("data-theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const orientation = (window.screen && window.screen.orientation && window.screen.orientation.type)
      ? (window.screen.orientation.type.includes("portrait") ? "portrait" : "landscape")
      : (window.innerHeight >= window.innerWidth ? "portrait" : "landscape");
    const net = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    let role = "anonymous";
    if (currentUser) {
      role = (currentUser.email && currentUser.email.endsWith("@gl.pen-kanagawa.ed.jp")) ? "student" : "guest";
    }

    return {
      session_id: getOrCreateSessionId(),
      device_type: env.deviceType,
      device_os: env.os,
      browser_name: env.browser,
      is_in_app: detectInAppBrowser(),
      screen_res: `${window.screen ? window.screen.width : 0}x${window.screen ? window.screen.height : 0}`,
      viewport_res: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      orientation: orientation,
      theme_mode: theme,
      user_role: role,
      net_effective_type: net?.effectiveType || "unknown",
      net_save_data: net?.saveData ? true : false,
      user_lang: navigator.language || "ja",
      page_path: window.location.pathname || "",
    };
  } catch (e) {
    return {};
  }
}

// 4. Enhanced logEvent wrapper (Replaces raw Firebase logEvent)
function logEvent(analyticsInstance, eventName, customParams = {}) {
  try {
    const context = getAnalyticsContext();
    const merged = { ...context, ...customParams };
    firebaseLogEvent(analyticsInstance || analytics, eventName, merged);
  } catch (e) {
    console.warn("[Analytics] Track failed:", e);
  }
}

// 5. Automatic Click Tracker (data-track delegation)
document.addEventListener("click", (event) => {
  try {
    const target = event.target.closest("[data-track]");
    if (!target) return;

    const eventName = target.getAttribute("data-track");
    const params = {};
    for (const attr of target.attributes) {
      if (attr.name.startsWith("data-track-")) {
        const paramName = attr.name.replace("data-track-", "").replace(/-/g, "_");
        params[paramName] = attr.value;
      }
    }

    logEvent(analytics, eventName, params);
  } catch (e) {
    console.warn("[Analytics] Click tracker error:", e);
  }
});

// 6. Automatic Page Active Engagement Tracker (Dwell Time)
let activeStartTime = Date.now();
let totalActiveDwellSec = 0;
let isPageActive = !document.hidden;

function recordActiveTime() {
  if (isPageActive) {
    const now = Date.now();
    totalActiveDwellSec += Math.round((now - activeStartTime) / 1000);
    activeStartTime = now;
  }
}

document.addEventListener("visibilitychange", () => {
  try {
    if (document.hidden) {
      recordActiveTime();
      isPageActive = false;
      if (totalActiveDwellSec > 0) {
        logEvent(analytics, "page_engagement", {
          dwell_seconds: totalActiveDwellSec,
          is_exit: false
        });
      }
    } else {
      activeStartTime = Date.now();
      isPageActive = true;
    }
  } catch (e) {}
});

window.addEventListener("pagehide", () => {
  try {
    recordActiveTime();
    if (totalActiveDwellSec > 0) {
      logEvent(analytics, "page_engagement", {
        dwell_seconds: totalActiveDwellSec,
        is_exit: true
      });
    }
  } catch (e) {}
});

// 7. Automatic Scroll Depth Tracker (25%, 50%, 75%, 90%)
const scrollMilestonesReached = new Set();
let scrollThrottleTimeout = null;

window.addEventListener("scroll", () => {
  if (scrollThrottleTimeout) return;
  scrollThrottleTimeout = setTimeout(() => {
    scrollThrottleTimeout = null;
    try {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 50) return;
      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      [25, 50, 75, 90].forEach((milestone) => {
        if (scrollPercent >= milestone && !scrollMilestonesReached.has(milestone)) {
          scrollMilestonesReached.add(milestone);
          logEvent(analytics, "scroll_milestone", {
            milestone_percent: milestone
          });
        }
      });
    } catch (e) {}
  }, 300);
}, { passive: true });

// 8. Automatic Network Status Tracker
window.addEventListener("online", () => {
  logEvent(analytics, "network_status_change", { status: "online" });
});
window.addEventListener("offline", () => {
  logEvent(analytics, "network_status_change", { status: "offline" });
});

// 9. Automatic Text Copy Tracker
document.addEventListener("copy", () => {
  try {
    const selected = window.getSelection() ? window.getSelection().toString() : "";
    if (selected && selected.trim().length > 0) {
      logEvent(analytics, "text_copy", {
        char_count: selected.length,
        snippet: selected.slice(0, 30)
      });
    }
  } catch (e) {}
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
  logout,
  watchUser,
  getCurrentUser,
  requireLogin,
  toggleFavorite,
  getFavorites,
  detectInAppBrowser,
  renderGoogleLoginButton,
  getClaims,
  isEffectiveStudent,
  isSuperAdminClaims,
};
