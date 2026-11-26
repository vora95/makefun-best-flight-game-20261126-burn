// Arcade flight model: throttle/speed, pitch, banked turns, ground handling,
// stall, wind drift and landing contact. No Three.js here — pure numbers.

import { WORLD, clamp, lerp, angleDiff, deg2rad, rad2deg, headingVec, groundHeight, onRunway, islandById } from './config.js';

export class Flight {
  constructor() {
    this.resetToRunway('home');
  }

  resetToRunway(islandId) {
    const isl = islandById(islandId);
    const f = headingVec(isl.runwayHeading);
    // Start at the runway threshold, facing down the strip.
    this.x = isl.x - f.x * (isl.runwayLen / 2 - 14);
    this.z = isl.z - f.z * (isl.runwayLen / 2 - 14);
    this.y = isl.h + 1.4;
    this.heading = deg2rad(isl.runwayHeading);
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0; // m/s
    this.vspeed = 0; // m/s, + up
    this.throttle = 0;
    this.onGround = true;
    this.gearDown = true;
    this.flaps = 0; // 0 = up, 1 = full
    this.brake = false;
    this.engineOut = false;
    this.groundSpeedAtTouch = 0;
    this.vspeedAtTouch = 0;
    this.touchedDown = false; // set true on the frame contact happens
    this.crashed = false;
    this.crashReason = '';
  }

  get headingDeg() {
    return ((rad2deg(this.heading) % 360) + 360) % 360;
  }

  get altitudeFt() {
    return Math.max(0, (this.y - groundHeight(this.x, this.z)) * 3.28084);
  }

  get speedKt() {
    return this.speed * 1.94384;
  }

  /** Place the plane airborne at a fixed pose (used by deterministic shots). */
  placeAirborne(x, y, z, headingDeg, speed, pitch = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.heading = deg2rad(headingDeg);
    this.pitch = pitch;
    this.roll = 0;
    this.speed = speed;
    this.vspeed = Math.sin(pitch) * speed;
    this.throttle = 0.7;
    this.onGround = false;
    this.gearDown = true;
    this.flaps = 0;
    this.engineOut = false;
    this.touchedDown = false;
    this.crashed = false;
    this.crashReason = '';
  }

  /**
   * One step. ctrl: { roll, pitch, rudder, throttleAxis, throttleSet|null, flaps, gearDown, brake }
   * wind: { x, z } drift in m/s. Returns an event string or ''.
   */
  update(dt, ctrl, wind) {
    this.touchedDown = false;
    if (this.crashed) return '';

    // --- throttle ---
    if (ctrl.throttleSet !== null && ctrl.throttleSet !== undefined) {
      this.throttle = clamp(ctrl.throttleSet, 0, 1);
    } else if (ctrl.throttleAxis) {
      this.throttle = clamp(this.throttle + ctrl.throttleAxis * dt * 0.45, 0, 1);
    }
    if (this.engineOut) this.throttle = 0;
    if (ctrl.flaps !== undefined) this.flaps = ctrl.flaps;
    if (ctrl.gearDown !== undefined) this.gearDown = ctrl.gearDown;
    this.brake = !!ctrl.brake;

    // --- speed toward target ---
    let target = this.throttle * WORLD.maxSpeed;
    if (this.flaps > 0) target -= 9 * this.flaps;
    if (!this.gearDown) target += 2;
    else target -= 2;
    if (this.pitch > 0) target -= this.pitch * 22; // climbing costs speed
    if (this.pitch < 0) target -= this.pitch * 10; // descending gains a little
    target = Math.max(0, target);
    const rate = target > this.speed ? 5.5 : 8.5;
    this.speed += clamp(target - this.speed, -rate * dt, rate * dt);
    if (this.onGround && this.brake) this.speed = Math.max(0, this.speed - 26 * dt);
    if (this.onGround && this.throttle < 0.05) this.speed = Math.max(0, this.speed - 4 * dt);

    // --- attitude eases toward stick ---
    const rollTarget = clamp(ctrl.roll || 0, -1, 1) * 0.62;
    const pitchTarget = clamp(ctrl.pitch || 0, -1, 1) * 0.34;
    this.roll += clamp(rollTarget - this.roll, -2.2 * dt, 2.2 * dt);
    const pitchRate = this.onGround ? 1.6 : 1.1;
    this.pitch += clamp(pitchTarget - this.pitch, -pitchRate * dt, pitchRate * dt);
    if (this.onGround) this.pitch = clamp(this.pitch, -0.02, 0.16);

    // --- heading: banked turn + a touch of rudder ---
    const turnRate = this.roll * 0.55 * clamp(this.speed / 40, 0.15, 1) + (ctrl.rudder || 0) * 0.12 * clamp(this.speed / 40, 0, 1);
    this.heading += turnRate * dt;

    // --- vertical ---
    // BUG (found by playtest): on the liftoff frame the plane's y is still
    // exactly ground+gear height, so the ground-contact check below fired in
    // the SAME update and slammed it back down with pitch reset to 0 — the
    // plane could roll forever at 40+ m/s and never leave the ground. The
    // tookOff flag skips the contact check on the liftoff frame itself; from
    // the next frame the plane has actually climbed.
    let tookOff = false;
    if (this.onGround) {
      this.vspeed = 0;
      if (this.speed >= WORLD.rotateSpeed && this.pitch > 0.05) {
        this.onGround = false;
        this.vspeed = Math.sin(this.pitch) * this.speed;
        tookOff = true;
      }
    } else {
      let vs = Math.sin(this.pitch) * this.speed * 0.92;
      if (this.speed < WORLD.stallSpeed) vs -= (WORLD.stallSpeed - this.speed) * 0.9; // stall sink
      if (this.flaps > 0) vs -= 1.2 * this.flaps; // flaps steepen the descent a touch
      this.vspeed = lerp(this.vspeed, vs, clamp(dt * 3, 0, 1));
      this.y += this.vspeed * dt;
    }

    // --- horizontal motion + wind drift ---
    const f = { x: Math.sin(this.heading), z: -Math.cos(this.heading) };
    const drift = this.onGround ? 0.25 : 1;
    this.x += (f.x * this.speed + wind.x * drift) * dt;
    this.z += (f.z * this.speed + wind.z * drift) * dt;

    // --- ground contact ---
    const g = groundHeight(this.x, this.z);
    const gearH = 1.4;
    if (!this.onGround && !tookOff && this.y <= g + gearH) {
      this.y = g + gearH;
      this.groundSpeedAtTouch = this.speed;
      this.vspeedAtTouch = this.vspeed;
      this.touchedDown = true;
      const hard = this.vspeed < -6 || this.speed > 42;
      const gearUp = !this.gearDown;
      const inSea = g <= 0.01;
      if (inSea) {
        this.crashed = true;
        this.crashReason = 'DITCHED IN THE SEA';
        return 'crash';
      }
      if (this.vspeed < -11 || (gearUp && this.vspeed < -3)) {
        this.crashed = true;
        this.crashReason = gearUp ? 'BELLY LANDING — GEAR UP' : 'IMPACT — DESCENT TOO FAST';
        return 'crash';
      }
      this.onGround = true;
      this.vspeed = 0;
      this.pitch = 0;
      this.roll = 0;
      if (hard || gearUp) return 'hard';
      return 'landed';
    }
    if (this.onGround) {
      this.y = g + gearH;
      // Rolling off the island edge into the sea at speed is a crash; slow taxi off a beach is not.
      if (g <= 0.01 && this.speed > 8) {
        this.crashed = true;
        this.crashReason = 'ROLLED INTO THE SEA';
        return 'crash';
      }
    }
    return '';
  }

  /** Distance (m) to an island centre, horizontal. */
  distanceTo(isl) {
    return Math.hypot(this.x - isl.x, this.z - isl.z);
  }

  /** Bearing (deg) from the plane to an island centre. */
  bearingTo(isl) {
    const dx = isl.x - this.x;
    const dz = isl.z - this.z;
    return ((rad2deg(Math.atan2(dx, -dz)) % 360) + 360) % 360;
  }
}
