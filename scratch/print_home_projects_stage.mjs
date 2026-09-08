import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./scratch/detailed_pages_report.json', 'utf-8'));
const keyPages = [
  'main/index.html',
  'main/projects-list.html',
  'main/stage-list.html'
];

for (const p of data.filter(d => keyPages.includes(d.file))) {
  console.log(`\n======================================================`);
  console.log(`📄 【KEY PAGE】: ${p.file}`);
  console.log(`  - 静的ボタン・リンク数: ${p.buttonsCount} (data-track付与: ${p.trackedButtonsCount})`);
  console.log(`  - 測定イベント (data-track): ${p.dataTrackDetails.length}`);
  p.dataTrackDetails.forEach(dt => console.log(`      • [data-track="${dt.eventName}"] ${dt.params ? `(${dt.params})` : ''} | tag: ${dt.tag}`));
  console.log(`  - 測定イベント (logEvent): ${p.logEvents.length}`);
  p.logEvents.forEach(le => console.log(`      • logEvent(${le.eventName}, ${le.params})`));
  const untracked = p.buttons.filter(b => !b.hasTrack);
  console.log(`  ⚠️ 未測定ボタン・リンク: ${untracked.length}件`);
  untracked.forEach(u => {
    console.log(`      - <${u.type}> id="${u.id}" onclick="${u.onclick}" href="${u.href}" text="${u.text}"`);
  });
}
