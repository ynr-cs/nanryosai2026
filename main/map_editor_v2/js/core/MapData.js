/**
 * MapData.js — データマネージャー
 * 
 * JSON構造(mapData)の保持、ID生成、アクティブフロア取得などのデータ操作を担当。
 * context.md §8-3 準拠の階層型データ構造。
 */

// ============================================
// mapData — context.md §8-3 準拠のデータ構造
// ============================================
export const mapData = {
  version: "2.0",
  site: {
    buildings: [
      {
        id: "b_student_bldg",
        name: "生徒棟",
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        roofType: "flat",
        floors: [
          {
            id: "f_student_1f",
            level: 1,
            yOffset: 0,
            elements: { walls: [], openings: [], stairs: [] },
            zones: []
          },
          {
            id: "f_student_2f",
            level: 2,
            yOffset: 3.5,
            elements: { walls: [], openings: [], stairs: [] },
            zones: []
          },
          {
            id: "f_student_3f",
            level: 3,
            yOffset: 7.0,
            elements: { walls: [], openings: [], stairs: [] },
            zones: []
          }
        ]
      },
      {
        id: "b_admin_bldg",
        name: "管理棟",
        position: { x: 40, y: 0, z: 0 },
        rotation: 0,
        roofType: "flat",
        floors: [
          {
            id: "f_admin_1f",
            level: 1,
            yOffset: 0,
            elements: { walls: [], openings: [], stairs: [] },
            zones: []
          }
        ]
      },
      {
        id: "b_gym",
        name: "体育館",
        position: { x: -30, y: 0, z: 30 },
        rotation: 0,
        roofType: "gable",
        floors: [
          {
            id: "f_gym_1f",
            level: 1,
            yOffset: 0,
            elements: { walls: [], openings: [], stairs: [] },
            zones: []
          }
        ]
      }
    ],
    outdoorElements: [],
    connections: []
  }
};

// 壁IDカウンタ
let wallIdCounter = 0;

/** 壁IDカウンタをインクリメントして新しいIDを返す */
export function generateWallId() {
  wallIdCounter++;
  return `w_${String(wallIdCounter).padStart(3, '0')}`;
}

/** activeFloorId に対応する { building, floor } を取得 */
export function getActiveFloor(activeFloorId) {
  for (const building of mapData.site.buildings) {
    for (const floor of building.floors) {
      if (floor.id === activeFloorId) {
        return { building, floor };
      }
    }
  }
  return null;
}

/** フロアの絶対Y座標を計算（building.position.y + floor.yOffset） */
export function getFloorWorldY(building, floor) {
  return (building.position?.y || 0) + floor.yOffset;
}
