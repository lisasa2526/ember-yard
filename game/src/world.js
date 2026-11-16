// Ember Yard — the map: a freight container yard at dusk. Everything is
// procedural: boxes, canvas-painted textures, one low sun plus floodlights.
// Collision is axis-aligned boxes; bots navigate a waypoint graph.
import * as THREE from 'three';

// Seeded RNG so the screenshot mode can reproduce a layout.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paint(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(ctx, w, h, count, alpha, rnd) {
  for (let i = 0; i < count; i++) {
    const light = rnd() > 0.5;
    ctx.fillStyle = `rgba(${light ? '255,255,255' : '0,0,0'},${(rnd() * alpha).toFixed(3)})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
  }
}

function buildTextures(rnd) {
  const concrete = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a5c5e';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2600, 0.1, rnd);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.stroke();
  });
  concrete.repeat.set(16, 11);

  const asphalt = paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3f4145';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 3400, 0.14, rnd);
    ctx.fillStyle = 'rgba(240,168,48,0.85)';
    ctx.fillRect(0, 120, 256, 8);
  });
  asphalt.repeat.set(16, 11);

  const containerTex = (base, rust) => paint(256, 128, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, 0, 4, h);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x + 6, 0, 3, h);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(${rust},${(0.12 + rnd() * 0.25).toFixed(2)})`;
      ctx.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 22, 3 + rnd() * 14);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`EY-${100 + Math.floor(rnd() * 800)}`, 14, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, h - 10, w, 10);
  });

  const hazard = paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#181818';
    for (let i = -2; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 32, h);
      ctx.lineTo(i * 32 + 32, 0);
      ctx.lineTo(i * 32 + 48, 0);
      ctx.lineTo(i * 32 + 16, h);
      ctx.fill();
    }
  });
  hazard.repeat.set(4, 1);

  const crate = paint(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7a5c38';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();
    speckle(ctx, w, h, 500, 0.12, rnd);
  });

  const wall = paint(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4a4d52';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 1800, 0.12, rnd);
    ctx.fillStyle = 'rgba(240,168,48,0.9)';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('YARD 7', 18, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px monospace';
    ctx.fillText('FREIGHT TERMINAL — KEEP CLEAR', 18, 70);
  });

  return { concrete, asphalt, containerTex, hazard, crate, wall };
}

// One axis-aligned box collider: { min: Vector3, max: Vector3 }.
export class World {
  constructor(scene, seed = 7) {
    this.rnd = mulberry32(seed);
    this.scene = scene;
    this.colliders = [];
    this.waypoints = [];
    this.edges = new Map();
    this.sites = {};
    this.spawnAz = new THREE.Vector3(-26, 0, 16);
    this.spawnEm = new THREE.Vector3(26, 0, -16);
    this.tex = buildTextures(this.rnd);
    this.makeLights();
    this.makeGround();
    this.makePerimeter();
    this.makeContainers();
    this.makeProps();
    this.makeSites();
    this.makeSky();
    this.makeWaypoints();
  }

  addCollider(x, z, w, d, h) {
    this.colliders.push({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, h, z + d / 2),
    });
  }

  // Push a circle (radius r) out of every box, XZ only. Returns p.
  collide(p, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.min.x, Math.min(p.x, c.max.x));
      const nz = Math.max(c.min.z, Math.min(p.z, c.max.z));
      const dx = p.x - nx;
      const dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.z = nz + (dz / d) * r;
      } else {
        // Dead centre of the box: exit along the shallowest side.
        const pl = p.x - c.min.x;
        const pr = c.max.x - p.x;
        const pt = p.z - c.min.z;
        const pb = c.max.z - p.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) p.x = c.min.x - r;
        else if (m === pr) p.x = c.max.x + r;
        else if (m === pt) p.z = c.min.z - r;
        else p.z = c.max.z + r;
      }
    }
    p.x = Math.max(-31, Math.min(31, p.x));
    p.z = Math.max(-21, Math.min(21, p.z));
    return p;
  }

  // Segment vs colliders at eye height: true when the view is blocked.
  blocked(a, b, height = 1.5) {
    for (const c of this.colliders) {
      if (c.max.y < 0.4) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      let tmin = 0;
      let tmax = 1;
      const axes = [
        [a.x, dx, c.min.x, c.max.x],
        [a.z, dz, c.min.z, c.max.z],
      ];
      let hit = true;
      for (const [o, d, mn, mx] of axes) {
        if (Math.abs(d) < 1e-8) {
          if (o < mn || o > mx) {
            hit = false;
            break;
          }
        } else {
          let t1 = (mn - o) / d;
          let t2 = (mx - o) / d;
          if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
          }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            hit = false;
            break;
          }
        }
      }
      if (hit && c.max.y > height * 0.4) return true;
    }
    return false;
  }

  makeLights() {
    const hemi = new THREE.HemisphereLight(0x8a7a9e, 0x2a2118, 1.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb36b, 3.1);
    sun.position.set(-30, 26, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.sun = sun;
    // Floodlight poles over mid plaza and both sites.
    for (const [x, z] of [[0, 0], [-22, -14], [22, 14]]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 7, 8),
        new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.8 }),
      );
      pole.position.set(x, 3.5, z);
      pole.castShadow = true;
      this.scene.add(pole);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.3, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x111214, emissive: 0xffd9a0, emissiveIntensity: 1.6 }),
      );
      head.position.set(x, 7, z);
      this.scene.add(head);
      const spot = new THREE.SpotLight(0xffd9a0, 75, 30, 0.75, 0.5, 1.4);
      spot.position.set(x, 7, z);
      spot.target.position.set(x, 0, z);
      this.scene.add(spot, spot.target);
    }
  }

  makeGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 44),
      new THREE.MeshStandardMaterial({ map: this.tex.concrete, roughness: 0.95 }),
    );
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 0.5),
      new THREE.MeshStandardMaterial({ map: this.tex.asphalt, roughness: 0.9 }),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.y = 0.01;
    lane.receiveShadow = true;
    this.scene.add(lane);
  }

  makePerimeter() {
    const mat = new THREE.MeshStandardMaterial({ map: this.tex.wall, roughness: 0.9 });
    const wallAt = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), mat);
      m.position.set(x, 2.5, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      this.addCollider(x, z, w, d, 5);
    };
    wallAt(0, -22.5, 66, 1);
    wallAt(0, 22.5, 66, 1);
    wallAt(-32.5, 0, 1, 46);
    wallAt(32.5, 0, 1, 46);
  }

  makeContainers() {
    const palettes = [
      ['#a33d2a', '120,40,20'],
      ['#2a5a8a', '20,60,110'],
      ['#3d7a4a', '20,90,40'],
      ['#8a6d2a', '120,90,20'],
      ['#5a4a7a', '70,50,110'],
      ['#7a3a3a', '110,40,40'],
    ];
    // [x, z, length, rotated, stacked, palette]
    const defs = [
      [-24, -8, 12, false, 0, 0], [-24, -2, 12, false, 1, 0], [-24, 4, 6, false, 0, 3],
      [-14, -16, 12, true, 0, 1], [-14, -10, 6, true, 0, 4], [-8, 14, 12, false, 0, 2],
      [-2, -14, 6, false, 0, 5], [2, 8, 12, true, 0, 1], [2, 14, 6, true, 1, 1],
      [8, -8, 12, false, 0, 3], [8, -2, 6, false, 0, 0], [14, 12, 12, true, 0, 4],
      [20, -14, 6, true, 0, 2], [24, -4, 12, false, 0, 1], [24, 2, 12, false, 1, 1],
      [24, 10, 6, false, 0, 5], [-18, 10, 6, true, 0, 2], [12, 2, 6, true, 0, 0],
    ];
    for (const [x, z, len, rot, stack, ci] of defs) {
      const [base, rust] = palettes[ci];
      const tex = this.tex.containerTex(base, rust);
      const geo = new THREE.BoxGeometry(rot ? 2.6 : len, 2.6, rot ? len : 2.6);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.25 });
      const box = new THREE.Mesh(geo, mat);
      box.position.set(x, 1.3, z);
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
      this.addCollider(x, z, rot ? 2.6 : len, rot ? len : 2.6, 2.6);
      if (stack) {
        const top = new THREE.Mesh(geo, mat);
        top.position.set(x, 3.9, z);
        top.castShadow = true;
        top.receiveShadow = true;
        this.scene.add(top);
        this.colliders[this.colliders.length - 1].max.y = 5.2;
      }
    }
  }

  makeProps() {
    const crateMat = new THREE.MeshStandardMaterial({ map: this.tex.crate, roughness: 0.9 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.7, metalness: 0.4 });
    for (const [x, z, s] of [[-6, -4, 1.2], [-5, 18, 1.2], [18, 6, 1.2], [26, -10, 1.2], [-28, 14, 1.2], [6, -18, 1.2]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
      c.position.set(x, s / 2, z);
      c.castShadow = true;
      c.receiveShadow = true;
      this.scene.add(c);
      this.addCollider(x, z, s, s, s);
    }
    for (const [x, z] of [[-10, 2], [16, -12], [28, 16], [-20, -18]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), barrelMat);
      b.position.set(x, 0.55, z);
      b.castShadow = true;
      this.scene.add(b);
      this.addCollider(x, z, 0.9, 0.9, 1.1);
    }
    // Gantry crane silhouette over mid.
    const craneMat = new THREE.MeshStandardMaterial({ color: 0x8a5a20, roughness: 0.7, metalness: 0.5 });
    for (const [x, z] of [[-4, -6], [4, -6]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), craneMat);
      leg.position.set(x, 7, z);
      leg.castShadow = true;
      this.scene.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 1.2), craneMat);
    beam.position.set(0, 13.5, -6);
    beam.castShadow = true;
    this.scene.add(beam);
    const hook = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.6 }),
    );
    hook.position.set(0, 11.5, -6);
    this.scene.add(hook);
  }

  makeSites() {
    const site = (name, x, z, color) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 3, 40),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.03, z);
      this.scene.add(ring);
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 4.4),
        new THREE.MeshStandardMaterial({ map: this.tex.hazard, roughness: 0.9, transparent: true, opacity: 0.85 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, 0.02, z);
      pad.receiveShadow = true;
      this.scene.add(pad);
      const glow = new THREE.PointLight(color, 14, 14, 1.6);
      glow.position.set(x, 2.5, z);
      this.scene.add(glow);
      this.sites[name] = { x, z, r: 3, color };
    };
    site('A', -22, -14, 0xf0a830);
    site('B', 22, 14, 0xf0a830);
  }

  makeSky() {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x1a2340) },
        mid: { value: new THREE.Color(0x7a4a3a) },
        low: { value: new THREE.Color(0xd97b3f) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
        void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), skyMat));
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, fog: false }),
    );
    disc.position.set(-120, 26, -90);
    disc.lookAt(0, 10, 0);
    this.scene.add(disc);
    this.scene.fog = new THREE.FogExp2(0x3a2f2a, 0.007);
  }

  makeWaypoints() {
    const pts = [
      [-28, 18], [-28, 0], [-28, -18], [-18, 18], [-18, -6], [-18, -18],
      [-10, 6], [-10, -12], [-4, 18], [-4, 0], [-4, -18],
      [4, 12], [4, -4], [4, -18], [10, 18], [10, 6], [10, -14],
      [18, 18], [18, 0], [18, -18], [28, 12], [28, -8], [28, -18],
      [-22, -14], [22, 14], [0, 0], [-26, 16], [26, -16],
    ];
    this.waypoints = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const link = (a, b) => {
      if (!this.edges.has(a)) this.edges.set(a, []);
      if (!this.edges.has(b)) this.edges.set(b, []);
      this.edges.get(a).push(b);
      this.edges.get(b).push(a);
    };
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = this.waypoints[i];
        const b = this.waypoints[j];
        if (a.distanceTo(b) < 14 && !this.blocked(a, b, 1.2)) link(i, j);
      }
    }
  }

  nearestWaypoint(p) {
    let best = 0;
    let bd = Infinity;
    this.waypoints.forEach((w, i) => {
      const d = (w.x - p.x) ** 2 + (w.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  // BFS over the waypoint graph, returning waypoint indices from start to goal.
  findPath(from, to) {
    const prev = new Array(this.waypoints.length).fill(-1);
    const q = [from];
    prev[from] = from;
    while (q.length) {
      const cur = q.shift();
      if (cur === to) break;
      for (const n of this.edges.get(cur) ?? []) {
        if (prev[n] === -1) {
          prev[n] = cur;
          q.push(n);
        }
      }
    }
    if (prev[to] === -1) return [to];
    const path = [];
    for (let c = to; c !== from; c = prev[c]) path.unshift(c);
    return path;
  }
}
