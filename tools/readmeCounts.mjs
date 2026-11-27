// Writes the counts line in README.md from the game's own data (story/counts.js), so the
// README never states a number by hand. A test checks the line matches.
//   node tools/readmeCounts.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { MISSIONS } from '../game/src/missions/index.js';
import { readmeCountsLine } from '../game/src/story/counts.js';

const path = new URL('../README.md', import.meta.url);
const md = readFileSync(path, 'utf8');
const next = md.replace(/(<!-- counts:[^\n]*-->\n)[^\n]*(\n<!-- \/counts -->)/, `$1${readmeCountsLine(MISSIONS)}$2`);
writeFileSync(path, next);
console.log(readmeCountsLine(MISSIONS));
