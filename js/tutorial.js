// Playable tutorial: each step watches the real game state, so it only completes when the player actually does the thing.
import { getSettings } from './settings.js';
import { keyName } from './ui.js';

export class Tutorial {
  constructor(el) {
    this.el = el; this.i = 0; this.flags = {}; this.acc = { look: 0, walk: 0, sprint: 0, crouch: 0 }; this.dirs = new Set(); this.last = null; this.done = false;
    const b = () => getSettings().bindings;
    this.steps = [
      { id: 'look', title: 'Look around', hint: () => 'Move the mouse to look in every direction.', test: () => this.acc.look > 3.5 },
      { id: 'walk', title: 'Walk', hint: () => `Walk about 8 metres with ${keyName(b().forward)} ${keyName(b().left)} ${keyName(b().backward)} ${keyName(b().right)}.`, test: () => this.acc.walk > 8 },
      { id: 'sprint', title: 'Sprint', hint: () => `Hold ${keyName(b().sprint)} while moving forward. Sprinting is much faster.`, test: () => this.acc.sprint > 1.5 },
      { id: 'crouch', title: 'Crouch', hint: () => `Hold ${keyName(b().crouch)} to crouch. You will need this in low caves.`, test: () => this.acc.crouch > 1 },
      { id: 'jump', title: 'Jump', hint: () => `Press ${keyName(b().jump)} to jump.`, test: () => this.flags.jump },
      { id: 'interact', title: 'Interact', hint: () => `Go to the prep table under the canopy and press ${keyName(b().interact)} to prepare your flashlight.`, test: () => this.flags.interact },
      { id: 'equip', title: 'Equipment', hint: () => `Open your equipment with ${keyName(b().inventory)} and look at your tank and regulator. Press it again to close.`, test: () => this.flags.equip },
      { id: 'light', title: 'Flashlight', hint: () => `Press ${keyName(b().flashlight)} to switch the flashlight off and on. The battery drains while it is on.`, test: () => (this.flags.light || 0) >= 2 },
      { id: 'water', title: 'Enter the water', hint: () => 'Follow the path to the dock and walk into the water until you start swimming.', test: p => p.swimming },
      { id: 'swim', title: 'Swim in every direction', hint: () => `Swim forward, backward, left, right, up (${keyName(b().swimUp)}) and down (${keyName(b().swimDown)}). Done: ${this.dirs.size}/6. You swim the way you look.`, test: () => this.dirs.size >= 6 },
      { id: 'depth', title: 'Depth and pressure', hint: () => 'Dive to at least 2 metres. Watch DEPTH and PRESSURE rise on the HUD and on your wrist.', test: (p, d) => d.depth >= 2 },
      { id: 'oxygen', title: 'Oxygen', hint: () => 'Your air drops while you are underwater, and faster the deeper you go. Stay under until the AIR gauge drops below 99%.', test: (p, d) => d.submerged && d.air < 99 },
      { id: 'air', title: 'Air pockets', hint: () => 'Swim into the cave mouth and surface inside the chamber. Air pockets are real spaces above the water: breathe there to recover.', test: (p, d) => p.swimming && !d.submerged && p.pos.z < -48 },
      { id: 'map', title: 'Navigation', hint: () => `Open the survey map with ${keyName(b().map)}. It only shows places you have been.`, test: () => this.flags.map }
    ];
    this.render();
  }
  notify(name) { if (name === 'light') this.flags.light = (this.flags.light || 0) + 1; else this.flags[name] = true; }
  update(dt, p, d, keys) {
    if (this.done) return; const b = getSettings().bindings;
    if (this.last) { this.acc.look += Math.abs(this.angDiff(p.yaw, this.last.yaw)) + Math.abs(p.pitch - this.last.pitch); if (p.onGround && !p.swimming) this.acc.walk += Math.hypot(p.pos.x - this.last.x, p.pos.z - this.last.z); }
    if (p.sprinting) this.acc.sprint += dt; if (p.crouching) this.acc.crouch += dt;
    if (keys.has(b.jump) && p.onGround && !p.swimming) this.flags.jump = true;
    if (p.swimming) { const m = { forward: 'forward', backward: 'backward', left: 'left', right: 'right', swimUp: 'up', swimDown: 'down' }; for (const k in m) if (keys.has(b[k])) this.dirs.add(m[k]); }
    this.last = { yaw: p.yaw, pitch: p.pitch, x: p.pos.x, z: p.pos.z };
    const s = this.steps[this.i]; if (s && s.test(p, d)) { this.i++; if (this.i >= this.steps.length) { this.done = true; } }
    this.render();
  }
  angDiff(a, b) { let d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); }
  render() {
    const s = this.steps[this.i];
    if (this.done) { this.el.innerHTML = '<b>Training complete</b><p>You know the controls. The real cave is far tighter and much darker.</p><a class="btn" href="game.html?intro=1">Start the expedition</a> <a class="btn" href="index.html">Main menu</a>'; return; }
    const key = `${this.i}|${s.hint()}`; if (key === this._k) return; this._k = key;
    this.el.innerHTML = `<small>Step ${this.i + 1} of ${this.steps.length}</small><b>${s.title}</b><p>${s.hint()}</p><a class="btn" href="game.html">Skip tutorial</a>`;
  }
}
