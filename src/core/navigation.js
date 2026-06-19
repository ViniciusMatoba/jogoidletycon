export function getTownGridMetrics(town, width = 960, height = 540) {
  const cols = town.grid.cols;
  const rows = town.grid.rows;
  const tileW = Math.max(44, Math.min(width / (cols * 0.72), height / (rows * 0.42)));
  const tileH = tileW * 0.5;
  const mapW = (cols + rows) * tileW / 2;
  const mapH = (cols + rows) * tileH / 2;

  return {
    cols,
    rows,
    tileW,
    tileH,
    originX: width / 2,
    originY: Math.max(52, (height - mapH) / 2 + tileH),
    mapW,
    mapH
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

  return { col, row };
}

export function getTownTilePoint(town, col, row, width = 960, height = 540) {
  const metrics = getTownGridMetrics(town, width, height);
  return gridToScreen(col + 0.5, row + 0.5, metrics);
}

export function getRandomTownPoint(town, width = 960, height = 540) {
  const col = Math.floor(Math.random() * town.grid.cols);
  const row = Math.floor(Math.random() * town.grid.rows);
  return getTownTilePoint(town, col, row, width, height);
}

export function getTownExitPoint(town, width = 960, height = 540) {
  const col = Math.floor(town.grid.cols * 0.5);
  const row = town.grid.rows - 1;
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
  return screenToGrid(x, y, town, width, height) !== null;
}
