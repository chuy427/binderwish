// TCGdex API access with an in-memory + localStorage response cache, so repeat
// lookups don't hit TCGdex again. Card data rarely changes; prices update daily.

export const API = 'https://api.tcgdex.net/v2/en';
export const PAGE_SIZE = 30;

const CACHE_PREFIX = 'proxyscan.cache:';
const HOUR = 60 * 60 * 1000;
export const TTL = {
  sets: 7 * 24 * HOUR,   // set list / pocket exclusions / a set's card list
  card: 24 * HOUR,       // card detail (includes price)
  search: 24 * HOUR,     // name search results
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
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    cacheWrite(url, data);
    return data;
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export function setIdFromCardId(cardId) {
  // TCGdex card ids are "<setId>-<localId>"; set ids may themselves contain dashes.
  return cardId.slice(0, cardId.lastIndexOf('-'));
}

// Returns { sets: [{id, name}] newest first, pocketIds: Set } — TCG Pocket is
// digital-only (no physical cards / TCGPlayer listings), so it's excluded.
export async function loadSets() {
  const [sets, pocket] = await Promise.all([
    getJSON(`${API}/sets`, TTL.sets),
    getJSON(`${API}/series/tcgp`, TTL.sets).catch(() => ({ sets: [] })),
  ]);
  const pocketIds = new Set((pocket.sets || []).map((s) => s.id));
  return {
    sets: sets.slice().reverse().filter((s) => !pocketIds.has(s.id)).map((s) => ({ id: s.id, name: s.name })),
    names: new Map(sets.map((s) => [s.id, s.name])),
    pocketIds,
  };
}

const isPocket = (c, pocketIds) => c.image?.includes('/tcgp/') || pocketIds.has(setIdFromCardId(c.id));

// Name search, paged server-side.
export async function searchByName(query, page, pocketIds) {
  const params = new URLSearchParams({
    name: query,
    'pagination:page': page,
    'pagination:itemsPerPage': PAGE_SIZE,
  });
  const raw = await getJSON(`${API}/cards?${params}`, TTL.search);
  return { cards: raw.filter((c) => !isPocket(c, pocketIds)), hasMore: raw.length === PAGE_SIZE };
}

// A whole set (≤ a few hundred cards) in one cached request, optionally filtered by name locally.
export async function loadSetCards(setId, query, pocketIds) {
  const data = await getJSON(`${API}/sets/${encodeURIComponent(setId)}`, TTL.sets);
  const q = query.trim().toLowerCase();
  return (data.cards || []).filter((c) => !isPocket(c, pocketIds) && (!q || c.name.toLowerCase().includes(q)));
}

// TCGdex exposes the TCGPlayer product id in a few places depending on the card
// and response version — check each.
function tcgplayerId(detail) {
  if (detail.thirdParty?.tcgplayer) return detail.thirdParty.tcgplayer;
  for (const v of detail.variants_detailed || []) {
    if (v.thirdParty?.tcgplayer) return v.thirdParty.tcgplayer;
  }
  for (const v of Object.values(detail.pricing?.tcgplayer || {})) {
    if (v && typeof v === 'object' && v.productId) return v.productId;
  }
  return null;
}

function marketPrice(detail) {
  const tp = detail.pricing?.tcgplayer;
  if (!tp) return null;
  for (const variant of ['holofoil', 'normal', 'reverse-holofoil', 'reverseHolofoil', '1stEditionHolofoil', '1st-edition-holofoil']) {
    const p = tp[variant]?.marketPrice ?? tp[variant]?.midPrice;
    if (typeof p === 'number') return p;
  }
  for (const v of Object.values(tp)) {
    if (v && typeof v === 'object' && typeof v.marketPrice === 'number') return v.marketPrice;
  }
  return null;
}

// ---------- Bundled TCGPlayer catalog (built by scripts/sync-tcgplayer.mjs) ----------
// TCGdex hasn't linked every card to TCGPlayer (new sets especially), so fall
// back to matching set + card number against a snapshot of TCGPlayer's catalog.
const CATALOG = `${import.meta.env.BASE_URL}tcgplayer`;

// "158/128" -> "158"; "TG01/TG30" -> "tg1"; "025" -> "25" (mirrors the sync script)
const normNumber = (n) => String(n).split('/')[0].trim().toLowerCase().replace(/^([a-z-]*)0+(?=\d)/, '$1');
// "Mew ex - 158/128" / "Pikachu (Poke Ball Pattern)" -> "mewex" / "pikachu"
const normName = (n) => String(n).split(' - ')[0].replace(/\([^)]*\)/g, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function catalogLookup(setId, localId, name) {
  const index = await getJSON(`${CATALOG}/index.json`, TTL.card);
  const groups = index.sets?.[setId];
  if (!groups?.length) return null;
  const all = (await Promise.all(groups.map((g) => getJSON(`${CATALOG}/g/${g}.json`, TTL.card).catch(() => [])))).flat();
  const nameMatches = (r) => normName(r[2]) === normName(name);
  const rows = all.filter((r) => normNumber(r[0]) === normNumber(localId));
  // Several products can share a number (special-pattern reprints, etc.): prefer a
  // name match, then the plain printing (no parenthetical variant in its name).
  const named = rows.filter(nameMatches);
  let pool = named.length ? named : rows.length === 1 ? rows : [];
  // Numbering can differ between sources (e.g. Classic Collection reprints keep their
  // original numbers on TCGPlayer) — fall back to the name when it's unique in the set.
  if (!pool.length) {
    const byName = all.filter(nameMatches);
    if (byName.length === 1) pool = byName;
    // Two-part LEGEND cards are sold as separate "(Top)" / "(Bottom)" halves.
    else pool = byName.filter((r) => /\(Top\)/i.test(r[2]));
  }
  const best = pool.find((r) => !/\(/.test(r[2])) || pool[0];
  return best ? { tcgplayerId: best[1], price: best[3] } : null;
}

// Fetches the fields list endpoints don't include: TCGPlayer id, price, set name.
export async function fetchCardExtras(cardId) {
  const detail = await getJSON(`${API}/cards/${encodeURIComponent(cardId)}`, TTL.card);
  let id = tcgplayerId(detail);
  let price = marketPrice(detail);
  if (!id || price == null) {
    const hit = await catalogLookup(detail.set?.id || setIdFromCardId(cardId), detail.localId, detail.name).catch(() => null);
    if (hit) {
      id = id || hit.tcgplayerId;
      if (price == null && hit.tcgplayerId === id) price = hit.price;
    }
  }
  return {
    tcgplayerId: id,
    price,
    setName: detail.set?.name,
    image: detail.image,
  };
}

export function tcgplayerUrl(card) {
  if (card.tcgplayerId) return `https://www.tcgplayer.com/product/${card.tcgplayerId}`;
  const q = encodeURIComponent(`${card.name} ${card.number || ''}`.trim());
  return `https://www.tcgplayer.com/search/pokemon/product?q=${q}`;
}

export const cardImage = (card, quality = 'low') => (card.image ? `${card.image}/${quality}.webp` : null);
