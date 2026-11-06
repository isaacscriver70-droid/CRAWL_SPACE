// Creature navigation and behaviour. Pure logic (no rendering) so it can run on a server later.
// The creature moves along a navigation graph built from the cave's centrelines, can squeeze through tight passages
// (slowly), senses light, sound, swimming disturbance and sight, and picks a target among several players.

const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
};
export const CREATURE_RADIUS = 0.3, SQUEEZE_BELOW = 0.62;

export class NavGraph {
  constructor(paths) {
    this.pos = []; this.rad = []; this.adj = []; const map = new Map(), q = 0.35;
    const id = p => { const k = `${Math.round(p[0] / q)},${Math.round(p[1] / q)},${Math.round(p[2] / q)}`; let i = map.get(k); if (i === undefined) { i = this.pos.length; map.set(k, i); this.pos.push([p[0], p[1], p[2]]); this.rad.push(Math.min(p[3], p[4])); this.adj.push([]); } else this.rad[i] = Math.min(this.rad[i], Math.min(p[3], p[4])); return i; };
    for (const path of paths) { let prev = -1; for (const p of path) { const i = id(p); if (prev >= 0 && prev !== i && !this.adj[prev].includes(i)) { this.adj[prev].push(i); this.adj[i].push(prev); } prev = i; } }
  }
  nearest(p) { let b = 0, bd = 1e9; for (let i = 0; i < this.pos.length; i++) { const d = V.dist(this.pos[i], p); if (d < bd) { bd = d; b = i; } } return b; }
  cost(a, b) { const d = V.dist(this.pos[a], this.pos[b]); return d * (Math.min(this.rad[a], this.rad[b]) < SQUEEZE_BELOW ? 2.2 : 1); }
  path(from, to, avoid = null) {                                      // A* with an optional set of nodes to penalise (blocked-route recovery)
    if (from === to) return [from];
    const g = new Map([[from, 0]]), prev = new Map(), open = [[V.dist(this.pos[from], this.pos[to]), from]], done = new Set();
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]); const [, n] = open.shift(); if (n === to) { const out = [n]; let c = n; while (prev.has(c)) { c = prev.get(c); out.push(c); } return out.reverse(); }
      if (done.has(n)) continue; done.add(n);
      for (const m of this.adj[n]) { const ng = g.get(n) + this.cost(n, m) + (avoid && avoid.has(m) ? 25 : 0); if (ng < (g.get(m) ?? 1e9)) { g.set(m, ng); prev.set(m, n); open.push([ng + V.dist(this.pos[m], this.pos[to]), m]); } }
    }
    return null;
  }
}

export class Creature {
  constructor(cave, graph, startNode, rand = Math.random) {
    this.cave = cave; this.graph = graph; this.rand = rand;
    this.node = startNode; this.pos = graph.pos[startNode].slice(); this.vel = [0, 0, 0]; this.yaw = 0; this.pitch = 0;
    this.state = 'patrol'; this.t = 0; this.path = null; this.pi = 0; this.speed = 0; this.squeezing = false;
    this.target = null; this.lastKnown = null; this.stalkTime = 0; this.cooldown = 0; this.attackDone = false; this.stuck = 0; this.lastPos = this.pos.slice(); this.avoid = new Set();
    this.events = []; this.seenByLight = false; this.noticed = null; this.mouthOpen = 0; this.dormantUntilZ = -80; this.repathT = 0; this.lightCount = 0;
  }
  los(a, b, min = 0.12) { const d = V.dist(a, b), n = Math.ceil(d / 0.5); for (let i = 1; i < n; i++) { const t = i / n; if (this.cave.sdf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t) < min) return false; } return true; }
  setPath(to) { const from = this.graph.nearest(this.pos); this.path = this.graph.path(from, to, this.avoid); this.pi = 0; this.node = to; return !!this.path; }
  go(state) { if (this.state !== state) { this.state = state; this.t = 0; } }
  randomFarNode(from, minD) { for (let i = 0; i < 30; i++) { const n = Math.floor(this.rand() * this.graph.pos.length); if (V.dist(this.graph.pos[n], from) > minD) return n; } return Math.floor(this.rand() * this.graph.pos.length); }

  // players: [{ id, pos, speed, noise, torchOn, torchDir, submerged, tankOn }]
  update(dt, players) {
    this.t += dt; this.events.length = 0; this.cooldown = Math.max(0, this.cooldown - dt); this.mouthOpen *= Math.exp(-3 * dt);
    const live = players.filter(p => p.submerged || p.pos[2] < -46);
    // --- senses and target choice ---
    let best = null, bestScore = -1, lit = false, heard = null, litArea = null;
    for (const p of live) {
      const d = V.dist(p.pos, this.pos), toC = V.norm(V.sub(this.pos, p.pos)); let score = 40 / (d + 4);
      const inBeam = p.torchOn && d < 28 && V.dot(toC, p.torchDir) > Math.cos(0.42) && this.los(p.pos, this.pos);
      if (inBeam) { lit = true; score += 6; this.lightCount++; }
      if (p.torchOn) {                                                // the area the beam actually illuminates
        let hit = p.pos.slice(); for (let s = 1; s <= 25; s++) { const q = [p.pos[0] + p.torchDir[0] * s, p.pos[1] + p.torchDir[1] * s, p.pos[2] + p.torchDir[2] * s]; if (this.cave.sdf(q[0], q[1], q[2]) < 0.1) break; hit = q; }
        if (V.dist(hit, this.pos) < 14 && this.los(this.pos, hit)) { litArea = hit; score += 3; }
      }
      if (p.noise > 0.15 && d < 6 + p.noise * 9) { heard = p.pos; score += p.noise; }
      if (d < 9 && this.los(p.pos, this.pos)) score += 4;                // close line of sight even without light
      if (score > bestScore) { bestScore = score; best = p; }
    }
    this.seenByLight = lit;
    const awake = live.some(p => p.pos[2] < this.dormantUntilZ);
    const player = best, dist = player ? V.dist(player.pos, this.pos) : 1e9;
    if (player) { this.lastKnown = player.pos.slice(); this.target = player; }

    // --- state machine ---
    switch (this.state) {
      case 'patrol': case 'investigate': case 'search': {
        if (this.state === 'patrol' && (!this.path || this.pi >= this.path.length)) {
          // once the player is deep enough the creature drifts toward their area (never straight at them), otherwise it roams
          const n = awake && player ? this.nodeNear(player.pos, 26, 48) : -1; this.setPath(n >= 0 ? n : this.randomFarNode(this.pos, 25));
        }
        if (this.state === 'patrol' && awake && player && this.t > 6 && V.dist(this.graph.pos[this.node], player.pos) > 45) { const n = this.nodeNear(player.pos, 26, 48); if (n >= 0) { this.setPath(n); this.t = 0; } }   // re-aim a far-off patrol toward the player's area
        if (awake && heard && this.cooldown <= 0) { this.setPath(this.graph.nearest(heard)); this.go('investigate'); }
        else if (awake && litArea && this.cooldown <= 0 && this.state !== 'investigate') { this.setPath(this.graph.nearest(litArea)); this.go('investigate'); }
        if (awake && player && dist < 22 && this.cooldown <= 0 && this.t > 3 && (lit || dist < 14)) { this.stalkTime = 0; this.go('stalk'); }
        if (this.state === 'investigate' && (!this.path || this.pi >= this.path.length)) this.go('search');
        if (this.state === 'search') { if (this.t > 14) { this.go('patrol'); this.path = null; } else if (!this.path || this.pi >= this.path.length) this.setPath(this.graph.nearest(this.lastKnown || this.pos)); }
        break;
      }
      case 'stalk': {
        this.stalkTime += dt;
        if (!player || dist > 45) { this.go('search'); break; }
        if (this.repathT <= 0 || !this.path) { this.repathT = 2; this.pickStalkNode(player); }
        const startled = lit && dist < 4.5 && this.stalkTime > 2;                               // lit up close -> it strikes
        const pressured = this.stalkTime > 35 && this.rand() < dt * 0.12;                  // after a while it works up the nerve
        if (this.cooldown <= 0 && (startled || pressured || (player.noise > 1.8 && dist < 9))) { this.go('hunt'); this.setPath(this.graph.nearest(player.pos)); }
        else if (this.stalkTime > 80) { this.go('retreat'); this.setPath(this.randomFarNode(this.pos, 30)); this.cooldown = 25; }   // or loses interest, for now
        break;
      }
      case 'hunt': {
        if (!player || (!this.los(player.pos, this.pos) && dist > 20 && this.t > 8)) { this.go('search'); break; }
        if (this.repathT <= 0) { this.repathT = 0.8; this.setPath(this.graph.nearest(player.pos)); }
        if (dist < 1.9 && this.los(player.pos, this.pos) && player.tankOn && !this.attackDone) { this.go('attack'); this.grabbed = false; }
        else if (dist < 1.9 && !player.tankOn) { this.go('retreat'); this.setPath(this.randomFarNode(this.pos, 35)); this.cooldown = 60; }
        if (this.t > 30) { this.go('retreat'); this.setPath(this.randomFarNode(this.pos, 35)); this.cooldown = 25; }   // never a permanent chase
        break;
      }
      case 'attack': {
        if (this.t > 0.55 && !this.grabbed) { this.grabbed = true; this.mouthOpen = 1; this.events.push({ type: 'tankGrab', pos: this.pos.slice(), target: player ? player.id : null }); this.attackDone = true; }
        if (this.t > 1.6) { this.go('retreat'); this.setPath(this.randomFarNode(this.pos, 40)); this.cooldown = 70; }
        break;
      }
      case 'retreat': {
        if ((!this.path || this.pi >= this.path.length) && this.t > 4) this.go('patrol');
        if (this.t > 22) this.go('patrol');
        break;
      }
    }
    if (this.repathT > 0) this.repathT -= dt;

    // --- movement ---
    const speeds = { patrol: 1.3, investigate: 1.9, search: 1.4, stalk: 1.6, hunt: 3.0, attack: 0.6, retreat: 3.4 };
    let sp = speeds[this.state] || 1;
    const nodeHere = this.graph.nearest(this.pos); this.squeezing = this.graph.rad[nodeHere] < SQUEEZE_BELOW; if (this.squeezing) sp *= 0.5;
    let goal = null;
    if ((this.state === 'hunt' || this.state === 'attack') && player && dist < 8 && this.los(player.pos, this.pos)) goal = player.pos;       // close in directly
    else if (this.path && this.pi < this.path.length) { goal = this.graph.pos[this.path[this.pi]]; if (V.dist(goal, this.pos) < 0.6) { this.pi++; goal = this.pi < this.path.length ? this.graph.pos[this.path[this.pi]] : null; } }
    if (this.state === 'attack') sp = player && dist > 0.9 ? 1.6 : 0.2;
    if (goal) this.moveToward(goal, sp, dt); else { this.vel[0] *= 0.9; this.vel[1] *= 0.9; this.vel[2] *= 0.9; }
    this.speed = V.len(this.vel);
    // --- blocked-route recovery ---
    this.stuck += (this.speed < 0.12 && goal && this.state !== 'attack') ? dt : -this.stuck;
    if (this.stuck > 3 && this.path) { for (let i = this.pi; i < Math.min(this.path.length, this.pi + 3); i++) this.avoid.add(this.path[i]); this.setPath(this.node); this.stuck = 0; if (!this.path) { this.go('patrol'); } }
    if (this.avoid.size > 40) this.avoid.clear();
  }

  nodeNear(p, min, max) { const g = this.graph; for (let i = 0; i < 40; i++) { const n = Math.floor(this.rand() * g.pos.length), d = V.dist(g.pos[n], p); if (d >= min && d <= max) return n; } return -1; }

  pickStalkNode(player) {                                            // a spot 9-17 m away, outside the player's beam, reachable by the graph
    const g = this.graph, here = g.nearest(this.pos); let best = -1, bs = 1e9;
    for (let i = 0; i < g.pos.length; i += 2) {
      const d = V.dist(g.pos[i], player.pos); if (d < 9 || d > 17) continue;
      const dirTo = V.norm(V.sub(g.pos[i], player.pos)), inBeam = player.torchOn && V.dot(dirTo, player.torchDir) > Math.cos(0.6);
      const sc = V.dist(g.pos[i], this.pos) + (inBeam ? 40 : 0) + Math.abs(d - 13) * 2 + (g.rad[i] < SQUEEZE_BELOW ? 8 : 0); if (sc < bs) { bs = sc; best = i; }
    }
    if (best >= 0) this.setPath(best);
  }

  moveToward(goal, speed, dt) {
    const d = V.sub(goal, this.pos), L = V.len(d) || 1, step = Math.min(speed * dt, L), dir = [d[0] / L, d[1] / L, d[2] / L];
    let nx = [this.pos[0] + dir[0] * step, this.pos[1] + dir[1] * step, this.pos[2] + dir[2] * step];
    if (this.cave.sdf(nx[0], nx[1], nx[2]) < CREATURE_RADIUS * 0.9) {                       // stay inside the cave: slide along walls, else follow the graph
      let ok = false; for (const ax of [[1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]]) { const c = [this.pos[0] + dir[0] * step * ax[0], this.pos[1] + dir[1] * step * ax[1], this.pos[2] + dir[2] * step * ax[2]]; if (this.cave.sdf(c[0], c[1], c[2]) >= CREATURE_RADIUS * 0.9) { nx = c; ok = true; break; } }
      if (!ok) nx = this.pos.slice();
    }
    const k = 1 - Math.exp(-6 * dt); for (let i = 0; i < 3; i++) this.vel[i] += ((nx[i] - this.pos[i]) / dt - this.vel[i]) * k;
    this.pos = nx; const h = Math.hypot(dir[0], dir[2]); if (h > 0.01) { const ty = Math.atan2(-dir[0], -dir[2]); let dy = ty - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * (1 - Math.exp(-5 * dt)); }
    this.pitch += (Math.asin(Math.max(-1, Math.min(1, dir[1]))) - this.pitch) * (1 - Math.exp(-4 * dt));
  }
  debug() { return { state: this.state, pos: this.pos.map(v => +v.toFixed(1)), speed: +this.speed.toFixed(2), squeezing: this.squeezing, pathLeft: this.path ? this.path.length - this.pi : 0, stuck: +this.stuck.toFixed(1), cooldown: +this.cooldown.toFixed(0) }; }
}
