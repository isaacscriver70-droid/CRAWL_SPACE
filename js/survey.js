// Cave survey: remembers which parts of the cave the player has been near and draws only those on the map.
const CELL = 5;
export class Survey {
  constructor(cave, savedCells = []) { this.cave = cave; this.cells = new Set(savedCells); this.dirty = false; }
  key(x, y, z) { return `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`; }
  record(x, y, z) {
    if (z > -46) return; const i = Math.floor(x / CELL), j = Math.floor(y / CELL), k = Math.floor(z / CELL);
    if (this.cells.has(`${i},${j},${k}`)) return;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) this.cells.add(`${i + a},${j + b},${k + c}`);
    this.dirty = true;
  }
  export() { return [...this.cells]; }
  draw(canvas, player, locations, discovered) {
    const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height; g.fillStyle = '#04090c'; g.fillRect(0, 0, W, H);
    const x0 = -75, x1 = 40, z0 = -290, z1 = -35, s = Math.min(W / (x1 - x0), H / (z1 - z0)), X = x => (x - x0) * s, Z = z => (z - z0) * s;
    g.strokeStyle = '#0d2a33'; g.lineWidth = 1; for (let x = -70; x <= 40; x += 10) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); }
    for (const path of this.cave.paths) for (const p of path) {
      if (!this.cells.has(this.key(p[0], p[1], p[2]))) continue;
      const depth = Math.min(1, Math.max(0, (-p[1]) / 30)), r = Math.max(1.2, ((p[3] + p[4]) / 2) * s * 1.1);
      g.fillStyle = `rgb(${Math.round(120 - depth * 80)},${Math.round(190 - depth * 90)},${Math.round(200 - depth * 40)})`; g.beginPath(); g.arc(X(p[0]), Z(p[2]), r, 0, 6.283); g.fill();
    }
    g.font = '11px Georgia'; g.textBaseline = 'middle';
    for (const l of locations) if (discovered.includes(l.id)) { g.fillStyle = '#e6c46a'; g.beginPath(); g.arc(X(l.pos[0]), Z(l.pos[2]), 3, 0, 6.283); g.fill(); g.fillStyle = '#cfe6ea'; g.fillText(l.name, X(l.pos[0]) + 7, Z(l.pos[2])); }
    const px = X(player.x), pz = Z(Math.max(z0, player.z)); g.save(); g.translate(px, pz); g.rotate(-player.yaw); g.fillStyle = '#ff6a4a'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore();
    g.fillStyle = '#6fa3ad'; g.fillText('N', W - 14, 12);
  }
}
