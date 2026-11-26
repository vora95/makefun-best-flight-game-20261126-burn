// Sunset Cargo Run — config: constants, islands, legs, tuning.
// All numbers in metres / seconds / radians unless noted. Seed fixed = 1.
export const CONFIG = {
  seed: 1,
  maxSpeed: 55, // m/s (~107 kt)
  stallSpeed: 17,
  takeoffSpeed: 22,
  fuelCapacity: 100,
  fuelBurn: 0.55, // per second at full throttle
  maxDamage: 3,
  gearHeight: 1.4,
  missionTimeLimit: 900, // seconds, soft timer shown in HUD
};

// Islands: low-poly bumps with a flat top where the airstrip sits.
// heading: strip direction in degrees (0 = strip runs north-south, 90 = east-west).
export const ISLANDS = [
  { name: 'Sunset Field', short: 'HOME', x: 0, z: 0, R: 420, H: 26, heading: 0, stripLen: 300, stripWid: 30 },
  { name: 'Palm Cay', short: 'PALM', x: -950, z: -750, R: 380, H: 22, heading: 90, stripLen: 260, stripWid: 26 },
  { name: 'Turtle Rock', short: 'TURTLE', x: 850, z: -1150, R: 360, H: 30, heading: 0, stripLen: 260, stripWid: 26 },
  { name: 'Coral Bay', short: 'CORAL', x: 150, z: -1950, R: 400, H: 24, heading: 90, stripLen: 280, stripWid: 28 },
];

// Cargo legs, flown in order. wind is a drift vector (m/s) applied in the air.
export const LEGS = [
  { from: 0, to: 1, cargo: 'Ikan segar · 420 kg', wind: { x: 2.5, z: 0.5, label: '270° / 6 kt' } },
  { from: 1, to: 2, cargo: 'Surat + obat · 180 kg', wind: { x: -3.5, z: 1.0, label: '090° / 9 kt' } },
  { from: 2, to: 3, cargo: 'Suku cadang · 260 kg', wind: { x: 1.5, z: -4.0, label: '180° / 12 kt' } },
];

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;
// Shortest signed angle from a to b, in (-PI, PI].
export const angleDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};
// Compass heading (deg) for a yaw whose forward is (sin yaw, 0, cos yaw);
// yaw = PI faces north (-Z) which is heading 000.
export const yawToHeading = (yaw) => {
  const h = (180 - rad2deg(yaw)) % 360;
  return (h + 360) % 360;
};
