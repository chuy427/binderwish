// Collection import: a CSV export from TCGPlayer, Collectr, or any spreadsheet →
// the binder slots (owned keys) it describes. Rows are matched to a set by name or
// code, then to a card by TCGPlayer product id when the file has one, otherwise by
// card number (and name), then to a printing.
import { normName, normNumber, setSlots } from '../catalog';
import { getGame } from '../games';

// ---------- CSV ----------
// RFC 4180-ish: quoted fields, doubled quotes, CRLF; comma, semicolon or tab separated.
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.indexOf('\n') >>> 0);
  const sep = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

// Header names seen in TCGPlayer, Collectr and hand-made spreadsheets.
const COLUMNS = {
  productId: ['product id', 'productid', 'tcgplayer id', 'tcgplayer product id', 'tcgplayer_id', 'tcgplayerid'],
  set: ['set', 'set name', 'set_name', 'expansion', 'group', 'group name'],
  number: ['card number', 'number', 'collector number', 'collector_number', 'card #', 'card no', 'no', 'no.', 'num', '#'],
  name: ['simple name', 'name', 'card name', 'product name', 'card', 'product'],
  printing: ['printing', 'variance', 'variant', 'finish', 'foil', 'treatment'],
  qty: ['quantity', 'qty', 'count', 'total quantity', 'owned', 'have'],
  game: ['product line', 'category', 'game', 'tcg', 'product line name'],
};
const headerKey = (h) => h.trim().toLowerCase().replace(/\s+/g, ' ');

export function detectColumns(header) {
  const keys = header.map(headerKey);
  const cols = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    const i = names.map((n) => keys.indexOf(n)).find((x) => x >= 0);
    if (i != null) cols[field] = i;
  }
  return cols;
}

// ---------- Matching helpers ----------
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// "SV08.5: Prismatic Evolutions" / "SV: Prismatic Evolutions" / "Pokemon Prismatic Evolutions" → "prismaticevolutions"
const normSet = (s) => plain(s).replace(/^[a-z0-9.\- ]{1,10}:\s*/, '').replace(/\b(pokemon|disney|lorcana|one piece( card game)?|tcg)\b/g, '').replace(/[^a-z0-9]/g, '');

function gameOf(text) {
  const t = plain(text);
  if (/pokemon/.test(t)) return 'pokemon';
  if (/lorcana/.test(t)) return 'lorcana';
  if (/one ?piece/.test(t)) return 'onepiece';
  return null;
}

// Printing words → a family we can compare across sources.
function printingFamily(p) {
  const t = plain(p);
  if (!t.trim()) return null;
  if (/reverse/.test(t)) return 'reverse';
  if (/1st/.test(t)) return /holo/.test(t) ? '1st-holo' : '1st';
  if (/cold/.test(t)) return 'cold';
  if (/unlimited/.test(t)) return /holo/.test(t) ? 'unl-holo' : 'unl';
  if (/holo|foil/.test(t)) return 'foil';
  if (/normal|non|regular|standard|base/.test(t)) return 'normal';
  return t.replace(/[^a-z0-9]/g, '');
}

// Builds a set finder for one game: by exact name, by code/id, then by a unique
// name that one side contains ("Scarlet & Violet: 151" ↔ "151").
function setFinder(setsInfo) {
  const sets = setsInfo.sets || [];
  const byName = new Map();
  for (const s of sets) {
    for (const k of [normSet(s.name), plain(s.id).replace(/[^a-z0-9]/g, ''), plain(s.code).replace(/[^a-z0-9]/g, '')]) {
      if (k && !byName.has(k)) byName.set(k, s.id);
    }
  }
  const cache = new Map();
  return (raw) => {
    const key = normSet(raw);
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);
    let id = byName.get(key) || null;
    if (!id) {
      // Set names usually come last ("SV: Scarlet & Violet 151" → "151"), so a name the
      // text ends with beats one it merely contains; then the longest wins, if clearly.
      const score = (s) => { const n = normSet(s.name); return (key.endsWith(n) ? 1000 : 0) + n.length; };
      const loose = sets.filter((s) => { const n = normSet(s.name); return n.length >= 3 && (key.includes(n) || n.includes(key)); })
        .sort((a, b) => score(b) - score(a));
      if (loose.length === 1 || (loose.length > 1 && score(loose[0]) > score(loose[1]))) id = loose[0].id;
    }
    cache.set(key, id);
    return id;
  };
}

// Picks the slot for one row among a card's candidate slots.
function pickSlot(cands, { name, printing }) {
  if (!cands.length) return null;
  // Same number, several cards (e.g. One Piece parallels): narrow by name.
  if (name && new Set(cands.map((s) => s.cardId)).size > 1) {
    const exact = cands.filter((s) => normName(s.name) === normName(name));
    const tagged = cands.filter((s) => s.variantLabel && plain(name).includes(plain(s.variantLabel).split(' · ')[0]));
    cands = tagged.length ? tagged : exact.length ? exact : cands;
  }
  const fam = printingFamily(printing);
  if (fam) {
    const hit = cands.find((s) => printingFamily(s.printing || s.variantLabel) === fam);
    if (hit) return hit;
  }
  // No printing given: the card's first (plain) version.
  return cands[0];
}

/**
 * Matches CSV rows to binder slots.
 * @param rows   parsed CSV rows (first row = header)
 * @param opts.defaultGame  game for rows that don't say
 * @param opts.getSetsInfo  (gameId) → Promise<setsInfo>
 * @param opts.onProgress   (done, total) while set lists load
 * @returns { slots, sets: [{ game, setId, name, count }], unmatched: [{ line, text, reason }], total }
 */
export async function matchImport(rows, { defaultGame, getSetsInfo, onProgress }) {
  const [header, ...body] = rows;
  const cols = detectColumns(header || []);
  if (cols.set == null && cols.productId == null) {
    throw new Error('Couldn’t find a “Set” column. The file needs at least the set and card number (or name) for each card.');
  }
  if (cols.number == null && cols.name == null && cols.productId == null) {
    throw new Error('Couldn’t find a card number or name column.');
  }
  const get = (r, f) => (cols[f] != null ? String(r[cols[f]] ?? '').trim() : '');

  // Group rows by game and set.
  const groups = new Map(); // `${game}|${setId}` → [{ row, line }]
  const unmatched = [];
  const finders = new Map();
  const finderFor = async (gameId) => {
    if (!finders.has(gameId)) finders.set(gameId, getSetsInfo(gameId).then((info) => ({ info, find: setFinder(info) })));
    return finders.get(gameId);
  };
  let total = 0;
  for (let i = 0; i < body.length; i++) {
    const r = body[i];
    const line = i + 2;
    const qty = get(r, 'qty');
    if (qty !== '' && !(parseFloat(qty) > 0)) continue; // listed with quantity 0
    total++;
    const text = [get(r, 'name'), get(r, 'set'), get(r, 'number')].filter(Boolean).join(' · ') || r.join(', ');
    const gameId = gameOf(get(r, 'game')) || (cols.game != null && get(r, 'game') ? null : defaultGame);
    if (!gameId) { unmatched.push({ line, text, reason: `Not a supported game (${get(r, 'game')})` }); continue; }
    const { find } = await finderFor(gameId);
    const setId = find(get(r, 'set'));
    if (!setId) { unmatched.push({ line, text, reason: get(r, 'set') ? 'Set not recognised' : 'No set given' }); continue; }
    const k = `${gameId}|${setId}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ r, line, text });
  }

  // Match each set's rows against its slots (one set's cards at a time).
  const slots = [];
  const sets = [];
  let done = 0;
  for (const [k, items] of groups) {
    const [gameId, setId] = k.split('|');
    const game = getGame(gameId);
    const { info } = await finderFor(gameId);
    onProgress?.(done++, groups.size);
    let setSlotList = [];
    try { setSlotList = await setSlots(game, setId, info, { variants: true }); } catch { /* reported below */ }
    let count = 0;
    for (const { r, line, text } of items) {
      const pid = get(r, 'productId');
      const number = get(r, 'number');
      const name = get(r, 'name');
      let cands = pid ? setSlotList.filter((s) => String(s.tcgplayerId) === pid) : [];
      if (!cands.length && number) cands = setSlotList.filter((s) => s.number != null && normNumber(s.number) === normNumber(number));
      if (!cands.length && name) cands = setSlotList.filter((s) => normName(s.name) === normName(name));
      const slot = pickSlot(cands, { name, printing: get(r, 'printing') });
      if (slot) { slots.push(slot); count++; } else unmatched.push({ line, text, reason: setSlotList.length ? 'Card not found in that set' : 'Couldn’t load that set' });
    }
    if (count) sets.push({ game: gameId, setId, name: info.names?.get(setId) || setId, count });
  }
  onProgress?.(groups.size, groups.size);
  // A card listed twice (e.g. two conditions) is one owned slot.
  const unique = [...new Map(slots.map((s) => [s.key, s])).values()];
  return { slots: unique, sets: sets.sort((a, b) => b.count - a.count), unmatched, total };
}
