// Sight, worked out with rays. Every solid in a gallery — pillar, cabinet,
// partition, case, and the vault itself — is a rectangle; each of its four
// edges is a segment, and a vision cone is the fan of rays an eye throws
// across its field of view, each one stopped by the first segment it meets.
// The same ray test answers the simpler question the alarm rules ask: can
// this guard or camera actually see the thief, or is a case in the way?

import { FIELD } from './config.js';

// The four edges of a rectangle, as segments {x1, y1, x2, y2}.
function edgesOf(rect, out) {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  out.push(
    { x1: rect.x, y1: rect.y, x2: right, y2: rect.y },
    { x1: right, y1: rect.y, x2: right, y2: bottom },
    { x1: right, y1: bottom, x2: rect.x, y2: bottom },
    { x1: rect.x, y1: bottom, x2: rect.x, y2: rect.y },
  );
}

// Every blocking segment for a set of solid rectangles, plus the room border.
export function buildSegments(solids) {
  const segments = [];
  for (const rect of solids) edgesOf(rect, segments);
  edgesOf({ x: 0, y: 0, w: FIELD.width, h: FIELD.height }, segments);
  return segments;
}

// Distance from (ox, oy) along `angle` to the nearest segment, or `maxDist`
// when nothing is hit. Plain ray/segment intersection: solve
// o + t*d = a + u*(b-a) for t >= 0 and 0 <= u <= 1.
export function rayDistance(ox, oy, angle, segments, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    const ex = s.x2 - s.x1;
    const ey = s.y2 - s.y1;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const rx = s.x1 - ox;
    const ry = s.y1 - oy;
    const t = (rx * ey - ry * ex) / denom;
    const u = (rx * dy - ry * dx) / denom;
    if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

// True when nothing stands on the straight line from (x1, y1) to (x2, y2).
export function lineOfSight(x1, y1, x2, y2, segments) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist < 1e-6) return true;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return rayDistance(x1, y1, angle, segments, dist) >= dist - 0.5;
}

// The polygon of a vision cone: the eye's position, then the end of a ray
// every few degrees across the cone, each ray stopped by the first solid it
// meets. Filled in, it is the sweep of light or lens a thief must stay out of.
export function conePolygon(x, y, facing, range, halfAngle, segments) {
  const RAY_STEP = 0.045;
  const points = [{ x, y }];
  for (let a = -halfAngle; a <= halfAngle + 1e-6; a += RAY_STEP) {
    const angle = facing + a;
    const d = rayDistance(x, y, angle, segments, range);
    points.push({ x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d });
  }
  return points;
}

// Smallest signed gap between two angles, in (-PI, PI].
export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// Turn `facing` toward `target` by no more than `maxTurn`.
export function turnToward(facing, target, maxTurn) {
  const gap = angleDifference(facing, target);
  if (Math.abs(gap) <= maxTurn) return target;
  return facing + Math.sign(gap) * maxTurn;
}
