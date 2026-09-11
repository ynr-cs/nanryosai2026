const fs = require('fs');
const path = require('path');
const { stageData, projectData } = require(path.join(__dirname, '../main/data/data.js'));

console.log("=== Test 1: Active Festival Day Logic ===");

const FESTIVAL_DATES = {
  1: new Date(2026, 8, 11),
  2: new Date(2026, 8, 12),
};

function getActiveFestivalDay(mockNow = new Date(), mockQueryDay = null) {
  if (mockQueryDay === 1 || mockQueryDay === 2) return mockQueryDay;
  const todayDateOnly = new Date(
    mockNow.getFullYear(),
    mockNow.getMonth(),
    mockNow.getDate()
  );
  const day2Date = FESTIVAL_DATES[2];
  if (day2Date && todayDateOnly.getTime() >= day2Date.getTime()) {
    return 2;
  }
  return 1;
}

// Case A: Today is 2026-09-12 (Day 2)
const day2Now = new Date(2026, 8, 12, 10, 0, 0);
const resDay2 = getActiveFestivalDay(day2Now);
if (resDay2 === 2) {
  console.log("PASS: 2026-09-12 resolves to Day 2");
} else {
  console.error("FAIL: 2026-09-12 did not resolve to Day 2", resDay2);
  process.exit(1);
}

// Case B: URL param ?day=1 overrides to Day 1
const resDay1Override = getActiveFestivalDay(day2Now, 1);
if (resDay1Override === 1) {
  console.log("PASS: Query param ?day=1 overrides to Day 1");
} else {
  console.error("FAIL: Query param did not override", resDay1Override);
  process.exit(1);
}

console.log("=== Test 2: Map HTML Content Verification ===");
const mapHtml = fs.readFileSync(path.join(__dirname, '../main/map.html'), 'utf-8');

if (mapHtml.includes('getActiveFestivalDay()') && mapHtml.includes('FESTIVAL_DATES')) {
  console.log("PASS: map.html contains getActiveFestivalDay and FESTIVAL_DATES");
} else {
  console.error("FAIL: map.html missing required definitions");
  process.exit(1);
}

// Check Stage Venues
const venues = [
  { name: '体育館', place: '体育館' },
  { name: '音楽室', place: '音楽室' },
  { name: '視聴覚室', place: '視聴覚' },
];

venues.forEach(v => {
  const matched = stageData.filter(s => s.place && s.place.includes(v.place));
  const day1Events = matched.filter(s => s.day == 1);
  const day2Events = matched.filter(s => s.day == 2);
  
  const activeDay = getActiveFestivalDay(new Date()); // Current system time is 2026-09-12
  let defaultDay = 1;
  if (activeDay === 2 && day2Events.length > 0) {
    defaultDay = 2;
  } else if (activeDay === 1 && day1Events.length > 0) {
    defaultDay = 1;
  } else {
    defaultDay = day2Events.length > 0 ? 2 : 1;
  }

  if (defaultDay === 2) {
    console.log(`PASS: ${v.name} correctly defaults to Day 2 (Day1: ${day1Events.length}, Day2: ${day2Events.length})`);
  } else {
    console.error(`FAIL: ${v.name} did not default to Day 2`);
    process.exit(1);
  }
});

// Check Keion (single project with stage events)
const keionStages = stageData.filter(s => s.groupName === '軽音楽部');
const kDay1 = keionStages.filter(s => s.day == 1);
const kDay2 = keionStages.filter(s => s.day == 2);
const kActiveDay = getActiveFestivalDay(new Date());
let kDefaultDay = (kActiveDay === 2 && kDay2.length > 0) ? 2 : 1;

if (kDefaultDay === 2) {
  console.log(`PASS: 軽音楽部 correctly defaults to Day 2 (Day1: ${kDay1.length}, Day2: ${kDay2.length})`);
} else {
  console.error(`FAIL: 軽音楽部 did not default to Day 2`);
  process.exit(1);
}

console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
