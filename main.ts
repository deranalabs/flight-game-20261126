// Tidewing hand-in program (Node 22, standard library only). The game itself is the static
// folder game/ (index.html, its ES modules under game/src, three.js vendored as one
// minified file under game/vendor). This program copies game/ and the screenshots to the
// output folder and writes dossier.json with the kit's own buildDossier, unchanged.
// Output goes to /output in the grader, or to MAKEFUN_OUTPUT_DIR when that is set:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
const shots = join(repoDir, 'screenshots');
if (existsSync(shots)) cpSync(shots, join(outDir, 'screenshots'), { recursive: true });

// The scorer's caps: text_max_bytes shapes the dossier text, the rest refuse what the
// scorer would refuse (4 screenshots of 256 KiB, 993 game files, 48 MiB, 1000-byte paths).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
