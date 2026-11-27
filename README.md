[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/deranalabs/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/deranalabs/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Tidewing: Cinder Reach Air Service

A bush floatplane flight game in the browser. You fly the Tern Mk II, an amphibious high-wing floatplane, for the islands of the Cinder Reach: a volcano, a ridge island, fishing villages, a lighthouse point and a far skerry, with a runway, a dirt strip on a ridge and marked water lanes.

Ten sorties, one file each under `game/src/missions/`: a mail drop run, a ring trial around the volcano, a medevac with soft-landing limits and a patient who feels every bump, a 380 m ridge strip, water bombing three spreading fires from a lagoon scoop run, a night lighthouse run through flare gates, a squall-line crossing on low fuel with an optional fuel stop, a dead-stick glide after the engine chokes on volcanic ash, a harbour board photo survey over the observatory, dock and fuel barge, and a low buoy slalom off Halyard Harbour.

The flight model (`game/src/flight/flightModel.js`) has lift with a stall and wing drop, induced and parasite drag, flaps, thrust that fades with speed, control authority that grows with airspeed and prop wash, wind with gusts, storm downdrafts and rotor off the volcano, float and wheel contact with water, runways and strips, bounces, and touchdowns graded by sink rate, centreline and bounces. Crashes say what happened. Fuel burns by throttle, the engine heats and can be hurt, and damage to the engine, airframe, floats and controls changes the handling.

Around the flights: a hangar with repairs and upgrades that cost shillings, a pilot's logbook with ratings and stars, seven radio characters with live states, and a career saved in the browser. Chase and cockpit views, a lit instrument panel (airspeed, attitude, altimeter, heading, vertical speed, RPM, fuel, cylinder temperature, levers, warning lights, damage), and sound made in code with WebAudio.

Play it with `node serve.ts` and open http://localhost:8080. Keys: W/S pitch, A/D roll, Q/E rudder, Shift/Ctrl or the wheel for throttle, F/V flaps, B brakes, Space drop, C camera, M mouse yoke, Z autopilot, R restart engine, L landing light, Esc pause.

Tests: `node --test test/*.test.mjs` checks the flight model and has the autopilot fly every mission to completion. Screenshots come from the game's shot mode (`?shot=cover`, `cockpit`, `night`, `hangar`) via `node tools/takeShots.mjs`.

three.js 0.187.0 is vendored as one minified file in `game/vendor/`. Everything else is this repository's own code.

MIT, see LICENSE
