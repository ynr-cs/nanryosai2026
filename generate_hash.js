const crypto = require("crypto");

/**
 * Functions/index.js と同じハッシュ化ロジック
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return { derivedKey, salt };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Usage: node generate_hash.js <password>");
  process.exit(1);
}

const password = args[0];
const { derivedKey, salt } = hashPassword(password);

console.log(`\n[Input Password]: ${password}`);
console.log(`---------------------------------------------------`);
console.log(`[Hash]: ${derivedKey}`);
console.log(`[Salt]: ${salt}`);
console.log(`---------------------------------------------------`);
console.log(`\n[JSON for Firestore store_secrets]:`);
console.log(JSON.stringify({ hash: derivedKey, salt: salt }, null, 2));
