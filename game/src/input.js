// Keyboard input: held keys plus edge-triggered actions (flaps, gear, pause, ...).

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last consume()
    this.anyKey = false;
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(k);
      this.pressed.add(k);
      this.anyKey = true;
      // Keep the page from scrolling on game keys.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    };
    this.onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(k) {
    return this.keys.has(k);
  }

  /** True once per physical press; call after reading each frame. */
  wasPressed(k) {
    return this.pressed.has(k);
  }

  endFrame() {
    this.pressed.clear();
  }

  /** -1..1 roll input: ArrowLeft/Right. */
  rollAxis() {
    let v = 0;
    if (this.down('ArrowLeft')) v -= 1;
    if (this.down('ArrowRight')) v += 1;
    return v;
  }

  /** -1..1 pitch input: ArrowUp pitches down (stick forward), ArrowDown pitches up. */
  pitchAxis() {
    let v = 0;
    if (this.down('ArrowUp')) v -= 1;
    if (this.down('ArrowDown')) v += 1;
    return v;
  }

  /** -1..1 rudder input: A/D. */
  rudderAxis() {
    let v = 0;
    if (this.down('a')) v -= 1;
    if (this.down('d')) v += 1;
    return v;
  }

  /** -1..1 throttle input: W/S or ArrowUp/Down are pitch; W/S only for throttle. */
  throttleAxis() {
    let v = 0;
    if (this.down('w')) v += 1;
    if (this.down('s')) v -= 1;
    return v;
  }
}
