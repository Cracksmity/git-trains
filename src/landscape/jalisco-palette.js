// The same inks are resolved by the README SVG and the raster exporter.
const inks = {
  sky0: ['#83b4c4', '#101b36'], sky1: ['#a4cbd2', '#213252'],
  sky2: ['#c6d9d5', '#424563'], sky3: ['#efdac0', '#685066'],
  haze: ['#e8d7b9', '#544b62'], afterglow: ['#edcda2', '#725968'], cloud: ['#e7ece1', '#32405c'],
  ridge: ['#9caaa6', '#424761'], ridgeShade: ['#7d9293', '#303d56'],
  tower: ['#8b9ca1', '#404660'], towerEdge: ['#abb8b6', '#5a5a70'],
  stone: ['#c4a482', '#a38172'], stoneLit: ['#e6caa0', '#d1a779'],
  stoneShade: ['#977e70', '#76636a'], recess: ['#715f60', '#413f51'],
  tile: ['#ac644d', '#85505a'], tileLit: ['#db9266', '#b87865'],
  ochre: ['#c49750', '#ac794c'], ochreLit: ['#e4bf72', '#d9ad62'],
  foliage: ['#57755c', '#364851'], foliageLit: ['#7a9069', '#4c5a5c'],
  field: ['#b3916a', '#645452'], furrow: ['#96785c', '#503f46'],
  grassland: ['#9caa78', '#51594e'], pasture: ['#819568', '#394b45'],
  agave: ['#427d7d', '#468185'], agaveLit: ['#74a7a0', '#80b1a7'],
  agaveShade: ['#325e62', '#2d565e'], glassWarm: ['#786252', '#f0c780'],
  mast: ['#746f72', '#4e4b57'], wire: ['#6c737a', '#35394b'],
};

export function jaliscoPalette(theme) {
  return Object.fromEntries(Object.entries(inks).map(([key, colors]) => [key, colors[theme === 'dark' ? 1 : 0]]));
}
