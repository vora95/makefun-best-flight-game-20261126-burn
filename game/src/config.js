// Sunset Cargo Run — world constants, islands, legs and the seeded RNG.
// One job per file: this file only holds data and deterministic helpers.

export const SEED = 1;

/** Deterministic RNG (mulberry32): same seed, same world, every run. */
export function mulberry32(a) {
  let t = a >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Smallest signed angle difference, radians, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;
/** Heading in degrees, 0 = north (-Z), 90 = east (+X). Forward vector for a heading. */
export function headingVec(hDeg) {
  const h = deg2rad(hDeg);
  return { x: Math.sin(h), z: -Math.cos(h) };
}

export const WORLD = {
  seaLevel: 0,
  fogColor: 0x2a1540,
  skyTop: 0x3b1d5e,
  skyMid: 0xff7e3d,
  skyLow: 0xffb347,
  sunColor: 0xffd27a,
  seaColor: 0x1d4e6b,
  seaColorDeep: 0x123a52,
  maxSpeed: 58, // m/s at full throttle, clean
  stallSpeed: 17, // m/s
  rotateSpeed: 24, // m/s, liftoff
  fuelStart: 100,
  fuelBurnAir: 0.22, // per second, base
  fuelBurnThrottle: 0.28, // per second at full throttle
  fuelBurnGround: 0.05,
  maxDamage: 3,
};

/** Islands. Runway heading is the landing direction in degrees. */
export const ISLANDS = [
  { id: 'home', name: 'Sunset Field', x: 0, z: 0, r: 280, h: 10, runwayHeading: 90, runwayLen: 240, runwayWid: 20, palms: 26, color: 0x4d8a3f },
  { id: 'palm', name: 'Palm Cay', x: 1500, z: -850, r: 210, h: 9, runwayHeading: 140, runwayLen: 190, runwayWid: 17, palms: 34, color: 0x3f8a4d },
  { id: 'turtle', name: 'Turtle Rock', x: -1250, z: -1500, r: 230, h: 13, runwayHeading: 35, runwayLen: 200, runwayWid: 17, palms: 18, color: 0x5a7a35 },
  { id: 'coral', name: 'Coral Bay', x: -1750, z: 1050, r: 220, h: 9, runwayHeading: 210, runwayLen: 190, runwayWid: 17, palms: 30, color: 0x3f8a6b },
];

export function islandById(id) {
  return ISLANDS.find((i) => i.id === id);
}

/** Cargo legs, in order. windKt is the crosswind strength, windFrom the direction it blows from. */
export const LEGS = [
  { to: 'palm', cargo: 'Medical supplies', weight: '420 kg', windKt: 7, windFrom: 200 },
  { to: 'turtle', cargo: 'Spare parts', weight: '380 kg', windKt: -9, windFrom: 130 },
  { to: 'coral', cargo: 'Fresh produce', weight: '450 kg', windKt: 6, windFrom: 260 },
];

/** Ground height (metres) at world x,z. Sea is 0; islands rise to a flat plateau. */
export function groundHeight(x, z) {
  let best = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.hypot(dx, dz);
    if (d >= isl.r) continue;
    // Flat plateau out to 62% radius, then a beach slope down to the sea.
    const t = clamp((d - isl.r * 0.62) / (isl.r * 0.38), 0, 1);
    const h = isl.h * (1 - t * t * (3 - 2 * t));
    if (h > best) best = h;
    // Runway strip is dead flat at plateau height.
    if (onRunway(x, z, isl)) best = isl.h;
  }
  return best;
}

/** True when x,z lies on the island's runway strip (a little margin included). */
export function onRunway(x, z, isl) {
  const f = headingVec(isl.runwayHeading);
  const rx = x - isl.x;
  const rz = z - isl.z;
  const along = rx * f.x + rz * f.z;
  const across = rx * -f.z + rz * f.x;
  return Math.abs(along) <= isl.runwayLen / 2 + 6 && Math.abs(across) <= isl.runwayWid / 2 + 4;
}

/** Signed lateral offset (m) from the runway centreline, + to the right of landing direction. */
export function runwayOffset(x, z, isl) {
  const f = headingVec(isl.runwayHeading);
  const rx = x - isl.x;
  const rz = z - isl.z;
  return rx * -f.z + rz * f.x;
}

/** Distance (m) along the runway from its threshold, 0 at threshold, len at the far end. */
export function runwayAlong(x, z, isl) {
  const f = headingVec(isl.runwayHeading);
  const rx = x - isl.x;
  const rz = z - isl.z;
  return (rx * f.x + rz * f.z) + isl.runwayLen / 2;
}

/** Heading difference (deg) between the plane and the runway direction, 0 = perfectly aligned. */
export function runwayAlignDeg(headingDeg, isl) {
  let d = ((headingDeg - isl.runwayHeading) % 360 + 540) % 360 - 180;
  return Math.abs(d);
}
