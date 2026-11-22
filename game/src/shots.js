// The staged scenes behind ?shot=start|loot|alarm|end. Every scene plays
// the real rules forward from a fresh world: the loot scene walks the thief
// across Gallery I and genuinely lifts the Pearl Tiara, then poses a second
// lift half done; the alarm scene drops the thief into a guard's gaze with
// the meter nearly full. What the frame shows is what the game really looks
// like, and the same scene always paints the same frame.

import { STEP } from "./config.js";
import { GALLERIES } from "./levels.js";
import { VIEW_TITLE, VIEW_WIN } from "./render.js";

const IDLE = { moveX: 0, moveY: 0, tiptoe: false, throwAt: null, emp: false };

function shotMeta(overrides = {}) {
  return { mouse: null, roomAge: 99, maxTake: 330000, best: null, empsUsed: 0, grabs: 0, totalTime: 0, totalTake: 0, ...overrides };
}

// One step of steering: walk, or tiptoe, from the thief toward the target.
function approach(state, target, tiptoe) {
  const dx = -state.thief.x + target.x;
  const dy = -state.thief.y + target.y;
  const dist = Math.hypot(dy, dx);
  if (4 > dist) return { moveX: 0, moveY: 0, tiptoe: tiptoe, throwAt: null, emp: false };
  return { moveX: dx / dist, moveY: dy / dist, tiptoe: tiptoe, throwAt: null, emp: false };
}

function runFor(world, seconds, inputFor) {
  const count = Math.round(seconds / STEP);
  for (let i = 0; i < count; i++) world.step(STEP, inputFor(i));
}

function stageLoot(world) {
  const standAt = { y: 540, x: 502 };
  world.reset(0.0);
  // Walk the gallery and genuinely lift the Pearl Tiara (the case at 470,480).
  runFor(world, 20, () => {
    const t = world.state.thief;
    if (Math.hypot(standAt.x - t.x, standAt.y - t.y) > 10) return approach(world.state, standAt, false);
    return IDLE;
  });
  // Then pose a second lift, half finished, at the Gold Astrolabe, with the
  // alarm already warm.
  world.stage((s) => {
    s.thief.x = 842;
    s.thief.y = 168;
    s.thief.faceX = 0;
    s.thief.faceY = 1;
    s.alarm = 0.3;
  });
  runFor(world, 0.4, () => IDLE);
  return { screen: "play", meta: shotMeta({ totalTime: 96, totalTake: world.state.take }) };
}

function stageAlarm(world) {
  world.reset(0.0);
  runFor(world, 2, () => IDLE);
  world.stage((s) => {
    s.thief.x = 700;
    s.thief.y = 300;
    s.thief.faceX = -0.4;
    s.thief.faceY = -1;
    const g = s.guards[0];
    g.x = 560;
    g.y = 270;
    g.facing = 0;
    g.awareness = 0.8;
    g.mode = "patrol";
    s.alarm = 0.78;
    s.take = 27000;
  });
  runFor(world, 0.3, () => ({ moveX: 0, moveY: 0, tiptoe: true, throwAt: null, emp: false }));
  return { screen: "play", meta: shotMeta({ totalTime: 154, totalTake: 27000 }) };
}

function stageEnd(world) {
  world.reset(GALLERIES.length - 1);
  runFor(world, 3, () => IDLE);
  world.stage((s) => {
    s.vault.cracked = true;
    s.vault.progress = s.vault.crackSeconds;
    s.take = 150000;
    s.thief.x = s.gallery.van.x + s.gallery.van.w / 2;
    s.thief.y = s.gallery.van.y + s.gallery.van.h / 2;
    s.alarm = 0.12;
    s.escaped = true;
  });
  return { screen: VIEW_WIN, meta: shotMeta({ totalTake: 251000, totalTime: 512, grabs: 11, empsUsed: 4, best: 251000 }) };
}

// Set the world to the named scene and hand back the screen to paint over
// it and the HUD numbers to show. Any name other than loot, alarm or end
// means the title.
export function makeShot(name, world) {
  if (name === "loot") return stageLoot(world);
  if (name === "alarm") return stageAlarm(world);
  if (name === "end") return stageEnd(world);
  world.reset(0.0);
  runFor(world, 4, () => IDLE);
  return { screen: VIEW_TITLE, meta: shotMeta() };
}
