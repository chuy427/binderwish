// Fetch-with-cache for the card-data APIs and the bundled catalog: responses are
// kept in memory and in localStorage so repeat lookups don't hit the network again.

const CACHE_PREFIX = 'proxyscan.cache:';
export const HOUR = 60 * 60 * 1000;
export const TTL = {
  sets: 7 * 24 * HOUR,   // set list / pocket exclusions / a set's card list
  card: 24 * HOUR,       // card detail (includes price)
  search: 24 * HOUR,     // name search results
  catalogIndex: HOUR,    // bundled TCGPlayer catalog index (changes on each rebuild)
};

const memCache = new Map();
const inflight = new Map();

function cacheRead(url, ttl) {
  let entry = memCache.get(url);
  if (!entry) {
    try { entry = JSON.parse(localStorage.getItem(CACHE_PREFIX + url)); } catch {}
  }
  if (entry && Date.now() - entry.t < ttl) {
    memCache.set(url, entry);
    return entry.data;
  }
  return undefined;
}

// Cached responses in localStorage: [key, time saved], oldest first.
function cachedEntries() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(CACHE_PREFIX)) continue;
      let t = 0;
      try { t = JSON.parse(localStorage.getItem(k)).t || 0; } catch {}
      out.push([k, t]);
    }
  } catch { /* storage unavailable */ }
  return out.sort((a, b) => a[1] - b[1]);
}

// Frees room by dropping the oldest half of cached responses. Cached card data is
// only a speed-up, so it always gives way to the collection itself.
function evictCache() {
  const entries = cachedEntries();
  entries.slice(0, Math.max(1, Math.ceil(entries.length / 2))).forEach(([k]) => {
    try { localStorage.removeItem(k); } catch {}
  });
  return entries.length > 0;
}

// Saves something that matters (the collection, print sheet, settings…): when storage
// is full, cached card data is cleared to make room. Returns false only if it still
// couldn't be saved.
export function saveLocal(key, value) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { localStorage.setItem(key, value); return true; } catch {
      if (!evictCache()) return false;
    }
  }
  return false;
}

// On load: drop cached copies nobody will read again — older builds' catalog files
// (each deploy versions them with ?b= / ?v=; only the newest copy of each is kept)
// and anything older than a month.
export function pruneCache() {
  const MONTH = 30 * 24 * HOUR;
  const newest = new Map(); // address without its version → newest key
  const drop = [];
  for (const [k, t] of cachedEntries()) {
    if (Date.now() - t > MONTH) { drop.push(k); continue; }
    if (!/[?&][bv]=/.test(k)) continue;
    const base = k.replace(/[?&][bv]=[^&]*/g, '');
    if (newest.has(base)) drop.push(newest.get(base));
    newest.set(base, k); // entries are oldest first, so this ends on the newest
  }
  drop.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
  return drop.length;
}
try { pruneCache(); } catch { /* storage unavailable */ }

function cacheWrite(url, data) {
  const entry = { t: Date.now(), data };
  memCache.set(url, entry);
  const value = JSON.stringify(entry);
  // Probably over quota on failure — evict the oldest cached responses and retry.
  saveLocal(CACHE_PREFIX + url, value);
}

export async function getJSON(url, ttl = TTL.search) {
  const cached = cacheRead(url, ttl);
  if (cached !== undefined) return cached;
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      cacheWrite(url, data);
      return data;
    } catch (e) {
      // Offline (e.g. at a card show): an expired copy beats nothing.
      const stale = cacheRead(url, Infinity);
      if (stale !== undefined) return stale;
      throw e;
    }
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}
