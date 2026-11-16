// Ember Yard — bots. One AI drives both teams: walk the waypoint graph,
// spot enemies by line of sight, strafe and fire in bursts, and play the
// objective — AZURE pushes a site and plants, EMBER holds sites and defuses
// a planted charge.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

const CALLSIGNS_AZ = ['Vex', 'Mira', 'Hale'];
const CALLSIGNS_EM = ['Rook', 'Ash', 'Dagger'];
const CRUISE = 3.6;
const EYE = 1.55;

function buildBody(team) {
  const g = new THREE.Group();
  const suit = team === 'AZ' ? 0x2a5a8a : 0x8a3a2a;
  const trim = team === 'AZ' ? 0x4da3ff : 0xff5a3c;
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.85, 4, 10),
    new THREE.MeshStandardMaterial({ color: suit, roughness: 0.85 }),
  );
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.6 }),
  );
  helmet.position.y = 1.82;
  helmet.castShadow = true;
  g.add(helmet);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.08, 0.1),
    new THREE.MeshStandardMaterial({ color: trim, emissive: trim, emissiveIntensity: 1.4 }),
  );
  visor.position.set(0, 1.84, 0.2);
  g.add(visor);
  const rifle = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.12, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5, metalness: 0.6 }),
  );
  rifle.position.set(0.28, 1.25, 0.35);
  g.add(rifle);
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: trim, emissive: trim, emissiveIntensity: 2 }),
  );
  beacon.position.set(0, 1.45, -0.36);
  g.add(beacon);
  return g;
}

export class Bot {
  constructor(world, team, index, sfx) {
    this.world = world;
    this.team = team; // 'AZ' | 'EM'
    this.name = (team === 'AZ' ? CALLSIGNS_AZ : CALLSIGNS_EM)[index % 3];
    this.sfx = sfx;
    this.mesh = buildBody(team);
    this.pos = this.mesh.position;
    this.pos.set(0, 0, 0);
    this.yaw = 0;
    this.hp = 100;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.weaponKey = team === 'EM' ? 'ar9' : 'vk7';
    this.mag = WEAPONS[this.weaponKey].mag;
    this.state = 'patrol';
    this.wp = 0;
    this.path = [];
    this.pathI = 0;
    this.target = null;
    this.react = 0;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.fireCooldown = 0;
    this.reloadT = 0;
    this.strafeDir = 1;
    this.strafeT = 0;
    this.holdT = 0;
    this.plantT = 0;
    this.defuseT = 0;
    this.goalSite = team === 'AZ' ? (index % 2 === 0 ? 'A' : 'B') : null;
    this.speed = CRUISE * (0.92 + Math.random() * 0.16);
  }

  reset(spawn, site) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.hp = 100;
    this.alive = true;
    this.mag = WEAPONS[this.weaponKey].mag;
    this.state = 'patrol';
    this.wp = this.world.nearestWaypoint(this.pos);
    this.path = [];
    this.pathI = 0;
    this.target = null;
    this.react = 0;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.fireCooldown = 0;
    this.reloadT = 0;
    this.plantT = 0;
    this.defuseT = 0;
    this.holdT = 1 + Math.random() * 2;
    if (site) this.goalSite = site;
    this.mesh.visible = true;
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deaths++;
      this.mesh.visible = false;
    }
    return amount;
  }

  eyePos(out) {
    return out.set(this.pos.x, EYE, this.pos.z);
  }

  // Visible-enemy test: within range and a clear line at eye height.
  canSee(enemyPos, maxDist) {
    const d = Math.hypot(enemyPos.x - this.pos.x, enemyPos.z - this.pos.z);
    if (d > maxDist) return false;
    const a = this.eyePos(new THREE.Vector3());
    const b = new THREE.Vector3(enemyPos.x, 1.4, enemyPos.z);
    return !this.world.blocked(a, b, 1.5);
  }

  pickNewGoal(rnd) {
    const wps = this.world.waypoints;
    let idx = Math.floor(rnd() * wps.length);
    // Defenders drift toward the sites; attackers drift toward mid.
    if (this.team === 'EM' && rnd() < 0.6) {
      const s = this.goalSite === 'A' ? { x: -22, z: -14 } : { x: 22, z: 14 };
      idx = this.world.nearestWaypoint(new THREE.Vector3(s.x, 0, s.z));
      idx = Math.max(0, idx + Math.floor(rnd() * 3) - 1);
    }
    this.wp = idx;
    this.path = this.world.findPath(this.world.nearestWaypoint(this.pos), idx);
    this.pathI = 0;
  }

  // Walk toward a point; returns true once close enough.
  moveToward(target, dt, speedMul = 1) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const sp = this.speed * speedMul;
    this.pos.x += (dx / d) * sp * dt;
    this.pos.z += (dz / d) * sp * dt;
    this.world.collide(this.pos, 0.42);
    this.yaw = Math.atan2(dx, dz);
    return d < 0.6;
  }

  face(x, z) {
    this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    this.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.008)) * 0.03;
  }

  // One frame. ctx: { player, bots, planted, plantSite, sites, phase, timeLeft, rnd, onShoot, onPlant, onDefuse }
  update(dt, ctx) {
    if (!this.alive) return;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.mag = WEAPONS[this.weaponKey].mag;
    }

    // Nearest visible enemy, player included.
    const foes = [];
    if (ctx.player.alive) foes.push({ pos: ctx.player.pos, ref: ctx.player, isPlayer: true });
    for (const b of ctx.bots) {
      if (b.team !== this.team && b.alive) foes.push({ pos: b.pos, ref: b });
    }
    let seen = null;
    let seenD = Infinity;
    for (const e of foes) {
      if (!this.canSee(e.pos, 55)) continue;
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
      if (d < seenD) {
        seenD = d;
        seen = e;
      }
    }
    if (seen) {
      if (this.target !== seen) {
        this.target = seen;
        this.react = 0.32 + Math.random() * 0.28;
      }
    } else {
      this.target = null;
    }

    // Objective work first: plant as AZURE, defuse as EMBER.
    if (ctx.phase === 'round') {
      if (this.team === 'AZ' && !ctx.planted && this.goalSite) {
        const site = ctx.sites[this.goalSite];
        if (Math.hypot(site.x - this.pos.x, site.z - this.pos.z) < 2.6 && !seen) {
          this.plantT += dt;
          if (this.plantT > 3) {
            ctx.onPlant(this, this.goalSite);
            this.plantT = 0;
          }
          this.face(site.x, site.z);
          this.syncMesh();
          return;
        }
        this.plantT = Math.max(0, this.plantT - dt * 2);
      }
      if (this.team === 'EM' && ctx.planted) {
        const site = ctx.sites[ctx.plantSite];
        if (Math.hypot(site.x - this.pos.x, site.z - this.pos.z) < 2.6 && !seen) {
          this.defuseT += dt;
          if (this.defuseT > 5) {
            ctx.onDefuse(this);
            this.defuseT = 0;
          }
          this.face(site.x, site.z);
          this.syncMesh();
          return;
        }
        this.defuseT = Math.max(0, this.defuseT - dt * 2);
      }
    }

    if (seen && this.react <= 0) {
      this.face(seen.pos.x, seen.pos.z);
      // Strafe sideways while firing.
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 0.5 + Math.random() * 0.9;
        this.strafeDir *= -1;
      }
      const sx = Math.cos(this.yaw) * this.strafeDir;
      const sz = -Math.sin(this.yaw) * this.strafeDir;
      this.pos.x += sx * 1.8 * dt;
      this.pos.z += sz * 1.8 * dt;
      this.world.collide(this.pos, 0.42);
      if (this.mag <= 0) {
        if (this.reloadT <= 0) this.reloadT = 1.6;
      } else if (this.fireCooldown <= 0) {
        if (this.burstLeft <= 0) {
          if (this.burstPause <= 0) {
            this.burstLeft = 4 + Math.floor(Math.random() * 4);
            this.burstPause = 0.22 + Math.random() * 0.4;
          } else {
            this.burstPause -= dt;
          }
        }
        if (this.burstLeft > 0) {
          this.burstLeft--;
          this.mag--;
          this.fireCooldown = 60 / WEAPONS[this.weaponKey].rpm;
          ctx.onShoot(this, seen, seenD);
        }
      }
    } else {
      if (this.react > 0) this.react -= dt;
      // No fight: walk the objective, else patrol the graph.
      let goal = null;
      if (ctx.planted && this.team === 'EM') goal = ctx.sites[ctx.plantSite];
      else if (!ctx.planted && this.team === 'AZ' && this.goalSite) goal = ctx.sites[this.goalSite];
      if (goal) {
        if (Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) > 3.5) {
          this.moveToward(goal, dt);
        } else {
          this.holdT -= dt;
          if (this.holdT <= 0) {
            this.holdT = 1 + Math.random() * 2;
            this.pickNewGoal(ctx.rnd);
          }
        }
      } else {
        if (!this.path.length || this.pathI >= this.path.length) this.pickNewGoal(ctx.rnd);
        const wp = this.world.waypoints[this.path[this.pathI]];
        if (wp && this.moveToward(wp, dt)) this.pathI++;
      }
    }
    this.syncMesh();
  }
}
