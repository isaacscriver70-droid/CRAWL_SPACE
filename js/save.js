// Solo progress persistence (localStorage). Multiplayer persistence needs a server (see CHECKLIST.md).
const KEY = 'crawlspace.progress.v1';

export const EMPTY_PROGRESS = () => ({
  version: 1, startedAt: null, updatedAt: null,
  discoveredLocations: [], evidence: [], recordersFound: [],
  storyFlags: {}, endingsSeen: []
});

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ok: true, data: null };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return { ok: false, error: 'Unsupported save version', data: null };
    return { ok: true, data: { ...EMPTY_PROGRESS(), ...parsed } };
  } catch (e) {
    return { ok: false, error: e.message, data: null };
  }
}

export function saveProgress(progress) {
  try {
    progress.updatedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(progress));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function newExpedition() {
  const p = EMPTY_PROGRESS();
  p.startedAt = Date.now();
  return { ...saveProgress(p), data: p };
}

export function deleteProgress() {
  try { localStorage.removeItem(KEY); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}
