// HUD + screens: bright, readable instruments and overlays, all DOM so they
// stay crisp in screenshots. index.html owns the markup; this owns the values.

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.lastMsg = '';
  }

  /** Per-frame instrument update. state: { flight, missions, phase, time } */
  update(state) {
    const { flight, missions } = state;
    const set = (id, v) => {
      const e = this.el(id);
      if (e && e.textContent !== v) e.textContent = v;
    };
    set('hud-alt', `${Math.round(flight.altitudeFt)} ft`);
    set('hud-spd', `${Math.round(flight.speedKt)} kt`);
    set('hud-hdg', `${String(Math.round(flight.headingDeg)).padStart(3, '0')}°`);
    set('hud-vs', `${flight.vspeed >= 0 ? '+' : ''}${(flight.vspeed * 196.85).toFixed(0)} fpm`);
    set('hud-thr', `${Math.round(flight.throttle * 100)}%`);
    set('hud-score', String(missions.score));
    set('hud-time', fmtTime(missions.elapsed));
    set('hud-damage', `${missions.damage}/3`);
    set('hud-gear', flight.gearDown ? 'GEAR DOWN' : 'GEAR UP');
    set('hud-flaps', flight.flaps > 0 ? 'FLAPS' : 'FLAPS UP');
    set('hud-wind', missions.done ? '—' : missions.windLabel());

    const fuelBar = this.el('hud-fuel-fill');
    if (fuelBar) {
      fuelBar.style.width = `${missions.fuel.toFixed(1)}%`;
      fuelBar.style.background = missions.fuel > 35 ? '#37d67a' : missions.fuel > 15 ? '#ffb020' : '#ff4444';
    }
    set('hud-fuel-text', `${Math.round(missions.fuel)}%`);

    // Cargo manifest.
    const leg = missions.leg;
    if (leg) {
      set('hud-leg', `LEG ${missions.legIndex + 1}/3`);
      set('hud-dest', missions.dest.name.toUpperCase());
      set('hud-cargo', `${leg.cargo} · ${leg.weight}`);
      const dist = Math.round(flight.distanceTo(missions.dest));
      const brg = Math.round(flight.bearingTo(missions.dest));
      set('hud-dist', `${dist} m · BRG ${String(brg).padStart(3, '0')}°`);
    } else {
      set('hud-leg', 'DONE');
      set('hud-dest', 'ALL DELIVERED');
      set('hud-cargo', '—');
      set('hud-dist', '—');
    }

    // Mission message banner.
    const msg = state.phase === 'flying' && missions.elapsed < missions.messageUntil ? missions.message : '';
    const banner = this.el('hud-msg');
    if (banner && msg !== this.lastMsg) {
      banner.textContent = msg;
      banner.style.display = msg ? 'block' : 'none';
      this.lastMsg = msg;
    }

    // Fuel warning flash.
    const fuelBox = this.el('hud-fuel');
    if (fuelBox) fuelBox.classList.toggle('low', missions.fuel <= 15 && state.phase === 'flying');
  }

  /** Show one screen overlay, hide the rest. name: title|pause|result|complete|gameover|none */
  show(name, data = {}) {
    for (const s of ['title', 'pause', 'result', 'complete', 'gameover']) {
      const e = this.el(`screen-${s}`);
      if (e) e.style.display = s === name ? 'flex' : 'none';
    }
    const hud = this.el('hud');
    if (hud) hud.style.display = name === 'none' || name === 'pause' ? 'block' : name === 'result' ? 'block' : 'block';
    if (name === 'result' && data.rec) {
      const r = data.rec;
      const set = (id, v) => {
        const e = this.el(id);
        if (e) e.textContent = v;
      };
      set('res-title', `CARGO DELIVERED — ${r.dest.toUpperCase()}`);
      set('res-cargo', `${r.cargo}`);
      set('res-centre', `${r.centre}/300`);
      set('res-speed', `${r.speed}/250`);
      set('res-soft', `${r.soft}/250`);
      set('res-total', `+${r.total}`);
      set('res-detail', r.detail);
      set('res-next', data.next ? `Next leg: ${data.next}` : 'All cargo delivered!');
    }
    if (name === 'complete' && data.total !== undefined) {
      const set = (id, v) => {
        const e = this.el(id);
        if (e) e.textContent = v;
      };
      set('cmp-score', String(data.total));
      set('cmp-bonus', `Time bonus +${data.bonus}`);
      set('cmp-time', fmtTime(data.time));
      set('cmp-legs', data.legs.map((l) => `Leg ${l.leg} ${l.dest}: ${l.total}/800`).join('  ·  '));
    }
    if (name === 'gameover' && data.reason) {
      const e = this.el('go-reason');
      if (e) e.textContent = data.reason;
      const s = this.el('go-score');
      if (s) s.textContent = `Score ${data.score} · Leg ${Math.min(data.leg + 1, 3)}/3`;
    }
    if (name === 'title' && data.best !== undefined) {
      const e = this.el('title-best');
      if (e) e.textContent = data.best > 0 ? `Best score: ${data.best}` : '';
    }
  }
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
