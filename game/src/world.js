// The simulation of one gallery, advanced in fixed slices of time.
// The thief walks or tiptoes between the display cases, lifts a piece
// by standing at it, works the vault's drill by standing at the vault,
// tosses decoy coins to pull wardens off their routes, and burns EMP
// charges to darken the cameras. Every one of those acts feeds the
// single alarm meter — sight, snatches, drill hum, EMP surges — and a
// full meter blows the job, while the van only leaves once the fence's
// quota is in the bag. This file knows nothing of screens or pixels:
// main.js owns the screens, render.js owns the drawing.

import { VISION, THIEF, GUARD, GRAB, FIELD, COIN, CAMERA, ALARM } from "./config.js";
import { GALLERIES } from "./levels.js";
import { turnToward, lineOfSight, buildSegments, angleDifference } from "./vision.js";

export const EVENT_STEP = 1 << 0;
export const EVENT_PING = 1 << 1;
export const EVENT_THROW = 1 << 2;
export const EVENT_GRAB = 1 << 3;
export const EVENT_VAULT = 1 << 4;
export const EVENT_EMP = 1 << 5;
export const EVENT_WARY = 1 << 6;
export const EVENT_BLOWN = 1 << 7;
export const EVENT_ESCAPED = 1 << 8;
export const EVENT_DENIED = 1 << 9;

// Walkers keep this far from the room's edge.
const EDGE = 24;

// How fast a head turns, in radians a second, tracking or sweeping.
const HEAD_TURN = 2.6;

// Does a circle at (x, y) overlap any solid rectangle, grown by radius?
function touchesSolid(solids, x, y, radius) {
  for (const rect of solids) {
    const nearX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const nearY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - nearX;
    const dy = y - nearY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

// Move a circle by (dx, dy), sliding along solids and the room's walls.
function slideMove(solids, x, y, radius, dx, dy) {
  const wantX = Math.max(EDGE + radius, Math.min(FIELD.width - EDGE - radius, x + dx));
  const nx = touchesSolid(solids, wantX, y, radius) ? x : wantX;
  const wantY = Math.max(EDGE + radius, Math.min(FIELD.height - EDGE - radius, y + dy));
  const ny = touchesSolid(solids, nx, wantY, radius) ? y : wantY;
  return { x: nx, y: ny };
}

// Is (x, y) inside a rectangle grown by pad on every side?
function withinPad(x, y, rect, pad) {
  return x > rect.x - pad && x < rect.x + rect.w + pad && y > rect.y - pad && y < rect.y + rect.h + pad;
}

// A warden from its gallery spec. A one-point path makes a sentinel,
// which stands at its post and sweeps its gaze around a home bearing
// aimed away from the vault it watches over.
function buildWarden(gallery, spec, random) {
  const post = spec.path[0];
  const sentinel = spec.path.length === 1;
  const vaultMidX = gallery.vault.x + gallery.vault.w / 2;
  const vaultMidY = gallery.vault.y + gallery.vault.h / 2;
  const home = sentinel
    ? Math.atan2(post[1] - vaultMidY, post[0] - vaultMidX)
    : Math.atan2(spec.path[1][1] - post[1], spec.path[1][0] - post[0]);
  return {
    x: post[0],
    y: post[1],
    facing: home,
    homeFacing: home,
    sentinel,
    path: spec.path,
    speed: spec.speed != null ? spec.speed : GUARD.patrolSpeed,
    pathIndex: sentinel ? 0 : 1,
    mode: "patrol",
    pauseTimer: 0,
    lookTimer: 0,
    target: null,
    awareness: 0,
    unseenTimer: 0,
    seesThief: false,
    sweepSeed: random() * 2 * Math.PI,
    wasWary: false,
  };
}

// A camera from its spec: a base bearing it sweeps around.
function buildCamera(spec, random) {
  return {
    x: spec.x,
    y: spec.y,
    baseFacing: spec.facing,
    facing: spec.facing,
    disabled: 0,
    locksOn: false,
    sweepSeed: random() * 2 * Math.PI,
  };
}

export function createWorld(random) {
  const state = {
    galleryIndex: 0, gallery: GALLERIES[0], time: 0,
    solids: [], segments: [],
    thief: { faceX: 1, faceY: 0, stepTimer: 0, moving: false, tiptoe: false, y: 0, x: 0 },
    guards: [], cameras: [], loot: [], vault: null,
    alarm: 0, take: 0, empCharges: 0, throwCooldown: 0,
    coins: [], ripples: [], grabIndex: -1,
    blown: false, escaped: false, vanHint: 0,
    anyoneSees: false, cameraSees: false,
    stats: { throws: 0, empsUsed: 0, grabs: 0, time: 0 },
  };

  function reset(galleryIndex) {
    state.galleryIndex = galleryIndex;
    state.gallery = GALLERIES[galleryIndex];
    state.solids = state.gallery.cover.concat(state.gallery.vault);
    state.segments = buildSegments(state.solids);
    state.time = 0;
    state.alarm = 0;
    state.take = 0;
    state.vanHint = 0;
    state.empCharges = state.gallery.empCharges;
    state.throwCooldown = 0;
    state.grabIndex = -1;
    state.blown = false;
    state.escaped = false;
    state.anyoneSees = false;
    state.cameraSees = false;
    const start = state.gallery.start;
    state.thief.x = start.x;
    state.thief.y = start.y;
    state.thief.tiptoe = false;
    state.thief.moving = false;
    state.thief.stepTimer = 0;
    state.guards = state.gallery.guards.map((spec) => buildWarden(state.gallery, spec, random));
    state.cameras = state.gallery.cameras.map((spec) => buildCamera(spec, random));
    state.loot = state.gallery.loot.map((spec) => ({ ...spec, progress: 0, taken: false }));
    state.vault = { ...state.gallery.vault, progress: 0, humTimer: 0, cracked: false, drilling: false };
    state.coins = [];
    state.ripples = [];
  }

  // Send every warden within radius of (x, y) to look at that spot —
  // unless one is already staring the thief down.
  function callWardens(x, y, radius) {
    for (const warden of state.guards) {
      if (Math.hypot(x - warden.x, y - warden.y) > radius) continue;
      if (warden.seesThief && warden.awareness > VISION.stareAt) continue;
      warden.mode = "investigate";
      warden.target = { x, y };
      warden.lookTimer = 0;
    }
  }

  function addAlarm(amount) {
    state.alarm = Math.min(1, state.alarm + amount);
  }

  function moveThief(dt, input, events) {
    const t = state.thief;
    t.tiptoe = !!input.tiptoe;
    const len = Math.hypot(input.moveY, input.moveX);
    t.moving = len > 0.01;
    if (t.moving) {
      const speed = t.tiptoe ? THIEF.tiptoeSpeed : THIEF.walkSpeed;
      const norm = Math.max(1, len);
      const stepX = (input.moveX / norm) * speed * dt;
      const stepY = (input.moveY / norm) * speed * dt;
      const landed = slideMove(state.solids, t.x, t.y, THIEF.radius, stepX, stepY);
      t.x = landed.x;
      t.y = landed.y;
      t.faceX = input.moveX / norm;
      t.faceY = input.moveY / norm;
      if (!t.tiptoe) {
        // Walking feet are heard: each step rings a small circle and
        // calls any warden standing inside it.
        t.stepTimer -= dt;
        if (t.stepTimer <= 0) {
          t.stepTimer = THIEF.stepInterval;
          state.ripples.push({ kind: "step", life: 0.55, age: 0, maxR: THIEF.stepNoiseRadius, r: 8, y: t.y, x: t.x });
          callWardens(t.x, t.y, THIEF.stepNoiseRadius);
          events |= EVENT_STEP;
        }
      }
    }
    state.throwCooldown = Math.max(0, state.throwCooldown - dt);
    if (input.throwAt != null && state.throwCooldown <= 0) {
      // A decoy coin, thrown toward the click and clamped to range.
      const dx = input.throwAt.x - t.x;
      const dy = input.throwAt.y - t.y;
      const dist = Math.hypot(dy, dx);
      const reach = dist <= COIN.throwRange ? 1 : COIN.throwRange / dist;
      state.coins.push({ landed: false, t: 0, y: t.y + dy * reach, x: t.x + dx * reach, fromY: t.y, fromX: t.x });
      state.throwCooldown = COIN.cooldown;
      state.stats.throws += 1;
      events |= EVENT_THROW;
    }
    if (input.emp === true && state.empCharges > 0) {
      // The EMP: every camera dark for a few seconds, at a surge.
      state.empCharges -= 1;
      state.stats.empsUsed += 1;
      for (const cam of state.cameras) cam.disabled = CAMERA.disableSeconds;
      addAlarm(ALARM.empBump);
      events |= EVENT_EMP;
    }
    const van = state.gallery.van;
    if (withinPad(t.x, t.y, van, 0)) {
      if (state.take >= state.gallery.quota) {
        state.escaped = true;
        events |= EVENT_ESCAPED;
      } else if (state.vanHint <= 0) {
        state.vanHint = 2.2;
        events |= EVENT_DENIED;
      }
    }
    return events;
  }

  function tendLoot(dt, events) {
    const t = state.thief;
    // Standing still beside an untaken piece starts the lift.
    let active = -1;
    if (!t.moving) {
      for (let i = 0; i < state.loot.length; i += 1) {
        const piece = state.loot[i];
        if (!piece.taken && withinPad(t.x, t.y, piece, GRAB.reach)) { active = i; break; }
      }
    }
    state.grabIndex = active;
    for (let i = 0; i < state.loot.length; i += 1) {
      const piece = state.loot[i];
      if (piece.taken) continue;
      if (i !== active) { piece.progress = 0; continue; }
      piece.progress += dt;
      if (piece.progress >= GRAB.seconds) {
        piece.taken = true;
        state.take += piece.value;
        state.stats.grabs += 1;
        addAlarm(ALARM.grabBump);
        state.ripples.push({ kind: "ping", life: 0.5, age: 0, maxR: 90, r: 8, y: t.y, x: t.x });
        callWardens(t.x, t.y, 90);
        events |= EVENT_GRAB;
      }
    }
    // The vault works the same way, slower and louder: the drill hums
    // once a second, and the hum calls wardens from further away.
    const safe = state.vault;
    // "Drilling" lasts only while the thief stands at the vault working
    // it; progress left behind on a half-cracked vault is not drilling.
    safe.drilling = false;
    if (!safe.cracked) {
      const atSafe = !t.moving && withinPad(t.x, t.y, safe, GRAB.reach);
      safe.drilling = atSafe;
      if (atSafe) {
        safe.progress += dt;
        safe.humTimer += dt;
        addAlarm(ALARM.crackRate * dt);
        if (safe.humTimer >= 1) {
          safe.humTimer = 0;
          const humX = safe.x + safe.w / 2;
          const humY = safe.y + safe.h;
          state.ripples.push({ kind: "ping", life: 0.6, age: 0, maxR: 130, r: 10, y: humY, x: humX });
          callWardens(humX, humY, 130);
        }
        if (safe.progress >= safe.crackSeconds) {
          safe.cracked = true;
          safe.drilling = false;
          state.take += safe.value;
          state.stats.grabs += 1;
          events |= EVENT_VAULT;
        }
      } else {
        safe.progress = Math.max(0, safe.progress - dt * 0.5);
        safe.humTimer = 0;
      }
    }
    return events;
  }

  function advanceCoins(dt, events) {
    for (const coin of state.coins) {
      if (coin.landed) continue;
      coin.t += dt;
      if (coin.t >= COIN.flightSeconds) {
        // The clink lands: a wide ring, and wardens come to look.
        state.ripples.push({ kind: "ping", life: 0.8, age: 0, maxR: COIN.noiseRadius, r: 10, y: coin.y, x: coin.x });
        callWardens(coin.x, coin.y, COIN.noiseRadius);
        coin.landed = true;
        events |= EVENT_PING;
      }
    }
    state.coins = state.coins.filter((coin) => !coin.landed || coin.t < COIN.flightSeconds + 0.8);
    return events;
  }

  // How strongly an eye at (x, y) holds the thief: nothing outside the
  // cone or behind cover, more the closer the thief stands.
  function sightStrength(thief, x, y, facing, range, halfAngle) {
    const dist = Math.hypot(thief.y - y, thief.x - x);
    if (dist > range) return 0;
    const bearing = Math.atan2(thief.y - y, thief.x - x);
    if (Math.abs(angleDifference(facing, bearing)) > halfAngle) return 0;
    if (!lineOfSight(x, y, thief.x, thief.y, state.segments)) return 0;
    const closeness = 1.25 - dist / range;
    return Math.max(0.3, Math.min(1.15, closeness));
  }

  function tendCamera(dt, cam) {
    if (cam.disabled > 0) {
      cam.disabled -= dt;
      cam.locksOn = false;
      return;
    }
    cam.facing = cam.baseFacing + CAMERA.sweepAngle * Math.sin(state.time * CAMERA.sweepSpeed + cam.sweepSeed);
    const strength = sightStrength(state.thief, cam.x, cam.y, cam.facing, CAMERA.range, CAMERA.halfAngle);
    cam.locksOn = strength > 0;
    if (cam.locksOn) {
      state.cameraSees = true;
      addAlarm(dt * ALARM.cameraFill * strength * (state.thief.tiptoe ? 0.6 : 1));
    }
  }

  function tendWarden(dt, warden, events) {
    const t = state.thief;
    const strength = sightStrength(t, warden.x, warden.y, warden.facing, VISION.range, VISION.halfAngle);
    warden.seesThief = strength > 0;
    if (warden.seesThief) {
      warden.unseenTimer = 0;
      state.anyoneSees = true;
      const gain = dt * 0.85 * strength * (t.tiptoe ? 0.5 : 1);
      warden.awareness = Math.min(1, warden.awareness + gain);
      addAlarm(dt * ALARM.guardFill * strength * (t.tiptoe ? 0.5 : 1));
    } else {
      warden.unseenTimer += dt;
      if (warden.unseenTimer > 0.8) warden.awareness = Math.max(0, warden.awareness - dt * 0.3);
    }
    const waryNow = warden.awareness >= VISION.stareAt;
    if (waryNow && !warden.wasWary) events |= EVENT_WARY;
    warden.wasWary = waryNow;

    if (warden.seesThief && waryNow) {
      // Sure enough to stop and stare: the head tracks the thief.
      warden.facing = turnToward(warden.facing, Math.atan2(t.y - warden.y, t.x - warden.x), HEAD_TURN * dt);
      return events;
    }
    if (warden.mode === "investigate" && warden.target !== null) {
      const dx = warden.target.x - warden.x;
      const dy = warden.target.y - warden.y;
      const dist = Math.hypot(dy, dx);
      if (dist > 10 && warden.lookTimer <= 0) {
        warden.facing = turnToward(warden.facing, Math.atan2(dy, dx), HEAD_TURN * dt);
        const moved = slideMove(state.solids, warden.x, warden.y, GUARD.radius, (dx / dist) * GUARD.investigateSpeed * dt, (dy / dist) * GUARD.investigateSpeed * dt);
        const stepped = Math.hypot(moved.y - warden.y, moved.x - warden.x);
        warden.x = moved.x;
        warden.y = moved.y;
        // A coin can land past a case or a wall, where no route leads:
        // if the step barely moved the warden, stop pushing against the
        // obstacle and treat this spot as the arrival — the look-around
        // below then runs, and patrol resumes from here.
        if (stepped < GUARD.investigateSpeed * dt * 0.2) warden.lookTimer = dt;
      } else {
        // Arrived: look around a while, then give up and rejoin the
        // route at its nearest stop.
        warden.lookTimer += dt;
        warden.facing += Math.sin(state.time * 1.7 + warden.sweepSeed) * 1.4 * dt;
        if (warden.lookTimer > 1.6) {
          warden.mode = "patrol";
          warden.target = null;
          warden.lookTimer = 0;
          let nearest = 0;
          let nearestDist = Infinity;
          warden.path.forEach((point, index) => {
            const d = Math.hypot(point[1] - warden.y, point[0] - warden.x);
            if (d < nearestDist) { nearestDist = d; nearest = index; }
          });
          warden.pathIndex = nearest;
        }
      }
      return events;
    }
    if (warden.sentinel) {
      warden.facing = warden.homeFacing + GUARD.sweepAngle * Math.sin(state.time * GUARD.sweepSpeed + warden.sweepSeed);
      return events;
    }
    if (warden.pauseTimer > 0) {
      warden.pauseTimer -= dt;
      return events;
    }
    // Walk the route: turn toward the next stop, step, and on arrival
    // pause a moment before setting off for the one after.
    const stop = warden.path[warden.pathIndex];
    const dx = stop[0] - warden.x;
    const dy = stop[1] - warden.y;
    const dist = Math.hypot(dy, dx);
    if (dist < 6) {
      warden.pathIndex = (warden.pathIndex + 1) % warden.path.length;
      warden.pauseTimer = GUARD.pauseSeconds * (0.85 + 0.3 * random());
      return events;
    }
    warden.facing = turnToward(warden.facing, Math.atan2(dy, dx), HEAD_TURN * dt);
    const moved = slideMove(state.solids, warden.x, warden.y, GUARD.radius, (dx / dist) * warden.speed * dt, (dy / dist) * warden.speed * dt);
    warden.x = moved.x;
    warden.y = moved.y;
    return events;
  }

  function step(dt, input) {
    if (state.blown || state.escaped) return 0;
    let events = 0;
    state.time += dt;
    state.stats.time += dt;
    state.vanHint = Math.max(0, state.vanHint - dt);
    state.anyoneSees = false;
    state.cameraSees = false;
    events = moveThief(dt, input, events);
    events = tendLoot(dt, events);
    events = advanceCoins(dt, events);
    for (const cam of state.cameras) tendCamera(dt, cam);
    for (const warden of state.guards) events = tendWarden(dt, warden, events);
    // The meter cools only while nobody watches and the drill is
    // silent — the drill's hum feeds it, so the two never cancel out.
    // Silence is judged by the drilling flag, not by leftover progress:
    // progress bleeds away slowly after the thief leaves the vault, and
    // it must not hold the meter up once the drilling itself has stopped.
    if (!state.anyoneSees && !state.cameraSees && !state.vault.drilling) {
      state.alarm = Math.max(0, state.alarm - ALARM.decayRate * dt);
    }
    for (const ring of state.ripples) {
      ring.age += dt;
      ring.r = ring.maxR * Math.min(1, ring.age / ring.life);
    }
    state.ripples = state.ripples.filter((ring) => ring.age < ring.life);
    if (state.alarm >= 1 && !state.escaped) {
      state.blown = true;
      events |= EVENT_BLOWN;
    }
    return events;
  }

  // Pose the state directly — the screenshot scenes in shots.js use
  // this to set their frames before playing the rules forward.
  function stage(apply) {
    apply(state);
  }

  reset(0);
  return { state, reset, step, stage };
}
