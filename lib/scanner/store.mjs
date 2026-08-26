/**
 * Browser-side persistence for the scanned task list.
 *
 * Tasks live in localStorage rather than a database: the conversation content
 * they were drawn from is personal, and this keeps it on the machine that ran
 * the scan. Only the transcripts sent for extraction leave the browser.
 */

const STORAGE_KEY = 'lpm.task-scanner.v1';

const EMPTY = { tasks: [], scannedAt: null, scannedCount: 0, model: null };

export function loadState() {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY,
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    // Corrupt or unreadable storage should not brick the page.
    return EMPTY;
  }
}

export function saveState(state) {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    // Quota is the realistic failure here — a very large scan.
    return { ok: false, error: err.message };
  }
}

export function clearState() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
