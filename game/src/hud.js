// Sunset Cargo Run — HUD + screens (DOM overlay, bright on dark panels so it
// reads in screenshots): instruments, cargo manifest, messages, title / pause /
// leg-result / mission-complete / game-over screens.
import { ISLANDS, LEGS, yawToHeading } from './config.js';
import { currentLeg, destinationName } from './missions.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    const $ = (id) => doc.getElementById(id);
    this.el = {
      alt: $('hud-alt'), spd: $('hud-spd'), hdg: $('hud-hdg'),
      fuelFill: $('fuel-fill'), fuelText: $('fuel-text'),
      wind: $('hud-wind'), score: $('hud-score'), time: $('hud-time'),
      leg: $('hud-leg'), dest: $('hud-dest'), cargo: $('hud-cargo'),
      dmg: $('hud-dmg'), msg: $('hud-msg'),
      gear: $('hud-gear'), flaps: $('hud-flaps'),
      screens: {
        title: $('screen-title'), pause: $('screen-pause'), leg: $('screen-leg'),
        complete: $('screen-complete'), over: $('screen-over'),
      },
      legTitle: $('leg-title'), legBody: $('leg-body'),
      completeBody: $('complete-body'), overBody: $('over-body'),
      finalScore: $('final-score'),
    };
    this.msgUntil = 0;
  }

  show(name) {
    for (const [key, el] of Object.entries(this.el.screens)) {
      if (el) el.style.display = key === name ? 'flex' : 'none';
    }
  }

  hideAll() {
    this.show(null);
  }

  message(text, seconds = 4) {
    if (!this.el.msg) return;
    this.el.msg.textContent = text;
    this.el.msg.style.opacity = '1';
    this.msgUntil = performance.now() / 1000 + seconds;
  }

  update(state, mission, mode) {
    const e = this.el;
    if (e.alt) e.alt.textContent = `${Math.round(state.pos.y * 3.28)} ft`;
    if (e.spd) e.spd.textContent = `${Math.round(state.speed * 1.944)} kt`;
    if (e.hdg) e.hdg.textContent = `${String(Math.round(yawToHeading(state.yaw))).padStart(3, '0')}°`;
    if (e.fuelFill) {
      e.fuelFill.style.width = `${Math.max(0, state.fuel)}%`;
      e.fuelFill.style.background = state.fuel > 30 ? '#37d67a' : state.fuel > 12 ? '#ffb347' : '#ff4d4d';
    }
    if (e.fuelText) e.fuelText.textContent = `FUEL ${Math.round(state.fuel)}%`;
    if (e.wind) e.wind.textContent = `WIND ${currentLeg(mission) ? currentLeg(mission).wind.label : 'calm'}`;
    if (e.score) e.score.textContent = `SCORE ${mission.score}`;
    if (e.time) {
      const t = Math.floor(state.time);
      e.time.textContent = `TIME ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    }
    const leg = currentLeg(mission);
    if (e.leg) e.leg.textContent = mission.done ? 'ALL DELIVERED' : `LEG ${mission.legIndex + 1}/3`;
    if (e.dest) e.dest.textContent = mission.done ? 'MISSION COMPLETE' : `DEST: ${destinationName(mission)}`;
    if (e.cargo) e.cargo.textContent = leg ? `CARGO: ${leg.cargo}` : '';
    if (e.dmg) e.dmg.textContent = `DAMAGE ${'▮'.repeat(state.damage)}${'▯'.repeat(3 - state.damage)}`;
    if (e.gear) e.gear.textContent = state.gearDown ? 'GEAR DOWN' : 'GEAR UP';
    if (e.flaps) e.flaps.textContent = state.flaps ? 'FLAPS DOWN' : 'FLAPS UP';
    if (this.msgUntil && performance.now() / 1000 > this.msgUntil && this.el.msg) {
      this.el.msg.style.opacity = '0.25';
    }
    // Manifest list on the title screen.
    const manifest = this.doc.getElementById('manifest-list');
    if (manifest && !manifest.dataset.filled) {
      manifest.dataset.filled = '1';
      manifest.innerHTML = LEGS.map(
        (l, i) => `<div>LEG ${i + 1} — ${ISLANDS[l.from].short} → ${ISLANDS[l.to].name.toUpperCase()} · ${l.cargo}</div>`
      ).join('');
    }
  }

  showLegResult(rec, mission) {
    const e = this.el;
    if (e.legTitle) e.legTitle.textContent = `CARGO DELIVERED — ${rec.island.toUpperCase()}`;
    if (e.legBody) {
      e.legBody.innerHTML =
        `<div>LEG ${rec.leg} SCORE <b>+${rec.points}</b></div>` +
        `<div>Centreline offset: ${rec.centerOffset.toFixed(1)} m</div>` +
        `<div>Touchdown: ${(rec.speed * 1.944).toFixed(0)} kt · sink ${(Math.abs(rec.vy) * 3.28).toFixed(0)} ft/s</div>` +
        `<div>Refuelled to 100% — total score ${mission.score}</div>`;
    }
    this.show('leg');
  }

  showComplete(mission, state) {
    const e = this.el;
    if (e.completeBody) {
      e.completeBody.innerHTML =
        `<div>All 3 cargo legs delivered before sunset.</div>` +
        `<div>Deliveries: ${mission.deliveries.map((d) => `LEG ${d.leg} +${d.points}`).join(' · ')}</div>` +
        `<div>Time bonus: +${mission.timeBonus} · Damage: ${state.damage}/3</div>`;
    }
    if (e.finalScore) e.finalScore.textContent = `FINAL SCORE ${mission.score}`;
    this.show('complete');
  }

  showGameOver(reason, mission) {
    const e = this.el;
    if (e.overBody) {
      e.overBody.innerHTML =
        `<div>${reason}</div>` +
        `<div>Damage 3/3 — the bush plane is grounded.</div>` +
        `<div>Deliveries made: ${mission.landings}/3 · Score ${mission.score}</div>`;
    }
    this.show('over');
  }
}
