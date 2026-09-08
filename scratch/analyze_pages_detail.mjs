import fs from 'fs';
import path from 'path';

const rootDir = 'c:/Users/uokun/OneDrive/Desktop/テキスト/ynr-cs/nanryosai-2026/nanryosai-2026';

// 対象ファイルリスト（来場者・運用主要ページ）
const targetFiles = [
  'main/index.html',
  'main/projects-list.html',
  'main/stage-list.html',
  'main/detail.html',
  'main/account.html',
  'main/login.html',
  'main/map.html',
  'main/map3d.html',
  'main/access.html',
  'main/about.html',
  'main/about-us.html',
  'main/terms.html',
  'main/privacy.html',
  'main/updates.html',
  'main/mobile-order-guide.html',
  'pos/mobile-order.html',
  'pos/status.html',
  'pos/pos.html',
  'pos/kitchen.html',
  'pos/portal.html',
  'pos/monitor.html',
  'pos/presenter.html',
  'pos/sok.html',
  'pos/sok-to.html',
];

const results = [];

for (const rel of targetFiles) {
  const full = path.join(rootDir, rel);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, 'utf-8');

  // 1. data-track の全箇所
  const dataTrackDetails = [];
  const dtRegex = /<[^>]+data-track=["']([^"']+)["'][^>]*>/g;
  let match;
  while ((match = dtRegex.exec(content)) !== null) {
    const fullTag = match[0].slice(0, 200);
    const eventName = match[1];
    // extra params
    const params = [...fullTag.matchAll(/data-track-([a-zA-Z0-9_-]+)=["']([^"']+)["']/g)].map(m => `${m[1]}=${m[2]}`);
    dataTrackDetails.push({ eventName, params: params.join(', '), tag: fullTag.replace(/\s+/g, ' ').slice(0, 80) });
  }

  // 2. logEvent の全箇所
  const logEvents = [];
  const leRegex = /logEvent\s*\(\s*([^,\)]+)\s*,\s*([^,\)]+)(?:\s*,\s*([^)]+))?\)/g;
  while ((match = leRegex.exec(content)) !== null) {
    logEvents.push({
      eventName: match[2].trim(),
      params: match[3] ? match[3].replace(/\s+/g, ' ').slice(0, 80) : ''
    });
  }

  // 3. ボタン・クリック可能要素の抽出（静的）
  const buttons = [];
  const btnRegex = /<(button|a|input)[^>]*>([\s\S]*?)<\/\1>/gi;
  while ((match = btnRegex.exec(content)) !== null) {
    const tag = match[0];
    const type = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim().slice(0, 30);
    const hasTrack = /data-track=/.test(tag);
    const onclick = (tag.match(/onclick=["']([^"']+)["']/) || [])[1] || '';
    const id = (tag.match(/id=["']([^"']+)["']/) || [])[1] || '';
    const href = (tag.match(/href=["']([^"']+)["']/) || [])[1] || '';
    buttons.push({ type, text, id, onclick, href: href.slice(0, 40), hasTrack });
  }

  results.push({
    file: rel,
    dataTrackDetails,
    logEvents,
    buttonsCount: buttons.length,
    trackedButtonsCount: buttons.filter(b => b.hasTrack).length,
    buttons
  });
}

fs.writeFileSync('./scratch/detailed_pages_report.json', JSON.stringify(results, null, 2), 'utf-8');
console.log('Detailed analysis complete.');
