const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const ORIGINAL_IMG_DIR = path.join(ROOT_DIR, "images", "original");
const OUTPUT_IMG_DIR = path.join(ROOT_DIR, "images");
const CHANGELOG_PATH = path.join(ROOT_DIR, "CHANGELOG.md");
const VERSION_JSON_PATH = path.join(ROOT_DIR, "version.json");

// 1. images/original ディレクトリの確認/作成
if (!fs.existsSync(ORIGINAL_IMG_DIR)) {
  fs.mkdirSync(ORIGINAL_IMG_DIR, { recursive: true });
  console.log(`[process-assets] Created: ${ORIGINAL_IMG_DIR}`);
}

async function convertDir(srcDir, destDir) {
  const supportedExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".heic", ".heif"]);
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const files = fs.readdirSync(srcDir);
  let convertedCount = 0;

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      convertedCount += await convertDir(srcPath, path.join(destDir, file));
      continue;
    }

    const ext = path.extname(file).toLowerCase();
    if (!supportedExts.has(ext)) continue;

    const baseName = path.basename(file, ext);
    const destPath = path.join(destDir, `${baseName}.webp`);

    try {
      if (fs.existsSync(destPath)) {
        const destStat = fs.statSync(destPath);
        if (destStat.mtimeMs >= stat.mtimeMs) {
          continue;
        }
      }

      console.log(`[process-assets] Converting: ${file} -> ${baseName}.webp (original resolution/ratio preserved)...`);
      
      let inputBuffer;
      if (ext === ".heic" || ext === ".heif") {
        const heicConvert = require("heic-convert");
        const rawBuf = fs.readFileSync(srcPath);
        inputBuffer = await heicConvert({ buffer: rawBuf, format: "JPEG", quality: 0.95 });
      } else {
        inputBuffer = srcPath;
      }

      await sharp(inputBuffer)
        .webp({ quality: 85, effort: 4 })
        .toFile(destPath);

      const destStat = fs.statSync(destPath);
      const reduction = (((stat.size - destStat.size) / stat.size) * 100).toFixed(1);
      console.log(
        `[process-assets] Done: ${destPath} (${(destStat.size / 1024).toFixed(1)} KB, -${reduction}%)`
      );
      convertedCount++;
    } catch (err) {
      console.error(`[process-assets] Error converting ${file}:`, err.message);
    }
  }

  return convertedCount;
}

async function convertImages() {
  return await convertDir(ORIGINAL_IMG_DIR, OUTPUT_IMG_DIR);
}

function updateVersionJson() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.warn(`[process-assets] CHANGELOG.md not found at ${CHANGELOG_PATH}`);
    return null;
  }

  const content = fs.readFileSync(CHANGELOG_PATH, "utf-8");
  // 冒頭から最初のバージョン番号を抽出
  const match = content.match(/## \[([\d\.]+)\]/);
  if (!match || !match[1]) {
    console.warn("[process-assets] Could not find version pattern in CHANGELOG.md");
    return null;
  }

  const version = match[1];
  const versionData = {
    version: version,
    updatedAt: new Date().toISOString(),
  };

  const currentJson = fs.existsSync(VERSION_JSON_PATH)
    ? fs.readFileSync(VERSION_JSON_PATH, "utf-8")
    : "";
  const newJson = JSON.stringify(versionData, null, 2);

  if (currentJson !== newJson) {
    fs.writeFileSync(VERSION_JSON_PATH, newJson, "utf-8");
    console.log(`[process-assets] Updated version.json to v${version}`);
  }

  return version;
}

async function main() {
  console.log("[process-assets] Processing images and version...");
  const convertedCount = await convertImages();
  const version = updateVersionJson();

  // Gitステージング
  try {
    if (fs.existsSync(VERSION_JSON_PATH)) {
      execSync("git add version.json", { cwd: ROOT_DIR, stdio: "ignore" });
    }
    if (convertedCount > 0) {
      execSync("git add images/*.webp", { cwd: ROOT_DIR, stdio: "ignore" });
    }
  } catch (e) {
    // git add 失敗時は警告のみ
  }

  console.log(`[process-assets] Finished. (Converted: ${convertedCount} images, Version: v${version})`);
}

main().catch((err) => {
  console.error("[process-assets] Fatal error:", err);
  process.exit(1);
});
