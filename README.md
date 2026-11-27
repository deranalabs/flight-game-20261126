[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/deranalabs/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/deranalabs/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Tidewing: Port Halyard Air Service

A floatplane pilot owes the Port Halyard Board 12,000 sh and flies contracts across the Cinder Reach to clear it before the season closes.

<!-- counts: written by `node tools/readmeCounts.mjs` from the game's own data; a test checks them -->
**10 SORTIES · 4 MISSION TYPES · 25 FEATS · 12 REFITS** · 4 chapters · 6 islands
<!-- /counts -->

A bush floatplane flight game in the browser, built on three.js. You fly the Tern Mk II, an amphibious high-wing floatplane, over the islands of the Cinder Reach: a volcano, a ridge island, fishing harbours, a lighthouse point and a far skerry, with a runway, a ridge strip and marked water lanes.

## What ships

- **Mission types, each with its own HUD panel.** Ring courses (a ring counter and streak), fire and drop runs (a drop meter, a DROP ZONE cue, fires out n/m), precision landings (a sink meter, PAPI lights, a glideslope ladder and MINIMUMS callouts), and cargo and survey hauls (the load and stops). The sorties live one per file under `game/src/missions/`.
- **The Harbour Board story** (`game/src/story/storyline.js`). Its chapters are laid over the real sortie count: THE NOTE, THE WORK, THE SQUEEZE and THE RECKONING. Each sortie is a contract for a named person on a named island. A chapter plate opens every sortie, and the clerk's notice is read on the radio. In chapter 3 the Board raises its fee, and one contract makes you choose between the Board's charter and the clinic's spare parts; the choice changes the debt. The last sortie stamps one of three endings on the final receipt: PAID, PART-PAID with an extension, or UNPAID with a lien on the Tern.
- **The ledger** (`game/src/hangar/harbourDebt.js`). Every completed sortie pays one shilling per score point. Events add a bonus, and refits and the fee are charged. Every entry is kept.
- **Score, combo and debrief.** A sortie is scored out of 1000 from four parts: objectives, touchdown, time against par and fuel left. It is graded A to F. B-or-better runs build a combo of up to ×3. The debrief is a stamped receipt. It shows the grade, the score lines, a four-strip flight recorder (altitude, speed, fuel, load factor on one time axis, with the touchdown marked), one tip, the feats earned and three refit cards.
- **Decisions with a price** (`game/src/missions/pilotCalls.js`). At bingo fuel on the leg home, DECISION REQUIRED gives you a few seconds to choose. Press 1 to commit to the planned runway: you keep full pay, the box shows your reserve in minutes, and a flameout before the field ends the sortie with 900 sh charged. Press 2 to divert to the nearest other harbour: it is safe, but costs 450 sh and adds 6 minutes on the receipt. If you do not answer, the game commits. Damage is shown by part with its effect in numbers, for example ENGINE 57% · thrust −28% or AILERONS 70% · roll rate −17%, rolls left. A holed float under 50% means no sea landing. Each effect is one the flight model really applies. YOUR CALL then offers a repair at the next stop, priced in sh and minutes, or pressing on.
- **Feats and refits.** Feats carry medals and counters (`game/src/hangar/feats.js`), and refits change the numbers the flight model flies (`game/src/hangar/refits.js`, `game/src/aircraft/ternSpec.js`).
- **Live calls** (`game/src/feedback/liveCalls.js`). These answer the flying as it happens: CLEAN TURN · 37° BANK · SLIP CENTERED, ON RAILS x8, FLAPS 40 · 2 WHITE · ON SLOPE, MINIMUMS · LAND, DROP ZONE 330 M, speed band awards and BINGO FUEL.
- **A living world.** The gazetteer (`game/src/world/gazetteer.js`) lists each island's harbour, trade, landmark, custom and history. The people (`game/src/world/cast.js`) have moods and wants that change with the chapter. Events (`game/src/world/events.js`) include a squall front, an ash plume, regatta day and a ferry strike. Around the aircraft, fishing boats work the lanes, the ferry keeps its timetable, gulls wheel off the coast, windsocks swing with the real wind, quay lamps light at dusk, and the volcano smokes harder as the chapters turn.
- **Flight model** (`game/src/flight/flightModel.js`). It covers lift with a stall and wing drop, drag, flaps, prop thrust, wind with gusts, rotor and downdrafts, float and wheel contact, bounces, graded touchdowns, fuel burn, engine heat and damage that changes the handling.
- **Controls.** Keyboard, mouse yoke or a gamepad. The title screen sets the assist level: Easy gives auto rudder and a stall nudge, Standard flies the Tern as she is, and Expert has no hints and no autopilot. Key hints show for the first minute of a sortie. Press C to cycle the chase, cockpit and tail views.
- **Identity** (`game/src/identity/palette.js`, `docs/identity.md`). There is one palette: basalt, sulphur, lagoon teal and ledger cream, with ember red for the debt only. The game uses one display face and one numeral face, and one panel shape from `box()`. The Board's round DUE / PAID stamp appears on the screens, and the Tern has a teal fin with a sulphur sun.

## Play

```bash
node serve.ts
```

Open http://localhost:8080. Keys: W/S pitch, A/D roll, Q/E rudder, Shift/Ctrl or the wheel for throttle, F/V flaps, B brakes, Space drop, C camera, M mouse yoke, Z autopilot, R restart the engine, L landing light, Esc pause. When a decision box is open, 1 and 2 answer it.

## Tests and screenshots

`node --test test/*.test.mjs` checks the flight model, the PAPI rule, the ring-miss rule, and the score and combo. It also checks the counts against the data, every story ending, the fee and the choice, the feats, the refits and the live calls, and each priced decision: commit, divert, the countdown, the flameout, the receipt line, each damage effect and the field repair. The autopilot bot flies every sortie to completion and pays off the note.

The screenshots come from the game's own shot mode (`?shot=cover`, `bingo`, `damage`, `receipt`) through `node tools/takeShots.mjs`. The bot first flies the sorties before each moment, so the numbers in the frames are real.

three.js 0.187.0 is vendored as one minified file in `game/vendor/`. Everything else is this repository's own code.

MIT, see LICENSE
