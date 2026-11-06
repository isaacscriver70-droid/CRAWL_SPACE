// World: procedural terrain, expedition base, cliff face with the cave mouth, vegetation, sky and lighting.
// Textures are generated procedurally (no external assets exist yet).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- noise ---------- */
const hash2 = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

import { makeTex } from './textures.js';
const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, ...o });

/* ---------- terrain definition ---------- */
import { WATER_Y, buildCave, LOCATIONS, noise3 } from './cave.js';
export { WATER_Y, LOCATIONS };
const POOL = { x: 0, z: -38 };
const WALL_Z = -47; // front face of the cliff
export function terrainHeight(x, z) {
  const d = Math.hypot(x, (z + 24) * 0.85);                           // the camp sits in a small rocky bowl
  let h = (fbm(x * 0.03, z * 0.03) - 0.4) * 8 * sstep(30, 70, d) + sstep(21, 29, d) * (13 + fbm(x * 0.08, z * 0.08) * 9) + (fbm(x * 0.15, z * 0.15) - 0.5) * 0.25;
  const pd = Math.hypot(x - POOL.x, z - POOL.z);
  const bowl = 1 - sstep(4, 9.5, pd);
  const channel = (1 - sstep(2.5, 3.5, Math.abs(x))) * sstep(-34, -38, z);
  return h - 3.1 * Math.max(bowl, channel) - 1.2 * sstep(-42, -46, z) * (1 - sstep(2.5, 3.5, Math.abs(x)));
}
const DOCK = { minX: -1.2, maxX: 1.2, minZ: -35, maxZ: -27, y: 0.12 };

/* ---------- helpers for rock geometry ---------- */
function rockBox(w, h, d, sx, sy, sz, c, mat, amp = 0.7) {
  const g = new THREE.BoxGeometry(w, h, d, sx, sy, sz); g.translate(c[0], c[1], c[2]);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x / 5, z / 5); else if (ax >= az) uv.setXY(i, z / 5, y / 5); else uv.setXY(i, x / 5, y / 5);
    const k = amp * (fbm(x * 0.35 + z * 0.2, y * 0.35 + 3.1) - 0.5) * 2;
    p.setXYZ(i, x + k * (fbm(y * 0.4, z * 0.4) - 0.5) * 1.6, y + k * 0.5 * (fbm(x * 0.4, z * 0.4) - 0.5) * 1.6, z + k);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}

export function buildWorld(scene) {
  const colliders = [];
  const R = rng(1337);
  const solid = (o, pad = 0) => { o.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(o); colliders.push({ minX: b.min.x - pad, maxX: b.max.x + pad, minZ: b.min.z - pad, maxZ: b.max.z + pad, minY: b.min.y, maxY: b.max.y }); };
  const add = (o, { cast = true, receive = true } = {}) => { o.castShadow = cast; o.receiveShadow = receive; scene.add(o); return o; };
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

  /* --- atmosphere --- */
  const FOG = 0x0c1a24;
  scene.fog = new THREE.FogExp2(FOG, 0.013);
  scene.background = new THREE.Color(FOG);
  const moonDir = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { moon: { value: moonDir } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 moon;
      void main(){ vec3 d=normalize(vP); float h=max(d.y,0.0);
        vec3 hor=vec3(0.047,0.102,0.141), mid=vec3(0.03,0.07,0.12), top=vec3(0.008,0.02,0.045);
        vec3 c=mix(hor,mid,smoothstep(0.0,0.25,h)); c=mix(c,top,smoothstep(0.2,0.9,h));
        c+=vec3(0.10,0.16,0.22)*pow(max(dot(d,moon),0.0),24.0)*0.8;
        if(d.y<0.0) c=hor*0.8; gl_FragColor=vec4(c,1.0); }`
  }));
  sky.renderOrder = -10; scene.add(sky);
  const starPos = []; for (let i = 0; i < 700; i++) { const a = R() * Math.PI * 2, e = 0.08 + R() * 1.4, r = 430; starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xdfe8f5, fog: false }));
  moon.position.copy(moonDir).multiplyScalar(400); scene.add(moon);

  const hemi = new THREE.HemisphereLight(0x5f82a8, 0x1a2418, 0.7); scene.add(hemi);
  const caveAmbient = new THREE.AmbientLight(0x6f8fa8, 0); scene.add(caveAmbient);
  const sun = new THREE.DirectionalLight(0x9db8e0, 1.9);
  sun.position.set(-20, 30, 28); sun.target.position.set(0, 0, -22);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 120 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  /* --- textures & materials --- */
  const T = {
    ground: makeTex({ base: [190, 190, 190], v: 55, scale: 8, rep: [90, 90] }),
    rock: makeTex({ base: [128, 130, 128], v: 50, scale: 5, stretch: 0.35, rep: [1, 1] }),
    wood: makeTex({ base: [128, 92, 58], v: 34, scale: 3, stretch: 0.08, oct: 5, rep: [2, 1] }),
    fabric: makeTex({ base: [86, 98, 72], v: 18, scale: 64, oct: 2 }),
    tent: makeTex({ base: [150, 120, 70], v: 14, scale: 64, oct: 2 }),
    metal: makeTex({ base: [96, 112, 110], v: 16, scale: 4, stretch: 0.05, oct: 4 }),
    water: makeTex({ base: [128, 128, 128], v: 60, scale: 6, size: 256, rep: [4, 4], srgb: false }),
    bark: makeTex({ base: [70, 52, 40], v: 26, scale: 4, stretch: 0.1 })
  };
  T.ground.repeat.set(90, 90);
  T.locker = makeTex({ base: [92, 108, 104], v: 14, scale: 4, stretch: 0.05, paint: (g, s) => {
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(10, 10, s - 20, s - 20);
    g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 6; i++) g.fillRect(s * 0.25, 28 + i * 9, s * 0.5, 3);
    g.fillStyle = 'rgba(210,210,200,.8)'; g.fillRect(s - 38, s * 0.5, 8, 26);
  } });
  T.screen = makeTex({ base: [6, 24, 22], v: 4, scale: 8, oct: 1, paint: (g, s) => {
    g.strokeStyle = 'rgba(70,200,190,.18)'; g.lineWidth = 1;
    for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * s / 8, 0); g.lineTo(i * s / 8, s); g.moveTo(0, i * s / 8); g.lineTo(s, i * s / 8); g.stroke(); }
    g.strokeStyle = 'rgba(90,240,220,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 210);
    [[70, 190], [110, 195], [150, 150], [165, 110], [210, 95], [236, 60]].forEach(p => g.lineTo(p[0], p[1])); g.stroke();
  } });
  const M = {
    rock: std(T.rock, { flatShading: true, roughness: 0.95, bumpMap: T.rock, bumpScale: 2 }),
    wood: std(T.wood, { roughness: 0.85 }), fabric: std(T.fabric, { roughness: 1, side: THREE.DoubleSide }),
    tent: std(T.tent, { roughness: 1, side: THREE.DoubleSide }), metal: std(T.metal, { roughness: 0.45, metalness: 0.6 }),
    locker: std(T.locker, { roughness: 0.5, metalness: 0.5 }), dark: new THREE.MeshStandardMaterial({ color: 0x1b1d1e, roughness: 0.7, metalness: 0.5 })
  };

  /* --- terrain --- */
  const SIZE = 260, SEG = 200;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, terrainHeight(tp.getX(i), tp.getZ(i)));
  tg.computeVertexNormals();
  const cols = new Float32Array(tp.count * 3), tn = tg.attributes.normal;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), up = tn.getY(i), n = fbm(x * 0.4, z * 0.4);
    let c = [0.085 + n * 0.07, 0.15 + n * 0.1, 0.07 + n * 0.04];                       // grass / moss
    const dirt = sstep(0.25, 0.0, fbm(x * 0.08 + 9, z * 0.08)) * 0.7; c = c.map((v, k) => v + ([0.12, 0.09, 0.05][k] - v) * dirt);
    const pathW = 1.4 + fbm(z * 0.3, 7) * 1.4, onPath = (1 - sstep(pathW - 0.6, pathW + 0.4, Math.abs(x))) * sstep(-30, -26, z) * sstep(8, 4, z);
    c = c.map((v, k) => v + ([0.3, 0.25, 0.18][k] - v) * onPath);
    const shore = (1 - sstep(0.1, 1.4, y)) * (1 - sstep(8, 13, Math.hypot(x - POOL.x, z - POOL.z)));
    c = c.map((v, k) => v + ([0.2, 0.19, 0.17][k] - v) * shore * 0.8);
    const rocky = sstep(0.9, 0.68, up); c = c.map((v, k) => v + ([0.3, 0.31, 0.31][k] - v) * rocky);
    cols.set(c, i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  { const ia = tg.index.array, keep = []; for (let i = 0; i < ia.length; i += 3) { const cz = (tp.getZ(ia[i]) + tp.getZ(ia[i + 1]) + tp.getZ(ia[i + 2])) / 3; if (cz > WALL_Z - 0.5) keep.push(ia[i], ia[i + 1], ia[i + 2]); } tg.setIndex(keep); }
  add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: T.ground, bumpMap: T.ground, bumpScale: 1.2, roughness: 1 })), { cast: false });

  /* --- cliff face with cave mouth (opening 5 m wide, 3.5 m above the waterline) --- */
  const wallMat = M.rock, OW = 9, TOP = 9;
  const left = rockBox(110 - OW, 28, 6, 96, 28, 3, [-(110 + OW) / 2, 10, WALL_Z - 3], wallMat);
  const right = rockBox(110 - OW, 28, 6, 96, 28, 3, [(110 + OW) / 2, 10, WALL_Z - 3], wallMat);
  const lintel = rockBox(OW * 2, 24 - TOP, 6, 18, 15, 3, [0, (TOP + 24) / 2, WALL_Z - 3], wallMat, 0.5);
  [left, right, lintel].forEach(m => { scene.add(m); solid(m); });


  /* --- the cave: SDF mesh whose mouth plugs the hole in the cliff face --- */
  const faceK = (x, y) => 0.7 * (fbm(x * 0.35 + WALL_Z * 0.2, y * 0.35 + 3.1) - 0.5) * 2;   // same displacement as the cliff slabs
  const cave = buildCave({ outside: (x, y, z) => z - (WALL_Z + faceK(x, y)) + 0.12, stopZ: WALL_Z - 0.5,
    plug: { minX: -9.4, maxX: 9.4, minY: -4.5, maxY: 9.4, minZ: WALL_Z - 2, maxZ: WALL_Z + 1.2 } });
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cave.positions, 3)); cg.setIndex(new THREE.BufferAttribute(cave.indices, 1));
  cg.computeVertexNormals();
  { const p = cg.attributes.position, nrm = cg.attributes.normal, n = p.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ay >= ax && ay >= az) { uv[i * 2] = x / 3; uv[i * 2 + 1] = z / 3; } else if (ax >= az) { uv[i * 2] = z / 3; uv[i * 2 + 1] = y / 3; } else { uv[i * 2] = x / 3; uv[i * 2 + 1] = y / 3; }
      const strata = noise3(x * 0.25, y * 1.4, z * 0.25), mineral = sstep(0.6, 0.78, noise3(x * 0.6 + 7, y * 0.6, z * 0.6) * 0.6 + noise3(x * 1.7, y * 1.7, z * 1.7) * 0.4);
      let c = [0.27 + strata * 0.1, 0.235 + strata * 0.09, 0.185 + strata * 0.07];                  // limestone, banded
      c = c.map((v, k) => v + ([0.5, 0.47, 0.42][k] - v) * mineral * 0.7);                            // pale mineral deposits
      const wet = 1 - sstep(WATER_Y + 0.2, WATER_Y + 1.8, y); c = c.map((v, k) => v * (1 - 0.45 * wet) + [0.0, 0.012, 0.006][k] * wet);   // dark, wet near and below the waterline
      const floor = sstep(0.55, 0.85, ny); c = c.map((v, k) => v + ([0.2, 0.17, 0.13][k] - v) * floor * 0.8);                                // silty sediment on floors
      col.set(c.map(v => v * 1.8), i * 3);
    }
    cg.setAttribute('color', new THREE.BufferAttribute(col, 3)); cg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  cg.computeBoundingSphere();
  const caveMesh = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, map: T.rock, bumpMap: T.rock, bumpScale: 2.5, roughness: 0.55, metalness: 0.02 }));
  caveMesh.receiveShadow = false; caveMesh.castShadow = false; scene.add(caveMesh);

  /* --- water --- */
  const wMat = new THREE.MeshStandardMaterial({ color: 0x0a3a46, roughness: 0.06, metalness: 0.25, transparent: true, opacity: 0.86, bumpMap: T.water, bumpScale: 0.5, side: THREE.DoubleSide });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(24, WALL_Z * -1 - 26.1 - 0.3), wMat);       // pool in front of the cliff
  water.rotation.x = -Math.PI / 2; water.position.set(0, WATER_Y, (-26.1 + WALL_Z + 0.3) / 2); water.receiveShadow = true; scene.add(water);
  const caveWater = new THREE.Mesh(new THREE.PlaneGeometry(110, 232), wMat.clone());               // one water table through the whole cave
  caveWater.material.side = THREE.DoubleSide; caveWater.rotation.x = -Math.PI / 2; caveWater.position.set(-20, WATER_Y, WALL_Z + 0.3 - 116); scene.add(caveWater);

  /* --- dock (cave access) --- */
  const dock = new THREE.Group();
  for (let z = DOCK.minZ; z < DOCK.maxZ; z += 0.5) { const p = box(2.4, 0.08, 0.46, M.wood, 0, DOCK.y - 0.04, z + 0.25); p.rotation.y = (hash2(z, 1) - 0.5) * 0.02; dock.add(p); }
  for (const sx of [-1, 1]) { dock.add(box(0.14, 0.14, 8, M.wood, sx * 1.1, DOCK.y - 0.18, -31));
    for (const pz of [-34.6, -31, -27.4]) dock.add(box(0.2, 3.5, 0.2, M.wood, sx * 1.1, DOCK.y - 1.8, pz)); }
  dock.children.forEach(c => { c.castShadow = c.receiveShadow = true; }); scene.add(dock);

  /* --- expedition base --- */
  // Prep canopy: tarp on four posts, prep table, equipment lockers
  const CX = -9, CZ = -13;
  const canopy = new THREE.Group(); canopy.position.set(CX, 0, CZ);
  for (const [px, pz] of [[-4, -2.6], [4, -2.6], [-4, 2.6], [4, 2.6]]) { const post = box(0.12, 2.7, 0.12, M.wood, px, 1.35, pz); canopy.add(post); }
  const tarp = box(8.6, 0.05, 5.8, M.fabric, 0, 2.75, 0); tarp.rotation.x = 0.08; canopy.add(tarp);
  const table = new THREE.Group();
  table.add(box(3.4, 0.07, 1.1, M.wood, 0, 0.92, 0));
  for (const [lx, lz] of [[-1.55, -0.45], [1.55, -0.45], [-1.55, 0.45], [1.55, 0.45]]) table.add(box(0.08, 0.9, 0.08, M.wood, lx, 0.46, lz));
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12), std(T.tent, { roughness: 0.8 })); roll.rotation.z = Math.PI / 2; roll.position.set(-0.8, 1.01, 0.1); table.add(roll);
  const lantern = new THREE.Group();
  lantern.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 2.2 })));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.05, 12), M.dark); cap.position.y = 0.15; lantern.add(cap);
  lantern.position.set(0.9, 1.08, 0); table.add(lantern);
  const lanternLight = new THREE.PointLight(0xffc680, 7, 14, 2); lanternLight.position.set(0.9, 1.3, 0); lanternLight.castShadow = false; table.add(lanternLight);
  table.position.set(0, 0, 0.6); canopy.add(table);
  for (let i = 0; i < 3; i++) { const l = box(0.62, 1.95, 0.52, M.locker, -2.3 + i * 0.66, 0.975, -2.15); canopy.add(l); }
  canopy.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  scene.add(canopy);
  solid(table, 0);
  canopy.children.filter(c => c.geometry && c.geometry.parameters.height === 2.7 || (c.geometry && c.geometry.parameters.height === 1.95)).forEach(c => solid(c, 0.05));

  // Research tent with survey station
  const tent = new THREE.Group(); tent.position.set(10, 0, -12);
  const W = 2, H = 2.2, D = 5, ang = Math.atan2(W, H), len = Math.hypot(W, H);
  for (const s of [-1, 1]) { const p = box(0.04, len, D, M.tent, s * W / 2, H / 2, 0); p.rotation.z = s * ang; tent.add(p); }
  const gableShape = new THREE.Shape([new THREE.Vector2(-W, 0), new THREE.Vector2(W, 0), new THREE.Vector2(0, H)]);
  const gable = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), M.tent); gable.position.z = -D / 2; tent.add(gable);
  tent.add(box(W * 2, 0.03, D, std(T.fabric, { color: 0x555555 }), 0, 0.02, 0));
  const desk = box(1.7, 0.05, 0.8, M.wood, 0, 0.78, -1.6); tent.add(desk);
  for (const [lx, lz] of [[-0.78, -1.9], [0.78, -1.9], [-0.78, -1.3], [0.78, -1.3]]) tent.add(box(0.05, 0.76, 0.05, M.wood, lx, 0.38, lz));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshStandardMaterial({ map: T.screen, emissive: 0xffffff, emissiveMap: T.screen, emissiveIntensity: 1.1 }));
  scr.position.set(0, 1.05, -1.85); scr.rotation.x = -0.12; tent.add(scr);
  tent.add(box(0.62, 0.04, 0.3, M.dark, 0, 0.82, -1.72));
  const scrLight = new THREE.PointLight(0x5ff0dc, 3.5, 6, 2); scrLight.position.set(0, 1.2, -1.2); tent.add(scrLight);
  tent.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  scene.add(tent);
  for (const s of [-1, 1]) { const w = box(0.5, 1.6, D, M.dark, s * (W - 0.2), 0.8, 0); w.visible = false; tent.add(w); solid(w); w.removeFromParent(); }
  solid(desk, 0.05);

  // Supply stack
  const supplies = new THREE.Group(); supplies.position.set(-14, 0, -8);
  supplies.add(box(1.4, 0.14, 1.4, M.wood, 0, 0.07, 0));
  supplies.add(box(0.62, 0.5, 0.62, M.wood, -0.33, 0.39, -0.3)); supplies.add(box(0.62, 0.5, 0.62, M.wood, 0.34, 0.39, -0.28));
  supplies.add(box(0.62, 0.5, 0.62, M.wood, -0.3, 0.39, 0.34)); supplies.add(box(0.6, 0.5, 0.6, M.wood, 0.0, 0.89, 0));
  supplies.rotation.y = 0.3; supplies.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); scene.add(supplies); solid(supplies);

  // Floodlights
  const floodLights = [];
  for (const [fx, fz, ry] of [[-2.5, -19.5, 0.3], [5, -3, -0.5]]) {
    const g = new THREE.Group(); g.position.set(fx, 0, fz); g.rotation.y = ry;
    g.add(box(0.12, 4.6, 0.12, M.metal, 0, 2.3, 0));
    const head = box(0.6, 0.35, 0.28, M.dark, 0, 4.7, 0.1); head.rotation.x = 0.5; g.add(head);
    const lens = box(0.52, 0.28, 0.02, new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffe2b0, emissiveIntensity: 3 }), 0, 4.66, 0.26); lens.rotation.x = 0.5; g.add(lens);
    const l = new THREE.PointLight(0xffe4b8, 55, 34, 2); l.position.set(0, 4.3, 0.6); g.add(l); floodLights.push(l);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); solid(g.children[0], 0.1);
  }

  /* --- natural scatter (trees, bushes, rocks) --- */
  const slopeAt = (x, z) => Math.hypot(terrainHeight(x + 1, z) - terrainHeight(x, z), terrainHeight(x, z + 1) - terrainHeight(x, z));
  function scatter(geo, mat, count, tries, ok, place) {
    const spots = []; for (let i = 0; i < tries && spots.length < count; i++) { const x = (R() - 0.5) * 220, z = (R() - 0.5) * 220; if (ok(x, z)) spots.push([x, z]); }
    const im = new THREE.InstancedMesh(geo, mat, spots.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    spots.forEach(([x, z], i) => { const s = place(x, z); e.set(s.rx || 0, R() * 6.28, s.rz || 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, s.y, z), q, new THREE.Vector3(s.sx, s.sy, s.sz)); im.setMatrixAt(i, m4); });
    im.castShadow = im.receiveShadow = true; scene.add(im); return spots;
  }
  const free = (x, z, minD) => Math.hypot(x, z + 10) > minD && z > WALL_Z + 2 && Math.hypot(x - POOL.x, z - POOL.z) > 13 && !(Math.abs(x) < 4 && z < 10 && z > -33);
  const paintGeo = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const trunkG = new THREE.CylinderGeometry(0.14, 0.26, 3.2, 7); trunkG.translate(0, 1.6, 0); paintGeo(trunkG, [0.2, 0.14, 0.1]);
  const crowns = [[1.9, 2.4, 2.3], [1.5, 2.2, 3.5], [1.05, 2.0, 4.6]].map(([r, h, y]) => { const c = new THREE.ConeGeometry(r, h, 8); c.translate(0, y, 0); return paintGeo(c, [0.07, 0.17, 0.1]); });
  const treeG = mergeGeometries([trunkG, ...crowns]);
  const treeSpots = scatter(treeG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 28, 1500,
    (x, z) => Math.hypot(x, (z + 24) * 0.85) > 25 && Math.hypot(x, (z + 24) * 0.85) < 50 && z > WALL_Z + 3 && slopeAt(x, z) < 0.6,
    (x, z) => { const s = 0.8 + R() * 0.9; return { y: terrainHeight(x, z) - 0.1, sx: s, sy: s, sz: s }; });
  treeSpots.forEach(([x, z]) => colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, minY: -50, maxY: 50 }));
  scatter(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x20381f, roughness: 1, flatShading: true }), 30, 600,
    (x, z) => free(x, z, 14) && Math.hypot(x, (z + 24) * 0.85) < 24 && slopeAt(x, z) < 0.6, (x, z) => { const s = 0.5 + R() * 0.8; return { y: terrainHeight(x, z) + 0.25 * s, sx: s * 1.3, sy: s * 0.7, sz: s * 1.3 }; });
  const rg = new THREE.IcosahedronGeometry(1, 1), rp = rg.attributes.position;
  for (let i = 0; i < rp.count; i++) { const k = 0.75 + hash2(rp.getX(i) * 9, rp.getZ(i) * 9 + rp.getY(i) * 5) * 0.5; rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k * 0.8, rp.getZ(i) * k); }
  rg.computeVertexNormals();
  scatter(rg, M.rock, 55, 1200, (x, z) => (Math.hypot(x, (z + 24) * 0.85) < 30) && (Math.hypot(x, z + 10) > 9) && z > WALL_Z + 1.5 && Math.hypot(x - POOL.x, z - POOL.z) > 9.8 && !(Math.abs(x) < 2.5 && z < 8 && z > -27),
    (x, z) => { const s = 0.25 + R() * R() * 1.6; return { y: terrainHeight(x, z) + s * 0.3, sx: s * 1.2, sy: s, sz: s * 1.1, rx: R(), rz: R() }; });

  /* --- API --- */
  const CAVE_Z = WALL_Z + 0.9;                          // beyond this plane the world is the cave
  const groundHeight = (x, z, y = 0) => {
    if (z < CAVE_Z) { const f = cave.floorBelow(x, y + 0.7, z, 8); return f === null ? -99 : f; }
    return (x > DOCK.minX && x < DOCK.maxX && z > DOCK.minZ && z < DOCK.maxZ) ? DOCK.y : terrainHeight(x, z);
  };
  const hemiBase = hemi.intensity, sunBase = sun.intensity, fogOut = new THREE.Color(FOG), fogIn = new THREE.Color(0x03070a);
  return {
    colliders, groundHeight, terrain: terrainHeight, cave, caveZ: CAVE_Z, anchors: { table: [-9, 1.0, -12.4], lockers: [-10.6, 1.0, -15.1], terminal: [10, 1.05, -13.85] }, bound: 60, spawn: { x: 0, z: -4, yaw: 0 }, stats: cave.stats,
    update(dt, camera) {
      sky.position.copy(camera.position); stars.position.copy(camera.position); moon.position.copy(camera.position).addScaledVector(moonDir, 400);
      T.water.offset.x += dt * 0.012; T.water.offset.y += dt * 0.007;
      lanternLight.intensity = 7 + Math.sin(performance.now() * 0.011) * 0.25 + Math.sin(performance.now() * 0.0047) * 0.2;
      // fade moon/sky light out as the player goes underground; the cave gets only a faint ambient
      const d = Math.min(1, Math.max(0, (WALL_Z + 1 - camera.position.z) / 5));
      sun.intensity = sunBase * (1 - d); hemi.intensity = hemiBase * (1 - d); caveAmbient.intensity = 0.55 * d;
      scene.fog.density = 0.013 + 0.03 * d; scene.fog.color.copy(fogOut).lerp(fogIn, d); scene.background.copy(scene.fog.color);
    }
  };
}
