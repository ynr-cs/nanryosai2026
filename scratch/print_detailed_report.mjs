import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./scratch/detailed_pages_report.json', 'utf-8'));

for (const p of data) {
  console.log(`\n======================================================`);
  console.log(`📄 ファイル: ${p.file}`);
  console.log(`  - 静的ボタン・リンク総数: ${p.buttonsCount} (うち data-track 付与: ${p.trackedButtonsCount})`);
  console.log(`  - 測定中イベント (data-track): ${p.dataTrackDetails.length} 箇所`);
  p.dataTrackDetails.forEach(dt => console.log(`      • [data-track="${dt.eventName}"] ${dt.params ? `(${dt.params})` : ''} | tag: ${dt.tag}`));
  console.log(`  - 測定中イベント (logEvent): ${p.logEvents.length} 箇所`);
  p.logEvents.forEach(le => console.log(`      • logEvent(${le.eventName}, ${le.params})`));

  const untracked = p.buttons.filter(b => !b.hasTrack);
  if (untracked.length > 0) {
    console.log(`  ⚠️ 未測定（data-track 未付与）のボタン・リンク (${untracked.length}件):`);
    untracked.slice(0, 15).forEach(u => {
      console.log(`      - <${u.type}> id="${u.id}" onclick="${u.onclick}" href="${u.href}" text="${u.text}"`);
    });
    if (untracked.length > 15) {
      console.log(`      ... 他 ${untracked.length - 15} 件省略`);
    }
  }
}
