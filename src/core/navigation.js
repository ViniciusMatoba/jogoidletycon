export function getTownGridMetrics(town, width = 960, height = 540) {
  const cols = town.grid.cols;
  const rows = town.grid.rows;
  const zone = town.buildZone || { colMin: 0, rowMin: 0, colMax: cols, rowMax: rows };
  const zoneCols = Math.max(1, zone.colMax - zone.colMin);
  const zoneRows = Math.max(1, zone.rowMax - zone.rowMin);
  const minTileW = width < 520 ? 28 : 40;
  const diag = zoneCols + zoneRows; // soma das diagonais do grid iso
  // Largura do tile: o diamante preenche a clareira de ponta a ponta,
  // com leve transbordo lateral para chegar perto da estrada marrom.
  const fillFactor = width > height ? 1.22 : 1.08;
  let tileW = Math.max(minTileW, (width * fillFactor) * 2 / diag);
  let tileH = tileW * (width > height ? 0.52 : 0.54);
  // Limita a altura do diamante à faixa visível (entre cabeçalho e rodapé),
  // senão os tiles do topo/baixo ficariam atrás da UI.
  const maxMapH = height * 0.94;
  if (diag * tileH / 2 > maxMapH) {
    tileH = (2 * maxMapH) / diag;
  }
  const mapW = diag * tileW / 2;
  const mapH = diag * tileH / 2;
  const zoneCenterCol = (zone.colMin + zone.colMax) / 2;
  const zoneCenterRow = (zone.rowMin + zone.rowMax) / 2;
  const topInset = width > height ? Math.max(74, height * 0.15) : Math.max(62, height * 0.09);

  return {
    cols,
    rows,
    tileW,
    tileH,
    originX: width / 2 - (zoneCenterCol - zoneCenterRow) * tileW / 2,
    originY: topInset - (zone.colMin + zone.rowMin) * tileH / 2,
    mapW,
    mapH,
    buildZone: zone
  };
}

export function gridToScreen(col, row, metrics) {
  return {
    x: metrics.originX + (col - row) * metrics.tileW / 2,
    y: metrics.originY + (col + row) * metrics.tileH / 2
  };
}

export function screenToGrid(x, y, town, width = 960, height = 540) {
  const metrics = getTownGridMetrics(town, width, height);
  const relX = x - metrics.originX;
  const relY = y - metrics.originY;
  const col = Math.floor((relY / (metrics.tileH / 2) + relX / (metrics.tileW / 2)) / 2);
  const row = Math.floor((relY / (metrics.tileH / 2) - relX / (metrics.tileW / 2)) / 2);

  if (col < 0 || row < 0 || col >= town.grid.cols || row >= town.grid.rows) {
    return null;
  }

  if (typeof town.isInsideBuildZone === 'function' && !town.isInsideBuildZone(col, row, { w: 1, h: 1 })) {
    return null;
  }

  return { col, row };
}

export function getTownTilePoint(town, col, row, width = 960, height = 540) {
  const metrics = getTownGridMetrics(town, width, height);
  return gridToScreen(col + 0.5, row + 0.5, metrics);
}

export function getRandomTownPoint(town, width = 960, height = 540) {
  const zone = town.buildZone || { colMin: 0, rowMin: 0, colMax: town.grid.cols, rowMax: town.grid.rows };
  const walkable = [];

  if (typeof town.isTileWalkable === 'function') {
    for (let row = zone.rowMin; row < zone.rowMax; row++) {
      for (let col = zone.colMin; col < zone.colMax; col++) {
        if (town.isTileWalkable(col, row)) walkable.push({ col, row });
      }
    }
  }

  const picked = walkable.length
    ? walkable[Math.floor(Math.random() * walkable.length)]
    : {
      col: zone.colMin + Math.floor(Math.random() * Math.max(1, zone.colMax - zone.colMin)),
      row: zone.rowMin + Math.floor(Math.random() * Math.max(1, zone.rowMax - zone.rowMin))
    };
  const { col, row } = picked;
  return getTownTilePoint(town, col, row, width, height);
}

export function getTownExitPoint(town, width = 960, height = 540) {
  const zone = town.buildZone || { colMin: 0, rowMin: 0, colMax: town.grid.cols, rowMax: town.grid.rows };
  const col = Math.floor((zone.colMin + zone.colMax) * 0.5);
  const row = zone.rowMax - 1;
  return getTownTilePoint(town, col, row, width, height);
}

export function getHuntEntryPoint(width = 960, height = 540) {
  const bounds = getHuntBounds(width, height);
  return {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: bounds.maxY
  };
}

export function getHuntExitPoint(width = 960, height = 540) {
  return getHuntEntryPoint(width, height);
}

export function getRandomHuntPoint(width = 960, height = 540) {
  const bounds = getHuntBounds(width, height);
  return {
    x: bounds.minX + Math.random() * Math.max(1, bounds.maxX - bounds.minX),
    y: bounds.minY + Math.random() * Math.max(1, bounds.maxY - bounds.minY)
  };
}

export function getHuntBounds(width = 960, height = 540) {
  const w = width || 960;
  const h = height || 540;
  const sideMargin = Math.max(42, w * 0.055);
  const topMargin = Math.max(70, h * 0.12);
  const bottomMargin = Math.max(58, h * 0.13);

  return {
    minX: sideMargin,
    maxX: Math.max(sideMargin, w - sideMargin),
    minY: topMargin,
    maxY: Math.max(topMargin, h - bottomMargin)
  };
}

export function clampHuntPoint(point, width = 960, height = 540) {
  const bounds = getHuntBounds(width, height);
  const x = Number.isFinite(point?.x) ? point.x : (bounds.minX + bounds.maxX) * 0.5;
  const y = Number.isFinite(point?.y) ? point.y : (bounds.minY + bounds.maxY) * 0.5;

  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, y))
  };
}

export function getBuildingTownPoint(town, buildingType, width = 960, height = 540) {
  const placement = town.getBuildingPlacement(buildingType);
  if (!placement || !town.isBuilt(buildingType)) return null;

  const footprint = town.getBuildingFootprint(buildingType);
  const col = Math.min(town.grid.cols - 1, placement.col + footprint.w / 2);
  const row = Math.min(town.grid.rows - 1, placement.row + footprint.h);
  return getTownTilePoint(town, col, row, width, height);
}

export function isPointInsideTown(town, x, y, width = 960, height = 540) {
  const tile = screenToGrid(x, y, town, width, height);
  return tile !== null && (typeof town.isInsideBuildZone !== 'function' || town.isInsideBuildZone(tile.col, tile.row));
}
