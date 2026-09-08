import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./scratch/detailed_pages_report.json', 'utf-8'));
const mainPages = data.filter(p => p.file.startsWith('main/'));

for (const p of mainPages) {
  console.log(`\n======================================================`);
  console.log(`📄 【main】: ${p.file}`);
  console.log(`  - ボタン・リンク数: ${p.buttonsCount} (data-track付与: ${p.trackedButtonsCount})`);
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
