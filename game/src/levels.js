// The three galleries of the Meridian Museum, as data. Cover blocks walking
// and sight alike: marble pillars, cabinets, partition walls, and the display
// cases themselves. Loot sits in cases (kind "case") or hangs as paintings on
// partition walls (kind "painting"); every loot rectangle is also a cover
// rectangle. Each gallery has a quota — the fence's minimum — a vault worth
// cracking at the far end, patrols to read, cameras to dodge or fry, and the
// getaway van waiting where the thief came in.
//
// A guard whose path has a single point is a sentinel: it stands there and
// sweeps its gaze.

export const GALLERIES = [
  {
    name: "Gallery I — The Jewel Room",
    intro: "Lift $40,000 of jewels and slip back to the van. The sapphire vault is gravy.",
    quota: 40000, empCharges: 2,
    start: { y: 360, x: 128 },
    van: { h: 84, w: 64, y: 318, x: 26 },
    vault: { crackSeconds: 2, value: 30000, name: "The Star Sapphire", h: 56, w: 128, y: 30, x: 576 },
    carpets: [ // red runners on the marble
      { h: 76, w: 1080, y: 322, x: 100 },
      { h: 236, w: 128, y: 86, x: 576 },
    ],
    cover: [ // pillars, cabinets and cases block walking and sight alike
      { h: 44, w: 44, y: 150, x: 300, kind: "pillar" },
      { h: 44, w: 44, y: 526, x: 300, kind: "pillar" },
      { h: 44, w: 44, y: 150, x: 936, kind: "pillar" },
      { h: 44, w: 44, y: 526, x: 936, kind: "pillar" },
      { h: 110, w: 36, y: 120, x: 150, kind: "cabinet" },
      { h: 110, w: 36, y: 490, x: 150, kind: "cabinet" },
      { h: 44, w: 64, y: 180, x: 470, kind: "case" },
      { h: 44, w: 64, y: 180, x: 810, kind: "case" },
      { h: 44, w: 64, y: 480, x: 470, kind: "case" },
      { h: 44, w: 64, y: 480, x: 810, kind: "case" },
    ],
    loot: [
      { value: 12000, name: "Crimson Ruby", h: 44, w: 64, y: 180, x: 470, kind: "case" },
      { value: 15000, name: "Gold Astrolabe", h: 44, w: 64, y: 180, x: 810, kind: "case" },
      { value: 10000, name: "Pearl Tiara", h: 44, w: 64, y: 480, x: 470, kind: "case" },
      { value: 8000, name: "Ivory Fan", h: 44, w: 64, y: 480, x: 810, kind: "case" },
    ],
    guards: [
      { path: [[200, 270], [1080, 270]] },
      { path: [[1080, 452], [200, 452]] },
    ],
    cameras: [
      { facing: 0.5, y: 110, x: 520 },
    ],
  },
  {
    name: "Gallery II — The Painted Hall",
    intro: "The fence wants $55,000. Paintings are slow to carry — pick your route.",
    quota: 55000, empCharges: 2,
    start: { y: 360, x: 128 },
    van: { h: 84, w: 64, y: 318, x: 26 },
    vault: { crackSeconds: 2.5, value: 35000, name: "The Meridian Egg", h: 56, w: 128, y: 30, x: 1050 },
    carpets: [ // one runner down the middle
      { h: 76, w: 1080, y: 322, x: 100 },
    ],
    cover: [
      { h: 180, w: 26, y: 120, x: 400, kind: "wall" },
      { h: 180, w: 26, y: 120, x: 854, kind: "wall" },
      { h: 180, w: 26, y: 420, x: 400, kind: "wall" },
      { h: 180, w: 26, y: 420, x: 854, kind: "wall" },
      { h: 44, w: 44, y: 180, x: 180, kind: "pillar" },
      { h: 44, w: 44, y: 496, x: 180, kind: "pillar" },
      { h: 44, w: 44, y: 496, x: 1056, kind: "pillar" },
      { h: 44, w: 64, y: 180, x: 590, kind: "case" },
      { h: 44, w: 64, y: 496, x: 590, kind: "case" },
      { h: 44, w: 64, y: 338, x: 608, kind: "case" },
    ],
    loot: [
      { value: 20000, name: "The Drowned King", h: 180, w: 26, y: 120, x: 400, kind: "painting" },
      { value: 16000, name: "Sisters at Dusk", h: 180, w: 26, y: 120, x: 854, kind: "painting" },
      { value: 9000, name: "Jeweled Snuffbox", h: 44, w: 64, y: 180, x: 590, kind: "case" },
      { value: 14000, name: "Emperor's Seal", h: 44, w: 64, y: 496, x: 590, kind: "case" },
      { value: 11000, name: "Silver Menagerie", h: 44, w: 64, y: 338, x: 608, kind: "case" },
    ],
    guards: [
      { path: [[320, 130], [320, 590]] },
      { path: [[960, 590], [960, 130]] },
      { path: [[240, 620], [1040, 620]] },
    ],
    cameras: [
      { facing: 0.35, y: 140, x: 110 },
      { facing: -0.35 + Math.PI, y: 576, x: 1170 },
    ],
  },
  {
    name: "Gallery III — The Meridian Vault",
    intro: "$90,000 or the night is wasted. The big vault sings while it opens — be quick.",
    quota: 90000, empCharges: 3,
    start: { y: 360, x: 128 },
    van: { h: 84, w: 64, y: 318, x: 26 },
    vault: { crackSeconds: 3.5, value: 80000, name: "THE MERIDIAN VAULT", h: 64, w: 200, y: 30, x: 540 },
    carpets: [ // the long runner to the big vault
      { h: 76, w: 1080, y: 322, x: 100 },
      { h: 540, w: 128, y: 94, x: 576 },
    ],
    cover: [
      { h: 44, w: 44, y: 200, x: 470, kind: "pillar" },
      { h: 44, w: 44, y: 200, x: 766, kind: "pillar" },
      { h: 44, w: 44, y: 470, x: 470, kind: "pillar" },
      { h: 44, w: 44, y: 470, x: 766, kind: "pillar" },
      { h: 120, w: 36, y: 140, x: 150, kind: "cabinet" },
      { h: 120, w: 36, y: 140, x: 1094, kind: "cabinet" },
      { h: 120, w: 36, y: 460, x: 150, kind: "cabinet" },
      { h: 120, w: 36, y: 460, x: 1094, kind: "cabinet" },
      { h: 60, w: 64, y: 330, x: 608, kind: "pillar" },
      { h: 44, w: 64, y: 300, x: 300, kind: "case" },
      { h: 44, w: 64, y: 300, x: 916, kind: "case" },
      { h: 44, w: 64, y: 520, x: 300, kind: "case" },
      { h: 44, w: 64, y: 520, x: 916, kind: "case" },
    ],
    loot: [
      { value: 25000, name: "Crown of Tides", h: 44, w: 64, y: 300, x: 300, kind: "case" },
      { value: 18000, name: "The Orlov Mirror", h: 44, w: 64, y: 300, x: 916, kind: "case" },
      { value: 15000, name: "Sunset Opal", h: 44, w: 64, y: 520, x: 300, kind: "case" },
      { value: 12000, name: "Ivory Choir", h: 44, w: 64, y: 520, x: 916, kind: "case" },
    ],
    guards: [
      { path: [[220, 140], [1060, 140]] },
      { path: [[1060, 430], [220, 430]] },
      { sweep: true, path: [[640, 190]] },
    ],
    cameras: [
      { facing: Math.PI * 0.5, y: 120, x: 640 },
      { facing: 0, y: 360, x: 110 },
      { facing: Math.PI, y: 360, x: 1170 },
    ],
  },
];
