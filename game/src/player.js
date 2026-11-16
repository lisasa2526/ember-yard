// Ember Yard — the player: first-person movement, health and armour,
// weapon handling and hitscan firing.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

const EYE_UP = 1.62;
const EYE_DOWN = 1.12;
const BODY_R = 0.42;

export class Player {
  constructor(world, camera, sfx) {
    this.world = world;
    this.camera = camera;
    this.sfx = sfx;
    this.pos = new THREE.Vector3(-26, 0, 16);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI * 0.5; // facing mid (east)
    this.pitch = 0;
    this.hp = 100;
    this.armor = 0;
    this.alive = true;
    this.money = 800;
    this.kills = 0;
    this.deaths = 0;
    this.crouch = false;
    this.onGround = true;
    this.weapons = { primary: null, side: 'p9' };
    this.ammo = { p9: { mag: 12, reserve: 36 } };
    this.slot = 2;
    this.reloading = 0;
    this.fireCooldown = 0;
    this.spreadBloom = 0;
    this.stepTimer = 0;
    this.hurtFlash = 0;
  }

  get weaponKey() {
    return this.slot === 1 ? this.weapons.primary : this.weapons.side;
  }

  get weapon() {
    return WEAPONS[this.weaponKey];
  }

  get eyeHeight() {
    return this.crouch ? EYE_DOWN : EYE_UP;
  }

  reset(spawn, keepMoney, keepWeapons) {
    this.pos.copy(spawn);
    this.vel.set(0, 0, 0);
    // Face mid from whichever side we spawn on.
    this.yaw = spawn.x < 0 ? -Math.PI / 2 : Math.PI / 2;
    this.pitch = 0;
    this.hp = 100;
    this.alive = true;
    this.reloading = 0;
    this.fireCooldown = 0;
    this.spreadBloom = 0;
    if (!keepMoney) this.money = 800;
    if (!keepWeapons) {
      this.weapons.primary = null;
      this.ammo = { p9: { mag: 12, reserve: 36 } };
      this.slot = 2;
    } else if (!this.weapons.primary) {
      this.slot = 2;
    }
    if (this.armor > 0 && !keepWeapons) this.armor = 0;
  }

  giveWeapon(key) {
    this.weapons.primary = key;
    const w = WEAPONS[key];
    this.ammo[key] = { mag: w.mag, reserve: w.reserve };
    this.slot = 1;
  }

  giveArmor() {
    this.armor = 100;
  }

  refillAmmo() {
    for (const k of Object.keys(this.ammo)) {
      this.ammo[k].reserve = WEAPONS[k].reserve;
    }
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.5);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.hp -= rest;
    this.hurtFlash = 1;
    this.sfx.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deaths++;
    }
    return rest;
  }

  update(dt, input) {
    if (!this.alive) return;
    // Mouse look.
    const [mdx, mdy] = input.consumeMouse();
    const sens = 0.0022;
    this.yaw -= mdx * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - mdy * sens));
    this.crouch = input.down('ControlLeft') || input.down('ControlRight');
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const [f, s] = input.moveVector();
    const speed = (this.crouch ? 2.4 : sprint ? 6.6 : 4.6) * this.weapon.move;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = -sin * f + cos * s;
    const wz = -cos * f - sin * s;
    const wl = Math.hypot(wx, wz) || 1;
    const accel = this.onGround ? 42 : 12;
    const pushing = f || s ? 1 : 0;
    this.vel.x += (wx / wl) * speed * accel * dt * pushing;
    this.vel.z += (wz / wl) * speed * accel * dt * pushing;
    // Friction, then clamp to top speed.
    const fr = this.onGround ? Math.max(0, 1 - 11 * dt) : Math.max(0, 1 - 0.6 * dt);
    this.vel.x *= fr;
    this.vel.z *= fr;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const max = speed * 1.15;
    if (hs > max) {
      this.vel.x *= max / hs;
      this.vel.z *= max / hs;
    }
    // Jump and gravity.
    if (input.down('Space') && this.onGround) {
      this.vel.y = 5.8;
      this.onGround = false;
    }
    this.vel.y -= 14 * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    }
    this.world.collide(this.pos, BODY_R);
    // Footsteps.
    if (hs > 2 && this.onGround) {
      this.stepTimer -= dt * hs;
      if (this.stepTimer <= 0) {
        this.stepTimer = 2.6;
        this.sfx.step();
      }
    }
    // Timers.
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 2.4);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const a = this.ammo[this.weaponKey];
        const need = this.weapon.mag - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
      }
    }
    // Camera follows the body.
    const eye = this.eyeHeight + this.pos.y;
    this.camera.position.set(this.pos.x, eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  startReload() {
    if (this.reloading > 0 || !this.alive) return false;
    const a = this.ammo[this.weaponKey];
    if (a.mag >= this.weapon.mag || a.reserve <= 0) return false;
    this.reloading = this.weaponKey === 'lm88' ? 2.6 : 1.5;
    this.sfx.reload();
    return true;
  }

  switchSlot(slot) {
    if (slot === 1 && !this.weapons.primary) return false;
    if (this.slot === slot) return false;
    this.slot = slot;
    this.reloading = 0;
    this.fireCooldown = Math.max(this.fireCooldown, 0.25);
    this.sfx.click();
    return true;
  }

  // Hitscan shot. shootFn(origin, dir, weapon, shooter) resolves the hit.
  tryFire(now, shootFn) {
    if (!this.alive || this.reloading > 0 || this.fireCooldown > 0) return false;
    const w = this.weapon;
    const a = this.ammo[this.weaponKey];
    if (a.mag <= 0) {
      this.sfx.dry();
      this.fireCooldown = 0.25;
      this.startReload();
      return false;
    }
    a.mag--;
    this.fireCooldown = 60 / w.rpm;
    this.spreadBloom = Math.min(1, this.spreadBloom + w.recoil * 6);
    this.pitch += w.recoil * 0.55;
    this.sfx.shot(this.weaponKey);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // Spread grows with bloom; movement adds more.
    const spread = w.spread * (1 + this.spreadBloom * 2.2);
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    const origin = this.camera.position.clone();
    shootFn(origin, dir, w, this);
    return true;
  }
}
