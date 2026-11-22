// The hand-in program for "The Glass Vault" (Node 22, standard library only).
// It stages the finished game for the grader: the static site in game/ and the
// screenshots/ renders are copied into the output folder, and dossier.json is
// written there with buildDossier from the vendored make.fun library. The game
// itself needs no build step and makes no network requests, so the program is
// just copying plus the dossier call. To run it outside the grader:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play instead: `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const TITLE = 'The Glass Vault';

// The folder this file lives in, and the folder the grader reads from.
const rootDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy one top-level folder into the output, refusing to hand in half a game. */
function copyFolder(folder) {
  const source = join(rootDir, folder);
  if (!existsSync(source)) {
    throw new Error(`cannot hand in ${folder}/: it is not in the repository`);
  }
  const target = join(outDir, folder);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
for (const folder of ['game', 'screenshots']) copyFolder(folder);

// These limits mirror the scorer's own (see the competition's reference/gate.json):
// at most four screenshots of 256 KiB, at most 993 files and 48 MiB under game/,
// no game path longer than 1,000 bytes, and the dossier text capped at 160 KiB.
// Only text_max_bytes changes what is written; the other limits simply refuse
// an entry the scorer would refuse anyway.
const dossierText = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossierText);

const shotFiles = readdirSync(join(outDir, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
console.log(`${TITLE}: game, screenshots (${shotFiles.length} files) and dossier.json are in ${outDir}`);
console.log(`dossier.json: ${Buffer.byteLength(dossierText, 'utf8')} bytes (cap 1572864)`);
