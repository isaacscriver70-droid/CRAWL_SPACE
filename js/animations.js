// Animation system for the diver: a joint-by-joint arm rig driven by gameplay state, plus body/leg animation.
import * as THREE from 'three';
import { createArm, createFlashlight, createBeam, createGauge, createDiverBody } from './player.js';

const EVENTS = { reach: 0.7, pickup: 1.1, inspect: 1.3, enter: 0.9, exit: 0.8, react: 0.9, operate: 0.9 };
const KEYS = ['sx', 'sy', 'sz', 'ex', 'wx', 'wz', 'curl'];
const lerp = (a, b, t) => a + (b - a) * t;
const bump = (t, d) => Math.sin(Math.min(1, t / d) * Math.PI);

export class DiverAnimator {
  constructor(scene, camera) {
    this.camera = camera; this.t = 0; this.ev = null; this.swimBlend = 0; this.legPhase = 0; this.gaugeT = 0;
    this.R = createArm(true); this.L = createArm(false);
    this.view = new THREE.Group(); camera.add(this.view);
    this.R.shoulder.position.set(0.23, -0.2, -0.06); this.L.shoulder.position.set(-0.23, -0.2, -0.06);
    this.view.add(this.R.shoulder, this.L.shoulder);
    this.light = createFlashlight(); this.light.position.set(0, 0.0, -0.05); this.R.hand.add(this.light);   // held in the right fist, pointing along the hand
    this.beam = createBeam(); this.light.add(this.beam); this.beam.position.z = -0.16;
    this.gauge = createGauge(); this.gauge.position.set(0, -0.19, -0.05); this.gauge.rotation.x = -Math.PI / 2; this.L.elbow.add(this.gauge);   // on the back of the left forearm
    this.body = createDiverBody(); scene.add(this.body);
    this.cur = { R: Object.fromEntries(KEYS.map(k => [k, 0])), L: Object.fromEntries(KEYS.map(k => [k, 0])) };
    this.cur.R.sx = 0.8; this.cur.L.sx = 0.8;
  }
  trigger(name) { if (EVENTS[name]) this.ev = { name, t: 0, dur: EVENTS[name] }; }

  // s: { swimming, speed, sprinting, crouching, onGround, bobT, squeeze(bool), dead, tankOn, lightOn, depth, air, yaw, pitch }
  update(dt, s) {
    this.t += dt; const t = this.t, sp = Math.min(1, s.speed / (s.swimming ? 2.4 : 5.9));
    const R = { sx: 0.8, sy: 0.22, sz: 0, ex: 1.1, wx: -0.33, wz: 0, curl: 0.85 }, L = { sx: 0.8, sy: -0.22, sz: 0, ex: 1.1, wx: -0.2, wz: 0, curl: 0.5 };
    const br = Math.sin(t * 1.6) * 0.012; R.sx += br; L.sx += br * 1.2; R.ex -= br; L.ex -= br;                           // breathing
    if (!s.swimming) {
      const sw = Math.sin(s.bobT * 2) * (0.04 + 0.1 * sp), run = s.sprinting ? 1 : 0;
      R.sx += sw + run * 0.2; L.sx -= sw - run * 0.2; R.ex += run * 0.35 + Math.abs(sw) * 0.5; L.ex += run * 0.45 - sw * 0.4; R.sy += Math.cos(s.bobT) * 0.03 * sp; L.sy += Math.cos(s.bobT) * 0.03 * sp;
      if (s.crouching) { R.sx += 0.12; L.sx += 0.12; R.ex += 0.1; L.ex += 0.1; }
      if (!s.onGround) { R.sx -= 0.2; L.sx -= 0.2; R.sy += 0.2; L.sy -= 0.2; }                                         // jumping: arms out a little
    } else if (s.squeeze) {                                                                                           // squeezing through a restriction: arms streamlined ahead
      R.sx = 1.25; R.ex = 0.15; R.sy = 0.08; L.sx = 1.25; L.ex = 0.15; L.sy = -0.08; R.wx = -0.1; L.wx = 0;
    } else {
      const k = Math.sin(t * (2 + sp * 4)), hov = 1 - sp;                                                               // swimming: light arm strokes; hover: arms relaxed and spread
      R.sx = 0.65 + 0.12 * k * sp + 0.05 * Math.sin(t * 1.1) * hov; L.sx = 0.6 - 0.12 * k * sp + 0.05 * Math.sin(t * 1.3 + 1) * hov;
      R.sy = 0.2 + 0.18 * hov; L.sy = -0.2 - 0.18 * hov; R.ex = 1.2 + 0.2 * k * sp; L.ex = 1.0 - 0.2 * k * sp;
    }
    if (s.dead) { R.sx = L.sx = 0.15; R.ex = L.ex = 0.3; R.sy = 0.5; L.sy = -0.5; R.curl = L.curl = 0.1; R.wx = L.wx = 0.4; }
    // one-shot gestures
    if (this.ev) {
      this.ev.t += dt; const e = this.ev, p = bump(e.t, e.dur), u = e.t / e.dur;
      if (e.name === 'reach' || e.name === 'operate') { R.sx = lerp(R.sx, 1.5, p); R.ex = lerp(R.ex, 0.15, p); R.sy = lerp(R.sy, 0.04, p); R.curl = lerp(R.curl, e.name === 'reach' ? 0.1 : 0.7, p); }
      else if (e.name === 'pickup') { R.sx = lerp(R.sx, 1.4, p); R.ex = lerp(R.ex, 0.4, p); L.sx = lerp(L.sx, 1.4, p); L.ex = lerp(L.ex, 0.4, p); R.sy = lerp(R.sy, 0.1, p); L.sy = lerp(L.sy, -0.1, p); L.curl = R.curl = u < 0.5 ? 0.1 : 0.9; }
      else if (e.name === 'inspect') { L.sx = lerp(L.sx, 1.2, p); L.ex = lerp(L.ex, 1.9, p); L.sy = lerp(L.sy, -0.55, p); L.wx = lerp(L.wx, 0.5, p); }
      else if (e.name === 'enter') { R.sx = lerp(R.sx, 1.5, p); L.sx = lerp(L.sx, 1.5, p); R.ex = lerp(R.ex, 0.2, p); L.ex = lerp(L.ex, 0.2, p); }
      else if (e.name === 'exit') { R.sx = lerp(R.sx, 0.3, p); L.sx = lerp(L.sx, 0.3, p); R.ex = lerp(R.ex, 0.5, p); L.ex = lerp(L.ex, 0.5, p); }
      else if (e.name === 'react') { R.sx = lerp(R.sx, 1.3, p); L.sx = lerp(L.sx, 1.3, p); R.ex = lerp(R.ex, 1.7, p); L.ex = lerp(L.ex, 1.7, p); R.sy = lerp(R.sy, -0.1, p); L.sy = lerp(L.sy, 0.1, p); }
      if (e.t >= e.dur) this.ev = null;
    }
    const f = 1 - Math.exp(-10 * dt);
    for (const [name, target, arm] of [['R', R, this.R], ['L', L, this.L]]) {
      const c = this.cur[name]; for (const k of KEYS) c[k] += ((target[k] ?? 0) - c[k]) * f;
      arm.shoulder.rotation.set(c.sx, c.sy, c.sz); arm.elbow.rotation.x = c.ex; arm.wrist.rotation.set(c.wx, 0, c.wz);
      for (let i = 0; i < arm.fingers.length; i++) arm.fingers[i].rotation.x = c.curl * 1.1 * (i % 2 === 0 ? 0.9 : 0.8) * (i >= 8 ? 0.5 : 1);
    }
    // flashlight beam strength (scattering is stronger in water)
    this.beam.material.uniforms.uI.value = s.lightOn ? (s.swimming || s.depth > 0 ? 0.28 : 0.07) : 0; this.light.userData.lens.material.emissiveIntensity = s.lightOn ? 3 : 0;
    // wrist computer shows real depth/air
    if ((this.gaugeT -= dt) < 0) { this.gaugeT = 0.4; this.gauge.userData.draw(s.depth, s.air); }
    // body: upright on land, streamlined along the view direction while swimming; legs kick
    this.swimBlend += ((s.swimming ? 1 : 0) - this.swimBlend) * (1 - Math.exp(-5 * dt));
    const cam = this.camera, b = this.body, th = lerp(0, Math.max(-1.2, Math.min(1.2, s.pitch)) - Math.PI / 2, this.swimBlend);
    b.position.set(cam.position.x + Math.sin(s.yaw) * 0.1, cam.position.y - 0.02, cam.position.z + Math.cos(s.yaw) * 0.1); b.rotation.set(th, s.yaw, 0, 'YXZ');
    this.legPhase += dt * (s.swimming ? 2.5 + sp * 5 : s.speed * 2.3);
    const amp = s.swimming ? 0.18 + 0.35 * sp : Math.min(0.6, s.speed * 0.12);
    b.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(this.legPhase + i * Math.PI) * amp + (s.crouching ? -0.5 : 0); });
    b.userData.tank.visible = !!s.tankOn;
  }
}
