// Opening cinematic: a scripted 3D sequence using an animated diver actor, the real world, the real creature model and camera direction.
// Prologue: the previous expedition's last dive. Preparation at the base -> walk to the dock -> enter the water -> swim into the cave
// -> something in the beam -> the creature tears the tank away.
import * as THREE from 'three';
import { createDiverBody, createArm, createFlashlight, createTankMesh } from './player.js';
import { WATER_LEVEL } from './cave.js';

const ease = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const LINES = [
  [1.0, [['mara', 'Gauge check. Tank pressure, two hundred bar. Regulator, clean.']]],
  [4.5, [['joel', 'Light is good. I still do not like the way the tags moved, Mara.']]],
  [7.0, [['mara', 'We go in together and we come out together. Come on.']]],
  [27.0, [['mara', 'First restriction in sixty metres. Keep your lights low.']]],
  [41.5, [['mara', 'Joel, hold up. There is something in the water.']]],
  [49.0, [['mara', 'It is coming straight at the light. Turn it off. Joel, turn it off!']]]
];

export class Cinematic {
  constructor({ scene, camera, world, creature, voice, bubbles, onDone }) {
    Object.assign(this, { scene, camera, world, creature, voice, bubbles, onDone }); this.t = 0; this.active = false; this.fired = new Set(); this.fade = 0;
    const g = new THREE.Group(); this.body = createDiverBody({ head: true }); g.add(this.body); this.group = g;
    this.arms = [createArm(true), createArm(false)]; this.arms[0].shoulder.position.set(0.23, -0.17, 0); this.arms[1].shoulder.position.set(-0.23, -0.17, 0); this.arms.forEach(a => this.body.add(a.shoulder));
    this.light = createFlashlight(); this.arms[0].hand.add(this.light); this.light.position.set(0, 0, -0.05);
    this.spot = new THREE.SpotLight(0xfff0d8, 260, 40, 0.42, 0.5, 1.6); this.spot.position.set(0, 0, -0.16); this.spot.target.position.set(0, 0, -6); this.light.add(this.spot, this.spot.target);
    const P = world.cave.paths[0]; this.path = P.slice(P.findIndex(p => p[2] < -50), P.findIndex(p => p[2] < -80)).map(p => new THREE.Vector3(p[0], p[1], p[2]));
    this.ai = { pos: [0, 0, 0], yaw: 0, pitch: 0, speed: 0, state: 'idle', squeezing: false, t: 0, mouthOpen: 0 };
    this.tank = this.body.userData.tank; this.swimBlend = 0; this.legPhase = 0; this.gone = false;
  }
  start() {
    this.active = true; this.t = 0; this.scene.add(this.group); this.group.visible = true; this.creature.group.visible = false; this.tank.visible = true; this.gone = false; this.fired.clear();
    if (this.tank.parent !== this.body) { this.body.add(this.tank); this.tank.position.set(0, -0.55, 0.3); this.tank.rotation.set(0, 0, 0); }
  }
  finish() { if (!this.active) return; this.active = false; this.voice.stop(); this.group.visible = false; this.scene.remove(this.group); this.creature.group.visible = true; this.camera.rotation.set(0, 0, 0); this.onDone?.(); }
  arm(i, sx, sy, ex, wx = -0.2) { const a = this.arms[i]; a.shoulder.rotation.set(sx, sy, 0); a.elbow.rotation.x = ex; a.wrist.rotation.x = wx; a.fingers.forEach((f, k) => { f.rotation.x = 0.8; }); }
  placeActor(head, yaw, pitchBody, swim) {                         // head = world position of the head; swim blends the body from upright to streamlined
    this.swimBlend += (swim - this.swimBlend) * 0.12; const th = lerp(0, pitchBody - Math.PI / 2, this.swimBlend);
    this.body.position.copy(head); this.body.rotation.set(th, yaw, 0, 'YXZ');
  }
  update(dt) {
    if (!this.active) return; this.t += dt; const t = this.t, C = this.camera, A = this.ai;
    for (const [at, lines] of LINES) if (t >= at && !this.fired.has(at)) { this.fired.add(at); this.voice.play(lines); }
    const head = new THREE.Vector3(), look = new THREE.Vector3(); let yaw = 0, pitch = 0, swim = 0, shake = 0;
    if (t < 9) {                                                    // A: preparation at the canopy
      head.set(-9.6, 1.68, -10.9); yaw = 0.4 + Math.sin(t * 0.5) * 0.05; const k = ease(t / 9);
      this.arm(0, 0.9 + Math.sin(t * 2) * 0.12, 0.2, 1.2); this.arm(1, 1.0, -0.2, 1.3 + Math.sin(t * 1.3) * 0.2);
      C.position.set(lerp(-3.5, -6.8, k), lerp(1.5, 1.9, k), lerp(-6.5, -7.8, k)); look.set(-9.6, 1.35, -10.9);
    } else if (t < 19) {                                            // B: walk to the dock under the floodlights
      const k = ease((t - 9) / 10), x = lerp(-9.6, 0, k), z = lerp(-10.9, -27.5, k); head.set(x, 1.68, z); yaw = Math.atan2(-(0 - -9.6), -(-27.5 - -10.9)) * (1 - 0) ;
      this.legPhase += dt * 5.2; this.arm(0, 0.3 + Math.sin(this.legPhase) * 0.25, 0.1, 0.5); this.arm(1, 0.3 - Math.sin(this.legPhase) * 0.25, -0.1, 0.5);
      C.position.set(x + 3.2, 1.7, z + 5.2); look.set(x, 1.3, z);
    } else if (t < 27) {                                            // C: down the dock, into the water
      const k = (t - 19) / 8, z = lerp(-27.5, -35, clamp(k * 1.4)), dive = clamp((k - 0.55) / 0.45); yaw = 0;
      head.set(0, lerp(1.68, WATER_LEVEL - 0.15, ease(dive)), z); swim = dive > 0.2 ? 1 : 0; pitch = -0.25 * dive;
      this.legPhase += dt * (dive > 0 ? 6 : 5.2); if (swim) { this.arm(0, 2.8, 0.1, 0.3); this.arm(1, 2.8, -0.1, 0.3); } else { this.arm(0, 0.3 + Math.sin(this.legPhase) * 0.25, 0.1, 0.5); this.arm(1, 0.3 - Math.sin(this.legPhase) * 0.25, -0.1, 0.5); }
      if (dive > 0 && !this.fired.has('splash')) { this.fired.add('splash'); this.bubbles?.burst({ position: head, getWorldDirection: v => v.set(0, 0, -1) }, 50); }
      C.position.set(lerp(3.5, 2.2, k), lerp(1.8, -0.2, ease(dive)), z + 4.5); look.set(0, lerp(1.3, WATER_LEVEL - 0.3, dive), z);
    } else {                                                        // D-F: swim into the cave, then the encounter
      swim = 1; const k = (t - 27) / 15, idx = Math.min(this.path.length - 2, Math.floor(clamp(k) * (this.path.length - 2))), p0 = this.path[idx], p1 = this.path[idx + 1];
      const tan = p1.clone().sub(p0).normalize(); head.copy(p0); yaw = Math.atan2(-tan.x, -tan.z); pitch = Math.asin(tan.y);
      this.legPhase += dt * 6; this.arm(0, 2.8, 0.1, 0.3); this.arm(1, 2.8, -0.1, 0.3);
      let back = 2.4; const cam = new THREE.Vector3(); for (; back > 0.6; back -= 0.3) { cam.copy(head).addScaledVector(tan, -back); cam.y += 0.45; if (this.world.cave.sdf(cam.x, cam.y, cam.z) > 0.25) break; }
      C.position.copy(cam); look.copy(head).addScaledVector(tan, 1.0);
      if (t >= 42) {                                                // the encounter: it drifts into the light, then lunges
        const m = this.path[this.path.length - 1]; swim = 1; head.copy(this.path[Math.min(this.path.length - 1, this.path.length - 1)]); this.arm(0, 2.2, 0.3, 0.8); this.arm(1, 2.3, -0.3, 0.8);
        const dirF = new THREE.Vector3(Math.sin(-yaw) * -1, 0, 0); const fw = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        this.creature.group.visible = true; const e = t - 42;
        const dist = e < 6 ? lerp(11, 6.5, e / 6) : e < 7.2 ? lerp(6.5, 0.9, ease((e - 6) / 1.2)) : 0.9;
        A.pos = [head.x + fw.x * dist + 0.7, head.y + 0.1, head.z + fw.z * dist]; A.yaw = yaw + Math.PI; A.pitch = 0; A.speed = e < 6 ? 0.9 : 3.2; A.t = Math.max(0, e - 6.2); A.state = e < 6 ? 'stalk' : 'attack'; A.mouthOpen = e > 6.8 ? 1 : 0;
        this.creature.update(dt, A);
        C.position.copy(head).addScaledVector(fw, -1.6); C.position.y += 0.35; C.position.x += 0.5; look.copy(head).addScaledVector(fw, 4.5);
        if (e > 6.6 && !this.gone) { this.gone = true; this.body.remove(this.tank); this.creature.handHold.add(this.tank); this.tank.position.set(0, 0, 0); this.tank.rotation.set(Math.PI / 2, 0, 0); this.bubbles?.burst({ position: head, getWorldDirection: v => v.set(0, 0, -1) }, 80); }
        if (e > 6.6) shake = Math.max(0, 1 - (e - 6.6) / 2.4);
        if (e > 6.6) this.arm(0, 1.4 + Math.sin(t * 25) * 0.4, 0.6, 1.4);
        if (e > 6.6) pitch += Math.sin(t * 18) * 0.3;
      } else this.creature.group.visible = false;
    }
    this.placeActor(head, yaw, pitch, swim); this.spot.visible = true;
    C.lookAt(look); if (shake > 0) { C.rotation.z += (Math.random() - 0.5) * 0.08 * shake; C.position.x += (Math.random() - 0.5) * 0.05 * shake; }
    const legs = this.body.userData.legs; legs.forEach((l, i) => { l.rotation.x = Math.sin(this.legPhase + i * Math.PI) * (swim ? 0.4 : 0.35); });
    this.fade = t < 1 ? 1 - t : t > 55.5 ? clamp((t - 55.5) / 1.5) : 0;
    if (t >= 57.2) this.finish();
  }
}
