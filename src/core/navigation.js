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
  return {
    x: width * 0.5,
    y: Math.min(height - 42, Math.max(82, height * 0.86))
  };
}

export function getHuntExitPoint(width = 960, height = 540) {
  return getHuntEntryPoint(width, height);
}

export function getRandomHuntPoint(width = 960, height = 540) {
  return {
    x: Math.max(48, Math.min(width - 48, 70 + Math.random() * Math.max(120, width - 140))),
    y: Math.max(76, Math.min(height - 58, 84 + Math.random() * Math.max(120, height - 168)))
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
