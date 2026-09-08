import fs from 'fs';

const content = fs.readFileSync('c:/Users/uokun/OneDrive/Desktop/テキスト/ynr-cs/nanryosai-2026/nanryosai-2026/pos/mobile-order.html', 'utf-8');

// スクリーンごとのDOMブロックを抽出
const screens = [
  'step-walkthrough',
  'step-notification',
  'step-terms',
  'step-stores',
  'step-menu',
  'step-checkout',
  'modal-custom',
  'modal-cart',
  'bottom-bar'
];

for (const s of screens) {
  console.log(`\n================================`);
  console.log(`📱 画面/モーダル: [${s}]`);
  const regex = new RegExp(`id=["']${s}["'][\\s\\S]*?(?=<div class=["']screen|id=["']modal|<footer|<script|$)`);
  const match = content.match(regex);
  if (!match) {
    // try finding by class
    console.log('（直接マッチせず、検索）');
    continue;
  }
  const block = match[0];
  const buttons = [...block.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
  console.log(`ボタン・リンク数: ${buttons.length}`);
  buttons.forEach(b => {
    const tag = b[0];
    const attrs = b[2];
    const text = b[3].replace(/<[^>]+>/g, '').trim().slice(0, 40);
    const id = (attrs.match(/id=["']([^"']+)["']/) || [])[1] || '(なし)';
    const onclick = (attrs.match(/onclick=["']([^"']+)["']/) || [])[1] || '(なし)';
    const hasTrack = /data-track=/.test(attrs);
    console.log(`  - [${hasTrack ? 'TRACKED' : 'UNTRACKED'}] id: "${id}", onclick: "${onclick}", text: "${text}"`);
  });
}
