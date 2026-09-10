const assert = require('assert');
const path = require('path');
const { projectData, stageData } = require(path.join(__dirname, '../main/data/data.js'));

console.log("=== Nanryosai 2026 data.js Verification Test ===");

// 1. 基本件数チェック
console.log(`1. Total Projects: ${projectData.length} (Expected: 47)`);
assert.strictEqual(projectData.length, 47, "Total projectData count must be exactly 47");

console.log(`2. Total Stages: ${stageData.length} (Expected: 24)`);
assert.strictEqual(stageData.length, 24, "Total stageData count must be exactly 24");

// 2. ID一意性チェック
const idSet = new Set();
projectData.forEach(p => {
  assert(!idSet.has(p.id), `Duplicate project ID found: ${p.id}`);
  idSet.add(p.id);
});
console.log("3. Project IDs uniqueness: PASS (All 47 IDs are unique)");

// 3. 必須フィールドチェック
const requiredFields = ['id', 'loginId', 'groupName', 'name', 'place', 'category', 'votingCategory', 'useMobileOrder', 'catchphrase', 'description', 'tags', 'contentType'];
projectData.forEach(p => {
  requiredFields.forEach(f => {
    assert(p[f] !== undefined && p[f] !== null, `Missing required field '${f}' in project ${p.id}`);
  });
  assert(p.floor !== undefined, `Missing 'floor' field in project ${p.id}`);
});
console.log("4. Required fields check: PASS (All fields present)");

// 4. 今回更新した8団体の詳細検証
const batch2Checks = {
  "101": {
    name: "銭安堂",
    catchphrase: "安い美味い早い銭安堂",
    category: "shop",
    votingCategory: "shop",
    instagram: "lxaf2_",
    descSnippet: "安さを重視した昔ながらの駄菓子屋"
  },
  "103": {
    name: "Club13",
    catchphrase: "溶ける前に恋しよう",
    category: "shop",
    votingCategory: "shop",
    instagram: "ynr.1_3",
    descSnippet: "アイスとジュースを片手に"
  },
  "104": {
    name: "トイストーリーマニア",
    catchphrase: "おもちゃの世界へlet's go",
    category: "exhibit",
    votingCategory: "exhibit",
    instagram: "kai102011222",
    descSnippet: "某遊園地にあるトイストーリーマニアとルールは同じです"
  },
  "105": {
    name: "アリスのティーパーティー",
    catchphrase: "あなたをアリスの世界へご招待",
    category: "shop",
    votingCategory: "shop",
    instagram: "kk0621omu",
    descSnippet: "男子がメイド服、女子が執事服を着る"
  },
  "107": {
    name: "PINK MONSTER",
    catchphrase: "ウチらの平成マジチョベリグ",
    category: "shop",
    votingCategory: "shop",
    instagram: "haruma.s0329",
    descSnippet: "PINK MONSTERは平成の懐かしさを感じる"
  },
  "202": {
    name: "前園の闇カジノ",
    catchphrase: "運命は君の手に",
    category: "exhibit",
    votingCategory: "exhibit",
    instagram: "si2o_o9",
    descSnippet: "前園の闇カジノです！ポイントは写真スポットです"
  },
  "game_club": {
    name: "スマブラ王決定戦2026",
    catchphrase: "南陵最強が今年も決まる！",
    category: "exhibit",
    votingCategory: "exhibit",
    instagram: "salmon201213",
    descSnippet: "トーナメント方式で南陵高校の在学生"
  },
  "pta": {
    name: "南陵Mart",
    catchphrase: "あなたとコンビニ南陵マート",
    category: "shop",
    votingCategory: "shop",
    descSnippet: "南陵マート、お菓子、飲み物、パンあります"
  }
};

for (const [id, expected] of Object.entries(batch2Checks)) {
  const p = projectData.find(proj => proj.id === id);
  assert(p, `Project not found: ${id}`);
  assert.strictEqual(p.name, expected.name, `${id} name mismatch`);
  assert.strictEqual(p.catchphrase, expected.catchphrase, `${id} catchphrase mismatch`);
  assert.strictEqual(p.category, expected.category, `${id} category mismatch`);
  assert.strictEqual(p.votingCategory, expected.votingCategory, `${id} votingCategory mismatch`);
  if (expected.instagram) {
    assert.strictEqual(p.instagram, expected.instagram, `${id} instagram mismatch`);
  }
  assert(p.description.includes(expected.descSnippet), `${id} description does not contain snippet: ${expected.descSnippet}`);
  console.log(`  ✓ Verified project ${id} (${p.name})`);
}
console.log("5. 2nd batch 8 groups verification: PASS");

// 5. 部門別件数の集計検証
const categoryCounts = {};
const votingCategoryCounts = {};
projectData.forEach(p => {
  categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  votingCategoryCounts[p.votingCategory] = (votingCategoryCounts[p.votingCategory] || 0) + 1;
});
console.log("6. Category Breakdown:", categoryCounts);
console.log("   Voting Category Breakdown:", votingCategoryCounts);
// cooking: 8, shop: 9, exhibit: 17, stage: 13 (stage 12 + extra/unison or other)
assert.strictEqual(votingCategoryCounts.cooking, 8, "cooking should be 8");
assert.strictEqual(votingCategoryCounts.shop, 9, "shop should be 9 (107 joined shop)");
assert.strictEqual(votingCategoryCounts.exhibit, 18, "exhibit should be 18 (107 moved from exhibit to shop)");
assert.strictEqual(votingCategoryCounts.stage, 12, "stage should be 12");

console.log("=== ALL DATA.JS VERIFICATION TESTS PASSED SUCCESSFULLY! ===");
