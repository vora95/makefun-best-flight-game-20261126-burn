// Sunset Cargo Run — audio: fully procedural WebAudio, no external files.
// Engine hum follows throttle; wind rush follows airspeed; thud + chime cues.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.windGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // Engine: two detuned saws through a lowpass.
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc2.frequency.value = 93;
      this.engineOsc.connect(filter);
      this.engineOsc2.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.engineOsc2.start();
      // Wind: looped noise through a bandpass.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      noise.connect(bp);
      bp.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      noise.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx && this.engineGain) this.engineGain.gain.value = 0;
    if (this.ctx && this.windGain) this.windGain.gain.value = 0;
  }

  update(state) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const thr = state.throttle;
    this.engineOsc.frequency.setTargetAtTime(55 + thr * 95, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(82 + thr * 140, t, 0.1);
    this.engineGain.gain.setTargetAtTime(state.airborne || thr > 0.05 ? 0.035 + thr * 0.05 : 0, t, 0.15);
    this.windGain.gain.setTargetAtTime(state.airborne ? Math.min(0.06, state.speed * 0.0012) : 0, t, 0.2);
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (const [i, freq] of [523.25, 659.25, 783.99].entries()) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      const start = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    }
  }
}
