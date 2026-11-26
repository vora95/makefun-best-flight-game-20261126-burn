// Sunset Cargo Run — flight model: arcade lift/drag/throttle/pitch/roll.
// State is plain data so the autopilot (shots.js) and the playtest can drive
// the exact same step function the keyboard loop uses.
import { CONFIG, ISLANDS, LEGS, clamp, lerp } from './config.js';
import { heightAt, stripAt } from './world.js';

export function createFlightState() {
  const home = ISLANDS[0];
  return {
    pos: { x: 0, y: home.H + CONFIG.gearHeight, z: 140 },
    yaw: Math.PI, // facing north (-Z), down the home runway
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    airborne: false,
    gearDown: true,
    flaps: false,
    fuel: CONFIG.fuelCapacity,
    damage: 0,
    vy: 0,
    time: 0,
    fuelEmptyAnnounced: false,
  };
}

// One fixed step (dt seconds). `ctl` = {throttle, roll, pitch, yaw, brake}
// each -1..1. `wind` = {x, z} drift in m/s. `hooks` = {onLanding, onCrash,
// onFuelEmpty}. Returns nothing; mutates state.
export function updateFlight(s, ctl, dt, wind, hooks) {
  s.time += dt;

  // --- throttle / speed ---
  s.throttle = clamp(s.throttle + ctl.throttle * dt * 0.5, 0, 1);
  if (s.fuel <= 0) s.throttle = 0;
  const targetSpeed = s.throttle * CONFIG.maxSpeed * (s.flaps ? 0.85 : 1);
  const accel = s.airborne ? 6 : 9;
  s.speed += clamp(targetSpeed - s.speed, -accel * dt * 1.6, accel * dt);
  if (ctl.brake && !s.airborne) s.speed = Math.max(0, s.speed - 22 * dt);

  // --- attitude ---
  const rollTarget = ctl.roll * 0.6;
  s.roll += (rollTarget - s.roll) * Math.min(1, dt * 3);
  const pitchTarget = s.airborne ? clamp(ctl.pitch * 0.42, -0.5, 0.5) : clamp(ctl.pitch * 0.12, 0, 0.12);
  s.pitch += (pitchTarget - s.pitch) * Math.min(1, dt * 2.5);
  const speedFactor = clamp(s.speed / 30, 0, 1);
  s.yaw -= s.roll * dt * 0.75 * (0.25 + 0.75 * speedFactor);
  s.yaw += ctl.yaw * dt * 0.3 * speedFactor;

  // --- translation ---
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  const hSpeed = s.speed * Math.cos(s.pitch);
  s.pos.x += (fx * hSpeed + wind.x) * dt;
  s.pos.z += (fz * hSpeed + wind.z) * dt;

  // --- fuel ---
  if (s.throttle > 0) {
    s.fuel -= s.throttle * CONFIG.fuelBurn * dt * (s.airborne ? 1 : 0.6);
    if (s.fuel <= 0) {
      s.fuel = 0;
      if (!s.fuelEmptyAnnounced) {
        s.fuelEmptyAnnounced = true;
        hooks.onFuelEmpty && hooks.onFuelEmpty();
      }
    }
  }

  const groundY = heightAt(s.pos.x, s.pos.z);

  if (!s.airborne) {
    s.pos.y = groundY + CONFIG.gearHeight;
    s.vy = 0;
    if (s.speed > CONFIG.takeoffSpeed && s.pitch > 0.06) {
      s.airborne = true;
      s.vy = 2;
    }
    return;
  }

  // --- airborne vertical ---
  let vy = Math.sin(s.pitch) * s.speed;
  if (s.speed < CONFIG.stallSpeed) {
    const sink = (CONFIG.stallSpeed - s.speed) * 0.9 * (s.flaps ? 0.55 : 1);
    vy -= sink;
  }
  s.vy = vy;
  s.pos.y += vy * dt;

  // --- ground / water contact ---
  if (s.pos.y <= groundY + CONFIG.gearHeight) {
    s.pos.y = groundY + CONFIG.gearHeight;
    const strip = stripAt(s.pos.x, s.pos.z);
    const gentle = s.vy > -7 && Math.abs(s.roll) < 0.3;
    const speedOk = s.speed >= 12 && s.speed <= 48;
    if (strip && s.gearDown && gentle && speedOk) {
      s.airborne = false;
      const tdSpeed = s.speed; // touchdown speed before rollout braking
      s.speed *= 0.4;
      s.vy = 0;
      hooks.onLanding &&
        hooks.onLanding({ island: strip.island, centerOffset: Math.abs(strip.across), speed: tdSpeed, vy });
      return;
    }
    // Ditching in the sea is always a crash; a rough field landing costs damage.
    const inSea = groundY <= 0.5;
    s.airborne = false;
    s.speed = 0;
    s.vy = 0;
    hooks.onCrash &&
      hooks.onCrash({
        reason: inSea ? 'DITCHED IN THE SEA' : !s.gearDown ? 'LANDED GEAR-UP' : s.vy <= -7 ? 'HARD LANDING' : 'ROUGH FIELD LANDING',
        inSea,
      });
  }
}

// Heading error helper for the autopilot: desired yaw to fly at (tx, tz).
export function yawToTarget(s, tx, tz) {
  return Math.atan2(tx - s.pos.x, tz - s.pos.z);
}

export function currentWind(legIndex) {
  return LEGS[legIndex] ? LEGS[legIndex].wind : { x: 0, z: 0, label: 'calm' };
}

export { lerp };
