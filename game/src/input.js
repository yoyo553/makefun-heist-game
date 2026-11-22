// Keyboard and mouse, collected in one place. Each step the world asks for a
// move direction, a tiptoe flag, at most one decoy-coin toss and at most one
// EMP firing; menus ask for one-shot actions (confirm, pause, restart).
// Clicks land in window pixels and are turned into room coordinates by the
// `toField` callback main.js hands in, since only the renderer knows the scale.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

const DIRECTIONS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
};

export function createInput(canvas, toField) {
  const down = new Set();
  let queued = 0;
  let queuedToss = null;
  let empQueued = false;
  let pointer = null;

  function isMoveKey(code) {
    return Boolean(DIRECTIONS[code]) || code === 'ShiftLeft' || code === 'ShiftRight';
  }

  window.addEventListener('keydown', (event) => {
    if (isMoveKey(event.code)) {
      down.add(event.code);
      event.preventDefault();
    }
    if (event.code === 'Enter' || event.code === 'Space') queued |= ACTION_CONFIRM;
    if (event.code === 'Escape' || event.code === 'KeyP') queued |= ACTION_PAUSE;
    if (event.code === 'KeyR') queued |= ACTION_RESTART;
    if (event.code === 'KeyE' && !event.repeat) empQueued = true;
  });
  window.addEventListener('keyup', (event) => down.delete(event.code));
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('mousemove', (event) => {
    pointer = toField(event.clientX, event.clientY);
  });
  canvas.addEventListener('mousedown', (event) => {
    const at = toField(event.clientX, event.clientY);
    pointer = at;
    queuedToss = at;
    queued |= ACTION_CONFIRM;
  });

  return {
    // The held move direction, each axis in -1..1. Not normalised; the world
    // does that.
    direction() {
      let x = 0;
      let y = 0;
      for (const code of down) {
        const step = DIRECTIONS[code];
        if (step) {
          x += step[0];
          y += step[1];
        }
      }
      return { x, y };
    },
    tiptoe() {
      return down.has('ShiftLeft') || down.has('ShiftRight');
    },
    // One-shot menu actions since the last read; reading clears them.
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
    // The room point of the newest click not yet spent as a coin toss, or null.
    takeThrow() {
      const taken = queuedToss;
      queuedToss = null;
      return taken;
    },
    // Throw a click away without tossing (menus treat clicks as "confirm").
    clearThrow() {
      queuedToss = null;
    },
    // True once per E press; reading it clears it.
    takeEmp() {
      const taken = empQueued;
      empQueued = false;
      return taken;
    },
    mouse() {
      return pointer;
    },
  };
}
