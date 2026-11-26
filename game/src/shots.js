// Sunset Cargo Run — shots: deterministic staged scenes for screenshots.
// ?shot=menu|cruise|approach|delivery&seed=1 — each scene starts from a fresh
// state and, where it moves, advances with the same fixed-step autopilot the
// game itself uses, so the same seed always renders the same frame.
import { ISLANDS, clamp, angleDiff } from './config.js';
import { yawToTarget } from './flight.js';
import { stripCenter } from './world.js';

// Simple autopilot: bank toward the target bearing, hold a target altitude,
// hold a target throttle. Returns a control object flight.js understands.
export function autopilotInput(state, target, targetAlt, targetThrottle) {
  const desiredYaw = yawToTarget(state, target.x, target.z);
  const yawErr = angleDiff(state.yaw, desiredYaw);
  const roll = clamp(-yawErr * 1.6, -1, 1);
  const desiredPitch = clamp((targetAlt - state.pos.y) * 0.008, -0.15, 0.22);
  const pitch = clamp((desiredPitch - state.pitch) * 4, -1, 1);
  const throttle = clamp((targetThrottle - state.throttle) * 3, -1, 1);
  return { throttle, roll, pitch, yaw: 0, brake: false };
}

// Prepare one shot scene. `game` is the live game object from main.js.
// Returns { seconds, autopilot } — how long to simulate and with what mode.
export function prepareShot(shot, game) {
  const s = game.state;
  const home = ISLANDS[0];

  if (shot === 'menu') {
    // Parked on the home runway at sunset, title screen up. The plane sits
    // right of the runway centreline, nose turned, so the left-docked title
    // card never covers it.
    s.pos.x = 45;
    s.pos.y = home.H + 1.4;
    s.pos.z = 150;
    s.yaw = Math.PI - 0.45;
    s.pitch = 0;
    s.roll = 0;
    s.speed = 0;
    s.throttle = 0;
    s.airborne = false;
    s.gearDown = true;
    game.setMode('title');
    document.body.classList.add('shot-menu');
    return { seconds: 0, autopilot: null, camera: 'menu' };
  }

  if (shot === 'cruise') {
    // Mid-leg 1, climbing out over the sea toward Palm Cay, HUD live.
    const dest = stripCenter(1);
    s.pos.x = 0;
    s.pos.y = 190;
    s.pos.z = -200;
    s.yaw = yawToTarget(s, dest.x, dest.z);
    s.pitch = 0.05;
    s.roll = 0;
    s.speed = 42;
    s.throttle = 0.7;
    s.airborne = true;
    s.gearDown = false;
    s.fuel = 82;
    game.setMode('flying');
    return { seconds: 14, autopilot: 'cruise', camera: 'chase' };
  }

  if (shot === 'approach') {
    // Final approach to Palm Cay: gear down, flaps down, strip ahead.
    const dest = stripCenter(1);
    s.pos.x = dest.x + 600; // east of the strip, flying west onto it
    s.pos.y = dest.y + 75;
    s.pos.z = dest.z;
    s.yaw = yawToTarget(s, dest.x, dest.z);
    s.pitch = -0.06;
    s.roll = 0;
    s.speed = 30;
    s.throttle = 0.45;
    s.airborne = true;
    s.gearDown = true;
    s.flaps = true;
    s.fuel = 61;
    game.setMode('flying');
    return { seconds: 8, autopilot: 'approach', camera: 'chase' };
  }

  if (shot === 'delivery') {
    // Just touched down on Palm Cay: cargo delivered, leg result on screen.
    const dest = stripCenter(1);
    s.pos.x = dest.x - 40;
    s.pos.y = dest.y + 1.4;
    s.pos.z = dest.z;
    s.yaw = -Math.PI / 2; // aligned with the east-west strip
    s.pitch = 0;
    s.roll = 0;
    s.speed = 6;
    s.throttle = 0;
    s.airborne = false;
    s.gearDown = true;
    s.flaps = true;
    s.fuel = 100;
    game.landNow(1, { island: 1, centerOffset: 3.2, speed: 26, vy: -2.0 });
    return { seconds: 0, autopilot: null, camera: 'chase' };
  }

  return { seconds: 0, autopilot: null, camera: 'chase' };
}

// Autopilot target for a given mode, from the live mission.
export function autopilotTarget(game, kind) {
  const dest = stripCenter(1); // leg 1 destination in both moving shots
  if (kind === 'cruise') return { target: dest, alt: dest.y + 170, throttle: 0.7 };
  // Approach: aim at the eastern threshold, a little above the strip.
  return { target: { x: dest.x + 130, z: dest.z }, alt: dest.y + 30, throttle: 0.42 };
}
