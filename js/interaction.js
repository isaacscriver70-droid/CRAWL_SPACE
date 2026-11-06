// Interaction registry: objects the player can look at and use with the interact key.
import * as THREE from 'three';

export class Interactions {
  constructor() { this.items = []; this.current = null; this._d = new THREE.Vector3(); }
  add(item) { this.items.push(item); return item; }               // { pos:[x,y,z], radius, label():string|null, onUse() }
  update(camera) {
    camera.getWorldDirection(this._d); const p = camera.position; let best = null, bestScore = -1;
    for (const it of this.items) {
      if (it.removed) continue; const label = it.label(); if (!label) continue;
      const dx = it.pos[0] - p.x, dy = it.pos[1] - p.y, dz = it.pos[2] - p.z, dist = Math.hypot(dx, dy, dz);
      if (dist > it.radius) continue;
      const facing = (dx * this._d.x + dy * this._d.y + dz * this._d.z) / (dist || 1);
      if (facing < 0.6) continue;
      const score = facing - dist * 0.05; if (score > bestScore) { bestScore = score; best = it; }
    }
    this.current = best; return best ? best.label() : null;
  }
  use() { if (this.current) { this.current.onUse(); return true; } return false; }
}
