// Player models: diver body (suit, harness, tank, regulator hose, legs, fins), arms with gloved hands, flashlight, wrist computer.
import * as THREE from 'three';
import { makeTex } from './textures.js';

let MAT = null;
function mats() {
  if (MAT) return MAT;
  const neo = makeTex({ base: [38, 44, 52], v: 14, scale: 48, oct: 2, size: 128, rep: [2, 2] });
  const glove = makeTex({ base: [58, 54, 48], v: 22, scale: 32, oct: 3, size: 128, rep: [1, 1] });
  const strap = makeTex({ base: [30, 30, 32], v: 10, scale: 64, oct: 1, size: 64, rep: [2, 2] });
  MAT = {
    suit: new THREE.MeshStandardMaterial({ map: neo, roughness: 0.55, metalness: 0.05 }),
    suitDark: new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.6 }),
    glove: new THREE.MeshStandardMaterial({ map: glove, roughness: 0.85 }),
    strap: new THREE.MeshStandardMaterial({ map: strap, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa4a8, roughness: 0.35, metalness: 0.8 }),
    tank: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.4, metalness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.8 }),
    body: new THREE.MeshStandardMaterial({ color: 0xd2a226, roughness: 0.5, metalness: 0.3 })
  };
  return MAT;
}
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

export function createHand(right) {
  const M = mats(), h = new THREE.Group(), s = right ? 1 : -1;
  h.add(mesh(new THREE.BoxGeometry(0.085, 0.024, 0.09), M.glove, 0, -0.012, -0.045));
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f1 = new THREE.Group(); f1.position.set(-0.03 + i * 0.02, -0.012, -0.09);
    f1.add(mesh(new THREE.BoxGeometry(0.017, 0.018, 0.04), M.glove, 0, 0, -0.02));
    const f2 = new THREE.Group(); f2.position.set(0, 0, -0.04); f2.add(mesh(new THREE.BoxGeometry(0.015, 0.016, 0.032), M.glove, 0, 0, -0.016)); f1.add(f2);
    h.add(f1); fingers.push(f1, f2);
  }
  const t1 = new THREE.Group(); t1.position.set(-0.044 * s, -0.01, -0.03); t1.rotation.y = 0.6 * s;
  t1.add(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.04), M.glove, 0, 0, -0.02));
  const t2 = new THREE.Group(); t2.position.z = -0.04; t2.add(mesh(new THREE.BoxGeometry(0.017, 0.017, 0.03), M.glove, 0, 0, -0.015)); t1.add(t2);
  h.add(t1); fingers.push(t1, t2);
  h.userData.fingers = fingers;
  return h;
}

// One arm: shoulder -> upper arm -> elbow -> forearm -> wrist -> hand. Segments hang along local -y.
export function createArm(right) {
  const M = mats(), sh = new THREE.Group(), UP = 0.30, FO = 0.28;
  sh.add(mesh(new THREE.SphereGeometry(0.055, 12, 10), M.suit));
  const upper = mesh(new THREE.CapsuleGeometry(0.047, UP - 0.094, 6, 12), M.suit, 0, -UP / 2, 0); sh.add(upper);
  const elbow = new THREE.Group(); elbow.position.y = -UP; elbow.add(mesh(new THREE.SphereGeometry(0.048, 12, 10), M.suit)); sh.add(elbow);
  const fore = mesh(new THREE.CapsuleGeometry(0.04, FO - 0.08, 6, 12), M.suit, 0, -FO / 2, 0); elbow.add(fore);
  const cuff = mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.05, 14), M.rubber, 0, -FO + 0.04, 0); elbow.add(cuff);
  const wrist = new THREE.Group(); wrist.position.y = -FO; elbow.add(wrist);
  const hand = createHand(right); hand.rotation.x = -Math.PI / 2; wrist.add(hand);        // hand points along the forearm
  upper.castShadow = fore.castShadow = true;
  return { shoulder: sh, elbow, wrist, hand, fingers: hand.userData.fingers, fore };
}

export function createFlashlight() {
  const M = mats(), g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.2, 16), M.body); body.rotation.x = Math.PI / 2; g.add(body);
  const headM = mesh(new THREE.CylinderGeometry(0.047, 0.034, 0.07, 16), M.rubber, 0, 0, -0.125); headM.rotation.x = Math.PI / 2; g.add(headM);
  const lens = mesh(new THREE.CircleGeometry(0.041, 20), new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xffeecc, emissiveIntensity: 3 }), 0, 0, -0.161); lens.rotation.y = Math.PI; g.add(lens);
  const sw = mesh(new THREE.BoxGeometry(0.014, 0.01, 0.025), M.rubber, 0, 0.034, -0.03); g.add(sw);
  g.userData.lens = lens;
  return g;
}

export function createBeam() {
  const geo = new THREE.ConeGeometry(4.2, 14, 28, 1, true); geo.translate(0, -7, 0); geo.rotateX(Math.PI / 2);   // apex at origin, opens along -z
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0.2 }, uColor: { value: new THREE.Color(0.75, 0.85, 0.8) } },
    vertexShader: 'varying float vT; varying vec3 vN; varying vec3 vV; void main(){ vT=clamp(-position.z/14.0,0.0,1.0); vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying float vT; varying vec3 vN; varying vec3 vV; uniform float uI; uniform vec3 uColor; void main(){ float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.6); float a=uI*edge*pow(1.0-vT,1.4)*smoothstep(0.0,0.06,vT); gl_FragColor=vec4(uColor*a,a); }'
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 5; return m;
}

// Wrist dive computer with a live canvas display.
export function createGauge() {
  const M = mats(), c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.075, 0.016, 0.05), M.rubber));
  const scr = mesh(new THREE.PlaneGeometry(0.066, 0.034), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }), 0, 0.0085, 0); scr.rotation.x = -Math.PI / 2; g.add(scr);
  g.userData.draw = (depth, air, light) => {
    const x = c.getContext('2d'); x.fillStyle = '#03181c'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#6fe3d6'; x.font = 'bold 22px monospace';
    x.fillText(depth.toFixed(1) + 'm', 6, 24); x.fillStyle = air < 30 ? '#ff7a5c' : '#9fd8ff'; x.fillText('AIR ' + Math.round(air), 6, 50); tex.needsUpdate = true;
  };
  return g;
}

// Full diver body. Origin is at the head/neck point; the body hangs along -y. Used for the local player's visible torso and later for remote players.
export function createDiverBody({ head = false } = {}) {
  const M = mats(), g = new THREE.Group();
  const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.36, 6, 14), M.suit, 0, -0.52, 0.05); torso.scale.set(1.05, 1, 0.78); g.add(torso);
  g.add(mesh(new THREE.CylinderGeometry(0.205, 0.19, 0.07, 18), M.strap, 0, -0.79, 0.05));                    // weight belt
  for (const sx of [-1, 1]) { const st = mesh(new THREE.BoxGeometry(0.05, 0.5, 0.012), M.strap, sx * 0.12, -0.44, -0.125); st.rotation.x = 0.12; g.add(st); const bk = mesh(new THREE.BoxGeometry(0.035, 0.03, 0.02), M.metal, sx * 0.12, -0.33, -0.135); g.add(bk); }
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.035, 0.012), M.strap, 0, -0.4, -0.135));                            // chest strap
  const tank = new THREE.Group(); tank.position.set(0, -0.55, 0.3);
  tank.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 20), M.tank));
  tank.add(mesh(new THREE.SphereGeometry(0.09, 20, 10, 0, 6.283, 0, 1.57), M.tank, 0, 0.31, 0));
  tank.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), M.metal, 0, 0.37, 0));
  tank.add(mesh(new THREE.TorusGeometry(0.091, 0.008, 6, 20), M.rubber, 0, -0.18, 0).rotateX(Math.PI / 2));
  tank.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), M.metal, 0, 0.42, 0));
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(-0.2, 0.55, -0.12), new THREE.Vector3(-0.3, 0.38, -0.34), new THREE.Vector3(-0.22, 0.52, -0.46), new THREE.Vector3(-0.06, 0.58, -0.5)]), 24, 0.012, 6), M.rubber);
  tank.add(hose); g.add(tank); g.userData.tank = tank;
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.1, -0.85, 0.05);
    leg.add(mesh(new THREE.CapsuleGeometry(0.09, 0.42, 6, 12), M.suit, 0, -0.3, 0));
    const fin = mesh(new THREE.BoxGeometry(0.12, 0.025, 0.34), M.rubber, 0, -0.62, -0.1); fin.rotation.x = -0.35; leg.add(fin);
    g.add(leg); legs.push(leg);
  }
  g.userData.legs = legs;
  if (head) { g.add(mesh(new THREE.SphereGeometry(0.115, 14, 12), M.suitDark, 0, 0.02, 0)); g.add(mesh(new THREE.BoxGeometry(0.17, 0.09, 0.03), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 }), 0, 0.02, -0.11)); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// A loose oxygen tank (used when the creature tears it off the diver).
export function createTankMesh() {
  const M = mats(), tank = new THREE.Group();
  tank.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 20), M.tank));
  tank.add(mesh(new THREE.SphereGeometry(0.09, 20, 10, 0, 6.283, 0, 1.57), M.tank, 0, 0.31, 0));
  tank.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), M.metal, 0, 0.37, 0));
  tank.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), M.metal, 0, 0.42, 0));
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(-0.18, 0.55, -0.1), new THREE.Vector3(-0.28, 0.35, -0.12), new THREE.Vector3(-0.3, 0.1, 0.05)]), 16, 0.012, 6), M.rubber);
  tank.add(hose); tank.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return tank;
}
