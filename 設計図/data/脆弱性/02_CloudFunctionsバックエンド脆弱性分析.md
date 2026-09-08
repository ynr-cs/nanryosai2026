# 南陵祭2026 Cloud Functions & バックエンド網羅的セキュリティ監査報告書

**文書番号**: SEC-REPORT-2026-002  
**対象コンポーネント**: Cloud Functions (`functions/index.js`, `functions/package.json`, 補助スクリプト群)  
**監査日時**: 2026年9月9日  
**ステータス**: 確定版 (Final Audit Report)  
**監査官**: Cloud Functions & Backend Auditor  
**遵守事項**: ソースコードの改変・編集は一切行わず、静的解析・論理監査・脅威モデリングのみを実施。

---

## 1. エグゼクティブサマリー

本報告書は、南陵祭2026プロジェクトにおけるバックエンドシステム（Cloud Functions for Firebase、Google Cloud 連携、外部API連携、および運用保守スクリプト群）に対する網羅的かつ深層的なセキュリティ監査結果を取りまとめたものです。

監査対象となった `functions/index.js`（約2,436行、91KB）、`functions/package.json`、および関連スクリプト（`setupVenueAdmin.js`, `run_admin_callables.js`, `run_reinit.js`, `smoke_test_task4.js`）に存在する全24エンドポイント・トリガー・バッチ処理を精査しました。

### 1.1 総合評価とセキュリティ体制サマリー

| 評価項目 | 評価レベル | 現状評価サマリー |
| :--- | :---: | :--- |
| **認証・認可 (Auth)** | **🟡 要改善** | Google Identity Services + HMAC-SHA256 匿名UIDアーキテクチャはプライバシー保護の観点で非常に優れているが、会場管理（`venue`）の独自認証の脆弱性、ブルートフォース対策欠如、および SuperAdmin 操作の不整合が存在する。 |
| **入力検証 (Validation)** | **🔴 危険** | `createOrder` や `createSokProvisional` における注文数量（`quantity`）の上限チェック欠如、カスタマイズ（`customizations`）や会場更新（`updates`）の型・長手・値ホワイトリスト検証の欠如が確認された。 |
| **ロジック・並行性 (Race Condition)** | **🔴 危険** | `createOrder` の重複注文防止チェックがトランザクション外にあることによる TOCTOU レースコンディション、SOK確定時の重複制限・店舗営業状態チェック欠落、ステータス遷移でのトランザクション非使用による状態破壊リスクが存在する。 |
| **シークレット管理 (Secrets)** | **🔴 危険** | `setupVenueAdmin.js` に本番用URLアクセストークンおよび平文パスワードがハードコードされてGitコミットされており、PBKDF2のストレッチング回数（10,000回）も極めて脆弱である。 |
| **可用性・DoS (Availability)** | **🟡 要改善** | ウォームアップバイパスの外部乱用による課金DoS、`getNextReceiptNumber` のトランザクション内反復クエリによる採番ボトルネック、Google Sheets API クォータ枯渇リスク、および npm 依存関係に30件の既知脆弱性が存在する。 |

### 1.2 発見された脆弱性の重要度別統計

```
[Critical] 致命的:  3 件 (TOCTOU重複注文バイパス, 初期シークレット漏洩, 依存関係脆弱性)
[High]     重要:   11 件 (SOK重複制限欠落, 数量無制限, トランザクション未適用, DoS等)
[Medium]   中程度:  8 件 (平文パスワード残存, FCMトークン制限欠落, バッチ制限等)
[Low]      軽微:    3 件 (エラーメッセージ詳細露出, SOK Claimed退会不整合等)
--------------------------------------------------------------------------------
合計:              25 件
```

---

## 2. 全エンドポイント・関数・スクリプト網羅的監査マトリクス

`functions/index.js` にてエクスポートされている全24関数（Callable, HTTP, Scheduled, Firestore Trigger）および配置スクリプトの監査一覧です。

| # | 関数名 / スクリプト名 | 種別 | App Check | 認証 (Auth) | 認可 (Role/Claim) | 総合リスク | 主要な指摘事項 |
| :-: | :--- | :--- | :-: | :--- | :--- | :-: | :--- |
| 1 | `authenticateWithGoogle` | Callable | 必須 | なし (登録) | 公開 (検証後発行) | **Medium** | SuperAdminのメールアドレス直書き、タイミング攻撃耐性 |
| 2 | `grantIdentity` | Callable | 必須 | 必須 | `super_admin` | **Safe** | 権限チェック・UID存在検証ともに適切 |
| 3 | `deleteMyAccount` | Callable | 必須 | 必須 | 本人のみ (UID) | **Medium** | SOK Claimed 状態の注文が進行中チェックから漏れる |
| 4 | `createStoreSecret` | Callable | 必須 | 必須 | `super_admin` | **High** | PBKDF2ストレッチング回数不足 (10,000回)、型バリデーション欠如 |
| 5 | `batchUpdateStoreSecrets` | Callable | 必須 | 必須 | `super_admin` | **High** | PBKDF2ストレッチング回数不足、パスワード型検証欠如 |
| 6 | `loginStore` | Callable | 必須 | 必須 | 任意認証ユーザー | **High** | レート制限欠如 (総当たり可能)、平文パスワード分岐残存 |
| 7 | `createOrder` | Callable | 必須* | 必須 | 学生 / `store_admin` | **Critical** | TOCTOU重複注文突破、数量上限欠如、ウォームアップバイパス |
| 8 | `kitchenComplete` | Callable | 必須* | 必須 | `store_admin` (自店) | **High** | トランザクション不使用、SuperAdmin操作不可 |
| 9 | `callForPickup` | Callable | 必須* | 必須 | `store_admin` (自店) | **High** | トランザクション不使用、SuperAdmin操作不可 |
| 10 | `completeOrder` | Callable | 必須* | 必須 | `store_admin` (自店) | **High** | トランザクション不使用、`abandonStaleOrders` との競合破壊 |
| 11 | `cancelOrder` | Callable | 必須 | 必須 | `store_admin` (自店) | **High** | トランザクション不使用、理由文字列の型・長手検証欠如 |
| 12 | `adminUpdateOrderStatus` | Callable | 必須 | 必須 | 管理者 / 自店 | **Medium** | 理由文字列バリデーション不足、トランザクション不使用 |
| 13 | `sendOrderUpdateNotification` | Trigger | - | イベント | 内部トリガー | **Medium** | ユーザーによる FCM トークン大量登録（500件超）時のクラッシュ |
| 14 | `onStoreCreated` | Trigger | - | イベント | 内部トリガー | **Safe** | ログ警告のみで副作用なし |
| 15 | `linkStoreSheet` | Callable | 必須 | 必須 | `super_admin` | **Low** | 親フォルダ所属チェック実装済み。エラー時の例外ラップ |
| 16 | `reinitSheetHeaders` | Callable | 必須 | 必須 | `super_admin` | **Medium** | 全店舗反復同期によるタイムアウト（60秒超）リスク |
| 17 | `syncOrdersToSheets` | Schedule | - | 内部 | 分刻み cron | **High** | Google Sheets API クォータ枯渇、A列全行走査による遅延 |
| 18 | `rebuildStoreSheet` | Callable | 必須 | 必須 | `super_admin` | **Medium** | 店舗注文全件取得のメモリ圧迫・クライアントタイムアウト |
| 19 | `loginVenueAdmin` | Callable | 必須 | **不要** | **独自認証** | **High** | Firebase Auth不要、総当たり対策欠落、ログアウト機構欠如 |
| 20 | `updateVenueStatus` | Callable | 必須 | **不要** | **独自セッション** | **High** | 任意 `venueId` 更新可能、`status` 値ホワイトリスト未検証 |
| 21 | `updateStoreStatus` | Callable | 必須 | 必須 | `store_admin` (自店) | **Medium** | 商品数500件超過時の Batch 上限エラー、トリガー連鎖負荷 |
| 22 | `manageStoreStatusAndWarmup`| Schedule | - | 内部 | 分刻み cron | **Medium** | 店舗数500件超過時の Batch 上限エラー |
| 23 | `abandonStaleOrders` | Schedule | - | 内部 | 分刻み cron | **High** | `completeOrder` との競合誤BAN、N+1クエリ、Batch上限 |
| 24 | `unbanUser` | Callable | 必須 | 必須 | `super_admin` | **Low** | 監査ログ（誰がいつ解除したか）の永続化なし |
| 25 | `createSokProvisional` | Callable | 必須* | 必須 | `store_admin` (自店) | **High** | 数量上限欠如、カスタマイズ未検証、ウォームアップバイパス |
| 26 | `claimSokOrder` | Callable | 必須* | 必須 | 任意認証ユーザー | **High** | 1人複数台SOK端末仮注文占有（キオスク妨害DoS） |
| 27 | `confirmSokOrder` | Callable | 必須* | 必須 | 仮注文所有者 | **High** | 進行中注文数チェック欠如、店舗営業・緊急停止チェック欠如 |
| 28 | `expireSokOrders` | Schedule | - | 内部 | 分刻み cron | **Medium** | 500件超過時の Batch 上限エラー |
| 29 | `cancelSokOrder` | Callable | 必須 | 必須 | 仮注文所有者 | **Safe** | トランザクション内でステータスと所有権を厳密検証 |
| 30 | `syncStoreItemAvailability`| Trigger | - | イベント | 内部トリガー | **Medium** | 一括更新時の Thundering Herd（同一店舗ドキュメントへの書込集中） |
| - | `setupVenueAdmin.js` | Script | - | - | - | **Critical** | 本番URLトークン・平文パスワードのハードコード露出 |
| - | `run_admin_callables.js` | Script | - | - | - | **Medium** | モック仕様不整合、デバッグコードの本番混入リスク |
| - | `package.json` | Config | - | - | - | **Critical** | 30件の既知依存脆弱性（critical 3件, high 12件） |

*(注: 必須* の関数は、ウォームアップバイパス `warmup: true` が先頭に存在するため、非認証・App Check なしで早期リターン可能)*

---

## 3. 詳細脆弱性分析 (Deep-Dive Analysis)

### 分類 1: 認証・認可 (Authentication & Authorization)

---

#### 🔴 [VULN-AUTH-01] 会場ステータス管理における独自認証の設計欠陥と総当たり脆弱性
- **対象関数**: `loginVenueAdmin`, `updateVenueStatus` (Lines 1643–1736)
- **CVSS v3.1 スコア**: **8.2** (High) `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:N`
- **脆弱性概要**:
  学校教員が手軽に操作できるよう、Firebase Auth を経由せず URL トークンと手入力パスワードを照合して `venue_admin_sessions` にセッショントークンを発行する独自フローが採用されています。しかし、以下の重大な欠陥が存在します：
  1. **Firebase Auth 認証の完全欠如**: 未認証の第三者が直接呼び出し可能。
  2. **レート制限・アカウントロックの欠如**: 試行回数制限（Throttling）がないため、短時間に数万回のパスワード試行を実行してパスワードおよび URL トークンを総当たり（ブルートフォース）可能。
  3. **トークン比較時のタイミング攻撃耐性欠如**: `config.accessToken !== urlToken` という通常の不等価演算子で比較しており、バイトごとの比較時間差からトークンを推測可能。
  4. **セッション無効化機構（ログアウト）の欠如**: 端末共有（学校の共用PCやタブレット）が想定されているにもかかわらず、明示的にセッションを破棄するエンドポイントが存在しない。
  5. **期限切れセッションの放置**: セッション有効期限（24時間）のチェックは「有効期限切れ後にそのトークンでアクセスされた場合」にのみ削除されるため、破棄された古いセッションがデータベースに永続的に滞留する。
- **攻撃シナリオ**:
  攻撃者は自動化スクリプトを用いて `loginVenueAdmin` に対し一般的な学校用パスワードリストを高速総当たり送信する。数分以内に一致するパスワードを特定し、セッショントークンを取得。体育館や音楽室の演目ステータスを意図的に改ざんし、来場者を混乱させる。
- **推奨対策**:
  1. Firebase Anonymous Auth または正規の Custom Token 発行による Firebase Auth 基盤への統合。
  2. `loginVenueAdmin` に Firestore または Redis を用いた IP/トークン単位のレート制限（例: 5回連続失敗で15分間ロック）を実装する。
  3. トークン照合には `crypto.timingSafeEqual` を使用する。

---

#### 🔴 [VULN-AUTH-02] `updateVenueStatus` における認可検証の欠如と任意会場のステータス改ざん
- **対象関数**: `updateVenueStatus` (Lines 1691–1736)
- **CVSS v3.1 スコア**: **7.5** (High) `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N`
- **脆弱性概要**:
  セッショントークンの存在チェックは行われているものの、セッショントークンが「どの会場（`venueId`）に対する操作権限を持つか」のバインド（スコープ検証）が一切行われていません。また、`venueId` のホワイトリストチェックが存在しません。
  ```javascript
  // index.js Lines 1726
  await db.collection("venues").doc(venueId).set(allowedUpdates, { merge: true });
  ```
  `venueId` に任意の文字列（例: `../../other_collection/doc`、存在しない会場、または全会場）を指定することで、正規の会場（`gym`, `music_room`, `av_room`）以外の任意ドキュメントを作成・改ざん可能です。
- **推奨対策**:
  ```javascript
  const ALLOWED_VENUES = new Set(['gym', 'music_room', 'av_room']);
  if (!ALLOWED_VENUES.has(venueId)) {
    throw new functions.https.HttpsError("invalid-argument", "無効な会場IDです。");
  }
  ```

---

#### 🟡 [VULN-AUTH-03] `loginStore` におけるブルートフォース攻撃対策の欠如
- **対象関数**: `loginStore` (Lines 612–703)
- **CVSS v3.1 スコア**: **7.1** (High) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`
- **脆弱性概要**:
  店舗スタッフ用ポータルのログインにおいて、`storeId`（例: `301`）と `password` を検証していますが、失敗回数の記録や遅延処理（Exponential Backoff）、アカウントロックアウト機構が全く存在しません。ログイン済みのユーザー（一般来場者や在校生）であれば誰でも、任意の `storeId` に対して無制限に `loginStore` を呼び出すことができます。
- **推奨対策**:
  `store_secrets/{storeId}` または別コレクションに `failedAttempts` と `lockedUntil` を記録し、連続5回失敗で30分間ロックアウトする仕組みを導入する。

---

#### 🟡 [VULN-AUTH-04] `loginStore` における旧方式平文パスワード判定の残存とタイミング脆弱性
- **対象関数**: `loginStore` (Lines 658–662)
- **CVSS v3.1 スコア**: **5.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N`
- **脆弱性概要**:
  ```javascript
  // index.js Lines 660-662
  else if (secretData.password) {
    isValid = String(secretData.password) === String(password);
  }
  ```
  1. 平文パスワードによる認証フォールバックが残存しており、データベースが平文を保持している場合に重大な漏洩リスクとなる。
  2. 通常の文字列比較 `===` は最初の不一致文字で比較を打ち切るため、タイミング攻撃に対して脆弱である。
- **推奨対策**:
  平文パスワードのフォールバックコードを完全削除し、全店舗を PBKDF2 ハッシュ運用に一本化する。

---

#### 🟡 [VULN-AUTH-05] 現場ステータス更新関数群における SuperAdmin 操作の拒否
- **対象関数**: `kitchenComplete`, `callForPickup`, `completeOrder`, `cancelOrder` (Lines 947–1057)
- **CVSS v3.1 スコア**: **4.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:L/A:L`
- **脆弱性概要**:
  共通ヘルパー `getOrderForTransition` では、以下の認可検証が行われています：
  ```javascript
  // index.js Lines 936
  if (token.role !== "store_admin" || token.storeId !== orderData.storeId) {
    throw new functions.https.HttpsError("permission-denied", "店舗管理者権限が必要です。");
  }
  ```
  このコードでは `isSuperAdminToken(token)` の判定が含まれていません。このため、文化祭本部・実行委員長（SuperAdmin）が現場の端末トラブルや障害時に代理で注文完了・キャンセルを行おうとしても、`permission-denied` で拒否されます（`adminUpdateOrderStatus` でしか操作できないという二重運用の歪みが発生）。

---

### 分類 2: 入力値バリデーション・インジェクション (Input Validation & Injection)

---

#### 🔴 [VULN-INJ-01] `createOrder` および `createSokProvisional` における注文数量の上限境界値検証欠如
- **対象関数**: `createOrder` (Lines 840–842), `createSokProvisional` (Lines 2103–2105)
- **CVSS v3.1 スコア**: **7.5** (High) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H`
- **脆弱性概要**:
  ```javascript
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "数量は1以上の整数である必要があります。");
  }
  ```
  上記コードでは、1以上の整数であることのみを検査しており、**最大値（Upper Bound）のチェックが存在しません**。
  悪意あるクライアントが `quantity: 100000` や `quantity: 9007199254740991`（`Number.MAX_SAFE_INTEGER`）を送信した場合：
  1. `totalPrice` の計算において天文学的な数値が算出される。
  2. 厨房（Kitchen）画面やPOS端末に「カステラ x 100,000個」という注文が届き、現場オペレーションが完全に麻痺する。
  3. Google スプレッドシート同期時にセルの数値桁数オーバーフローや同期エラーを引き起こす。
- **推奨対策**:
  1回の注文における商品ごとの最大数量（例: 1商品あたり最大10個、1注文合計最大30個など）の定数を定義し、厳格にバリデーションする。
  ```javascript
  const MAX_ITEM_QUANTITY = 10;
  if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_ITEM_QUANTITY) {
    throw new functions.https.HttpsError("invalid-argument", `数量は1〜${MAX_ITEM_QUANTITY}の整数である必要があります。`);
  }
  ```

---

#### 🔴 [VULN-INJ-02] `customizations` 配列における型・構造・長手検証の欠如
- **対象関数**: `createOrder` (Line 851), `createSokProvisional` (Line 2112)
- **CVSS v3.1 スコア**: **6.5** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L`
- **脆弱性概要**:
  ```javascript
  customizations: item.customizations || [],
  ```
  `item.customizations` に対するスキーマ検証が一切行われていません。クライアントは以下のような任意のデータを注入可能です：
  - 1万件の巨大な配列
  - 巨大な文字列プロパティ（数十KBの文字列）
  - 想定外のプロパティ構造
  このデータはそのまま Firestore に保存され、`buildRow` を経由してスプレッドシートに書き込まれ、POS/Monitor 画面に配信されます。これにより、クライアントUIでのDOM破壊やレンダリング遅延、Firestore ドキュメントサイズ肥大化を招きます。
- **推奨対策**:
  `customizations` が配列であること、最大件数（例: 最大5件）、および要素が `{ mode: "NO"|"ADD", target: string(20文字以内) }` であることを厳格にアサートする。

---

#### 🔴 [VULN-INJ-03] `updateVenueStatus` における `status` 値のホワイトリスト未検証
- **対象関数**: `updateVenueStatus` (Lines 1718–1725)
- **CVSS v3.1 スコア**: **6.5** (Medium) `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L`
- **脆弱性概要**:
  ```javascript
  // index.js Lines 1720
  const allowedUpdates = {
    status: updates.status, // "preparing" | "soon" | "live" | "ended"
  ...
  ```
  コメントには許容値が記載されていますが、**コード上での値チェックが存在しません**。
  攻撃者は `updates: { status: "<script>alert('XSS')</script>" }` や任意の破壊的ステータス文字列を送信可能です。これが来場者向け画面やステージ案内板に無害化されずに表示された場合、Stored XSS または画面崩壊を引き起こします。
- **推奨対策**:
  ```javascript
  const VALID_STATUSES = new Set(["preparing", "soon", "live", "ended"]);
  if (!VALID_STATUSES.has(updates.status)) {
    throw new functions.https.HttpsError("invalid-argument", "不正なステータスです。");
  }
  ```

---

#### 🟡 [VULN-INJ-04] `createOrder` における `items` 配列のサイズ上限チェック欠如
- **対象関数**: `createOrder` (Line 764, 821)
- **CVSS v3.1 スコア**: **5.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L`
- **脆弱性概要**:
  `items` が配列であることは確認されていますが、要素数の上限がありません。
  `const productDocs = await db.getAll(...itemRefs);`
  Firestore の `getAll` は内部的に1回のRPCで取得しますが、引数が多すぎる場合（500件以上など）や重複した無効なIDが多数含まれる場合にパフォーマンス劣化や内部エラーを引き起こします。
- **推奨対策**:
  `if (items.length > 20) throw new functions.https.HttpsError("invalid-argument", "1度に注文できる商品種類数は20件までです。");` を追加する。

---

### 分類 3: ビジネスロジック・レースコンディション (Business Logic & Race Conditions)

---

#### 🚨 [VULN-BIZ-01] `createOrder` における重複注文チェックの TOCTOU レースコンディション
- **対象関数**: `createOrder` (Lines 783–795, 860–897)
- **CVSS v3.1 スコア**: **7.5** (High) `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:H`
- **脆弱性概要**:
  モバイルオーダーの二重注文を防止するため、「受付中ステータスの注文が存在する場合は拒否する」ロジックが組み込まれています。
  ```javascript
  // index.js Lines 785-795 (トランザクションの外側でクエリ実行)
  const activeOrderSnap = await db.collection("orders")
    .where("userId", "==", uid)
    .where("status", "in", ["cooking", "ready_to_serve", "ready_for_pickup"])
    .limit(1)
    .get();
  if (!activeOrderSnap.empty) {
    throw new functions.https.HttpsError("already-exists", "既に受付中の注文があります。");
  }

  // --- この間に店舗チェック、商品取得、金額計算などの非同期待ちが発生 ---

  // index.js Lines 860 (ここで初めてトランザクション開始)
  const result = await db.runTransaction(async (tx) => {
    const receiptNumber = await getNextReceiptNumber(orderChannel, tx);
    ...
    tx.set(orderRef, orderData);
  });
  ```
  **競合のメカニズム (Time-of-Check to Time-of-Use)**:
  悪意あるユーザーまたは通信環境の不安定な端末から、同時に2件（またはそれ以上）の `createOrder` リクエストが送信された場合：
  1. リクエストAとリクエストBがほぼ同ミリ秒で `activeOrderSnap` を取得する。
  2. 両方の時点ではまだ先行注文が存在しないため、**両方のリクエストで `activeOrderSnap.empty === true` となる（チェック突破）**。
  3. リクエストAがトランザクションに入り、注文Aを作成・コミットする。
  4. 続いてリクエストBがトランザクションに入り、注文Bを作成・コミットする。
  5. **結果**: 1ユーザーにつき1注文のみというシステム原則が完全に破綻し、同一人物による二重・三重注文が成立する。
- **推奨対策**:
  ユーザーごとに1つ存在するドキュメント（例: `users/{uid}` または `user_active_orders/{uid}`）を `tx.get()` でロックし、トランザクション内で受付中フラグまたはアクティブ注文IDを排他的に更新する。

---

#### 🔴 [VULN-BIZ-02] SOK 注文確定（`confirmSokOrder`）における重複注文チェックの完全欠落
- **対象関数**: `confirmSokOrder` (Lines 2230–2290)
- **CVSS v3.1 スコア**: **7.5** (High) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`
- **脆弱性概要**:
  `createOrder`（モバイルオーダー）では一応重複注文チェックが存在しますが、**`confirmSokOrder` には「ユーザーが既に調理待ち・呼出待ちの注文を持っているか」のチェックが一切実装されていません**。
  来場者は、自分のモバイルオーダーが調理中であっても、SOK端末でQRを読み取って確定させることで、何件でも並行して注文を増殖させることができます。また、SOK注文を複数台のiPadで同時にスキャン・確定することも可能です。
- **推奨対策**:
  `confirmSokOrder` のトランザクション内、またはその直前で、同一 `uid` のアクティブ注文が存在しないことを検証する。

---

#### 🔴 [VULN-BIZ-03] `confirmSokOrder` における店舗営業状態および緊急停止状態の再検証欠如
- **対象関数**: `confirmSokOrder` (Lines 2248–2281)
- **CVSS v3.1 スコア**: **6.5** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`
- **脆弱性概要**:
  SOK注文の作成時（`createSokProvisional`）には店舗が `open` であるかチェックされていますが、来場者がQRを読み取って確定する `confirmSokOrder` では、**店舗ドキュメント（`stores/{storeId}`）のステータス（`operationStatus`, `isEmergencyStopped`）が一切再検証されていません**。
  仮注文を作成した後に、店舗スタッフが「営業一時停止」を押したり、本部が「全注文緊急停止（`isEmergencyStopped: true`）」を発動した場合でも、来場者のスマホから `confirmSokOrder` が呼ばれると、**緊急停止を貫通して `status: "cooking"` の正式注文が確定・発番されてしまいます**。
- **推奨対策**:
  `confirmSokOrder` のトランザクション内で `stores/{order.storeId}` を取得し、`operationStatus === "open"` かつ `!isEmergencyStopped` であることを確認する。

---

#### 🔴 [VULN-BIZ-04] ステータス遷移関数群におけるトランザクション不使用と状態不整合
- **対象関数**: `kitchenComplete`, `callForPickup`, `completeOrder`, `cancelOrder` (Lines 947–1057)
- **CVSS v3.1 スコア**: **6.8** (Medium) `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N`
- **脆弱性概要**:
  ステータス変更を行う関数群が、トランザクション（`db.runTransaction`）を使用せず、通常の `orderRef.get()` の後に `orderRef.update()` を実行しています。
  ```javascript
  // kitchenComplete の例
  const { orderRef, orderData } = await getOrderForTransition(context, requestData.orderId);
  if (orderData.status !== "cooking") throw ...;
  // ── ここで別の処理（キャンセルや自動BAN）が割り込む余地がある ──
  await orderRef.update({ status: "ready_to_serve", ... });
  ```
  **実害シナリオ (誤BANの発生)**:
  1. 呼出中（`ready_for_pickup`）から5分が経過する直前、店舗スタッフが商品を引き渡し、`completeOrder` を呼び出す。
  2. 同時にバックグラウンドで `abandonStaleOrders`（定期ジョブ）が起動する。
  3. `abandonStaleOrders` が注文を `abandoned` に変更し、ユーザーを `banned_users` に登録する。
  4. 直後に `completeOrder` の `orderRef.update({ status: "completed" })` が実行され、ステータスは `completed` で上書きされる。
  5. **結果**: 注文は提供完了として記録されているにもかかわらず、来場者のアカウントは `banned_users` に登録されたままとなり、二度と注文できなくなる。
- **推奨対策**:
  ステータス遷移はすべて `db.runTransaction` を使用し、遷移前ステータスの事前条件（Pre-condition）を厳密にアサートした上で不可分に更新する。

---

#### 🟡 [VULN-BIZ-05] `claimSokOrder` における同一ユーザーによる複数仮注文占有（SOK端末DoS）
- **対象関数**: `claimSokOrder` (Lines 2158–2222)
- **CVSS v3.1 スコア**: **5.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L`
- **脆弱性概要**:
  `claimSokOrder` は二重読み取りを防ぐトランザクションを備えていますが、「同一の来場者UIDが同時に何件の仮注文を Claim 保持できるか」の制限がありません。
  悪意ある来場者が店頭に並ぶ複数の SOK iPad の画面に表示された QR コードを連続してスキャン・Claim した場合、確定（Confirm）せずに放置することで、最大5分間（`expireSokOrders` が走るまで）すべての端末の注文を拘束し、他人の利用を妨害できます。
- **推奨対策**:
  `claimSokOrder` 実行時に、当該 `uid` が既に `claimed` 状態の未確定注文を保持している場合はエラーとする。

---

#### 🟡 [VULN-BIZ-06] 商品在庫数（実在庫数・上限）の管理欠落によるオーバーセル
- **対象関数**: `createOrder`, `createSokProvisional`
- **CVSS v3.1 スコア**: **5.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L`
- **脆弱性概要**:
  商品の販売可否は `isAvailable: boolean` フラグのみで管理されており、残数（在庫数量）の管理機能がバックエンドに存在しません。文化祭のピーク時に100人が同時に注文を送信した場合、店舗の材料・仕込み上限（例: 残り20食）を大幅に超える注文が一瞬で成立してしまい、大量の現場キャンセルやトラブルを引き起こすリスクがあります。
- **推奨対策**:
  `items/{itemId}` に `stockCount: number` を導入し、トランザクション内で在庫を減算（`stockCount >= quantity`）するか、販売枠制限を設ける。

---

### 分類 4: シークレット管理・情報漏洩 (Secrets & Information Disclosure)

---

#### 🚨 [VULN-SEC-01] `functions/setupVenueAdmin.js` 内の本番認証シークレットのハードコーディングとコミット
- **対象ファイル**: `functions/setupVenueAdmin.js` (Lines 20–21, 44–46)
- **CVSS v3.1 スコア**: **8.6** (High) `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`
- **脆弱性概要**:
  会場ステータス管理用の初期セットアップスクリプトに、固定のアクセストークンとパスワードが平文で直接記述されており、Gitリポジトリにコミットされています。
  ```javascript
  // setupVenueAdmin.js Lines 20-21
  const password = "teacher_password_2026"; // 任意のパスワードに変更可能
  const urlToken = "token_a8f3e2c9d1"; // 任意のランダムなトークンに変更可能
  ...
  console.log("アクセス用URL (本番用): https://nanryosai-2026-a4091.web.app/admin/venue.html?token=" + urlToken);
  console.log("パスワード: " + password);
  ```
  リポジトリの閲覧権限を持つ者、または誤って公開リポジトリ化・流出した場合、本番環境の会場管理画面（`https://nanryosai-2026-a4091.web.app/admin/venue.html?token=token_a8f3e2c9d1`）への認証情報が完全に暴露されます。
- **推奨対策**:
  1. ハードコードされたパスワードとURLトークンを直ちに破棄・再生成する。
  2. コマンドライン引数（`process.argv`）または環境変数経由で動的に受け取る設計に変更する。
  3. 当該ファイルを `.gitignore` に追加するか、デプロイ資材から除外する。

---

#### 🔴 [VULN-SEC-02] PBKDF2 パスワードハッシュのストレッチング回数不足 (10,000回)
- **対象箇所**: `functions/index.js` (Line 478, Line 492), `setupVenueAdmin.js` (Line 12)
- **CVSS v3.1 スコア**: **7.4** (High) `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N`
- **脆弱性概要**:
  店舗パスワードおよび会場管理パスワードのハッシュ化に Node.js の `crypto.pbkdf2Sync` が使用されていますが、反復回数（Iterations）が **10,000回** に設定されています。
  ```javascript
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  ```
  **OWASP Password Storage Cheat Sheet 基準**:
  - PBKDF2-HMAC-SHA512 の推奨反復回数は **210,000回以上**（SHA256 の場合は 600,000回以上）。
  10,000回という設定は現代の GPU クラスタや専用 ASIC 環境において数分〜数時間で数千万〜数億回試行可能なレベルであり、万が一 `store_secrets` や `venue_admin_config` のハッシュ値がバックアップ等から流出した場合、容易に平文パスワードが逆算されます。
- **推奨対策**:
  反復回数を最低でも `210,000` 回に引き上げる。または、よりメモリ困難性の高い `scrypt` や `argon2` への移行を検討する。

---

#### 🟡 [VULN-SEC-03] `functions/run_admin_callables.js` などの保守スクリプトの残存
- **対象ファイル**: `functions/run_admin_callables.js`
- **CVSS v3.1 スコア**: **3.7** (Low) `CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N`
- **脆弱性概要**:
  テスト用のモックコンテキスト（`auth: { token: { email: "ynrcs1000@gmail.com" } }`）を含むスクリプトが `functions/` 直下に配置されたままになっています。
  Cloud Functions のデプロイ時、`functions/` 内の全ファイルがソースコードアーカイブとして GCP 上にアップロードされるため、不要なファイルを含めることはアタックサーフェスの拡大につながります。

---

### 分類 5: DoS・リソース枯渇・依存関係 (DoS, Quotas & Dependencies)

---

#### 🔴 [VULN-DOS-01] ウォームアップバイパスロジックの認証前実行による課金 DoS（Financial DoS）
- **対象関数**: `createOrder`, `createSokProvisional`, `claimSokOrder`, `confirmSokOrder`, `kitchenComplete`, `callForPickup`, `completeOrder` (全7関数)
- **CVSS v3.1 スコア**: **7.5** (High) `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`
- **脆弱性概要**:
  コールドスタート対策として、各関数の先頭に以下のバイパスロジックが組み込まれています：
  ```javascript
  // createOrder の例 (Line 750-752)
  const requestData = data.data && typeof data.data === "object" ? data.data : data;
  if (requestData && requestData.warmup === true) return { warmup: true };
  requireAppCheck(context);
  ```
  このチェックは、**`requireAppCheck(context)` および `context.auth` の検証よりも前に実行されます**。
  悪意ある攻撃者は、App Check トークンも Firebase 認証も持たない状態で、HTTP POST により `{"data": {"warmup": true}}` を大量送信可能です。
  Cloud Functions はリクエストに応じてオートスケールするため、何千ものインスタンスが瞬時にプロビジョニングされ、Google Cloud の課金上限（Billing Quota）を急速に消費させられるリスクがあります。
- **推奨対策**:
  ウォームアップ判定を App Check 検証の「後」に行うか、GCP Cloud Scheduler の IAM サービスアカウント認証（OIDC トークン）を要求する内部専用 HTTP エンドポイントとして分離する。

---

#### 🔴 [VULN-DOS-02] `getNextReceiptNumber` におけるトランザクション内反復クエリと単一ドキュメント競合
- **対象関数**: `getNextReceiptNumber` (Lines 189–232)
- **CVSS v3.1 スコア**: **7.1** (High) `CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:N/A:H`
- **脆弱性概要**:
  ```javascript
  for (let attempt = 0; attempt < rangeSize; attempt++) {
    ...
    const dupQuery = db.collection("orders")
      .where("receiptNumber", "==", candidate)
      .where("status", "in", activeStatuses);
    const dupSnap = await transaction.get(dupQuery);
    if (dupSnap.empty) { ... return candidate; }
    candidate++;
  }
  ```
  1. **トランザクション内クエリの多重実行**: 空き番号が見つかるまで、Firestore トランザクションの中で順次 `transaction.get(dupQuery)` を実行しています。アクティブ注文が多い時間帯には、1回のトランザクション内で何十回もの読み取りクエリが実行され、関数実行時間が極端に増大します。
  2. **単一カウンタードキュメントのホットスポット**: 全モバイル注文が単一の `counters/receipt_mobile` ドキュメントをトランザクションで読み書きします。Firestore の単一ドキュメント書き込み上限（1秒間に約1回）に近づくと、トランザクションの Contention（衝突・再試行）が頻発し、注文受付がタイムアウトエラーで連鎖的に失敗します。
- **推奨対策**:
  アクティブ番号の重複管理をクエリではなく、現在使用中の番号一覧ドキュメントまたはメモリキャッシュ/分散カウンターで管理する。

---

#### 🔴 [VULN-DOS-03] `syncOrdersToSheets` における Google Sheets API クォータ枯渇と O(N) 走査遅延
- **対象関数**: `syncOrdersToSheets` (Lines 1375–1568)
- **CVSS v3.1 スコア**: **6.5** (Medium) `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`
- **脆弱性概要**:
  毎分実行される同期バッチにおいて、対象店舗ごとに以下の処理が行われます：
  ```javascript
  // A列全体（ヘッダから最終行まで）を毎回取得
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_TAB}'!A:A`,
  });
  ```
  1. **API クォータ制限**: Google Sheets API のクォータ上限は **プロジェクトあたり 300 requests/min** です。店舗数（最大数十店舗）が増え、各店舗に対して `get`, `batchUpdate`, `append` を毎分実行すると、短時間のスパイクで 429 Too Many Requests が発生します。
  2. **O(N) データ肥大化**: 注文数が数千件に達すると、毎分全行の注文IDをダウンロードして JavaScript のループで線形探索（`for (let i = 1; i < rows.length; i++)`）するため、メモリ消費と実行時間が肥大化します。
- **推奨対策**:
  同期済み注文IDの行インデックスを Firestore（`sheet_sync_meta`）にキャッシュし、差分追記のみを行う構成に最適化する。

---

#### 🟡 [VULN-DOS-04] `sendOrderUpdateNotification` における FCM トークン配列無制限化によるクラッシュ
- **対象関数**: `sendOrderUpdateNotification` (Lines 1128–1217)
- **CVSS v3.1 スコア**: **5.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L`
- **脆弱性概要**:
  ```javascript
  const message = {
    notification: { title, body },
    data: { orderId, url: `/status.html?orderId=${orderId}` },
    tokens: fcmTokens,
  };
  const response = await getMessaging().sendEachForMulticast(message);
  ```
  Firestore ルール上、ユーザーは自身の `users/{uid}` ドキュメントを自由に更新できます。悪意あるユーザーが `fcmTokens` に 500 件を超える文字列配列を書き込んだ場合、Firebase Admin SDK の `sendEachForMulticast` は **最大500トークン上限の仕様** により例外（`messaging/invalid-payload`）をスローし、通知処理がクラッシュします。
- **推奨対策**:
  `fcmTokens.slice(0, 10)` など、1ユーザーあたりの最大トークン数を安全な上限（例: 最大5〜10端末）に切り詰めて送信する。

---

#### 🟡 [VULN-DOS-05] `updateStoreStatus` での全商品更新に伴うトリガー連鎖負荷 (Thundering Herd)
- **対象関数**: `updateStoreStatus` (Line 1840) vs `syncStoreItemAvailability` (Line 2397)
- **CVSS v3.1 スコア**: **5.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L`
- **脆弱性概要**:
  店舗管理者が「営業開始（open）」を実行すると、店舗内の全商品の `isAvailable` がバッチ更新されます。これにより、商品数と同じ回数だけ `syncStoreItemAvailability`（Firestore Trigger）が一斉に起動します。全インスタンスが同時に `stores/{storeId}` の `update()` を実行するため、同一ドキュメントへの書込衝突（Contention）が発生し、リソースの無駄な浪費を招きます。
- **推奨対策**:
  店舗の `updateStoreStatus` 側で既に `availableItemCount` を再計算して店舗ドキュメントを更新している場合は、トリガー側で不要な重複更新をスキップするフラグを設ける。

---

#### 🟡 [VULN-DOS-06] バッチ定期ジョブにおける Firestore 500件書き込み上限未考慮
- **対象関数**: `manageStoreStatusAndWarmup` (Line 1880), `abandonStaleOrders` (Line 1952), `expireSokOrders` (Line 2315)
- **CVSS v3.1 スコア**: **5.3** (Medium) `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`
- **脆弱性概要**:
  Firestore の `db.batch()` には **最大500件** の操作上限があります。
  `abandonStaleOrders` では1件の放置注文につき 2件（注文更新 + BAN登録）のバッチ操作を追加するため、放置注文が **250件** を超えると `batch.commit()` が例外を投げて全件ロールバックされ、定期バッチが停止します。
- **推奨対策**:
  400件ごとにバッチを分割コミット（Chunking）するヘルパーを適用する。

---

#### 🚨 [VULN-DOS-07] `functions/package.json` における 30件の既知依存脆弱性
- **対象ファイル**: `functions/package.json`, `package-lock.json`
- **CVSS v3.1 スコア**: **9.8** (Critical) `GHSA-xq3m-2v4x-88gg`, `GHSA-mp7j-qc5w-4988`
- **脆弱性概要**:
  `npm audit` の実行結果により、計30件（Critical 3件, High 12件, Moderate 13件, Low 2件）の脆弱性が検出されました。
  主な危険依存関係：
  1. **`protobufjs` (Critical / Code Injection & Prototype Pollution)**: `firebase-admin` の推移的依存。細工されたプロパティによるリモートコード実行および DoS。
  2. **`websocket-driver` (Critical / Resource Limit Bypass)**: メッセージ圧縮およびプロトコル長の偽装によるリソース枯渇。
  3. **`lodash` (High / Prototype Pollution)**: `_.template` や `_.unset` におけるプロトタイプ汚染。
  4. **`minimatch` / `picomatch` (High / ReDoS)**: 正規表現の後戻り（Backtracking）によるCPU100%枯渇。
- **推奨対策**:
  `npm audit fix` および推移的依存関係の解決を実施し、安全なバージョンに更新する。

---

## 4. 脆弱性改善推奨ロードマップ (Actionable Remediation)

| 優先度 | 脆弱性ID | 対象箇所 | 是正措置の概要 | 難易度 |
| :-: | :--- | :--- | :--- | :-: |
| 🚨 **P0 (緊急)** | VULN-SEC-01 | `setupVenueAdmin.js` | パスワード・URLトークンのハードコード削除、本番設定の再生成 | 低 |
| 🚨 **P0 (緊急)** | VULN-BIZ-01 | `createOrder` | ユーザーロックドキュメントを用いたトランザクション内二重注文防止の実装 | 中 |
| 🚨 **P0 (緊急)** | VULN-DOS-07 | `package.json` | 依存ライブラリのアップデートと脆弱性解消 (`npm audit fix`) | 低 |
| 🔴 **P1 (高)** | VULN-INJ-01 | `createOrder`, `createSokProvisional` | `quantity` に最大値（例: 1〜10）の境界値検証を追加 | 低 |
| 🔴 **P1 (高)** | VULN-INJ-02 | `createOrder`, `createSokProvisional` | `customizations` 配列の型・長手・キーホワイトリスト検証追加 | 低 |
| 🔴 **P1 (高)** | VULN-INJ-03 | `updateVenueStatus` | `status` および `venueId` のホワイトリスト検証追加 | 低 |
| 🔴 **P1 (高)** | VULN-BIZ-02 | `confirmSokOrder` | SOK確定時における同一ユーザーのアクティブ注文重複チェック追加 | 中 |
| 🔴 **P1 (高)** | VULN-BIZ-03 | `confirmSokOrder` | SOK確定時における店舗営業ステータスおよび緊急停止の再検証追加 | 低 |
| 🔴 **P1 (高)** | VULN-BIZ-04 | 現場ステータス遷移4関数 | `db.runTransaction` による事前条件アサートと不可分更新化 | 中 |
| 🔴 **P1 (高)** | VULN-AUTH-01 | `loginVenueAdmin` | レート制限の追加、タイミングセーフ比較への変更 | 中 |
| 🔴 **P1 (高)** | VULN-AUTH-02 | `updateVenueStatus` | 会場IDのホワイトリストおよびスコープ検証の追加 | 低 |
| 🔴 **P1 (高)** | VULN-AUTH-03 | `loginStore` | 店舗ログインの連続失敗ロックアウト（レート制限）実装 | 中 |
| 🔴 **P1 (高)** | VULN-SEC-02 | `index.js`, `setupVenueAdmin.js` | PBKDF2 ストレッチング回数を 10,000回 → 210,000回に引き上げ | 低 |
| 🔴 **P1 (高)** | VULN-DOS-01 | 全ウォームアップ対象関数 | ウォームアップバイパスの判定を App Check 検証後に移動 | 低 |
| 🔴 **P1 (高)** | VULN-DOS-02 | `getNextReceiptNumber` | 発番ロジックのトランザクション内反復クエリの廃止・軽量化 | 高 |
| 🟡 **P2 (中)** | VULN-DOS-03 | `syncOrdersToSheets` | Google Sheets API 呼び出しのキャッシュ化と差分同期への変更 | 高 |
| 🟡 **P2 (中)** | VULN-DOS-04 | `sendOrderUpdateNotification` | FCM 送信トークン数を `tokens.slice(0, 10)` に制限 | 低 |
| 🟡 **P2 (中)** | VULN-DOS-06 | 定期バッチジョブ3種 | Batch 書込の 400件分割コミット（Chunking）処理の導入 | 低 |
| 🟡 **P2 (中)** | VULN-AUTH-04 | `loginStore` | 旧方式平文パスワード判定コードの完全廃止 | 低 |
| 🟡 **P2 (中)** | VULN-AUTH-05 | 現場ステータス遷移4関数 | `isSuperAdminToken` による管理者緊急操作バイパスの許可 | 低 |
| 🟡 **P2 (中)** | VULN-BIZ-05 | `claimSokOrder` | 1ユーザーが保持できる Claim 状態の未確定注文を1件に制限 | 低 |

---

## 5. 監査結論

本監査において、南陵祭2026のバックエンドは、**「Google Identity Services + HMAC-SHA256ハッシュ匿名UID」によるゼロ・ナレッジ（個人情報完全非保持）設計**という極めて先進的で強固なプライバシー基盤を有していることが改めて確認されました。

一方で、文化祭特有のアクセス集中や店頭での例外操作を想定した際、**「トランザクション境界のズレによるTOCTOU重複注文」**、**「SOK確定時の緊急停止チェック漏れ」**、**「注文数量上限やカスタマイズの未検証」**、そして**「会場管理スクリプトにおけるシークレット直書きとPBKDF2反復回数不足」**という重大な脆弱性が特定されました。

実コードの改変を伴わない本監査フェーズの完了を受け、上記のロードマップ（P0〜P1）に基づき、計画的な改修と検証テストを実施することを強く推奨します。
