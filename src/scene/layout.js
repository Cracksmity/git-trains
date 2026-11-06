// scene/layout.js: focused layout operations.



export const SCENE_W = 448;

export const GY0 = 88;

// rail row of the first track
export const PITCH = 52;

// distance between tracks
export const BALLAST = 12;

export function sceneHeight(nTracks) {
  return GY0 + BALLAST + PITCH * (nTracks - 1);
}
