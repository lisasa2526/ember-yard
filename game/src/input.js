// Ember Yard — keyboard, mouse and pointer lock. Keeps the raw DOM events
// behind a small interface: a set of held keys, accumulated mouse deltas,
// a firing flag, and callbacks for one-shot keys and fire transitions.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.firing = false;
    this.locked = false;
    this.onLockChange = null; // (locked) => void
    this.onKey = null; // (code, down) => void, one-shot keys
    this.onFire = null; // (down) => void

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code, true);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (this.onKey) this.onKey(e.code, false);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (!this.locked) {
        this.lock();
        return;
      }
      this.firing = true;
      if (this.onFire) this.onFire(true);
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      this.firing = false;
      if (this.onFire) this.onFire(false);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.firing = false;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.firing = false;
    });
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // Headless or denied: mouse look stays off, keys still work.
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Drain the accumulated mouse movement since the last frame.
  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return [dx, dy];
  }

  down(code) {
    return this.keys.has(code);
  }

  // WASD plus arrow keys, as a -1..1 forward/strafe pair.
  moveVector() {
    let f = 0;
    let s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return [f, s];
  }
}
