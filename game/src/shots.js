// Deterministic screenshot scenes: ?shot=menu|cruise|approach|delivery&seed=1
// Each scene plays forward from a fresh state with a simple autopilot at fixed
// steps, so the frame is real gameplay and the same seed gives the same frame.
// Sets window.__shotReady = true when the frame is ready to capture.

import { islandById, headingVec, clamp, angleDiff, deg2rad, rad2deg, WORLD } from './config.js';

function steerTo(flight, tx, tz, targetAlt, targetSpeed, gearDown, flaps) {
  const dx = tx - flight.x;
  const dz = tz - flight.z;
  const wantHeading = Math.atan2(dx, -dz);
  const err = angleDiff(wantHeading, flight.heading);
  const agl = flight.y - 10; // rough AGL over the islands
  const altErr = targetAlt - agl;
  let pitch = 0;
  if (altErr > 6) pitch = 0.55;
  else if (altErr > 2) pitch = 0.25;
  else if (altErr < -6) pitch = -0.45;
  else if (altErr < -2) pitch = -0.2;
  else pitch = 0.05;
  // The flight model loses ~9 m/s to full flaps and ~2 m/s to the gear, so the
  // throttle must cover that drag or the plane sinks toward stall on final.
  const drag = (flaps ? 9 : 0) + (gearDown ? 2 : 0);
  // No throttle cap on descent: pitch alone sets the descent rate, and the
  // throttle must keep holding the target speed — capping it to 0.3 on final
  // starved the plane to 10 m/s and a -6.3 m/s slam (delivery scored 112).
  const throttle = clamp((targetSpeed + drag) / WORLD.maxSpeed + (targetSpeed - flight.speed) * 0.05, 0, 1);
  return {
    roll: clamp(err * 2.2, -1, 1),
    pitch: clamp(pitch / 0.34, -1, 1),
    rudder: 0,
    throttleAxis: 0,
    throttleSet: throttle,
    flaps,
    gearDown,
    brake: false,
  };
}

export function applyShot(name, game) {
  const { flight, missions } = game;
  const shot = { name, simTime: 0, ready: false, camera: 'chase', phase: 0 };
  window.__shotReady = false;
  window.__shotName = name;

  const palm = islandById('palm');
  const pf = headingVec(palm.runwayHeading);
  // Threshold point (start of the Palm Cay strip) and the final-fix point.
  const threshold = { x: palm.x - pf.x * (palm.runwayLen / 2), z: palm.z - pf.z * (palm.runwayLen / 2) };
  const fix = (dist, alt) => ({
    x: threshold.x - pf.x * dist,
    z: threshold.z - pf.z * dist,
    alt,
  });

  if (name === 'menu') {
    flight.resetToRunway('home');
    flight.throttle = 0.12;
    missions.reset();
    missions.say('', 0);
    game.phase = 'title';
    game.hud.show('title', { best: 0 });
    shot.camera = 'menu';
    shot.autopilot = () => {
      flight.throttle = 0.12;
      return { roll: 0, pitch: 0, rudder: 0, throttleAxis: 0, throttleSet: 0.12, flaps: 0, gearDown: true, brake: true };
    };
    shot.done = () => shot.simTime > 1.5;
  } else if (name === 'cruise') {
    missions.reset();
    game.phase = 'flying';
    game.hud.show('none');
    // Mid-leg: 950 m out from Palm Cay, 130 m up, already fast.
    const start = fix(950, 130);
    const hd = Math.atan2(palm.x - start.x, -(palm.z - start.z));
    flight.placeAirborne(start.x, 140, start.z, (hd * 180) / Math.PI, 42, 0.02);
    flight.throttle = 0.75;
    missions.say('LEG 1 — MEDICAL SUPPLIES TO PALM CAY', 999);
    shot.autopilot = () => steerTo(flight, palm.x, palm.z, 130, 42, true, 0);
    shot.done = () => shot.simTime > 13;
  } else if (name === 'approach') {
    missions.reset();
    game.phase = 'flying';
    game.hud.show('none');
    const start = fix(720, 75);
    const hd = palm.runwayHeading;
    flight.placeAirborne(start.x, palm.h + 75, start.z, hd, 30, -0.06);
    flight.throttle = 0.42;
    flight.gearDown = true;
    flight.flaps = 1;
    missions.say('FINAL APPROACH — PALM CAY · GEAR DOWN · FLAPS', 999);
    shot.autopilot = () => {
      const dist = Math.hypot(threshold.x - flight.x, threshold.z - flight.z);
      if (dist < 200) {
        // Short final: hold the centreline, gentle descent to the threshold.
        return steerTo(flight, threshold.x + pf.x * 60, threshold.z + pf.z * 60, 14, 26, true, 1);
      }
      return steerTo(flight, threshold.x, threshold.z, 45, 28, true, 1);
    };
    shot.done = () => {
      const dist = Math.hypot(threshold.x - flight.x, threshold.z - flight.z);
      return (dist < 230 && flight.y < palm.h + 42) || shot.simTime > 26;
    };
  } else if (name === 'delivery') {
    missions.reset();
    game.phase = 'flying';
    game.hud.show('none');
    const start = fix(380, 34);
    flight.placeAirborne(start.x, palm.h + 34, start.z, palm.runwayHeading, 27, -0.05);
    flight.throttle = 0.3;
    flight.gearDown = true;
    flight.flaps = 1;
    missions.say('SHORT FINAL — PALM CAY', 999);
    shot.autopilot = () => {
      const dist = Math.hypot(threshold.x - flight.x, threshold.z - flight.z);
      const agl = flight.y - palm.h;
      if (agl < 6 && flight.onGround === false) {
        // Flare: nearly level, power held at ~0.55 so the speed stays near
        // 25 m/s — but KEEP steering: an earlier version forced roll 0 here
        // and the crosswind drifted the plane ~8 m off the centreline in the
        // last seconds, sometimes off the strip entirely (flaky landing).
        const aimX = threshold.x + pf.x * 80;
        const aimZ = threshold.z + pf.z * 80;
        const wantHeading = Math.atan2(aimX - flight.x, -(aimZ - flight.z));
        const err = angleDiff(wantHeading, flight.heading);
        return { roll: clamp(err * 2.2, -1, 1), pitch: -0.15, rudder: 0, throttleAxis: 0, throttleSet: 0.55, flaps: 1, gearDown: true, brake: false };
      }
      // Glide slope: target altitude shrinks with distance to the aim point
      // (80 m past the threshold) and reaches ZERO there, so the plane keeps
      // descending onto the strip instead of holding altitude above it.
      const aimDist = Math.hypot(threshold.x + pf.x * 80 - flight.x, threshold.z + pf.z * 80 - flight.z);
      const slopeAlt = clamp(aimDist * 0.055, 0, 40);
      return steerTo(flight, threshold.x + pf.x * 80, threshold.z + pf.z * 80, slopeAlt, 25, true, 1);
    };
    shot.done = () => {
      if (game.phase === 'result' && shot.simTime - (shot.resultAt || 0) > 1.0 && shot.resultAt) return true;
      if (game.phase === 'result' && !shot.resultAt) shot.resultAt = shot.simTime;
      return shot.simTime > 26;
    };
  } else {
    // Unknown shot: fall back to the menu scene.
    return applyShot('menu', game);
  }

  shot.tick = (dt) => {
    shot.simTime += dt;
    if (!shot.ready && shot.done()) {
      shot.ready = true;
      window.__shotReady = true;
    }
  };
  game.shot = shot;
  return shot;
}
