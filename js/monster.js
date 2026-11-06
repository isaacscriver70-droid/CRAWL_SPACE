// The cave creature: a skinned, rigged body (spine + tail bones), a hinged-jaw skull with teeth, sensory barbels,
// jointed limbs with fingers, and an animator driven by the AI state.
import * as THREE from 'three';
import { makeTex } from './textures.js';

const rnd = (x, y) => { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return h - Math.floor(h); };
const N_RING = 80, N_SEG = 18;

function limb(side, big) {
  const g = new THREE.Group(), L1 = big ? 0.5 : 0.42, L2 = big ? 0.52 : 0.44, r = big ? 0.034 : 0.03;
  const skin = limb.skin;
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(r, L1 - r * 2, 4, 8), skin); upper.position.y = -L1 / 2; g.add(upper);
  const elbow = new THREE.Group(); elbow.position.y = -L1; g.add(elbow);
  const lower = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.8, L2 - r * 1.6, 4, 8), skin); lower.position.y = -L2 / 2; elbow.add(lower);
  const wrist = new THREE.Group(); wrist.position.y = -L2; elbow.add(wrist);
  wrist.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 8, 6), skin));
  const fingers = [];
  for (let i = 0; i < 3; i++) {
    const f1 = new THREE.Group(); f1.rotation.z = (i - 1) * 0.45 * side; f1.rotation.x = 0;
    const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.2, 3, 6), skin); s1.position.set(0, -0.11, 0); f1.add(s1);
    const f2 = new THREE.Group(); f2.position.y = -0.22; const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.17, 3, 6), skin); s2.position.set(0, -0.095, 0); f2.add(s2);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.05, 5), limb.tooth); claw.position.y = -0.2; claw.rotation.x = Math.PI; f2.add(claw);
    f1.add(f2); wrist.add(f1); fingers.push(f1, f2);
  }
  return { shoulder: g, elbow, wrist, fingers };
}

export function createCreature() {
  const skinTex = makeTex({ base: [158, 146, 138], v: 40, scale: 7, oct: 4, size: 256, rep: [3, 3], paint: (g, s) => {
    g.strokeStyle = 'rgba(120,70,80,.28)'; g.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) { g.beginPath(); let x = rnd(i, 1) * s, y = rnd(i, 2) * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd(i, k + 5) - 0.5) * 50; y += (rnd(k, i + 9) - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  } });
  const skin = new THREE.MeshStandardMaterial({ map: skinTex, bumpMap: skinTex, bumpScale: 1.6, roughness: 0.48, metalness: 0, emissive: 0x120c0b });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xe0d6b6, roughness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: 0x1c1314, roughness: 0.9 });
  limb.skin = skin; limb.tooth = tooth;

  /* --- bones --- */
  const bones = [], root = new THREE.Bone(); bones.push(root);
  const front = [], tail = []; let prev = root;
  for (let i = 0; i < 6; i++) { const b = new THREE.Bone(); b.position.z = -0.3; prev.add(b); bones.push(b); front.push(b); prev = b; }
  const headBone = new THREE.Bone(); headBone.position.z = -0.3; prev.add(headBone); bones.push(headBone);
  prev = root; for (let i = 0; i < 7; i++) { const b = new THREE.Bone(); b.position.z = 0.32; prev.add(b); bones.push(b); tail.push(b); prev = b; }
  const frontZ = [0, -0.3, -0.6, -0.9, -1.2, -1.5, -1.8], frontIdx = [0, 1, 2, 3, 4, 5, 6], tailZ = [0, 0.32, 0.64, 0.96, 1.28, 1.6, 1.92, 2.24], tailIdx = [0, 8, 9, 10, 11, 12, 13, 14];

  /* --- skinned body: rings along the spine with belly folds, dorsal ridge and wrinkles --- */
  const radius = z => z < 0 ? (z > -0.5 ? 0.22 + 0.03 * (-z / 0.5) : 0.25 - 0.13 * Math.min(1, (-z - 0.5) / 1.4)) : 0.22 * Math.pow(Math.max(0, 1 - z / 2.3), 0.9) + 0.014;
  const pos = [], idx = [], sIdx = [], sW = [], uv = [];
  for (let r = 0; r <= N_RING; r++) {
    const z = -1.9 + (r / N_RING) * 4.2, base = radius(z), fold = z < -0.8 ? 0.03 * Math.sin(z * 36) : 0.015 * Math.sin(z * 22);
    const list = z <= 0 ? frontZ : tailZ, ids = z <= 0 ? frontIdx : tailIdx; let a = 0; const az = Math.abs(z), la = list.map(Math.abs);
    while (a < la.length - 2 && az > la[a + 1]) a++; const t = Math.min(1, Math.max(0, (az - la[a]) / (la[a + 1] - la[a])));
    for (let s = 0; s < N_SEG; s++) {
      const th = (s / N_SEG) * Math.PI * 2, n = rnd(r * 0.37, s * 1.3), rr = base * (1 + fold + 0.045 * Math.sin(th * 5 + z * 4) + 0.03 * n) * 1;
      const dorsal = Math.max(0, Math.cos(th)) ** 6 * 0.1 * base, belly = Math.max(0, -Math.cos(th)) ** 2 * 0.07 * base * Math.sin(z * 9);
      pos.push(Math.sin(th) * rr * 1.12, Math.cos(th) * (rr + dorsal - belly) * 0.86, z); uv.push(s / N_SEG * 3, r / N_RING * 6);
      sIdx.push(ids[a], ids[a + 1], 0, 0); sW.push(1 - t, t, 0, 0);
    }
  }
  for (let r = 0; r < N_RING; r++) for (let s = 0; s < N_SEG; s++) { const a = r * N_SEG + s, b = r * N_SEG + (s + 1) % N_SEG, c = a + N_SEG, d = b + N_SEG; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sW, 4)); geo.setIndex(idx); geo.computeVertexNormals();
  const body = new THREE.SkinnedMesh(geo, skin); body.frustumCulled = false; body.add(root); body.updateMatrixWorld(true); body.bind(new THREE.Skeleton(bones));
  body.castShadow = true;
  const group = new THREE.Group(); group.add(body);

  /* --- head: skull, hinged jaw, teeth, barbels, vestigial eyes, gill slits (rigid on the head bone) --- */
  const head = new THREE.Group(); headBone.add(head);
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin); cranium.scale.set(0.15, 0.11, 0.3); cranium.position.set(0, 0.01, -0.1); head.add(cranium);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), skin); snout.scale.set(0.105, 0.065, 0.3); snout.position.set(0, -0.015, -0.34); head.add(snout);
  for (const s of [-1, 1]) { const brow = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), skin); brow.scale.set(0.05, 0.03, 0.12); brow.position.set(s * 0.1, 0.09, -0.13); brow.rotation.y = s * 0.3; head.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), dark); eye.scale.z = 0.4; eye.position.set(s * 0.138, 0.04, -0.17); head.add(eye);                  // blind, vestigial eyes
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dark); nos.position.set(s * 0.032, 0.0, -0.6); head.add(nos);
    for (let k = 0; k < 3; k++) { const gill = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.012), dark); gill.position.set(s * 0.125, -0.01, 0.0 + k * 0.045); head.add(gill); } }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.06, -0.02); head.add(jaw);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), skin); lower.scale.set(0.085, 0.032, 0.3); lower.position.set(0, -0.012, -0.27); jaw.add(lower);
  for (let i = 0; i < 9; i++) {
    const z = -0.1 - i * 0.045, w = 0.075 - i * 0.004, h = 0.045 - Math.abs(i - 3) * 0.003;
    for (const s of [-1, 1]) {
      const lt = new THREE.Mesh(new THREE.ConeGeometry(0.0085, h, 6), tooth); lt.position.set(s * w, 0.012 + h / 2 - 0.004, z); lt.rotation.z = -s * 0.1; jaw.add(lt);                      // lower teeth, root inside the jaw
      const ut = new THREE.Mesh(new THREE.ConeGeometry(0.0085, h, 6), tooth); ut.rotation.x = Math.PI; ut.position.set(s * (w + 0.008), -0.05 - h / 2 + 0.012 + 0.06, z - 0.02); head.add(ut);         // upper teeth hang from the skull
    }
  }
  const barbels = new THREE.Group(); head.add(barbels); const barbelList = [];
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1, g = new THREE.Group(); g.position.set(s * 0.05, -0.07, -0.25 - Math.floor(i / 2) * 0.12);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.0016, 0.3, 5), skin); m.position.y = -0.15; g.add(m); g.rotation.z = s * 0.4; barbels.add(g); barbelList.push(g);
  }
  const handHold = new THREE.Group(); handHold.position.set(0, -0.02, -0.72); head.add(handHold);   // where a grabbed object is carried (in the jaws)

  /* --- limbs --- */
  const limbs = [], mount = (bone, x, y, z, side, big) => { const l = limb(side, big); l.shoulder.position.set(x, y, z); l.side = side; bone.add(l.shoulder); limbs.push(l); return l; };
  const FL = mount(front[1], -0.2, -0.07, 0, -1, true), FR = mount(front[1], 0.2, -0.07, 0, 1, true), RL = mount(root, -0.16, -0.07, 0.1, -1, false), RR = mount(root, 0.16, -0.07, 0.1, 1, false);
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });

  /* --- animation --- */
  const st = { phase: 0, t: 0, prevYaw: 0, turn: 0, open: 0, squeeze: 0, lunge: 0, hold: null };
  const lerp = (a, b, t) => a + (b - a) * t;
  function update(dt, ai) {
    st.t += dt; const sp = Math.min(1, ai.speed / 3.4), state = ai.state;
    let dy = ai.yaw - st.prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); st.prevYaw = ai.yaw; st.turn += (Math.max(-1, Math.min(1, dy / Math.max(dt, 1e-3) * 0.25)) - st.turn) * (1 - Math.exp(-6 * dt));
    st.phase += dt * (1.6 + sp * 5.5 + (state === 'hunt' ? 2 : 0));
    const amp = (0.07 + 0.16 * sp) * (ai.squeezing ? 0.4 : 1) * (state === 'stalk' ? 0.7 : 1);
    // undulation travelling down the body; front stiffer, tail looser; the body bends into turns
    front.forEach((b, i) => { b.rotation.y = -Math.sin(st.phase - i * 0.55) * amp * 0.5 * (1 - i * 0.1) + st.turn * 0.12; b.rotation.x = (state === 'stalk' ? -0.03 : 0) + Math.sin(st.phase * 0.5 - i * 0.4) * 0.02; });
    tail.forEach((b, i) => { b.rotation.y = Math.sin(st.phase - (i + 1) * 0.6) * amp * (0.7 + i * 0.12) - st.turn * 0.1; b.rotation.x = Math.sin(st.phase * 0.5 - i * 0.5) * 0.03; });
    // head: sweeps while investigating/searching, lunges when attacking
    let sweep = 0, open = 0.04 + 0.03 * Math.sin(st.t * 1.2);
    if (state === 'investigate' || state === 'search') { sweep = Math.sin(st.t * 1.4) * 0.7; open = 0.2 + 0.1 * Math.sin(st.t * 3); }
    else if (state === 'stalk') { sweep = Math.sin(st.t * 0.7) * 0.25; open = 0.1; }
    else if (state === 'hunt') open = 0.55; else if (state === 'retreat') open = 0.2; else if (state === 'attack') open = ai.t > 0.3 ? 1 : 0.3;
    st.open += (open - st.open) * (1 - Math.exp(-9 * dt)); jaw.rotation.x = -st.open * 0.85 - ai.mouthOpen * 0.3;
    headBone.rotation.y += (sweep - headBone.rotation.y) * (1 - Math.exp(-5 * dt)); headBone.rotation.x = state === 'attack' ? -0.15 : 0.05 * Math.sin(st.t * 0.9);
    st.lunge += ((state === 'attack' ? 1 : 0) - st.lunge) * (1 - Math.exp(-10 * dt)); front.forEach((b, i) => { b.rotation.x += st.lunge * -0.06; b.position.z = -0.3 - st.lunge * 0.06; });   // neck stretches forward
    barbelList.forEach((b, i) => { b.rotation.x = Math.sin(st.t * 2 + i) * 0.35 * (0.4 + sp); b.rotation.y = Math.cos(st.t * 1.7 + i * 2) * 0.3; });
    // limbs: swept back along the body while swimming; tucked when squeezing; reaching when attacking; paddling when hovering
    st.squeeze += ((ai.squeezing ? 1 : 0) - st.squeeze) * (1 - Math.exp(-6 * dt));
    for (const l of limbs) {
      const front = l === FL || l === FR, back = -1.25 - 0.15 * sp, paddle = Math.sin(st.t * 2.2 + (l.side > 0 ? 0 : 1.7)) * 0.25 * (1 - sp);
      let sx = lerp(front ? -0.7 : -1.1, back, sp) + paddle, sz = l.side * lerp(0.55, 0.12, Math.max(sp, st.squeeze)), ex = lerp(-0.5, -0.15, sp) - st.squeeze * 0.5, curl = 0.5;
      if (front && state === 'attack') { const p = Math.min(1, ai.t / 0.5), grab = l === FR ? 1 : 0.4; sx = lerp(sx, 1.1 * grab + sx * (1 - grab), p); sz = lerp(sz, l.side * 0.2, p); ex = lerp(ex, 0.2, p); curl = ai.t > 0.55 ? 1.1 : 0.1; }
      l.shoulder.rotation.set(sx, 0, sz); l.elbow.rotation.x = ex; l.wrist.rotation.x = 0.2;
      l.fingers.forEach((f, i) => { f.rotation.x = (i % 2 ? 0.8 : 0.5) * curl; });
    }
    const sq = lerp(1, 0.8, st.squeeze); body.scale.set(sq, sq, lerp(1, 1.08, st.squeeze));
    group.position.set(ai.pos[0], ai.pos[1], ai.pos[2]); group.rotation.set(ai.pitch, ai.yaw, 0, 'YXZ');
  }
  return { group, update, jaw, handHold, head, FR, state: st };
}
