// Cave: a continuous, enclosed cave defined as a signed-distance field (SDF) and meshed with surface nets.
// The same SDF drives rendering, walking collision (now) and swimming/creature clearance (later stages).
// f(p) > 0 is open space, f(p) < 0 is rock. No THREE dependency, so it can be tested headlessly.

export const WATER_LEVEL = -0.9;          // one global water table: any open space above this is air
export const WATER_Y = WATER_LEVEL;

/* ---------- noise ---------- */
function h3(x, y, z) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
           l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}

/* ---------- layout: waypoints [x, y, z, radiusH, radiusV] (metres) ---------- */
// Radii are half-widths: 0.55 means a 1.1 m wide squeeze. Water level is -0.9.
const N = {
  A0: [0, -0.8, -45.5, 2.4, 2.9], A1: [0, -0.9, -52, 2.0, 2.3],
  // Initial passages: narrow, mostly flooded
  B1: [-3, -1.5, -58, 1.3, 1.0], B2: [-7, -1.9, -65, 1.1, 0.85], B3: [-6, -2.6, -73, 1.0, 0.8],
  B4: [-11, -2.2, -80, 0.9, 0.75], B5: [-16, -2.0, -86, 1.0, 0.8],
  // Underground shoreline: low hall, water on one side, dry ledge on the other
  C1: [-17, -1.8, -93, 1.8, 1.4], C2: [-21.5, 0.8, -97, 2.6, 1.2],
  // Abandoned camp: dry, low chamber
  D1: [-27, 1.3, -103, 3.0, 1.45], D2: [-32, -0.6, -109, 1.2, 1.1],
  // Tight restrictions: long descending run of squeezes
  E1: [-38, -3.0, -113, 0.8, 0.7], E2: [-45, -5.0, -118, 0.6, 0.55], E3: [-52, -6.5, -121, 0.58, 0.5],
  E4: [-58, -8.0, -127, 0.7, 0.6], E5: [-57, -10, -135, 0.55, 0.55], E6: [-50, -12, -139, 0.6, 0.52],
  E7: [-44, -13, -146, 0.55, 0.52], E8: [-41, -12.5, -153, 0.85, 0.7],
  // Air pocket chambers: small domes above the water table
  F0: [-40, -11, -158, 0.9, 0.8], F1: [-39, -5, -162, 0.9, 0.9], F2: [-39, 0.3, -164, 1.35, 1.3],
  // Black water: long flooded descent
  G1: [-33, -14, -168, 0.8, 0.7], G2: [-27, -18, -176, 0.7, 0.65], G3: [-20, -22, -184, 0.8, 0.7],
  G4: [-12, -24, -192, 0.7, 0.6], G5: [-5, -25, -200, 0.95, 0.8],
  // Alternate route from the initial passages (longer, deeper, still tight) joining Black Water
  X1: [4, -3.2, -77, 0.75, 0.7], X2: [10, -4.5, -87, 0.7, 0.6], X3: [8, -6, -99, 0.7, 0.6],
  X4: [-3, -9, -118, 0.65, 0.6], X5: [-12, -12, -140, 0.7, 0.62], X6: [-24, -14.5, -157, 0.75, 0.65],
  // Unmapped section: junction network with a loop and dead ends
  H1: [2, -24, -207, 1.0, 0.9], H2: [10, -22, -211, 0.7, 0.6], H3: [16, -19, -217, 0.6, 0.55],
  H4: [12, -17, -225, 0.8, 0.7], H5: [4, -17, -229, 0.7, 0.6], H6: [-3, -20, -219, 0.7, 0.65],
  H7: [24, -18, -213, 0.55, 0.5], H8: [14, -11, -232, 0.9, 0.8], H9: [14, 0.2, -237, 1.3, 1.2],
  // The Hollow: deepest chamber
  I1: [-2, -27, -237, 0.9, 0.8], I2: [-8, -30, -247, 1.2, 1.0], I3: [-10, -31, -259, 5.2, 3.2],
  I4: [-4, -33, -268, 1.0, 0.8], I5: [-14, -29, -252, 0.8, 0.7]
};
const CHAINS = [
  'A0 A1 B1 B2 B3 B4 B5 C1 C2 D1 D2 E1 E2 E3 E4 E5 E6 E7 E8 F0 G1 G2 G3 G4 G5 H1 I1 I2 I3 I4',
  'F0 F1 F2',                  // air pocket branch
  'B3 X1 X2 X3 X4 X5 X6 G2',   // alternate route
  'H1 H2 H3 H4 H5 H6 H1',      // loop
  'H3 H7', 'H4 H8 H9',         // dead end + second air pocket
  'H5 I1', 'I2 I5 H6',         // second link into the Hollow
  'C1 B5'
].map(s => s.split(' '));
export const LOCATIONS = [
  { id: 'entrance', name: 'Cave Entrance', node: 'A1' }, { id: 'initial', name: 'Initial Passages', node: 'B3' },
  { id: 'shoreline', name: 'Underground Shoreline', node: 'C2' }, { id: 'camp', name: 'Abandoned Camp', node: 'D1' },
  { id: 'restrictions', name: 'Tight Restrictions', node: 'E5' }, { id: 'airpocket', name: 'Air Pocket Chamber', node: 'F2' },
  { id: 'blackwater', name: 'Black Water', node: 'G3' }, { id: 'unmapped', name: 'Unmapped Section', node: 'H1' },
  { id: 'hollow', name: 'The Hollow', node: 'I3' }
].map(l => ({ ...l, pos: N[l.node].slice(0, 3) }));
export const NODES = N;

function crom(a, b, c, d, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }


/* ---------- procedurally grown side branches (deterministic): narrow winding passages, small chambers, a few air domes ---------- */
let BRANCHED = false;
function addBranches() {
  if (BRANCHED) return; BRANCHED = true;
  let seed = 20240611; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const occ = new Map(), key = (x, y, z) => `${Math.floor(x / 3)},${Math.floor(y / 3)},${Math.floor(z / 3)}`;
  const add = p => { const k = key(p[0], p[1], p[2]); if (!occ.has(k)) occ.set(k, []); occ.get(k).push(p); };
  const near = (q, r, skip) => { const cx = Math.floor(q[0] / 3), cy = Math.floor(q[1] / 3), cz = Math.floor(q[2] / 3);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const l = occ.get(`${cx + i},${cy + j},${cz + k}`); if (l) for (const p of l) if (!(skip && skip.includes(p)) && Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < r) return true; } return false; };
  for (const ch of CHAINS) for (let i = 0; i < ch.length - 1; i++) { const a = N[ch[i]], b = N[ch[i + 1]], n = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 1.5); for (let k = 0; k <= n; k++) add([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n]); }
  const sources = ['B2', 'B4', 'C1', 'D2', 'E8', 'F0', 'G2', 'G4', 'H1', 'H4', 'I2', 'X2', 'X4', 'X5', 'B5', 'G1'];
  let bi = 0;
  for (const src of sources) for (let rep = 0; rep < 1; rep++) {
    const s = N[src]; let heading = [Math.cos(R() * 6.28), 0, Math.sin(R() * 6.28)], p = [s[0], s[1], s[2]], own = [], ids = [src], rh = 0.8 + R() * 0.45, steps = 10 + Math.floor(R() * 12), made = 0;
    for (let i = 0; i < steps; i++) {
      let ok = false, q;
      for (let t = 0; t < 10 && !ok; t++) {
        const yaw = (R() - 0.5) * (t < 5 ? 0.9 : 2.2), pit = Math.max(-0.45, Math.min(0.45, (R() - 0.5) * 0.5 + (p[1] > -2 ? -0.1 : 0) + (p[1] < -30 ? 0.15 : 0)));
        const cy = Math.cos(yaw), sy = Math.sin(yaw), h = [heading[0] * cy - heading[2] * sy, 0, heading[0] * sy + heading[2] * cy], hl = Math.hypot(h[0], h[2]) || 1;
        const d = [h[0] / hl * Math.cos(pit), Math.sin(pit), h[2] / hl * Math.cos(pit)]; q = [p[0] + d[0] * 3.4, p[1] + d[1] * 3.4, p[2] + d[2] * 3.4];
        if (q[0] < -68 || q[0] > 36 || q[2] > -56 || q[2] < -282 || q[1] > 0.4 || q[1] < -34) continue;
        if (near(q, i < 3 ? 1.8 : 3.6, own.slice(-3))) continue;
        heading = [d[0], 0, d[2]]; ok = true;
      }
      if (!ok) break;
      rh = Math.max(0.75, Math.min(1.25, rh + (R() - 0.5) * 0.35)); const rv = Math.max(0.62, rh * (0.75 + R() * 0.2)), id = `g${bi}_${i}`;
      N[id] = [q[0], q[1], q[2], rh, rv]; ids.push(id); add(q); own.push(q); p = q; made++;
    }
    if (made < 4) { ids.slice(1).forEach(id => delete N[id]); continue; }
    const last = N[ids[ids.length - 1]], kind = R();
    if (kind < 0.35) { last[3] = 2.1 + R() * 0.8; last[4] = 1.4 + R() * 0.5; }                                    // a small chamber at the end
    else if (kind < 0.55 && last[1] < -2) { last[1] = 0.3; last[3] = 1.2; last[4] = 1.25; N[ids[ids.length - 2]][1] = (N[ids[ids.length - 2]][1] + 0.3) / 2; }   // an air dome
    CHAINS.push(ids); bi++;
  }
}

/* ---------- build ---------- */
// opts.outside(x,y,z): extra free-space field (the open air in front of the cliff)
// opts.plug: AABB of cells to evaluate around the cave mouth
export function buildCave(opts) {
  const t0 = Date.now(); addBranches();
  const SEG = [];                                        // [ax,ay,az,bx,by,bz,rh0,rh1,rv0,rv1]
  let pathLength = 0; const paths = [];
  for (const chain of CHAINS) {
    const P = chain.map(id => N[id]), pts = []; paths.push(pts);
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]) / 0.7));
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const t = k / n, q = [0, 1, 2, 3, 4].map(j => crom(p0[j], p1[j], p2[j], p3[j], t));
        const m = 0.9 + 0.2 * noise3(q[0] * 0.21, q[1] * 0.21, q[2] * 0.21), m2 = 0.9 + 0.2 * noise3(q[2] * 0.19 + 9, q[0] * 0.19, q[1] * 0.19);
        q[3] = Math.max(0.42, q[3] * m); q[4] = Math.max(0.42, q[4] * m2);
        pts.push([q[0], q[1], q[2], q[3], q[4]]);
        if (prev) { SEG.push([prev[0], prev[1], prev[2], q[0], q[1], q[2], prev[3], q[3], prev[4], q[4]]); pathLength += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); }
        prev = q;
      }
    }
  }
  const S = SEG.length, A = new Float32Array(S * 17);
  for (let s = 0; s < S; s++) {
    const g = SEG[s], ex = g[3] - g[0], ey = g[4] - g[1], ez = g[5] - g[2], L = Math.hypot(ex, ey, ez) || 1e-6;
    const dx = ex / L, dy = ey / L, dz = ez / L; let ux = -dx * dy, uy = 1 - dy * dy, uz = -dz * dy; const ul = Math.hypot(ux, uy, uz);
    let rv0 = g[8], rv1 = g[9], rh0 = g[6], rh1 = g[7];
    if (ul < 0.25) { ux = 1; uy = 0; uz = 0; rv0 = rh0 = (rh0 + rv0) / 2; rv1 = rh1 = (rh1 + rv1) / 2; } else { ux /= ul; uy /= ul; uz /= ul; }  // steep shaft: round
    A.set([g[0], g[1], g[2], ex, ey, ez, 1 / (L * L), dx, dy, dz, ux, uy, uz, rh0, rh1, rv0, rv1], s * 17);
  }
  // spatial hash of segments
  const B = 3, bk = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512), buckets = new Map();
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
  for (let s = 0; s < S; s++) {
    const o = s * 17, r = Math.max(A[o + 13], A[o + 14], A[o + 15], A[o + 16]) * 1.2 + 1.2;
    const x0 = Math.min(A[o], A[o] + A[o + 3]) - r, x1 = Math.max(A[o], A[o] + A[o + 3]) + r, y0 = Math.min(A[o + 1], A[o + 1] + A[o + 4]) - r,
      y1 = Math.max(A[o + 1], A[o + 1] + A[o + 4]) + r, z0 = Math.min(A[o + 2], A[o + 2] + A[o + 5]) - r, z1 = Math.max(A[o + 2], A[o + 2] + A[o + 5]) + r;
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x1); minY = Math.min(minY, y0); maxY = Math.max(maxY, y1); minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z1);
    for (let i = Math.floor(x0 / B); i <= Math.floor(x1 / B); i++) for (let j = Math.floor(y0 / B); j <= Math.floor(y1 / B); j++) for (let k = Math.floor(z0 / B); k <= Math.floor(z1 / B); k++) {
      const key = bk(i, j, k); let l = buckets.get(key); if (!l) buckets.set(key, l = []); l.push(s);
    }
  }
  const outside = opts.outside || (() => -1);
  let lastR = 0.5;
  function tubes(x, y, z) {
    const l = buckets.get(bk(Math.floor(x / B), Math.floor(y / B), Math.floor(z / B)));
    if (!l) { lastR = 0.5; return -1; }
    let acc = -1e9, accR = 0.5;
    for (let i = 0; i < l.length; i++) {
      const o = l[i] * 17, vx0 = x - A[o], vy0 = y - A[o + 1], vz0 = z - A[o + 2];
      let t = (vx0 * A[o + 3] + vy0 * A[o + 4] + vz0 * A[o + 5]) * A[o + 6]; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const vx = vx0 - A[o + 3] * t, vy = vy0 - A[o + 4] * t, vz = vz0 - A[o + 5] * t;
      const al = vx * A[o + 7] + vy * A[o + 8] + vz * A[o + 9], px = vx - al * A[o + 7], py = vy - al * A[o + 8], pz = vz - al * A[o + 9];
      const vyp = px * A[o + 10] + py * A[o + 11] + pz * A[o + 12], vh2 = Math.max(0, px * px + py * py + pz * pz - vyp * vyp) + al * al;
      const rh = A[o + 13] + (A[o + 14] - A[o + 13]) * t, rv = A[o + 15] + (A[o + 16] - A[o + 15]) * t;
      const f = (1 - Math.sqrt(vh2 / (rh * rh) + vyp * vyp / (rv * rv))) * Math.min(rh, rv);
      if (acc < -1e8) { acc = f; accR = Math.min(rh, rv); }
      else if (f > acc - 0.3) { const hh = Math.min(1, Math.max(0, 0.5 + 0.5 * (acc - f) / 0.3)); const m = f + (acc - f) * hh + 0.3 * hh * (1 - hh); if (f > acc) accR = Math.min(rh, rv); acc = m; }
    }
    lastR = accR; return acc;
  }
  function field(x, y, z) {
    let f = tubes(x, y, z);
    if (f > -1.2) {
      const amp = Math.min(0.3, 0.32 * lastR);
      const n = (noise3(x * 0.9, y * 0.9, z * 0.9) - 0.5) * 2 * 0.75 + (noise3(x * 2.7 + 5, y * 2.7, z * 2.7) - 0.5) * 2 * 0.25;
      f += amp * n + 0.05 * lastR * Math.sin(y * 6 + 3 * noise3(x * 0.3, y * 0.3, z * 0.3));
    }
    return Math.max(f, outside(x, y, z));
  }

  /* --- sparse corner grid (open addressing hash) --- */
  const H = 0.25, ox = Math.floor(minX / H) * H, oy = Math.floor(minY / H) * H, oz = Math.floor(minZ / H) * H;
  const dimY = Math.ceil((maxY - oy) / H) + 4, dimZ = Math.ceil((maxZ - oz) / H) + 4;
  if (dimY >= 512 || dimZ >= 2048) throw new Error('cave grid too large');
  const CAP = 1 << 23, keys = new Int32Array(CAP).fill(-1), vals = new Float32Array(CAP), list = [];
  const kk = (i, j, k) => (i * 512 + j) * 2048 + k;
  const slot = key => { let s = (Math.imul(key, 2654435761) >>> 10) & (CAP - 1); while (keys[s] !== -1 && keys[s] !== key) s = (s + 1) & (CAP - 1); return s; };
  const wp = (i, j, k) => [ox + i * H, oy + j * H, oz + k * H];
  function ensure(i, j, k) { const key = kk(i, j, k), s = slot(key); if (keys[s] === -1) { keys[s] = key; vals[s] = field(ox + i * H, oy + j * H, oz + k * H); list.push(key); } }
  function val(i, j, k) { const key = kk(i, j, k), s = slot(key); return keys[s] === key ? vals[s] : Math.max(-1, outside(ox + i * H, oy + j * H, oz + k * H)); }
  const mark = (x0, x1, y0, y1, z0, z1) => { for (let i = Math.floor((x0 - ox) / H); i <= Math.ceil((x1 - ox) / H); i++) for (let j = Math.floor((y0 - oy) / H); j <= Math.ceil((y1 - oy) / H); j++) for (let k = Math.floor((z0 - oz) / H); k <= Math.ceil((z1 - oz) / H); k++) ensure(i, j, k); };
  for (let s = 0; s < S; s++) {
    const o = s * 17, r = Math.max(A[o + 13], A[o + 14], A[o + 15], A[o + 16]) * 1.25 + 0.8;
    mark(Math.min(A[o], A[o] + A[o + 3]) - r, Math.max(A[o], A[o] + A[o + 3]) + r, Math.min(A[o + 1], A[o + 1] + A[o + 4]) - r, Math.max(A[o + 1], A[o + 1] + A[o + 4]) + r, Math.min(A[o + 2], A[o + 2] + A[o + 5]) - r, Math.max(A[o + 2], A[o + 2] + A[o + 5]) + r);
  }
  if (opts.plug) { const p = opts.plug; mark(p.minX, p.maxX, p.minY, p.maxY, p.minZ, p.maxZ); }

  /* --- surface nets --- */
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const verts = [], cellVert = new Map(), cv = new Float32Array(8);
  for (const key of list) {
    const k = key % 2048, j = ((key - k) / 2048) % 512, i = ((key - k) / 2048 - j) / 512;
    let mask = 0; for (let c = 0; c < 8; c++) { cv[c] = val(i + C[c][0], j + C[c][1], k + C[c][2]); if (cv[c] > 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) { if ((cv[a] > 0) === (cv[b] > 0)) continue; const t = cv[a] / (cv[a] - cv[b]); sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; cnt++; }
    cellVert.set(key, verts.length / 3); verts.push(ox + (i + sx / cnt) * H, oy + (j + sy / cnt) * H, oz + (k + sz / cnt) * H);
  }
  const idx = [], cell = (i, j, k) => cellVert.get(kk(i, j, k));
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const key of list) {
    const k = key % 2048, j = ((key - k) / 2048) % 512, i = ((key - k) / 2048 - j) / 512, v0 = val(i, j, k);
    for (let a = 0; a < 3; a++) {
      const e = axes[a], v1 = val(i + e[0], j + e[1], k + e[2]); if ((v0 > 0) === (v1 > 0)) continue;
      let q;
      if (a === 0) q = [cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k)];
      else if (a === 1) q = [cell(i - 1, j, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i - 1, j, k)];
      else q = [cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k)];
      if (q.some(v => v === undefined)) continue;
      const [p0, p1, p2] = [q[0], q[1], q[2]].map(v => [verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2]]);
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], w = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const want = v0 > 0 ? -1 : 1, flip = (n[0] * e[0] + n[1] * e[1] + n[2] * e[2]) * want < 0;
      if (flip) idx.push(q[0], q[3], q[2], q[0], q[2], q[1]); else idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    }
  }

  /* --- queries --- */
  const sdf = (x, y, z) => field(x, y, z);
  const inside = (x, y, z) => field(x, y, z) > 0;
  function floorBelow(x, y, z, maxDrop = 6) {            // y of the first rock surface below (x,y,z); null if started in rock or none found
    if (field(x, y, z) <= 0) return null;
    let prev = y;
    for (let d = 0.05; d <= maxDrop; d += 0.05) { const yy = y - d; if (field(x, yy, z) <= 0) { let lo = yy, hi = prev; for (let r = 0; r < 6; r++) { const m = (lo + hi) / 2; if (field(x, m, z) <= 0) lo = m; else hi = m; } return hi; } prev = yy; }
    return null;
  }
  // stats: open volume and projected floor area of the cave (excluding the plug/outside region)
  let openCorners = 0; const cols = new Set();
  for (const key of list) { const k = key % 2048, j = ((key - k) / 2048) % 512, i = ((key - k) / 2048 - j) / 512; const [x, y, z] = wp(i, j, k); if (z < (opts.stopZ ?? -47) && vals[slot(key)] > 0) { openCorners++; cols.add(i * 4096 + k); } }
  return {
    positions: new Float32Array(verts), indices: new Uint32Array(idx), paths, sdf, inside, floorBelow, wp, nodes: N,
    stats: { segments: S, pathLength, openVolume: openCorners * H ** 3, footprintArea: cols.size * H * H, vertices: verts.length / 3, triangles: idx.length / 3, buildMs: Date.now() - t0, corners: list.length }
  };
}
