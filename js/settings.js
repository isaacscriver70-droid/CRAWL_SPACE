// Settings: single source of truth for persisted user settings. Used by every page.
const KEY = 'crawlspace.settings.v1';

export const DEFAULT_BINDINGS = {
  forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', crouch: 'ControlLeft', jump: 'Space',
  swimUp: 'Space', swimDown: 'KeyC', interact: 'KeyE',
  flashlight: 'KeyF', inventory: 'KeyI', map: 'KeyM', pause: 'Escape'
};

export const BINDING_LABELS = {
  forward: 'Move forward / swim forward', backward: 'Move backward / reverse',
  left: 'Move left', right: 'Move right', sprint: 'Sprint / swim harder',
  crouch: 'Crouch', jump: 'Jump', swimUp: 'Swim up', swimDown: 'Swim down',
  interact: 'Interact', flashlight: 'Flashlight', inventory: 'Equipment',
  map: 'Survey map', pause: 'Pause'
};

export const DEFAULTS = {
  master: 80, music: 60, ambient: 80, effects: 80, creature: 80, voice: 90,
  sensitivity: 50, fov: 75, graphics: 'medium', subtitles: true, subtitleSize: 'medium',
  reducedMotion: false, highContrast: false, headBob: true,
  bindings: { ...DEFAULT_BINDINGS }
};

let current = structuredClone(DEFAULTS);
let lastError = null;
const listeners = new Set();

function merge(saved) {
  const out = structuredClone(DEFAULTS);
  for (const k of Object.keys(DEFAULTS)) {
    if (k === 'bindings') continue;
    if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) out[k] = saved[k];
  }
  if (saved.bindings && typeof saved.bindings === 'object') {
    for (const a of Object.keys(DEFAULT_BINDINGS)) {
      if (typeof saved.bindings[a] === 'string') out.bindings[a] = saved.bindings[a];
    }
  }
  return out;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = merge(JSON.parse(raw));
    lastError = null;
  } catch (e) {
    lastError = e; // corrupted or storage blocked: fall back to defaults
    current = structuredClone(DEFAULTS);
  }
  return current;
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
    lastError = null;
    return true;
  } catch (e) {
    lastError = e;
    return false;
  }
}

export const getSettings = () => current;
export const getSettingsError = () => lastError;

export function setSetting(name, value) {
  if (name.startsWith('bindings.')) current.bindings[name.slice(9)] = value;
  else current[name] = value;
  const ok = saveSettings();
  listeners.forEach(fn => fn(current));
  return ok;
}

export function resetSettings() {
  current = structuredClone(DEFAULTS);
  const ok = saveSettings();
  listeners.forEach(fn => fn(current));
  return ok;
}

export function onSettingsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Effective gain for an audio category (0..1), combining master and category volume.
export function gainFor(category) {
  return (current.master / 100) * ((current[category] ?? 100) / 100);
}

loadSettings();
