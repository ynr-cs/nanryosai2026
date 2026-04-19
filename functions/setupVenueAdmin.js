const admin = require("firebase-admin");
const crypto = require("crypto");

// 開発用エミュレータを使用する場合は環境変数を設定（デプロイ先に行う場合はコメントアウト）
// process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

admin.initializeApp({ projectId: "nanryosai-2026-a4091" });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return { derivedKey, salt };
}

const db = admin.firestore();

async function setup() {
  const password = "teacher_password_2026"; // 任意のパスワードに変更可能
  const urlToken = "token_a8f3e2c9d1"; // 任意のランダムなトークンに変更可能
  
  const { derivedKey, salt } = hashPassword(password);
  
  await db.collection("venue_admin_config").doc("settings").set({
    accessToken: urlToken,
    hash: derivedKey,
    salt: salt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const venuesList = ['gym', 'music_room', 'av_room'];
  for (const id of venuesList) {
    await db.collection("venues").doc(id).set({
      status: "preparing",
      currentEventId: null,
      nextEventId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  console.log("✅ 会場管理用の認証設定が完了しました！");
  console.log("-------------------------------------------------");
  console.log("アクセス用URL (ローカル用): http://127.0.0.1:5000/admin/venue.html?token=" + urlToken);
  console.log("アクセス用URL (本番用): https://nanryosai-2026-a4091.web.app/admin/venue.html?token=" + urlToken);
  console.log("パスワード: " + password);
  console.log("-------------------------------------------------");
  
  process.exit(0); // 完了後に自動終了する
}

setup().catch((e) => {
  console.error(e);
  process.exit(1);
});
