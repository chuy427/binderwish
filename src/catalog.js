// Game-independent binder-slot engine: turns a game adapter's cards into binder
// slots — one per TCGPlayer product/printing — using the bundled TCGPlayer catalog
// (built by scripts/sync-tcgplayer.mjs) for variants, product ids and prices.
import { getJSON, TTL } from './lib/cache';

const CATALOG = `${import.meta.env.BASE_URL}tcgplayer`;

// Rows: [number, productId, name, { printing: price }] for every TCGPlayer group
// mapped to this set. The index is re-checked hourly; group files are keyed by the
// catalog build time, so each (daily) rebuild is fetched fresh and never mixed
// with a stale cached copy.
// Keyed by the site build, so a deploy always brings a fresh index (the daily
// rebuild is also a deploy); otherwise re-checked hourly.
export const catalogIndex = (game) => getJSON(`${CATALOG}/${game}/index.json?b=${__BUILD_ID__}`, TTL.catalogIndex).catch(() => ({}));

// URL of another file in a game's catalog, versioned by the catalog build.
export async function catalogFile(game, file) {
  const index = await catalogIndex(game);
  return `${CATALOG}/${game}/${file}?v=${encodeURIComponent(index.generatedAt || '')}`;
}

export async function catalogRows(game, setId) {
  const index = await catalogIndex(game);
  const groups = index.sets?.[setId];
  if (!groups?.length) return [];
  const v = encodeURIComponent(index.generatedAt || '');
  const rows = (await Promise.all(groups.map((g) => getJSON(`${CATALOG}/${game}/g/${g}.json?v=${v}`, TTL.card).catch(() => [])))).flat();
  return rows.filter((r) => r[3] && typeof r[3] === 'object');
}

// "158/128" -> "158"; "TG01/TG30" -> "tg1"; "025" -> "25"
export const normNumber = (n) => String(n).split('/')[0].trim().toLowerCase().replace(/^([a-z-]*)0+(?=\d)/, '$1');
// "Mew ex - 158/128" / "Pikachu (Poke Ball Pattern)" -> "mewex" / "pikachu"
export const normName = (n) => String(n).split(' - ')[0].replace(/\([^)]*\)/g, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Default product matching by card number + name: the plain product first, then
// same-numbered variants like "(Poke Ball Pattern)".
export function matchByNumberAndName(rows, number, name) {
  const nameMatches = (r) => normName(r[2]) === normName(name);
  const byNumber = rows.filter((r) => normNumber(r[0]) === normNumber(number));
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

const PRINTING_ORDER = ['1st Edition Holofoil', '1st Edition', 'Unlimited Holofoil', 'Unlimited', 'Normal', 'Holofoil', 'Foil', 'Reverse Holofoil', 'Cold Foil'];
const PRINTING_LABEL = {
  '1st Edition Holofoil': '1st Edition Holo',
  '1st Edition': '1st Edition',
  'Unlimited Holofoil': 'Unlimited Holo',
  Unlimited: 'Unlimited',
  Normal: 'Normal',
  Holofoil: 'Holo',
  'Reverse Holofoil': 'Reverse Holo',
  'Cold Foil': 'Cold Foil',
  Foil: 'Foil',
};
const printingRank = (p) => { const i = PRINTING_ORDER.indexOf(p); return i < 0 ? 99 : i; };
const variantName = (productName) => (productName.match(/\(([^)]*)\)/)?.[1] || '')
  .replace(/Poke Ball/i, 'Poké Ball');

// Expands products into binder slots, one per printing, e.g. Exeggcute #001 →
// Normal, Reverse Holo, Poké Ball Pattern, Master Ball Pattern. `special` lets a
// game name a card's variant itself (e.g. Lorcana "Enchanted").
function productVariants(products, special = '') {
  const out = [];
  products.forEach((row, i) => {
    const [, productId, productName, prices] = row;
    const printings = Object.keys(prices || {}).sort((a, b) => printingRank(a) - printingRank(b));
    const list = printings.length ? printings : [null];
    // The first product is the card itself (even if TCGPlayer's name carries a note
    // like "(Delta Species)"); later ones are pattern/stamp variants.
    const name = i > 0 ? variantName(productName) : special;
    for (const printing of list) {
      const printLabel = printing ? (PRINTING_LABEL[printing] || printing) : '';
      out.push({
        variantId: `${productId}:${printing || ''}`,
        tcgplayerId: productId,
        // Only pin the printing in the link when the product page offers several.
        printing: list.length > 1 ? printing : null,
        label: name ? (list.length > 1 ? `${name} · ${printLabel}` : name) : (printLabel || 'Standard'),
        price: printing ? prices[printing] ?? null : null,
      });
    }
  });
  return out;
}

function makeSlot(game, card, setsInfo, variant, order) {
  return {
    key: `${card.id}|${variant ? variant.variantId : 'card'}`,
    game: game.id,
    cardId: card.id,
    setId: card.setId,
    setName: setsInfo.names?.get(card.setId) || card.setName || card.setId,
    name: card.name,
    number: card.number,
    numberLabel: game.numberLabel(card, setsInfo),
    images: card.images || null,
    tcgplayerId: variant?.tcgplayerId ?? card.tcgplayerId ?? null,
    printing: variant?.printing ?? null,
    variantLabel: variant?.label ?? null,
    price: variant?.price ?? null,
    // No catalog match and no product id from the card data — look it up when added.
    needsLookup: !variant && !card.tcgplayerId && !!game.fetchCardExtras,
    order,
  };
}

// Binder slots for cards from one set, in set order. With `variants` off, each
// card gets a single slot (its first printing).
export async function slotsForCards(game, cards, setId, setsInfo, { variants = true } = {}) {
  const rows = await catalogRows(game.id, setId);
  const slots = [];
  // With variants off, games whose variants are separate cards (One Piece) drop them.
  const list0 = variants || !game.isVariantCard ? cards : cards.filter((c) => !game.isVariantCard(c));
  list0.forEach((card, ci) => {
    const products = rows.length ? game.matchProducts(rows, card) : [];
    const vs = productVariants(products, game.specialVariant?.(card) || '');
    const list = vs.length ? (variants ? vs : vs.slice(0, 1)) : [null];
    list.forEach((v, vi) => slots.push(makeSlot(game, card, setsInfo, v, ci * 100 + vi)));
  });
  return slots;
}

// Every slot in a set — the full master set (or one per card with variants off).
export async function setSlots(game, setId, setsInfo, opts) {
  const cards = await game.loadSetCards(setId, setsInfo);
  return slotsForCards(game, cards, setId, setsInfo, opts);
}

// Slots for name-search results, which span many sets (kept in result order).
export async function slotsForSearch(game, cards, setsInfo, opts) {
  const bySet = new Map();
  cards.forEach((c) => {
    if (!bySet.has(c.setId)) bySet.set(c.setId, []);
    bySet.get(c.setId).push(c);
  });
  const perSet = new Map();
  await Promise.all([...bySet].map(async ([s, cs]) => perSet.set(s, await slotsForCards(game, cs, s, setsInfo, opts))));
  return cards.flatMap((c) => perSet.get(c.setId).filter((sl) => sl.cardId === c.id));
}

export function tcgplayerUrl(slot) {
  if (slot.tcgplayerId) {
    const printing = slot.printing ? `?Printing=${encodeURIComponent(slot.printing).replace(/%20/g, '+')}` : '';
    return `https://www.tcgplayer.com/product/${slot.tcgplayerId}${printing}`;
  }
  const q = encodeURIComponent(`${slot.name} ${slot.number || ''}`.trim());
  return `https://www.tcgplayer.com/search/all/product?q=${q}`;
}

// Card art URL. Slots carry `images` ({ small, large }); items saved by earlier
// versions (and the home page samples) carry a TCGdex `image` base instead.
export function cardImage(slot, quality = 'low') {
  if (slot.images) return (quality === 'high' ? slot.images.large : slot.images.small) || null;
  return slot.image ? `${slot.image}/${quality}.webp` : null;
}
