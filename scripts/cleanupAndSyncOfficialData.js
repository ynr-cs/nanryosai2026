/**
 * scripts/cleanupAndSyncOfficialData.js
 *
 * 南陵祭2026 本番マスターデータ完全移行に伴う Firestore クリーンアップ＆同期スクリプト
 * - stores: 301（アキコのひとくちカステラ）のみ残し他を削除、301を本番情報で更新
 * - items: 他店舗の商品および旧商品を全削除し、301の正式3商品（プレーン, チョコソース, 抹茶）を登録
 * - stores_test, items_test: 全件削除
 * - orders: 全件削除
 * - counters: 全件削除（POS: 100, モバイル: 7000, SOK: 2000 からの自動初期化用）
 * - receipts/active: activeNumbers を初期化
 */

const fs = require('fs');
const path = require('path');

const p = process.env.USERPROFILE + '/.config/configstore/firebase-tools.json';
if (!fs.existsSync(p)) {
  console.error('firebase-tools.json not found at', p);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(p, 'utf8'));
const token = config.tokens.access_token;
const projectId = 'nanryosai-2026-a4091';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function fetchJson(url, options = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function listAllDocuments(collectionPath) {
  let docs = [];
  let pageToken = '';
  do {
    const url = `${baseUrl}/${collectionPath}?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetchJson(url);
    if (res.documents) {
      docs.push(...res.documents);
    }
    pageToken = res.nextPageToken;
  } while (pageToken);
  return docs;
}

async function deleteDocument(docPath) {
  const url = `https://firestore.googleapis.com/v1/${docPath}`;
  await fetchJson(url, { method: 'DELETE' });
}

async function deleteCollection(collectionPath) {
  const docs = await listAllDocuments(collectionPath);
  console.log(`Deleting ${docs.length} documents from ${collectionPath}...`);
  for (const doc of docs) {
    await deleteDocument(doc.name);
  }
  console.log(`Successfully cleared ${collectionPath}.`);
}

async function syncStore301() {
  console.log('Syncing stores/301...');
  const storeUrl = `${baseUrl}/stores/301`;
  const storeData = {
    fields: {
      name: { stringValue: '3年1組' },
      teamName: { stringValue: 'アキコのひとくちカステラ' },
      loginId: { stringValue: 'class301' },
      description: { stringValue: '坂本先生監修！ひとくちサイズの出来立てベビーカステラ。プレーン・チョコ・抹茶の3種類をご用意！' },
      operationStatus: { stringValue: 'open' },
      isAutoSuspended: { booleanValue: false },
      availableItemCount: { integerValue: '3' },
      totalItemCount: { integerValue: '3' },
      updatedAt: { timestampValue: new Date().toISOString() },
      lastActivityAt: { timestampValue: new Date().toISOString() },
    },
  };

  await fetchJson(storeUrl, {
    method: 'PATCH',
    body: JSON.stringify(storeData),
  });
  console.log('stores/301 updated successfully.');
}

async function cleanupOtherStores() {
  console.log('Cleaning up stores collection (keeping only 301)...');
  const docs = await listAllDocuments('stores');
  for (const doc of docs) {
    const id = doc.name.split('/').pop();
    if (id !== '301') {
      console.log(`Deleting store ${id}...`);
      await deleteDocument(doc.name);
    }
  }
  console.log('Other stores cleaned up.');
}

async function syncItems301() {
  console.log('Clearing old items in items collection...');
  await deleteCollection('items');

  console.log('Adding official items for store 301...');
  const items = [
    {
      storeId: '301',
      name: 'プレーン',
      price: 100,
      description: '素朴で優しい甘さの王道カステラ。',
      allergens: ['卵', '小麦', '乳', 'はちみつ'],
      isRecommended: true,
      isAvailable: true,
      imageUrl: '',
      allowedToppings: [],
    },
    {
      storeId: '301',
      name: 'チョコソース',
      price: 100,
      description: 'とろけるチョコソースをたっぷりトッピング。',
      allergens: ['卵', '小麦', '乳', 'はちみつ'],
      isRecommended: false,
      isAvailable: true,
      imageUrl: '',
      allowedToppings: [],
    },
    {
      storeId: '301',
      name: '抹茶',
      price: 110,
      description: '上品な宇治抹茶の風味香る大人の味。',
      allergens: ['卵', '小麦', '乳', 'はちみつ'],
      isRecommended: false,
      isAvailable: true,
      imageUrl: '',
      allowedToppings: [],
    },
  ];

  for (const item of items) {
    const postUrl = `${baseUrl}/items`;
    const body = {
      fields: {
        storeId: { stringValue: item.storeId },
        name: { stringValue: item.name },
        price: { integerValue: String(item.price) },
        description: { stringValue: item.description },
        allergens: {
          arrayValue: {
            values: item.allergens.map((a) => ({ stringValue: a })),
          },
        },
        isRecommended: { booleanValue: item.isRecommended },
        isAvailable: { booleanValue: item.isAvailable },
        imageUrl: { stringValue: item.imageUrl },
        allowedToppings: {
          arrayValue: {
            values: item.allowedToppings.map((t) => ({ stringValue: t })),
          },
        },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    };
    const created = await fetchJson(postUrl, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    console.log(`Created item: ${item.name} (${created.name.split('/').pop()})`);
  }
}

async function resetOrdersAndCounters() {
  console.log('Deleting all orders...');
  await deleteCollection('orders');

  console.log('Resetting counters...');
  await deleteCollection('counters');

  console.log('Resetting receipts/active numbers...');
  const receiptsUrl = `${baseUrl}/receipts/active`;
  await fetchJson(receiptsUrl, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: {
        numbers: {
          arrayValue: { values: [] },
        },
      },
    }),
  });
}

async function cleanupTestCollections() {
  console.log('Cleaning test collections...');
  await deleteCollection('stores_test');
  await deleteCollection('items_test');
}

async function verifyAll() {
  console.log('\n--- VERIFICATION ---');

  const stores = await listAllDocuments('stores');
  console.log(`Stores count: ${stores.length}`);
  stores.forEach((s) => {
    const id = s.name.split('/').pop();
    const f = s.fields;
    console.log(` - Store ID: ${id}, Name: ${f.name?.stringValue}, Team: ${f.teamName?.stringValue}, Status: ${f.operationStatus?.stringValue}, Total: ${f.totalItemCount?.integerValue}, Avail: ${f.availableItemCount?.integerValue}`);
  });

  const items = await listAllDocuments('items');
  console.log(`Items count: ${items.length}`);
  items.forEach((i) => {
    const id = i.name.split('/').pop();
    const f = i.fields;
    const allergens = f.allergens?.arrayValue?.values?.map((v) => v.stringValue).join(', ') || 'none';
    console.log(` - Item: ${f.name?.stringValue} (${id}), Price: ${f.price?.integerValue}円, Store: ${f.storeId?.stringValue}, Avail: ${f.isAvailable?.booleanValue}, Rec: ${f.isRecommended?.booleanValue}, Allergens: [${allergens}]`);
  });

  const orders = await listAllDocuments('orders');
  console.log(`Orders count: ${orders.length}`);

  const counters = await listAllDocuments('counters');
  console.log(`Counters count: ${counters.length}`);

  const storesTest = await listAllDocuments('stores_test');
  console.log(`stores_test count: ${storesTest.length}`);

  const itemsTest = await listAllDocuments('items_test');
  console.log(`items_test count: ${itemsTest.length}`);
}

async function main() {
  try {
    console.log('Starting cleanup and sync process...');
    await syncStore301();
    await cleanupOtherStores();
    await syncItems301();
    await resetOrdersAndCounters();
    await cleanupTestCollections();
    await verifyAll();
    console.log('\nAll operations completed successfully!');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
