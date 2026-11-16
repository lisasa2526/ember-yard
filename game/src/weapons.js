// Ember Yard — weapons: definitions, the shop list, and the pooled
// hitscan effects (tracers, impact sparks, muzzle flash). All shots are
// hitscan; damage and falloff are applied by the caller in main.js.
import * as THREE from 'three';

export const WEAPONS = {
  p9: {
    name: 'P9 Sidearm', slot: 2, price: 0, damage: 34, headMult: 2.2, rpm: 320,
    mag: 12, reserve: 36, spread: 0.011, recoil: 0.011, auto: false,
    range: 60, tracer: 0xffe9a8, move: 1.0, kick: 0.35,
  },
  vk7: {
    name: 'VK-7 Ripper', slot: 1, price: 1400, damage: 26, headMult: 2.0, rpm: 780,
    mag: 28, reserve: 84, spread: 0.02, recoil: 0.008, auto: true,
    range: 50, tracer: 0xffd27a, move: 0.98, kick: 0.3,
  },
  ar9: {
    name: 'AR-9 Longshot', slot: 1, price: 2600, damage: 36, headMult: 2.4, rpm: 620,
    mag: 30, reserve: 90, spread: 0.013, recoil: 0.012, auto: true,
    range: 80, tracer: 0xfff2c0, move: 0.94, kick: 0.45,
  },
  lm88: {
    name: 'LM-88 Deadeye', slot: 1, price: 4200, damage: 92, headMult: 2.8, rpm: 52,
    mag: 5, reserve: 15, spread: 0.001, recoil: 0.05, auto: false,
    range: 120, tracer: 0x9fd8ff, move: 0.88, kick: 1.4,
  },
};

export const SHOP = [
  { key: 'vk7', name: 'VK-7 Ripper', desc: 'Fast SMG · 26 dmg · 780 rpm · close quarters', price: 1400 },
  { key: 'ar9', name: 'AR-9 Longshot', desc: 'Assault rifle · 36 dmg · 620 rpm · all-round', price: 2600 },
  { key: 'lm88', name: 'LM-88 Deadeye', desc: 'Bolt sniper · 92 dmg · one-shot headshot', price: 4200 },
  { key: 'armor', name: 'Kevlar Vest', desc: 'Absorbs half of incoming damage', price: 650 },
  { key: 'ammo', name: 'Ammo refill', desc: 'Top up reserve ammo for every weapon you own', price: 200 },
];

// One thin additive line per shot, fading in ~90ms. Pooled so rapid fire
// never allocates.
export class Tracers {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({
        color: 0xffe9a8, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.pool.push({ line, life: 0 });
    }
  }

  fire(from, to, color) {
    const t = this.pool.find((p) => p.life <= 0) ?? this.pool[0];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = 0.9;
    t.line.visible = true;
    t.life = 0.09;
  }

  update(dt) {
    for (const t of this.pool) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) t.line.visible = false;
      }
    }
  }
}

// A small burst of points at the impact, arcing under gravity. Pooled,
// one geometry per burst, 14 particles each.
export class Sparks {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.BufferGeometry();
      const n = 14;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const m = new THREE.PointsMaterial({
        color: 0xffc46b, size: 0.14, transparent: true, opacity: 0, depthWrite: false,
      });
      const points = new THREE.Points(g, m);
      points.frustumCulled = false;
      points.visible = false;
      scene.add(points);
      this.pool.push({ points, vel: new Float32Array(n * 3), life: 0 });
    }
  }

  burst(at, normal, color = 0xffc46b) {
    const s = this.pool.find((p) => p.life <= 0) ?? this.pool[0];
    const pos = s.points.geometry.attributes.position;
    for (let i = 0; i < 14; i++) {
      pos.setXYZ(i, at.x, at.y, at.z);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI;
      const sp = 2 + Math.random() * 4;
      s.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp + normal.x * 2;
      s.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp + 1.5;
      s.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp + normal.z * 2;
    }
    pos.needsUpdate = true;
    s.points.material.color.setHex(color);
    s.points.material.opacity = 1;
    s.points.visible = true;
    s.life = 0.35;
  }

  update(dt) {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const pos = s.points.geometry.attributes.position;
      for (let i = 0; i < 14; i++) {
        pos.setXYZ(
          i,
          pos.getX(i) + s.vel[i * 3] * dt,
          Math.max(0.05, pos.getY(i) + s.vel[i * 3 + 1] * dt),
          pos.getZ(i) + s.vel[i * 3 + 2] * dt,
        );
        s.vel[i * 3 + 1] -= 9 * dt;
      }
      pos.needsUpdate = true;
      s.points.material.opacity = Math.max(0, s.life / 0.35);
      if (s.life <= 0) s.points.visible = false;
    }
  }
}

// Muzzle flash: a short-lived point light at the barrel.
export class Muzzle {
  constructor(scene, camera) {
    this.light = new THREE.PointLight(0xffc46b, 0, 9, 1.8);
    scene.add(this.light);
    this.life = 0;
    this.camera = camera;
  }

  flash(pos) {
    this.light.position.copy(pos);
    this.light.intensity = 26;
    this.life = 0.05;
  }

  update(dt) {
    if (this.life > 0) {
      this.life -= dt;
      if (this.life <= 0) this.light.intensity = 0;
    }
  }
}
