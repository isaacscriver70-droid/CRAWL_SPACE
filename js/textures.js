// Procedural, tileable canvas textures shared by the world and the character models.
import * as THREE from 'three';
const hash2 = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
function pnoise(x, y, px, py) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const w = (i, p) => ((i % p) + p) % p;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(w(xi, px), w(yi, py)), b = hash2(w(xi + 1, px), w(yi, py));
  const c = hash2(w(xi, px), w(yi + 1, py)), d = hash2(w(xi + 1, px), w(yi + 1, py));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function makeTex({ base, v = 40, scale = 6, oct = 4, stretch = 1, size = 256, rep = [1, 1], paint = null, srgb = true }) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const im = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n = 0, a = 0.5, f = scale;
    for (let o = 0; o < oct; o++) {
      const py = Math.max(1, Math.round(f * stretch));
      n += a * pnoise(x / size * f, y / size * py, f, py); f *= 2; a *= 0.5;
    }
    const d = (n - 0.5) * v * 2, i = (y * size + x) * 4;
    im.data[i] = base[0] + d; im.data[i + 1] = base[1] + d; im.data[i + 2] = base[2] + d; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  if (paint) paint(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
