// trains/geometry.js: focused geometry operations.



export const TOP = 9;

// free rows above the roof (pantograph and sparks)
export const BODY_ROWS = 20;

// roof .. skirt
export const TRAIN_H = TOP + 25;

// + wheel area
export const MID_W = 64;

export const LED_W = 39;

export const DOOR_W = 11;

export const MAX_CARS = 6;

// Locomotive (optional, for steam trains): a complete drawing at the front
// instead of the cab, with its driving wheels joined by a connecting rod. The cars
// follow behind and the last ends in a flat tail with a red light.
export const LOCO_ROWS = 30;

// 5 above the car roofs + 20 for the body + 5 for wheels
export const LOCO_UP = 5;

// drawing rows above the car roofs
export const LOCO_MIN_W = 16;

export const LOCO_MAX_W = 60;

export const LOCO_WHEELS = [7, 9, 11];

// driving wheel diameters
export const LOCO_SMALL = 5;

// small wheel diameter (leading or trailing)
export const COUPLER = 2;

// coupler between the first car and the locomotive

// Side of an intermediate car: windows ('w', width) and doors ('d'), from back
// to front. With 3 doors per side (metro trains), the doors are narrower.
const LAYOUTS = {
  2: { doorW: DOOR_W, items: [['w', 7], ['d'], ['w', 14], ['d'], ['w', 7]] },
  3: { doorW: 9, items: [['w', 4], ['d'], ['w', 6], ['d'], ['w', 6], ['d'], ['w', 4]] },
};

export const layoutOf = (model) => LAYOUTS[model.doors ?? 2];

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function cabWidth(model) {
  return 3 + LED_W + 2 + layoutOf(model).doorW + 2 + (model.cabWindows ? model.cabWindows + 2 : 0) + model.nose.w;
}

// Intermediate cars + lead car + tail nose (cab at both ends).
// With a locomotive: the cars, coupler, and locomotive.
// `extra`: a special car (see cars.js) adds one more intermediate car.
export function trainWidth(model, cars, extra = false) {
  const n = clamp(cars, 1, MAX_CARS);
  const special = extra ? MID_W : 0;
  if (model.loco) return n * MID_W + special + COUPLER + model.loco.w;
  return (n - 1) * MID_W + special + cabWidth(model) + model.nose.w;
}
