// Last updated: 2025-12-10 22:08
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * @name getNextReceiptNumber
 * @description 【最終版】全ての完了・キャンセル済みステータスを考慮し、
 *              アクティブな注文で使われていない次の受付番号を安全に発行する。
 */
exports.getNextReceiptNumber = functions
  .https.onCall(async (data, context) => {
    try {
      console.log("getNextReceiptNumber called with:", data);

      const counterRef = db.collection('counters').doc('receipt');
      const ordersRef = db.collection('orders');

      // 注文タイプごとの設定
      // POS: 100-999 (デフォルト)
      // SOK: 2000-2999
      // Mobile: 7000-7999
      // Gen 2 (CallableRequest) か Gen 1 かを判定してデータを取得
      const requestData = (data.data && typeof data.data === 'object') ? data.data : data;
      
      const orderType = requestData.orderType || 'POS';
      
      let minNum, maxNum, fieldName;

      switch (orderType) {
        case 'SOK':
          minNum = 2000;
          maxNum = 2999;
          fieldName = 'currentNumber_SOK';
          break;
        case 'MOBILE':
          minNum = 7000;
          maxNum = 7999;
          fieldName = 'currentNumber_MOBILE';
          break;
        case 'POS':
        default:
          minNum = 100;
          maxNum = 999;
          fieldName = 'currentNumber'; // 既存互換のため POS は currentNumber を使用
          break;
      }

      const newNumber = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists) {
          throw new Error("counters/receipt ドキュメントが存在しません。Firestoreを確認してください。");
        }

        const docData = counterDoc.data();
        let nextNumber = docData[fieldName];
        
        // 初回などでフィールドがない、または範囲外の場合は初期値をセット
        if (!nextNumber || nextNumber < minNum || nextNumber > maxNum) {
          nextNumber = minNum - 1; 
        }

        // 安全装置: 範囲のサイズ分試行 (例: 900回)
        const rangeSize = maxNum - minNum + 1;

        for (let i = 0; i < rangeSize; i++) {
          nextNumber++;
          if (nextNumber > maxNum) {
            nextNumber = minNum;
          }

          // 【修正点】完了済みの全ステータスを指定する
          // これら"以外"がアクティブな注文とみなされる
          const completedStatuses = [
            'completed_at_store', // 店舗での提供完了
            'completed_online',   // オンライン注文の提供完了
            'cancelled',          // キャンセル済み
            'abandoned_and_paid'  // 放置・決済済み
          ];

          const query = ordersRef
            .where('receiptNumber', '==', nextNumber)
            .where('status', 'not-in', completedStatuses);
          
          const snapshot = await transaction.get(query);

          if (snapshot.empty) {
            transaction.update(counterRef, { [fieldName]: nextNumber });
            return nextNumber;
          }
        }

        throw new Error(`利用可能な受付番号がありません (${orderType})。`);
      });

      return { 
        receiptNumber: newNumber,
        _debug_orderType: orderType,
        success: true
      };

    } catch (error) {
      console.error("Function Error:", error);
      // クライアントでエラー内容を確認できるように詳細を返す
      return {
        success: false,
        error: error.toString(),
        stack: error.stack,
        code: 500
      };
    }
  });