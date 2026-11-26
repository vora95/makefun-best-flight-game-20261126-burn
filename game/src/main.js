// Sunset Cargo Run — bootstrap, game loop, chase camera and the state machine
// (title → flying → leg result → complete / game over). Shot mode is driven
// by shots.js; the live game is driven by the keyboard.

import * as THREE from 'three';
import { SEED, clamp, islandById, headingVec } from './config.js';
import { Input } from './input.js';
import { Flight } from './flight.js';
import { buildWorld } from './world.js';
import { buildPlane } from './plane.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const SHOT_MODE = !!shotName;

const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
camera.position.set(-40, 30, 80);

const world = buildWorld(scene);
const plane = buildPlane();
scene.add(plane.group);

const flight = new Flight();
const missions = new Missions();
const hud = new Hud();
const audio = new AudioEngine();
const input = new Input();

const game = {
  flight,
  missions,
  hud,
  audio,
  world,
  plane,
  input,
  phase: 'title',
  best: 0,
  shot: null,
  simTime: 0,
  startGame,
  backToTitle,
};
window.__game = game;

let pausedFrom = 'flying';
let resultTimer = 0;
let crashTimer = 0;
let camOrbit = 0;

function startGame() {
  missions.reset();
  flight.resetToRunway('home');
  game.phase = 'flying';
  hud.show('none');
  missions.say('LEG 1 — MEDICAL SUPPLIES TO PALM CAY. FULL THROTTLE, ROTATE AT 46 KT!', 6);
  audio.start();
  audio.click();
}

function backToTitle() {
  flight.resetToRunway('home');
  game.phase = 'title';
  hud.show('title', { best: game.best });
}

function nextLeg() {
  const from = missions.fromIsland;
  flight.resetToRunway(from.id);
  game.phase = 'flying';
  hud.show('none');
  const leg = missions.leg;
  if (leg) missions.say(`LEG ${missions.legIndex + 1} — ${leg.cargo.toUpperCase()} TO ${missions.dest.name.toUpperCase()}. WIND ${missions.windLabel()}.`, 6);
  audio.click();
}

function finishMission() {
  const bonus = missions.completionBonus();
  const total = missions.score + bonus;
  game.best = Math.max(game.best, total);
  game.phase = 'complete';
  hud.show('complete', { total, bonus, time: missions.elapsed, legs: missions.legScores });
  audio.chime();
}

function gameOver(reason) {
  game.phase = 'gameover';
  hud.show('gameover', { reason, score: missions.score, leg: missions.legIndex });
  audio.alarm();
}

function respawnAfterCrash() {
  missions.damage += 1;
  if (missions.damage >= 3) {
    gameOver(`${flight.crashReason} — AIRFRAME DESTROYED (3/3 DAMAGE)`);
    return;
  }
  const from = missions.fromIsland;
  flight.resetToRunway(from.id);
  missions.fuel = 60;
  game.phase = 'flying';
  hud.show('none');
  missions.say(`${flight.crashReason} — DAMAGE ${missions.damage}/3. BACK ON THE RUNWAY, FUEL 60%. FLY CAREFUL!`, 6);
  audio.alarm();
}

/** Handle a touchdown / crash event returned by the flight model. */
function handleTouchdown(event) {
  if (event === 'crash') {
    respawnAfterCrash();
    return;
  }
  // 'landed' or 'hard': score it only when the strip is the destination.
  const scored = missions.scoreLanding(flight);
  if (scored.kind === 'wrong') {
    if (event === 'hard') {
      missions.damage += 1;
      audio.thud();
      if (missions.damage >= 3) {
        gameOver('HARD LANDING OFF-RUNWAY — AIRFRAME DESTROYED (3/3 DAMAGE)');
        return;
      }
      missions.say(`ROUGH LANDING — ${scored.detail} DAMAGE ${missions.damage}/3. TAKE OFF AND TRY AGAIN.`, 6);
    } else {
      missions.say(`${scored.detail} TAKE OFF AND TRY THE STRIP AGAIN.`, 6);
    }
    return;
  }
  if (event === 'hard') {
    missions.damage += 1;
    if (missions.damage >= 3) {
      gameOver('HARD LANDING — AIRFRAME DESTROYED (3/3 DAMAGE)');
      return;
    }
  }
  audio.thud();
  audio.chime();
  const rec = missions.completeLeg(scored, flight);
  if (missions.done) {
    finishMission();
    return;
  }
  game.phase = 'result';
  resultTimer = 0;
  hud.show('result', { rec, next: `${missions.leg.cargo} → ${missions.dest.name}` });
}

function readControls() {
  if (game.shot && game.shot.autopilot) return game.shot.autopilot();
  return {
    roll: input.rollAxis(),
    pitch: input.pitchAxis(),
    rudder: input.rudderAxis(),
    throttleAxis: input.throttleAxis(),
    throttleSet: null,
    flaps: input.down('f') ? 1 : 0,
    gearDown: game.gearDown,
    brake: input.down('b'),
  };
}

// Gear is a toggle: G flips it on press.
game.gearDown = true;

function step(dt) {
  game.simTime += dt;
  const shot = game.shot;

  // --- global keys ---
  if (input.wasPressed('m')) {
    audio.setMuted(!audio.muted);
    missions.say(audio.muted ? 'SOUND OFF' : 'SOUND ON', 2);
  }
  if (input.wasPressed('r') && game.phase !== 'title') {
    startGame();
    input.endFrame();
    return;
  }

  if (game.phase === 'title') {
    if (input.wasPressed('Enter') || input.wasPressed(' ') || input.anyKey) {
      input.anyKey = false;
      startGame();
    }
    world.update(game.simTime, dt);
    plane.update(dt, flight.speed, true);
    // Shot mode: the menu scene still has to advance its own clock, or
    // window.__shotReady would never fire on the title screen.
    if (shot) shot.tick(dt);
    input.endFrame();
    return;
  }

  if (game.phase === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('Escape')) {
      game.phase = pausedFrom;
      hud.show('none');
      audio.click();
    }
    input.endFrame();
    return;
  }

  if (game.phase === 'result') {
    resultTimer += dt;
    if (resultTimer > 5 || input.wasPressed('Enter') || input.wasPressed(' ')) nextLeg();
    plane.update(dt, 0, true);
    world.update(game.simTime, dt);
    // Shot mode: the delivery scene must advance its clock while the result
    // screen is up, or its done() (1 s after the result appears) never fires
    // and the capture falls back to leg 2's runway instead of the delivery.
    if (shot) shot.tick(dt);
    input.endFrame();
    return;
  }

  if (game.phase === 'complete' || game.phase === 'gameover') {
    camOrbit += dt * 0.12;
    if (input.wasPressed('Enter') || input.wasPressed(' ') || input.wasPressed('r')) startGame();
    plane.update(dt, 0, flight.gearDown);
    world.update(game.simTime, dt);
    if (shot) shot.tick(dt);
    input.endFrame();
    return;
  }

  // --- flying ---
  if (input.wasPressed('p') || input.wasPressed('Escape')) {
    pausedFrom = 'flying';
    game.phase = 'paused';
    hud.show('pause');
    input.endFrame();
    return;
  }
  if (!SHOT_MODE && input.wasPressed('g')) {
    game.gearDown = !game.gearDown;
    missions.say(game.gearDown ? 'GEAR DOWN' : 'GEAR UP', 2);
    audio.click();
  }
  if (shot) {
    game.gearDown = flight.gearDown;
  }

  const ctrl = readControls();
  const wind = missions.windVector();
  const event = flight.update(dt, { ...ctrl, gearDown: game.gearDown }, wind);
  missions.elapsed += dt;
  const fuelEvent = missions.burnFuel(dt, flight);
  if (fuelEvent === 'empty') audio.alarm();

  if (event) handleTouchdown(event);

  // Stranded: engine out, stopped on the ground, leg not delivered.
  if (game.phase === 'flying' && flight.engineOut && flight.onGround && flight.speed < 2) {
    gameOver('OUT OF FUEL — STRANDED AWAY FROM A RUNWAY');
  }

  plane.update(dt, flight.speed, game.gearDown);
  world.update(game.simTime, dt);
  audio.update(flight.throttle, flight.speed, !flight.onGround);
  if (shot) shot.tick(dt);
  input.endFrame();
}

function updateCamera(dt) {
  const f = { x: Math.sin(flight.heading), z: -Math.cos(flight.heading) };
  if (game.phase === 'title' && game.shot && game.shot.camera === 'menu') {
    // Menu shot: the title card covers the centre of the frame, so aim the
    // camera at a point right of and above the plane — the plane lands
    // lower-left of the card, on the runway at sunset, instead of behind it.
    const home = islandById('home');
    const hf = headingVec(home.runwayHeading);
    const rx = -hf.z;
    const rz = hf.x; // unit vector to the plane's right
    camera.position.set(
      flight.x - hf.x * 40 - rx * 4,
      flight.y + 6,
      flight.z - hf.z * 40 - rz * 4,
    );
    camera.lookAt(flight.x + rx * 10, flight.y + 18, flight.z + rz * 10);
    return;
  }
  if (game.phase === 'title') {
    camera.position.set(flight.x - f.x * 30 + 24, flight.y + 8, flight.z - f.z * 30 + 26);
    camera.lookAt(flight.x, flight.y + 1, flight.z);
    return;
  }
  if (game.phase === 'complete' || game.phase === 'gameover') {
    const r = 26;
    camera.position.set(
      flight.x + Math.cos(camOrbit) * r,
      flight.y + 9,
      flight.z + Math.sin(camOrbit) * r,
    );
    camera.lookAt(flight.x, flight.y + 1, flight.z);
    return;
  }
  // Chase camera: behind and above, eased toward its target.
  const dist = flight.onGround ? 15 : 17;
  const height = flight.onGround ? 4.6 : 5.4;
  const tx = flight.x - f.x * dist;
  const ty = flight.y + height;
  const tz = flight.z - f.z * dist;
  const k = 1 - Math.exp(-dt * 4.5);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(flight.x + f.x * 20, flight.y + 1.2, flight.z + f.z * 20);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  step(dt);
  updateCamera(dt);
  // Plane mesh follows the flight model. Nose is local -Z, heading 0 = -Z.
  plane.group.position.set(flight.x, flight.y, flight.z);
  plane.group.rotation.order = 'YXZ';
  plane.group.rotation.y = -flight.heading;
  plane.group.rotation.x = flight.pitch;
  plane.group.rotation.z = -flight.roll;
  hud.update({ flight, missions, phase: game.phase, time: game.simTime });
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Click / tap: title starts, result screen continues.
renderer.domElement.addEventListener('pointerdown', () => {
  if (game.phase === 'title') startGame();
  else if (game.phase === 'result') nextLeg();
});

// --- boot ---
if (SHOT_MODE) {
  applyShot(shotName, game);
  hud.show(game.phase === 'title' ? 'title' : 'none', { best: 0 });
} else {
  hud.show('title', { best: 0 });
}
window.__shotReady = window.__shotReady || false;
requestAnimationFrame(frame);
