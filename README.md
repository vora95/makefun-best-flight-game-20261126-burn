# Sunset Cargo Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/vora95/makefun-best-flight-game-20261126-burn/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/vora95/makefun-best-flight-game-20261126-burn/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 3D bush-plane cargo game (Three.js) for the **best-flight-game-20261126-0057** bounty. Fly an old bush plane between four low-poly islands at sunset, delivering cargo to three airstrips before dark. Every landing is scored on centreline accuracy, touchdown speed and softness; fuel is limited, the crosswind changes every leg, and three lots of damage end the run.

## How to play

Take off from the Sunset Field runway, follow the cargo manifest to each island in order — Palm Cay, Turtle Rock, Coral Bay — and land on the strip. Each landing refuels the plane. Finish all three legs to complete the mission.

## Controls

| Key | Action |
| --- | --- |
| W / S | Throttle up / down |
| ← / → | Bank / roll |
| ↑ / ↓ | Pitch up / down |
| A / D | Rudder |
| F | Flaps |
| G | Landing gear |
| B (hold) | Brake |
| P | Pause |
| M | Mute |
| R | Restart |
| Enter | Start / continue |

## Scoring

- Landing: up to 800 points per leg (200 base + 300 centreline + 150 touchdown speed + 150 softness)
- Time bonus on mission completion: up to +450
- Damage: hard landings, gear-up touchdowns and ditching in the sea cost 1 damage each; 3 damage ends the run

## Tech

- Three.js 0.170.0 vendored locally (`game/vendor/three.module.min.js`), no network references
- Fixed-step (60 Hz) flight model: lift/drag/throttle/pitch/roll, stall sink, crosswind drift, fuel burn
- Analytic terrain: the same height function builds the island meshes and drives ground collision
- Procedural WebAudio engine/wind/landing sounds — no audio files
- Deterministic screenshot scenes via `?shot=menu|cruise|approach|delivery&seed=1` with a fixed-step autopilot

## Files

- `game/index.html` — page, HUD and screens
- `game/src/main.js` — bootstrap + fixed-step loop + camera
- `game/src/config.js` — constants, islands, legs, tuning
- `game/src/input.js` — keyboard state + edge toggles
- `game/src/flight.js` — flight model (lift/drag/throttle/pitch/roll)
- `game/src/world.js` — sea, islands, sky, sun, clouds, airstrips
- `game/src/plane.js` — bush-plane mesh (propeller, gear, nav lights)
- `game/src/missions.js` — cargo legs, landing scoring, fuel, wind
- `game/src/hud.js` — HUD + title/pause/leg/complete/game-over screens
- `game/src/audio.js` — procedural WebAudio sounds
- `game/src/shots.js` — deterministic screenshot scenes + autopilot
- `main.ts` — entry program: copies `game/` + `screenshots/` to the output dir and writes `dossier.json`

## Run locally

```sh
node serve.ts
# open http://localhost:8080
```

## License

SPDX-License-Identifier: MIT — see `LICENSE`.
