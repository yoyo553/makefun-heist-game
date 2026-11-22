# The Glass Vault

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/yoyo553/makefun-heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/yoyo553/makefun-heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

An original top-down heist game made for the make.fun "best heist game" bounty. One thief,
three galleries of the Meridian Museum, and a single alarm meter between the loot and the
getaway van.

## How to play

- **WASD / arrow keys** — move
- **Shift** — tiptoe: slower, silent, and harder to notice
- **Stand at a case or painting** — lift it (the vault works the same way: stand at it to
  crack it, but its drill hums and carries)
- **Click** — toss a decoy coin: its clink draws a nearby guard away
- **E** — fire an EMP charge: every camera goes dark for six seconds, at the price of a
  surge on the alarm meter. Charges are limited per gallery
- **Esc / P** — pause · **R** — retry a gallery after the alarm trips

Guards patrol with vision cones; cameras sweep their own red cones; pillars, cabinets,
partitions and the cases themselves block sight. Everything feeds **one ALARM meter** —
being seen, lifting a case (that little click), the vault drill, EMP surges. Fill it and
the job is blown. Each gallery has a **quota**: the van only leaves once the fence's minimum
is in the bag, so the big vault is a temptation, never a requirement — until Gallery III,
where the quota all but demands it. Clear all three galleries in one night for the fence's
verdict, from SMASH-AND-GRAB to MASTER THIEF.

## Running it locally

Requires Node.js 22.18 or later.

```
node serve.ts          # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in a desktop browser and play. The game is plain static files
under `game/` — no build step, no network requests.

## Handing it in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` there with `buildDossier` from `vendor/makefun-game.ts`:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the page: one canvas and a screen-reader status line
- `game/src/config.js` — every tuning number and colour
- `game/src/levels.js` — the three galleries as data: cover, loot, vaults, patrols, cameras
- `game/src/vision.js` — raycast sight: cone polygons and line-of-sight tests
- `game/src/world.js` — the simulation: the alarm, guards, cameras, grabbing, cracking, EMP
- `game/src/input.js` — keyboard and mouse
- `game/src/render.js` — all drawing: the galleries, the cones, the HUD and the screens
- `game/src/sound.js` — small WebAudio sounds, synthesised, no audio files
- `game/src/shots.js` — the deterministic scenes behind the screenshots (`?shot=…`)
- `game/src/main.js` — boot, the fixed-step loop and the screen changes
- `screenshots/` — four real renders of the game (title, a lift in progress, a near-trip of
  the alarm, the clean-job results)
- `shots.json` — which scene and seed produced each screenshot

MIT licensed (see `LICENSE`). All names, art, levels and sounds are original to this game.
