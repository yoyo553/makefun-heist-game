// Everything the player sees, drawn on a single canvas whose native
// grid is the room itself (1280 by 720, scaled to the window). The
// painting order is the picture's depth: lit marble and crimson runners
// first, then the annotation thread of the patrols, the getaway van, the
// vault, the furniture, the loot in its glass and gilt, footstep rings,
// decoy coins, the cameras' whole sweep, the cones themselves, the hum
// ring of a working drill, the wardens, the cameras, the thief, and over
// it all the badges, the HUD and whichever screen is showing — title,
// paused, blown, gallery clear, or the clean-job verdict.

import { CAMERA, COIN, FIELD, GRAB, PALETTE, VISION } from "./config.js";
import { conePolygon } from "./vision.js";
import { hash01 } from "./random.js";
import { GALLERIES } from "./levels.js";
import { paintCallouts, paintCameraSweeps, paintDrillHalo, paintLegend, paintPatrolRoutes, paintThiefTag, paintWardenBadges } from "./overlays.js";

export const VIEW_TITLE = "title";
export const VIEW_PLAY = "play";
export const VIEW_PAUSED = "paused";
export const VIEW_BLOWN = "blown";
export const VIEW_CLEAR = "clear";
export const VIEW_WIN = "win";

// Seconds as a clock face: 154 becomes "2:34".
function asClock(seconds) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole - minutes * 60;
  return minutes + ":" + String(rest).padStart(2, "0");
}

// A sum of money with its commas: 27000 becomes "$27,000".
function asMoney(sum) {
  return "$" + sum.toLocaleString("en-US");
}

export function makeRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let zoom = 1;
  let offX = 0;
  let offY = 0;

  // Match the canvas to its box and work out how the room sits inside.
  function fitCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const wantW = Math.round(canvas.clientWidth * ratio);
    const wantH = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }
    const zx = canvas.width / FIELD.width;
    const zy = canvas.height / FIELD.height;
    zoom = Math.min(zx, zy);
    offX = (canvas.width - zoom * FIELD.width) / 2;
    offY = (canvas.height - zoom * FIELD.height) / 2;
  }

  // A point on the window becomes a point in the room.
  function toRoom(clientX, clientY) {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const px = (clientX - box.left) * ratio;
    const py = (clientY - box.top) * ratio;
    return { x: (px - offX) / zoom, y: (py - offY) / zoom };
  }

  function paintFloor(state) {
    // The chequer: two mid-green stones alternating, each tile nudged
    // lighter or darker by the steady hash so the marble has grain, and
    // pale grout lines a thumbnail can still follow.
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const tile = 64;
    for (let row = 0; row * tile < FIELD.height; row += 1) {
      for (let col = 0; col * tile < FIELD.width; col += 1) {
        const grain = hash01(col * 7 + 1, row * 13 + 3);
        if ((row + col) % 2 === 0) {
          ctx.fillStyle = PALETTE.floorAlt;
          ctx.fillRect(col * tile, row * tile, tile, tile);
        }
        if (grain > 0.72) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
          ctx.fillRect(col * tile, row * tile, tile, tile);
        } else if (grain < 0.2) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.07)";
          ctx.fillRect(col * tile, row * tile, tile, tile);
        }
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = tile; gx < FIELD.width; gx += tile) { ctx.moveTo(gx, 0); ctx.lineTo(gx, FIELD.height); }
    for (let gy = tile; gy < FIELD.height; gy += tile) { ctx.moveTo(0, gy); ctx.lineTo(FIELD.width, gy); }
    ctx.stroke();
    // The runners: crimson carpet with a paler border stripe.
    for (const rug of state.gallery.carpets) {
      ctx.fillStyle = PALETTE.carpet;
      ctx.fillRect(rug.x, rug.y, rug.w, rug.h);
      ctx.strokeStyle = PALETTE.carpetEdge;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rug.x + 6, rug.y + 6, rug.w - 12, rug.h - 12);
    }
    ctx.strokeStyle = PALETTE.pillarEdge;
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, FIELD.width - 24, FIELD.height - 24);
    ctx.strokeStyle = "#39423e";
    ctx.lineWidth = 14;
    ctx.strokeRect(5, 5, FIELD.width - 10, FIELD.height - 10);
  }

  function paintVan(state) {
    const van = state.gallery.van;
    const ready = state.take >= state.gallery.quota;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(van.x - 3, van.y + 6, van.w, van.h);
    ctx.fillStyle = ready ? "#2c4638" : "#22262b";
    ctx.fillRect(van.x, van.y, van.w, van.h);
    ctx.fillStyle = "#3d454f";
    ctx.fillRect(van.x, van.y, van.w, 16);
    ctx.fillStyle = "#9fc6d8";
    ctx.fillRect(van.x + van.w - 14, van.y + 20, 8, van.h - 40);
    ctx.fillStyle = "#101216";
    ctx.beginPath();
    ctx.arc(van.x + 14, van.y + 12, 8, 0, 2 * Math.PI);
    ctx.arc(van.x + 14, van.y + van.h - 12, 8, 0, 2 * Math.PI);
    ctx.fill();
    if (ready) {
      // Lit lamps along the door edge say the van will wait for you.
      ctx.save();
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 16;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(van.x + van.w - 5, van.y + 8, 4, 10);
      ctx.fillRect(van.x + van.w - 5, van.y + van.h - 18, 4, 10);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(van.x + van.w / 2, van.y + van.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = ready ? PALETTE.gold : PALETTE.muted;
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GETAWAY", 0, 5);
    ctx.restore();
    if (state.vanHint > 0) {
      // Turned away at the door: the panel names what is still owed.
      const short = state.gallery.quota - state.take;
      const words = `The fence wants ${asMoney(state.gallery.quota)} — ${asMoney(short)} short`;
      ctx.font = "600 14px system-ui, sans-serif";
      const width = ctx.measureText(words).width + 18;
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(van.x + van.w + 8, van.y + van.h / 2 - 14, width, 28);
      ctx.fillStyle = PALETTE.danger;
      ctx.textAlign = "left";
      ctx.fillText(words, van.x + van.w + 17, van.y + van.h / 2 + 5);
    }
  }

  function paintVault(state) {
    const safe = state.vault;
    ctx.save();
    if (safe.cracked) {
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 24;
    }
    ctx.fillStyle = PALETTE.vault;
    ctx.fillRect(safe.x, safe.y, safe.w, safe.h);
    ctx.restore();
    ctx.strokeStyle = PALETTE.vaultEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(safe.x + 2, safe.y + 2, safe.w - 4, safe.h - 4);
    const midX = safe.x + safe.w / 2;
    const midY = safe.y + safe.h / 2;
    if (safe.cracked) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(safe.x + 8, safe.y + 8, safe.w - 16, safe.h - 16);
      ctx.fillStyle = "#7a5a10";
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OPEN — EMPTIED", midX, midY + 5);
      return;
    }
    // The wheel, its three spokes turning with the drill's progress.
    ctx.strokeStyle = PALETTE.vaultEdge;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(midX, midY, 15, 0, 2 * Math.PI);
    ctx.stroke();
    const spin = safe.progress * 2.4;
    for (let spoke = 0; spoke < 3; spoke += 1) {
      const ang = spin + (spoke * 2 * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(ang) * 15, midY + Math.sin(ang) * 15);
      ctx.stroke();
    }
    ctx.fillStyle = "#dfe5ea";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${safe.name} · ${asMoney(safe.value)}`, midX, safe.y + safe.h + 15);
    if (safe.progress > 0) {
      // How far the drill has chewed: a backed bar and the percentage.
      const barW = safe.w * 0.9;
      const pct = Math.round((safe.progress / safe.crackSeconds) * 100);
      ctx.fillStyle = "rgba(10, 14, 12, 0.75)";
      ctx.fillRect(midX - barW / 2 - 4, safe.y + safe.h + 20, barW + 8, 10);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(midX - barW / 2, safe.y + safe.h + 22.5, (barW * safe.progress) / safe.crackSeconds, 5);
      ctx.font = "700 11.5px system-ui, sans-serif";
      ctx.fillText(`DRILLING — ${pct}%`, midX, safe.y + safe.h + 44);
    }
  }

  function paintCover(state) {
    for (const block of state.gallery.cover) {
      // Cases are painted with the loot inside them, not here.
      if (block.kind === "case") continue;
      if (block.kind === "pillar") {
        ctx.fillStyle = PALETTE.pillar;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.strokeStyle = PALETTE.pillarEdge;
        ctx.lineWidth = 3;
        ctx.strokeRect(block.x + 2, block.y + 2, block.w - 4, block.h - 4);
        ctx.fillStyle = PALETTE.pillarEdge;
        ctx.fillRect(block.x + 4, block.y + 7, block.w - 8, 3);
        ctx.fillRect(block.x + 4, block.y + block.h - 10, block.w - 8, 3);
      } else if (block.kind === "cabinet") {
        ctx.fillStyle = PALETTE.cabinet;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.strokeStyle = PALETTE.cabinetEdge;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(block.x + 1.5, block.y + 1.5, block.w - 3, block.h - 3);
        ctx.beginPath();
        ctx.moveTo(block.x + block.w / 2, block.y + 6);
        ctx.lineTo(block.x + block.w / 2, block.y + block.h - 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.strokeStyle = PALETTE.wallEdge;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(block.x + 1.5, block.y + 1.5, block.w - 3, block.h - 3);
      }
    }
  }

  function paintLoot(item, index) {
    if (item.kind === "painting") {
      // A gilt frame on its partition; inside, a small dusk with a low
      // sun — or bare backing board once the canvas is carried off.
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(item.x - 3, item.y + 18, item.w + 6, 64);
      if (!item.taken) {
        const sky = ctx.createLinearGradient(0, item.y + 22, 0, item.y + 78);
        sky.addColorStop(0, "#7a4a63");
        sky.addColorStop(0.6, PALETTE.paintingInk);
        sky.addColorStop(1, "#1d2836");
        ctx.fillStyle = sky;
        ctx.fillRect(item.x, item.y + 22, item.w, 56);
        ctx.fillStyle = "rgba(255, 220, 150, 0.75)";
        ctx.beginPath();
        ctx.arc(item.x + item.w / 2, item.y + 40 + hash01(index, 5) * 8, 5, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillStyle = "#565048";
        ctx.fillRect(item.x, item.y + 22, item.w, 56);
      }
    } else {
      // A glass case with a brass frame; the piece inside glows until
      // it is gone, and the empty case says so.
      ctx.fillStyle = PALETTE.caseGlass;
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = PALETTE.caseFrame;
      ctx.lineWidth = 3;
      ctx.strokeRect(item.x + 1.5, item.y + 1.5, item.w - 3, item.h - 3);
      const midX = item.x + item.w / 2;
      const midY = item.y + item.h / 2;
      if (!item.taken) {
        ctx.save();
        ctx.shadowColor = PALETTE.gold;
        ctx.shadowBlur = 12;
        ctx.fillStyle = PALETTE.gold;
        const shape = Math.floor(hash01(index, 11) * 3);
        if (shape === 0) {
          ctx.beginPath();
          ctx.moveTo(midX, midY - 11);
          ctx.lineTo(midX + 9, midY);
          ctx.lineTo(midX, midY + 11);
          ctx.lineTo(midX - 9, midY);
          ctx.closePath();
          ctx.fill();
        } else if (shape === 1) {
          ctx.beginPath();
          ctx.arc(midX, midY, 9, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillRect(midX - 9, midY - 6, 18, 12);
        }
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(230, 240, 250, 0.35)";
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("TAKEN", midX, midY + 3);
      }
    }
    if (item.taken) return;
    // Name and price under the piece, and a slim bar while a lift runs.
    ctx.fillStyle = "rgba(238, 241, 245, 0.92)";
    ctx.font = "600 11.5px system-ui, sans-serif";
    ctx.textAlign = "center";
    const labelY = item.kind === "painting" ? item.y + 100 : item.y + item.h + 15;
    ctx.fillText(`${item.name} · ${asMoney(item.value)}`, item.x + item.w / 2, labelY);
    if (item.progress > 0) {
      const barW = 54;
      const barX = item.x + item.w / 2 - barW / 2;
      const barY = labelY + 6;
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(barX, barY, (barW * item.progress) / GRAB.seconds, 5);
    }
  }

  function paintRipples(state) {
    for (const ring of state.ripples) {
      const left = 1 - ring.age / ring.life;
      ctx.strokeStyle = ring.kind === "ping"
        ? `rgba(255, 220, 130, ${left * 0.55})`
        : `rgba(165, 185, 225, ${left * 0.38})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  function paintCoins(state) {
    for (const coin of state.coins) {
      if (!coin.landed) {
        // Still in the air: part-way along its arc, riding a small hop.
        const p = Math.min(coin.t / COIN.flightSeconds, 1);
        const fx = coin.fromX + (coin.x - coin.fromX) * p;
        const fy = coin.fromY + (coin.y - coin.fromY) * p - 38 * Math.sin(p * Math.PI);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#7a5a10";
        ctx.font = "700 8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("$", coin.x, coin.y + 3);
      }
    }
  }

  function paintCones(state) {
    // Wardens first: warm fans, hotter once a warden is sure.
    for (const g of state.guards) {
      const wary = g.awareness >= VISION.stareAt;
      const tone = wary ? PALETTE.coneGuardWary : PALETTE.coneGuard;
      const fan = conePolygon(g.x, g.y, g.facing, VISION.range, VISION.halfAngle, state.segments);
      ctx.beginPath();
      fan.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(${tone}, ${wary ? 0.3 : 0.22})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${tone}, 0.42)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Then the cameras: red fans, brightest while one has a lock.
    for (const cam of state.cameras) {
      if (cam.disabled > 0) continue;
      const fan = conePolygon(cam.x, cam.y, cam.facing, CAMERA.range, CAMERA.halfAngle, state.segments);
      ctx.beginPath();
      fan.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(${PALETTE.coneCamera}, ${cam.locksOn ? 0.32 : 0.19})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${PALETTE.coneCamera}, 0.45)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function paintGuard(g) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(g.x, g.y + 12, 15, 6, 0, 0, 2 * Math.PI);
    ctx.fill();
    // Claret uniform, dark outline, navy cap, pale collar: a person a
    // thumbnail can pick out of the stone and the runners.
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 14, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "rgba(12, 10, 10, 0.65)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = PALETTE.guardCap;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 14, g.facing + Math.PI * 0.65, g.facing + Math.PI * 2.35);
    ctx.lineTo(g.x, g.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.guardTrim;
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.facing) * 5, g.y + Math.sin(g.facing) * 5, 3.2, 0, 2 * Math.PI);
    ctx.fill();
    if (g.awareness >= VISION.stareAt) {
      // The mark over the cap: a question while they wonder, a bang
      // once they are sure and watching.
      const sure = g.seesThief && g.awareness > 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(g.x + 14, g.y - 20, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = sure ? PALETTE.danger : "#c77f1a";
      ctx.font = "700 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(sure ? "!" : "?", g.x + 14, g.y - 15);
    }
  }

  function paintCamera(state, cam) {
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, 2 * Math.PI);
    ctx.fill();
    ctx.rotate(cam.facing);
    ctx.fillStyle = cam.disabled > 0 ? "#4a4f57" : "#22262e";
    ctx.fillRect(-8, -6, 17, 12);
    ctx.fillStyle = cam.disabled > 0 ? "#666c75" : "#9fc6d8";
    ctx.beginPath();
    ctx.arc(10, 0, 3.6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    // The LED tells the camera's story: hard blink on a lock, steady
    // dim red while it watches, dark once an EMP has fried it.
    let led = "#5e2a28";
    if (cam.disabled > 0) led = "#33373d";
    else if (cam.locksOn) led = Math.sin(state.time * 16) > 0 ? "#ff3b30" : "#7a1610";
    else led = "#c22e28";
    ctx.fillStyle = led;
    ctx.beginPath();
    ctx.arc(cam.x, cam.y - 13, 3, 0, 2 * Math.PI);
    ctx.fill();
    if (cam.disabled > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = "600 9.5px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OFFLINE", cam.x, cam.y + 24);
    }
  }

  function paintThief(state) {
    const t = state.thief;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 11, 13, 5.5, 0, 0, 2 * Math.PI);
    ctx.fill();
    if (t.tiptoe) {
      // A dashed halo while creeping: quiet feet, drawn quietly.
      ctx.strokeStyle = "rgba(232, 182, 76, 0.45)";
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 19, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = PALETTE.thief;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 13, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = PALETTE.thiefTrim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 11, 0, 2 * Math.PI);
    ctx.stroke();
    const heading = Math.atan2(t.faceY, t.faceX);
    ctx.fillStyle = "#e8dcc3";
    ctx.beginPath();
    ctx.arc(t.x + Math.cos(heading) * 5, t.y + Math.sin(heading) * 5, 3.4, 0, 2 * Math.PI);
    ctx.fill();
    if (state.grabIndex > -1) {
      // A gold ring fills while the lift runs.
      const piece = state.loot[state.grabIndex];
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 18, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (piece.progress / GRAB.seconds));
      ctx.stroke();
    }
  }

  // The meter's mood in a word and a colour, the four stages the
  // legend and the HUD both speak.
  function stageOfAlarm(state) {
    if (state.alarm >= 0.75) return { word: "HUNTED", tone: PALETTE.danger };
    if (state.alarm >= 0.5) return { word: "RISKY", tone: "#ffb84d" };
    if (state.alarm >= 0.25) return { word: "STIRRING", tone: "#ffd97a" };
    return { word: "QUIET", tone: "#7bc47f" };
  }

  function paintHud(state, meta) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(state.gallery.name, 16, 25);
    // Second line, left: which room of the night, and how much of it
    // is already in the bag.
    const lifted = state.loot.filter((piece) => piece.taken).length + (state.vault.cracked ? 1 : 0);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "600 10.5px system-ui, sans-serif";
    ctx.fillText(`GALLERY ${state.galleryIndex + 1} OF ${GALLERIES.length} · ${lifted} OF ${state.loot.length + 1} PIECES LIFTED`, 16, 40);
    // The one ALARM bar, centred, carrying the whole job.
    const barW = 280;
    const barX = (FIELD.width - barW) / 2;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("ALARM", barX - 10, 25);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(barX, 12, barW, 13);
    const seen = state.cameraSees || state.anyoneSees;
    ctx.fillStyle = state.alarm >= 0.75 ? PALETTE.danger : state.alarm >= 0.4 ? "#ffb84d" : "#7bc47f";
    if (seen && Math.sin(state.time * 14) > 0) ctx.fillStyle = PALETTE.danger;
    ctx.fillRect(barX, 12, barW * state.alarm, 13);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, 12, barW, 13);
    // Stage word and percentage, centred under the bar.
    const stage = stageOfAlarm(state);
    ctx.fillStyle = stage.tone;
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${stage.word} · ${Math.round(state.alarm * 100)}%`, FIELD.width / 2, 40);
    // Right side: the take against the quota, EMP charges, the clock.
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = state.take >= state.gallery.quota ? PALETTE.good : PALETTE.text;
    const rightSide = `TAKE ${asMoney(state.take)} / ${asMoney(state.gallery.quota)}   ·   EMP ×${state.empCharges}   ·   ${asClock(meta.totalTime)}`;
    ctx.fillText(rightSide, FIELD.width - 16, 25);
    // Bottom left: what this gallery asks of the thief.
    ctx.font = "400 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    const introW = ctx.measureText(state.gallery.intro).width + 20;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(10, FIELD.height - 34, introW, 24);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(state.gallery.intro, 20, FIELD.height - 17);
    // Bottom right: the controls, for whoever just sat down.
    const hintWords = "WASD move · Shift tiptoe · Stand at loot to lift it · Click coin · E EMP";
    const hintW = ctx.measureText(hintWords).width + 20;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(FIELD.width - hintW - 10, FIELD.height - 34, hintW, 24);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(hintWords, FIELD.width - hintW, FIELD.height - 17);
    if (meta.mouse != null) {
      // The player's own crosshair, a small gold sight.
      ctx.strokeStyle = "rgba(232, 182, 76, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(meta.mouse.x, meta.mouse.y, 8, 0, 2 * Math.PI);
      ctx.moveTo(meta.mouse.x - 13, meta.mouse.y);
      ctx.lineTo(meta.mouse.x - 4, meta.mouse.y);
      ctx.moveTo(meta.mouse.x + 4, meta.mouse.y);
      ctx.lineTo(meta.mouse.x + 13, meta.mouse.y);
      ctx.moveTo(meta.mouse.x, meta.mouse.y - 13);
      ctx.lineTo(meta.mouse.x, meta.mouse.y - 4);
      ctx.moveTo(meta.mouse.x, meta.mouse.y + 4);
      ctx.lineTo(meta.mouse.x, meta.mouse.y + 13);
      ctx.stroke();
    }
    if (meta.roomAge < 3.6) {
      // A fresh gallery announces itself, fading as the room ages.
      const fade = meta.roomAge >= 3 ? 1 - (meta.roomAge - 3) / 0.6 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(FIELD.width / 2 - 340, 64, 680, 74);
      ctx.fillStyle = PALETTE.text;
      ctx.font = "700 24px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(state.gallery.name, FIELD.width / 2, 98);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = "400 15px system-ui, sans-serif";
      ctx.fillText(state.gallery.intro, FIELD.width / 2, 124);
      ctx.restore();
    }
  }

  // A centred panel with a gilt edge; returns its top-left corner.
  function centredPanel(w, h) {
    const px = (FIELD.width - w) / 2;
    const py = (FIELD.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(px, py, w, h);
    ctx.strokeStyle = "rgba(232, 182, 76, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, w, h);
    return { x: px, y: py };
  }

  function paintTitle(state) {
    ctx.fillStyle = "rgba(6, 10, 8, 0.6)";
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const top = centredPanel(720, 410).y;
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "700 60px system-ui, sans-serif";
    ctx.fillText("THE GLASS VAULT", FIELD.width / 2, top + 90);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillText("Three galleries. One alarm. A van that leaves without you.", FIELD.width / 2, top + 130);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillText("Stand at a case to lift it. Stand at the vault to crack it — its drill hums.", FIELD.width / 2, top + 166);
    ctx.fillText("Guards and cameras feed one ALARM meter: sight, snatches, drills and EMP surges.", FIELD.width / 2, top + 192);
    ctx.fillText("An EMP (E) darkens every camera for six seconds, at the price of a surge.", FIELD.width / 2, top + 218);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.fillText("WASD — move    Shift — tiptoe    Click — decoy coin    E — EMP    Esc — pause", FIELD.width / 2, top + 266);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "700 19px system-ui, sans-serif";
    if (Math.sin(state.time * 3.2) > -0.2) ctx.fillText("Press Enter or click to go in", FIELD.width / 2, top + 320);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "400 13px system-ui, sans-serif";
    ctx.fillText("An original heist in three galleries", FIELD.width / 2, top + 362);
  }

  function paintBlown(state, meta) {
    ctx.fillStyle = "rgba(110, 12, 10, 0.45)";
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const top = centredPanel(640, 300).y;
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.danger;
    ctx.font = "700 54px system-ui, sans-serif";
    ctx.fillText("THE ALARM TRIPS", FIELD.width / 2, top + 88);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillText("Sirens, shutters, and a long walk home in handcuffs.", FIELD.width / 2, top + 132);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillText(`${state.gallery.name} · Carrying ${asMoney(state.take)} · ${asClock(meta.totalTime)} on the job`, FIELD.width / 2, top + 172);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText("Press Enter or R to run the gallery again", FIELD.width / 2, top + 232);
  }

  function paintClear(state, meta) {
    ctx.fillStyle = "rgba(8, 20, 14, 0.5)";
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const top = centredPanel(640, 290).y;
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.good;
    ctx.font = "700 44px system-ui, sans-serif";
    ctx.fillText("INTO THE NIGHT", FIELD.width / 2, top + 82);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillText(`${state.gallery.name} emptied to ${asMoney(state.take)} — over the fence's quota.`, FIELD.width / 2, top + 124);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillText(`Alarm peaked, time ${asClock(meta.totalTime)} · Haul so far ${asMoney(meta.totalTake)}`, FIELD.width / 2, top + 164);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText("Press Enter for the next gallery", FIELD.width / 2, top + 224);
  }

  // The fence grades a finished night by the size of its haul.
  function gradeOf(totalTake) {
    if (totalTake >= 290000) return "MASTER THIEF";
    if (totalTake >= 235000) return "PROFESSIONAL";
    if (totalTake >= 175000) return "CAREFUL HAND";
    return "SMASH-AND-GRAB";
  }

  function paintWin(meta) {
    ctx.fillStyle = "rgba(8, 12, 6, 0.55)";
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const top = centredPanel(700, 370).y;
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "700 48px system-ui, sans-serif";
    ctx.fillText("A CLEAN JOB", FIELD.width / 2, top + 84);
    ctx.fillStyle = PALETTE.text;
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillText("All three galleries hit in one night, and the museum none the wiser.", FIELD.width / 2, top + 124);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "400 17px system-ui, sans-serif";
    ctx.fillText(`Total haul  ${asMoney(meta.totalTake)}  of ${asMoney(meta.maxTake)}`, FIELD.width / 2, top + 170);
    ctx.fillText(`Time  ${asClock(meta.totalTime)}      Pieces lifted  ${meta.grabs}      EMPs spent  ${meta.empsUsed}`, FIELD.width / 2, top + 200);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillText(`The fence's verdict: ${gradeOf(meta.totalTake)}`, FIELD.width / 2, top + 246);
    if (meta.best !== null) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = "400 15px system-ui, sans-serif";
      ctx.fillText(`Richest night so far  ${asMoney(meta.best)}`, FIELD.width / 2, top + 278);
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText("Press Enter to plan another night", FIELD.width / 2, top + 322);
  }

  function paintPaused() {
    ctx.fillStyle = "rgba(6, 10, 8, 0.6)";
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.text;
    ctx.font = "700 42px system-ui, sans-serif";
    ctx.fillText("PAUSED", FIELD.width / 2, FIELD.height / 2 - 8);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillText("The museum holds its breath. Esc or Enter to go on.", FIELD.width / 2, FIELD.height / 2 + 28);
  }

  function render(state, screen, meta) {
    fitCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(zoom, 0, 0, zoom, offX, offY);
    // Annotations belong to the live room; the menu and verdict screens
    // keep the plain room behind their panels.
    const live = screen === VIEW_PLAY || screen === VIEW_PAUSED;
    paintFloor(state);
    if (live) paintPatrolRoutes(ctx, state);
    paintVan(state);
    paintVault(state);
    paintCover(state);
    state.loot.forEach((item, index) => paintLoot(item, index));
    paintRipples(state);
    paintCoins(state);
    if (live) paintCameraSweeps(ctx, state);
    paintCones(state);
    if (live) paintDrillHalo(ctx, state);
    for (const g of state.guards) paintGuard(g);
    for (const cam of state.cameras) paintCamera(state, cam);
    paintThief(state);
    if (live) {
      paintWardenBadges(ctx, state);
      paintThiefTag(ctx, state);
    }
    if (screen !== VIEW_TITLE) paintHud(state, meta);
    if (screen === VIEW_PLAY) {
      paintLegend(ctx, state);
      paintCallouts(ctx, meta.callouts);
    }
    if (screen === VIEW_TITLE) paintTitle(state);
    else if (screen === VIEW_PAUSED) paintPaused();
    else if (screen === VIEW_BLOWN) paintBlown(state, meta);
    else if (screen === VIEW_CLEAR) paintClear(state, meta);
    else if (screen === VIEW_WIN) paintWin(meta);
  }

  return { render, toRoom };
}
