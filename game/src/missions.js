// Sunset Cargo Run — missions: cargo legs, landing scoring, fuel, wind.
// Pure logic: no DOM, no Three.js, so shots and playtests can drive it.
import { ISLANDS, LEGS, clamp } from './config.js';

export function createMission() {
  return {
    legIndex: 0, // 0..2, one per delivery
    score: 0,
    landings: 0,
    deliveries: [], // {leg, island, points, centerOffset, speed, vy}
    done: false,
    timeBonus: 0,
  };
}

export function currentLeg(m) {
  return LEGS[m.legIndex] ?? null;
}

export function destinationName(m) {
  const leg = currentLeg(m);
  return leg ? ISLANDS[leg.to].name : '—';
}

export function windLabel(m) {
  const leg = currentLeg(m);
  return leg ? leg.wind.label : 'calm';
}

// Landing score: centreline accuracy + touchdown speed + softness.
// Max per leg: 200 base + 300 centre + 150 speed + 150 soft = 800.
export function scoreLanding(m, info) {
  const centre = Math.max(0, 300 - info.centerOffset * 12);
  const speedBonus = Math.max(0, 150 - Math.abs(info.speed - 26) * 6);
  const soft = Math.max(0, clamp(150 + info.vy * 18, 0, 150));
  const points = Math.round(200 + centre + speedBonus + soft);
  const rec = { leg: m.legIndex + 1, island: ISLANDS[info.island].name, points, centerOffset: info.centerOffset, speed: info.speed, vy: info.vy };
  m.deliveries.push(rec);
  m.score += points;
  m.landings += 1;
  return rec;
}

// Called after a scored landing: advance to the next leg or finish.
export function advanceLeg(m, missionTime) {
  if (m.legIndex >= LEGS.length - 1) {
    m.done = true;
    m.timeBonus = Math.max(0, Math.round((900 - missionTime) * 0.5));
    m.score += m.timeBonus;
    return { done: true };
  }
  m.legIndex += 1;
  return { done: false, next: currentLeg(m) };
}
