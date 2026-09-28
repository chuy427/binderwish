// Backup files: owned checklist + print sheet + settings, as JSON. Saved data
// otherwise lives only in this browser's localStorage.

const APP = 'binderwish';
const VERSION = 1;

export function makeBackup({ owned, queue, options }) {
  return {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    owned: [...owned],
    queue,
    options,
  };
}

export function downloadBackup(state) {
  const blob = new Blob([JSON.stringify(makeBackup(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `binderwish-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length < 500;

// Parses and validates a backup file; throws a user-readable Error if it isn't one.
// Only known option keys (with the default's type) are kept, and print-sheet
// items must look like slots.
export function parseBackup(text, defaultOptions) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file isn’t a BinderWish backup (not valid JSON).'); }
  if (!data || data.app !== APP) throw new Error('That file isn’t a BinderWish backup.');
  if (data.version > VERSION) throw new Error('This backup is from a newer version of BinderWish — reload the page and try again.');

  const owned = Array.isArray(data.owned) ? data.owned.filter(isStr) : [];
  const queue = (Array.isArray(data.queue) ? data.queue : [])
    .filter((c) => c && typeof c === 'object' && isStr(c.key) && isStr(c.name))
    .map((c) => ({
      ...c,
      qty: Math.max(1, Math.min(99, Math.round(Number(c.qty) || 1))),
      // Re-run any lookup that hadn't finished when the backup was made.
      status: c.needsLookup && !c.tcgplayerId ? 'pending' : 'ready',
    }));
  const options = {};
  for (const [k, def] of Object.entries(defaultOptions)) {
    if (k === 'qrLogo') continue;
    if (data.options && typeof data.options[k] === typeof def) options[k] = data.options[k];
  }
  // The QR logo must be a small embedded image (see lib/logo.js).
  const logo = data.options?.qrLogo;
  if (logo && typeof logo.src === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(logo.src) && logo.src.length < 400000) {
    options.qrLogo = { src: logo.src, aspect: Number(logo.aspect) > 0 ? Number(logo.aspect) : 1 };
  }
  return { owned, queue, options, exportedAt: data.exportedAt };
}

// Merge: union of owned cards; print-sheet items added (keeping the higher
// quantity for ones already there). Owned cards never stay on the print sheet.
export function mergeBackup(current, incoming) {
  const owned = new Set([...current.owned, ...incoming.owned]);
  const byKey = new Map(current.queue.map((c) => [c.key, c]));
  for (const c of incoming.queue) {
    const have = byKey.get(c.key);
    byKey.set(c.key, have ? { ...have, qty: Math.max(have.qty, c.qty) } : c);
  }
  return { owned, queue: [...byKey.values()].filter((c) => !owned.has(c.key)) };
}
