// One Piece Card Game adapter. There's no separate card-data API: the bundled
// TCGPlayer catalog *is* the card list — every variant (Alternate Art, Manga, SP,
// Wanted Poster, event stamps…) is its own product with its own image, so each
// product is one binder slot. Images come from TCGPlayer's product CDN.
import { getJSON, TTL } from '../lib/cache';
import { catalogIndex, catalogRows, catalogFile } from '../catalog';

const IMG = 'https://tcgplayer-cdn.tcgplayer.com/product';
const KIND_ORDER = ['Booster', 'Extra & Premium', 'Starter Deck', 'Other'];

// Parentheticals that always mean "a different version of this card", never part
// of its name. Everything else shared by all products at a number (e.g. the
// "(Daz.Bonez)" in "Mr.1 (Daz.Bonez)") is kept as part of the name.
const VARIANT_WORDS = /^(sp|alternate art|parallel|manga|wanted poster|gold|treasure rare|tr|dash pack.*|jumbo|textured|serial numbered|oversized|red super alternate art|super alternate art)$/i;
// Within one card number: base first, then the chase versions.
const VARIANT_RANK = [/^$/, /alternate art|parallel/i, /^sp$/i, /manga/i, /gold/i, /wanted poster/i];
const variantRank = (label) => { const i = VARIANT_RANK.findIndex((re) => re.test(label)); return i < 0 ? VARIANT_RANK.length : i; };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Mr.1 (Daz.Bonez) - OP14-062 (SP) [Winner]" -> { base: "Mr.1", parens: ["Daz.Bonez", "SP"], tags: ["Winner"] }
function parseName(name, number) {
  let s = name.replace(new RegExp(`\\s*-\\s*${escapeRe(number)}\\b`), '');
  const tags = [];
  s = s.replace(/\[([^\]]+)\]/g, (_, t) => { tags.push(t.trim()); return ''; });
  const parens = [];
  s = s.replace(/\(([^)]+)\)/g, (_, t) => { parens.push(t.trim()); return ''; });
  return {
    base: s.replace(/\s+/g, ' ').trim(),
    // "(004)" / "(OP09-061)" only disambiguate same-named cards by number — drop them.
    parens: parens.filter((p) => !/^\d{1,3}$/.test(p) && !/^[A-Z]{1,4}\d*-\d+$/i.test(p)),
    tags,
  };
}

const numberParts = (n) => {
  const m = String(n).match(/^(.*?)-?(\d+)$/);
  return m ? [m[1], parseInt(m[2], 10)] : [String(n), 0];
};

// Catalog rows for one set → cards in binder order: the set's own numbers first
// (OP14-001 … OP14-120), then cards numbered from elsewhere (SP reprints, Dash
// Pack…), each number's base card before its variants.
function rowsToCards(rows, setId) {
  const byNumber = new Map();
  for (const r of rows) {
    if (!byNumber.has(r[0])) byNumber.set(r[0], []);
    byNumber.get(r[0]).push({ row: r, ...parseName(r[2], r[0]) });
  }
  // The set's own number prefix is the most common one ("OP14").
  const prefixCount = new Map();
  for (const n of byNumber.keys()) { const p = numberParts(n)[0]; prefixCount.set(p, (prefixCount.get(p) || 0) + 1); }
  const home = [...prefixCount].sort((a, b) => b[1] - a[1])[0]?.[0];

  const cards = [];
  for (const [number, items] of byNumber) {
    // Parentheticals every product at this number shares are part of the name.
    const shared = items[0].parens.filter((p) => !VARIANT_WORDS.test(p) && items.every((it) => it.parens.includes(p)));
    for (const it of items) {
      const label = [...it.parens.filter((p) => !shared.includes(p)), ...it.tags].join(' · ');
      const id = it.row[1];
      cards.push({
        id: `op-${id}`,
        setId,
        name: shared.length ? `${it.base} (${shared.join(') (')})` : it.base,
        number,
        variant: label,
        tcgplayerId: id,
        images: { small: `${IMG}/${id}_200w.jpg`, large: `${IMG}/${id}_in_1000x1000.jpg` },
      });
    }
  }
  const key = (c) => {
    const [p, n] = numberParts(c.number);
    return [p === home ? 0 : 1, p, n, variantRank(c.variant), c.variant];
  };
  return cards.sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  });
}

const onepiece = {
  id: 'onepiece',
  name: 'One Piece',
  exampleCard: 'Monkey.D.Luffy',
  // Card names run along the bottom — keep the QR code clear of them.
  qrCorner: 'tr',
  quickPicks: [],

  async loadSets() {
    const index = await catalogIndex('onepiece');
    const list = (index.setList || []).slice().sort((a, b) =>
      (KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)) || (b.released || '').localeCompare(a.released || ''));
    // Quick picks: the three newest boosters.
    onepiece.quickPicks = list.filter((s) => s.kind === 'Booster').slice(0, 3).map((s) => s.name);
    return {
      sets: list.map((s) => ({ id: s.id, name: s.name, code: s.code, group: s.kind })),
      names: new Map(list.map((s) => [s.id, s.name])),
    };
  },

  async loadSetCards(setId) {
    return rowsToCards(await catalogRows('onepiece', setId), setId);
  },

  // Search the bundled name index, then load the matching sets.
  async searchByName(query) {
    const q = query.trim().toLowerCase();
    const names = await getJSON(await catalogFile('onepiece', 'search.json'), TTL.card);
    const groups = new Set(names.filter(([n]) => n.toLowerCase().includes(q)).flatMap(([, gs]) => gs));
    const index = await catalogIndex('onepiece');
    // Newest sets first; cap how many sets we pull in for a broad query.
    const order = new Map((index.setList || []).map((s) => [s.id, s.released || '']));
    const setIds = [...groups].map(String).sort((a, b) => (order.get(b) || '').localeCompare(order.get(a) || '')).slice(0, 12);
    const perSet = await Promise.all(setIds.map((id) => onepiece.loadSetCards(id)));
    const cards = perSet.flat().filter((c) => c.name.toLowerCase().includes(q));
    return { cards, hasMore: false };
  },

  // Each card is exactly one product.
  matchProducts: (rows, card) => rows.filter((r) => r[1] === card.tcgplayerId),
  specialVariant: (card) => card.variant || 'Standard',
  isVariantCard: (card) => !!card.variant,
  numberLabel: (card) => card.number,
};

export default onepiece;
