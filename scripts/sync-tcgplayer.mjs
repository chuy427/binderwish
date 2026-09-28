#!/usr/bin/env node
// Builds static card → TCGPlayer-product lookups from tcgcsv.com (a daily mirror
// of TCGPlayer's catalog), one per game. Needed because the card-data APIs don't
// link every card/variant to TCGPlayer (and don't carry per-printing prices), and
// neither TCGPlayer nor tcgcsv allow cross-origin requests from the browser.
//
// Output (served as static files), per game (pokemon, lorcana, onepiece):
//   public/tcgplayer/<game>/index.json        { generatedAt, sets: { <setId>: [groupId, ...] } }
//   public/tcgplayer/<game>/g/<groupId>.json  [[number, productId, name, { <printing>: marketPrice|null }], ...]
//     setId    = the card-data API's set id (TCGdex for Pokémon, Lorcast set code for Lorcana)
//     printing = TCGPlayer sub-type: "Normal", "Holofoil", "Reverse Holofoil", "Cold Foil", …
//
// Run: npm run sync-tcgplayer   (also runs automatically before every `npm run build`;
//      `--if-missing` only syncs when no catalog exists yet — used by `npm run dev`)

import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TCGCSV = 'https://tcgcsv.com/tcgplayer';
const TCGDEX = 'https://api.tcgdex.net/v2/en';
const LORCAST = 'https://api.lorcast.com/v0';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tcgplayer');
const CONCURRENCY = 4;

async function getJSON(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'BinderWish catalog sync' } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// Downloads every group's products + prices for a TCGPlayer category into
// <out>/g/, keeping only single cards (ones with a Number).
async function downloadCategory(category, out) {
  const { results: groups } = await getJSON(`${TCGCSV}/${category}/groups`);
  await mkdir(path.join(out, 'g'), { recursive: true });
  const productToGroup = new Map();
  let cardCount = 0;
  await mapLimit(groups, CONCURRENCY, async (g, i) => {
    const [products, prices] = await Promise.all([
      getJSON(`${TCGCSV}/${category}/${g.groupId}/products`),
      getJSON(`${TCGCSV}/${category}/${g.groupId}/prices`).catch(() => ({ results: [] })),
    ]);
    const market = new Map();
    for (const p of prices.results || []) {
      // One entry per printing (Normal / Holofoil / Reverse Holofoil / Cold Foil…) — each is
      // its own slot in a master set and has its own price.
      if (!market.has(p.productId)) market.set(p.productId, {});
      market.get(p.productId)[p.subTypeName] = p.marketPrice ?? p.midPrice ?? null;
    }
    const rows = [];
    for (const p of products.results || []) {
      const num = p.extendedData?.find((d) => d.name === 'Number')?.value;
      if (!num) continue; // sealed product, code card, etc.
      rows.push([num, p.productId, p.name, market.get(p.productId) || {}]);
      productToGroup.set(p.productId, g.groupId);
    }
    cardCount += rows.length;
    if (rows.length) await writeFile(path.join(out, 'g', `${g.groupId}.json`), JSON.stringify(rows));
    g.cardRows = rows.length;
    if ((i + 1) % 50 === 0) console.log(`  …${i + 1}/${groups.length} groups`);
  });
  return { groups, withCards: groups.filter((g) => g.cardRows > 0), productToGroup, cardCount };
}

async function writeIndex(out, sets) {
  await writeFile(path.join(out, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sets }));
}

// ---------------------------------------------------------------- Pokémon (TCGdex)

// Hand-fixes for sets whose names differ too much to match automatically.
// tcgdexSetId -> [tcgplayer groupId, ...]
const POKEMON_OVERRIDES = {
  '30th-c': [24837], // ME: 30th Celebration Classic Collection
  bwp: [1407],       // Black and White Promos
  dpp: [1421],       // Diamond and Pearl Promos
  xyp: [1451],       // XY Promos
  rc: [1465],        // Legendary Treasures: Radiant Collection
  mfb: [23330],      // My First Battle
};
// Subsets TCGPlayer lists as their own group but TCGdex folds into the main set.
const SUBSET_SUFFIXES = ['galariangallery', 'shinyvault', 'trainergallery', 'radiantcollection'];

// "SV03: Obsidian Flames" -> "obsidianflames"; "Pokémon GO" -> "pokemongo"
function normalize(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^[A-Za-z0-9 .]{1,10}:\s*/, '')   // TCGPlayer series prefix like "SV: " / "SWSH12: " / "ME: "
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

async function syncPokemon() {
  const out = path.join(OUT, 'pokemon');
  const [cat, tcgdexSets] = await Promise.all([downloadCategory(3, out), getJSON(`${TCGDEX}/sets`)]);
  const { withCards, productToGroup } = cat;

  // Match TCGdex sets to TCGPlayer groups by normalized name.
  const byNorm = new Map();
  for (const g of withCards) {
    for (const k of new Set([normalize(g.name), normalize(g.name.replace(/^EX /, ''))])) {
      if (!byNorm.has(k)) byNorm.set(k, []);
      byNorm.get(k).push(g.groupId);
    }
  }
  const sets = {};
  const unmatched = [];
  for (const s of tcgdexSets) {
    if (POKEMON_OVERRIDES[s.id]) { sets[s.id] = POKEMON_OVERRIDES[s.id]; continue; }
    const k = normalize(s.name);
    const ids = new Set(byNorm.get(k) || []);
    // Subsets TCGPlayer lists separately but TCGdex folds into the main set
    // (e.g. "Crown Zenith: Galarian Gallery", "Shining Fates: Shiny Vault", "Generations: Radiant Collection").
    for (const g of withCards) {
      const gk = normalize(g.name);
      if (ids.size && SUBSET_SUFFIXES.some((suf) => gk === k + suf)) ids.add(g.groupId);
    }
    if (ids.size) sets[s.id] = [...ids];
    else unmatched.push(s);
  }

  // Fallback for sets whose names don't line up: look up a few of the set's cards on
  // TCGdex, and if any carry a TCGPlayer product id, use that product's group.
  const series = await getJSON(`${TCGDEX}/series/tcgp`).catch(() => ({ sets: [] }));
  const pocket = new Set((series.sets || []).map((s) => s.id));
  const stillUnmatched = [];
  await mapLimit(unmatched.filter((s) => !pocket.has(s.id)), CONCURRENCY, async (s) => {
    const set = await getJSON(`${TCGDEX}/sets/${encodeURIComponent(s.id)}`).catch(() => null);
    const cards = set?.cards || [];
    const sample = cards.filter((_, i) => i % Math.max(1, Math.floor(cards.length / 6)) === 0).slice(0, 6);
    // Majority vote: a stray variant can point at an unrelated group (jumbo cards, deck exclusives…).
    const votes = new Map();
    for (const c of sample) {
      const d = await getJSON(`${TCGDEX}/cards/${encodeURIComponent(c.id)}`).catch(() => null);
      const id = d?.thirdParty?.tcgplayer || d?.variants_detailed?.find((v) => v.thirdParty?.tcgplayer)?.thirdParty.tcgplayer;
      const gid = productToGroup.get(id);
      if (gid) votes.set(gid, (votes.get(gid) || 0) + 1);
    }
    const best = [...votes].sort((a, b) => b[1] - a[1])[0];
    if (best) sets[s.id] = [best[0]];
    else stillUnmatched.push(`${s.id} (${s.name})`);
  });

  await writeIndex(out, sets);
  return { ...cat, matched: Object.keys(sets).length, total: tcgdexSets.length - pocket.size, unmatched: stillUnmatched };
}

// ---------------------------------------------------------------- Lorcana (Lorcast)

// Lorcast gives every card its TCGPlayer product id, so a set's groups are simply
// whichever groups its cards' products live in — no name matching needed.
async function syncLorcana() {
  const out = path.join(OUT, 'lorcana');
  const cat = await downloadCategory(71, out);
  const { results: lorcastSets } = await getJSON(`${LORCAST}/sets`);
  const sets = {};
  const unmatched = [];
  for (const s of lorcastSets) {
    await sleep(100); // Lorcast asks for 50–100ms between requests
    const cards = await getJSON(`${LORCAST}/sets/${encodeURIComponent(s.code)}/cards`).catch(() => []);
    const votes = new Map();
    for (const c of cards) {
      const gid = cat.productToGroup.get(c.tcgplayer_id);
      if (gid) votes.set(gid, (votes.get(gid) || 0) + 1);
    }
    if (votes.size) {
      sets[s.code] = [...votes].sort((a, b) => b[1] - a[1]).map(([g]) => g);
      continue;
    }
    // Brand-new sets often have no TCGPlayer ids on Lorcast yet — match the group by
    // name so the set works as soon as TCGPlayer lists it (cards then match by number).
    const byName = cat.withCards.filter((g) => normalize(g.name) === normalize(s.name)).map((g) => g.groupId);
    if (byName.length) sets[s.code] = byName;
    else unmatched.push(`${s.code} (${s.name})`);
  }
  await writeIndex(out, sets);
  return { ...cat, matched: Object.keys(sets).length, total: lorcastSets.length, unmatched };
}

// ---------------------------------------------------------------- One Piece (catalog only)

// One Piece has no separate card-data API here: the TCGPlayer catalog *is* the
// card list (every variant is its own product with its own image). Each group is
// a set; the index also carries the set list and a small name index for search.
function onePieceKind(abbr, name) {
  if (/\bRE\b|\bANN\b|release event|tournament cards/i.test(`${abbr} ${name}`)) return 'Other';
  if (/^OP\d/.test(abbr)) return 'Booster';
  if (/^(EB|PRB)/.test(abbr)) return 'Extra & Premium';
  if (/^ST/.test(abbr)) return 'Starter Deck';
  return 'Other';
}

// "Mr.1 (Daz.Bonez) - OP14-062 (SP) [Winner]" -> "mr.1" (for the search index)
const opBaseName = (name) => name.replace(/\s+-\s+\S+-\S+/, '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

// TCGPlayer lists brand-new sets (and their prices) before it has any card images.
// Sample a few products per set: "imagesReady" when most of the sample loads.
const OP_IMG = 'https://tcgplayer-cdn.tcgplayer.com/product';
async function imagesReady(rows) {
  const n = Math.min(4, rows.length);
  if (!n) return false;
  const sample = Array.from({ length: n }, (_, i) => rows[Math.floor((i * rows.length) / n)][1]);
  const ok = await Promise.all(sample.map((id) =>
    fetch(`${OP_IMG}/${id}_200w.jpg`, { method: 'HEAD' }).then((r) => r.ok).catch(() => false)));
  return ok.filter(Boolean).length > n / 2;
}

async function syncOnePiece() {
  const out = path.join(OUT, 'onepiece');
  const cat = await downloadCategory(68, out);
  const sets = {};
  const setList = [];
  const names = new Map(); // base name -> Set(groupId)
  const rowsByGroup = new Map();
  for (const g of cat.withCards) rowsByGroup.set(g.groupId, JSON.parse(await readFile(path.join(out, 'g', `${g.groupId}.json`), 'utf8')));
  const ready = new Map();
  await mapLimit(cat.withCards, 8, async (g) => ready.set(g.groupId, await imagesReady(rowsByGroup.get(g.groupId))));
  for (const g of cat.withCards) {
    const id = String(g.groupId);
    sets[id] = [g.groupId];
    setList.push({
      id, name: g.name, code: g.abbreviation || '', released: g.publishedOn || '',
      kind: onePieceKind(g.abbreviation || '', g.name),
      imagesReady: ready.get(g.groupId),
    });
    const rows = rowsByGroup.get(g.groupId);
    for (const r of rows) {
      const n = opBaseName(r[2]);
      if (!names.has(n)) names.set(n, new Set());
      names.get(n).add(g.groupId);
    }
  }
  await writeFile(path.join(out, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sets, setList }));
  await writeFile(path.join(out, 'search.json'), JSON.stringify([...names].map(([n, gs]) => [n, [...gs]])));
  const pending = setList.filter((x) => !x.imagesReady).map((x) => `${x.code} (${x.name}) — no images yet`);
  return { ...cat, matched: setList.length, total: cat.groups.length, unmatched: pending, unmatchedLabel: 'sets without images yet' };
}

// ----------------------------------------------------------------

const GAMES = { pokemon: syncPokemon, lorcana: syncLorcana, onepiece: syncOnePiece };

async function main() {
  if (process.argv.includes('--if-missing')) {
    try {
      await Promise.all(Object.keys(GAMES).map((g) => access(path.join(OUT, g, 'index.json'))));
      return;
    } catch { /* not built yet — sync now */ }
  }
  await rm(OUT, { recursive: true, force: true });
  for (const [game, sync] of Object.entries(GAMES)) {
    const started = Date.now();
    console.log(`\n[${game}] syncing…`);
    const r = await sync();
    console.log(`[${game}] ${r.cardCount} cards across ${r.withCards.length} groups; matched ${r.matched}/${r.total} sets in ${((Date.now() - started) / 1000).toFixed(0)}s.`);
    if (r.unmatched.length) console.log(`[${game}] ${r.unmatchedLabel || 'unmatched'} (${r.unmatched.length}):\n  ${r.unmatched.sort().join('\n  ')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
