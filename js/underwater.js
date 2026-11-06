// Dive state (air, depth, pressure) and the exhaled-bubble effect.
import * as THREE from 'three';
import { WATER_LEVEL } from './cave.js';

const TANK_SECONDS = 900;                  // 15 minutes of air at the surface with light effort

export class DiveState {
  constructor() { this.air = 100; this.breath = 100; this.depth = 0; this.pressure = 1.013; this.submerged = false; this.dead = false; this.warning = ''; }
  // eyeY: camera height; speed: swim speed (m/s). Depth comes from the actual position; pressure from depth.
  // With the tank on you breathe from it (denser air at depth is used faster). Without it you only have a held breath (about 40 s).
  update(dt, eyeY, speed, tankOn = true) {
    this.submerged = eyeY < WATER_LEVEL;
    this.depth = Math.max(0, WATER_LEVEL - eyeY);
    this.pressure = 1.013 + this.depth * 0.0981;                       // bar: 1 atm plus 0.0981 bar per metre of water
    if (this.dead) return;
    if (this.submerged) {
      if (tankOn) { this.air = Math.max(0, this.air - (100 / TANK_SECONDS) * (this.pressure / 1.013) * (1 + speed * 0.35) * dt); if (this.air <= 0) this.dead = true; }
      else { this.breath = Math.max(0, this.breath - (100 / 40) * (1 + speed * 0.2) * dt); if (this.breath <= 0) this.dead = true; }
    } else { if (tankOn) this.air = Math.min(100, this.air + 12 * dt); this.breath = Math.min(100, this.breath + 40 * dt); }   // breathing real air at the surface
    const left = tankOn ? this.air : this.breath;
    this.warning = this.dead ? '' : (!tankOn && this.submerged) ? 'NO TANK: HOLDING BREATH' : left < 15 ? 'CRITICAL AIR' : left < 30 ? 'LOW AIR' : this.depth > 30 ? 'EXTREME DEPTH' : '';
  }
}

export class Bubbles {
  constructor(scene, n = 90) {
    this.n = n; this.pos = new Float32Array(n * 3).fill(1e4); this.life = new Float32Array(n); this.timer = 2; this.next = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd8f1f5, size: 0.035, transparent: true, opacity: 0.65, depthWrite: false }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  burst(camera, n = 40) {
    const d = new THREE.Vector3(); camera.getWorldDirection(d);
    for (let i = 0; i < n; i++) { const j = this.next++ % this.n; this.life[j] = 3 + Math.random() * 2.5; this.pos[j * 3] = camera.position.x + d.x * 0.3 + (Math.random() - 0.5) * 0.5; this.pos[j * 3 + 1] = camera.position.y - 0.2 + Math.random() * 0.5; this.pos[j * 3 + 2] = camera.position.z + d.z * 0.3 + (Math.random() - 0.5) * 0.5; }
  }
  update(dt, camera, submerged) {
    this.timer -= dt;
    if (submerged && this.timer <= 0) {                                // one exhale about every 4.5 s
      this.timer = 4.5; this.onExhale?.(); const d = new THREE.Vector3(); camera.getWorldDirection(d);
      for (let i = 0; i < 12; i++) { const j = this.next++ % this.n; this.life[j] = 3 + Math.random() * 2; this.pos[j * 3] = camera.position.x + d.x * 0.3 + (Math.random() - 0.5) * 0.12; this.pos[j * 3 + 1] = camera.position.y - 0.12 + Math.random() * 0.1; this.pos[j * 3 + 2] = camera.position.z + d.z * 0.3 + (Math.random() - 0.5) * 0.12; }
    }
    for (let j = 0; j < this.n; j++) {
      if (this.life[j] <= 0) continue;
      this.life[j] -= dt; this.pos[j * 3 + 1] += (0.45 + (j % 5) * 0.06) * dt; this.pos[j * 3] += Math.sin(this.life[j] * 5 + j) * 0.12 * dt;
      if (this.life[j] <= 0 || this.pos[j * 3 + 1] > WATER_LEVEL) { this.life[j] = 0; this.pos[j * 3 + 1] = 1e4; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
