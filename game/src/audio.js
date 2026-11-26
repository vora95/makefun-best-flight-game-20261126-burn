// Procedural WebAudio: engine drone that follows the throttle, wind rush,
// landing thud and delivery chime. No audio files.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.noiseGain = null;
    this.muted = false;
    this.started = false;
  }

  /** Must be called from a user gesture (or a shot) — creates the context. */
  start() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // Engine: two detuned saws through a low-pass.
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineFilter.Q.value = 1.2;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc2.frequency.value = 93;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();

      // Wind: looped filtered noise.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 700;
      noiseFilter.Q.value = 0.6;
      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0;
      noise.connect(noiseFilter);
      noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      noise.start();
      this.started = true;
    } catch {
      this.started = false;
    }
  }

  /** Per-frame: throttle 0..1, speed m/s, airborne bool. */
  update(throttle, speed, airborne) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 46 + throttle * 66;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 1.494, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + throttle * 900, t, 0.1);
    const eng = airborne || throttle > 0.05 ? 0.05 + throttle * 0.11 : 0;
    this.engineGain.gain.setTargetAtTime(eng, t, 0.1);
    const wind = airborne ? Math.min(0.12, speed * 0.0022) : 0;
    this.noiseGain.gain.setTargetAtTime(wind, t, 0.15);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  _tone(freq, dur, type, vol, when = 0) {
    if (!this.started || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  thud() {
    this._tone(70, 0.25, 'sine', 0.5);
    this._tone(48, 0.35, 'triangle', 0.4, 0.02);
  }

  chime() {
    this._tone(523, 0.35, 'sine', 0.3);
    this._tone(659, 0.35, 'sine', 0.3, 0.12);
    this._tone(784, 0.6, 'sine', 0.32, 0.24);
  }

  alarm() {
    this._tone(880, 0.18, 'square', 0.16);
    this._tone(880, 0.18, 'square', 0.16, 0.25);
  }

  click() {
    this._tone(1200, 0.06, 'square', 0.12);
  }
}
