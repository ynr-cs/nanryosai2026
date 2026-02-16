# システムアーキテクチャ図 (System Architecture)

本ドキュメントは、南陵祭2026プロジェクトのシステム構成とデータフローを可視化したものです。
Mermaid記法を使用しており、GitHub上で閲覧すると自動的に図としてレンダリングされます。

## 1. 全体アーキテクチャ (High-Level Architecture)

システムは、GitHub管理された静的サイト、Firebaseバックエンド、およびそれらを繋ぐ同期ツールで構成されています。

```mermaid
graph TD
    %% 定義: スタイル
    classDef master fill:#ffeebb,stroke:#f0ad4e,stroke-width:2px;
    classDef client fill:#d9edf7,stroke:#31708f,stroke-width:2px;
    classDef firebase fill:#f2dede,stroke:#a94442,stroke-width:2px;
    classDef storage fill:#dff0d8,stroke:#3c763d,stroke-width:2px;

    %% ---------------------------------------------------------
    %% 開発環境
    %% ---------------------------------------------------------
    subgraph "Development Environment (Local/GitHub)"
        GitRepo["GitHub Repository<br/>(ynr-cs/nanryosai2026)"]
        DataJS[("main/data/data.js<br/>#40;Source of Truth#41;")]:::master
    end

    %% ---------------------------------------------------------
    %% クライアントサイド
    %% ---------------------------------------------------------
    subgraph "Client Side (Web Browsers)"
        VisitorApp[("Visitor App<br/>#40;main/#41;<br/>一般来場者向け")]:::client
        POSApp[("POS App<br/>#40;pos/mobile-order#41;<br/>店舗運営者向け")]:::client
        Portal[("Store Portal<br/>#40;pos/portal#41;<br/>店舗管理者向け")]:::client
        AdminSync[("Admin Tool<br/>#40;main/admin_sync#41;<br/>実行委員向け")]:::client
    end

    %% ---------------------------------------------------------
    %% Firebase Backend
    %% ---------------------------------------------------------
    subgraph "Firebase Backend (nanryosai-2026-a4091)"
        FirebaseAuth[("Authentication<br/>#40;Google Sign-In#41;")]:::firebase

        subgraph Firestore["Cloud Firestore (Database)"]
            direction TB
            UserDB[("users")]:::firebase
            StoreDB[("stores")]:::firebase
            ItemDB[("items")]:::firebase
            OrderDB[("orders")]:::firebase
            SecretDB[("store_secrets")]:::firebase
        end

        CloudStorage[("Cloud Storage<br/>#40;Product Images#41;")]:::storage

        subgraph Functions["Cloud Functions"]
            FuncOrder["createOnlineOrder<br/>(Transaction)"]:::firebase
            FuncReceipt["getNextReceiptNumber<br/>(Atomic)"]:::firebase
            FuncNotify["sendOrderUpdateNotification<br/>(Background)"]:::firebase
        end
    end

    %% ---------------------------------------------------------
    %% データフロー接続
    %% ---------------------------------------------------------

    %% コードベースからのデプロイ/参照
    GitRepo -.-> DataJS
    DataJS -.-> AdminSync
    DataJS -.-> VisitorApp

    %% マスタデータ同期 (Admin Sync)
    AdminSync -- "Sync (Write Override)" --> StoreDB
    AdminSync -- "Sync (Write Override)" --> ItemDB
    AdminSync -- "Sync Secrets" --> FuncOrder
    FuncOrder -. "Write" .-> SecretDB

    %% 来場者 (Visitor) のアクション
    VisitorApp -- "Auth" --> FirebaseAuth
    VisitorApp -- "Read" --> StoreDB
    VisitorApp -- "Read" --> ItemDB
    VisitorApp -- "Order (Call)" --> FuncOrder
    FuncOrder -- "Create" --> OrderDB

    %% 店舗運営 (POS) のアクション
    POSApp -- "Auth" --> FirebaseAuth
    POSApp -- "Realtime Listen" --> OrderDB
    POSApp -- "Complete (Call)" --> FuncReceipt
    FuncReceipt -- "Update" --> OrderDB

    %% 店舗ポータル (Portal) のアクション
    Portal -- "Auth" --> FirebaseAuth
    Portal -- "Upload" --> CloudStorage
    CloudStorage -- "Public URL" --> Portal
    Portal -- "Update Image URL" --> ItemDB

    %% 通知
    OrderDB -. "Trigger" .-> FuncNotify
```

## 2. データの流れ (Data Flow Scenarios)

### シナリオA: マスタデータの同期 (Master Data Sync)

情報の正本である `data.js` を Firestore に反映するフロー。これは一方通行であり、Firestore上の手動変更は上書きされます（画像URLを除く）。

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant DataJS as data.js
    participant Admin as Admin Tool<br/>(admin_sync.html)
    participant FS as Firestore

    Dev->>DataJS: Edit store info/menus
    Dev->>DataJS: Commit & Push
    Dev->>Admin: Open Tool
    Admin->>DataJS: Read projectData
    Admin->>FS: Write /stores/{id}
    input Admin->>FS: Delete & Recreate /items/{id}
    Note right of FS: Item IDs are regenerated.<br/>Image URLs are preserved<br/>if present in data.js.
```

### シナリオB: モバイルオーダー (Mobile Order Transaction)

来場者が注文を行い、店舗がそれを受け付けるまでのフロー。不正防止のため、注文作成は必ず Cloud Functions を経由します。

```mermaid
sequenceDiagram
    actor User as Visitor
    participant App as Visitor App
    participant Func as Cloud Function<br/>(createOnlineOrder)
    participant FS as Firestore
    participant POS as POS App
    actor Staff as Store Staff

    User->>App: Cart -> Checkout
    App->>Func: Call (cart items)

    rect rgb(240, 240, 240)
        Note over Func, FS: Server-Side Transaction
        Func->>FS: Check Stock & Limits
        Func->>FS: Create Order (Status: PENDING)
        Func->>FS: Decrement Stock
    end

    Func-->>App: Success (Order ID)

    FS-->>POS: Realtime Update (New Order)
    POS->>Staff: Show "New Order"

    Staff->>POS: Tap "Complete"
    POS->>Func: Call (getNextReceiptNumber)
    Func->>FS: Update Order (Status: COMPLETED,<br/>Assign Receipt #)
    FS-->>App: Realtime Update (Completed)
    App->>User: Show Receipt Number
```

### シナリオC: 商品画像の登録 (Product Image Upload)

店舗担当者が自分たちの端末から商品画像をアップロードするフロー。`data.js` を経由せず直接クラウドに保存されます。

```mermaid
graph LR
    Staff[Store Staff] --> Portal[Portal App<br/>#40;pos/portal#41;]
    Portal -- "1. Resize & Compress<br/>#40;Client Side#41;" --> Portal
    Portal -- "2. Upload #40;.webp#41;" --> Storage[Cloud Storage]
    Storage -- "3. Get Download URL" --> Portal
    Portal -- "4. Save URL to Item" --> Firestore[(Firestore)]
    Firestore -. "5. Sync #40;Export needed#41;" .-> JS[data.js]

    style JS fill:#ffeebb,stroke:#f0ad4e,stroke-width:2px
```

## 3. コンポーネント依存関係図 (Component Dependencies)

主要なHTMLファイルと、共通モジュール (`auth.js`, `app-shell.js` 等) の依存関係を示します。

```mermaid
graph TD
    subgraph "Core Modules"
        AuthJS[("auth.js<br/>#40;Firebase Auth#41;")]
        ShellJS[("app-shell.js<br/>#40;Nav & UI#41;")]
        DataJS[("data.js<br/>#40;Master Data#41;")]
        StyleCSS[("style.css<br/>#40;Design System#41;")]
    end

    subgraph "Public Pages"
        IndexHTML["index.html"]
        AccountHTML["account.html"]
    end

    subgraph "POS System"
        MobileOrderHTML["mobile-order.html<br/>#40;Visitor#41;"]
        PortalHTML["portal.html<br/>#40;Store Admin#41;"]
        KitchenHTML["kitchen.html"]
        StatusHTML["status.html"]
    end

    %% Dependencies
    AuthJS --> IndexHTML & AccountHTML & MobileOrderHTML & PortalHTML
    ShellJS --> IndexHTML & AccountHTML
    StyleCSS --> IndexHTML & AccountHTML & MobileOrderHTML & PortalHTML & KitchenHTML
    DataJS --> IndexHTML & PortalHTML
```

## 4. Firestore データモデル詳細 (Detailed Data Model)

Firestore の主要なコレクションとサブコレクションの構造定義です。

```mermaid
classDiagram
    note "Collections Schema"

    class User {
        string uid
        string displayName
        string email
        timestamp lastLogin
        string fcmToken
        string deviceType
    }
    class CartItem {
        string productId
        int quantity
        array customizations
    }
    class Order {
        string id
        string userId
        string storeId
        string status
        int totalAmount
        timestamp createdAt
    }
    class Store {
        string id
        string name
        string loginId
        bool isOpen
    }

    User "1" --> "*" CartItem : subcollection: cart
    User "1" -- "1" Order : creates
    Store "1" -- "*" Order : receives
```

## 5. 注文ステータスマシン (Order State Machine)

注文ステータスの遷移ロジックです。不正な遷移はサーバーサイドでブロックされます。

```mermaid
stateDiagram-v2
    [*] --> PENDING : User creates order
    PENDING --> COOKING : Kitchen starts cooking
    COOKING --> READY_TO_SERVE : Cooking finished
    READY_TO_SERVE --> READY_FOR_PICKUP : Staff calls number
    READY_FOR_PICKUP --> COMPLETED : Handover complete

    PENDING --> CANCELLED : Stock shortage / Admin
    COOKING --> CANCELLED : Admin force cancel

    COMPLETED --> [*]
    CANCELLED --> [*]
```
