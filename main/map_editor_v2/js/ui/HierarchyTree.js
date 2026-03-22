/**
 * HierarchyTree.js — 階層ツリー UI
 * 
 * 左サイドバーの階層ツリーをmapDataから動的レンダリングし、
 * フロア選択イベントを管理する。
 */

import { mapData } from '../core/MapData.js';

// DOM要素
let hierarchyTreeEl = null;

/** 
 * 初期化: DOM要素への参照を取得する。
 * main.js から一度だけ呼ぶ。
 */
export function initHierarchyTree() {
  hierarchyTreeEl = document.getElementById('hierarchy-tree');
}

/**
 * mapData に基づいて階層ツリーの HTML を動的生成する。
 * @param {string} activeFloorId - 現在のアクティブフロアID
 * @param {function} [onFloorSelect] - フロアクリック時のコールバック (floorId) => void
 */
export function renderHierarchyTree(activeFloorId, onFloorSelect) {
  if (!hierarchyTreeEl) return;

  let html = '';

  // Site ルート
  html += `
    <div class="tree-item">
      <span class="tree-icon">🌐</span>
      <span class="tree-label">Site</span>
    </div>
    <div class="tree-children">`;

  for (const building of mapData.site.buildings) {
    const totalItems = building.floors.reduce((sum, f) => {
      const wCount = f.elements.walls.length;
      const zCount = f.zones ? f.zones.length : 0;
      return sum + wCount + zCount;
    }, 0);
    const buildingIcon = building.id === 'b_gym' ? '🏠' : '🏢';

    html += `
      <div class="tree-item">
        <span class="tree-icon">${buildingIcon}</span>
        <span class="tree-label">${building.name}</span>
        ${totalItems > 0 ? `<span class="tree-badge">${totalItems}</span>` : ''}
      </div>
      <div class="tree-children">`;

    for (const floor of building.floors) {
      const isActive = floor.id === activeFloorId;
      const wallCount = floor.elements.walls.length;
      const zoneCount = floor.zones ? floor.zones.length : 0;
      const totalCount = wallCount + zoneCount;

      html += `
        <div class="tree-item${isActive ? ' active-floor' : ''}"
             data-floor-id="${floor.id}"
             data-building-id="${building.id}">
          <span class="tree-icon">📋</span>
          <span class="tree-label">${floor.level}F (yOffset: ${floor.yOffset})</span>
          ${totalCount > 0 ? `<span class="tree-badge">${totalCount}</span>` : ''}
        </div>`;

      // フロアの壁・ Zone 要素をリスト表示
      if (totalCount > 0) {
        html += '<div class="tree-children">';
        for (const wall of floor.elements.walls) {
          html += `
            <div class="tree-item" data-wall-id="${wall.id}">
              <span class="tree-icon">🧱</span>
              <span class="tree-label">${wall.id} (L=${wall._length.toFixed(2)}m)</span>
            </div>`;
        }
        if (floor.zones) {
          for (const zone of floor.zones) {
            html += `
              <div class="tree-item" data-zone-id="${zone.id}">
                <span class="tree-icon">🟦</span>
                <span class="tree-label">${zone.id}</span>
              </div>`;
          }
        }
        html += '</div>';
      }
    }

    html += '</div>'; // building children
  }

  html += '</div>'; // site children

  hierarchyTreeEl.innerHTML = html;

  // フロアクリックイベントを再バインド
  if (onFloorSelect) {
    hierarchyTreeEl.querySelectorAll('[data-floor-id]').forEach(el => {
      el.addEventListener('click', () => {
        onFloorSelect(el.dataset.floorId);
      });
    });
  }
}
