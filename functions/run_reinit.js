const admin = require("firebase-admin");
const { google } = require("googleapis");
admin.initializeApp({ projectId: "nanryosai-2026-a4091" });
const db = admin.firestore();

const SHEET_TAB = "注文履歴";
const SHEET_HEADER = [
  "注文ID", "呼出番号", "注文方法", "現在の状況", "合計金額",
  "商品詳細", "注文日時", "調理完了日時", "呼出開始日時", "完了/終了日時",
];

async function run() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.readonly"]
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });
  
  const storesSnap = await db.collection("stores").get();
  for (const doc of storesSnap.docs) {
    const storeData = doc.data();
    const spreadsheetId = storeData.spreadsheetId;
    if (!spreadsheetId) continue;
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            updateSheetProperties: {
              properties: { sheetId: 0, title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } },
              fields: "title,gridProperties.frozenRowCount",
            },
          }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_TAB}'!A1:J1`,
        valueInputOption: "RAW",
        resource: { values: [SHEET_HEADER] },
      });
      console.log("Updated header for store", doc.id);
    } catch(e) { console.error(e); }
  }
}
run().then(() => process.exit(0));
