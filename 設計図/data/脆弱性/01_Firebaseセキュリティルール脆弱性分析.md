# Firebaseセキュリティルール脆弱性分析レポート

**プロジェクト**: 南陵祭2026 (nanryosai-2026)  
**監査対象**: `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `antigravity/firebase_CONTEXT.md`, 関連コレクション群  
**役割**: Firebaseセキュリティルール専門監査官 (Firebase Rules & Auth Auditor)  
**作成日**: 2026年9月9日  
**ステータス**: 初版完了（実コードへの変更は行わず、調査・分析・改善案の提示のみ）

---

## 1. エグゼクティブサマリ

南陵祭2026システムのセキュリティルール（FirestoreおよびCloud Storage）に対し、徹底的な脅威分析、権限評価の穴、IDOR、スキーマ検証、DoS耐性、プライバシー侵害リスクの観点から包括的なセキュリティ監査を実施しました。

本プロジェクトは「ゼロ・ナレッジ匿名UIDアーキテクチャ」や「注文作成・決済・ステータス遷移のCloud Functions集約」など、高いセキュリティ意識のもとで設計されています。しかしながら、**セキュリティルール層（firestore.rules / storage.rules）の実装において、「画面上では一部しか表示しないから安全」「個人情報は入っていないから公開しても安全」という誤認に基づく過信**や、**ファイルサイズ制限・スキーマバリデーションの完全欠落**に起因する重大なセキュリティホールが複数検出されました。

### 脆弱性深刻度別サマリ

| 深刻度 | 件数 | 主な対象 | 概要 |
| :--- | :---: | :--- | :--- |
| **Critical** | 1 | Cloud Storage | ファイルサイズ制限の完全欠落によるストレージ枯渇・高額課金攻撃（DoS/DoW） |
| **High** | 5 | Firestore / Storage | `ready_for_pickup` 注文の全フィールド未認証公開、`users` サブコレクション無制限作成・スキーマ欠落、`items` のマイナス価格等のバリデーション欠落、`stores` スプレッドシートID/URL全公開、SVGによるStored XSS |
| **Medium** | 6 | Firestore / Storage | `counters` の全店舗管理者への過剰開示、`_metadata` の安全弁露出、SOK仮注文ハイジャック、`users` 直接削除による不整合、既存画像の上書き・削除、トークン失効ラグ |
| **Low** | 2 | Firestore | POS注文客の追跡不可（整合性）、`itemId` 命名規則の未検証 |
| **合計** | **14** | | |

---

## 2. 重点チェック項目に基づく分析総括

### (1) コレクションごとの read / get / list / write / create / update / delete 権限の穴
1. **`orders` コレクション (`status == "ready_for_pickup"`)**:
   - Firestoreルールには「フィールド単位の読み取り制限（Projection）」が存在しません。そのため、モニター用として `status == "ready_for_pickup"` の読み取りを未認証に開放していることで、**注文商品一覧・金額・注文者UID・タイムスタンプ等の全フィールドが全世界に丸見え**になっています。
2. **`users` コレクション (`{document=**}`)**:
   - 再帰的ワイルドカード `{document=**}` により、直下ドキュメントだけでなく任意のサブコレクション（`/users/{uid}/*/*`）に対しても全権限（作成・更新・削除）が開放されており、リソース浪費・DoSの温床となっています。
3. **`counters` コレクション**:
   - クライアント側（JavaScript）からは一切使用されていないにもかかわらず、店舗管理者（`role == 'store_admin'`）全員に全カウンター（`receipt_pos`, `receipt_mobile`, `receipt_sok`）の読み取りが許可されており、文化祭全体の総売上・総注文ペースを他店舗から推測できます。
4. **`stores` コレクション**:
   - GoogleスプレッドシートのIDおよびURL（全注文履歴が同期されるシート）が公開ドキュメントに含まれており、未認証でスクレイピング可能です。スプレッドシートの権限設定次第で重大な情報流出につながります。

### (2) IDOR (Insecure Direct Object Reference) / なりすまし
1. **SOK（セルフオーダーキオスク）の仮注文横取り**:
   - `orderChannel == "sok" && sokStatus == "pending"` の注文が未認証で `get` 可能なため、QRコードのURLや注文IDを覗き見られた場合、第三者が先に `claimSokOrder` を呼び出して注文をハイジャックできるリスクがあります。
2. **Custom Claims の失効遅延（Revocation Lag）**:
   - 店舗管理者権限（`role: "store_admin"`）の付与・剥奪において、Firebase IDトークンは最大1時間キャッシュされるため、権限剥奪後も旧トークンが有効期限を迎えるまでルール層のチェックを突破し続けます。

### (3) データのバリデーション（スキーマ検証）の欠落
1. **`items` コレクション**:
   - 店舗管理者による書き込みが許可されていますが、フィールドの型、必須項目、値の範囲（例: `price >= 0`）のチェックが皆無です。マイナス価格や数MBの巨大文字列、未定義フィールドの注入が可能です。
2. **`users` コレクション**:
   - `['email', 'displayName', 'photoURL']` の3フィールドを除外しているのみで、その他のキーや型、配列サイズ（`fcmTokens` 等）の検証がありません。

### (4) Cloud Storage ルール (`storage.rules`)
1. **ファイルサイズ制限（`request.resource.size`）の欠落**:
   - ルール層にサイズ制限がないため、REST APIやSDKを通じて数GB単位のファイルを直接アップロードし、ストレージ容量枯渇や課金破綻を引き起こせます。
2. **`image/.*` による SVG アップロードと Stored XSS**:
   - `image/svg+xml` が許可されているため、JavaScriptを含む悪意あるSVGをアップロードし、公開URLを踏ませることでスクリプトを実行可能です。

---

## 3. 個別脆弱性詳細レポート

---

### 【SEC-FS-01】`orders` コレクションにおける `ready_for_pickup` 注文の未認証・全フィールド公開

- **深刻度**: **High**
- **該当ファイル・該当行**: `firestore.rules` 80–81行目, 90–91行目
  ```javascript
  79: // (c) SOK未確定仮注文（QR読み取り等、IDを知っている場合のみ許可）
  80: || (resource.data.orderChannel == "sok" && resource.data.sokStatus == "pending")
  81: || resource.data.status == "ready_for_pickup";
  ...
  91: || resource.data.status == "ready_for_pickup";
  ```
- **背景・設計意図**:
  - `pos/monitor.html` において、呼び出し中（`ready_for_pickup`）の受付番号を画面上に表示するため、誰でも読み取れるように設計された。
  - ルール内コメントに「注文データには氏名等の個人情報は保存されず、ユーザー識別はUIDのみであるため安全」との記述がある。
- **攻撃シナリオ**:
  1. 攻撃者（一般来場者、部外者、競合生徒）が、ブラウザの開発者ツールやスクリプトから未認証のまま以下のクエリを実行する：
     ```javascript
     const q = query(collection(db, "orders"), where("status", "==", "ready_for_pickup"));
     onSnapshot(q, (snap) => { ... });
     ```
  2. Firestoreルールはドキュメント単位でアクセスを許可するため、クライアントにはドキュメントの**全フィールド**が送信される。
  3. 攻撃者は、リアルタイムに呼び出される全店舗の注文ドキュメントから以下を恒常的に傍受・取得する：
     - `userId`: 注文者の匿名UID（個人の特定・行動履歴追跡）
     - `items`: 注文した商品名、単価、個数、トッピング等のカスタマイズ内容
     - `totalPrice`: 合計金額
     - `storeId`: 購入店舗
     - `receiptNumber`: 受付番号
     - `createdAt`, `readyForPickupAt`: 注文・呼出時刻
- **影響**:
  - **プライバシー侵害・個人追跡**: 特定の生徒や来場者のUIDが分かれば、文化祭期間中に「いつ、どの店で、何を買い、いくら使ったか」がリアルタイムに完全に監視・プロファイリングされる。
  - **全店舗の売上・経営情報の漏洩**: 競合模擬店の売上動向、客単価、人気メニューがリアルタイムで筒抜けになる。
- **推奨修正ルールコード**:
  - **アーキテクチャ改善（推奨）**: モニター表示用の軽量な公開サブコレクション（例: `active_pickups/{orderId}` または `stores/{storeId}/public_displays/monitor`）を新設し、Cloud Functions（`callForPickup`）から `{ receiptNumber: 7001, status: "ready_for_pickup", updatedAt: ... }` のみを発行・同期する。
  - **ルール層での応急処置**: 誰でも読める状態を廃止し、最低限 `isAuthenticated()` を要求した上で、一覧取得（`list`）は禁止し、単一ドキュメント取得（`get`）のみ自分の注文または店舗管理者に限定する。
  ```javascript
  // firestore.rules (orders)
  match /orders/{orderId} {
    // get は 店舗管理者、SuperAdmin、または注文者本人のみ
    allow get: if isStoreAdmin(resource.data.storeId) || isSuperAdmin()
               || (isAuthenticated() && request.auth.uid == resource.data.userId)
               || (resource.data.orderChannel == "sok" && resource.data.sokStatus == "pending");

    // list は 店舗管理者、SuperAdmin、または注文者本人のクエリのみ許可（全開放 list を全廃）
    allow list: if isStoreAdmin(resource.data.storeId) || isSuperAdmin()
                || (isAuthenticated() && request.auth.uid == resource.data.userId);
  }
  ```

---

### 【SEC-FS-02】`users` コレクションにおける `{document=**}` 再帰ワイルドカードによるサブコレクション保護破綻

- **深刻度**: **High**
- **該当ファイル・該当行**: `firestore.rules` 111–119行目
  ```javascript
  111: match /users/{userId}/{document=**} {
  112:   allow read: if (isAuthenticated() && request.auth.uid == userId) || isSuperAdmin();
  113:   // delete 時: request.resource が null のため PII チェックは行わず UID 一致のみで許可
  114:   allow delete: if isAuthenticated() && request.auth.uid == userId;
  115:   // create, update 時のみ: PII フィールドの書き込みをルール層で禁止
  116:   allow create, update: if isAuthenticated() && request.auth.uid == userId
  117:                && !request.resource.data.keys().hasAny(
  118:                     ['email', 'displayName', 'photoURL']);
  119: }
  ```
- **背景・設計意図**:
  - `users/{uid}` とそのサブコレクション（例: `cart`）を一括して保護する意図で `{document=**}` が使用された。
- **攻撃シナリオ**:
  1. 攻撃者（一般ログインユーザー）が、自身のUID配下に任意の深い階層のサブコレクションやドキュメントをスクリプトで毎秒数百件作成する：
     ```javascript
     for (let i = 0; i < 10000; i++) {
       setDoc(doc(db, "users", myUid, "spam_collection_" + i, "doc"), { payload: "A".repeat(500000) });
     }
     ```
  2. ルールは `request.auth.uid == userId` のみで許可するため、すべて正常に書き込まれる。
  3. `users/{uid}` 直下のドキュメント構造とサブコレクションのドキュメント構造が区別されず、無制限にリソースを消費される。
- **影響**:
  - **リソース消費・サービス妨害 (DoS)**: ストレージ容量の逼迫およびFirestore書き込み回数（課金枠）の意図的な消費。
  - **将来の設計破綻**: サブコレクションに別のバリデーションを適用できず、全階層で共通のPII禁止チェック（`email`, `displayName`, `photoURL`）が引きずられる。
- **推奨修正ルールコード**:
  - 再帰ワイルドカードを廃止し、ドキュメントレベルとサブコレクションを明確に分離する。
  ```javascript
  // firestore.rules (users)
  match /users/{userId} {
    allow read: if (isAuthenticated() && request.auth.uid == userId) || isSuperAdmin();
    allow create, update: if isAuthenticated() && request.auth.uid == userId
                         && isValidUserData();
    allow delete: if false; // 直接削除は禁止し、deleteMyAccount Function に一本化

    // カート等のサブコレクションは必要に応じて明示的に定義
    match /cart/{itemId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }
  }
  ```

---

### 【SEC-FS-03】`users` コレクションのスキーマ検証欠落による任意フィールド注入・リソース浪費 (DoS)

- **深刻度**: **High**
- **該当ファイル・該当行**: `firestore.rules` 116–119行目
  ```javascript
  116: allow create, update: if isAuthenticated() && request.auth.uid == userId
  117:              && !request.resource.data.keys().hasAny(
  118:                   ['email', 'displayName', 'photoURL']);
  ```
- **攻撃シナリオ**:
  1. 攻撃者が、禁止された3つのキー以外のフィールド（例: `fcmTokens`, `favoriteItemIds`, `customHugeField`）に悪意あるデータを注入する。
     - 例1: `fcmTokens` 配列に数千件の他人のトークンや無効な巨大文字列を注入。Cloud Functions（`sendOrderUpdateNotification`）の一斉プッシュ送信時にFCM APIの制限超過や例外クラッシュを誘発。
     - 例2: `termsAgreedAt` を改ざんし、規約同意チェックのバイパスや偽装を行う。
     - 例3: 1ドキュメントの上限（1MB）近くまで巨大な文字列やバイナリを書き込む。
- **影響**:
  - バックエンド処理（Cloud Functions）の例外停止や高負荷。
  - システムが意図しないデータの永続化。
- **推奨修正ルールコード**:
  ```javascript
  function isValidUserData() {
    let allowedFields = ['nickname', 'fcmTokens', 'termsAgreedAt', 'favoriteItemIds', 'lastLoginAt', 'createdAt', 'notificationEnabled', 'permissionStatus', 'deviceType'];
    let data = request.resource.data;
    return data.keys().hasOnly(allowedFields)
      && (!('fcmTokens' in data) || (data.fcmTokens is list && data.fcmTokens.size() <= 10))
      && (!('favoriteItemIds' in data) || (data.favoriteItemIds is list && data.favoriteItemIds.size() <= 100))
      && (!('nickname' in data) || (data.nickname is string && data.nickname.size() <= 30));
  }
  ```

---

### 【SEC-FS-04】`users` コレクションにおけるクライアント直接削除 (`delete`) 許可によるデータ不整合

- **深刻度**: **Medium**
- **該当ファイル・該当行**: `firestore.rules` 114行目
  ```javascript
  114: allow delete: if isAuthenticated() && request.auth.uid == userId;
  ```
- **背景・設計意図**:
  - アカウント退会時のデータ削除を意図した記述。
  - しかし `antigravity/firebase_CONTEXT.md` §2 では、アカウント削除は `deleteMyAccount` Callable Function で Auth レコード、Firestore `users/{uid}`、`cart`、注文履歴を整合的に全消去すると定義されている。
- **攻撃・障害シナリオ**:
  1. ユーザーまたはクライアント側スクリプトが、Functions を通さずに `deleteDoc(doc(db, "users", uid))` を直接実行する。
  2. Firestore 上のユーザー情報は削除されるが、Firebase Auth の認証レコードや過去の注文トランザクションデータは孤立して残留する。
  3. その後同一セッションでアクセスした際、ユーザー情報が存在しないことによるクライアント側スクリプトのヌルポインタ参照エラーや、Auth状態との不整合が発生する。
- **影響**:
  - データベースの整合性破壊、アカウント削除フローの統制喪失。
- **推奨修正ルールコード**:
  ```javascript
  // クライアントからの直接削除は禁止。Admin SDK (deleteMyAccount Function) に委譲
  allow delete: if false;
  ```

---

### 【SEC-FS-05】`counters` コレクションに対する全店舗管理者の読み取り過剰特権（全体売上推測リスク）

- **深刻度**: **Medium**
- **該当ファイル・該当行**: `firestore.rules` 123–126行目
  ```javascript
  123: match /counters/{document=**} {
  124:   allow read: if (isAuthenticated() && request.auth.token.role == 'store_admin') || isSuperAdmin();
  125:   allow write: if false; 
  126: }
  ```
- **背景・調査結果**:
  - コードベース全体（`main/` および `pos/` の全フロントエンド）を検索した結果、**クライアント側コードで `counters` コレクションを読み取っている箇所は一切存在しない**。
  - `counters` は、Cloud Functions（`createOrder`, `confirmSokOrder` 等）内のトランザクションでアトミックにインクリメント・発番するためにのみ使用されている。
- **攻撃シナリオ**:
  1. ある模擬店（例: 3年1組）のスタッフ権限を持つ生徒が、ブラウザのコンソールから `getDoc(doc(db, "counters", "receipt_mobile"))` や `receipt_pos`, `receipt_sok` を実行する。
  2. ルールは `request.auth.token.role == 'store_admin'` で許可しているため、店舗に関係なく取得に成功する。
  3. 文化祭期間中、定期的にこれらのカウンター値（`current`）をポーリングすることで、**文化祭全体および他店舗の累計注文数、時間あたりの注文発生ペース（売れ行き）をリアルタイムに推測・監視**できる。
- **影響**:
  - 最小権限の原則（Principle of Least Privilege）違反。
  - 模擬店間の売上競争における不当な情報取得（競合分析）。
- **推奨修正ルールコード**:
  ```javascript
  match /counters/{document=**} {
    // クライアントからの読み取りは不要のため原則禁止（SuperAdminのみ許可）
    allow read: if isSuperAdmin();
    allow write: if false; 
  }
  ```

---

### 【SEC-FS-06】`stores` コレクションにおけるスプレッドシートID/URL・内部識別子の全公開（未認証漏洩）

- **深刻度**: **High**
- **該当ファイル・該当行**: `firestore.rules` 35–38行目
  ```javascript
  35: match /stores/{storeId} {
  36:   allow read: if true; 
  37:   allow write: if isSuperAdmin(); // 管理者はコンソール等で変更
  38: }
  ```
- **背景・設計内容**:
  - 設計憲法§3.3 および `antigravity/firebase_CONTEXT.md` §4 より、`stores/{storeId}` には以下のフィールドが保持されている：
    - `spreadsheetId`: GoogleスプレッドシートのID
    - `spreadsheetUrl`: Googleスプレッドシートへの直接リンク
    - `loginId`: 店舗ログイン識別子
- **攻撃シナリオ**:
  1. 攻撃者が未認証で `getDocs(collection(db, "stores"))` を実行し、全店舗のドキュメントを取得する。
  2. 取得したデータから各店舗の `spreadsheetUrl` を抽出する。
  3. Googleスプレッドシート側の共有設定が「リンクを知っている全員が閲覧可能」または「学校ドメイン（`@gl.pen-kanagawa.ed.jp`）全員が閲覧可能」となっていた場合、**全店舗の注文全履歴（全商品の注文詳細、売上金額、キャンセル理由、調理〜呼出時間など）がスプレッドシート経由で直接漏洩**する。
  4. また、`loginId` が漏洩することで、店舗ポータルへの総当たり攻撃やログイン試行が容易になる。
- **影響**:
  - 全店舗の機密売上データ・顧客注文履歴の外部漏洩。
- **推奨修正ルールコード**:
  - **構造的対策**: `spreadsheetId`, `spreadsheetUrl`, `loginId` は公開コレクション `stores` から除外・分離し、非公開コレクション `store_secrets/{storeId}` や管理者専用ドキュメントに移動する。
  - ルール上、`stores` は公開メニュー表示に必要なため `allow read: if true;` を維持しつつ、機密フィールドをドキュメント内に含めない設計（フィールド分離）を徹底する。

---

### 【SEC-FS-07】`items` コレクションのスキーマ検証・価格バリデーション完全欠落（マイナス価格・型破壊・DoS）

- **深刻度**: **High**
- **該当ファイル・該当行**: `firestore.rules` 51–56行目
  ```javascript
  51: // 作成・更新・削除: その店舗の管理者のみ
  52: // resource.data.storeId (既存) または request.resource.data.storeId (新規) が権限と一致するか
  53: allow create: if isStoreAdmin(request.resource.data.storeId) || isSuperAdmin();
  54: allow update: if (isStoreAdmin(resource.data.storeId) && isStoreAdmin(request.resource.data.storeId)) || isSuperAdmin();
  55: allow delete: if isStoreAdmin(resource.data.storeId) || isSuperAdmin();
  ```
- **攻撃シナリオ**:
  1. 店舗管理者の権限を持つ生徒、またはアカウントを不正利用した攻撃者が、直接 Firestore SDK を呼び出す：
     ```javascript
     // マイナス価格の注入
     updateDoc(doc(db, "items", "item_123"), { price: -5000 });
     // または型破壊・巨大文字列の注入
     updateDoc(doc(db, "items", "item_123"), { 
       name: "<script>alert('XSS')</script>" + "A".repeat(100000),
       isAvailable: "invalid_type",
       allowedToppings: Array(10000).fill("spam")
     });
     ```
  2. ルールは `isStoreAdmin(...)` のみを確認しており、データ内容の検証が一切ないため、書き込みが成功する。
  3. この商品を来場者が注文した場合、Cloud Functions の注文計算ロジックやクライアントのカート計算で合計金額がマイナスになったり、UIレンダリングが破壊されてアプリが停止する。
- **影響**:
  - **不正会計・価格改ざん**: 不正な価格設定による無料・マイナス購入。
  - **サービス停止 (DoS)**: フロントエンド画面（メニュー一覧、POSレジ、KDS）のクラッシュ。
- **推奨修正ルールコード**:
  ```javascript
  function isValidItemData() {
    let d = request.resource.data;
    let allowedFields = ['storeId', 'name', 'price', 'description', 'imageUrl', 'isAvailable', 'isRecommended', 'allowedToppings', 'displayOrder', 'createdAt', 'updatedAt'];
    return d.keys().hasOnly(allowedFields)
      && d.storeId is string
      && d.name is string && d.name.size() >= 1 && d.name.size() <= 50
      && d.price is int && d.price >= 0 && d.price <= 50000
      && d.isAvailable is bool
      && (!('description' in d) || (d.description is string && d.description.size() <= 500))
      && (!('imageUrl' in d) || (d.imageUrl is string && d.imageUrl.size() <= 1000))
      && (!('allowedToppings' in d) || (d.allowedToppings is list && d.allowedToppings.size() <= 20))
      && (!('displayOrder' in d) || d.displayOrder is number);
  }

  match /items/{itemId} {
    allow read: if true;
    allow create: if (isStoreAdmin(request.resource.data.storeId) || isSuperAdmin())
                 && isValidItemData();
    allow update: if ((isStoreAdmin(resource.data.storeId) && isStoreAdmin(request.resource.data.storeId)) || isSuperAdmin())
                 && isValidItemData();
    allow delete: if isStoreAdmin(resource.data.storeId) || isSuperAdmin();
  }
  ```

---

### 【SEC-FS-08】`_metadata` コレクションの未認証全公開によるシステム安全弁・運用状態の漏洩

- **深刻度**: **Medium**
- **該当ファイル・該当行**: `firestore.rules` 143–146行目
  ```javascript
  143: match /_metadata/{document=**} {
  144:   allow read: if true;
  145:   allow write: if isSuperAdmin();
  146: }
  ```
- **背景・設計内容**:
  - `_metadata/system_alerts` には、`penaltyEnabled`（ペナルティ自動執行の有効/無効フラグ）、`emergencyStopAt`（緊急停止時刻）、および管理画面向けのアラート設定が格納されている。
- **攻撃シナリオ**:
  1. 攻撃者が未認証で `_metadata/system_alerts` を監視する。
  2. 管理者が運用上のトラブル対応で `penaltyEnabled: false` に切り替えた瞬間を検知する。
  3. 「現在ペナルティ（放置注文時の自動BAN）が無効化されている」ことを確認した上で、大量の架空注文を行い、ペナルティを受けずに店舗業務を妨害する。
- **影響**:
  - 運用の安全弁の状態や管理者向けメッセージが第三者に漏洩し、妨害行為のタイミングを図られる。
- **推奨修正ルールコード**:
  ```javascript
  match /_metadata/{document=**} {
    // 来場者向けアラート表示に必要なドキュメントのみ、あるいは認証ユーザーに限定
    allow read: if isAuthenticated() || isSuperAdmin();
    allow write: if isSuperAdmin();
  }
  ```

---

### 【SEC-FS-09】SOK（セルフオーダーキオスク）pending仮注文の未認証閲覧と注文ハイジャック (IDOR / Race Condition)

- **深刻度**: **Medium**
- **該当ファイル・該当行**: `firestore.rules` 79–80行目
  ```javascript
  79: // (c) SOK未確定仮注文（QR読み取り等、IDを知っている場合のみ許可）
  80: || (resource.data.orderChannel == "sok" && resource.data.sokStatus == "pending")
  ```
- **攻撃シナリオ**:
  1. 店舗のキオスク端末で来場者Aが商品をカートに入れ、「QRコードを発行」する（`sokStatus: "pending"`）。
  2. 来場者Aの後ろに並んでいた攻撃者Bが、キオスク端末の画面に表示されたQRコードのURL（`sok-to.html?orderId=XXXX`）をスマホのカメラで盗撮する。
  3. 攻撃者Bが先に自身のスマホから `claimSokOrder` Callable Function を呼び出す。
  4. 注文が攻撃者Bのアカウントにバインドされ、来場者Aの端末では「既に他のユーザーによって読み取られました」となり、注文がハイジャックされる。
- **影響**:
  - 注文の横取り、他人のカート内容の盗み見。
- **推奨修正ルールコード**:
  - SOKの仮注文作成時にワンタイムシークレットトークン（`claimSecret`）を生成してQRコードにのみ含め、Firestoreルールおよび `claimSokOrder` でそのシークレットの一致を検証する。

---

### 【SEC-FS-10】Custom Claims (`store_admin`) の失効遅延（トークン更新ラグ）に伴う不正操作持続リスク

- **深刻度**: **Medium**
- **該当ファイル**: `firestore.rules` 14–18行目, `functions/index.js` 688行目
- **内容**:
  - 店舗管理者の権限付与は `loginStore` Callable Function で `setCustomUserClaims(uid, { role: "store_admin", storeId: ... })` により行われる。
  - Firebase Authの仕様上、IDトークン（JWT）に含まれる Custom Claims は**最大1時間**キャッシュされ、サーバー側でクレームを削除・変更しても、クライアントが既に取得したIDトークンは有効期限が切れるまで有効である。
  - セキュリティルール（`firestore.rules`, `storage.rules`）は `request.auth.token.role` を直接参照しているため、店舗スタッフを解任したりパスワードを変更しても、旧トークンを持つ端末からは最大1時間アイテム編集や画像アップロードが許可され続ける。
- **推奨対策**:
  - Cloud Functions 側でセッション管理を行うか、トークン発行時刻と店舗パスワード最終変更日時を照合する仕組みを導入する。また、スタッフ離脱時には `admin.auth().revokeRefreshTokens(uid)` を実行する。

---

### 【SEC-ST-01】`storage.rules` におけるファイルサイズ制限の完全欠落（DoS・ストレージ枯渇・課金爆発）

- **深刻度**: **Critical**
- **該当ファイル・該当行**: `storage.rules` 30–31行目
  ```javascript
  29: // アップロード: 店舗管理者かつ画像ファイルのみ許可
  30: allow write: if (isStoreAdmin(storeId) || isSuperAdmin())
  31:              && request.resource.contentType.matches('image/.*');
  ```
- **背景・設計意図**:
  - `pos/portal.html` では Canvas API を用いて画像を WebP 形式（長辺1200px, quality 0.8）に圧縮してからアップロードしているため、安全であると想定されていた。
- **攻撃シナリオ**:
  1. 店舗管理者の権限を持つユーザー、または漏洩した店舗アカウントを利用する攻撃者が、公式クライアントUI（portal.html）を介さず、スクリプトまたは cURL から直接 Firebase Storage REST API を呼び出す。
  2. 1ファイルあたり 5GB〜10GB の超巨大ダミーファイルを用意し、`Content-Type: image/jpeg` を指定して `products/{storeId}/huge_bomb.webp` にアップロードする。
  3. `storage.rules` には `request.resource.size` の検証が一切存在しないため、アップロードが成功する。
  4. これを繰り返し実行することで、Firebase Storage の容量制限（無料枠 5GB）を一瞬で超過させ、サービスの停止（DoS）またはクラウド利用料金の急激な高騰（Denial of Wallet）を引き起こす。
- **影響**:
  - **システム停止**: ストレージクォータ超過による画像アップロード不能。
  - **金銭的被害**: 意図的な過大課金。
- **推奨修正ルールコード**:
  ```javascript
  // storage.rules
  match /products/{storeId}/{fileName} {
    allow read: if true;
    allow write: if (isStoreAdmin(storeId) || isSuperAdmin())
                 && request.resource.size < 5 * 1024 * 1024 // 5MB上限 (WebP運用なら2MB推奨)
                 && request.resource.contentType.matches('image/.*');
  }
  ```

---

### 【SEC-ST-02】`storage.rules` の `image/.*` 許可による SVG アップロードと Stored XSS

- **深刻度**: **High**
- **該当ファイル・該当行**: `storage.rules` 31行目
  ```javascript
  31: && request.resource.contentType.matches('image/.*');
  ```
- **攻撃シナリオ**:
  1. 攻撃者が、内部に JavaScript を含む悪意ある SVG ファイルを作成する：
     ```xml
     <?xml version="1.0" standalone="no"?>
     <svg xmlns="http://www.w3.org/2000/svg">
       <script type="text/javascript">
         alert("XSS: " + document.domain);
         // トークン奪取やフィッシングUI表示など
       </script>
     </svg>
     ```
  2. `Content-Type: image/svg+xml` で `products/{storeId}/exploit.svg` にアップロードする。
  3. ルールは正規表現 `image/.*` で評価しているため、`image/svg+xml` も許可されアップロードが成功する。
  4. 攻撃者は `items/{itemId}.imageUrl` にこのSVGの公開URLを設定する。
  5. 来場者や管理者がこの画像URLを直接開いた場合、またはブラウザ環境によってスクリプトが解釈された場合に、悪意あるコードが実行される（Stored XSS）。
- **影響**:
  - 偽装画面による認証情報の詐取、クロスサイトスクリプティング実行。
- **推奨修正ルールコード**:
  ```javascript
  // 安全なラスタ画像形式（jpeg, png, webp）のみに限定し、SVGを排除
  && request.resource.contentType.matches('image/(jpeg|png|webp)')
  ```

---

### 【SEC-ST-03】`storage.rules` におけるファイル名・拡張子バリデーションの欠落

- **深刻度**: **Medium**
- **該当ファイル・該当行**: `storage.rules` 26行目
  ```javascript
  26: match /products/{storeId}/{fileName} {
  ```
- **攻撃シナリオ**:
  1. 攻撃者が `fileName` に `exploit.html` や `malicious.exe`、あるいは特殊記号や非常に長い文字列を指定し、`Content-Type: image/jpeg` でアップロードする。
  2. ルールはファイル名の拡張子や文字種を一切検証していないため、自由な名前で保存される。
  3. 拡張子とContent-Typeの不一致により、クライアント側の処理で予期せぬ挙動やコンテンツスニッフィングが発生する。
- **影響**:
  - ストレージバケット内のファイル整合性悪化、拡張子偽装によるリスク。
- **推奨修正ルールコード**:
  ```javascript
  match /products/{storeId}/{fileName} {
    allow read: if true;
    allow write: if (isStoreAdmin(storeId) || isSuperAdmin())
                 && fileName.matches('^[a-zA-Z0-9_-]+\\.(webp|jpg|jpeg|png)$')
                 && request.resource.size < 5 * 1024 * 1024
                 && request.resource.contentType.matches('image/(jpeg|png|webp)');
  }
  ```

---

### 【SEC-ST-04】`storage.rules` の `allow write` による既存ファイルの上書き・削除制御の欠如

- **深刻度**: **Medium**
- **該当ファイル・該当行**: `storage.rules` 30行目
  ```javascript
  30: allow write: if (isStoreAdmin(storeId) || isSuperAdmin())
  ```
- **内容**:
  - `allow write` は `create`, `update`, `delete` のすべての操作を一括して許可する。
  - ファイル名が `${timestamp}_${filename}.webp` という命名規則であるため、通常は上書きされない想定だが、攻撃者または悪意あるスタッフが既に使用されている他商品の画像ファイル名と同一の名前でアップロードを実行し、**既存の商品画像を故意に別の画像（または真っ黒な画像）で上書き破壊**できる。
  - また、メニューに紐づいている画像を勝手に削除（`delete`）して、来場者画面での画像表示をリンク切れにさせることができる。
- **推奨修正ルールコード**:
  - 新規作成（`create`）、上書き（`update`）、削除（`delete`）の権限を分離し、上書き防止または削除の制限を設ける。
  ```javascript
  // 新規アップロードのみ許可（既存ファイルの上書きを禁止）
  allow create: if (isStoreAdmin(storeId) || isSuperAdmin())
                && fileName.matches('^[a-zA-Z0-9_-]+\\.(webp|jpg|jpeg|png)$')
                && request.resource.size < 5 * 1024 * 1024
                && request.resource.contentType.matches('image/(jpeg|png|webp)');
  // 削除は店舗管理者またはSuperAdmin
  allow delete: if isStoreAdmin(storeId) || isSuperAdmin();
  // 意図しない上書きは拒否
  allow update: if false;
  ```

---

## 4. 推奨セキュリティルール完全版コード（修正案）

実コードの変更は行わず、今後の改修・実装フェーズで即座に適用できるよう、すべての脆弱性対策を反映した推奨ルールコードを提示します。

### 4.1 推奨 `firestore.rules` 完全版

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================================
    // Helper Functions
    // ============================================================
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isStoreAdmin(targetStoreId) {
      return isAuthenticated() 
             && request.auth.token.role == 'store_admin' 
             && request.auth.token.storeId == targetStoreId;
    }

    function isSuperAdmin() {
      return isAuthenticated()
             && request.auth.token.identity == 'super_admin';
    }

    // items コレクションの厳格バリデーション
    function isValidItemData() {
      let d = request.resource.data;
      let allowedFields = ['storeId', 'name', 'price', 'description', 'imageUrl', 'isAvailable', 'isRecommended', 'allowedToppings', 'displayOrder', 'createdAt', 'updatedAt'];
      return d.keys().hasOnly(allowedFields)
        && d.storeId is string
        && d.name is string && d.name.size() >= 1 && d.name.size() <= 50
        && d.price is int && d.price >= 0 && d.price <= 50000
        && d.isAvailable is bool
        && (!('description' in d) || (d.description is string && d.description.size() <= 500))
        && (!('imageUrl' in d) || (d.imageUrl is string && d.imageUrl.size() <= 1000))
        && (!('allowedToppings' in d) || (d.allowedToppings is list && d.allowedToppings.size() <= 20))
        && (!('displayOrder' in d) || d.displayOrder is number);
    }

    // users コレクションのスキーマバリデーション
    function isValidUserData() {
      let d = request.resource.data;
      let allowedFields = ['nickname', 'fcmTokens', 'termsAgreedAt', 'favoriteItemIds', 'lastLoginAt', 'createdAt', 'notificationEnabled', 'permissionStatus', 'deviceType'];
      return d.keys().hasOnly(allowedFields)
        && !d.keys().hasAny(['email', 'displayName', 'photoURL'])
        && (!('nickname' in d) || (d.nickname is string && d.nickname.size() <= 30))
        && (!('fcmTokens' in d) || (d.fcmTokens is list && d.fcmTokens.size() <= 10))
        && (!('favoriteItemIds' in d) || (d.favoriteItemIds is list && d.favoriteItemIds.size() <= 100));
    }

    // ============================================================
    // Collection Rules
    // ============================================================

    // 1. Stores (店舗情報の公開)
    // ※ spreadsheetId, spreadsheetUrl, loginId は本コレクションから除外すること！
    match /stores/{storeId} {
      allow read: if true; 
      allow write: if isSuperAdmin();
    }

    // 1-b. Store Secrets (パスワード等の機密情報)
    match /store_secrets/{storeId} {
      allow read, write: if false;
    }

    // 2. Items (商品情報)
    match /items/{itemId} {
      allow read: if true;
      allow create: if (isStoreAdmin(request.resource.data.storeId) || isSuperAdmin())
                   && isValidItemData();
      allow update: if ((isStoreAdmin(resource.data.storeId) && isStoreAdmin(request.resource.data.storeId)) || isSuperAdmin())
                   && isValidItemData();
      allow delete: if isStoreAdmin(resource.data.storeId) || isSuperAdmin();
    }

    // Test Collections
    match /stores_test/{storeId} {
      allow read, write: if isSuperAdmin();
    }
    match /items_test/{itemId} {
      allow read, write: if isSuperAdmin();
    }

    // 3. Orders (注文)
    match /orders/{orderId} {
      // get: 店舗管理者、SuperAdmin、注文者本人、または SOK pending
      allow get: if isStoreAdmin(resource.data.storeId) 
                 || isSuperAdmin()
                 || (isAuthenticated() && request.auth.uid == resource.data.userId)
                 || (resource.data.orderChannel == "sok" && resource.data.sokStatus == "pending");
      
      // list: 店舗管理者、SuperAdmin、または注文者本人（全公開 list は廃止）
      allow list: if isStoreAdmin(resource.data.storeId) 
                  || isSuperAdmin()
                  || (isAuthenticated() && request.auth.uid == resource.data.userId);
      
      allow create: if false; 
      allow update: if isSuperAdmin();
      allow delete: if isSuperAdmin();
    }

    // 4. Users (ユーザー情報)
    match /users/{userId} {
      allow read: if (isAuthenticated() && request.auth.uid == userId) || isSuperAdmin();
      allow create, update: if isAuthenticated() && request.auth.uid == userId
                           && isValidUserData();
      // クライアントからの直接削除は禁止 (deleteMyAccount Function に集約)
      allow delete: if false;

      // カート等のサブコレクション
      match /cart/{itemId} {
        allow read, write: if isAuthenticated() && request.auth.uid == userId;
      }
    }

    // 5. Counters (採番)
    // クライアントからの直接読み取りは不要。Admin SDK のみアクセス
    match /counters/{document=**} {
      allow read: if isSuperAdmin();
      allow write: if false; 
    }

    // 6. 会場ステータス
    match /venues/{venueId} {
      allow read: if true;
      allow write: if false;
    }
    
    // 6-b. 会場ステータス管理用設定
    match /venue_admin_config/{document=**} {
      allow read, write: if false;
    }
    match /venue_admin_sessions/{document=**} {
      allow read, write: if false;
    }

    // 7. Metadata
    match /_metadata/{document=**} {
      allow read: if isAuthenticated() || isSuperAdmin();
      allow write: if isSuperAdmin();
    }

    // 8. Banned Users
    match /banned_users/{userId} {
      allow read: if (isAuthenticated() && request.auth.uid == userId) || isSuperAdmin();
      allow write: if false;
    }
    
    // デフォルト拒否
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

### 4.2 推奨 `storage.rules` 完全版

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Helper Functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isStoreAdmin(targetStoreId) {
      return isAuthenticated() 
             && request.auth.token.role == 'store_admin' 
             && request.auth.token.storeId == targetStoreId;
    }

    function isSuperAdmin() {
      return isAuthenticated() && request.auth.token.identity == 'super_admin';
    }

    // Default Deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
    
    // Product Images: products/{storeId}/{fileName}
    match /products/{storeId}/{fileName} {
      // 読み取りは全公開
      allow read: if true;
      
      // 新規アップロード: 店舗管理者またはSuperAdmin
      // - ファイルサイズ 5MB 以下 (DoS/DoW対策)
      // - 安全なラスタ画像のみ (SVG排除により XSS 対策)
      // - ファイル名形式の検証
      allow create: if (isStoreAdmin(storeId) || isSuperAdmin())
                    && request.resource.size < 5 * 1024 * 1024
                    && request.resource.contentType.matches('image/(jpeg|png|webp)')
                    && fileName.matches('^[a-zA-Z0-9_-]+\\.(webp|jpg|jpeg|png)$');

      // 既存ファイルの上書きは禁止 (誤操作・嫌がらせ上書き防止)
      allow update: if false;

      // 削除: 店舗管理者またはSuperAdmin
      allow delete: if isStoreAdmin(storeId) || isSuperAdmin();
    }
  }
}
```

---

## 5. 今後の改修ロードマップと設計整合への提言

本監査レポートで検出された脆弱性を安全かつ確実に是正するため、以下のステップでの段階的改善を強く推奨します。

1. **第1優先（即時対応推奨 / 運用リスク大）**:
   - **`storage.rules` のサイズ・MIMEタイプ制限**: 実装・デプロイによる既存UIへの影響がゼロ（portal.htmlはすでにWebP圧縮を行っているため）であり、直ちにDoS・XSS防御効果が得られます。
   - **`counters` の読み取り制限**: フロントエンドで参照されていないため、即座にルールを閉鎖しても影響がありません。
2. **第2優先（スキーマ検証の追加）**:
   - **`items` および `users` のバリデーションルール導入**: 不正な価格や巨大データの注入をサーバーサイドで完全に遮断。
   - **`users` の `{document=**}` 解除**: サブコレクションのアクセス境界を明確化。
3. **第3優先（モニター画面・スプレッドシートのアーキテクチャ最適化）**:
   - **`pos/monitor.html` 向けデータ公開の分離**: 注文ドキュメントそのものを公開するのではなく、呼び出し番号と店舗IDのみを含む公開専用コレクション（または Functions）経由での配信に切り替え、`orders` コレクションの全開放（`status == "ready_for_pickup"`）を完全撤廃する。
   - **`stores` コレクションからの機密URL除外**: スプレッドシートID・URLを公開ドキュメントから `store_secrets` 配下等へ移行する。
