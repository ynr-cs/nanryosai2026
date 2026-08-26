const fs = require('fs');
const data = JSON.parse(fs.readFileSync('main/data/campus_map_data.base.json', 'utf8'));

const studentBldg = data.buildings.find(b => b.id === '生徒棟');
const sPoly = studentBldg.polygon;

function getCentroid(poly) {
  let lat = 0, lng = 0;
  poly.forEach(p => { lat += p[0]; lng += p[1]; });
  return [Number((lat / poly.length).toFixed(6)), Number((lng / poly.length).toFixed(6))];
}

// ユーザーがプロットした外形南壁 (poly[19] -> poly[18]) に完全に沿う関数
function latSouth(lng) {
  const pWest = sPoly[19]; // [35.386144, 139.585004]
  const pEast = sPoly[18]; // [35.386118, 139.585915]
  const ratio = (lng - pWest[1]) / (pEast[1] - pWest[1]);
  return pWest[0] + (pEast[0] - pWest[0]) * ratio;
}

// ユーザーがプロットした外形北壁 (poly[2] -> poly[5] -> poly[10] -> poly[11]) に完全に沿う関数
function latNorth(lng) {
  if (lng <= sPoly[2][1]) {
    return sPoly[2][0]; // 35.386245
  } else if (lng <= sPoly[5][1]) {
    const ratio = (lng - sPoly[2][1]) / (sPoly[5][1] - sPoly[2][1]);
    return sPoly[2][0] + (sPoly[5][0] - sPoly[2][0]) * ratio;
  } else if (lng <= sPoly[10][1]) {
    return sPoly[10][0]; // 35.386224
  } else {
    const ratio = (lng - sPoly[10][1]) / (sPoly[11][1] - sPoly[10][1]);
    return sPoly[10][0] + (sPoly[11][0] - sPoly[10][0]) * ratio;
  }
}

// 教室と廊下の仕切り壁 (南壁から65%の位置で完全並走)
function latWall(lng) {
  const south = latSouth(lng);
  const north = latNorth(lng);
  return south + (north - south) * 0.65;
}

// 南側教室ポリゴン (外壁南端と仕切り壁に1ミリの隙間もなく一致)
function makeSouthRoom(id, name, cat, floor, x1, x2, bldg = '生徒棟', color = '#7c5cff') {
  const poly = [
    [Number(latWall(x1).toFixed(6)), Number(x1.toFixed(6))],
    [Number(latWall(x2).toFixed(6)), Number(x2.toFixed(6))],
    [Number(latSouth(x2).toFixed(6)), Number(x2.toFixed(6))],
    [Number(latSouth(x1).toFixed(6)), Number(x1.toFixed(6))]
  ];
  return {
    id, roomId: id, name, category: cat, floor, buildingId: bldg,
    polygon: poly, coordinates: poly, pinCoord: getCentroid(poly),
    style: { fillColor: color, strokeColor: '#5e35b1', fillOpacity: 0.5, weight: 1.5 }
  };
}

function makeCustomRoom(id, name, cat, floor, poly, bldg = '生徒棟', color = '#7c5cff') {
  return {
    id, roomId: id, name, category: cat, floor, buildingId: bldg,
    polygon: poly, coordinates: poly, pinCoord: getCentroid(poly),
    style: { fillColor: color, strokeColor: '#5e35b1', fillOpacity: 0.5, weight: 1.5 }
  };
}

// メイン廊下 (外形北壁と仕切り壁に完全にフィット)
function makeMainCorridor(floor) {
  const lngs = [sPoly[19][1], sPoly[2][1], sPoly[5][1], sPoly[10][1], sPoly[18][1]];
  const northPart = lngs.map(lng => [Number(latNorth(lng).toFixed(6)), Number(lng.toFixed(6))]);
  const wallPart  = [...lngs].reverse().map(lng => [Number(latWall(lng).toFixed(6)), Number(lng.toFixed(6))]);
  const poly = northPart.concat(wallPart);
  return {
    id: `corridor_${floor}f_main`,
    name: `${floor}F 生徒棟メイン廊下`,
    category: 'corridor',
    floor: floor,
    buildingId: '生徒棟',
    polygon: poly,
    coordinates: poly,
    style: { fillColor: '#64748b', strokeColor: '#475569', fillOpacity: 0.35, weight: 1.5 }
  };
}

function makeCustomStair(id, name, floor, poly, bldg = '生徒棟') {
  return {
    id, name, category: 'stairs', floor, buildingId: bldg,
    polygon: poly, coordinates: poly,
    style: { fillColor: '#f97316', strokeColor: '#ea580c', fillOpacity: 0.6, weight: 1.5 }
  };
}

function makeCustomToilet(id, name, floor, gender, poly, bldg = '生徒棟') {
  const color = gender === 'female' ? '#ec4899' : (gender === 'male' ? '#38bdf8' : '#a855f7');
  return {
    id, name, category: 'toilet', gender, floor, buildingId: bldg,
    polygon: poly, coordinates: poly,
    style: { fillColor: color, strokeColor: color, fillOpacity: 0.55, weight: 1.5 }
  };
}

// 南壁の区切り
const X_W   = sPoly[19][1];
const X_R1  = 139.585125;
const X_R2  = 139.585240;
const X_R3  = 139.585355;
const X_R4  = 139.585470;
const X_R5  = 139.585585;
const X_MID = 139.585640;
const X_R6  = 139.585750;
const X_R7  = 139.585860;
const X_E   = sPoly[18][1];

// 西北突起（理科実験室ブロック）: 外形ポリゴンの頂点を共有
const WN_P0 = sPoly[0];
const WN_P1 = sPoly[1];
const WN_P2 = sPoly[2];
const WN_P_SW = [Number(latNorth(WN_P0[1]).toFixed(6)), WN_P0[1]];

const WN_LAT_MID = 35.386380;
const WN_LAT_SUB = 35.386305;
const WN_LNG_M   = 139.585087;

const wnPolyTop = [
  [WN_P0[0], WN_P0[1]],
  [WN_P1[0], WN_P1[1]],
  [WN_LAT_MID, WN_P1[1]],
  [WN_LAT_MID, WN_P0[1]]
];

const wnPolyMid = [
  [WN_LAT_MID, WN_P0[1]],
  [WN_LAT_MID, WN_P1[1]],
  [WN_LAT_SUB, WN_P1[1]],
  [WN_LAT_SUB, WN_P0[1]]
];

const wnPolyBotW = [
  [WN_LAT_SUB, WN_P0[1]],
  [WN_LAT_SUB, WN_LNG_M],
  [WN_P_SW[0], WN_LNG_M],
  [WN_P_SW[0], WN_P0[1]]
];

const wnPolyBotE = [
  [WN_LAT_SUB, WN_LNG_M],
  [WN_LAT_SUB, WN_P1[1]],
  [WN_P2[0], WN_P2[1]],
  [WN_P_SW[0], WN_LNG_M]
];

// 中北突起（特別教室・昇降口ブロック）: 外形ポリゴンの頂点を共有
const CN_P5 = sPoly[5];
const CN_P6 = sPoly[6];
const CN_P7 = sPoly[7];
const CN_P8 = sPoly[8];

const CN_LAT_MID = 35.386360;
const CN_LNG_M   = 139.585805;

const cnPolyTop = [
  [CN_P6[0], CN_P6[1]],
  [CN_P7[0], CN_P7[1]],
  [CN_LAT_MID, CN_P7[1]],
  [CN_LAT_MID, CN_P6[1]]
];

const cnPolyBotW = [
  [CN_LAT_MID, CN_P6[1]],
  [CN_LAT_MID, CN_LNG_M],
  [CN_P5[0], CN_LNG_M],
  [CN_P5[0], CN_P5[1]]
];

const cnPolyBotE = [
  [CN_LAT_MID, CN_LNG_M],
  [CN_LAT_MID, CN_P7[1]],
  [CN_P8[0], CN_P8[1]],
  [CN_P5[0], CN_LNG_M]
];

// 東新設棟（ガクッとズレた部分）: 外形ポリゴンの全頂点を共有
const EA_P12 = sPoly[12];
const EA_P13 = sPoly[13];
const EA_P14 = sPoly[14];
const EA_P15 = sPoly[15];
const EA_P16 = sPoly[16];
const EA_P17 = sPoly[17];

const eaPolyWest = [
  [EA_P12[0], EA_P12[1]],
  [EA_P13[0], EA_P13[1]],
  [EA_P17[0], EA_P13[1]],
  [EA_P17[0], EA_P17[1]]
];

const eaPolyEastNorth = [
  [EA_P14[0], EA_P14[1]],
  [EA_P15[0], EA_P15[1]],
  [EA_P13[0], EA_P15[1]],
  [EA_P13[0], EA_P14[1]]
];

const eaPolyEastSouth = [
  [EA_P13[0], EA_P13[1]],
  [EA_P13[0], EA_P15[1]],
  [EA_P16[0], EA_P16[1]],
  [EA_P17[0], EA_P13[1]]
];

// 管理棟外枠
const adminPoly = [
  [35.386038, 139.585523],
  [35.386032, 139.585838],
  [35.385855, 139.585834],
  [35.385864, 139.585512]
];

// =============================================================================
// Build 1F
// =============================================================================
const f1 = {
  rooms: [
    makeSouthRoom('room_101_memorial', '記念室', 'special_room', 1, X_W, X_R1),
    makeSouthRoom('room_102_36', '36', 'special_room', 1, X_R1, X_R2),
    makeSouthRoom('room_103_37', '37', 'special_room', 1, X_R2, X_R3),
    makeSouthRoom('room_104_select', '選択教室', 'classroom', 1, X_R3, X_R4),
    makeSouthRoom('room_105_council', '生徒会室', 'facility', 1, X_R4, X_R5),
    makeSouthRoom('room_106_career', '進路指導室', 'staff_room', 1, X_MID, X_R6),
    makeSouthRoom('room_107_dining', '食事室', 'facility', 1, X_R6, X_R7),
    makeSouthRoom('room_108_cooking', '調理室', 'special_room', 1, X_R7, X_E),
    makeCustomRoom('room_109_chem', '化学実験室', 'special_room', 1, wnPolyTop, '生徒棟', '#38bdf8'),
    makeCustomRoom('room_110_chem_prep', '化学準備室', 'special_room', 1, wnPolyMid),
    makeCustomRoom('room_111_dark', '暗室', 'facility', 1, wnPolyBotW),
    makeCustomRoom('room_112_shop', '売店', 'shop', 1, cnPolyTop, '生徒棟', '#f59e0b'),
    makeCustomRoom('room_114_entrance', '生徒昇降口', 'hall', 1, cnPolyBotW, '生徒棟', '#10b981'),
    makeCustomRoom('room_116_nurse', '保健室', 'facility', 1, eaPolyWest, '生徒棟', '#ec4899'),
    makeCustomRoom('room_117_machine', '機械室', 'facility', 1, eaPolyEastSouth)
  ],
  corridors: [ makeMainCorridor(1) ],
  stairs: [
    makeCustomStair('stairs_1f_west', '西階段 (1F)', 1, wnPolyBotE),
    makeCustomStair('stairs_1f_center', '中央階段 (1F)', 1, [
      [Number(latWall(X_R5).toFixed(6)), X_R5], [Number(latWall(X_MID).toFixed(6)), X_MID],
      [Number(latSouth(X_MID).toFixed(6)), X_MID], [Number(latSouth(X_R5).toFixed(6)), X_R5]
    ]),
    makeCustomStair('stairs_1f_north', '北昇降口階段 (1F)', 1, cnPolyBotE),
    makeCustomStair('stairs_1f_east', '東階段 (1F)', 1, eaPolyEastNorth)
  ],
  toilets: [
    makeCustomToilet('toilet_1f_center', '🚹 男子トイレ (1F中央)', 1, 'male', [
      [Number(latNorth(X_R5).toFixed(6)), X_R5], [Number(latNorth(X_MID).toFixed(6)), X_MID],
      [Number(latWall(X_MID).toFixed(6)), X_MID], [Number(latWall(X_R5).toFixed(6)), X_R5]
    ])
  ]
};

// =============================================================================
// Build 2F
// =============================================================================
const f2 = {
  rooms: [
    makeSouthRoom('room_301', '3年1組', 'classroom', 2, X_W, X_R1),
    makeSouthRoom('room_302', '3年2組', 'classroom', 2, X_R1, X_R2),
    makeSouthRoom('room_303', '3年3組', 'classroom', 2, X_R2, X_R3),
    makeSouthRoom('room_304', '3年4組', 'classroom', 2, X_R3, X_R4),
    makeSouthRoom('room_305', '3年5組', 'classroom', 2, X_R4, X_R5),
    makeSouthRoom('room_201_resource_prep', 'リソース準備室', 'special_room', 2, X_MID, X_R6),
    makeSouthRoom('room_202_pc', 'コンピュータ教室', 'special_room', 2, X_R6, X_E, '生徒棟', '#0284c7'),
    makeCustomRoom('room_203_physics', '物理実験室', 'special_room', 2, wnPolyTop, '生徒棟', '#38bdf8'),
    makeCustomRoom('room_204_physics_prep', '物理準備室', 'special_room', 2, wnPolyMid),
    makeCustomRoom('room_205_dark', '暗室', 'facility', 2, wnPolyBotW),
    makeCustomRoom('room_206_calligraphy', '書道室', 'special_room', 2, cnPolyTop, '生徒棟', '#a855f7'),
    makeCustomRoom('room_207_calli_prep', '書道準備室', 'special_room', 2, cnPolyBotW),
    makeCustomRoom('room_209_clothing', '被服室', 'special_room', 2, eaPolyWest, '生徒棟', '#f43f5e'),
    makeCustomRoom('room_210_home_mat', '家庭科教材室', 'special_room', 2, eaPolyEastSouth),
    makeCustomRoom('room_211_manner', '作法室', 'special_room', 2, eaPolyEastNorth, '生徒棟', '#10b981'),
    makeCustomRoom('room_admin_201_staff', '職員室 (文化祭警備本部)', 'staff_room', 2, adminPoly, '管理棟', '#7c5cff')
  ],
  corridors: [
    makeMainCorridor(2),
    data.indoorFloors['2'].corridors.find(c => c.isOverpass) || data.indoorFloors['2'].corridors[0]
  ],
  stairs: [
    makeCustomStair('stairs_2f_west', '西階段 (2F)', 2, wnPolyBotE),
    makeCustomStair('stairs_2f_center', '中央階段 (2F)', 2, [
      [Number(latWall(X_R5).toFixed(6)), X_R5], [Number(latWall(X_MID).toFixed(6)), X_MID],
      [Number(latSouth(X_MID).toFixed(6)), X_MID], [Number(latSouth(X_R5).toFixed(6)), X_R5]
    ]),
    makeCustomStair('stairs_2f_north', '北階段 (2F)', 2, cnPolyBotE),
    makeCustomStair('stairs_2f_east', '東階段 (2F)', 2, eaPolyEastNorth)
  ],
  toilets: [
    makeCustomToilet('toilet_2f_center', '🚺 女子トイレ (2F中央)', 2, 'female', [
      [Number(latNorth(X_R5).toFixed(6)), X_R5], [Number(latNorth(X_MID).toFixed(6)), X_MID],
      [Number(latWall(X_MID).toFixed(6)), X_MID], [Number(latWall(X_R5).toFixed(6)), X_R5]
    ])
  ]
};

// =============================================================================
// Build 3F
// =============================================================================
const f3 = {
  rooms: [
    makeSouthRoom('room_201', '2年1組', 'classroom', 3, X_W, X_R1),
    makeSouthRoom('room_202', '2年2組', 'classroom', 3, X_R1, X_R2),
    makeSouthRoom('room_203', '2年3組', 'classroom', 3, X_R2, X_R3),
    makeSouthRoom('room_204', '2年4組', 'classroom', 3, X_R3, X_R4),
    makeSouthRoom('room_205', '2年5組', 'classroom', 3, X_R4, X_R5),
    makeSouthRoom('room_206', '2年6組', 'classroom', 3, X_MID, X_R6),
    makeSouthRoom('room_207', '2年7組', 'classroom', 3, X_R6, X_E),
    makeCustomRoom('room_301_bio', '生物実験室', 'special_room', 3, wnPolyTop, '生徒棟', '#10b981'),
    makeCustomRoom('room_302_bio_prep', '生物準備室', 'special_room', 3, wnPolyMid),
    makeCustomRoom('room_303_art', '美術室', 'special_room', 3, cnPolyTop, '生徒棟', '#ec4899'),
    makeCustomRoom('room_304_art_prep', '美術準備室', 'special_room', 3, cnPolyBotW),
    makeCustomRoom('room_305_social', '社会科学習室', 'special_room', 3, eaPolyWest, '生徒棟', '#f59e0b'),
    makeCustomRoom('room_306_resource2', 'リソースルーム2', 'special_room', 3, eaPolyEastSouth),
    makeCustomRoom('room_admin_301_av', '視聴覚室', 'stage', 3, adminPoly, '管理棟', '#eab308')
  ],
  corridors: [
    makeMainCorridor(3),
    data.indoorFloors['3'].corridors.find(c => c.isOverpass) || data.indoorFloors['3'].corridors[0]
  ],
  stairs: [
    makeCustomStair('stairs_3f_west', '西階段 (3F)', 3, wnPolyBotE),
    makeCustomStair('stairs_3f_center', '中央階段 (3F)', 3, [
      [Number(latWall(X_R5).toFixed(6)), X_R5], [Number(latWall(X_MID).toFixed(6)), X_MID],
      [Number(latSouth(X_MID).toFixed(6)), X_MID], [Number(latSouth(X_R5).toFixed(6)), X_R5]
    ]),
    makeCustomStair('stairs_3f_north', '北階段 (3F)', 3, cnPolyBotE),
    makeCustomStair('stairs_3f_east', '東階段 (3F)', 3, eaPolyEastNorth)
  ],
  toilets: [
    makeCustomToilet('toilet_3f_center', '🚹 男子トイレ (3F中央)', 3, 'male', [
      [Number(latNorth(X_R5).toFixed(6)), X_R5], [Number(latNorth(X_MID).toFixed(6)), X_MID],
      [Number(latWall(X_MID).toFixed(6)), X_MID], [Number(latWall(X_R5).toFixed(6)), X_R5]
    ])
  ]
};

// =============================================================================
// Build 4F
// =============================================================================
const f4 = {
  rooms: [
    makeSouthRoom('room_101', '1年1組', 'classroom', 4, X_W, X_R1),
    makeSouthRoom('room_102', '1年2組', 'classroom', 4, X_R1, X_R2),
    makeSouthRoom('room_103', '1年3組', 'classroom', 4, X_R2, X_R3),
    makeSouthRoom('room_104', '1年4組', 'classroom', 4, X_R3, X_R4),
    makeSouthRoom('room_105', '1年5組', 'classroom', 4, X_R4, X_R5),
    makeSouthRoom('room_401_resource1', 'リソースルーム1', 'special_room', 4, X_MID, X_R6),
    makeSouthRoom('room_402_small_group', '小集団教室', 'classroom', 4, X_R6, X_E),
    makeCustomRoom('room_404_subject_prep', '教科準備室', 'staff_room', 4, wnPolyTop),
    makeCustomRoom('room_405_club_store', '文化部倉庫', 'facility', 4, wnPolyMid),
    makeCustomRoom('room_406_music', '音楽室', 'special_room', 4, cnPolyTop, '生徒棟', '#f43f5e'),
    makeCustomRoom('room_407_music_prep', '音楽準備室', 'special_room', 4, cnPolyBotW),
    makeCustomRoom('room_106', '1年6組', 'classroom', 4, eaPolyWest),
    makeCustomRoom('room_107', '1年7組', 'classroom', 4, eaPolyEastSouth)
  ],
  corridors: [ makeMainCorridor(4) ],
  stairs: [
    makeCustomStair('stairs_4f_west', '西階段 (4F)', 4, wnPolyBotE),
    makeCustomStair('stairs_4f_center', '中央階段 (4F)', 4, [
      [Number(latWall(X_R5).toFixed(6)), X_R5], [Number(latWall(X_MID).toFixed(6)), X_MID],
      [Number(latSouth(X_MID).toFixed(6)), X_MID], [Number(latSouth(X_R5).toFixed(6)), X_R5]
    ]),
    makeCustomStair('stairs_4f_north', '北階段 (4F)', 4, cnPolyBotE),
    makeCustomStair('stairs_4f_east', '東階段 (4F)', 4, eaPolyEastNorth)
  ],
  toilets: [
    makeCustomToilet('toilet_4f_center', '🚺 女子トイレ (4F中央)', 4, 'female', [
      [Number(latNorth(X_R5).toFixed(6)), X_R5], [Number(latNorth(X_MID).toFixed(6)), X_MID],
      [Number(latWall(X_MID).toFixed(6)), X_MID], [Number(latWall(X_R5).toFixed(6)), X_R5]
    ])
  ]
};

data.indoorFloors['1'] = f1;
data.indoorFloors['2'] = f2;
data.indoorFloors['3'] = f3;
data.indoorFloors['4'] = f4;
data.metadata.updatedAt = new Date().toISOString();

fs.writeFileSync('main/data/campus_map_data.json', JSON.stringify(data, null, 2), 'utf8');
console.log('ALL FLOORS EXACTLY FITTED TO STUDENT BUILDING BOUNDARY POLYGON!');
