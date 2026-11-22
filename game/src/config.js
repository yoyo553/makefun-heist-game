// All of The Glass Vault's tuning numbers and colours, gathered in one file.
// Every gallery is a fixed 1280x720 logical room and the renderer stretches it
// to fit the window, so none of these rules cares what size the screen is.

export const FIELD = { width: 1280, height: 720 };

// One simulation step, in seconds: 60 ticks a second no matter the display.
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 156,
  tiptoeSpeed: 88,
  // Seconds between footstep ripples while walking; tiptoeing makes none.
  stepInterval: 0.36,
  // How far a walking footstep reaches: a guard inside this turns to look.
  stepNoiseRadius: 115,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 66,
  investigateSpeed: 98,
  // How long a guard waits at a patrol point before moving on.
  pauseSeconds: 1.1,
  // Radians a standing guard's gaze wanders to each side of where it faces.
  sweepAngle: 0.7,
  sweepSpeed: 0.9,
};

export const VISION = {
  range: 215,
  halfAngle: 0.62,
  // When a guard's awareness reaches this, it stops and stares (and the
  // alarm climbs fast).
  stareAt: 0.3,
};

export const CAMERA = {
  range: 175,
  halfAngle: 0.5,
  sweepAngle: 0.85,
  sweepSpeed: 0.55,
  // How long an EMP charge keeps every camera in the room dark.
  disableSeconds: 6,
};

export const ALARM = {
  // Alarm per second from a guard's sight at point blank.
  guardFill: 0.5,
  // Alarm per second from a camera's sight at point blank.
  cameraFill: 0.3,
  // Alarm shed per second while no one is looking at the thief.
  decayRate: 0.016,
  // Alarm in one go when a case is lifted: the lock's little click.
  grabBump: 0.04,
  // Alarm in one go when an EMP fires: the surge is noticed.
  empBump: 0.12,
  // Alarm per second while the vault drill is humming.
  crackRate: 0.02,
};

export const GRAB = {
  // Seconds standing at a case or painting to take it.
  seconds: 0.7,
  // How far past an item's own rectangle the thief can reach.
  reach: 18,
};

export const COIN = {
  // How far from the thief a tossed decoy coin may land.
  throwRange: 280,
  // How far its clink carries: guards inside this come to look.
  noiseRadius: 205,
  cooldown: 1.1,
  flightSeconds: 0.45,
};

export const PALETTE = {
  backdrop: '#0a0d0c',
  floor: '#15211c',
  floorAlt: '#182720',
  carpet: '#6e1f2a',
  carpetEdge: '#a03a44',
  pillar: '#c9ced6',
  pillarEdge: '#8f97a3',
  cabinet: '#3d2f22',
  cabinetEdge: '#5f4a33',
  wall: '#4b4238',
  wallEdge: '#6e6151',
  caseGlass: 'rgba(158, 205, 235, 0.2)',
  caseFrame: '#8a6d35',
  gold: '#e8b64c',
  paintingInk: '#2c3e50',
  vault: '#7d8590',
  vaultEdge: '#aeb6bf',
  thief: '#23252f',
  thiefTrim: '#e8b64c',
  guard: '#e6ddc8',
  guardCap: '#5e2432',
  coneGuard: '255, 198, 92',
  coneGuardWary: '255, 145, 66',
  coneCamera: '255, 92, 80',
  text: '#eef1f5',
  muted: '#9db3a8',
  panel: 'rgba(10, 14, 12, 0.87)',
  danger: '#ff5449',
  good: '#7bc47f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Where the richest night so far is kept (this browser only): richest first,
// then fastest.
export const BEST_KEY = 'glass-vault.best';
