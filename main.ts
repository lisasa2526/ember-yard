// Ember Yard — entrypoint for make.fun competition threejs-fps-01.
// Node 22, standard library only. The game itself is the static files in
// game/ (three.js 0.187.0 vendored under game/vendor/three/, wired up by the
// import map in game/index.html). This program is the packager: it copies
// game/ plus the four screenshots into the output directory and writes
// dossier.json, the summary the judge reads, via the vendored make.fun
// helper in vendor/makefun-threejs.ts.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it:      node serve.ts  →  http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(src, dst) {
  if (existsSync(src)) cpSync(src, dst, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(join(root, 'game'), join(outDir, 'game'));
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
copyTree(join(root, 'screenshots'), join(outDir, 'screenshots'));

// Limits mirror the scorer's gates (see reference/gate.json): the dossier
// text is capped, at most 4 screenshots of at most 256 KiB each, and game/
// must stay under 993 files / 48 MiB (it counts against /output's own
// 1000-entry ceiling alongside screenshots/ and dossier.json).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
