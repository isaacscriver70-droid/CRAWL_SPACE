// Main menu logic.
import { getSettings, getSettingsError, onSettingsChange } from './settings.js';
import { loadProgress, newExpedition } from './save.js';
import { buildSettingsPanel, toast } from './ui.js';

const $ = (id) => document.getElementById(id);

function applyAccessibility() {
  const s = getSettings();
  document.body.classList.toggle('high-contrast', s.highContrast);
  document.body.classList.toggle('reduce-motion', s.reducedMotion);
}
applyAccessibility();
onSettingsChange(applyAccessibility);
if (getSettingsError()) toast('Saved settings could not be read; defaults loaded.', 'error');

const closeModals = () => document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
function openModal(id) { closeModals(); $(id).hidden = false; $(id).querySelector('.close').focus(); }
document.querySelectorAll('.modal .close').forEach(b => b.addEventListener('click', closeModals));
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

const progress = loadProgress();
if (!progress.ok) toast(`Save problem: ${progress.error}`, 'error');
if (progress.data) $('btn-continue').hidden = false;

$('btn-continue').addEventListener('click', () => { location.href = 'game.html'; });
$('btn-new').addEventListener('click', () => {
  if (progress.data && !confirm('Start a new expedition? Your saved progress will be overwritten.')) return;
  const r = newExpedition();
  if (!r.ok) { toast(`Could not create save: ${r.error}`, 'error'); return; }
  location.href = 'game.html';
});
$('btn-settings').addEventListener('click', () => { buildSettingsPanel($('settings-body')); openModal('modal-settings'); });
$('btn-credits').addEventListener('click', () => openModal('modal-credits'));
$('btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => toast('Fullscreen unavailable.', 'error'));
});
$('btn-quit').addEventListener('click', () => {
  window.close();
  setTimeout(() => toast("Browsers don't let pages quit themselves. Close the tab to exit."), 150);
});
