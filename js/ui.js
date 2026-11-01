// Shared UI helpers: toasts and the settings panel (reused by the pause menu later).
import { getSettings, setSetting, resetSettings, DEFAULTS, BINDING_LABELS } from './settings.js';

export function toast(message, kind = 'info') {
  let host = document.getElementById('toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const n = document.createElement('div');
  n.className = `toast ${kind}`;
  n.textContent = message;
  host.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...children);
  return n;
}

function persist(name, value) {
  if (!setSetting(name, value)) toast('Could not save settings (storage unavailable).', 'error');
}

function slider(label, key, min, max, unit = '') {
  const out = el('output', {}, `${getSettings()[key]}${unit}`);
  const input = el('input', { type: 'range', min, max, step: 1, value: getSettings()[key], 'aria-label': label });
  input.addEventListener('input', () => { out.textContent = `${input.value}${unit}`; persist(key, Number(input.value)); });
  return el('label', { class: 'row' }, el('span', {}, label), input, out);
}

function select(label, key, options) {
  const input = el('select', { 'aria-label': label });
  for (const [v, t] of options) {
    const o = el('option', { value: v }, t);
    if (getSettings()[key] === v) o.selected = true;
    input.appendChild(o);
  }
  input.addEventListener('change', () => persist(key, input.value));
  return el('label', { class: 'row' }, el('span', {}, label), input);
}

function toggle(label, key) {
  const input = el('input', { type: 'checkbox', 'aria-label': label });
  input.checked = !!getSettings()[key];
  input.addEventListener('change', () => persist(key, input.checked));
  return el('label', { class: 'row' }, el('span', {}, label), input);
}

export const keyName = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R');

function bindingRow(action) {
  const btn = el('button', { class: 'keybtn', type: 'button' }, keyName(getSettings().bindings[action]));
  btn.addEventListener('click', () => {
    btn.textContent = 'press a key…';
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      window.removeEventListener('keydown', handler, true);
      const b = getSettings().bindings;
      if (e.code === 'Escape') { btn.textContent = keyName(b[action]); return; }
      const clash = Object.entries(b).find(([a, c]) => c === e.code && a !== action);
      const shared = clash && ['jump', 'swimUp'].includes(clash[0]) && ['jump', 'swimUp'].includes(action);
      if (clash && !shared) {
        toast(`${keyName(e.code)} is already used for "${BINDING_LABELS[clash[0]]}".`, 'error');
        btn.textContent = keyName(b[action]); return;
      }
      persist(`bindings.${action}`, e.code);
      btn.textContent = keyName(e.code);
    };
    window.addEventListener('keydown', handler, true);
  });
  return el('div', { class: 'row' }, el('span', {}, BINDING_LABELS[action]), btn);
}

export function buildSettingsPanel(container) {
  container.replaceChildren();
  const group = (title, ...rows) => el('fieldset', {}, el('legend', {}, title), ...rows);
  container.append(
    group('Audio',
      slider('Master volume', 'master', 0, 100, '%'), slider('Music', 'music', 0, 100, '%'),
      slider('Ambient', 'ambient', 0, 100, '%'), slider('Effects', 'effects', 0, 100, '%'),
      slider('Creature', 'creature', 0, 100, '%'), slider('Voice', 'voice', 0, 100, '%')),
    group('Controls', slider('Mouse sensitivity', 'sensitivity', 1, 100),
      ...Object.keys(DEFAULTS.bindings).map(bindingRow)),
    group('Graphics', select('Quality', 'graphics', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]),
      slider('Field of view', 'fov', 60, 110, '°')),
    group('Accessibility', toggle('Subtitles', 'subtitles'),
      select('Subtitle size', 'subtitleSize', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]),
      toggle('Reduce motion / camera sway', 'reducedMotion'), toggle('Head bob', 'headBob'),
      toggle('High contrast UI', 'highContrast'))
  );
  const reset = el('button', { type: 'button', class: 'secondary' }, 'Reset to defaults');
  reset.addEventListener('click', () => { resetSettings(); buildSettingsPanel(container); toast('Settings reset.'); });
  container.append(reset);
}
