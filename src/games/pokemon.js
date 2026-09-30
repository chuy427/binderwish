// Pokémon TCG adapter — card data and images from TCGdex (https://tcgdex.dev).
import { getJSON, TTL } from '../lib/cache';
import { catalogIndex, matchByNumberAndName } from '../catalog';

const API = 'https://api.tcgdex.net/v2/en';
const PAGE_SIZE = 30;

// TCGdex card ids are "<setId>-<localId>"; set ids may themselves contain dashes.
const setIdFromCardId = (cardId) => cardId.slice(0, cardId.lastIndexOf('-'));

// TCGdex summary card → the shape the slot engine expects.
const toCard = (c) => ({
  id: c.id,
  setId: setIdFromCardId(c.id),
  name: c.name,
  number: c.localId,
  images: c.image ? { small: `${c.image}/low.webp`, large: `${c.image}/high.webp` } : null,
});

// TCG Pocket is digital-only (no physical cards / TCGPlayer listings), so it's excluded.
const isPocket = (c, pocketIds) => c.image?.includes('/tcgp/') || pocketIds.has(setIdFromCardId(c.id));

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

const pokemon = {
  id: 'pokemon',
  name: 'Pokémon',
  exampleCard: 'Charizard ex',
  quickPicks: ['Prismatic Evolutions', '151', '30th Celebration', 'Surging Sparks'],

  async loadSets() {
    const [sets, pocket, index] = await Promise.all([
      getJSON(`${API}/sets`, TTL.sets),
      getJSON(`${API}/series/tcgp`, TTL.sets).catch(() => ({ sets: [] })),
      catalogIndex('pokemon'),
    ]);
    // Release date + series come from the catalog build (see sync-tcgplayer.mjs).
    const meta = index.meta || {};
    const pocketIds = new Set((pocket.sets || []).map((s) => s.id));
    return {
      sets: sets.slice().reverse().filter((s) => !pocketIds.has(s.id)).map((s) => ({
        id: s.id, name: s.name,
        logo: s.logo ? `${s.logo}.webp` : null,
        released: meta[s.id]?.[0] || '', series: meta[s.id]?.[1] || '', total: s.cardCount?.total || 0,
      })),
      names: new Map(sets.map((s) => [s.id, s.name])),
      // Printed set size ("006/165" — the 165), used on placeholders.
      official: new Map(sets.map((s) => [s.id, s.cardCount?.official || 0])),
      pocketIds,
    };
  },

  // A whole set (≤ a few hundred cards) in one cached request, in set order.
  async loadSetCards(setId, setsInfo) {
    const data = await getJSON(`${API}/sets/${encodeURIComponent(setId)}`, TTL.sets);
    return (data.cards || []).filter((c) => !isPocket(c, setsInfo.pocketIds)).map(toCard);
  },

  // Name search, paged server-side.
  async searchByName(query, page, setsInfo) {
    const params = new URLSearchParams({ name: query, 'pagination:page': page, 'pagination:itemsPerPage': PAGE_SIZE });
    const raw = await getJSON(`${API}/cards?${params}`, TTL.search);
    return { cards: raw.filter((c) => !isPocket(c, setsInfo.pocketIds)).map(toCard), hasMore: raw.length === PAGE_SIZE };
  },

  // Every card for a custom set rule: a Pokémon name (TCGdex matches names that
  // contain it — "Charizard" also finds "Charizard ex", "Blaine's Charizard") or an
  // illustrator. All pages, not just the first.
  collectionRules: ['name', 'artist'],
  async collectionCards({ type, value }, setsInfo) {
    const field = type === 'artist' ? 'illustrator' : 'name';
    const size = 250;
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const params = new URLSearchParams({ [field]: value, 'pagination:page': page, 'pagination:itemsPerPage': size });
      const raw = await getJSON(`${API}/cards?${params}`, TTL.search);
      out.push(...raw.filter((c) => !isPocket(c, setsInfo.pocketIds)).map(toCard));
      if (raw.length < size) break;
    }
    return out;
  },

  matchProducts: (rows, card) => matchByNumberAndName(rows, card.number, card.name),

  numberLabel(card, setsInfo) {
    const official = setsInfo.official?.get(card.setId);
    return official && /^\d+$/.test(card.number) ? `${card.number}/${String(official).padStart(3, '0')}` : card.number;
  },

  // For cards the catalog couldn't match: TCGPlayer id + price from TCGdex.
  async fetchCardExtras(cardId) {
    const detail = await getJSON(`${API}/cards/${encodeURIComponent(cardId)}`, TTL.card);
    const image = detail.image;
    return {
      tcgplayerId: tcgdexTcgplayerId(detail),
      price: tcgdexMarketPrice(detail),
      setName: detail.set?.name,
      images: image ? { small: `${image}/low.webp`, large: `${image}/high.webp` } : null,
    };
  },
};

export default pokemon;
