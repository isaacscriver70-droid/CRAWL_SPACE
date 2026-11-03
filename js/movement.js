// First-person movement controller: land (walk, sprint, crouch, jump) and swimming (see swimming.js).
import { getSettings } from './settings.js';
import { WATER_LEVEL } from './cave.js';
import { swimUpdate } from './swimming.js';

const RADIUS = 0.38, STAND_EYE = 1.68, CROUCH_EYE = 1.0, GRAVITY = 14, JUMP_V = 4.7;
const SPEED = { crouch: 1.7, walk: 3.4, sprint: 5.9 };

export class FirstPersonController {
  constructor(camera, canvas, world, onLockChange = () => {}) {
    this.camera = camera; this.canvas = canvas; this.world = world;
    this.pos = { x: world.spawn.x, y: world.groundHeight(world.spawn.x, world.spawn.z, 5), z: world.spawn.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = world.spawn.yaw; this.pitch = 0;
    this.eye = STAND_EYE; this.crouching = false; this.onGround = true; this.swimming = false; this.fly = false;
    this.keys = new Set(); this.bobT = 0; this.fovKick = 0; this.speed = 0; this.sprinting = false; this.locked = false;

    addEventListener('keydown', e => { if (!this.locked) return; this.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      const k = 0.0006 + getSettings().sensitivity / 100 * 0.0028;
      this.yaw -= e.movementX * k; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * k));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      onLockChange(this.locked);
    });
  }

  lock() { this.canvas.requestPointerLock?.(); }

  // Land collision. Applies whether grounded or airborne, so jumping cannot bypass walls, cliffs or water rules.
  blocked(nx, nz, fromX, fromZ) {
    const w = this.world, y = this.pos.y;
    if (nz > 60 || (nz > w.caveZ && Math.abs(nx) > w.bound)) return true;
    const g1 = w.groundHeight(nx, nz, y), g0 = w.groundHeight(fromX, fromZ, y);
    if (g1 < -50) return true;                                                                // no floor there (solid rock face)
    if (g1 > y + 0.6) return true;                                                            // cannot step or jump up more than 0.6 m
    const dist = Math.hypot(nx - fromX, nz - fromZ) || 1e-6;
    const ahead = w.groundHeight(fromX + (nx - fromX) / dist * 0.5, fromZ + (nz - fromZ) / dist * 0.5, y);
    const ahead2 = w.groundHeight(fromX + (nx - fromX) / dist * 1.0, fromZ + (nz - fromZ) / dist * 1.0, y);
    if (ahead - g0 > 0.45 && ahead2 - g0 > 0.9) return true;                                  // a slope too steep to climb (low ledges you can step onto are fine)
    if (nz < w.caveZ) {                                                                       // cave: clearance comes from the cave field itself
      for (const h of [0.85, 1.25, this.crouching ? 1.05 : 1.55]) if (w.cave.sdf(nx, y + h, nz) < RADIUS) return true;
      return false;
    }
    const top = y + (this.crouching ? 1.2 : 1.8);
    for (const c of w.colliders) {
      if (top < c.minY || y > c.maxY - 0.3) continue;
      if (nx > c.minX - RADIUS && nx < c.maxX + RADIUS && nz > c.minZ - RADIUS && nz < c.maxZ + RADIUS) return true;
    }
    return false;
  }

  // Developer free-fly (URL ?fly=1): ignores collision so the whole cave can be inspected.
  updateFly(dt, k) {
    const sp = k('sprint') ? 22 : 7, f = (k('forward') ? 1 : 0) - (k('backward') ? 1 : 0), s = (k('right') ? 1 : 0) - (k('left') ? 1 : 0), u = (k('jump') ? 1 : 0) - (k('crouch') ? 1 : 0);
    const cp = Math.cos(this.pitch), sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.pos.x += (-sin * cp * f + cos * s) * sp * dt; this.pos.z += (-cos * cp * f - sin * s) * sp * dt; this.pos.y += (Math.sin(this.pitch) * f + u) * sp * dt;
    this.vel.x = this.vel.y = this.vel.z = 0; this.onGround = false; this.crouching = false; this.sprinting = false; this.swimming = false; this.eye = 0;
    this.camera.position.set(this.pos.x, this.pos.y, this.pos.z); this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    const b = getSettings().bindings, k = a => this.keys.has(b[a]);
    if (this.fly) return this.updateFly(dt, k);
    const w = this.world, g = w.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (!this.swimming && this.pos.y <= WATER_LEVEL - 0.05 && g < WATER_LEVEL - 1.0) {       // deep water: start swimming
      this.swimming = true; this.pos.y += this.eye; this.eye = 0;                              // position becomes the diver's centre (camera height)
      this.vel.x *= 0.3; this.vel.z *= 0.3; this.vel.y = Math.min(this.vel.y, 0) * 0.3;
    } else if (this.swimming && g > -50 && WATER_LEVEL - g < 0.9) {                           // shallow enough to stand: wade out
      this.eye = Math.max(0.5, Math.min(STAND_EYE, this.pos.y - g)); this.pos.y = g; this.vel.y = 0; this.swimming = false; this.onGround = true;
    }
    if (this.swimming) swimUpdate(this, dt, k); else this.landUpdate(dt, k);
    this.cameraUpdate(dt);
  }

  landUpdate(dt, k) {
    const w = this.world;
    const lowCeiling = this.pos.z < w.caveZ && w.cave.sdf(this.pos.x, this.pos.y + 1.72, this.pos.z) < 0.12;
    this.crouching = (k('crouch') || lowCeiling) && this.onGround ? true : (this.crouching && !this.onGround);
    const f = (k('forward') ? 1 : 0) - (k('backward') ? 1 : 0), s = (k('right') ? 1 : 0) - (k('left') ? 1 : 0);
    this.sprinting = k('sprint') && f > 0 && !this.crouching && this.onGround;
    const target = this.crouching ? SPEED.crouch : this.sprinting ? SPEED.sprint : SPEED.walk;
    const len = Math.hypot(f, s) || 1, sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (-sin * f + cos * s) / len * (f || s ? target : 0), wz = (-cos * f - sin * s) / len * (f || s ? target : 0);
    const a = 1 - Math.exp(-(this.onGround ? 11 : 1.6) * dt);
    this.vel.x += (wx - this.vel.x) * a; this.vel.z += (wz - this.vel.z) * a;
    if (k('jump') && this.onGround && !this.crouching) { this.vel.y = JUMP_V; this.onGround = false; }
    this.vel.y -= GRAVITY * dt;

    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (!this.blocked(nx, this.pos.z, this.pos.x, this.pos.z)) this.pos.x = nx; else this.vel.x = 0;
    if (!this.blocked(this.pos.x, nz, this.pos.x, this.pos.z)) this.pos.z = nz; else this.vel.z = 0;

    let ground = w.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (ground < -50) ground = this.pos.y;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= ground) { this.pos.y = ground; this.vel.y = 0; this.onGround = true; }
    else if (this.onGround && this.pos.y - ground < 0.4 && this.vel.y <= 0) { this.pos.y = ground; this.vel.y = 0; }
    else this.onGround = false;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
  }

  cameraUpdate(dt) {
    const st = getSettings();
    const eyeTarget = this.swimming ? 0 : (this.crouching ? CROUCH_EYE : STAND_EYE);
    this.eye += (eyeTarget - this.eye) * (1 - Math.exp(-12 * dt));
    const sway = st.headBob && !st.reducedMotion && this.onGround && !this.swimming;
    this.bobT += dt * this.speed * (this.sprinting ? 1.9 : 2.3);
    const bobY = sway ? Math.sin(this.bobT * 2) * 0.03 * Math.min(1, this.speed / 3) * (this.sprinting ? 1.5 : 1) : 0;
    const bobX = sway ? Math.cos(this.bobT) * 0.02 * Math.min(1, this.speed / 3) : 0;
    this.fovKick += ((this.sprinting && !st.reducedMotion ? 6 : 0) - this.fovKick) * (1 - Math.exp(-6 * dt));
    const cam = this.camera;
    cam.position.set(this.pos.x + Math.cos(this.yaw) * bobX, this.pos.y + this.eye + bobY, this.pos.z - Math.sin(this.yaw) * bobX);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const fov = st.fov + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }
}
