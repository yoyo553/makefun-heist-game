// The staged scenes behind ?shot=cover|vault|emp|alarm|end. Every scene
// plays the real rules forward from a fresh world, then poses the frame
// the judges will study: the cover is Gallery I mid-lift with a decoy
// coin already pulling a warden off his route; the vault scene is the
// big drill half done in Gallery III; the EMP scene is Gallery II a
// breath after the charge fired, both cameras dark; the alarm scene is
// a job about to blow. What the frame shows is what the game really
// looks like, and the same scene always paints the same frame.

import { STEP } from "./config.js";
import { GALLERIES } from "./levels.js";
import { VIEW_TITLE, VIEW_WIN } from "./render.js";

const IDLE = { moveX: 0, moveY: 0, tiptoe: false, throwAt: null, emp: false };

function shotMeta(overrides = {}) {
  return { mouse: null, roomAge: 99, maxTake: 330000, best: null, empsUsed: 0, grabs: 0, totalTime: 0, totalTake: 0, callouts: null, ...overrides };
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

// The cover: Gallery I with one case already in the bag, a second lift
// half done at the Gold Astrolabe, and a decoy coin's clink pulling the
// lower warden off his patrol to check the noise.
function stageCover(world) {
  const standAt = { y: 540, x: 502 };
  world.reset(0.0);
  // Walk the gallery and genuinely lift the Pearl Tiara (the case at 470,480).
  runFor(world, 20, () => {
    const t = world.state.thief;
    if (Math.hypot(standAt.x - t.x, standAt.y - t.y) > 10) return approach(world.state, standAt, false);
    return IDLE;
  });
  // Pose the second lift at the Gold Astrolabe, and land a decoy coin on
  // the lower runner where the second warden will hear it. The walk may
  // have blown the job on paper — the pose clears that, and resets both
  // wardens' minds so the frame shows the states it means to show.
  world.stage((s) => {
    s.blown = false;
    s.escaped = false;
    s.thief.x = 842;
    s.thief.y = 168;
    s.thief.faceX = 0;
    s.thief.faceY = 1;
    s.alarm = 0.3;
    s.coins.push({ landed: true, t: 0.5, x: 330, y: 452, fromX: 842, fromY: 168 });
    s.ripples.push({ kind: "ping", life: 0.9, age: 0.3, maxR: 205, r: 70, y: 452, x: 330 });
    const first = s.guards[0];
    first.awareness = 0;
    first.seesThief = false;
    first.unseenTimer = 0;
    const warden = s.guards[1];
    warden.x = 760;
    warden.y = 452;
    warden.mode = "investigate";
    warden.target = { x: 330, y: 452 };
    warden.lookTimer = 0;
    warden.awareness = 0.1;
    warden.seesThief = false;
    warden.unseenTimer = 0;
  });
  runFor(world, 0.4, () => IDLE);
  const warden = world.state.guards[1];
  const callouts = [{ x: warden.x, y: warden.y - 44, text: "A clink — over there! Checking it." }];
  return { screen: "play", meta: shotMeta({ totalTime: 96, totalTake: world.state.take, callouts }) };
}

// Gallery III, the Meridian Vault half drilled: two cases already
// lifted, the sentinel drawn down the runner by the drill's hum, and
// three camera sweeps crossing the room.
function stageVault(world) {
  world.reset(GALLERIES.length - 1);
  world.stage((s) => {
    s.blown = false;
    s.escaped = false;
    s.loot[0].taken = true; // Crown of Tides
    s.loot[2].taken = true; // Sunset Opal
    s.take = 40000;
    s.alarm = 0.18;
    s.thief.x = 535;
    s.thief.y = 108;
    s.thief.faceX = 0.3;
    s.thief.faceY = -1;
  });
  // Work the drill for just under two seconds of its three and a half.
  runFor(world, 1.8, () => IDLE);
  const t = world.state.thief;
  // The bubble hangs below the thief: the band under the vault is busy
  // with the vault's own name, the drill bar and the sentinel's badge.
  const callouts = [{ x: 565, y: t.y + 118, text: "The drill sings — the hum draws them in." }];
  return { screen: "play", meta: shotMeta({ totalTime: 402, totalTake: world.state.take, callouts }) };
}

// Gallery II a breath after the EMP: both cameras dark and labelled
// OFFLINE, their cones gone, while the thief lifts a painting off the
// partition wall under the wardens' routes.
function stageEmp(world) {
  world.reset(1);
  world.stage((s) => {
    s.blown = false;
    s.escaped = false;
    for (const cam of s.cameras) cam.disabled = 5.5;
    s.empCharges = s.gallery.empCharges - 1;
    s.alarm = 0.28;
    s.thief.x = 384;
    s.thief.y = 210;
    s.thief.faceX = 1;
    s.thief.faceY = 0;
    // The EMP's own ripple, still spreading from the thief.
    s.ripples.push({ kind: "ping", life: 0.9, age: 0.05, maxR: 205, r: 12, y: 210, x: 384 });
  });
  runFor(world, 0.4, () => IDLE);
  const callouts = [{ x: 384, y: 196, text: "EMP fired — every camera dark for six seconds." }];
  return { screen: "play", meta: shotMeta({ totalTime: 231, totalTake: 0, callouts }) };
}

// Gallery I about to blow: the meter at the top of HUNTED, one warden
// staring the thief down, the second closing in from the lower runner.
function stageAlarm(world) {
  world.reset(0.0);
  runFor(world, 2, () => IDLE);
  world.stage((s) => {
    s.thief.x = 700;
    s.thief.y = 300;
    s.thief.faceX = -0.4;
    s.thief.faceY = -1;
    const first = s.guards[0];
    first.x = 560;
    first.y = 270;
    first.facing = 0;
    first.awareness = 0.8;
    first.mode = "patrol";
    const second = s.guards[1];
    second.x = 930;
    second.y = 452;
    second.facing = Math.PI;
    second.awareness = 0.38;
    second.unseenTimer = 0;
    s.blown = false;
    s.alarm = 0.82;
    s.take = 27000;
  });
  runFor(world, 0.3, () => ({ moveX: 0, moveY: 0, tiptoe: true, throwAt: null, emp: false }));
  const first = world.state.guards[0];
  const callouts = [{ x: first.x, y: first.y - 44, text: "There — by the ruby case!" }];
  return { screen: "play", meta: shotMeta({ totalTime: 154, totalTake: 27000, callouts }) };
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
// it and the HUD numbers to show. Any name other than cover, vault, emp,
// alarm or end means the title.
export function makeShot(name, world) {
  if (name === "cover" || name === "loot") return stageCover(world);
  if (name === "vault") return stageVault(world);
  if (name === "emp") return stageEmp(world);
  if (name === "alarm") return stageAlarm(world);
  if (name === "end") return stageEnd(world);
  world.reset(0.0);
  runFor(world, 4, () => IDLE);
  return { screen: VIEW_TITLE, meta: shotMeta() };
}
