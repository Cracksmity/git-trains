// The same inks are resolved by the README SVG and the raster exporter.
// Inks that only matter at night (dusk, starlight) repeat the daytime haze, so
// the light theme keeps a plain sky while the dark one shares the city's night.
const inks = {
  sky0: ['#83b4c4', '#101b36'], sky1: ['#a4cbd2', '#213252'],
  sky2: ['#c6d9d5', '#424563'], sky3: ['#efdac0', '#685066'],
  dusk: ['#e8d7b9', '#1f2d4d'], starlight: ['#e8d7b9', '#a9b4d4'],
  haze: ['#e8d7b9', '#3a3f5e'], afterglow: ['#edcda2', '#634f66'], cloud: ['#e7ece1', '#32405c'],
  ridge: ['#9caaa6', '#424761'], ridgeShade: ['#7d9293', '#303d56'],
  rimLit: ['#9caaa6', '#7f88a8'], rimShade: ['#7d9293', '#4b5573'],
  tower: ['#8b9ca1', '#404660'], towerEdge: ['#abb8b6', '#5a5a70'],
  stone: ['#c4a482', '#a38172'], stoneLit: ['#e6caa0', '#d1a779'],
  stoneShade: ['#977e70', '#76636a'], recess: ['#715f60', '#413f51'],
  tile: ['#ac644d', '#85505a'], tileLit: ['#db9266', '#b87865'],
  ochre: ['#c49750', '#ac794c'], ochreLit: ['#e4bf72', '#d9ad62'],
  foliage: ['#57755c', '#364851'], foliageLit: ['#7a9069', '#4c5a5c'],
  field: ['#b3916a', '#645452'], furrow: ['#96785c', '#503f46'],
  earth: ['#b86a48', '#673b3b'], earthLit: ['#d08b5f', '#84504a'],
  grassland: ['#9caa78', '#51594e'], pasture: ['#819568', '#394b45'],
  // At night the agave stays dimmer than by day and fades with distance.
  agave: ['#427d7d', '#3b6c71'], agaveLit: ['#74a7a0', '#5f938f'], agaveFar: ['#427d7d', '#33565f'],
  agaveShade: ['#325e62', '#26474f'], glassWarm: ['#786252', '#f0c780'],
  mast: ['#746f72', '#4e4b57'], wire: ['#6c737a', '#35394b'],
  // Landmarks: the Cathedral's blue tile ribs, the Cabañas dome, the stadium's
  // concrete, white roof and trusses, Minerva's bronze (floodlit at night) and her fountain.
  tileBlue: ['#3d5a8a', '#3a5288'], slate: ['#7f8a8c', '#5d6075'], slateLit: ['#a6b0ae', '#7f8298'],
  concrete: ['#a7a69f', '#6d6b77'], concreteLit: ['#cdccc3', '#9592a0'], roofWhite: ['#f1f2ee', '#c3c8d6'],
  steel: ['#7d898c', '#8a93ab'],
  // West-side towers: lit windows only at night, the hotel's sign, a red crown, a blue disc.
  towerLit: ['#8b9ca1', '#d9b86a'], signRed: ['#c8423a', '#ff6b4f'],
  capRed: ['#d0322e', '#c2413f'], logoBlue: ['#2f6fb5', '#4f8fe0'],
  bronze: ['#4f6457', '#4b5550'], bronzeLit: ['#7b9282', '#b89a64'],
  water: ['#8ec3d1', '#3e5f80'], waterLit: ['#d9f0f3', '#8db6d6'],
};

export function jaliscoPalette(theme) {
  return Object.fromEntries(Object.entries(inks).map(([key, colors]) => [key, colors[theme === 'dark' ? 1 : 0]]));
}
