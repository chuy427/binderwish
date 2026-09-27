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


// Returns the set list (newest first) plus lookups. TCG Pocket is digital-only
// (no physical cards / TCGPlayer listings), so it's excluded.
export async function loadSets() {
  const [sets, pocket] = await Promise.all([
    getJSON(`${API}/sets`, TTL.sets),
    getJSON(`${API}/series/tcgp`, TTL.sets).catch(() => ({ sets: [] })),
  ]);
  const pocketIds = new Set((pocket.sets || []).map((s) => s.id));
  return {
    sets: sets.slice().reverse().filter((s) => !pocketIds.has(s.id)).map((s) => ({ id: s.id, name: s.name })),
    names: new Map(sets.map((s) => [s.id, s.name])),
    // Printed set size ("006/165" — the 165), used on placeholders.
    official: new Map(sets.map((s) => [s.id, s.cardCount?.official || 0])),
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

// A whole set (≤ a few hundred cards) in one cached request, in set order.
export async function loadSetCards(setId, pocketIds) {
  const data = await getJSON(`${API}/sets/${encodeURIComponent(setId)}`, TTL.sets);
  return (data.cards || []).filter((c) => !isPocket(c, pocketIds));
}

// TCGdex exposes the TCGPlayer product id in a few places depending on the card
// and response version — check each.
function tcgdexTcgplayerId(detail) {
  if (detail.thirdParty?.tcgplayer) return detail.thirdParty.tcgplayer;
  for (const v of detail.variants_detailed || []) {
    if (v.thirdParty?.tcgplayer) return v.thirdParty.tcgplayer;
  }
  for (const v of Object.values(detail.pricing?.tcgplayer || {})) {
    if (v && typeof v === 'object' && v.productId) return v.productId;
  }
  return null;
}

function tcgdexMarketPrice(detail) {
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
// Maps each TCGdex card to its TCGPlayer products and printings — the source of
// truth for master-set variants (reverse holos, Poké Ball / Master Ball patterns…)
// and their prices. Rows: [number, productId, name, { printing: price }].
const CATALOG = `${import.meta.env.BASE_URL}tcgplayer`;

// "158/128" -> "158"; "TG01/TG30" -> "tg1"; "025" -> "25" (mirrors the sync script)
const normNumber = (n) => String(n).split('/')[0].trim().toLowerCase().replace(/^([a-z-]*)0+(?=\d)/, '$1');
// "Mew ex - 158/128" / "Pikachu (Poke Ball Pattern)" -> "mewex" / "pikachu"
const normName = (n) => String(n).split(' - ')[0].replace(/\([^)]*\)/g, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function catalogRows(setId) {
  const index = await getJSON(`${CATALOG}/index.json`, TTL.card).catch(() => ({}));
  const groups = index.sets?.[setId];
  if (!groups?.length) return [];
  return (await Promise.all(groups.map((g) => getJSON(`${CATALOG}/g/${g}.json`, TTL.card).catch(() => [])))).flat();
}

// All TCGPlayer products for one TCGdex card: the plain product first, then any
// same-numbered variants like "(Poke Ball Pattern)".
function matchProducts(rows, localId, name) {
  const nameMatches = (r) => normName(r[2]) === normName(name);
  const byNumber = rows.filter((r) => normNumber(r[0]) === normNumber(localId));
  const named = byNumber.filter(nameMatches);
  let pool = named.length ? named : byNumber.length === 1 ? byNumber : [];
  // Numbering can differ between sources (e.g. Classic Collection reprints keep their
  // original numbers on TCGPlayer) — fall back to the name when it's unique in the set.
  if (!pool.length) {
    const byName = rows.filter(nameMatches);
    const numbers = new Set(byName.map((r) => normNumber(r[0])));
    if (numbers.size === 1) pool = byName;
    // Two-part LEGEND cards are sold as separate "(Top)" / "(Bottom)" halves.
    else pool = byName.filter((r) => /\(Top\)/i.test(r[2]));
  }
  const isPlain = (r) => !/\(/.test(r[2]);
  return [...pool.filter(isPlain), ...pool.filter((r) => !isPlain(r))];
}

const PRINTING_ORDER = ['1st Edition Holofoil', '1st Edition', 'Unlimited Holofoil', 'Unlimited', 'Normal', 'Holofoil', 'Reverse Holofoil'];
const PRINTING_LABEL = {
  '1st Edition Holofoil': '1st Edition Holo',
  '1st Edition': '1st Edition',
  'Unlimited Holofoil': 'Unlimited Holo',
  Unlimited: 'Unlimited',
  Normal: 'Normal',
  Holofoil: 'Holo',
  'Reverse Holofoil': 'Reverse Holo',
};
const printingRank = (p) => { const i = PRINTING_ORDER.indexOf(p); return i < 0 ? 99 : i; };
const variantName = (productName) => (productName.match(/\(([^)]*)\)/)?.[1] || '')
  .replace(/Poke Ball/i, 'Poké Ball');

// Expands products into binder slots, one per printing, e.g. Exeggcute #001 →
// Normal, Reverse Holo, Poké Ball Pattern, Master Ball Pattern.
function productVariants(products) {
  const out = [];
  products.forEach((row, i) => {
    const [, productId, productName, prices] = row;
    const printings = Object.keys(prices || {}).sort((a, b) => printingRank(a) - printingRank(b));
    const list = printings.length ? printings : [null];
    // The first product is the card itself (even if TCGPlayer's name carries a note
    // like "(Delta Species)"); later ones are pattern/stamp variants.
    const special = i > 0 ? variantName(productName) : '';
    for (const printing of list) {
      const printLabel = printing ? (PRINTING_LABEL[printing] || printing) : '';
      out.push({
        variantId: `${productId}:${printing || ''}`,
        tcgplayerId: productId,
        // Only pin the printing in the link when the product page offers several.
        printing: list.length > 1 ? printing : null,
        label: special ? (list.length > 1 ? `${special} · ${printLabel}` : special) : (printLabel || 'Standard'),
        price: printing ? prices[printing] ?? null : null,
      });
    }
  });
  return out;
}

function makeSlot(card, setId, setsInfo, variant, order) {
  const official = setsInfo.official?.get(setId);
  return {
    key: `${card.id}|${variant ? variant.variantId : 'card'}`,
    cardId: card.id,
    setId,
    setName: setsInfo.names?.get(setId) || setId,
    name: card.name,
    number: card.localId,
    numberLabel: official && /^\d+$/.test(card.localId) ? `${card.localId}/${String(official).padStart(3, '0')}` : card.localId,
    image: card.image || null,
    tcgplayerId: variant?.tcgplayerId ?? null,
    printing: variant?.printing ?? null,
    variantLabel: variant?.label ?? null,
    price: variant?.price ?? null,
    // No catalog match — look the card up on TCGdex when it's added.
    needsLookup: !variant,
    order,
  };
}

// Binder slots for a list of cards from one set, in set order. With
// `variants` off, each card gets a single slot (its first printing).
export async function slotsForCards(cards, setId, setsInfo, { variants = true } = {}) {
  const rows = await catalogRows(setId);
  const slots = [];
  cards.forEach((card, ci) => {
    const vs = rows.length ? productVariants(matchProducts(rows, card.localId, card.name)) : [];
    const list = vs.length ? (variants ? vs : vs.slice(0, 1)) : [null];
    list.forEach((v, vi) => slots.push(makeSlot(card, setId, setsInfo, v, ci * 100 + vi)));
  });
  return slots;
}

// Every slot in a set — the full master set (or one per card with variants off).
export async function setSlots(setId, setsInfo, opts) {
  const cards = await loadSetCards(setId, setsInfo.pocketIds);
  return slotsForCards(cards, setId, setsInfo, opts);
}

// Slots for name-search results, which span many sets.
export async function slotsForSearch(cards, setsInfo, opts) {
  const bySet = new Map();
  cards.forEach((c) => {
    const s = setIdFromCardId(c.id);
    if (!bySet.has(s)) bySet.set(s, []);
    bySet.get(s).push(c);
  });
  const perSet = new Map();
  await Promise.all([...bySet].map(async ([s, cs]) => perSet.set(s, await slotsForCards(cs, s, setsInfo, opts))));
  // Keep the API's result order.
  return cards.flatMap((c) => perSet.get(setIdFromCardId(c.id)).filter((sl) => sl.cardId === c.id));
}

// For cards the catalog couldn't match: TCGPlayer id + price from TCGdex.
export async function fetchCardExtras(cardId) {
  const detail = await getJSON(`${API}/cards/${encodeURIComponent(cardId)}`, TTL.card);
  return {
    tcgplayerId: tcgdexTcgplayerId(detail),
    price: tcgdexMarketPrice(detail),
    setName: detail.set?.name,
    image: detail.image,
  };
}

export function tcgplayerUrl(slot) {
  if (slot.tcgplayerId) {
    const printing = slot.printing ? `?Printing=${encodeURIComponent(slot.printing).replace(/%20/g, '+')}` : '';
    return `https://www.tcgplayer.com/product/${slot.tcgplayerId}${printing}`;
  }
  const q = encodeURIComponent(`${slot.name} ${slot.number || ''}`.trim());
  return `https://www.tcgplayer.com/search/pokemon/product?q=${q}`;
}

export const cardImage = (card, quality = 'low') => (card.image ? `${card.image}/${quality}.webp` : null);
