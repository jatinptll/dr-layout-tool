/* ============================================================
   Antonia Map Data
   Coordinates are authored in image pixels, then converted to
   percentages for the SVG renderer.
   ============================================================ */

const W = 3532;
const H = 2900;

function poly(id, points) {
  return { id, points: points.map(([x, y]) => [(x / W) * 100, (y / H) * 100]) };
}

function bandPolys(ids, x1, x2, yEdges) {
  return ids.map((id, index) => poly(id, [
    [x1, yEdges[index]],
    [x2, yEdges[index]],
    [x2, yEdges[index + 1]],
    [x1, yEdges[index + 1]],
  ]));
}

function bottomRow() {
  const ids = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  const xEdges = [682, 984, 1286, 1589, 1892, 2195, 2498, 2801, 3104, 3420];
  const bottomY = x => 2710 - (x - 682) * 0.012;

  return ids.map((id, index) => {
    const x1 = xEdges[index];
    const x2 = xEdges[index + 1];
    const rightTop = id === 1 ? 3346 : x2;
    return poly(id, [
      [x1, 2136],
      [rightTop, 2136],
      [x2, bottomY(x2)],
      [x1, bottomY(x1)],
    ]);
  });
}

export const ANTONIA_CONFIG = {
  image: 'antonia-layout.png',
  imageWidth: W,
  imageHeight: H,
  title: 'Antonia',
  subtitle: 'Houses 1-34 - Palanpur B.K.',
  totalHouses: 34,
};

export const ANTONIA_HOUSES = [
  ...bottomRow(),

  ...bandPolys([10, 11, 12, 13], 2395, 2858, [408, 665, 930, 1195, 1432]),
  ...bandPolys([17, 16, 15, 14], 1810, 2338, [408, 665, 930, 1195, 1432]),

  ...bandPolys([18, 19, 20, 21], 1192, 1640, [408, 665, 930, 1195, 1432]),
  ...bandPolys([25, 24, 23, 22], 626, 1144, [408, 665, 930, 1195, 1432]),

  ...bandPolys([26, 27, 28, 29, 30, 31, 32, 33], 24, 505, [
    408, 674, 936, 1198, 1459, 1719, 1980, 2240, 2454,
  ]),
  poly(34, [
    [24, 2454],
    [505, 2454],
    [505, 2555],
    [548, 2555],
    [548, 2576],
    [694, 2576],
    [694, 2716],
    [24, 2716],
  ]),
];
