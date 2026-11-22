// What the player sees, painted on one canvas in room coordinates
// (1280 by 720, stretched to fit the window). The order is the picture:
// marble-green floor and red carpets, the getaway van, the vault, cover,
// the loot in glass cases and gilt frames, footstep ripples, the warm cones
// of the guards and the red sweeps of the cameras, then the guards, the
// cameras and the thief, then the HUD — take, quota, EMP charges and the
// single ALARM meter — and whichever screen is up: title, paused, blown,
// gallery clear, or a clean job.

import { CAMERA, COIN, FIELD, GRAB, PALETTE, VISION } from "./config.js";
import { conePolygon } from "./vision.js";
import { hash01 } from "./random.js";

export const VIEW_TITLE = "title";
export const VIEW_PLAY = "play";
export const VIEW_PAUSED = "paused";
export const VIEW_BLOWN = "blown";
export const VIEW_CLEAR = "clear";
export const VIEW_WIN = "win";

function fmtClock(seconds) {
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total - mins * 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function fmtMoney(value) {
  return "$" + value.toLocaleString("en-US");
}

export function makeRenderer(canvas) {
  const c = canvas.getContext("2d");
  let scale = 1, shiftX = 0, shiftY = 0;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    const rw = Math.round(w);
    const rh = Math.round(h);
    if (canvas.width !== rw || canvas.height !== rh) {
      canvas.width = rw;
      canvas.height = rh;
    }
    const sx = canvas.width / FIELD.width;
    const sy = canvas.height / FIELD.height;
    scale = sx < sy ? sx : sy;
    shiftX = (canvas.width - scale * FIELD.width) / 2;
    shiftY = (canvas.height - scale * FIELD.height) / 2;
  }

  // Window coordinates become room coordinates.
  function toRoom(clientX, clientY) {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = (clientX - box.left) * dpr;
    const py = (clientY - box.top) * dpr;
    return { x: (px - shiftX) / scale, y: (py - shiftY) / scale };
  }

  function floor(state) {
    c.fillStyle = PALETTE.floor;
    c.fillRect(0, 0, FIELD.width, FIELD.height);
    c.fillStyle = PALETTE.floorAlt;
    const step = 64;
    for (let row = 0; row * step < FIELD.height; row++) {
      for (let col = 0; col * step < FIELD.width; col++) {
        if ((row + col) % 2 === 0) c.fillRect(col * step, row * step, step, step);
      }
    }
    for (const rug of state.gallery.carpets) {
      c.fillStyle = PALETTE.carpet;
      c.fillRect(rug.x, rug.y, rug.w, rug.h);
      c.strokeStyle = PALETTE.carpetEdge;
      c.lineWidth = 2.5;
      c.strokeRect(rug.x + 6, rug.y + 6, rug.w - 12, rug.h - 12);
    }
    c.strokeStyle = PALETTE.pillarEdge;
    c.lineWidth = 6;
    c.strokeRect(12, 12, FIELD.width - 24, FIELD.height - 24);
    c.strokeStyle = "#39423e";
    c.lineWidth = 14;
    c.strokeRect(5, 5, FIELD.width - 10, FIELD.height - 10);
  }

  function van(state) {
    const v = state.gallery.van;
    const ready = state.gallery.quota <= state.take;
    c.fillStyle = "rgba(0, 0, 0, 0.4)";
    c.fillRect(v.x - 3, v.y + 6, v.w, v.h);
    c.fillStyle = ready ? "#2c4638" : "#22262b";
    c.fillRect(v.x, v.y, v.w, v.h);
    c.fillStyle = "#3d454f";
    c.fillRect(v.x, v.y, v.w, 16);
    c.fillStyle = "#9fc6d8";
    c.fillRect(v.x + v.w - 14, v.y + 20, 8, v.h - 40);
    c.fillStyle = "#101216";
    c.beginPath();
    c.arc(v.x + 14, v.y + 12, 8, 0, 2 * Math.PI);
    c.arc(v.x + 14, v.y + v.h - 12, 8, 0, 2 * Math.PI);
    c.fill();
    if (ready === true) {
      c.save();
      c.shadowColor = PALETTE.gold;
      c.shadowBlur = 16;
      c.fillStyle = PALETTE.gold;
      c.fillRect(v.x + v.w - 5, v.y + 8, 4, 10);
      c.fillRect(v.x + v.w - 5, v.y + v.h - 18, 4, 10);
      c.restore();
    }
    c.save();
    c.translate(v.x + v.w / 2, v.y + v.h / 2);
    c.rotate(-Math.PI / 2);
    c.fillStyle = ready ? PALETTE.gold : PALETTE.muted;
    c.font = "700 13px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText("GETAWAY", 0, 5);
    c.restore();
    if (0 < state.vanHint) {
      const gap = state.gallery.quota - state.take;
      c.fillStyle = PALETTE.panel;
      const label = `The fence wants ${fmtMoney(state.gallery.quota)} — ${fmtMoney(gap)} short`;
      c.font = "600 14px system-ui, sans-serif";
      const width = c.measureText(label).width + 18;
      c.fillRect(v.x + v.w + 8, v.y + v.h / 2 - 14, width, 28);
      c.fillStyle = PALETTE.danger;
      c.textAlign = "left";
      c.fillText(label, v.x + v.w + 17, v.y + v.h / 2 + 5);
    }
  }

  function vault(state) {
    const safe = state.vault;
    c.save();
    if (safe.cracked) {
      c.shadowColor = PALETTE.gold;
      c.shadowBlur = 24;
    }
    c.fillStyle = PALETTE.vault;
    c.fillRect(safe.x, safe.y, safe.w, safe.h);
    c.restore();
    c.strokeStyle = PALETTE.vaultEdge;
    c.lineWidth = 3;
    c.strokeRect(safe.x + 2, safe.y + 2, safe.w - 4, safe.h - 4);
    const cx = safe.x + safe.w * 0.5;
    const cy = safe.y + safe.h * 0.5;
    if (safe.cracked) {
      c.fillStyle = PALETTE.gold;
      c.fillRect(safe.x + 8, safe.y + 8, safe.w - 16, safe.h - 16);
      c.fillStyle = "#7a5a10";
      c.font = "700 13px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("OPEN — EMPTIED", cx, cy + 5);
    } else {
      c.strokeStyle = PALETTE.vaultEdge;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(cx, cy, 15, 0, 2 * Math.PI);
      c.stroke();
      const spin = safe.progress * 2.4;
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * 2 * Math.PI) / 3;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15);
        c.stroke();
      }
      c.fillStyle = "#dfe5ea";
      c.font = "700 12px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(`${safe.name} · ${fmtMoney(safe.value)}`, cx, safe.y + safe.h + 15);
      if (0 < safe.progress) {
        const w = safe.w * 0.8;
        c.fillStyle = "rgba(255, 255, 255, 0.18)";
        c.fillRect(cx - w / 2, safe.y + safe.h + 20, w, 6);
        c.fillStyle = PALETTE.gold;
        c.fillRect(cx - w / 2, safe.y + safe.h + 20, (w * safe.progress) / safe.crackSeconds, 6);
      }
    }
  }

  function cover(state) {
    for (const piece of state.gallery.cover) {
      if (piece.kind === "case") continue; // A case is painted together with the loot inside it.
      if (piece.kind === "pillar") {
        c.fillStyle = PALETTE.pillar;
        c.fillRect(piece.x, piece.y, piece.w, piece.h);
        c.strokeStyle = PALETTE.pillarEdge;
        c.lineWidth = 3;
        c.strokeRect(piece.x + 2, piece.y + 2, piece.w - 4, piece.h - 4);
        c.fillStyle = PALETTE.pillarEdge;
        c.fillRect(piece.x + 4, piece.y + 7, piece.w - 8, 3);
        c.fillRect(piece.x + 4, piece.y + piece.h - 10, piece.w - 8, 3);
      } else if (piece.kind === "cabinet") {
        c.fillStyle = PALETTE.cabinet;
        c.fillRect(piece.x, piece.y, piece.w, piece.h);
        c.strokeStyle = PALETTE.cabinetEdge;
        c.lineWidth = 2.5;
        c.strokeRect(piece.x + 1.5, piece.y + 1.5, piece.w - 3, piece.h - 3);
        c.beginPath();
        c.moveTo(piece.x + piece.w / 2, piece.y + 6);
        c.lineTo(piece.x + piece.w / 2, piece.y + piece.h - 6);
        c.stroke();
      } else {
        c.fillStyle = PALETTE.wall;
        c.fillRect(piece.x, piece.y, piece.w, piece.h);
        c.strokeStyle = PALETTE.wallEdge;
        c.lineWidth = 2.5;
        c.strokeRect(piece.x + 1.5, piece.y + 1.5, piece.w - 3, piece.h - 3);
      }
    }
  }

  function loot(item, index) {
    if (item.kind === "painting") {
      // Paintings hang on the partitions in gilt frames, the canvas a small
      // dusk gradient with a low horizon.
      c.fillStyle = PALETTE.gold;
      c.fillRect(item.x - 3, item.y + 18, item.w + 6, 64);
      if (item.taken === false) {
        const grad = c.createLinearGradient(0, item.y + 22, 0, item.y + 78);
        grad.addColorStop(0, "#7a4a63");
        grad.addColorStop(0.6, PALETTE.paintingInk); // dusk
        grad.addColorStop(1, "#1d2836");
        c.fillStyle = grad;
        c.fillRect(item.x, item.y + 22, item.w, 56);
        c.fillStyle = "rgba(255, 220, 150, 0.75)";
        c.beginPath();
        c.arc(item.x + item.w / 2, item.y + 40 + hash01(index, 5) * 8, 5, 0, 2 * Math.PI);
        c.fill();
      } else {
        c.fillStyle = "#565048";
        c.fillRect(item.x, item.y + 22, item.w, 56);
      }
    } else {
      c.fillStyle = PALETTE.caseGlass;
      c.fillRect(item.x, item.y, item.w, item.h);
      c.strokeStyle = PALETTE.caseFrame;
      c.lineWidth = 3;
      c.strokeRect(item.x + 1.5, item.y + 1.5, item.w - 3, item.h - 3);
      const cx = item.x + item.w * 0.5;
      const cy = item.y + item.h * 0.5;
      if (item.taken === false) {
        c.save();
        c.shadowColor = PALETTE.gold;
        c.shadowBlur = 12;
        c.fillStyle = PALETTE.gold;
        const gem = Math.floor(hash01(index, 11) * 3);
        if (gem < 1) {
          c.beginPath();
          c.moveTo(cx, cy - 11);
          c.lineTo(cx + 9, cy);
          c.lineTo(cx, cy + 11);
          c.lineTo(cx - 9, cy);
          c.closePath();
          c.fill();
        } else if (gem < 2) {
          c.beginPath();
          c.arc(cx, cy, 9, 0, 2 * Math.PI);
          c.fill();
        } else {
          c.fillRect(cx - 9, cy - 6, 18, 12);
        }
        c.restore();
      } else {
        c.fillStyle = "rgba(230, 240, 250, 0.35)";
        c.font = "600 10px system-ui, sans-serif";
        c.textAlign = "center";
        c.fillText("TAKEN", cx, cy + 3);
      }
    }
    if (item.taken === false) {
      c.fillStyle = "rgba(238, 241, 245, 0.92)";
      c.font = "600 11.5px system-ui, sans-serif";
      c.textAlign = "center";
      const labelY = item.kind === "painting" ? item.y + 100 : item.y + item.h + 15;
      c.fillText(`${item.name} · ${fmtMoney(item.value)}`, item.x + item.w / 2, labelY);
      if (0 < item.progress) {
        const bar = 54;
        const x = item.x + item.w / 2 - bar / 2;
        const y = 6 + labelY;
        c.fillStyle = "rgba(255, 255, 255, 0.18)";
        c.fillRect(x, y, bar, 5);
        c.fillStyle = PALETTE.gold;
        c.fillRect(x, y, (bar * item.progress) / GRAB.seconds, 5);
      }
    }
  }

  function ripples(state) {
    state.ripples.forEach((ripple) => {
      const fade = 1.0 - ripple.age / ripple.life;
      c.strokeStyle = ripple.kind === "ping"
        ? `rgba(255, 220, 130, ${fade * 0.55})`
        : `rgba(165, 185, 225, ${fade * 0.38})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(ripple.x, ripple.y, ripple.r, 0, 2 * Math.PI);
      c.stroke();
    });
  }

  function coins(state) {
    state.coins.forEach((coin) => {
      if (coin.landed === false) {
        const p = Math.min(coin.t / COIN.flightSeconds, 1);
        const x = (coin.x - coin.fromX) * p + coin.fromX;
        const y = (coin.y - coin.fromY) * p + coin.fromY - 38 * Math.sin(p * Math.PI);
        c.fillStyle = PALETTE.gold;
        c.beginPath();
        c.arc(x, y, 6, 0, 2 * Math.PI);
        c.fill();
      } else {
        c.fillStyle = PALETTE.gold;
        c.beginPath();
        c.arc(coin.x, coin.y, 5, 0, 2 * Math.PI);
        c.fill();
        c.fillStyle = "#7a5a10";
        c.font = "700 8px system-ui, sans-serif";
        c.textAlign = "center";
        c.fillText("$", coin.x, coin.y + 3);
      }
    });
  }

  function cones(state) {
    for (const g of state.guards) {
      const tone = g.awareness < VISION.stareAt ? PALETTE.coneGuard : PALETTE.coneGuardWary;
      const shape = conePolygon(g.x, g.y, g.facing, VISION.range, VISION.halfAngle, state.segments);
      c.beginPath();
      shape.forEach((pt, i) => (i === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y)));
      c.closePath();
      c.fillStyle = `rgba(${tone}, 0.14)`;
      c.fill();
      c.strokeStyle = `rgba(${tone}, 0.26)`;
      c.lineWidth = 1.5;
      c.stroke();
    }
    for (const cam of state.cameras) {
      if (cam.disabled > 0) continue;
      const shape = conePolygon(cam.x, cam.y, cam.facing, CAMERA.range, CAMERA.halfAngle, state.segments);
      c.beginPath();
      shape.forEach((pt, i) => (i === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y)));
      c.closePath();
      c.fillStyle = `rgba(${PALETTE.coneCamera}, ${cam.locksOn ? 0.22 : 0.12})`;
      c.fill();
      c.strokeStyle = `rgba(${PALETTE.coneCamera}, 0.3)`;
      c.lineWidth = 1.5;
      c.stroke();
    }
  }

  function guard(g) {
    c.fillStyle = "rgba(0, 0, 0, 0.35)";
    c.beginPath();
    c.ellipse(g.x, g.y + 12, 15, 6, 0, 0, 2 * Math.PI);
    c.fill();
    c.fillStyle = PALETTE.guard;
    c.beginPath();
    c.arc(g.x, g.y, 14, 0, 2 * Math.PI);
    c.fill();
    c.fillStyle = PALETTE.guardCap;
    c.beginPath();
    c.arc(g.x, g.y, 14, g.facing + Math.PI * 0.65, g.facing + Math.PI * 2.35);
    c.lineTo(g.x, g.y);
    c.closePath();
    c.fill();
    c.fillStyle = "#2c3138";
    c.beginPath();
    c.arc(g.x + Math.cos(g.facing) * 5, g.y + Math.sin(g.facing) * 5, 3.2, 0, 2 * Math.PI);
    c.fill();
    if (g.awareness >= VISION.stareAt) {
      const mark = g.seesThief && g.awareness > 0.55 ? "!" : "?";
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(g.x + 14, g.y - 20, 10, 0, 2 * Math.PI);
      c.fill();
      c.fillStyle = mark === "!" ? PALETTE.danger : "#c77f1a";
      c.font = "700 14px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(mark, g.x + 14, g.y - 15);
    }
  }

  function camera(state, cam) {
    c.save();
    c.translate(cam.x, cam.y);
    c.fillStyle = "rgba(0, 0, 0, 0.4)";
    c.beginPath();
    c.arc(0, 0, 11, 0, 2 * Math.PI);
    c.fill();
    c.rotate(cam.facing);
    c.fillStyle = cam.disabled > 0 ? "#4a4f57" : "#22262e";
    c.fillRect(-8, -6, 17, 12);
    c.fillStyle = cam.disabled > 0 ? "#666c75" : "#9fc6d8";
    c.beginPath();
    c.arc(10, 0, 3.6, 0, 2 * Math.PI);
    c.fill();
    c.restore();
    // The little LED tells the story: blinking red on a lock, dim red while
    // watching, dark once the camera is fried.
    let led = "#5e2a28";
    if (cam.disabled > 0) led = "#33373d";
    else if (cam.locksOn) led = Math.sin(state.time * 16) > 0 ? "#ff3b30" : "#7a1610";
    else led = "#c22e28";
    c.fillStyle = led;
    c.beginPath();
    c.arc(cam.x, cam.y - 13, 3, 0, 2 * Math.PI);
    c.fill();
    if (cam.disabled > 0) {
      c.fillStyle = PALETTE.muted;
      c.font = "600 9.5px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("OFFLINE", cam.x, cam.y + 24);
    }
  }

  function thief(state) {
    const t = state.thief;
    c.fillStyle = "rgba(0, 0, 0, 0.4)";
    c.beginPath();
    c.ellipse(t.x, t.y + 11, 13, 5.5, 0, 0, 2 * Math.PI);
    c.fill();
    if (t.tiptoe) {
      c.strokeStyle = "rgba(232, 182, 76, 0.45)";
      c.setLineDash([4, 5]);
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(t.x, t.y, 19, 0, 2 * Math.PI);
      c.stroke();
      c.setLineDash([]);
    }
    c.fillStyle = PALETTE.thief;
    c.beginPath();
    c.arc(t.x, t.y, 13, 0, 2 * Math.PI);
    c.fill();
    c.strokeStyle = PALETTE.thiefTrim;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(t.x, t.y, 11, 0, 2 * Math.PI);
    c.stroke();
    const facing = Math.atan2(t.faceY, t.faceX);
    c.fillStyle = "#e8dcc3";
    c.beginPath();
    c.arc(t.x + Math.cos(facing) * 5, t.y + Math.sin(facing) * 5, 3.4, 0, 2 * Math.PI);
    c.fill();
    // While a lift is in progress, a gold ring around the thief fills up.
    if (state.grabIndex > -1) {
      const piece = state.loot[state.grabIndex];
      c.strokeStyle = PALETTE.gold;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(t.x, t.y, 18, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (piece.progress / GRAB.seconds));
      c.stroke();
    }
  }

  function hud(state, meta) {
    c.fillStyle = PALETTE.panel;
    c.fillRect(0, 0, FIELD.width, 40);
    c.fillStyle = PALETTE.text;
    c.font = "600 16px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText(state.gallery.name, 16, 26);
    // One bar carries the whole job's ALARM.
    const barW = 280;
    const barX = (FIELD.width - barW) / 2;
    c.fillStyle = PALETTE.muted;
    c.font = "600 12px system-ui, sans-serif";
    c.textAlign = "right";
    c.fillText("ALARM", barX - 10, 26);
    c.fillStyle = "rgba(255, 255, 255, 0.14)";
    c.fillRect(barX, 14, barW, 13);
    const watched = state.cameraSees || state.anyoneSees;
    c.fillStyle = state.alarm >= 0.75 ? PALETTE.danger : state.alarm >= 0.4 ? "#ffb84d" : "#7bc47f";
    if (watched && Math.sin(state.time * 14) > 0) c.fillStyle = PALETTE.danger;
    c.fillRect(barX, 14, barW * state.alarm, 13);
    c.strokeStyle = "rgba(255, 255, 255, 0.35)";
    c.lineWidth = 1;
    c.strokeRect(barX, 14, barW, 13);
    // Take, quota, EMP charges and the clock, on the right.
    c.font = "600 15px system-ui, sans-serif";
    c.textAlign = "right";
    const quotaMet = state.gallery.quota <= state.take;
    c.fillStyle = quotaMet ? PALETTE.good : PALETTE.text;
    const right = `TAKE ${fmtMoney(state.take)} / ${fmtMoney(state.gallery.quota)}   ·   EMP ×${state.empCharges}   ·   ${fmtClock(meta.totalTime)}`;
    c.fillText(right, FIELD.width - 16, 26);
    // The gallery's objective, bottom left.
    c.font = "400 14px system-ui, sans-serif";
    c.textAlign = "left";
    const width = c.measureText(state.gallery.intro).width + 20;
    c.fillStyle = PALETTE.panel;
    c.fillRect(10, FIELD.height - 34, width, 24);
    c.fillStyle = PALETTE.muted;
    c.fillText(state.gallery.intro, 20, FIELD.height - 17);
    // The controls reminder, bottom right.
    const hint = "WASD move · Shift tiptoe · Stand at loot to lift it · Click coin · E EMP";
    const hintWidth = c.measureText(hint).width + 20;
    c.fillStyle = PALETTE.panel;
    c.fillRect(FIELD.width - hintWidth - 10, FIELD.height - 34, hintWidth, 24);
    c.fillStyle = PALETTE.muted;
    c.fillText(hint, FIELD.width - hintWidth, FIELD.height - 17);
    if (meta.mouse != null) {
      c.strokeStyle = "rgba(232, 182, 76, 0.6)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(meta.mouse.x, meta.mouse.y, 8, 0, 2 * Math.PI);
      c.moveTo(meta.mouse.x - 13, meta.mouse.y);
      c.lineTo(meta.mouse.x - 4, meta.mouse.y);
      c.moveTo(meta.mouse.x + 4, meta.mouse.y);
      c.lineTo(meta.mouse.x + 13, meta.mouse.y);
      c.moveTo(meta.mouse.x, meta.mouse.y - 13);
      c.lineTo(meta.mouse.x, meta.mouse.y - 4);
      c.moveTo(meta.mouse.x, meta.mouse.y + 4);
      c.lineTo(meta.mouse.x, meta.mouse.y + 13);
      c.stroke();
    }
    if (3.6 > meta.roomAge) {
      const alpha = meta.roomAge >= 3 ? 1 - (meta.roomAge - 3) / 0.6 : 1;
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = PALETTE.panel;
      c.fillRect(FIELD.width / 2 - 340, 64, 680, 74);
      c.fillStyle = PALETTE.text;
      c.font = "700 24px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(state.gallery.name, FIELD.width / 2, 98);
      c.fillStyle = PALETTE.muted;
      c.font = "400 15px system-ui, sans-serif";
      c.fillText(state.gallery.intro, FIELD.width / 2, 124);
      c.restore();
    }
  }

  function panel(width, height) {
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    c.fillStyle = PALETTE.panel;
    c.fillRect(x, y, width, height);
    c.strokeStyle = "rgba(232, 182, 76, 0.45)";
    c.lineWidth = 2;
    c.strokeRect(x, y, width, height);
    return { x: x, y: y };
  }

  function title(state) {
    c.fillStyle = "rgba(6, 10, 8, 0.6)";
    c.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(720, 410);
    c.textAlign = "center";
    c.fillStyle = PALETTE.gold;
    c.font = "700 60px system-ui, sans-serif";
    c.fillText("THE GLASS VAULT", FIELD.width / 2, y + 90);
    c.fillStyle = PALETTE.text;
    c.font = "400 18px system-ui, sans-serif";
    c.fillText("Three galleries. One alarm. A van that leaves without you.", FIELD.width / 2, y + 130);
    c.fillStyle = PALETTE.muted;
    c.font = "400 16px system-ui, sans-serif";
    c.fillText("Stand at a case to lift it. Stand at the vault to crack it — its drill hums.", FIELD.width / 2, y + 166);
    c.fillText("Guards and cameras feed one ALARM meter: sight, snatches, drills and EMP surges.", FIELD.width / 2, y + 192);
    c.fillText("An EMP (E) darkens every camera for six seconds, at the price of a surge.", FIELD.width / 2, y + 218);
    c.fillStyle = PALETTE.text;
    c.font = "600 16px system-ui, sans-serif";
    c.fillText("WASD — move    Shift — tiptoe    Click — decoy coin    E — EMP    Esc — pause", FIELD.width / 2, y + 266);
    c.fillStyle = PALETTE.gold;
    c.font = "700 19px system-ui, sans-serif";
    if (-0.2 < Math.sin(state.time * 3.2)) c.fillText("Press Enter or click to go in", FIELD.width / 2, y + 320);
    c.fillStyle = PALETTE.muted;
    c.font = "400 13px system-ui, sans-serif";
    c.fillText("An original heist in three galleries", FIELD.width / 2, y + 362);
  }

  function blown(state, meta) {
    c.fillStyle = "rgba(110, 12, 10, 0.45)";
    c.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(640, 300);
    c.textAlign = "center";
    c.fillStyle = PALETTE.danger;
    c.font = "700 54px system-ui, sans-serif";
    c.fillText("THE ALARM TRIPS", FIELD.width / 2, y + 88);
    c.fillStyle = PALETTE.text;
    c.font = "400 18px system-ui, sans-serif";
    c.fillText("Sirens, shutters, and a long walk home in handcuffs.", FIELD.width / 2, y + 132);
    c.fillStyle = PALETTE.muted;
    c.font = "400 16px system-ui, sans-serif";
    c.fillText(`${state.gallery.name} · Carrying ${fmtMoney(state.take)} · ${fmtClock(meta.totalTime)} on the job`, FIELD.width / 2, y + 172);
    c.fillStyle = PALETTE.gold;
    c.font = "700 18px system-ui, sans-serif";
    c.fillText("Press Enter or R to run the gallery again", FIELD.width / 2, y + 232);
  }

  function clear(state, meta) {
    c.fillStyle = "rgba(8, 20, 14, 0.5)";
    c.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(640, 290);
    c.textAlign = "center";
    c.fillStyle = PALETTE.good;
    c.font = "700 44px system-ui, sans-serif";
    c.fillText("INTO THE NIGHT", FIELD.width / 2, y + 82);
    c.fillStyle = PALETTE.text;
    c.font = "400 18px system-ui, sans-serif";
    c.fillText(`${state.gallery.name} emptied to ${fmtMoney(state.take)} — over the fence's quota.`, FIELD.width / 2, y + 124);
    c.fillStyle = PALETTE.muted;
    c.font = "400 16px system-ui, sans-serif";
    c.fillText(`Alarm peaked, time ${fmtClock(meta.totalTime)} · Haul so far ${fmtMoney(meta.totalTake)}`, FIELD.width / 2, y + 164);
    c.fillStyle = PALETTE.gold;
    c.font = "700 18px system-ui, sans-serif";
    c.fillText("Press Enter for the next gallery", FIELD.width / 2, y + 224);
  }

  function grade(totalTake) {
    if (totalTake >= 290000) return "MASTER THIEF";
    if (totalTake >= 235000) return "PROFESSIONAL";
    if (totalTake >= 175000) return "CAREFUL HAND";
    return "SMASH-AND-GRAB";
  }

  function win(meta) {
    c.fillStyle = "rgba(8, 12, 6, 0.55)";
    c.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(700, 370);
    c.textAlign = "center";
    c.fillStyle = PALETTE.gold;
    c.font = "700 48px system-ui, sans-serif";
    c.fillText("A CLEAN JOB", FIELD.width / 2, y + 84);
    c.fillStyle = PALETTE.text;
    c.font = "400 18px system-ui, sans-serif";
    c.fillText("All three galleries hit in one night, and the museum none the wiser.", FIELD.width / 2, y + 124);
    c.fillStyle = PALETTE.muted;
    c.font = "400 17px system-ui, sans-serif";
    c.fillText(`Total haul  ${fmtMoney(meta.totalTake)}  of ${fmtMoney(meta.maxTake)}`, FIELD.width / 2, y + 170);
    c.fillText(`Time  ${fmtClock(meta.totalTime)}      Pieces lifted  ${meta.grabs}      EMPs spent  ${meta.empsUsed}`, FIELD.width / 2, y + 200);
    c.fillStyle = PALETTE.gold;
    c.font = "700 22px system-ui, sans-serif";
    c.fillText(`The fence's verdict: ${grade(meta.totalTake)}`, FIELD.width / 2, y + 246);
    if (null !== meta.best) {
      c.fillStyle = PALETTE.muted;
      c.font = "400 15px system-ui, sans-serif";
      c.fillText(`Richest night so far  ${fmtMoney(meta.best)}`, FIELD.width / 2, y + 278);
    }
    c.fillStyle = PALETTE.gold;
    c.font = "700 18px system-ui, sans-serif";
    c.fillText("Press Enter to plan another night", FIELD.width / 2, y + 322);
  }

  function paused() {
    c.fillStyle = "rgba(6, 10, 8, 0.6)";
    c.fillRect(0, 0, FIELD.width, FIELD.height);
    c.textAlign = "center";
    c.fillStyle = PALETTE.text;
    c.font = "700 42px system-ui, sans-serif";
    c.fillText("PAUSED", FIELD.width / 2, FIELD.height / 2 - 8);
    c.fillStyle = PALETTE.muted;
    c.font = "400 16px system-ui, sans-serif";
    c.fillText("The museum holds its breath. Esc or Enter to go on.", FIELD.width / 2, FIELD.height / 2 + 28);
  }

  function render(state, screen, meta) {
    fit();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PALETTE.backdrop;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.setTransform(scale, 0, 0, scale, shiftX, shiftY);
    floor(state);
    van(state);
    vault(state);
    cover(state);
    state.loot.forEach((item, index) => loot(item, index));
    ripples(state);
    coins(state);
    cones(state);
    for (const g of state.guards) guard(g);
    for (const cam of state.cameras) camera(state, cam);
    thief(state);
    if (screen !== VIEW_TITLE) hud(state, meta);
    if (screen === VIEW_TITLE) title(state);
    else if (screen === VIEW_PAUSED) paused();
    else if (screen === VIEW_BLOWN) blown(state, meta);
    else if (screen === VIEW_CLEAR) clear(state, meta);
    else if (screen === VIEW_WIN) win(meta);
  }

  return { render, toRoom };
}
