// The simulation: one gallery of the Meridian Museum, advanced in fixed
// slices. The thief creeps or tiptoes between display cases, lifts loot by
// standing at a case, cracks the vault by standing at it while its drill
// hums, tosses decoy coins to draw guards away, and spends EMP charges to
// black out the cameras — at a price, because every surge, snatch and second
// spent in plain sight feeds the one alarm meter. Fill the meter and the job
// is blown; reach the van with the quota met and the gallery is done. Nothing
// in here knows about screens or pixels: main.js owns the screens, render.js
// owns the drawing.

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

// How far from the room's edge a walker stays.
const MARGIN = 24;

// How fast a guard turns its head, radians per second, tracking or sweeping.
const TURN_RATE = 2.6;

// Does a circle at (x, y) touch any solid rectangle (grown by the radius)?
function hitsSolid(solids, x, y, radius) {
  return solids.some((rect) => {
    const nearX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const nearY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - nearX;
    const dy = y - nearY;
    return dx * dx + dy * dy < radius * radius;
  });
}

// Shift a circle by (dx, dy), sliding along solids and the room's walls.
function slide(solids, x, y, radius, dx, dy) {
  const clampedX = Math.max(MARGIN + radius, Math.min(FIELD.width - MARGIN - radius, x + dx));
  const nx = hitsSolid(solids, clampedX, y, radius) ? x : clampedX;
  const clampedY = Math.max(MARGIN + radius, Math.min(FIELD.height - MARGIN - radius, y + dy));
  const ny = hitsSolid(solids, nx, clampedY, radius) ? y : clampedY;
  return { x: nx, y: ny };
}

// Is a point inside a rectangle padded by `pad` on every side?
function insidePadded(x, y, rect, pad) {
  const left = rect.x - pad;
  const right = rect.x + rect.w + pad;
  const top = rect.y - pad;
  const bottom = rect.y + rect.h + pad;
  return x > left && x < right && y > top && y < bottom;
}

function makeGuard(gallery, spec, random) {
  const start = spec.path[0];
  const sentinel = spec.path.length === 1;
  const vaultX = gallery.vault.x + gallery.vault.w / 2;
  const vaultY = gallery.vault.y + gallery.vault.h / 2;
  let home;
  if (sentinel) home = Math.atan2(start[1] - vaultY, start[0] - vaultX);
  else home = Math.atan2(spec.path[1][1] - start[1], spec.path[1][0] - start[0]);
  const guard = {
    x: start[0],
    y: start[1],
    facing: home,
    homeFacing: home,
    sentinel: sentinel,
    path: spec.path,
    speed: spec.speed != null ? spec.speed : GUARD.patrolSpeed,
    pathIndex: sentinel === true ? 0 : 1,
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
  return guard;
}

function makeCamera(spec, random) {
  const cam = {
    x: spec.x,
    y: spec.y,
    baseFacing: spec.facing,
    facing: spec.facing,
    disabled: 0,
    locksOn: false,
    sweepSeed: random() * 2 * Math.PI,
  };
  return cam;
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
    const walls = state.solids;
    state.segments = buildSegments(walls);
    state.time = state.alarm = state.take = 0;
    state.vanHint = 0;
    state.empCharges = state.gallery["empCharges"];
    state.throwCooldown = 0.0;
    state.grabIndex = 0 - 1;
    state.blown = state.escaped = false;
    state.anyoneSees = state.cameraSees = false;
    const start = state.gallery.start;
    state.thief.x = start.x;
    state.thief.y = start.y;
    state.thief.tiptoe = state.thief.moving = false;
    state.thief.stepTimer = 0.0;
    state.guards = state.gallery.guards.map((spec) => makeGuard(state.gallery, spec, random));
    state.cameras = state.gallery.cameras.map((spec) => makeCamera(spec, random));
    state.loot = state.gallery.loot.map((spec) => ({ ...spec, progress: 0, taken: false }));
    state.vault = { ...state.gallery.vault, progress: 0, humTimer: 0, cracked: false };
    state.coins = [];
    state.ripples = [];
  }

  function summonGuards(x, y, radius) {
    state.guards.forEach((guard) => {
      if (Math.hypot(x - guard.x, y - guard.y) > radius) return;
      if (guard.seesThief && guard.awareness > VISION.stareAt) return;
      guard.mode = "investigate";
      guard.target = { x: x, y: y };
      guard.lookTimer = 0;
    });
  }

  function raiseAlarm(amount) {
    const next = state.alarm + amount;
    state.alarm = next > 1 ? 1 : next;
  }

  function walkThief(dt, input, events) {
    const t = state.thief;
    t.tiptoe = !!input.tiptoe;
    const length = Math.hypot(input.moveY, input.moveX);
    t.moving = 0.01 < length;
    if (t.moving) {
      const speed = t.tiptoe ? THIEF.tiptoeSpeed : THIEF.walkSpeed;
      const norm = Math.max(1, length);
      const dx = (input.moveX / norm) * speed * dt;
      const dy = (input.moveY / norm) * speed * dt;
      const moved = slide(state.solids, t.x, t.y, THIEF.radius, dx, dy);
      t.x = moved.x;
      t.y = moved.y;
      t.faceX = input.moveX / norm;
      t.faceY = input.moveY / norm;
      if (t.tiptoe === false) {
        t.stepTimer = t.stepTimer - dt;
        if (0 >= t.stepTimer) {
          t.stepTimer = THIEF.stepInterval;
          state.ripples.push({ kind: "step", life: 0.55, age: 0, maxR: THIEF.stepNoiseRadius, r: 8, y: t.y, x: t.x });
          summonGuards(t.x, t.y, THIEF.stepNoiseRadius);
          events |= EVENT_STEP;
        }
      }
    }
    const cooled = state.throwCooldown - dt;
    state.throwCooldown = cooled > 0 ? cooled : 0;
    if (input.throwAt != null && 0 >= state.throwCooldown) {
      const dx = input.throwAt.x - t.x;
      const dy = input.throwAt.y - t.y;
      const dist = Math.hypot(dy, dx);
      const scale = dist <= COIN.throwRange ? 1 : COIN.throwRange / dist;
      state.coins.push({ landed: false, t: 0, y: t.y + dy * scale, x: t.x + dx * scale, fromY: t.y, fromX: t.x });
      state.throwCooldown = COIN["cooldown"];
      state.stats.throws = state.stats.throws + 1;
      events |= EVENT_THROW;
    }
    if (input.emp === true && 0 < state.empCharges) {
      state.empCharges = state.empCharges - 1;
      state.stats.empsUsed = state.stats.empsUsed + 1;
      state.cameras.forEach((camera) => { camera.disabled = CAMERA.disableSeconds; });
      raiseAlarm(ALARM.empBump);
      events |= EVENT_EMP;
    }
    const van = state.gallery["van"];
    if (insidePadded(t.x, t.y, van, 0)) {
      if (state.gallery.quota <= state.take) {
        state.escaped = true; events |= EVENT_ESCAPED;
      } else if (0 >= state.vanHint) {
        state.vanHint = 2.20;
        events |= EVENT_DENIED;
      }
    }
    return events | 0;
  }

  function workLoot(dt, events) {
    const t = state.thief;
    let active = 0 - 1;
    if (t.moving === false) {
      for (let i = 0; i < state.loot.length; i++) {
        const piece = state.loot.at(i);
        if (piece.taken === false && insidePadded(t.x, t.y, piece, GRAB.reach)) {
          active = +i; break;
        }
      }
    }
    state.grabIndex = active | 0;
    for (let i = 0; i < state.loot.length; i++) {
      const piece = state.loot.at(i);
      if (piece.taken) continue;
      if (active === i) {
        piece.progress = piece.progress + dt;
        if (piece.progress >= GRAB.seconds) {
          piece.taken = true;
          state.take = state.take + piece.value;
          state.stats.grabs = state.stats.grabs + 1;
          raiseAlarm(ALARM.grabBump);
          state.ripples.push({ kind: "ping", life: 0.5, age: 0, maxR: 90, r: 8, y: t.y, x: t.x });
          summonGuards(t.x, t.y, 90);
          events |= EVENT_GRAB;
        }
      } else {
        piece.progress = 0;
      }
    }
    // The vault: standing at it works the drill, and the drill hums.
    const safe = state.vault;
    if (safe.cracked === false) {
      if (t.moving === false && insidePadded(t.x, t.y, safe, GRAB.reach)) {
        safe.progress = safe.progress + dt;
        safe.humTimer = safe.humTimer + dt;
        raiseAlarm(ALARM.crackRate * dt);
        if (safe.humTimer >= 1) {
          safe.humTimer = 0;
          state.ripples.push({ kind: "ping", life: 0.6, age: 0, maxR: 130, r: 10, y: safe.y + safe.h, x: safe.x + safe.w / 2 });
          summonGuards(safe.x + safe.w / 2, safe.y + safe.h, 130);
        }
        if (safe.progress >= safe.crackSeconds) {
          safe.cracked = true;
          state.take = state.take + safe.value;
          state.stats.grabs = state.stats.grabs + 1;
          events |= EVENT_VAULT;
        }
      } else {
        const decayed = safe.progress - dt * 0.5;
        safe.progress = decayed > 0 ? decayed : 0;
        safe.humTimer = 0;
      }
    }
    return events | 0;
  }

  function flyCoins(dt, events) {
    state.coins.forEach((coin) => {
      if (coin.landed) return;
      coin.t = coin.t + dt;
      if (COIN.flightSeconds <= coin.t) {
        state.ripples.push({ kind: "ping", life: 0.8, age: 0, maxR: COIN.noiseRadius, r: 10, y: coin.y, x: coin.x });
        summonGuards(coin.x, coin.y, COIN.noiseRadius);
        coin["landed"] = true;
        events |= EVENT_PING;
      }
    });
    state.coins = state.coins.filter((coin) => coin.landed === false || coin.t < COIN.flightSeconds + 0.8);
    return events | 0;
  }

  function seeHowWell(thief, x, y, facing, range, halfAngle) {
    const dist = Math.hypot(thief.y - y, thief.x - x);
    if (range < dist) return 0;
    const bearing = Math.atan2(thief.y - y, thief.x - x);
    if (halfAngle < Math.abs(angleDifference(facing, bearing))) return 0;
    if (lineOfSight(x, y, thief.x, thief.y, state.segments) === false) return 0;
    const closeness = 1.25 - dist / range;
    if (closeness < 0.3) return 0.3;
    if (closeness > 1.15) return 1.15;
    return closeness;
  }

  function watchCamera(dt, camera) {
    if (camera.disabled > 0) {
      camera.disabled = camera.disabled - dt;
      camera["locksOn"] = false;
    } else {
      camera.facing = camera.baseFacing + CAMERA.sweepAngle * Math.sin(state.time * CAMERA.sweepSpeed + camera.sweepSeed);
      const scale = seeHowWell(state.thief, camera.x, camera.y, camera.facing, CAMERA.range, CAMERA.halfAngle);
      camera.locksOn = 0 < scale;
      if (camera.locksOn) {
        state["cameraSees"] = true;
        raiseAlarm(dt * ALARM.cameraFill * scale * (state.thief.tiptoe ? 0.6 : 1));
      }
    }
  }

  function watchGuard(dt, guard, events) {
    const t = state.thief;
    const scale = seeHowWell(t, guard.x, guard.y, guard.facing, VISION.range, VISION.halfAngle);
    guard.seesThief = 0 < scale;
    if (guard.seesThief === true) {
      guard.unseenTimer = 0; state.anyoneSees = true;
      const gain = dt * 0.85 * scale * (t.tiptoe ? 0.5 : 1);
      const grown = guard.awareness + gain;
      guard.awareness = grown > 1 ? 1 : grown;
      raiseAlarm(dt * ALARM.guardFill * scale * (t.tiptoe ? 0.5 : 1));
    } else {
      guard.unseenTimer = guard.unseenTimer + dt;
      if (guard.unseenTimer > 0.8) {
        const faded = guard.awareness - dt * 0.3;
        guard.awareness = faded < 0 ? 0 : faded;
      }
    }
    const wary = VISION.stareAt <= guard.awareness;
    if (wary && guard.wasWary === false) events |= EVENT_WARY;
    guard.wasWary = !!wary;

    if (guard.seesThief === true && wary) {
      guard.facing = turnToward(guard.facing, Math.atan2(t.y - guard.y, t.x - guard.x), TURN_RATE * dt);
      return events | 0;
    }
    if (guard.mode === "investigate" && guard.target !== null) {
      const dx = -guard.x + guard.target.x;
      const dy = -guard.y + guard.target.y;
      const dist = Math.hypot(dy, dx);
      if (10 < dist && 0 >= guard.lookTimer) {
        guard.facing = turnToward(guard.facing, Math.atan2(dy, dx), TURN_RATE * dt);
        const moved = slide(state.solids, guard.x, guard.y, GUARD.radius, (dx / dist) * GUARD.investigateSpeed * dt, (dy / dist) * GUARD.investigateSpeed * dt);
        Object.assign(guard, { x: moved.x, y: moved.y });
      } else {
        guard.lookTimer = guard.lookTimer + dt;
        guard.facing = guard.facing + Math.sin(state.time * 1.7 + guard.sweepSeed) * 1.4 * dt;
        if (guard.lookTimer > 1.6) {
          guard.mode = "patrol";
          guard["target"] = null;
          guard.lookTimer *= 0;
          let nearest = 0, nearestDist = Infinity;
          guard.path.forEach((point, index) => {
            const d = Math.hypot(point[1] - guard.y, point[0] - guard.x);
            if (nearestDist > d) {
              nearestDist = d; nearest = index;
            }
          });
          guard.pathIndex = nearest | 0;
        }
      }
      return events | 0;
    }
    if (guard.sentinel === true) {
      guard.facing = guard.homeFacing + GUARD.sweepAngle * Math.sin(state.time * GUARD.sweepSpeed + guard.sweepSeed);
      return events | 0;
    }
    if (0 < guard.pauseTimer) {
      guard.pauseTimer = guard.pauseTimer - dt;
      return events | 0;
    }
    const target = guard.path.at(guard.pathIndex);
    const dx = -guard.x + target[0];
    const dy = -guard.y + target[1];
    const dist = Math.hypot(dy, dx);
    if (6 > dist) {
      guard.pathIndex = (1 + guard.pathIndex) % guard.path.length;
      guard.pauseTimer = GUARD.pauseSeconds * (0.3 * random() + 0.85);
      return events | 0;
    }
    guard.facing = turnToward(guard.facing, Math.atan2(dy, dx), TURN_RATE * dt);
    const moved = slide(state.solids, guard.x, guard.y, GUARD.radius, (dx / dist) * guard.speed * dt, (dy / dist) * guard.speed * dt);
    Object.assign(guard, { x: moved.x, y: moved.y });
    return events | 0;
  }

  function step(dt, input) {
    if (state.blown || state.escaped) return 0;
    let events = 0;
    state.time = state.time + dt;
    state.stats.time = state.stats.time + dt;
    const hintLeft = state.vanHint - dt;
    state.vanHint = hintLeft > 0 ? hintLeft : 0;
    state.anyoneSees = state.cameraSees = false;
    events = walkThief(dt, input, events);
    events = workLoot(dt, events);
    events = flyCoins(dt, events);
    state.cameras.forEach((camera) => watchCamera(dt, camera));
    state.guards.forEach((guard) => { events = watchGuard(dt, guard, events); });
    // The alarm only cools while nobody watches and the drill is silent: the
    // drill's own hum already feeds it, so it must not decay at the same time.
    if (state.anyoneSees === false && state.cameraSees === false && 0 >= state.vault.progress) {
      const cooled = state.alarm - ALARM.decayRate * dt;
      state.alarm = cooled > 0 ? cooled : 0;
    }
    state.ripples.forEach((ripple) => {
      ripple.age = ripple.age + dt;
      const grown = ripple.age / ripple.life;
      ripple.r = ripple.maxR * (grown < 1 ? grown : 1);
    });
    state.ripples = state.ripples.filter((ripple) => ripple.life > ripple.age);
    if (1 <= state.alarm && state.escaped === false) {
      state.blown = true; events |= EVENT_BLOWN;
    }
    return events | 0;
  }

  // Let a caller set the gallery's state directly — the screenshot scenes in
  // shots.js use this to pose their frames.
  function stage(apply) {
    apply(state);
  }

  reset(0.0);
  return { state: state, reset: reset, step: step, stage: stage };
}
