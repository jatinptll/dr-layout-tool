/* ============================================================
   Aranya Map Data
   Coordinates are authored in image pixels, then converted to
   percentages for the SVG renderer.
   ============================================================ */

const W = 3526;
const H = 2900;

function poly(id, points) {
  return { id, points: points.map(([x, y]) => [(x / W) * 100, (y / H) * 100]) };
}

function pairedBands(rows, leftX1, leftX2, rightX1, rightX2) {
  return rows.flatMap(([leftId, rightId, y1, y2]) => [
    poly(leftId, [
      [leftX1, y1],
      [leftX2, y1],
      [leftX2, y2],
      [leftX1, y2],
    ]),
    poly(rightId, [
      [rightX1, y1],
      [rightX2, y1],
      [rightX2, y2],
      [rightX1, y2],
    ]),
  ]);
}

function diagonalRows() {
  const ids = [68, 67, 66, 65, 64, 63, 62, 61, 60, 59];
  const leftY = [842, 1038, 1228, 1420, 1610, 1802, 1994, 2187, 2378, 2573, 2774];
  const rightY = [812, 1011, 1207, 1398, 1587, 1780, 1972, 2164, 2354, 2550, 2737];
  const leftX = y => 112 + (y - 842) * 0.126;
  const rightX = y => 502 + (y - 812) * 0.088;

  return ids.map((id, index) => {
    const ly1 = leftY[index];
    const ly2 = leftY[index + 1];
    const ry1 = rightY[index];
    const ry2 = rightY[index + 1];
    return poly(id, [
      [leftX(ly1), ly1],
      [rightX(ry1), ry1],
      [rightX(ry2), ry2],
      [leftX(ly2), ly2],
    ]);
  });
}

export const ARANYA_CONFIG = {
  image: 'aranya-layout.png',
  imageWidth: W,
  imageHeight: H,
  title: 'Aranya',
  subtitle: 'Houses 1-68 - Palanpur B.K.',
  totalHouses: 68,
};

export const ARANYA_HOUSES = [
  ...pairedBands([
    [12, 11, 390, 596],
    [13, 10, 596, 782],
    [14, 9, 782, 980],
    [15, 8, 980, 1172],
    [16, 7, 1172, 1365],
    [17, 6, 1365, 1555],
    [18, 5, 1722, 1920],
    [19, 4, 1920, 2112],
    [20, 3, 2112, 2305],
    [21, 2, 2305, 2498],
    [22, 1, 2498, 2712],
  ], 2552, 2922, 2954, 3335),

  ...pairedBands([
    [30, 29, 1345, 1540],
    [31, 28, 1540, 1730],
    [32, 27, 1730, 1922],
    [33, 26, 1922, 2115],
    [34, 25, 2115, 2306],
    [35, 24, 2306, 2498],
    [36, 23, 2498, 2710],
  ], 1694, 2047, 2076, 2428),

  ...pairedBands([
    [48, 47, 390, 596],
    [49, 46, 596, 782],
    [50, 45, 782, 980],
    [51, 44, 980, 1172],
    [52, 43, 1172, 1365],
    [53, 42, 1365, 1555],
    [54, 41, 1722, 1920],
    [55, 40, 1920, 2112],
    [56, 39, 2112, 2305],
    [57, 38, 2305, 2498],
    [58, 37, 2498, 2712],
  ], 865, 1212, 1243, 1548),

  ...diagonalRows(),
];
