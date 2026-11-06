// Story content and physical story objects: three expedition recorders (voiced, with subtitles), the abandoned camp,
// survey station tags, evidence notes, and the four endings.
import * as THREE from 'three';
import { makeTex } from './textures.js';
import { getSettings, gainFor } from './settings.js';

export const SPEAKERS = {
  mara: { name: 'Dr. Mara Voss', pitch: 1.05, rate: 0.93, pref: 'female' },
  joel: { name: 'Joel Hart', pitch: 1.3, rate: 1.08, pref: 'male' },
  eli: { name: 'Eli Hargrove', pitch: 0.6, rate: 0.85, pref: 'male' }
};

export const RECORDERS = [
  { id: 'rec1', title: 'Recorder 1: Camp Two', where: 'camp', lines: [
    ['mara', 'Mara Voss, expedition log, day four. We have set camp two above the waterline. It is dry, barely.'],
    ['mara', 'Beyond the camp the passage floods and narrows. Eli measured the first restriction at fifty-five centimetres. We will go through one at a time.'],
    ['joel', 'The station tags keep moving. I placed S-4 myself and this morning it was two metres down the wall.'],
    ['mara', 'Joel, the water moves things.'],
    ['joel', 'The water does not peel tape off rock and put it back straight.'],
    ['mara', 'We go through at first light. Keep your lights low and your breathing slow.'] ] },
  { id: 'rec2', title: 'Recorder 2: The Squeeze', where: 'restriction', lines: [
    ['eli', 'Eli Hargrove. I am in the restriction past the second bend. I cannot turn. I am going to back out.'],
    ['eli', 'It is behind me. I felt the water move before I felt anything else. I am turning my light off.'],
    ['eli', 'It stopped. It is just there, close, in the dark, and it stopped when the light went out.'],
    ['eli', 'It does not hunt by sight. It follows the light and the noise. Stay still. Let it lose you.'],
    ['eli', 'If something takes your tank, do not fight it. Find the air. There is a dome past the long descent. Find the air.'] ] },
  { id: 'rec3', title: 'Recorder 3: The Hollow', where: 'hollow', lines: [
    ['joel', 'Joel Hart. I am the last one. Mara went back for Eli and the tags were all moved, every one, as if it wanted us to leave by another way.'],
    ['joel', 'I made it to the end. A big chamber, the only big one. The walls are covered in marks. Tallies, rows and rows of them, older than any survey date we have.'],
    ['joel', 'It is not a monster that wandered in. This is where it lives, and it has been counting everyone who came before us.'],
    ['joel', 'My light is almost gone. I am leaving this recorder where the next diver will see it. Get the others. Get out. Do not let it count you.'] ] }
];

export const NOTES = {
  camp: { title: 'Camp Two log board', text: 'CAMP 2. Water up twenty centimetres since Tuesday. Four divers, four tanks, one recorder each. Joel says the station tags are being moved. Check them every dive.  M.V.' },
  slate: { title: 'Dive slate', text: 'RESTRICTION AHEAD. 55 CM. ONE DIVER AT A TIME. IF IT FOLLOWS: LIGHT OFF, HOLD STILL.  E.H.' },
  marks: { title: 'Tally marks', text: 'Rows of tally marks cut into the stone, hundreds of them, weathered smooth. Far older than any expedition on record. Someone, or something, has been keeping count.' }
};

export const ENDINGS = {
  complete: { title: 'THE COMPLETE SURVEY', text: 'Every passage logged, every recorder recovered, and you are back in the open air. The survey of The Hollow is the most complete that anyone has made, and what it shows will not be believed by those who were not there.' },
  truth: { title: 'THE TRUTH', text: 'All three recordings together tell the story: the tags that moved, the light that was followed, the tallies in the dark. The previous expedition is not coming back. You know why, and you are the only one who does.' },
  hollow: { title: 'THE HOLLOW', text: 'You reached the deepest chamber and you swam back out. Whatever was counting in the dark has your number now.' },
  return: { title: 'THE RETURN', text: 'You surface with evidence and your own breath. It is not the whole truth, but it is enough to prove that the expedition went somewhere, and that something is down there.' }
};

export function chooseEnding(progress, nLocations) {
  const rec = progress.recordersFound.length, evidence = progress.evidence.length + rec;
  if (rec === 3 && progress.discoveredLocations.length >= nLocations) return 'complete';
  if (rec === 3) return 'truth';
  if (progress.discoveredLocations.includes('hollow')) return 'hollow';
  if (evidence >= 1) return 'return';
  return null;
}

/* ---------- subtitles + voiced playback ---------- */
export class VoicePlayer {
  constructor(el) { this.el = el; this.token = 0; this.voices = []; if ('speechSynthesis' in window) { const load = () => { this.voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); }; load(); speechSynthesis.addEventListener?.('voiceschanged', load); } }
  pick(sp) {
    const v = this.voices; if (!v.length) return null;
    const want = SPEAKERS[sp].pref, byGender = v.filter(x => (want === 'female' ? /female|zira|samantha|susan|hazel|karen|victoria/i : /male|david|daniel|alex|mark|fred|george|james/i).test(x.name) && !(want === 'male' && /female/i.test(x.name)));
    const list = byGender.length ? byGender : v; return list[Object.keys(SPEAKERS).indexOf(sp) % list.length];
  }
  stop() { this.token++; try { speechSynthesis.cancel(); } catch { /* none */ } this.el.hidden = true; }
  async play(lines, onDone) {
    const my = ++this.token, tts = 'speechSynthesis' in window;
    for (const [sp, text] of lines) {
      if (my !== this.token) return;
      const s = getSettings(); this.el.className = `subs ${s.subtitleSize}`; this.el.hidden = !s.subtitles; this.el.innerHTML = `<b>${SPEAKERS[sp].name}</b>${text}`;
      await new Promise(res => {
        let done = false; const fin = () => { if (!done) { done = true; res(); } }; setTimeout(fin, 1200 + text.length * 70 + 4000);     // safety timeout if speech never reports completion
        if (!tts) return setTimeout(fin, 800 + text.length * 60);
        const u = new SpeechSynthesisUtterance(text); const v = this.pick(sp); if (v) u.voice = v; u.pitch = SPEAKERS[sp].pitch; u.rate = SPEAKERS[sp].rate; u.volume = Math.min(1, gainFor('voice') * 1.2);
        u.onend = fin; u.onerror = () => setTimeout(fin, 500 + text.length * 55); speechSynthesis.speak(u);
      });
      await new Promise(r => setTimeout(r, 350));
    }
    if (my === this.token) { this.el.hidden = true; onDone?.(); }
  }
}

/* ---------- physical story objects ---------- */
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
function recorderMesh() {
  const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.17), mat(0xd9892b, { roughness: 0.5 })); g.add(body);
  for (const x of [-0.05, 0.05]) { const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), mat(0x222222)); reel.position.set(x, 0.056, 0); g.add(reel); }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 12, Math.PI), mat(0x222222)); handle.position.set(0, 0.05, 0.085); handle.rotation.z = 0; g.add(handle);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 2 })); led.position.set(0.09, 0.052, -0.06); g.add(led);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.15, 5), mat(0x111111)); ant.position.set(-0.1, 0.12, -0.05); ant.rotation.z = 0.2; g.add(ant);
  g.userData.led = led; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function labelTex(lines, w = 256, h = 128, bg = '#d8c9a0', fg = '#222') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = fg; x.font = 'bold 34px monospace'; lines.forEach((l, i) => x.fillText(l, 14, 46 + i * 44)); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildStory(scene, world) {
  const cave = world.cave, N = cave.nodes, items = [], recorders = {};
  const floorAt = (x, y, z) => cave.floorBelow(x, y, z, 5);
  const clearAbove = (x, y, z, h) => cave.sdf(x, y + h, z) > 0.15;
  // find dry standing spots around a node (floor above water, headroom)
  function drySpots(node, radius, count, spacing = 1.3) {
    const c = N[node], out = [];
    for (let r = 0.8; r <= radius; r += 0.4) for (let a = 0; a < 6.28; a += 0.5) {
      const x = c[0] + Math.cos(a) * r, z = c[2] + Math.sin(a) * r, y = floorAt(x, c[1] + 0.8, z);
      if (y === null || y < -0.6 || !clearAbove(x, y, z, 1.0) || cave.sdf(x, y + 0.5, z) < 0.45) continue;
      if (out.every(p => Math.hypot(p[0] - x, p[2] - z) > spacing)) out.push([x, y, z]); if (out.length >= count) return out;
    }
    return out;
  }
  // --- abandoned camp ---
  const spots = drySpots('D1', 3.2, 6), camp = new THREE.Group(); scene.add(camp);
  const tentTex = makeTex({ base: [150, 120, 70], v: 16, scale: 64, oct: 2, size: 128 });
  const place = (obj, s, ry = 0) => { obj.position.set(s[0], s[1], s[2]); obj.rotation.y = ry; obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); camp.add(obj); return obj; };
  if (spots[0]) { const t = new THREE.Group(), cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5, 8, 6), new THREE.MeshStandardMaterial({ map: tentTex, roughness: 1, side: THREE.DoubleSide }));
    const p = cloth.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.1 + 0.14 * Math.sin(p.getX(i) * 3) * Math.cos(p.getY(i) * 4)); cloth.geometry.computeVertexNormals(); cloth.rotation.x = -Math.PI / 2; cloth.position.y = 0.04; t.add(cloth);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.6, 6), mat(0x888888, { metalness: 0.6 })); pole.rotation.z = Math.PI / 2; pole.position.set(0, 0.07, 0.5); t.add(pole); place(t, spots[0], 0.5); }      // collapsed tent
  if (spots[1]) { const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.3, 4, 10), mat(0x3b4a3a)); roll.rotation.z = Math.PI / 2; roll.position.y = 0.2; const g = new THREE.Group(); g.add(roll); place(g, spots[1], 1.2); }   // bedroll
  if (spots[2]) { const g = new THREE.Group(), base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), mat(0x4a5a3a, { roughness: 0.5 })); base.position.y = 0.09; const lid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.4), mat(0x4a5a3a)); lid.position.set(0, 0.34, -0.2); lid.rotation.x = -1.2; g.add(base, lid); place(g, spots[2], 0.3); }   // open equipment case
  if (spots[3]) { const g = new THREE.Group(), lan = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 12), mat(0x333333, { metalness: 0.5 })); lan.position.y = 0.11; const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12), mat(0x3a4a50, { roughness: 0.1 })); glass.position.y = 0.2; g.add(lan, glass); place(g, spots[3]); }   // dead lantern
  let boardPos = null;
  if (spots[4]) { const g = new THREE.Group(), board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.38), mat(0x7a5a3a)); board.position.y = 0.05; const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.32), new THREE.MeshStandardMaterial({ map: labelTex(['CAMP 2', 'LOG', '', 'DAY 4']), roughness: 1 })); paper.rotation.x = -Math.PI / 2; paper.position.y = 0.075; g.add(board, paper); place(g, spots[4], 0.8); boardPos = [spots[4][0], spots[4][1] + 0.3, spots[4][2]]; }
  // --- recorders (physical, interactable) ---
  function floorSpot(node, dx = 0, dz = 0) { const c = N[node], y = floorAt(c[0] + dx, c[1] + 0.15, c[2] + dz); return [c[0] + dx, y ?? c[1] - 1, c[2] + dz]; }
  const recSpots = { camp: spots[5] || spots[2] || floorSpot('D1', 1, 1), restriction: floorSpot('E8', 0.2, 0), hollow: floorSpot('I3', 1.5, 0) };
  for (const r of RECORDERS) { const m = recorderMesh(), s = recSpots[r.where]; m.position.set(s[0], s[1] + 0.05, s[2]); m.rotation.y = r.where === 'hollow' ? 0.5 : 1.7; scene.add(m); recorders[r.id] = { mesh: m, pos: [s[0], s[1] + 0.2, s[2]] }; }
  // --- notes ---
  const marks = (() => { const c = N.I3; for (let a = 0; a < 6.28; a += 0.4) for (let d = 1; d < 6; d += 0.25) { const x = c[0] + Math.cos(a) * d, z = c[2] + Math.sin(a) * d; if (cave.sdf(x, c[1] + 0.2, z) < 0.05) { const n = [-Math.cos(a), 0, -Math.sin(a)]; return { p: [x + n[0] * 0.04, c[1] + 0.2, z + n[2] * 0.04], n }; } } return null; })();
  if (marks) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 256, 256); x.strokeStyle = 'rgba(25,20,16,.9)'; x.lineWidth = 3;
    for (let r = 0; r < 8; r++) for (let k = 0; k < 5; k++) { const bx = 12 + k * 22 + (r % 2) * 6, by = 14 + r * 29; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(bx + i * 4, by); x.lineTo(bx + i * 4 + 1, by + 22); x.stroke(); } x.beginPath(); x.moveTo(bx - 3, by + 5); x.lineTo(bx + 17, by + 17); x.stroke(); }
    const tex = new THREE.CanvasTexture(cv), pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    pl.position.set(...marks.p); pl.lookAt(marks.p[0] + marks.n[0], marks.p[1], marks.p[2] + marks.n[2]); scene.add(pl); }
  const slateAt = floorSpot('E1', 0, 0.8), slate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.28), mat(0x9a9a8a)); slate.position.set(slateAt[0], slateAt[1] + 0.012, slateAt[2]); slate.rotation.y = 0.4; scene.add(slate);
  const slateMat = new THREE.MeshStandardMaterial({ map: labelTex(['55 CM', 'ONE AT', 'A TIME']), roughness: 1 }), slateTop = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.26), slateMat); slateTop.rotation.x = -Math.PI / 2; slateTop.position.y = 0.007; slate.add(slateTop);
  // --- survey station tags on the cave walls (real station number and depth) ---
  const tagTargets = ['B2', 'B4', 'C1', 'D2', 'E1', 'E4', 'G2', 'H1'], tagTex = (i, d) => labelTex([`S-${i + 1}`, `${d.toFixed(0)} m`], 128, 96, '#e8761c', '#111');
  tagTargets.forEach((id, i) => {
    const c = N[id];
    for (let a = 0; a < 6.28; a += 0.5) for (let d = 0.3; d < 2.5; d += 0.1) {
      const x = c[0] + Math.cos(a) * d, z = c[2] + Math.sin(a) * d; if (cave.sdf(x, c[1], z) < 0.06) {
        const n = [-Math.cos(a), 0, -Math.sin(a)], m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshStandardMaterial({ map: tagTex(i, Math.max(0, -0.9 - c[1])), roughness: 0.6 }));
        m.position.set(x + n[0] * 0.03, c[1], z + n[2] * 0.03); m.lookAt(x + n[0], c[1], z + n[2]); scene.add(m); a = 99; break;
      }
    }
  });
  return { recorders, recSpots, boardPos, slatePos: [slateAt[0], slateAt[1] + 0.2, slateAt[2]], marksPos: marks ? [marks.p[0], marks.p[1], marks.p[2]] : null, campSpots: spots };
}
