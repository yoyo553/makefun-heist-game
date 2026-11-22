// The annotation layer: everything painted over the room that explains
// the game to whoever is looking at a still frame. Patrol routes as
// dotted threads with numbered stops, a badge over every warden naming
// them and their state of mind, the full arc each camera sweeps, the
// ring the vault drill's hum carries across, a tag on the thief, a
// legend in the corner, and speech bubbles for staged moments. None of
// this touches the simulation — it only reads the state and talks.

import { CAMERA, PALETTE, VISION } from "./config.js";
import { conePolygon } from "./vision.js";

// The wardens have names, rostered in the order the galleries list them.
const WARDEN_NAMES = ["BRUNO", "VESK", "MARA", "OTTO", "PIA", "RENZ", "KOBA", "SELIN", "YUSUF"];

// What a warden is doing, in the words the badges and the legend use.
export function wardenState(g) {
  if (g.seesThief && g.awareness > 0.55) return { word: "SPOTTED!", tone: PALETTE.danger };
  if (g.awareness >= VISION.stareAt) return { word: "STARING", tone: "#ff9142" };
  if (g.mode === "investigate") return { word: "CHECKING", tone: PALETTE.gold };
  if (g.sentinel) return { word: "ON WATCH", tone: PALETTE.muted };
  return { word: "PATROLLING", tone: PALETTE.muted };
}

export function wardenName(index) {
  return WARDEN_NAMES[index % WARDEN_NAMES.length];
}

// The dotted thread of every patrol, with a numbered disc at each stop.
// A sentinel stands on one spot, so instead its badge of office is the
// dashed arc its gaze sweeps across.
export function paintPatrolRoutes(c, state) {
  c.save();
  c.strokeStyle = `rgba(255, 217, 122, 0.55)`;
  c.fillStyle = "rgba(20, 24, 20, 0.85)";
  c.lineWidth = 2;
  c.setLineDash([3, 7]);
  state.guards.forEach((g) => {
    if (g.sentinel) {
      c.beginPath();
      c.arc(g.x, g.y, 52, g.homeFacing - 0.7, g.homeFacing + 0.7);
      c.stroke();
      return;
    }
    c.beginPath();
    g.path.forEach((pt, i) => (i === 0 ? c.moveTo(pt[0], pt[1]) : c.lineTo(pt[0], pt[1])));
    c.stroke();
  });
  c.setLineDash([]);
  state.guards.forEach((g) => {
    if (g.sentinel) return;
    g.path.forEach((pt, i) => {
      c.beginPath();
      c.arc(pt[0], pt[1], 9, 0, 2 * Math.PI);
      c.fill();
      c.strokeStyle = PALETTE.route;
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = PALETTE.route;
      c.font = "700 10px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(`${i + 1}`, pt[0], pt[1] + 3.5);
      c.fillStyle = "rgba(20, 24, 20, 0.85)";
    });
  });
  c.restore();
}

// Each camera's whole sweep, fainter than the cone it is showing now:
// the pale fan is everywhere the lens will look, the bright one is
// where it looks this second.
export function paintCameraSweeps(c, state) {
  for (const cam of state.cameras) {
    if (cam.disabled > 0) continue;
    const reach = conePolygon(cam.x, cam.y, cam.baseFacing, CAMERA.range, CAMERA.halfAngle + CAMERA.sweepAngle, state.segments);
    c.beginPath();
    reach.forEach((pt, i) => (i === 0 ? c.moveTo(pt.x, pt.y) : c.lineTo(pt.x, pt.y)));
    c.closePath();
    c.fillStyle = `rgba(${PALETTE.coneCamera}, 0.05)`;
    c.fill();
    c.strokeStyle = `rgba(${PALETTE.coneCamera}, 0.16)`;
    c.lineWidth = 1;
    c.setLineDash([5, 6]);
    c.stroke();
    c.setLineDash([]);
  }
}

// While the drill works, a dashed ring shows how far its hum carries —
// any warden the ring touches is already on their way to look.
export function paintDrillHalo(c, state) {
  const safe = state.vault;
  if (!safe.drilling) return;
  const cx = safe.x + safe.w / 2;
  const cy = safe.y + safe.h;
  c.save();
  c.strokeStyle = "rgba(232, 182, 76, 0.5)";
  c.lineWidth = 1.5;
  c.setLineDash([6, 6]);
  c.beginPath();
  c.arc(cx, cy, 130, 0, 2 * Math.PI);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = PALETTE.gold;
  c.font = "600 10.5px system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText("DRILL HUM CARRIES THIS FAR", cx, cy + 146);
  c.restore();
}

// A pill over each warden's head: name, state of mind, and a thin bar
// of how sure they are. It sits above the older ? / ! mark, which the
// renderer still paints on the cap itself.
export function paintWardenBadges(c, state) {
  state.guards.forEach((g, index) => {
    const mood = wardenState(g);
    const label = `${wardenName(index)} · ${mood.word}`;
    c.font = "700 10.5px system-ui, sans-serif";
    const w = c.measureText(label).width + 16;
    const x = g.x - w / 2;
    const y = g.y - 46;
    c.fillStyle = PALETTE.panel;
    c.fillRect(x, y, w, 17);
    c.strokeStyle = mood.tone;
    c.lineWidth = 1.2;
    c.strokeRect(x, y, w, 17);
    c.fillStyle = mood.tone === PALETTE.muted ? PALETTE.text : mood.tone;
    c.textAlign = "center";
    c.fillText(label, g.x, y + 12.5);
    // The certainty bar under the pill.
    c.fillStyle = "rgba(255, 255, 255, 0.2)";
    c.fillRect(g.x - 17, y + 20, 34, 4);
    c.fillStyle = mood.tone;
    c.fillRect(g.x - 17, y + 20, 34 * Math.min(g.awareness, 1), 4);
  });
}

// The thief carries a tag too, so a still frame never leaves the reader
// guessing which figure is theirs.
export function paintThiefTag(c, state) {
  const t = state.thief;
  let doing = "STILL";
  if (state.anyoneSees) doing = "IN SIGHT!";
  else if (state.cameraSees) doing = "ON CAMERA!";
  else if (state.grabIndex > -1) doing = "LIFTING…";
  else if (state.vault.drilling) doing = "DRILLING…";
  else if (t.moving && t.tiptoe) doing = "SNEAKING";
  else if (t.moving) doing = "WALKING — LOUD";
  const label = `YOU · ${doing}`;
  c.font = "700 10.5px system-ui, sans-serif";
  const w = c.measureText(label).width + 14;
  const x = t.x - w / 2;
  const y = t.y + 20;
  c.fillStyle = PALETTE.panel;
  c.fillRect(x, y, w, 17);
  c.strokeStyle = PALETTE.gold;
  c.lineWidth = 1.2;
  c.strokeRect(x, y, w, 17);
  c.fillStyle = PALETTE.gold;
  c.textAlign = "center";
  c.fillText(label, t.x, y + 12.5);
}

// The corner legend: five swatches that decode the whole picture.
export function paintLegend(c, state) {
  const rows = [
    { swatch: `rgba(${PALETTE.coneGuard}, 0.75)`, text: "warden's gaze — stay out" },
    { swatch: `rgba(${PALETTE.coneCamera}, 0.75)`, text: "camera sweep — EMP (E) darkens it" },
    { swatch: PALETTE.route, text: "dotted line — patrol route, numbered" },
    { swatch: PALETTE.gold, text: "loot — name and price on its case" },
    { swatch: PALETTE.guard, text: "wardens — badge tells their state" },
  ];
  c.font = "600 10.5px system-ui, sans-serif";
  let widest = 0;
  for (const row of rows) widest = Math.max(widest, c.measureText(row.text).width);
  const w = widest + 38;
  const h = rows.length * 17 + 24;
  const x = 1280 - w - 10;
  const y = 720 - 44 - h;
  c.fillStyle = PALETTE.panel;
  c.fillRect(x, y, w, h);
  c.strokeStyle = "rgba(232, 182, 76, 0.4)";
  c.lineWidth = 1.2;
  c.strokeRect(x, y, w, h);
  c.fillStyle = PALETTE.gold;
  c.font = "700 10px system-ui, sans-serif";
  c.textAlign = "left";
  c.fillText("HOW TO READ THE ROOM", x + 10, y + 15);
  c.font = "600 10.5px system-ui, sans-serif";
  rows.forEach((row, i) => {
    const ry = y + 23 + i * 17;
    c.fillStyle = row.swatch;
    c.fillRect(x + 10, ry, 11, 8);
    c.fillStyle = PALETTE.text;
    c.fillText(row.text, x + 28, ry + 8);
  });
}

// Speech bubbles for staged moments: a line of text in a rounded panel
// with a small tail down to whoever "says" it. The screenshot scenes in
// shots.js supply them through the frame's meta.
export function paintCallouts(c, callouts) {
  if (!callouts) return;
  for (const call of callouts) {
    c.font = "600 13px system-ui, sans-serif";
    const w = c.measureText(call.text).width + 22;
    const x = Math.max(8, Math.min(call.x - w / 2, 1280 - w - 8));
    const y = Math.max(48, call.y - 58);
    c.fillStyle = "rgba(16, 20, 17, 0.92)";
    c.fillRect(x, y, w, 26);
    c.strokeStyle = PALETTE.gold;
    c.lineWidth = 1.2;
    c.strokeRect(x, y, w, 26);
    c.beginPath();
    c.moveTo(call.x - 5, y + 26);
    c.lineTo(call.x + 5, y + 26);
    c.lineTo(call.x, y + 34);
    c.closePath();
    c.fillStyle = "rgba(16, 20, 17, 0.92)";
    c.fill();
    c.fillStyle = PALETTE.text;
    c.textAlign = "center";
    c.fillText(call.text, x + w / 2, y + 17.5);
  }
}
