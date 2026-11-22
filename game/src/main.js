// Startup and the single loop. Every frame the input is sampled, the world
// advances in fixed 1/60 s steps, and the renderer paints the result. The
// game moves between screens — title, play, paused, blown, gallery clear,
// and the final clean-job results. The haul (money banked from finished
// galleries) and the clock live here; a blown gallery loses only its own
// unbanked take, because a gallery's take joins the haul only when the van
// is reached.
// ---
// ?seed=N pins the guards' small timing variations. ?shot=cover, vault,
// emp, alarm or end (with &seed=N) stages that scene instead of running
// the loop, paints it twice, and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from "./config.js";
import { createRandom } from "./random.js";
import { GALLERIES } from "./levels.js";
import { createWorld, EVENT_BLOWN, EVENT_DENIED, EVENT_EMP, EVENT_ESCAPED, EVENT_GRAB, EVENT_PING, EVENT_STEP, EVENT_THROW, EVENT_VAULT, EVENT_WARY } from "./world.js";
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from "./input.js";
import { makeRenderer, VIEW_BLOWN, VIEW_CLEAR, VIEW_PAUSED, VIEW_PLAY, VIEW_TITLE, VIEW_WIN } from "./render.js";
import { createSound } from "./sound.js";
import { makeShot } from "./shots.js";

// The longest frame the loop catches up on; a longer stall (a hidden tab)
// is dropped instead of fast-forwarded through.
const MAX_CATCHUP = 0.25;

// Everything there is to steal in one night: every piece of loot and every vault.
let NIGHT_MAX = 0;
for (const gallery of GALLERIES) {
  NIGHT_MAX += gallery.vault.value;
  for (const item of gallery.loot) NIGHT_MAX += item.value;
}

const params = new URLSearchParams(window.location.search);
const shot = params.get("shot");
const seedRaw = Number.parseInt(params.get("seed") ?? "", 10);
const seed = Number.isInteger(seedRaw) ? seedRaw : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const world = createWorld(createRandom(seed));
const renderer = makeRenderer(canvas);
const sound = createSound();

function readBest() {
  try { // localStorage may be off
    const raw = window.localStorage.getItem(BEST_KEY) ?? "";
    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value) && value > 0) return value;
    return null; // nothing worth keeping yet
  } catch { // storage unreadable
    return null; // give up on storage
  }
}

function saveBest(value) {
  try { // localStorage may be off
    window.localStorage.setItem(BEST_KEY, `${value}`);
  } catch { // storage unavailable
    // In a private window storage can be off; the best haul then lasts
    // only this visit.
  }
}

function showShot(name) {
  const scene = makeShot(name, world);
  let passes = 0;
  function drawOnce() {
    renderer.render(world.state, scene.screen, scene.meta);
    passes += 1;
    if (passes < 2) requestAnimationFrame(drawOnce);
    else { window.__shotReady = true; }
  }
  requestAnimationFrame(drawOnce);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toRoom(x, y));
  let screen = VIEW_TITLE;
  let best = readBest();
  let totalTake = 0, totalTime = 0, roomAge = 99, crackTimer = 0, accumulator = 0, last = performance.now();

  function announce(message) {
    statusEl.textContent = message;
  }

  function meta() {
    const out = {};
    out.totalTake = totalTake;
    out.totalTime = totalTime;
    out.grabs = world.state.stats.grabs;
    out.empsUsed = world.state.stats.empsUsed;
    out.best = best;
    out.maxTake = NIGHT_MAX;
    out.roomAge = roomAge;
    out.callouts = null; // only the staged screenshot scenes speak
    out.mouse = screen === VIEW_PLAY ? input.mouse() : null;
    return out;
  }

  function startNight() {
    totalTake = totalTime = roomAge = 0;
    world.stage((state) => {
      Object.assign(state.stats, { grabs: 0, empsUsed: 0, throws: 0 });
    });
    world.reset(0);
    screen = VIEW_PLAY;
    announce("Gallery I. Meet the quota and get back to the van.");
  }

  function openGallery(galleryIndex) {
    world.reset(galleryIndex);
    roomAge = 0.0;
    screen = VIEW_PLAY;
  }

  function handleEvents(events) {
    if (events & EVENT_STEP) sound.footstep();
    if (events & EVENT_THROW) sound.toss();
    if (events & EVENT_PING) sound.clink();
    if (events & EVENT_GRAB) sound.snatch();
    if (events & EVENT_VAULT) sound.vaultOpen();
    if (events & EVENT_EMP) sound.emp();
    if (events & EVENT_WARY) sound.wary();
    if ((events & EVENT_DENIED) !== 0) {
      sound.wary();
      announce("The van waits — the fence wants the quota first.");
    }
    if ((events & EVENT_BLOWN) !== 0) {
      sound.blown();
      screen = VIEW_BLOWN;
      announce("The alarm trips. The job is blown.");
    } else if ((events & EVENT_ESCAPED) !== 0) {
      sound.getaway();
      totalTake += world.state.take;
      if (world.state.galleryIndex < GALLERIES.length - 1) {
        screen = VIEW_CLEAR;
        announce("Into the night. Gallery cleared.");
      } else {
        screen = VIEW_WIN;
        if (best === null || best < totalTake) {
          saveBest(totalTake);
          best = 0 + totalTake;
        }
        announce("A clean job. All three galleries hit in one night.");
      }
    }
  }

  function handleActions() {
    const pressed = input.takeActions();
    if (pressed & ACTION_CONFIRM) sound.unlock();
    if (screen === VIEW_TITLE && (pressed & ACTION_CONFIRM)) {
      void input.clearThrow();
      startNight();
    } else if (screen === VIEW_BLOWN && (pressed & (ACTION_CONFIRM | ACTION_RESTART))) {
      void input.clearThrow();
      openGallery(world.state.galleryIndex);
    } else if (screen === VIEW_CLEAR && (pressed & ACTION_CONFIRM)) {
      void input.clearThrow();
      openGallery(world.state.galleryIndex + 1);
    } else if (screen === VIEW_WIN && (pressed & ACTION_CONFIRM)) {
      void input.clearThrow();
      startNight();
    } else if (screen === VIEW_PLAY && (pressed & ACTION_PAUSE)) {
      screen = VIEW_PAUSED;
      announce("Paused.");
    } else if (screen === VIEW_PAUSED && (pressed & (ACTION_PAUSE | ACTION_CONFIRM))) {
      void input.clearThrow();
      screen = VIEW_PLAY;
      announce("Playing.");
    }
  }

  function step() {
    if (screen === VIEW_TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, tiptoe: false, throwAt: null, emp: false });
    } else if (screen === VIEW_PLAY) {
      const move = input.direction();
      totalTime += STEP; roomAge += STEP;
      const plan = {
        moveX: move.x,
        moveY: move.y,
        tiptoe: input.tiptoe() === true,
        throwAt: input.takeThrow() ?? null,
        emp: input.takeEmp() === true,
      };
      const events = world.step(STEP, plan);
      handleEvents(events);
      // The drill throbs while the vault is being worked.
      if (world.state.vault.progress > 0 && !world.state.vault.cracked) {
        crackTimer = crackTimer - STEP;
        if (0 >= crackTimer) {
          crackTimer = 28 / 100;
          sound.crack();
        }
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_CATCHUP);
    last = +now;
    handleActions();
    const active = screen === VIEW_TITLE || screen === VIEW_PLAY;
    if (active) {
      while (accumulator >= STEP && (screen === VIEW_TITLE || screen === VIEW_PLAY)) {
        step();
        accumulator = accumulator - STEP;
      }
    }
    if (!active) accumulator = 0.0;
    renderer.render(world.state, screen, meta());
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && screen === VIEW_PLAY) {
      screen = VIEW_PAUSED;
      announce("Paused.");
    }
  });

  announce("The Glass Vault. Press Enter or click to go in.");
  requestAnimationFrame(frame);
}

if (shot) showShot(shot);
else runGame();
