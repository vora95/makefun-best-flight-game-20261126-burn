// Sunset Cargo Run — bootstrap + game loop.
// Fixed-step simulation (1/60 s) so keyboard play, autopilot shots and the
// playtest all step the same physics. Rendering is plain Three.js.
import * as THREE from 'three';
import { CONFIG, ISLANDS, LEGS, clamp } from './config.js';
import { Input } from './input.js';
import { createFlightState, updateFlight, currentWind } from './flight.js';
import { buildWorld, heightAt, stripAt, stripCenter } from './world.js';
import { buildPlane } from './plane.js';
import { createMission, currentLeg, scoreLanding, advanceLeg } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { prepareShot, autopilotInput, autopilotTarget } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const FIXED_DT = 1 / 60;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 12000);
camera.position.set(24, ISLANDS[0].H + 9, 205);

const world = buildWorld(scene);
const plane = buildPlane();
scene.add(plane.group);
const hud = new HUD(document);
const audio = new AudioEngine();
const input = new Input();
input.attach();

let state = createFlightState();
let mission = createMission();
let mode = 'title'; // title | flying | paused | leg | complete | over
let shotFrozen = false;
let shotCamera = 'chase';

function setMode(m) {
  mode = m;
  if (m === 'title') hud.show('title');
  else if (m === 'paused') hud.show('pause');
  else if (m === 'flying') hud.hideAll();
}

function startMission() {
  audio.ensure();
  setMode('flying');
  hud.message('LEG 1 — deliver the fish to PALM CAY. W/S throttle, arrows fly.');
}

function restart() {
  state = createFlightState();
  mission = createMission();
  plane.update(0, state);
  setMode('flying');
  hud.message('Fresh plane, full tank. LEG 1 — PALM CAY.');
}

function nextLeg() {
  audio.ensure();
  const leg = currentLeg(mission);
  setMode('flying');
  if (leg) hud.message(`LEG ${mission.legIndex + 1} — ${leg.cargo} to ${ISLANDS[leg.to].name}. Wind ${leg.wind.label}.`);
}

// Shared landing path: flight hook and the delivery shot both use it.
function handleLanding(info) {
  const leg = currentLeg(mission);
  state.fuel = CONFIG.fuelCapacity;
  state.fuelEmptyAnnounced = false;
  audio.thud();
  if (!leg || info.island !== leg.to) {
    hud.message(`Wrong strip (${ISLANDS[info.island].name}) — refuelled, cargo still aboard. Take off and keep going.`);
    return;
  }
  const rec = scoreLanding(mission, info);
  audio.chime();
  const adv = advanceLeg(mission, state.time);
  if (adv.done) {
    setMode('complete');
    hud.showComplete(mission, state);
  } else {
    setMode('leg');
    hud.showLegResult(rec, mission);
  }
}

function handleCrash(info) {
  state.damage += 1;
  audio.thud();
  if (state.fuel <= 0) {
    state.fuel = 25;
    state.fuelEmptyAnnounced = false;
  }
  if (state.damage >= CONFIG.maxDamage) {
    setMode('over');
    hud.showGameOver(info.reason, mission);
  } else {
    hud.message(`⚠ ${info.reason} — DAMAGE ${state.damage}/3. Throttle up and try again.`, 5);
  }
}

const hooks = {
  onLanding: (info) => handleLanding(info),
  onCrash: (info) => handleCrash(info),
  onFuelEmpty: () => hud.message('⛽ FUEL EMPTY — gliding! Put her down gently anywhere.', 5),
};

const game = {
  get state() {
    return state;
  },
  get mission() {
    return mission;
  },
  get mode() {
    return mode;
  },
  set mode(m) {
    setMode(m);
  },
  setMode,
  startMission,
  restart,
  landNow: (island, info) => handleLanding({ island, ...info }),
  world: { heightAt, stripAt, stripCenter },
};

// Buttons.
const bind = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
};
bind('btn-fly', startMission);
bind('btn-resume', () => setMode('flying'));
bind('btn-next', nextLeg);
bind('btn-again', restart);
bind('btn-again2', restart);

// One physics step with the current control source.
function stepPhysics(dt, ctl) {
  const wind = currentLeg(mission) ? currentLeg(mission).wind : { x: 0, z: 0 };
  updateFlight(state, ctl, dt, wind, hooks);
}

function keyboardControl() {
  return {
    throttle: input.throttle,
    roll: input.roll,
    pitch: input.pitch,
    yaw: input.yaw,
    brake: input.brake,
  };
}

function pollEdgeKeys() {
  if (input.consume('KeyF')) {
    state.flaps = !state.flaps;
    hud.message(state.flaps ? 'Flaps down — slower, more lift.' : 'Flaps up.');
  }
  if (input.consume('KeyG')) {
    state.gearDown = !state.gearDown;
    hud.message(state.gearDown ? 'Gear down.' : 'Gear up.');
  }
  if (input.consume('KeyR')) restart();
  if (input.consume('KeyM')) {
    audio.setMuted(!audio.muted);
    hud.message(audio.muted ? 'Sound muted (M to unmute).' : 'Sound on.');
  }
  if (input.consume('KeyP')) {
    if (mode === 'flying') setMode('paused');
    else if (mode === 'paused') setMode('flying');
  }
  if (input.consume('Enter')) {
    if (mode === 'title') startMission();
    else if (mode === 'leg') nextLeg();
    else if (mode === 'complete' || mode === 'over') restart();
  }
  input.endFrame();
}

// Chase camera: behind and above the plane, looking ahead.
// snap=true teleports the camera (used once for staged shots).
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(24, ISLANDS[0].H + 9, 205);
function updateCamera(dt, snap = false) {
  if (shotCamera === 'menu' && mode === 'title') {
    const desiredPos = new THREE.Vector3(24, ISLANDS[0].H + 9, 205);
    const desiredTarget = new THREE.Vector3(0, ISLANDS[0].H + 4, 40);
    if (snap) {
      camPos.copy(desiredPos);
      camTarget.copy(desiredTarget);
    } else {
      camPos.lerp(desiredPos, 1 - Math.exp(-dt * 2));
      camTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 2));
    }
  } else {
    const fx = Math.sin(state.yaw);
    const fz = Math.cos(state.yaw);
    const desired = new THREE.Vector3(state.pos.x - fx * 16, state.pos.y + 5.5, state.pos.z - fz * 16);
    const ground = heightAt(desired.x, desired.z) + 2.5;
    if (desired.y < ground) desired.y = ground;
    const desiredTarget = new THREE.Vector3(state.pos.x + fx * 28, state.pos.y + 1.5, state.pos.z + fz * 28);
    if (snap) {
      camPos.copy(desired);
      camTarget.copy(desiredTarget);
    } else {
      camPos.lerp(desired, 1 - Math.exp(-dt * 5));
      camTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 6));
    }
  }
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

function renderFrame(dt) {
  world.update(dt);
  plane.update(dt, state);
  updateCamera(dt);
  hud.update(state, mission, mode);
  audio.update(state);
  renderer.render(scene, camera);
}

// ---- shot mode: deterministic staged scenes ----
let shotSpec = null;
if (shotName) {
  shotSpec = prepareShot(shotName, game);
  shotCamera = shotSpec.camera || 'chase';
  if (shotSpec.seconds > 0 && shotSpec.autopilot) {
    const steps = Math.round(shotSpec.seconds / FIXED_DT);
    for (let i = 0; i < steps; i++) {
      const tgt = autopilotTarget(game, shotSpec.autopilot);
      const ctl = autopilotInput(state, tgt.target, tgt.alt, tgt.throttle);
      stepPhysics(FIXED_DT, ctl);
      world.update(FIXED_DT);
      if (mode !== 'flying') break; // landed / crashed mid-shot: keep the frame
    }
  }
  renderFrame(FIXED_DT);
  updateCamera(FIXED_DT, true); // snap: no lerp frames before the screenshot
  hud.update(state, mission, mode);
  renderer.render(scene, camera);
  shotFrozen = true;
  window.__shotReady = true;
}

// ---- live loop ----
let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!shotFrozen) {
    pollEdgeKeys();
    if (mode === 'flying') {
      acc += dtReal;
      let n = 0;
      while (acc >= FIXED_DT && n < 4) {
        stepPhysics(FIXED_DT, keyboardControl());
        acc -= FIXED_DT;
        n++;
        if (mode !== 'flying') {
          acc = 0;
          break;
        }
      }
    }
    renderFrame(dtReal);
  } else {
    renderer.render(scene, camera);
  }
}
requestAnimationFrame(loop);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__cargo = game;
window.__shotReady = window.__shotReady === true;
