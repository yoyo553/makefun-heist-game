// A tiny seeded random source (mulberry32) and a position hash. The simulation
// never touches Math.random: one seed decides a whole job, which is why the
// screenshot scenes staged in shots.js always come out identical.

// Next pseudo-random number in [0, 1) from `seed`, as a function to call.
export function createRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = s;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

// A steady 0..1 number from two integers, for decoration that must not shimmer
// from one frame to the next.
export function hash01(a, b) {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
