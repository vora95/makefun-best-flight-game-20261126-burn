// Cargo missions: the three legs, landing scoring, fuel, wind and damage.
// Scoring per leg, max 800: centreline 300 + touchdown speed 250 + softness 250.

import { LEGS, WORLD, islandById, runwayOffset, runwayAlong, runwayAlignDeg, onRunway, clamp } from './config.js';

export class Missions {
  constructor() {
    this.reset();
  }

  reset() {
    this.legIndex = 0; // 0..2, the leg being flown
    this.score = 0;
    this.fuel = WORLD.fuelStart;
    this.damage = 0;
    this.legScores = []; // { leg, centre, speed, soft, total, note }
    this.elapsed = 0;
    this.message = '';
    this.messageUntil = 0;
    this.lastLanding = null;
  }

  get leg() {
    return LEGS[this.legIndex];
  }

  get dest() {
    return this.leg ? islandById(this.leg.to) : null;
  }

  get fromIsland() {
    if (this.legIndex === 0) return islandById('home');
    return islandById(LEGS[this.legIndex - 1].to);
  }

  get done() {
    return this.legIndex >= LEGS.length;
  }

  /** Wind drift vector (m/s) for the current leg, from its crosswind. */
  windVector() {
    const leg = this.leg;
    if (!leg) return { x: 0, z: 0 };
    // windFrom is where it blows FROM; drift pushes the plane toward windFrom+180.
    const dir = ((leg.windFrom + 180) * Math.PI) / 180;
    const kt = leg.windKt;
    const ms = (kt * 0.514444) / 2.2; // crosswind felt in the sim, softened
    return { x: Math.sin(dir) * ms, z: -Math.cos(dir) * ms };
  }

  windLabel() {
    const leg = this.leg;
    if (!leg) return '—';
    const side = leg.windKt >= 0 ? 'R' : 'L';
    return `${Math.abs(leg.windKt)} kt ${side} · from ${leg.windFrom}°`;
  }

  say(text, seconds = 4) {
    this.message = text;
    this.messageUntil = this.elapsed + seconds;
  }

  /** Fuel burn for one step; returns 'empty' the moment fuel runs out. */
  burnFuel(dt, flight) {
    if (this.done) return '';
    const rate = flight.onGround
      ? WORLD.fuelBurnGround
      : WORLD.fuelBurnAir + WORLD.fuelBurnThrottle * flight.throttle;
    this.fuel = Math.max(0, this.fuel - rate * dt);
    if (this.fuel <= 0 && !flight.engineOut) {
      flight.engineOut = true;
      this.say('⚠ FUEL EMPTY — ENGINE OUT! GLIDE AND LAND!', 6);
      return 'empty';
    }
    return '';
  }

  /**
   * Score a touchdown. flight holds groundSpeedAtTouch / vspeedAtTouch.
   * Returns { kind: 'landed'|'hard'|'wrong', score, detail }.
   */
  scoreLanding(flight) {
    const dest = this.dest;
    const off = Math.abs(runwayOffset(flight.x, flight.z, dest));
    const along = runwayAlong(flight.x, flight.z, dest);
    const align = runwayAlignDeg(flight.headingDeg, dest);
    const onStrip = onRunway(flight.x, flight.z, dest) && along >= 0 && along <= dest.runwayLen + 12;
    const spd = flight.groundSpeedAtTouch;
    const vs = flight.vspeedAtTouch;

    if (!onStrip) {
      return {
        kind: 'wrong',
        total: 0,
        detail: `OFF-RUNWAY — landed ${Math.round(off)} m off the strip at ${dest.name}. No cargo score.`,
      };
    }
    // Centreline: full marks inside 3 m, none past 12 m.
    const centre = Math.round(300 * clamp(1 - Math.max(0, off - 3) / 9, 0, 1));
    // Touchdown speed: sweet spot 21–30 m/s.
    const speedScore = spd >= 21 && spd <= 30 ? 250 : Math.round(250 * clamp(1 - Math.abs(spd - 25.5) / 14, 0, 1));
    // Softness: gentle is better than -1.5 m/s; worse than -6 m/s is a hard landing.
    const soft = Math.round(250 * clamp(1 - Math.max(0, -vs - 1.5) / 4.5, 0, 1));
    const alignPenalty = align > 12 ? Math.round((align - 12) * 4) : 0;
    const total = Math.max(0, centre + speedScore + soft - alignPenalty);
    return {
      kind: 'landed',
      total,
      detail: `Centreline ${centre}/300 · Touchdown ${speedScore}/250 (${spd.toFixed(0)} m/s) · Softness ${soft}/250 (${vs.toFixed(1)} m/s)${alignPenalty ? ` · Align −${alignPenalty}` : ''}`,
    };
  }

  /** Called when a touchdown is confirmed on the destination strip. */
  completeLeg(result, flight) {
    const leg = this.leg;
    const rec = {
      leg: this.legIndex + 1,
      dest: leg ? islandById(leg.to).name : '',
      cargo: leg ? leg.cargo : '',
      centre: 0,
      speed: 0,
      soft: 0,
      total: result.total,
      detail: result.detail,
    };
    // Re-split the detail numbers for the result screen.
    const m = /Centreline (\d+)\/300 · Touchdown (\d+)\/250.*Softness (\d+)\/250/.exec(result.detail);
    if (m) {
      rec.centre = Number(m[1]);
      rec.speed = Number(m[2]);
      rec.soft = Number(m[3]);
    }
    this.legScores.push(rec);
    this.score += result.total;
    this.legIndex++;
    this.fuel = WORLD.fuelStart; // refuel at every delivery
    this.lastLanding = rec;
    return rec;
  }

  /** Completion time bonus: up to 600, shrinking with elapsed time. */
  completionBonus() {
    return Math.max(0, Math.round(600 - this.elapsed * 0.5));
  }
}
