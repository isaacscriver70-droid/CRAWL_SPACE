// Swimming physics: full 3D movement with momentum, water resistance, neutral buoyancy, and collision against
// the cave field (inside) or the pool terrain (outside). Operates on the FirstPersonController state.
import { WATER_LEVEL } from './cave.js';

export const SWIM_RADIUS = 0.32;           // body clearance needed from rock
const HEAD_OUT = 0.25;                     // eye height above the water surface when floating at the top

function free(c, x, y, z) {
  const w = c.world;
  if (z < c.minZ) return false;
  if (z < w.caveZ) return w.cave.sdf(x, y, z) > SWIM_RADIUS;
  if (Math.abs(x) > w.bound || z > 60) return false;
  if (y - w.terrain(x, z) < 0.35) return false;                      // pool / shore floor
  for (const k of w.colliders) {                                      // slabs, posts, camp objects
    if (y > k.minY - SWIM_RADIUS && y < k.maxY + SWIM_RADIUS && x > k.minX - SWIM_RADIUS && x < k.maxX + SWIM_RADIUS && z > k.minZ - SWIM_RADIUS && z < k.maxZ + SWIM_RADIUS) return false;
  }
  return true;
}

// If the diver ends up inside rock (e.g. entering from a jump), push them out along the field gradient.
function unstick(c) {
  const w = c.world; if (c.pos.z >= w.caveZ || free(c, c.pos.x, c.pos.y, c.pos.z)) return;
  for (let i = 0; i < 40; i++) {
    const { x, y, z } = c.pos, e = 0.1, f0 = w.cave.sdf(x, y, z);
    const gx = w.cave.sdf(x + e, y, z) - f0, gy = w.cave.sdf(x, y + e, z) - f0, gz = w.cave.sdf(x, y, z + e) - f0, l = Math.hypot(gx, gy, gz) || 1;
    c.pos.x += gx / l * 0.06; c.pos.y += gy / l * 0.06; c.pos.z += gz / l * 0.06;
    if (free(c, c.pos.x, c.pos.y, c.pos.z)) return;
  }
}

export function swimUpdate(c, dt, k) {
  const sin = Math.sin(c.yaw), cos = Math.cos(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const f = (k('forward') ? 1 : 0) - (k('backward') ? 1 : 0), s = (k('right') ? 1 : 0) - (k('left') ? 1 : 0), u = (k('swimUp') ? 1 : 0) - (k('swimDown') ? 1 : 0);
  let wx = -sin * cp * f + cos * s, wy = sp * f + u, wz = -cos * cp * f - sin * s;
  const len = Math.hypot(wx, wy, wz), moving = len > 0.001, kick = k('sprint') ? 2.4 : 1.35;
  if (len > 1) { wx /= len; wy /= len; wz /= len; }
  const a = 1 - Math.exp(-(moving ? 2.4 : 1.6) * dt);                  // acceleration while kicking, water drag when coasting
  c.vel.x += (wx * kick - c.vel.x) * a; c.vel.y += (wy * kick - c.vel.y) * a; c.vel.z += (wz * kick - c.vel.z) * a;
  unstick(c);
  const p = c.pos, steps = 2;
  for (let i = 0; i < steps; i++) {                                    // axis-separated so the diver slides along walls
    const d = dt / steps;
    if (free(c, p.x + c.vel.x * d, p.y, p.z)) p.x += c.vel.x * d; else c.vel.x = 0;
    if (free(c, p.x, p.y + c.vel.y * d, p.z)) p.y += c.vel.y * d; else c.vel.y = 0;
    if (free(c, p.x, p.y, p.z + c.vel.z * d)) p.z += c.vel.z * d; else c.vel.z = 0;
  }
  const top = WATER_LEVEL + HEAD_OUT;                                  // you float at the surface; air pockets let you breathe there
  if (p.y > top) { p.y = top; if (c.vel.y > 0) c.vel.y = 0; }
  c.speed = Math.hypot(c.vel.x, c.vel.y, c.vel.z); c.onGround = false; c.crouching = false; c.sprinting = false;
}
