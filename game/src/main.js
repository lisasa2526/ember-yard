// Ember Yard — game entry: renderer, states, rounds, economy, shooting, screenshots.
import * as THREE from 'three';
import { World, mulberry32 } from './world.js';
import { Player } from './player.js';
import { Bot } from './bots.js';
import { WEAPONS, SHOP, Tracers, Sparks, Muzzle } from './weapons.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // menu | buy | combat | score
const SEED = Number(params.get('seed') || 1);
const ROUND_TIME = 100, FUSE_TIME = 35, BUY_TIME = 12, WIN_ROUNDS = 5, MAX_ROUNDS = 9;

const canvasHost = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 400);
const world = new World(scene, SEED);
const sfx = new Sfx();
const hud = new Hud();
const input = new Input(renderer.domElement);
const tracers = new Tracers(scene);
const sparks = new Sparks(scene);
const muzzle = new Muzzle(scene, camera);
const player = new Player(world, camera, sfx);
const raycaster = new THREE.Raycaster();

// Bots: player + 2 AZ teammates vs 3 EM defenders.
const bots = [];
for (let i = 0; i < 2; i++) bots.push(new Bot(world, 'AZ', i, sfx));
for (let i = 0; i < 3; i++) bots.push(new Bot(world, 'EM', i, sfx));
bots.forEach((b) => scene.add(b.mesh));

// Hitbox meshes for raycasts (body + head per bot).
const hitMeshes = [];
function rebuildHitMeshes() {
  hitMeshes.length = 0;
  for (const b of bots) {
    b.mesh.traverse((m) => {
      if (m.isMesh) {
        m.userData.bot = b;
        m.userData.part = m.geometry?.type === 'SphereGeometry' ? 'head' : 'body';
        hitMeshes.push(m);
      }
    });
  }
}
rebuildHitMeshes();

// Viewmodel rifle attached to the camera.
const gun = new THREE.Group();
{
  const dark = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.45, metalness: 0.7 });
  const mid = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.5, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.55), dark);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 10), mid);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.42);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), mid);
  mag.position.set(0, -0.14, -0.02); mag.rotation.x = 0.2;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), mid);
  sight.position.set(0, 0.1, -0.1);
  gun.add(body, barrel, mag, sight);
  gun.position.set(0.26, -0.24, -0.45);
  camera.add(gun);
}
scene.add(camera);

// ---- game state ----
const G = {
  phase: 'menu', // menu | buy | round | roundEnd | matchEnd
  round: 1, scoreAz: 0, scoreEm: 0,
  timer: BUY_TIME, planted: false, plantSite: null, fuse: 0,
  lossStreak: 0, frozen: false, deadCam: 0,
  plantHold: 0, defuseNote: '',
  time: 0, volleyDone: false,
};
let rnd = mulberry32(SEED * 7919 + 13);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

function azSpawn(i) { return new THREE.Vector3(-26 + (i % 2) * 2.4, 0, 14 + i * 2.2); }
function emSpawn(i) { return new THREE.Vector3(26 - (i % 2) * 2.4, 0, -14 - i * 2.2); }

function resetPositions() {
  player.reset(world.spawnAz, G.round > 1, G.round > 1);
  bots.forEach((b, i) => {
    if (b.team === 'AZ') b.reset(azSpawn(i), i % 2 === 0 ? 'A' : 'B');
    else b.reset(emSpawn(i), i % 2 === 0 ? 'A' : 'B');
  });
}

function startMatch() {
  G.scoreAz = 0; G.scoreEm = 0; G.round = 1; G.lossStreak = 0;
  G.planted = false; G.plantSite = null;
  player.money = 800; player.weapons.primary = null; player.armor = 0;
  bots.forEach((b) => { b.kills = 0; b.deaths = 0; b.money = 800; });
  startBuyPhase();
}

function startBuyPhase() {
  G.phase = 'buy';
  G.timer = BUY_TIME;
  G.planted = false; G.plantSite = null; G.plantHold = 0;
  resetPositions();
  hud.showHud(true); hud.showMenu(false); hud.showEnd(false); hud.showBoard(false);
  hud.setObjective('<b>BUY PHASE</b> — gear up, then push <span class="site">SITE A</span> or <span class="site">SITE B</span> and plant the charge.');
  openShop();
  hud.banner(`ROUND ${G.round}`, G.round === 1 ? 'AZURE attacks — plant the charge' : '', '');
  syncHud();
}

function openShop() {
  const owned = player.weapons.primary ? [player.weapons.primary] : [];
  hud.buildShop(player.money, owned, buyItem);
  hud.setBuySub(`ROUND ${G.round} · $${player.money} · closes in ${Math.ceil(G.timer)}s — press B to close`);
  hud.showBuy(true);
  input.unlock();
}

function closeShop() { hud.showBuy(false); }

function buyItem(key) {
  const item = SHOP.find((s) => s.key === key);
  if (!item || player.money < item.price) return;
  if (key === 'armor') { player.giveArmor(); }
  else if (key === 'ammo') { player.refillAmmo(); }
  else { player.giveWeapon(key); }
  player.money -= item.price;
  sfx.click();
  syncHud();
  openShop();
}

function startRound() {
  closeShop();
  G.phase = 'round';
  G.timer = ROUND_TIME;
  hud.setObjective('Plant the charge at <span class="site">SITE A</span> or <span class="site">SITE B</span> — hold <b>E</b> on site. If the timer runs out, EMBER wins the round.');
  input.lock();
  syncHud();
}

function endRound(winner, reason) {
  if (G.phase !== 'round') return;
  G.phase = 'roundEnd';
  G.timer = 4;
  const azWin = winner === 'AZ';
  if (azWin) { G.scoreAz++; G.lossStreak = 0; } else { G.scoreEm++; G.lossStreak++; }
  const winBonus = 3000, lossBonus = Math.min(1900 + (G.lossStreak - 1) * 500, 2900);
  player.money += azWin ? winBonus : lossBonus;
  bots.forEach((b) => { b.money = (b.money || 800) + (b.team === winner ? winBonus : lossBonus); });
  hud.banner(azWin ? 'ROUND WON' : 'ROUND LOST', reason, azWin ? 'win' : 'lose');
  if (azWin) sfx.roundWin(); else sfx.roundLose();
  syncHud();
}

function endMatch() {
  G.phase = 'matchEnd';
  const azWin = G.scoreAz > G.scoreEm;
  const mvp = [...bots, player].sort((a, b) => b.kills - a.kills)[0];
  hud.end(azWin ? 'AZ' : 'EM', `Final ${G.scoreAz} — ${G.scoreEm} · MVP: ${mvp.name} with ${mvp.kills} eliminations.`);
  hud.scoreboard(scoreRows(), `Final — ${G.scoreAz} : ${G.scoreEm}`);
  hud.showBoard(true);
  input.unlock();
  syncHud();
}

function scoreRows() {
  const rows = [{ name: 'You', team: 'AZ', kills: player.kills, deaths: player.deaths, money: player.money, you: true }];
  for (const b of bots) rows.push({ name: b.name, team: b.team, kills: b.kills, deaths: b.deaths, money: b.money || 800 });
  return rows.sort((a, b) => b.kills - a.kills);
}

function syncHud() {
  hud.setVitals(player.hp, player.armor);
  const a = player.ammo[player.weaponKey];
  hud.setAmmo(a.mag, a.reserve, player.weaponKey, player.reloading > 0);
  hud.setScore(G.scoreAz, G.scoreEm, G.round, MAX_ROUNDS);
  hud.setMoney(player.money);
  hud.setTimer(G.planted ? G.fuse : G.timer);
}

// ---- shooting ----
function rayVsWorld(origin, dir, maxDist) {
  // Slab test against every AABB; returns nearest wall distance or Infinity.
  let best = Infinity;
  for (const c of world.colliders) {
    let tmin = 0, tmax = maxDist;
    for (let i = 0; i < 3; i++) {
      const o = origin.getComponent(i), d = dir.getComponent(i);
      const mn = c.min.getComponent(i), mx = c.max.getComponent(i);
      if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) { tmin = Infinity; break; } }
      else {
        let t1 = (mn - o) / d, t2 = (mx - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) break;
      }
    }
    if (tmin <= tmax && tmin < best && tmin > 0.01) best = tmin;
  }
  return best;
}

function shootFrom(origin, dir, weapon, shooter, isPlayerShot) {
  const maxDist = weapon.range;
  raycaster.set(origin, dir);
  raycaster.far = maxDist;
  const hits = raycaster.intersectObjects(hitMeshes.filter((m) => {
    const b = m.userData.bot;
    return b && b.alive && b !== shooter;
  }), false);
  const wallD = rayVsWorld(origin, dir, maxDist);
  const end = tmpV.copy(origin).addScaledVector(dir, maxDist);
  let hitBot = null, hitPart = 'body', hitPoint = null;
  if (hits.length && hits[0].distance < wallD) {
    hitBot = hits[0].object.userData.bot;
    hitPart = hits[0].object.userData.part;
    hitPoint = hits[0].point;
    end.copy(hitPoint);
  } else if (wallD < maxDist) {
    end.copy(origin).addScaledVector(dir, wallD);
  }
  // Muzzle + tracer from the shooter's gun.
  const muzzlePos = tmpV2.copy(origin).addScaledVector(dir, 0.7);
  muzzlePos.y -= 0.08;
  tracers.fire(muzzlePos, end, weapon.tracer);
  muzzle.flash(muzzlePos);
  if (hitBot) {
    const falloff = hits[0].distance > 30 ? 0.8 : 1;
    const dmg = weapon.damage * falloff * (hitPart === 'head' ? weapon.headMult : 1);
    const wasAlive = hitBot.alive;
    hitBot.takeDamage(dmg);
    sparks.burst(hitPoint, dir.clone().negate(), hitPart === 'head' ? 0xff6a5a : 0xffc46b);
    if (isPlayerShot) {
      hud.hitmarker(!hitBot.alive);
      sfx.hit(!hitBot.alive);
      if (wasAlive && !hitBot.alive) {
        player.kills++;
        player.money += 300;
        hud.feed('You', hitBot.name, 'AZ', hitPart === 'head');
      }
    }
    return hitBot;
  }
  if (wallD < maxDist) sparks.burst(end, dir.clone().negate());
  return null;
}

function botShoot(bot, target, dist) {
  const w = WEAPONS[bot.weaponKey];
  const moving = target.isPlayer
    ? Math.hypot(player.vel.x, player.vel.z) > 2
    : true;
  let p = 0.6 - dist * 0.006 - (moving ? 0.08 : 0);
  p = Math.max(0.12, Math.min(0.75, p));
  const origin = bot.eyePos(new THREE.Vector3());
  origin.y -= 0.1;
  const to = tmpV.copy(target.pos); to.y = 1.4;
  const dir = to.sub(origin).normalize();
  dir.x += (rnd() - 0.5) * 0.05; dir.y += (rnd() - 0.5) * 0.04; dir.z += (rnd() - 0.5) * 0.05;
  dir.normalize();
  sfx.shot(bot.weaponKey);
  if (rnd() < p) {
    const head = rnd() < 0.08;
    const dmg = w.damage * (dist > 30 ? 0.8 : 1) * (head ? w.headMult : 1);
    if (target.isPlayer) {
      player.takeDamage(dmg);
      hud.damageFlash();
      if (!player.alive) hud.feed(bot.name, 'You', bot.team, head);
    } else {
      const wasAlive = target.ref.alive;
      target.ref.takeDamage(dmg);
      if (wasAlive && !target.ref.alive) {
        bot.kills++;
        hud.feed(bot.name, target.ref.name, bot.team, head);
      }
    }
    // Tracer to the victim.
    const end = tmpV2.copy(target.pos); end.y = 1.4;
    tracers.fire(origin, end, w.tracer);
    muzzle.flash(origin.clone().addScaledVector(dir, 0.7));
  } else {
    // Miss: tracer to a point past the target.
    const end = tmpV2.copy(origin).addScaledVector(dir, dist + 6);
    tracers.fire(origin, end, w.tracer);
    muzzle.flash(origin.clone().addScaledVector(dir, 0.7));
  }
}

// ---- plant / defuse ----
function tryPlantTick(dt) {
  if (G.phase !== 'round' || G.planted || !player.alive) { G.plantHold = 0; hud.plant(false); return; }
  const holding = input.down('KeyE');
  let onSite = null;
  for (const name of ['A', 'B']) {
    const s = world.sites[name];
    if (Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < s.r) onSite = name;
  }
  if (holding && onSite) {
    G.plantHold += dt;
    hud.plant(true, `PLANTING AT SITE ${onSite}…`, G.plantHold / 3);
    if (Math.floor(G.plantHold * 4) !== Math.floor((G.plantHold - dt) * 4)) sfx.plantBeep();
    if (G.plantHold >= 3) {
      G.planted = true; G.plantSite = onSite; G.fuse = FUSE_TIME; G.plantHold = 0;
      hud.plant(false);
      hud.setObjective(`Charge planted at <span class="site">SITE ${onSite}</span> — defend it until it blows.`);
      hud.banner('CHARGE PLANTED', `Detonation in ${FUSE_TIME}s — hold the site`, 'win');
      sfx.plantBeep();
    }
  } else {
    G.plantHold = Math.max(0, G.plantHold - dt * 2);
    hud.plant(false);
  }
}

// ---- input wiring ----
input.onKey = (code, down) => {
  if (!down) return;
  if (code === 'KeyR') player.startReload();
  if (code === 'Digit1') player.switchSlot(1);
  if (code === 'Digit2') player.switchSlot(2);
  if (code === 'KeyB' && (G.phase === 'buy' || G.phase === 'round')) {
    if (document.getElementById('buy').hidden) { if (G.phase === 'buy') openShop(); }
    else { closeShop(); input.lock(); }
  }
  if (code === 'Tab') { hud.scoreboard(scoreRows(), `Round ${G.round} — ${G.scoreAz} : ${G.scoreEm}`); hud.showBoard(true); }
  if (code === 'Digit3' && G.phase === 'buy') buyItem('vk7');
  if (code === 'Digit4' && G.phase === 'buy') buyItem('ar9');
  if (code === 'Digit5' && G.phase === 'buy') buyItem('lm88');
};
window.addEventListener('keyup', (e) => { if (e.code === 'Tab') hud.showBoard(false); });
document.getElementById('play').addEventListener('click', () => {
  sfx.ensure();
  hud.showMenu(false);
  if (G.phase === 'menu') startMatch();
  else input.lock();
});
document.getElementById('how').addEventListener('click', () => {
  hud.setObjective('Plant the charge, defend it, win 5 rounds. That is the whole game.');
});
document.getElementById('again').addEventListener('click', () => { hud.showEnd(false); hud.showBoard(false); startMatch(); });
input.onLockChange = (locked) => {
  if (!locked && G.phase === 'round' && player.alive && !SHOT) {
    hud.showMenu(true);
    document.getElementById('play').textContent = 'Click to resume';
    document.querySelector('#menu p').textContent = 'Paused. Your team is holding without you.';
  }
};
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- bot context ----
function botCtx() {
  return {
    player, bots, rnd,
    planted: G.planted, plantSite: G.plantSite, sites: world.sites, phase: G.phase,
    onShoot: (bot, target, dist) => botShoot(bot, target, dist),
    onPlant: (bot, site) => {
      if (G.planted || G.phase !== 'round') return;
      G.planted = true; G.plantSite = site; G.fuse = FUSE_TIME;
      hud.setObjective(`Charge planted at <span class="site">SITE ${site}</span> by ${bot.name} — defend it.`);
      hud.banner('CHARGE PLANTED', `${bot.name} planted — detonation in ${FUSE_TIME}s`, 'win');
    },
    onDefuse: (bot) => {
      if (!G.planted) return;
      G.planted = false;
      hud.banner('CHARGE DEFUSED', `${bot.name} defused the charge`, 'lose');
      endRound('EM', `${bot.name} defused the charge`);
    },
  };
}

// ---- screenshot staging ----
function stageShot() {
  rnd = mulberry32(SEED * 7919 + 13);
  hud.showMenu(false); hud.showEnd(false); hud.showBoard(false);
  if (SHOT === 'menu') {
    camera.position.set(-30, 6, 20);
    camera.lookAt(10, 2, -6);
    document.getElementById('menu').hidden = false;
  } else if (SHOT === 'buy') {
    G.phase = 'buy'; G.round = 2; G.scoreAz = 1; G.scoreEm = 1;
    player.money = 4200;
    resetPositions();
    camera.position.set(-14, 5, 16);
    camera.lookAt(8, 1, -8);
    hud.showHud(true);
    player.weapons.primary = 'ar9';
    player.ammo.ar9 = { mag: 30, reserve: 90 };
    player.slot = 1;
    openShop();
    syncHud();
  } else if (SHOT === 'combat') {
    G.phase = 'round'; G.round = 3; G.scoreAz = 2; G.scoreEm = 1; G.timer = 62;
    resetPositions();
    player.pos.set(-16, 0, 0); player.yaw = -Math.PI / 2 + 0.055; player.pitch = 0.01;
    player.weapons.primary = 'ar9';
    player.ammo.ar9 = { mag: 24, reserve: 90 };
    player.slot = 1; player.money = 2600;
    const em = bots.filter((b) => b.team === 'EM');
    em[0].reset(new THREE.Vector3(2, 0, -1), 'A');
    em[1].reset(new THREE.Vector3(6, 0, 2), 'B');
    em[2].reset(new THREE.Vector3(9, 0, -3), 'A');
    const az = bots.filter((b) => b.team === 'AZ');
    az[0].reset(new THREE.Vector3(-12, 0, -4), 'A');
    az[1].reset(new THREE.Vector3(-10, 0, 5), 'B');
    hud.showHud(true);
    syncHud();
    // Scripted volley once, then freeze the frame for the capture.
    setTimeout(() => {
      if (G.volleyDone) return;
      G.volleyDone = true;
      player.tryFire(performance.now(), (o, d, w, s) => shootFrom(o, d, w, s, true));
      const ctx = botCtx();
      botShoot(em[0], { pos: player.pos, isPlayer: true, ref: player }, 14);
      botShoot(az[0], { pos: em[1].pos, isPlayer: false, ref: em[1] }, 22);
      G.frozen = true;
    }, 1200);
  } else if (SHOT === 'score') {
    G.phase = 'matchEnd'; G.scoreAz = 5; G.scoreEm = 3; G.round = 8;
    player.kills = 14; player.deaths = 9; player.money = 3400;
    bots[0].kills = 9; bots[0].deaths = 7; bots[1].kills = 6; bots[1].deaths = 8;
    bots[2].kills = 11; bots[2].deaths = 10; bots[3].kills = 7; bots[3].deaths = 9; bots[4].kills = 5; bots[4].deaths = 11;
    hud.showHud(true);
    hud.scoreboard(scoreRows(), 'Final — 5 : 3');
    hud.showBoard(true);
    camera.position.set(-28, 8, 18);
    camera.lookAt(0, 1, 0);
    syncHud();
  }
}

// ---- main loop ----
const clock = new THREE.Clock();
let beepT = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  if (!G.frozen) {
    if (G.phase === 'buy') {
      G.timer -= dt;
      hud.setBuySub(`ROUND ${G.round} · $${player.money} · closes in ${Math.ceil(Math.max(0, G.timer))}s — press B to close`);
      if (G.timer <= 0) startRound();
    } else if (G.phase === 'round') {
      if (G.planted) {
        G.fuse -= dt;
        beepT -= dt;
        if (beepT <= 0) { beepT = Math.max(0.25, G.fuse / FUSE_TIME); sfx.plantBeep(); }
        if (G.fuse <= 0) { sfx.explosion(); endRound('AZ', 'The charge detonated'); }
      } else {
        G.timer -= dt;
        if (G.timer <= 0) endRound('EM', 'Time expired — the charge was never planted');
      }
      // Round end by elimination.
      const azAlive = player.alive || bots.some((b) => b.team === 'AZ' && b.alive);
      const emAlive = bots.some((b) => b.team === 'EM' && b.alive);
      if (!azAlive) endRound('EM', 'Your team was eliminated');
      else if (!emAlive) endRound('AZ', 'Enemy team eliminated');
      // Player shooting.
      if (input.firing) player.tryFire(performance.now(), (o, d, w, s) => shootFrom(o, d, w, s, true));
      tryPlantTick(dt);
      // Bots.
      const ctx = botCtx();
      for (const b of bots) b.update(dt, ctx);
      player.update(dt, input, input.firing);
    } else if (G.phase === 'roundEnd') {
      G.timer -= dt;
      const ctx = botCtx();
      for (const b of bots) b.update(dt, ctx);
      if (G.timer <= 0) {
        if (G.scoreAz >= WIN_ROUNDS || G.scoreEm >= WIN_ROUNDS || G.round >= MAX_ROUNDS) endMatch();
        else { G.round++; startBuyPhase(); }
      }
    } else if (G.phase === 'menu') {
      // Slow orbit behind the menu.
      const t = G.time * 0.05;
      camera.position.set(Math.sin(t) * 26, 7 + Math.sin(t * 0.7) * 2, Math.cos(t) * 18);
      camera.lookAt(0, 1.5, 0);
    }
    // Death camera: slow rise over the yard.
    if (G.phase === 'round' && !player.alive) {
      G.deadCam += dt;
      camera.position.set(player.pos.x, 6 + G.deadCam * 0.4, player.pos.z + 4);
      camera.lookAt(0, 1, 0);
    }
    tracers.update(dt);
    sparks.update(dt);
    muzzle.update(dt);
    // Viewmodel bob + recoil.
    const bob = Math.hypot(player.vel.x, player.vel.z) > 1 && player.onGround ? Math.sin(G.time * 11) * 0.008 : 0;
    gun.position.y = -0.24 + bob - player.spreadBloom * 0.02;
    gun.position.z = -0.45 + player.spreadBloom * 0.03;
    gun.rotation.x = player.spreadBloom * 0.06;
    // HUD.
    if (G.phase === 'round' || G.phase === 'buy' || G.phase === 'roundEnd') {
      syncHud();
      hud.setCrosshairSpread(player.spreadBloom * 14);
      if (player.hurtFlash > 0) hud.damageFlash();
    }
  }
  renderer.render(scene, camera);
  if (!window.__ready) window.__ready = true;
}

window.addEventListener('error', (e) => { window.__gameError = String(e.message || e.error); });

if (SHOT) stageShot();
else hud.showMenu(true);
animate();
