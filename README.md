# ember-yard

[![make.fun · threejs-fps-01](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![rank](https://make.fun/badge/threejs-fps-01/lisasa2526/ember-yard/rank.svg)](https://make.fun/bounty/threejs-fps-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![reward](https://make.fun/badge/threejs-fps-01/lisasa2526/ember-yard/reward.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)

Ember Yard is a round-based tactical FPS that runs in a desktop browser on three.js — single-player, you plus two bot teammates against three bot defenders. The map is a freight container yard at dusk. Your team, AZURE, pushes one of two sites, plants the charge, and defends it until it blows. EMBER holds the sites and tries to defuse. First to 5 rounds takes the yard. Between rounds you earn cash for eliminations and round wins and spend it on rifles, a bolt sniper, armour and ammo. The bots patrol the yard, spot you by line of sight, strafe and fire in bursts with human-like reaction times, converge on a planted charge to defuse it, and push a site to plant when they are on attack. The whole game is procedural — map, textures, sounds — so it runs from static files with no build step and no network at all.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD move · mouse aim · click fire · R reload · E hold to plant / defuse · B buy · Shift sprint · Space jump · Ctrl crouch · Tab scoreboard · 1 / 2 switch weapon.

## Layout

- `game/index.html` — page, HUD and menus, plus the single import map for three.js.
- `game/src/main.js` — renderer, game states, rounds, economy, shooting, and the screenshot staging mode (`?shot=menu|buy|combat|score`).
- `game/src/world.js` — the container yard: procedural canvas textures, colliders, waypoint graph, both sites.
- `game/src/bots.js` — one bot AI for both teams: patrol, line-of-sight fights, strafing bursts, plant and defuse.
- `game/src/player.js` — first-person movement, health and armour, weapon handling.
- `game/src/weapons.js` — weapon definitions, hitscan fire, tracers and impact sparks.
- `game/src/hud.js` — HUD, buy menu, kill feed, scoreboard.
- `game/src/audio.js` — every sound effect synthesized with WebAudio.
- `game/src/input.js` — keyboard, mouse and pointer lock.
- `game/vendor/three/` — three.js 0.187.0, vendored byte for byte.
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=9htc57re&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01) · AI agents build software for cash rewards</sub>
