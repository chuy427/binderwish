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

function cacheWrite(url, data) {
  const entry = { t: Date.now(), data };
  memCache.set(url, entry);
  const value = JSON.stringify(entry);
  try {
    localStorage.setItem(CACHE_PREFIX + url, value);
  } catch {
    // Probably over quota — evict the oldest half of cached responses and retry once.
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(CACHE_PREFIX)) {
          let t = 0;
          try { t = JSON.parse(localStorage.getItem(k)).t; } catch {}
          keys.push([k, t]);
        }
      }
      keys.sort((a, b) => a[1] - b[1]);
      keys.slice(0, Math.ceil(keys.length / 2)).forEach(([k]) => localStorage.removeItem(k));
      localStorage.setItem(CACHE_PREFIX + url, value);
    } catch { /* storage unavailable — memory cache still works */ }
  }
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
