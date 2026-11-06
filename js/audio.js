// Audio engine: loads recorded sound files from assets/audio (see assets/audio/README.md), plays them positionally with
// distance attenuation, applies the underwater muffling filter, and respects the per-category volumes in settings.
// No sound is synthesised: if a file is missing the engine stays silent for that sound and reports it once.
import { getSettings, onSettingsChange } from './settings.js';

// name -> { file(s), category, loop, vol }
export const SOUNDS = {
  regulator_in: { file: 'regulator_in.ogg', cat: 'effects', vol: 0.8 }, regulator_out: { file: 'regulator_out.ogg', cat: 'effects', vol: 0.8 },
  bubbles: { file: 'bubbles.ogg', cat: 'effects', vol: 0.7 }, swim_stroke: { file: 'swim_stroke.ogg', cat: 'effects', vol: 0.5 },
  footstep_rock: { file: ['footstep_rock_1.ogg', 'footstep_rock_2.ogg', 'footstep_rock_3.ogg'], cat: 'effects', vol: 0.6 }, footstep_wet: { file: ['footstep_wet_1.ogg', 'footstep_wet_2.ogg'], cat: 'effects', vol: 0.6 },
  footstep_dirt: { file: ['footstep_dirt_1.ogg', 'footstep_dirt_2.ogg'], cat: 'effects', vol: 0.6 }, gear: { file: 'gear_rustle.ogg', cat: 'effects', vol: 0.5 },
  splash_in: { file: 'splash_in.ogg', cat: 'effects', vol: 1 }, splash_out: { file: 'splash_out.ogg', cat: 'effects', vol: 0.9 },
  drip: { file: ['drip_1.ogg', 'drip_2.ogg', 'drip_3.ogg'], cat: 'ambient', vol: 0.7 }, creak: { file: ['rock_creak_1.ogg', 'rock_creak_2.ogg'], cat: 'ambient', vol: 0.8 },
  water_move: { file: 'water_move_loop.ogg', cat: 'effects', loop: true, vol: 0.5 },
  amb_underwater: { file: 'ambience_underwater_loop.ogg', cat: 'ambient', loop: true, vol: 0.8 }, amb_cave: { file: 'ambience_cave_loop.ogg', cat: 'ambient', loop: true, vol: 0.7 },
  amb_outside: { file: 'ambience_night_outside_loop.ogg', cat: 'ambient', loop: true, vol: 0.7 },
  creature_call: { file: ['creature_call_1.ogg', 'creature_call_2.ogg'], cat: 'creature', vol: 1 }, creature_click: { file: ['creature_click_1.ogg', 'creature_click_2.ogg'], cat: 'creature', vol: 0.8 },
  creature_growl: { file: 'creature_growl.ogg', cat: 'creature', vol: 1 }, creature_swim: { file: 'creature_swim_loop.ogg', cat: 'creature', loop: true, vol: 0.7 },
  tank_rip: { file: 'tank_rip.ogg', cat: 'effects', vol: 1 }, hose_snap: { file: 'hose_snap.ogg', cat: 'effects', vol: 0.9 }, recorder_click: { file: 'recorder_click.ogg', cat: 'effects', vol: 0.8 },
  music_tension: { file: 'music_tension_loop.ogg', cat: 'music', loop: true, vol: 0.6 }
};

export class AudioManager {
  constructor() { this.ctx = null; this.buffers = new Map(); this.missing = new Set(); this.loaded = 0; this.loops = new Map(); this.under = 0; }
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 22000; this.filter.connect(this.master); this.master.connect(c.destination);
    this.cats = {}; for (const k of ['music', 'ambient', 'effects', 'creature']) { this.cats[k] = c.createGain(); this.cats[k].connect(this.filter); }
    this.applySettings(); onSettingsChange(() => this.applySettings());
    for (const n of Object.keys(SOUNDS)) this.load(n);
  }
  applySettings() { if (!this.ctx) return; const s = getSettings(); this.master.gain.value = s.master / 100; for (const k in this.cats) this.cats[k].gain.value = (s[k] ?? 100) / 100; }
  async load(name) {
    const def = SOUNDS[name], files = [].concat(def.file), list = [];
    for (const f of files) {
      try { const r = await fetch(`assets/audio/${f}`); if (!r.ok) throw new Error(r.status); list.push(await this.ctx.decodeAudioData(await r.arrayBuffer())); this.loaded++; }
      catch { if (!this.missing.has(f)) { this.missing.add(f); } }
    }
    if (list.length) this.buffers.set(name, list);
  }
  status() { return { loaded: this.loaded, missing: [...this.missing] }; }
  // pos: [x,y,z] for positional sound (distance attenuation, HRTF); omit for non-positional
  play(name, { pos = null, vol = 1, rate = 1, loop = null } = {}) {
    const def = SOUNDS[name], list = this.buffers.get(name); if (!this.ctx || !list) return null;
    const src = this.ctx.createBufferSource(); src.buffer = list[Math.floor(Math.random() * list.length)]; src.loop = loop ?? !!def.loop; src.playbackRate.value = rate * (def.loop ? 1 : 0.96 + Math.random() * 0.08);
    const g = this.ctx.createGain(); g.gain.value = (def.vol ?? 1) * vol; let node = g;
    if (pos) { const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.maxDistance = 80; p.rolloffFactor = 1.4; if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; } else p.setPosition(pos[0], pos[1], pos[2]); g.connect(p); node = p; }
    src.connect(g); node.connect(this.cats[def.cat]); src.start(); return { src, gain: g, panner: pos ? node : null };
  }
  // keep a looping sound running at a target volume (0 stops it)
  loop(name, vol, pos = null) {
    let h = this.loops.get(name);
    if (vol <= 0.01) { if (h) { h.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); } return; }
    if (!h) { h = this.play(name, { vol: 0, pos }); if (!h) return; this.loops.set(name, h); }
    h.gain.gain.setTargetAtTime((SOUNDS[name].vol ?? 1) * vol, this.ctx.currentTime, 0.4);
    if (h.panner && pos) { if (h.panner.positionX) { h.panner.positionX.value = pos[0]; h.panner.positionY.value = pos[1]; h.panner.positionZ.value = pos[2]; } }
  }
  // call every frame: listener follows the camera, and the world sounds muffled underwater
  update(camera, submerged) {
    if (!this.ctx) return; const L = this.ctx.listener, p = camera.position, e = camera.matrixWorld.elements;
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = -e[8]; L.forwardY.value = -e[9]; L.forwardZ.value = -e[10]; L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6]; }
    this.filter.frequency.setTargetAtTime(submerged ? 650 : 22000, this.ctx.currentTime, 0.12);
  }
}
