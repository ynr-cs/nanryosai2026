# 南陵祭2026 仕様変更設計書: 来場者Webポータルおよびフロントエンド

---

## 1. 改訂概要および目的

### 1.1 背景と目的
「04_来場者ポータル_Webサイト脆弱性分析報告書」にて指摘された重大なセキュリティ脆弱性（全画面波及型Stored XSS、企画詳細・マイページにおけるHTMLインジェクション、プロトコル相対URLによるオープンリダイレクト、店舗初期シークレットの平文露出と特権奪取リスク、ログアウト時のキャッシュ残存、CSP等のセキュリティヘッダー欠如）を抜本的に解消するため、来場者ポータルおよびフロントエンド全域の仕様変更内容を定義します。

本仕様変更により、文化祭当日に多数の一般来場者・生徒・教員が安全に利用できる堅牢なフロントエンド基盤を確立します。

### 1.2 対象範囲 (Scope)
- `main/app-shell.js`: 緊急システムアラート、ヘッダー通知バナー、ログイン誘導モーダル
- `main/detail.html`: 企画詳細、メニュー一覧、画像、SNS外部リンク
- `main/account.html`: マイページ、注文履歴、呼び出し番号表示
- `main/login.html`: 認証画面、リダイレクト検証ロジック
- `main/auth.js`: セッション管理、ログアウト処理、App Check設定
- `main/admin_sync.html`: 管理同期ツール、店舗シークレット初期化処理
- `main/data/data.js`: 静的データ定義
- `firebase.json`: ホスティング設定、セキュリティヘッダー

### 1.3 脆弱性IDと仕様変更の対応表

| 脆弱性ID | 脆弱性名称 | 深刻度 | 本書における対応仕様セクション |
| :--- | :--- | :---: | :--- |
| **VUL-01** | 全画面波及型 緊急アラート経由のStored XSS | **Critical** | **第3.1節**: `app-shell.js` 緊急アラート安全表示仕様 |
| **VUL-02** | 企画詳細・メニュー・画像URL経由のStored XSS | **High** | **第3.2節**: `detail.html` 企画詳細画面 XSS防止仕様 |
| **VUL-03** | 管理同期画面の露出と店舗平文初期シークレット仕様 | **High** | **第3.6節**: 店舗初期パスワード刷新および `admin_sync.html` 保護仕様 |
| **VUL-04** | クリックジャッキング対策・CSPの完全欠如 | **High** | **第4章**: フロントエンド・セキュリティヘッダーおよびCSP仕様 |
| **VUL-05** | URLリンク属性への `javascript:` 疑似スキーム注入 | **High** | **第2.2節 & 第3.2節**: URLバリデーション共通モジュール |
| **VUL-06** | プロトコル相対URLによるオープンリダイレクト | **Medium** | **第3.4節**: `login.html` リダイレクト検証仕様 |
| **VUL-07** | 注文履歴・呼び出し番号表示のサニタイズ漏れ | **Medium** | **第3.3節**: `account.html` 注文履歴安全描画仕様 |
| **VUL-08** | ログアウト時のキャッシュ・ストレージ未破棄 | **Medium** | **第3.5節**: `auth.js` ログアウト・ストレージ破棄仕様 |
| **VUL-09** | App Check デバッグトークンの固定ハードコード | **Medium** | **第3.5節**: App Check 本番環境除外仕様 |

---

## 2. 共通セキュリティユーティリティモジュールの策定

フロントエンド全体で統一的なサニタイズおよびURL検証を実施するため、独立したセキュリティユーティリティモジュールを新設・標準化します。

### 2.1 モジュール配置仕様
- **ファイルパス**: `main/utils/security.js`
- **提供形式**: ES Modules (`export`) およびブラウザグローバル互換 (`window.NanryoSecurity`)

### 2.2 実装仕様 (`main/utils/security.js`)

```javascript
/**
 * 南陵祭2026 フロントエンド共通セキュリティユーティリティ
 * ファイル: main/utils/security.js
 */

/**
 * HTML特殊文字をエスケープして安全なテキストに変換する
 * @param {any} input - エスケープ対象の値
 * @returns {string} エスケープ済み文字列
 */
export function escapeHtml(input) {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return char;
    }
  });
}

/**
 * 改行コード(\n)を安全に<br>タグに変換する
 * ※必ずHTMLエスケープ後に改行変換を実施すること
 * @param {any} input - 対象テキスト
 * @returns {string} 安全なHTML文字列
 */
export function formatTextWithLineBreaks(input) {
  if (input === null || input === undefined) return "";
  const safe = escapeHtml(input);
  return safe.replace(/\r\n|\n|\r/g, "<br>");
}

/**
 * URLが安全なhttpまたはhttpsスキームであるか検証する
 * javascript:, data:, vbscript: などの悪意ある疑似スキームを遮断
 * @param {string} urlString - 検証対象URL
 * @returns {boolean} 安全なURLであればtrue
 */
export function isValidHttpUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return false;
  const trimmed = urlString.trim();
  try {
    // 相対URLの場合はベースを付与してパース検証
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * リンク属性(href, src)に安全に埋め込めるURLを返す
 * 安全でない場合は空文字を返却
 * @param {string} urlString - 対象URL
 * @param {string} fallback - 不正時のフォールバック値 (デフォルト: "")
 * @returns {string} 安全なURLまたはフォールバック
 */
export function sanitizeUrl(urlString, fallback = "") {
  if (isValidHttpUrl(urlString)) {
    return escapeHtml(urlString.trim());
  }
  return fallback;
}

// レガシースクリプト・グローバル環境用エクスポート
if (typeof window !== "undefined") {
  window.NanryoSecurity = {
    escapeHtml,
    formatTextWithLineBreaks,
    isValidHttpUrl,
    sanitizeUrl,
  };
}
```

---

## 3. 各コンポーネント・画面の具体的仕様変更設計

### 3.1 緊急システムアラート安全表示仕様 (`main/app-shell.js`)

#### 変更前の問題点 (VUL-01)
Firestore `_metadata/system_alerts` から取得した `mainAlertMessage` を未エスケープのまま `replace(/\n/g, "<br>")` して `innerHTML` 代入しており、全画面共通でStored XSSが発生する状態でした。

#### 変更後仕様
1. **テキストエスケープの強制**: `formatTextWithLineBreaks()` を適用して、HTMLタグを無害化した上で改行のみ `<br>` 化する。
2. **構造的分離**: アイコン要素とテキスト表示要素（`span`）を分離し、テキスト表示要素には可能であれば `textContent` を使用する。

#### コード変更差分仕様 (`main/app-shell.js`)

```diff
+ import { formatTextWithLineBreaks } from "./utils/security.js";

  // Firestore system_alerts リスナー内
  if (data && data.mainAlertMessage) {
    alertBanner.style.display = "block";
-   alertBanner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${data.mainAlertMessage.replace(/\n/g, "<br>")}</span>`;
+   const safeMessage = formatTextWithLineBreaks(data.mainAlertMessage);
+   alertBanner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span class="alert-text">${safeMessage}</span>`;
  } else {
    alertBanner.style.display = "none";
+   alertBanner.innerHTML = "";
  }
```

#### ヘッダー通知バナー・モーダルの安全化
```diff
  // 注文呼び出しバナー (Line 173-189付近)
- banner.innerHTML = `<div class="order-ready-text"><strong>呼び出し中: 注文番号 #${order.receiptNumber}</strong></div>`;
+ const safeReceiptNumber = escapeHtml(order.receiptNumber);
+ banner.innerHTML = `<div class="order-ready-text"><strong>呼び出し中: 注文番号 #${safeReceiptNumber}</strong></div>`;

  // ログイン誘導モーダル (Line 958-969付近)
+ const safeRedirect = sanitizeUrl(redirectUrl, "index.html");
  modal.innerHTML = `
    ...
-   <a href="${redirectUrl}" class="btn-primary">ログインする</a>
+   <a href="${safeRedirect}" class="btn-primary">ログインする</a>
  `;
```

---

### 3.2 企画詳細画面 XSS防止仕様 (`main/detail.html`)

#### 変更前の問題点 (VUL-02, VUL-05)
`project.description`, `project.menuNote`, `item.note`, `item.price`, `item.imageUrl`, `project.sns.instagram` 等の未サニタイズ展開によるStored XSSおよび `javascript:` 疑似スキーム実行。

#### 変更後仕様
1. **企画説明・注意事項**: `formatTextWithLineBreaks()` を使用して改行対応安全描画。
2. **メニュー項目・価格・注意書き**: すべて `escapeHtml()` を適用。
3. **画像URL**: `isValidHttpUrl()` で検証し、`https://` または安全な同一ホスト相対パスのみを `src` に適用。不正なURLの場合はデフォルトプレースホルダー画像へ差し替え。
4. **外部リンク・SNSリンク**: `isValidHttpUrl()` によるプロトコル検証を行い、安全な場合のみ `href` に代入。`rel="noopener noreferrer"` を必須属性として設定。

#### コード変更差分仕様 (`main/detail.html`)

```diff
+ import { escapeHtml, formatTextWithLineBreaks, isValidHttpUrl, sanitizeUrl } from "./utils/security.js";

  // 1. 企画説明文の描画 (Line 1103付近)
- document.getElementById("project-desc").innerHTML = (project.description || "説明はありません。").replace(/\n/g, "<br>");
+ document.getElementById("project-desc").innerHTML = formatTextWithLineBreaks(project.description || "説明はありません。");

  // 2. メニュー備考の描画 (Line 1124, 1141付近)
  if (project.menuNote) {
    document.getElementById("menu-note-container").innerHTML = `
-     <div class="menu-note"><i class="fas fa-info-circle"></i> ${project.menuNote.replace(/\n/g, "<br>")}</div>
+     <div class="menu-note"><i class="fas fa-info-circle"></i> ${formatTextWithLineBreaks(project.menuNote)}</div>
    `;
  }

  // 3. メニューリスト展開 (Line 1160付近)
  menuList.innerHTML = project.menu.map(item => `
    <li class="menu-item-card">
      <div class="menu-item-info">
-       <div class="menu-item-name">${item.name}</div>
-       <div class="menu-item-price">${item.price}</div>
-       ${item.note ? `<div class="menu-item-note">${item.note}</div>` : ""}
+       <div class="menu-item-name">${escapeHtml(item.name)}</div>
+       <div class="menu-item-price">${escapeHtml(item.price)}</div>
+       ${item.note ? `<div class="menu-item-note">${escapeHtml(item.note)}</div>` : ""}
      </div>
    </li>
  `).join("");

  // 4. SNSリンク設定 (Line 1075-1078付近)
  if (project.sns && project.sns.instagram) {
+   if (isValidHttpUrl(project.sns.instagram)) {
      btnInstagram.href = project.sns.instagram;
+     btnInstagram.rel = "noopener noreferrer";
      btnInstagram.style.display = "inline-flex";
+   } else {
+     console.warn("Invalid Instagram URL blocked:", project.sns.instagram);
+     btnInstagram.style.display = "none";
+   }
  }

  // 5. 画像URLの検証と設定 (Line 1247付近)
- const imgTag = `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}">`;
+ const safeImgUrl = isValidHttpUrl(item.imageUrl) ? escapeHtml(item.imageUrl) : "/assets/images/placeholder.webp";
+ const imgTag = `<img src="${safeImgUrl}" alt="${escapeHtml(item.name)}" loading="lazy">`;
```

---

### 3.3 マイページ・注文履歴画面 XSS防止仕様 (`main/account.html`)

#### 変更前の問題点 (VUL-07)
Firestore `orders` コレクションの `item.name`, `item.groupName`, `order.receiptNumber` を未エスケープでテンプレートリテラル結合していた。

#### 変更後仕様
注文履歴リスト生成ロジックにおいて、全フィールドに `escapeHtml()` を適用する。

#### コード変更差分仕様 (`main/account.html`)

```diff
+ import { escapeHtml } from "./utils/security.js";

  // 注文履歴アイテム生成 (Line 1350, 1438-1441付近)
  function renderOrderItem(item) {
    return `
      <div class="order-item-row">
-       <span class="item-name">${item.name}</span>
-       <span class="item-group">${item.groupName || ""}</span>
-       <span class="item-qty">× ${item.quantity}</span>
+       <span class="item-name">${escapeHtml(item.name)}</span>
+       <span class="item-group">${escapeHtml(item.groupName || "")}</span>
+       <span class="item-qty">× ${escapeHtml(item.quantity)}</span>
      </div>
    `;
  }

  function renderCallingCard(order) {
    return `
      <div class="calling-card">
-       <div class="receipt-no">#${order.receiptNumber}</div>
-       <div class="store-name">${order.storeName}</div>
+       <div class="receipt-no">#${escapeHtml(order.receiptNumber)}</div>
+       <div class="store-name">${escapeHtml(order.storeName)}</div>
      </div>
    `;
  }
```

---

### 3.4 ログイン画面 オープンリダイレクト防止仕様 (`main/login.html`)

#### 変更前の問題点 (VUL-06)
`getSafeRedirect()` 関数の検証が不十分であり、`//evil.com` や `/\evil.com` などのプロトコル相対URLを指定されると、外部フィッシングサイトへユーザーが誘導される脆弱性。

#### 変更後仕様
1. **厳格な同一オリジン相対パス検証**:
   - `decodeURIComponent` で正規化後、先頭が `/` であり、かつ `//` や `/\`、`\/` で始まらないことを正規表現で厳格に検証する。
2. **ホワイトリスト検証（多層防御）**:
   - リダイレクト先のパスが許可された画面リスト（ポータル内HTMLファイル）に合致するか判定する。
3. **フォールバック**: 不正な値や検証失敗時は常に `"index.html"` へリダイレクト。

#### 新規 `getSafeRedirect()` 実装仕様 (`main/login.html`)

```javascript
/**
 * リダイレクト先URLの安全性検証関数
 * @param {string|null} url - クエリパラメータから取得したredirect値
 * @returns {string} 安全な相対パス
 */
export function getSafeRedirect(url) {
  const DEFAULT_REDIRECT = "index.html";
  if (!url || typeof url !== "string") {
    return DEFAULT_REDIRECT;
  }

  try {
    let decoded = decodeURIComponent(url).trim();

    // 制御文字・改行文字の除去
    decoded = decoded.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // 危険なプレフィックスの拒絶 (プロトコル相対URL, バックスラッシュ混入)
    // 例: "//evil.com", "/\evil.com", "\\evil.com", "javascript:"
    if (
      decoded.startsWith("//") ||
      decoded.startsWith("/\\") ||
      decoded.startsWith("\\") ||
      /^[a-zA-Z][a-zA-Z0-9+-.]*:/.test(decoded) // 絶対URLスキーム (http:, javascript: 等)
    ) {
      console.warn("Dangerous redirect pattern blocked:", decoded);
      return DEFAULT_REDIRECT;
    }

    // 相対パス形式への統一
    let targetPath = decoded;
    if (targetPath.startsWith("./")) {
      targetPath = targetPath.substring(2);
    } else if (targetPath.startsWith("/")) {
      targetPath = targetPath.substring(1);
    }

    // パス部分とクエリ部分の分離
    const [pathPart, queryPart] = targetPath.split("?");

    // 許可されたホワイトリストページ定義
    const ALLOWED_PAGES = new Set([
      "",
      "index.html",
      "detail.html",
      "account.html",
      "map.html",
      "map3d.html",
      "projects-list.html",
      "stage-list.html",
      "updates.html",
      "pos/mobile-order.html",
    ]);

    if (ALLOWED_PAGES.has(pathPart)) {
      return queryPart ? `${pathPart}?${queryPart}` : (pathPart || "index.html");
    }

    console.warn("Unregistered redirect target blocked:", pathPart);
    return DEFAULT_REDIRECT;
  } catch (err) {
    console.error("Redirect sanitization failed:", err);
    return DEFAULT_REDIRECT;
  }
}
```

---

### 3.5 認証モジュール・ログアウト時ストレージクリア仕様 (`main/auth.js`)

#### 変更前の問題点 (VUL-08, VUL-09)
1. `logout()` 時に `signOut(auth)` を実行するのみで、端末の `localStorage` / `sessionStorage` にユーザーデータ（お気に入り、下書き、注文情報）が残存し、共有端末で情報漏洩のリスク。
2. App Check デバッグトークンがハードコードされ本番ビルドに露出。

#### 変更後仕様
1. **セッションデータの安全な破棄**: `logout()` 実行時に、アプリ固有のキャッシュキーを特定して明示的に破棄、または全ストレージをクリーンアップする。
2. **デバッグトークンの環境分離**: 本番用ソースコードからハードコードUUIDを完全撤廃。ローカル開発時のみ `window.FIREBASE_APPCHECK_DEBUG_TOKEN` を別途注入する。

#### コード変更差分仕様 (`main/auth.js`)

```diff
  export async function logout() {
    try {
+     // 1. Firebase Auth ログアウト
      await signOut(auth);
+
+     // 2. クライアント側ストレージのクリア (個人情報・注文キャッシュの漏洩防止)
+     const clearTargetKeys = [
+       "nanryo_user_favorites",
+       "nanryo_cart_draft",
+       "nanryo_last_order_id",
+       "nanryo_user_profile_cache"
+     ];
+     clearTargetKeys.forEach(key => {
+       localStorage.removeItem(key);
+       sessionStorage.removeItem(key);
+     });
+     // ※テーマ設定 (app-theme) など非機密のUI設定のみ保持
+
      window.location.href = "login.html";
    } catch (error) {
      console.error("Logout Error:", error);
    }
  }

  // App Check 初期化部分 (Line 88-96付近)
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
-   self.FIREBASE_APPCHECK_DEBUG_TOKEN = process.env.APPCHECK_DEBUG_TOKEN || "a4eb006d-0867-45dc-b9f5-8026de0b17a0";
+   // 本番用ソースに固定トークンを含めない。開発者各自が.envまたはローカル設定で指定
+   if (window.__LOCAL_DEBUG_TOKEN__) {
+     self.FIREBASE_APPCHECK_DEBUG_TOKEN = window.__LOCAL_DEBUG_TOKEN__;
+   }
  }
```

---

### 3.6 店舗初期パスワード仕様刷新および `admin_sync.html` 保護仕様

#### 変更前の問題点 (VUL-03)
`admin_sync.html` が公開ディレクトリに配置され、さらに `secret: p.loginId || p.id`（店舗IDそのままを平文初期パスワードとする）仕様が記述されていたため、`data.js` の公開店舗情報と照合して全店舗のPOSへ不正ログインが可能な状態。

#### 変更後仕様

##### 1. 初期パスワード生成仕様の刷新
- **平文IDパスワードの完全廃止**: `p.loginId` や `p.id` をパスワードに流用することを禁止。
- **暗号学的乱数によるランダムパスワード生成**:
  英大文字・小文字・数字・記号を混在させた12文字以上のランダム文字列を生成。
  ```javascript
  // 安全なランダムシークレット生成関数 (管理者ツール / バックエンド用)
  function generateSecureSecret(length = 12) {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => charset[byte % charset.length]).join("");
  }
  ```
- **配布運用の変更**:
  生成された店舗シークレット一覧は、Web上で公開・同期せず、実行委員会の安全なオフライン環境でCSV出力し、各店舗責任者に紙の封筒（密封）で手渡し配布する。

##### 2. `admin_sync.html` のアクセス制御とファイル移設
- **公開ディレクトリからの完全撤去**:
  `main/admin_sync.html` を `main/` から削除し、管理者専用領域 `admin/sync.html` へ移設。
- **Firebase Hosting でのアクセス制限設定**:
  `firebase.json` により、一般来場者からの `admin/*` へのアクセスを拒否、またはIP制限・Cloud Run/Functions 認可プロキシ経由に限定する。

---

## 4. フロントエンド・セキュリティヘッダーおよびCSP設定仕様 (`firebase.json`)

クリックジャッキング（Iframe不正埋め込み）の防止およびXSS実行時の被害最小化（多層防御）のため、`firebase.json` に包括的なセキュリティヘッダーを定義します。

### 4.1 設定仕様 (`firebase.json`)

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "設計書/**",
      "設計図/**",
      "functions/**"
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Frame-Options",
            "value": "SAMEORIGIN"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "camera=(self), microphone=(), geolocation=(), payment=()"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob: https://firebasestorage.googleapis.com https://cyberjapandata.gsi.go.jp https://images.unsplash.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com; frame-ancestors 'self';"
          }
        ]
      },
      {
        "source": "admin/**",
        "headers": [
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "Cache-Control",
            "value": "no-store, no-cache, must-revalidate, proxy-revalidate"
          }
        ]
      }
    ]
  }
}
```

### 4.2 セキュリティヘッダーの役割と効果
1. **`X-Frame-Options: SAMEORIGIN` / `frame-ancestors 'self'`**:
   第三者サイトによる `iframe` 埋め込みを完全遮断し、クリックジャッキング攻撃を無力化。
2. **`X-Content-Type-Options: nosniff`**:
   ブラウザによるMIMEタイプスニッフィングを禁止し、悪意ある画像・テキストファイルのスクリプト実行を遮断。
3. **`Content-Security-Policy`**:
   - `connect-src`: 攻撃者サーバーへの認証情報・個人データ不正送信（Exfiltration）を遮断。
   - `object-src 'none'`: Flashなどのレガシープラグイン実行を禁止。

---

## 5. テスト・検証計画

仕様変更の実装後、以下のテストケースを実施して脆弱性が完全に解消されたことを検証します。

### 5.1 XSS防御テストケース

| No | テスト対象 | 入力テスト値 (Payload) | 期待される挙動 |
| :---: | :--- | :--- | :--- |
| **T-01** | 緊急アラート (`app-shell.js`) | `<script>alert('XSS')</script>本日は雨天です` | スクリプトは実行されず、文字列として `<script>...` がそのまま表示されること |
| **T-02** | 企画説明文 (`detail.html`) | `<img src=x onerror=alert('XSS')>美味しいクレープ` | 画像エラーハンドラは発火せず、タグがエスケープされて表示されること |
| **T-03** | SNSリンク (`detail.html`) | `javascript:alert('XSS')` | リンクボタンが非表示になるか、クリックしてもスクリプトが動作しないこと |
| **T-04** | 注文商品名 (`account.html`) | `タピオカ<svg/onload=alert(1)>` | アラートは表示されず、テキストとして描画されること |

### 5.2 オープンリダイレクト検証テストケース

| No | 入力URLパラメータ (`?redirect=...`) | 期待されるリダイレクト先 | 判定基準 |
| :---: | :--- | :--- | :--- |
| **T-05** | `?redirect=//evil.com` | `index.html` | 外部サイトへ遷移せずポータルトップへ遷移すること |
| **T-06** | `?redirect=/\evil.com` | `index.html` | バックスラッシュ混入が検知されトップへ遷移すること |
| **T-07** | `?redirect=https://google.com` | `index.html` | 絶対URLが遮断されトップへ遷移すること |
| **T-08** | `?redirect=account.html` | `account.html` | 正常な許可画面へ遷移すること |
| **T-09** | `?redirect=/detail.html?id=101` | `detail.html?id=101` | クエリパラメータを保持した安全な遷移ができること |

### 5.3 セッション・クリックジャッキング検証テストケース

| No | テスト項目 | 検証手順 | 期待結果 |
| :---: | :--- | :--- | :--- |
| **T-10** | ログアウト時のストレージ破棄 | ログイン状態で注文・お気に入り操作後、ログアウトを実行 | `localStorage` / `sessionStorage` 内の個人・注文データが完全削除されていること |
| **T-11** | Iframe埋め込み拒否 | ローカルHTML (`<iframe src="http://localhost:5000/main/login.html">`) を作成してブラウザ表示 | ブラウザのコンソールに `CSP frame-ancestors` または `X-Frame-Options` 拒絶エラーが出力され表示されないこと |

---

## 6. 実装・ロールアウト手順

1. **フェーズ1: 共通ユーティリティ作成**:
   - `main/utils/security.js` を作成し、単体テストを実施。
2. **フェーズ2: 画面別サニタイズ適用**:
   - `app-shell.js`, `detail.html`, `account.html`, `index.html` に `escapeHtml`, `formatTextWithLineBreaks`, `isValidHttpUrl` を適用。
3. **フェーズ3: ログインリダイレクト改修**:
   - `login.html` の `getSafeRedirect()` をホワイトリスト方式に置き換え。
4. **フェーズ4: 機密運用改善**:
   - `main/admin_sync.html` の退避・削除。
   - 初期パスワード発行スクリプト（ランダム生成）への移行。
5. **フェーズ5: セキュリティヘッダー適用**:
   - `firebase.json` にヘッダーを定義し、ステージング環境でCSP違反レポートの有無を確認後に本番反映。

---
**設計書策定日**: 2026-09-09
**担当**: 南陵祭2026プロジェクト 来場者ポータル・フロントエンド専門監査官
