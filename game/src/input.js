// Sunset Cargo Run — input: keyboard state + edge-triggered toggles.
// Controls: W/S throttle, Arrow Left/Right roll, Arrow Up/Down pitch,
// A/D rudder, F flaps, G gear, B brake (hold), R restart, P pause, M mute.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge: codes pressed since last consume
    this.onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
  }

  attach(target = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once per physical press; call once per frame per action.
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }

  // -1..1 throttle change request (W up, S down).
  get throttle() {
    return (this.down('KeyW') ? 1 : 0) - (this.down('KeyS') ? 1 : 0);
  }

  // -1..1 roll: ArrowRight banks right (+1), ArrowLeft banks left.
  get roll() {
    return (this.down('ArrowRight') ? 1 : 0) - (this.down('ArrowLeft') ? 1 : 0);
  }

  // -1..1 pitch: ArrowUp pulls nose up (+1), ArrowDown pushes down.
  get pitch() {
    return (this.down('ArrowUp') ? 1 : 0) - (this.down('ArrowDown') ? 1 : 0);
  }

  // -1..1 rudder: D right, A left.
  get yaw() {
    return (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0);
  }

  get brake() {
    return this.down('KeyB');
  }
}
