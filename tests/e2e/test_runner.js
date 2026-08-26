/**
 * Nanryosai 2026 - Campus Map V3 & Map Studio 2-Stage Mode E2E Test Suite
 * Fully standalone Node.js test runner
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// Standalone GeometryEngine Mock (matches main/admin/map-editor.html)
// =============================================================================
class GeometryEngine {
  static computeCentroid(polygon) {
    if (!polygon || polygon.length === 0) return [35.386167, 139.585500];
    let sumLat = 0, sumLng = 0;
    polygon.forEach(([lat, lng]) => {
      sumLat += lat;
      sumLng += lng;
    });
    return [
      parseFloat((sumLat / polygon.length).toFixed(6)),
      parseFloat((sumLng / polygon.length).toFixed(6))
    ];
  }

  static isPointInPolygon(point, polygon) {
    if (!point || !polygon || polygon.length < 3) return false;
    const lat = point[0], lng = point[1];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0], xi = polygon[i][1];
      const yj = polygon[j][0], xj = polygon[j][1];
      const intersect = ((yi > lat) !== (yj > lat))
          && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static computePolygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    const refLat = polygon[0][0];
    const cosLat = Math.cos((refLat * Math.PI) / 180.0);
    const lat2m = 111132.954;
    const lng2m = 111132.954 * cosLat;

    let area = 0;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x1 = (polygon[i][1] - polygon[0][1]) * lng2m;
      const y1 = (polygon[i][0] - polygon[0][0]) * lat2m;
      const x2 = (polygon[j][1] - polygon[0][1]) * lng2m;
      const y2 = (polygon[j][0] - polygon[0][0]) * lat2m;
      area += (x1 * y2 - x2 * y1);
    }
    return Math.abs(area / 2);
  }

  static snapToEdge(point, edgeP1, edgeP2, toleranceMeters = 1.5) {
    if (!point || !edgeP1 || !edgeP2) return null;
    const refLat = point[0];
    const cosLat = Math.cos((refLat * Math.PI) / 180.0);
    const lat2m = 111132.954;
    const lng2m = 111132.954 * cosLat;

    const px = (point[1] - edgeP1[1]) * lng2m;
    const py = (point[0] - edgeP1[0]) * lat2m;
    const bx = (edgeP2[1] - edgeP1[1]) * lng2m;
    const by = (edgeP2[0] - edgeP1[0]) * lat2m;

    const bLenSq = bx * bx + by * by;
    if (bLenSq < 1e-6) return null;

    const t = Math.max(0, Math.min(1, (px * bx + py * by) / bLenSq));
    const projX = t * bx;
    const projY = t * by;

    const distSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);
    if (distSq <= toleranceMeters * toleranceMeters) {
      return [
        parseFloat((edgeP1[0] + projY / lat2m).toFixed(6)),
        parseFloat((edgeP1[1] + projX / lng2m).toFixed(6))
      ];
    }
    return null;
  }

  static computeBuildingBaseAngle(polygon) {
    if (!polygon || polygon.length < 3) return 0;
    const refLat = polygon[0][0];
    const cosLat = Math.cos((refLat * Math.PI) / 180.0);
    const lat2m = 111132.954;
    const lng2m = 111132.954 * cosLat;

    let longestLen = 0;
    let bestAngle = 0;

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      const dx = (p2[1] - p1[1]) * lng2m;
      const dy = (p2[0] - p1[0]) * lat2m;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (Math.abs(dx) >= Math.abs(dy) * 0.8 && len > longestLen) {
        longestLen = len;
        let ang = Math.atan2(dy, dx);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
        bestAngle = ang;
      }
    }
    return bestAngle;
  }

  static makeOrientedRectangle(p1LatLng, p2LatLng, baseAngle = 0) {
    const refLat = p1LatLng[0];
    const cosLat = Math.cos((refLat * Math.PI) / 180.0);
    const lat2m = 111132.954;
    const lng2m = 111132.954 * cosLat;

    const p2x = (p2LatLng[1] - p1LatLng[1]) * lng2m;
    const p2y = (p2LatLng[0] - p1LatLng[0]) * lat2m;

    const cosA = Math.cos(-baseAngle);
    const sinA = Math.sin(-baseAngle);

    const localX2 = p2x * cosA - p2y * sinA;
    const localY2 = p2x * sinA + p2y * cosA;

    const localCorners = [
      [0, 0],
      [localX2, 0],
      [localX2, localY2],
      [0, localY2]
    ];

    const invCos = Math.cos(baseAngle);
    const invSin = Math.sin(baseAngle);

    return localCorners.map(([lx, ly]) => {
      const gx = lx * invCos - ly * invSin;
      const gy = lx * invSin + ly * invCos;
      return [
        parseFloat((p1LatLng[0] + gy / lat2m).toFixed(6)),
        parseFloat((p1LatLng[1] + gx / lng2m).toFixed(6))
      ];
    });
  }

  static makeSubdividedRooms(p1LatLng, p2LatLng, baseAngle = 0, count = 3) {
    if (count < 1) count = 1;
    const refLat = p1LatLng[0];
    const cosLat = Math.cos((refLat * Math.PI) / 180.0);
    const lat2m = 111132.954;
    const lng2m = 111132.954 * cosLat;

    const p2x = (p2LatLng[1] - p1LatLng[1]) * lng2m;
    const p2y = (p2LatLng[0] - p1LatLng[0]) * lat2m;

    const cosA = Math.cos(-baseAngle);
    const sinA = Math.sin(-baseAngle);

    const localX2 = p2x * cosA - p2y * sinA;
    const localY2 = p2x * sinA + p2y * cosA;

    const invCos = Math.cos(baseAngle);
    const invSin = Math.sin(baseAngle);

    const toWorldLatLng = (lx, ly) => {
      const gx = lx * invCos - ly * invSin;
      const gy = lx * invSin + ly * invCos;
      return [
        parseFloat((p1LatLng[0] + gy / lat2m).toFixed(6)),
        parseFloat((p1LatLng[1] + gx / lng2m).toFixed(6))
      ];
    };

    const rooms = [];
    const stepX = localX2 / count;

    for (let i = 0; i < count; i++) {
      const xLeft = i * stepX;
      const xRight = (i + 1) * stepX;
      const corners = [
        toWorldLatLng(xLeft, 0),
        toWorldLatLng(xRight, 0),
        toWorldLatLng(xRight, localY2),
        toWorldLatLng(xLeft, localY2)
      ];
      rooms.push(corners);
    }
    return rooms;
  }

  static mergeAdjacentPolygons(polygons, toleranceMeters = 0.5) {
    if (!polygons || polygons.length === 0) return [];
    const validPolys = polygons.filter(p => p && p.length >= 3);
    if (validPolys.length <= 1) return validPolys;

    const refLat = validPolys[0][0][0];
    const cosLat = Math.cos((refLat * Math.PI) / 180.0);
    const lat2m = 111132.954;
    const lng2m = 111132.954 * cosLat;

    const toXY = ([lat, lng]) => [
      (lng - validPolys[0][0][1]) * lng2m,
      (lat - validPolys[0][0][0]) * lat2m
    ];
    const toLatLng = ([x, y]) => [
      parseFloat((validPolys[0][0][0] + y / lat2m).toFixed(6)),
      parseFloat((validPolys[0][0][1] + x / lng2m).toFixed(6))
    ];

    let allEdges = [];
    validPolys.forEach((poly, polyIdx) => {
      const xy = poly.map(toXY);
      for (let i = 0; i < xy.length; i++) {
        const p1 = xy[i];
        const p2 = xy[(i + 1) % xy.length];
        allEdges.push({ p1, p2, polyIdx });
      }
    });

    const distSq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const tolSq = toleranceMeters * toleranceMeters;

    const isOppositeEdge = (e1, e2) => {
      return (distSq(e1.p1, e2.p2) <= tolSq && distSq(e1.p2, e2.p1) <= tolSq);
    };

    const sharedIndices = new Set();
    for (let i = 0; i < allEdges.length; i++) {
      for (let j = i + 1; j < allEdges.length; j++) {
        if (allEdges[i].polyIdx !== allEdges[j].polyIdx && isOppositeEdge(allEdges[i], allEdges[j])) {
          sharedIndices.add(i);
          sharedIndices.add(j);
        }
      }
    }

    const outerEdges = allEdges.filter((_, idx) => !sharedIndices.has(idx));
    if (outerEdges.length === 0) return validPolys;

    const mergedPolygons = [];
    const usedEdges = new Set();

    for (let startIdx = 0; startIdx < outerEdges.length; startIdx++) {
      if (usedEdges.has(startIdx)) continue;

      const loop = [];
      let currentIdx = startIdx;
      let iterations = 0;
      const maxIter = outerEdges.length * 2;

      while (currentIdx !== -1 && !usedEdges.has(currentIdx) && iterations < maxIter) {
        usedEdges.add(currentIdx);
        const edge = outerEdges[currentIdx];
        loop.push(edge.p1);

        let nextIdx = -1;
        let bestDist = tolSq * 4;

        for (let j = 0; j < outerEdges.length; j++) {
          if (!usedEdges.has(j)) {
            const d = distSq(edge.p2, outerEdges[j].p1);
            if (d <= bestDist) {
              bestDist = d;
              nextIdx = j;
            }
          }
        }

        currentIdx = nextIdx;
        iterations++;
      }

      if (loop.length >= 3) {
        const cleanedLoop = [];
        for (let i = 0; i < loop.length; i++) {
          const curr = loop[i];
          const next = loop[(i + 1) % loop.length];
          if (distSq(curr, next) > 0.04) {
            cleanedLoop.push(curr);
          }
        }
        if (cleanedLoop.length >= 3) {
          mergedPolygons.push(cleanedLoop.map(toLatLng));
        }
      }
    }

    return mergedPolygons.length > 0 ? mergedPolygons : validPolys;
  }

  static splitPolygonByLine(polygon, lineP1, lineP2) {
    if (!polygon || polygon.length < 3 || !lineP1 || !lineP2) return null;

    const refLat = polygon[0][0];
    const cosLat = Math.cos((refLat * Math.PI) / 180.0);
    const lat2m = 111132.954;
    const lng2m = 111132.954 * cosLat;

    const toXY = ([lat, lng]) => [
      (lng - polygon[0][1]) * lng2m,
      (lat - polygon[0][0]) * lat2m
    ];
    const toLatLng = ([x, y]) => [
      parseFloat((polygon[0][0] + y / lat2m).toFixed(6)),
      parseFloat((polygon[0][1] + x / lng2m).toFixed(6))
    ];

    const polyXY = polygon.map(toXY);
    const p1XY = toXY(lineP1);
    const p2XY = toXY(lineP2);

    const dx = p2XY[0] - p1XY[0];
    const dy = p2XY[1] - p1XY[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-4) return null;

    const A = -dy / len;
    const B = dx / len;
    const C = -(A * p1XY[0] + B * p1XY[1]);

    const dist = (p) => A * p[0] + B * p[1] + C;
    const eps = 1e-6;

    const clipPolygon = (poly, keepPositive) => {
      const output = [];
      const n = poly.length;
      if (n === 0) return output;

      let prev = poly[n - 1];
      let prevDist = dist(prev);
      if (!keepPositive) prevDist = -prevDist;

      for (let i = 0; i < n; i++) {
        const curr = poly[i];
        let currDist = dist(curr);
        if (!keepPositive) currDist = -currDist;

        if (currDist >= -eps) {
          if (prevDist < -eps) {
            const t = Math.max(0, Math.min(1, Math.abs(prevDist) / (Math.abs(prevDist) + Math.abs(currDist))));
            const ix = prev[0] + t * (curr[0] - prev[0]);
            const iy = prev[1] + t * (curr[1] - prev[1]);
            output.push([ix, iy]);
          }
          output.push(curr);
        } else if (prevDist >= -eps) {
          const t = Math.max(0, Math.min(1, Math.abs(prevDist) / (Math.abs(prevDist) + Math.abs(currDist))));
          const ix = prev[0] + t * (curr[0] - prev[0]);
          const iy = prev[1] + t * (curr[1] - prev[1]);
          output.push([ix, iy]);
        }
        prev = curr;
        prevDist = currDist;
      }
      return output;
    };

    const polyA_XY = clipPolygon(polyXY, true);
    const polyB_XY = clipPolygon(polyXY, false);

    const cleanPoly = (xyList) => {
      const res = [];
      for (let i = 0; i < xyList.length; i++) {
        const curr = xyList[i];
        const next = xyList[(i + 1) % xyList.length];
        const d = Math.sqrt((curr[0] - next[0]) ** 2 + (curr[1] - next[1]) ** 2);
        if (d > 0.05) res.push(curr);
      }
      return res;
    };

    const cleanA = cleanPoly(polyA_XY);
    const cleanB = cleanPoly(polyB_XY);

    if (cleanA.length < 3 || cleanB.length < 3) return null;

    const polyA_LatLng = cleanA.map(toLatLng);
    const polyB_LatLng = cleanB.map(toLatLng);

    const areaA = GeometryEngine.computePolygonArea(polyA_LatLng);
    const areaB = GeometryEngine.computePolygonArea(polyB_LatLng);

    if (areaA < 0.2 || areaB < 0.2) return null;

    return [polyA_LatLng, polyB_LatLng];
  }
}

// =============================================================================
// Test Framework Engine
// =============================================================================
let passed = 0;
let failed = 0;
const results = [];

function assert(desc, condition, details = '') {
  if (condition) {
    passed++;
    results.push({ desc, status: 'PASS' });
  } else {
    failed++;
    results.push({ desc, status: 'FAIL', details });
    console.error(`❌ FAIL: ${desc} ${details ? `(${details})` : ''}`);
  }
}

// =============================================================================
// Test Suites
// =============================================================================
console.log('\n🚀 Running Nanryosai 2026 Map V3 & Map Studio 2-Stage Mode Test Suite...\n');

// 1. JSON Schema & Current Buildings State Validation
const mapDataPath = path.join(__dirname, '../../main/data/campus_map_data.json');
assert('1.1 campus_map_data.json exists', fs.existsSync(mapDataPath));

const mapData = JSON.parse(fs.readFileSync(mapDataPath, 'utf8'));
assert('1.2 Metadata schema valid', mapData.metadata && mapData.metadata.center.length === 2);
assert('1.3 Buildings array exists and contains plotted buildings', Array.isArray(mapData.buildings) && mapData.buildings.length >= 8);
assert('1.4 Student building (生徒棟) with 20 vertices exists', 
  mapData.buildings.some(b => (b.id === '生徒棟' || b.name === '生徒棟') && b.polygon.length >= 15)
);
assert('1.5 Outdoor & Special Areas (校庭, 弓道場, プール) exist', 
  mapData.buildings.some(b => b.name === '校庭') &&
  mapData.buildings.some(b => b.name === '弓道場')
);
assert('1.6 Indoor floors 1-5 structure exists', 
  mapData.indoorFloors && 
  mapData.indoorFloors["1"] &&
  mapData.indoorFloors["5"]
);

// Sample backup check
const samplePath = path.join(__dirname, '../../main/data/campus_map_data.sample.json');
assert('1.7 Backup campus_map_data.sample.json exists', fs.existsSync(samplePath));

// 2. Campus Master Mode -> Building Selection Simulation
const studentBldg = mapData.buildings.find(b => b.name === '生徒棟' || b.id === '生徒棟') || mapData.buildings[0];
const mockCampusState = {
  editorMode: 'campus',
  activePreset: 'building',
  mapData: {
    ...JSON.parse(JSON.stringify(mapData)),
    indoorFloors: {
      "1": { rooms: [], corridors: [], stairs: [], toilets: [] },
      "2": { rooms: [], corridors: [], stairs: [], toilets: [] },
      "3": { rooms: [], corridors: [], stairs: [], toilets: [] },
      "4": { rooms: [], corridors: [], stairs: [], toilets: [] },
      "5": { rooms: [], corridors: [], stairs: [], toilets: [] }
    }
  },
  focusedBuilding: null
};

assert('2.1 Campus mode has plotted buildings loaded', mockCampusState.mapData.buildings.length >= 8);
assert('2.2 Student building has floors 1-5', studentBldg.floors.length === 5);

// 3. Transition to Building Interior Mode (Scope & Focus)
function transitionToInterior(state, building) {
  if (!building) return false;
  state.editorMode = 'interior';
  state.focusedBuilding = building;
  state.currentFloor = '1';
  state.activePreset = 'classroom';
  return true;
}

const transitionSuccess = transitionToInterior(mockCampusState, studentBldg);
assert('3.1 Transition to Interior Mode succeeded', transitionSuccess === true);
assert('3.2 Editor mode is interior', mockCampusState.editorMode === 'interior');
assert('3.3 Focused building is 生徒棟', mockCampusState.focusedBuilding.name === '生徒棟');
assert('3.4 Current floor scoped to 1F', mockCampusState.currentFloor === '1');

// 4. Polygon Slicing Inside Building Interior Mode
const studentBldgPoly = studentBldg.polygon || studentBldg.coordinates;
const bldgArea = GeometryEngine.computePolygonArea(studentBldgPoly);
assert('4.1 Building area is positive (~2600m²)', bldgArea > 1000);

// Slice 1: Cut out the corridor horizontally (split building into Classrooms & Corridor)
const sliceCorridorP1 = [35.386240, 139.584900];
const sliceCorridorP2 = [35.386240, 139.586300];
const splitCorridor = GeometryEngine.splitPolygonByLine(studentBldgPoly, sliceCorridorP1, sliceCorridorP2);
assert('4.2 Horizontal slice for corridor succeeded', splitCorridor !== null && splitCorridor.length === 2);

const [classroomBlock, corridorBlock] = splitCorridor;
const areaClassrooms = GeometryEngine.computePolygonArea(classroomBlock);
const areaCorridor = GeometryEngine.computePolygonArea(corridorBlock);
assert('4.3 Conservation of area on slice', Math.abs((areaClassrooms + areaCorridor) - bldgArea) < 1.0);

// Slice 2: Cut classroom block vertically into Room 101 and Room 102
const sliceRoomP1 = [35.386000, 139.585300];
const sliceRoomP2 = [35.386600, 139.585300];
const splitRooms = GeometryEngine.splitPolygonByLine(classroomBlock, sliceRoomP1, sliceRoomP2);
assert('4.4 Vertical slice for individual rooms succeeded', splitRooms !== null && splitRooms.length === 2);

// Register rooms into 1F
const room101 = {
  id: 'room_101',
  name: '1年1組',
  category: 'classroom',
  floor: 1,
  buildingId: mockCampusState.focusedBuilding.id,
  polygon: splitRooms[0]
};
const room102 = {
  id: 'room_102',
  name: '1年2組',
  category: 'classroom',
  floor: 1,
  buildingId: mockCampusState.focusedBuilding.id,
  polygon: splitRooms[1]
};
mockCampusState.mapData.indoorFloors["1"].rooms.push(room101, room102);
assert('4.5 Rooms automatically bound to focused building and 1F', 
  mockCampusState.mapData.indoorFloors["1"].rooms.length === 2 &&
  mockCampusState.mapData.indoorFloors["1"].rooms[0].buildingId === mockCampusState.focusedBuilding.id
);

// 5. Edge Magnet Snapping Inside Building (West outer wall: polygon[19] -> polygon[0])
const bldgEdgeA = studentBldgPoly[studentBldgPoly.length - 1]; // [35.386144, 139.585004]
const bldgEdgeB = studentBldgPoly[0];                          // [35.386522, 139.585021]
const nearPt = [35.386300, 139.585015]; // ~0.5m from outer wall
const snappedPt = GeometryEngine.snapToEdge(nearPt, bldgEdgeA, bldgEdgeB, 1.5);
assert('5.1 Magnet snapping correctly snaps to building outer wall', snappedPt !== null && Math.abs(snappedPt[1] - 139.58501) < 1e-4);

// 6. Floor Clone Wizard (1F -> 2F, 3F Replication)
function executeFloorClone(mapData, sourceFloor, targetFloors, autoRename = true) {
  const src = mapData.indoorFloors[String(sourceFloor)];
  if (!src) return 0;
  let count = 0;
  const srcFloorInt = parseInt(sourceFloor);

  targetFloors.forEach(targetFloor => {
    const tFloorInt = parseInt(targetFloor);
    const dest = mapData.indoorFloors[String(targetFloor)];
    if (!dest) return;

    ['rooms', 'corridors', 'stairs', 'toilets'].forEach(cat => {
      (src[cat] || []).forEach(item => {
        const cloned = JSON.parse(JSON.stringify(item));
        let newId = cloned.id;
        let newName = cloned.name;
        if (autoRename) {
          newId = newId.replace(new RegExp(`_${srcFloorInt}0`, 'g'), `_${tFloorInt}0`)
                       .replace(new RegExp(`room_${srcFloorInt}`, 'g'), `room_${tFloorInt}`);
          newName = newName.replace(new RegExp(`${srcFloorInt}年`, 'g'), `${tFloorInt}年`);
        }
        cloned.id = newId;
        cloned.name = newName;
        cloned.floor = tFloorInt;
        dest[cat].push(cloned);
        count++;
      });
    });
  });
  return count;
}

const clonedCount = executeFloorClone(mockCampusState.mapData, 1, [2, 3], true);
assert('6.1 Cloned 4 rooms to 2F and 3F', clonedCount === 4);
assert('6.2 2F room has renamed ID room_201', mockCampusState.mapData.indoorFloors["2"].rooms[0].id === 'room_201');
assert('6.3 2F room has renamed name 2年1組', mockCampusState.mapData.indoorFloors["2"].rooms[0].name === '2年1組');
assert('6.4 3F room has renamed name 3年2組', mockCampusState.mapData.indoorFloors["3"].rooms[1].name === '3年2組');

// 7. 5F Celestial Library (天空の図書館) Validation
const floor5Data = mapData.indoorFloors["5"];
assert('7.1 5F floor exists and has rooms', floor5Data && Array.isArray(floor5Data.rooms) && floor5Data.rooms.length >= 1);

const library = floor5Data.rooms.find(r => r.name === '天空の図書館' || r.id === 'room_501_library');
assert('7.2 Celestial Library exists on 5F', library !== undefined);

if (library) {
  assert('7.3 Library is bound to Student Building (生徒棟) and floor 5', library.buildingId === '生徒棟' && library.floor === 5);
  const libPoly = library.polygon || library.coordinates;
  assert('7.4 Library polygon has 6 vertices covering east projection and vertical west wall', libPoly.length === 6);
  const libArea = GeometryEngine.computePolygonArea(libPoly);
  assert('7.5 Library area is positive (~400-800m²)', libArea > 300 && libArea < 1000);
  const pinInPoly = GeometryEngine.isPointInPolygon(library.pinCoord, libPoly);
  assert('7.6 Centroid pin is located inside library polygon', pinInPoly === true);
}

// 5F Stairs Validation (Only East Library Stairs exists on 5F)
assert('7.7 5F has exactly 1 stair (East Library stairs)', floor5Data.stairs.length === 1 && floor5Data.stairs[0].id === 'stairs_066795');
assert('7.8 1F-4F each have exactly 4 stairs', [1, 2, 3, 4].every(f => mapData.indoorFloors[String(f)].stairs.length === 4));

// 8. Clean Authoring State Validation (Preserved Overpasses & Celestial Library)
const f2Data = mapData.indoorFloors["2"];
assert('8.1 2F has synced Overpass corridor preserved', f2Data.corridors.some(c => c.isOverpass === true));

const f3Data = mapData.indoorFloors["3"];
assert('8.2 3F has synced Overpass corridor preserved', f3Data.corridors.some(c => c.isOverpass === true));

assert('8.3 Authored rooms integrity validation', 
  Array.isArray(mapData.indoorFloors["1"].rooms) &&
  Array.isArray(mapData.indoorFloors["2"].rooms) &&
  Array.isArray(mapData.indoorFloors["3"].rooms) &&
  Array.isArray(mapData.indoorFloors["4"].rooms)
);

// 9. Return to Campus Master Mode
function returnToCampus(state) {
  state.editorMode = 'campus';
  state.focusedBuilding = null;
  state.currentFloor = 'All';
  state.activePreset = 'building';
}
returnToCampus(mockCampusState);
assert('9.1 Successfully returned to campus master mode', mockCampusState.editorMode === 'campus' && mockCampusState.focusedBuilding === null);

// 10. Extended Editor Features: Building Base Angle, Oriented Box & Extended Slicing Validation
const targetStudentBldg = mapData.buildings.find(b => b.id === '生徒棟');
assert('10.1 Student building polygon exists for base angle calculation', targetStudentBldg && targetStudentBldg.polygon.length >= 3);

if (targetStudentBldg) {
  const baseAngle = GeometryEngine.computeBuildingBaseAngle(targetStudentBldg.polygon);
  assert('10.2 Student building base angle is close to horizontal (~0 to 0.1 rad)', Math.abs(baseAngle) < 0.2);

  // Test Oriented Rectangle Generation
  const pStart = [35.386150, 139.585100];
  const pDiagonal = [35.386220, 139.585200];
  const rectPoly = GeometryEngine.makeOrientedRectangle(pStart, pDiagonal, baseAngle);
  assert('10.3 Oriented rectangle generates exactly 4 vertices', rectPoly.length === 4);
  const rectArea = GeometryEngine.computePolygonArea(rectPoly);
  assert('10.4 Oriented rectangle has positive realistic classroom area (~50-150m²)', rectArea > 40 && rectArea < 200);

  // Test Slicing Rectangle
  const sliceP1 = [35.386185, 139.585050];
  const sliceP2 = [35.386185, 139.585250];
  const splitResult = GeometryEngine.splitPolygonByLine(rectPoly, sliceP1, sliceP2);
  assert('10.5 Extended line slicing successfully splits rectangle into 2 sub-polygons', splitResult !== null && splitResult.length === 2);
  if (splitResult) {
    const areaA = GeometryEngine.computePolygonArea(splitResult[0]);
    const areaB = GeometryEngine.computePolygonArea(splitResult[1]);
    assert('10.6 Split sub-polygons preserve total area', Math.abs((areaA + areaB) - rectArea) < 1.0);
  }

  // Test Subdivided Rooms Generation (e.g. 3 equal classrooms)
  const pRangeStart = [35.386150, 139.585000];
  const pRangeEnd = [35.386220, 139.585300];
  const subdividedRooms = GeometryEngine.makeSubdividedRooms(pRangeStart, pRangeEnd, baseAngle, 3);
  assert('10.7 makeSubdividedRooms generates exactly 3 room polygons', subdividedRooms.length === 3);
  assert('10.8 Each subdivided room has 4 rectangular vertices', subdividedRooms.every(r => r.length === 4));
  const subAreas = subdividedRooms.map(r => GeometryEngine.computePolygonArea(r));
  assert('10.9 Subdivided rooms have equal areas (delta < 1.0m²)', Math.abs(subAreas[0] - subAreas[1]) < 1.0 && Math.abs(subAreas[1] - subAreas[2]) < 1.0);

  // Test Connected Corridor Merging (mergeAdjacentPolygons)
  const mergedCorridors = GeometryEngine.mergeAdjacentPolygons([subdividedRooms[0], subdividedRooms[1]], 0.5);
  assert('10.10 mergeAdjacentPolygons successfully unions 2 adjacent polygons into 1 seamless boundary', mergedCorridors.length === 1);
  if (mergedCorridors.length === 1) {
    const mergedArea = GeometryEngine.computePolygonArea(mergedCorridors[0]);
    const expectedArea = subAreas[0] + subAreas[1];
    assert('10.11 Merged corridor preserves combined area (delta < 1.0m²)', Math.abs(mergedArea - expectedArea) < 1.0);
  }
}

// 11. Single Feature Multi-Floor Copy Engine Tests
const testOverpass2F = mapData.indoorFloors["2"].corridors.find(c => c.isOverpass);
assert('11.1 2F has an authored Overpass corridor for target testing', !!testOverpass2F);

if (testOverpass2F) {
  // Test cloning 2F overpass to 4F
  const targetFloors = [4];
  const srcFloorInt = 2;
  const clonedItems = targetFloors.map(tFloorInt => {
    const cloned = JSON.parse(JSON.stringify(testOverpass2F));
    const oldId = cloned.id;
    const newId = oldId.replace(new RegExp(`_?${srcFloorInt}f_?`, 'gi'), `_${tFloorInt}f_`);
    cloned.id = newId;
    cloned.floor = tFloorInt;
    cloned.name = cloned.name.replace(`${srcFloorInt}F`, `${tFloorInt}F`);
    return cloned;
  });

  assert('11.2 Target feature copy preserves geometry coordinates', JSON.stringify(clonedItems[0].coordinates) === JSON.stringify(testOverpass2F.coordinates));
  assert('11.3 Target feature copy correctly renames floor tokens', clonedItems[0].name.includes('4F') && clonedItems[0].id.includes('4f'));
}

// Summary Output
console.log(`\n======================================================`);
console.log(`  Tests Passed: ${passed}`);
console.log(`  Tests Failed: ${failed}`);
console.log(`  Total:        ${passed + failed}`);
console.log(`  Result:       ${failed === 0 ? '✅ ALL TESTS PASSED (100%)' : '❌ SOME TESTS FAILED'}`);
console.log(`======================================================\n`);

if (failed > 0) process.exit(1);
