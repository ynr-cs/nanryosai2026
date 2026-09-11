const fs = require('fs');
const assert = require('assert');

console.log('=== Test 1: Campus Map Data ===');
const campus = JSON.parse(fs.readFileSync('./main/data/campus_map_data.json', 'utf8'));
const base = JSON.parse(fs.readFileSync('./main/data/campus_map_data.base.json', 'utf8'));
const avRoom = campus.indoorFloors['3'].rooms.find(r => r.roomId === 'room_admin_301_av');
const avRoomBase = base.indoorFloors['3'].rooms.find(r => r.roomId === 'room_admin_301_av');
assert(avRoom, 'AV Room not found in campus_map_data.json');
assert(avRoomBase, 'AV Room not found in campus_map_data.base.json');
assert.strictEqual(avRoom.category, 'stage');
assert.strictEqual(avRoom.buildingId, '管理棟');
assert(avRoom.linkedProjectIds.includes('keion'));
console.log('PASS: Campus Map Data OK');

console.log('=== Test 2: Data.js Consistency ===');
const path = require('path');
const { projectData, stageData } = require(path.resolve(__dirname, '../main/data/data.js'));
const keion = projectData.find(p => p.id === 'keion');
assert(keion.place.includes('管理棟 3F 視聴覚室'), 'keion place should include 管理棟 3F 視聴覚室');
const avStages = stageData.filter(s => s.place && s.place.includes('視聴覚'));
assert.strictEqual(avStages.length, 2, 'Should have 2 AV room stage events');
assert(avStages.every(s => s.description.includes('管理棟3階')), 'Stage description should mention 管理棟3階');
console.log('PASS: Data.js OK');

console.log('=== Test 3: Stage-list.html Map Link ===');
const stageListHtml = fs.readFileSync('./main/stage-list.html', 'utf8');
assert(stageListHtml.includes("stageMapUrl = 'map.html?room=room_admin_301_av'"), 'stage-list.html should link to room_admin_301_av');
console.log('PASS: Stage-list.html OK');

console.log('=== Test 4: Map.html Logic Tests ===');
const mapHtml = fs.readFileSync('./main/map.html', 'utf8');
assert(mapHtml.includes('room.linkedProjectIds.forEach'), 'map.html should bind room.linkedProjectIds');
assert(mapHtml.includes("currentFloor !== '3'"), 'map.html should avoid landmark badge duplication on 3F');
assert(mapHtml.includes("return '管理棟 3F 視聴覚室'"), 'map.html should return 管理棟 3F 視聴覚室 label');
assert(mapHtml.includes('is-av-room'), 'map.html should have is-av-room badge class');
console.log('PASS: Map.html logic OK');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
