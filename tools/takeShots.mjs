// Takes the entry's screenshots: for each shot in shots.json, headless Chrome opens the
// game's own shot mode at 1280x800 from a local server and saves a PNG, then sips turns
// it into a JPEG under 256 KiB. Real renders of the game's code, never edited.
//   node serve.ts --port 8126 &   then   node tools/takeShots.mjs
// Needs Google Chrome and macOS sips; writes into screenshots/.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:8126/';
// ONLY=2,4 re-renders just those shots (by their leading number)
const only = process.env.ONLY?.split(',');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8')).filter((s) => !only || only.includes(s.name.split('-')[0]));
const tmp = join(root, 'out', 'shots-tmp');
mkdirSync(tmp, { recursive: true });

for (const s of shots) {
  const png = join(tmp, s.name.replace(/\.\w+$/, '.png'));
  execFileSync(chrome, [
    '--headless=new', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1280,800', '--force-device-scale-factor=1', '--virtual-time-budget=45000',
    `--user-data-dir=${join(tmp, 'profile')}`, `--screenshot=${png}`, `${base}${s.query}`,
  ], { stdio: 'ignore', timeout: 180000 });
  const out = join(root, 'screenshots', s.name);
  let q = 82;
  for (;;) {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), png, '--out', out], { stdio: 'ignore' });
    const size = statSync(out).size;
    // 200 KiB keeps four shots plus the source text under the dossier's 1.5 MiB cap
    if (size <= 200 * 1024 || q <= 40) { console.log(`${s.name}: ${Math.round(size / 1024)} KiB at q${q}`); break; }
    q -= 8;
  }
}
rmSync(tmp, { recursive: true, force: true });
