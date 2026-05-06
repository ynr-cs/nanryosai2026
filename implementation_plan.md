# 実装計画: ポップアップブロック回避の有効性検証テスト実装

## 目的
Googleログインのポップアップがブラウザ（特にiOS Safari等）でブロックされる原因が「ユーザー操作後の非同期処理（await）による時間経過」であることを証明するため、意図的に2秒の遅延を入れたログインボタンを実装します。これにより、現在の「遅延なし」の実装が正しく動作していることを実機で確認できるようにします。

## 変更内容

### POS / Portal
#### [MODIFY] [pos/portal.html](file:///c:/Users/uokun/OneDrive/Desktop/テキスト/ynr-cs/nanryosai-2026/nanryosai-2026/pos/portal.html)
- ログインオーバーレイ（`.auth-card`）内に、一時的な検証用ボタンを追加します。
- `window.triggerDelayedLogin` 関数を追加し、2秒待機してから `signInWithPopup` を実行するようにします。

### Mobile Order
#### [MODIFY] [pos/mobile-order.html](file:///c:/Users/uokun/OneDrive/Desktop/テキスト/ynr-cs/nanryosai-2026/nanryosai-2026/pos/mobile-order.html)
- ログインステップ画面に、一時的な検証用ボタンを追加します。
- 同様の遅延ログインロジックを実装します。

## 検証計画

### 手動検証
1. iPhone または Android のブラウザでログイン画面を開く。
2. 通常の「Googleでログイン」ボタンを押し、ポップアップが出ることを確認する。
3. 一旦戻り、新しく追加した「【検証用】2秒遅延ログイン」ボタンを押す。
4. ポップアップがブロックされる、あるいは動作しないことを確認する。
5. これにより、ブラウザのセキュリティ制限を回避できていることを証明する。

## 注意事項
- この修正はあくまで検証用であり、確認が終わったら削除する必要があります。
- ユーザーに「ブロックされた時のガイダンス」が正しく表示されるかのテストも兼ねています。
