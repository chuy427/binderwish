// Disney Lorcana adapter — card data and images from Lorcast (https://lorcast.com).
// Lorcast asks for 50–100ms between requests; the response cache means the app
// only makes a handful per session (set list, one per set browsed, searches).
import { getJSON, TTL } from '../lib/cache';
import { matchByNumberAndName } from '../catalog';

const API = 'https://api.lorcast.com/v0';

// Base rarities set the printed set size ("158/204"); Enchanted / Epic / Iconic
// cards are numbered past it.
const BASE_RARITIES = new Set(['Common', 'Uncommon', 'Rare', 'Super_rare', 'Legendary']);
const SPECIAL_RARITIES = { Enchanted: 'Enchanted', Epic: 'Epic', Iconic: 'Iconic' };

// Lorcast card → the shape the slot engine expects.
const toCard = (c) => ({
  id: c.id,
  setId: c.set.code,
  setName: c.set.name,
  // Lorcana cards are "Name – Version", e.g. "Ariel – On Human Legs".
  name: c.version ? `${c.name} – ${c.version}` : c.name,
  number: c.collector_number,
  rarity: c.rarity,
  images: c.image_uris?.digital ? { small: c.image_uris.digital.small, large: c.image_uris.digital.large } : null,
  tcgplayerId: c.tcgplayer_id || null,
});

// Printed set size per set, learned as sets are loaded.
const officialBySet = new Map();

const lorcana = {
  id: 'lorcana',
  name: 'Lorcana',
  exampleCard: 'Stitch',
  quickPicks: ['The First Chapter', 'Winterspell', 'Wilds Unknown', 'Attack of the Vine!'],

  async loadSets() {
    const { results } = await getJSON(`${API}/sets`, TTL.sets);
    // Main numbered sets first (newest first), then promos / quests / special
    // products, also newest first.
    const isMain = (s) => /^\d+$/.test(s.code);
    const sets = results.slice().sort((a, b) => (isMain(b) - isMain(a))
      || (b.released_at || '').localeCompare(a.released_at || ''));
    return {
      sets: sets.map((s) => ({
        id: s.code, name: s.name, released: s.released_at || '',
        series: isMain(s) ? 'Main sets' : 'Promos & special', code: isMain(s) ? `Chapter ${s.code}` : s.code,
      })),
      names: new Map(sets.map((s) => [s.code, s.name])),
      official: officialBySet,
    };
  },

  async loadSetCards(setId) {
    const cards = await getJSON(`${API}/sets/${encodeURIComponent(setId)}/cards`, TTL.sets);
    const base = cards.filter((c) => BASE_RARITIES.has(c.rarity)).map((c) => parseInt(c.collector_number, 10)).filter(Number.isFinite);
    if (base.length) officialBySet.set(setId, Math.max(...base));
    return cards.map(toCard);
  },

  // Lorcast returns every match at once (no paging).
  async searchByName(query) {
    const { results } = await getJSON(`${API}/cards/search?q=${encodeURIComponent(query)}`, TTL.search);
    return { cards: (results || []).map(toCard), hasMore: false };
  },

  // Lorcast already knows each card's TCGPlayer product; fall back to number + name
  // for brand-new sets it hasn't linked yet.
  matchProducts(rows, card) {
    const exact = card.tcgplayerId ? rows.filter((r) => r[1] === card.tcgplayerId) : [];
    return exact.length ? exact : matchByNumberAndName(rows, card.number, card.name);
  },

  specialVariant: (card) => SPECIAL_RARITIES[card.rarity] || '',

  numberLabel(card, setsInfo) {
    const official = setsInfo.official?.get(card.setId);
    return official && /^\d+$/.test(card.number) ? `${card.number}/${official}` : card.number;
  },
};

export default lorcana;
