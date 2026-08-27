# 実装計画: プランC（学校整理番号0014判定）カスタム認証システムへの移行 v2

## 目的

現在の認証システムは **Firebase Auth 標準の Google Sign-In** を利用し、`user.email` のドメイン末尾（`@gl.pen-kanagawa.ed.jp`）で在校生を判定しています。
しかし、このドメインは**神奈川県立全144校に共通**であり、他校生の排除ができません。

プランCでは、Cloud Functions 内でメールアドレスの**先頭4桁が `0014`（南陵高校の学校整理番号）**であることを検証し、**南陵生にのみ `role: 'student'` Custom Claims を付与**する方式に移行します。
判定完了後、**メールアドレスは Firestore に保存せず、UIにも表示しない**設計とします。

---

## ユーザー判断の確定事項

以下はユーザーからのフィードバックに基づく**確定済みの設計判断**です。

### ✅ 確定1: 全ユーザーがログイン可能

> 南陵生以外もログインはできる。お気に入り登録やSOK利用は全員可能。南陵生ロール（`role: 'student'`）の人だけがモバイルオーダーを使える。

- 全Googleアカウントで `signInWithPopup` による通常ログインを許可
- ログイン後に Cloud Functions で0014判定を実行し、**該当者にのみ `role: 'student'` を付与**
- ログインの拒否は行わない（ゲストもログイン可能）

### ✅ 確定2: スーパー管理者の自動ロール付与

> `ynrcs1000@gmail.com` でログインしたら自動的に `role: 'super_admin'` が付与される。

- Cloud Functions の判定ロジック内で `ynrcs1000@gmail.com` を検出し、`setCustomUserClaims` で `role: 'super_admin'` を自動付与

### ✅ 確定3: 教員は利用不可（生徒経由で運用）

> 先生メアドをホワイトリストに入れるぐらいしかないので、生徒経由でやらせる。

- 教員向けの特別対応は不要

### ✅ 確定4: メールアドレスUIは全削除

> メアドUIは消す。アイコンもいらない。

- `user.email` の表示箇所を全て削除
- プロフィール画像（`user.photoURL`）の表示も削除

### ✅ 確定5: ニックネーム機能を account.html に追加

> ログイン後にlogin.htmlでフロー中に強制的に登録させるよりも、account.htmlで自由に変更できるようにする。

- `account.html` にニックネーム編集機能を追加
- Firestore `users/{uid}` に `nickname` フィールドを新設
- 未登録時はUIDベースの表示（例: `ユーザー #a1b2c3`）

### ✅ 確定6: ゲストもログイン可能（unauthorized画面は維持）

> ゲストもログインさせる。unauthorized画面は不要にならない。

- `step-unauthorized` 画面は**残す**が、用途を変更:
  - 現在: 「対象外のアカウントです」（ドメイン不一致）
  - 変更後: 「モバイルオーダーは南陵生限定です」（`role: 'student'` なし）

### ✅ 確定7: banned.html のニックネーム演出

> ニックネーム登録済み → 「〇〇さん」、未登録 → UIDを使ったユーモラスな演出

```
登録済み: 「山田太郎さん」
未登録: 「dkf821fhjskさん。あれ？どうやらニックネームを登録していないようですね。
         ID jdjfaoi32ujifoaijiojさん。かわいそうな名前ですね」
```

---

## 設計の根幹的変更: 「カスタムトークン方式」から「通常ログイン + ロール付与方式」へ

> [!IMPORTANT]
> ユーザーフィードバックにより、**全ユーザーがログイン可能**であることが必須要件となりました。
> これにより、プランC原案の「カスタムトークンで再認証して email を Auth から消す」方式から、
> **「通常の Google ログイン + サーバーサイドでのロール付与」方式**に変更します。

### 変更前（v1 原案）
```
signInWithPopup → Cloud Functions で判定 → signInWithCustomToken で再認証
→ user.email / displayName / photoURL が全て null
→ 南陵生以外はログイン不可
```

### 変更後（v2 確定版）
```
signInWithPopup → 全員ログイン成功（user.email 等は取得可能）
→ Cloud Functions で 0014 判定 → 該当者に role: 'student' を付与
→ user.email は取得可能だが、UIに表示しない & Firestore に保存しない
→ 南陵生以外もお気に入り・SOK等を利用可能
```

### この変更による影響

| 項目 | v1（カスタムトークン） | v2（通常ログイン+ロール付与）|
|:---|:---|:---|
| `user.email` | **null** | **取得可能**（ただしUI非表示・DB非保存） |
| `user.displayName` | **null** | **取得可能**（ただしUI非表示・DB非保存） |
| `user.photoURL` | **null** | **取得可能**（ただしUI非表示・DB非保存） |
| ゲストログイン | 不可 | **可能** |
| SOK利用 | 南陵生限定に変更 | **全員可能（現行維持）** |
| 実装難易度 | 高（再認証フロー） | **中（ロール付与のみ）** |

> [!NOTE]
> プランCの「個人情報完全破棄」の精神は、**Firestore に email/displayName/photoURL を保存しない** + **UIに表示しない** で達成します。Firebase Auth のセッション上には Google ログインの情報が残りますが、永続ストレージには一切保存されません。

---

## 変更内容

### フェーズ1: Cloud Functions - ロール判定・付与APIの新設

#### [NEW] Callable Function: `assignUserRole`

```javascript
// functions/index.js に追加
exports.assignUserRole = functions
  .region(\