/**
 * Nanryosai 2026
 * Version: 0.5.141
 * Last Modified: 2026-09-01
 * Author: Nanryosai 2026 Project Team
 */
// firebase-messaging-sw.js
importScripts(
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js",
);

const firebaseConfig = {
  apiKey: "AIzaSyA-Ijkbo-9rgrNKbDlRJ-rQVYdSXR_a9Do",
  authDomain: "nanryosai-2026-a4091.firebaseapp.com",
  projectId: "nanryosai-2026-a4091",
  storageBucket: "nanryosai-2026-a4091.firebasestorage.app",
  messagingSenderId: "93228414556",
  appId: "1:93228414556:web:f64f90c13849fae9049899",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// バックグラウンドで通知を受信した時の処理
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload,
  );

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/images/icon.png", // アイコン画像のパス
    badge: "/images/badge.png", // バッジ画像のパス
    tag: "order-update", // 同じタグの通知は上書きされる（連投防止）
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
