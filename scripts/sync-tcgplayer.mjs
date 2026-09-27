#!/usr/bin/env node
// Builds a static TCGdex-card → TCGPlayer-product lookup from tcgcsv.com (a daily
// mirror of TCGPlayer's catalog). Needed because TCGdex hasn't linked every card
// to TCGPlayer (especially new sets), and neither TCGPlayer nor tcgcsv allow
// cross-origin requests, so the browser can't query them directly.
//
// Output (served as static files):
//   public/tcgplayer/index.json        { generatedAt, sets: { <tcgdexSetId>: [groupId, ...] } }
//   public/tcgplayer/g/<groupId>.json  [[number, productId, name, marketPrice|null], ...]
//
// Run: npm run sync-tcgplayer   (also runs automatically before every `npm run build`;
//      `--if-missing` only syncs when no catalog exists yet — used by `npm run dev`)

import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const POKEMON_CATEGORY = 3;
const TCGCSV = `https://tcgcsv.com/tcgplayer/${POKEMON_CATEGORY}`;
const TCGDEX = 'https://api.tcgdex.net/v2/en';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tcgplayer');
const CONCURRENCY = 4;

// Hand-fixes for sets whose names differ too much to match automatically.
// tcgdexSetId -> [tcgplayer groupId, ...]
const OVERRIDES = {
  "30th-c": [24837], // ME: 30th Celebration Classic Collection
  bwp: [1407],       // Black and White Promos
  dpp: [1421],       // Diamond and Pearl Promos
  xyp: [1451],       // XY Promos
  rc: [1465],        // Legendary Treasures: Radiant Collection
  mfb: [23330],      // My First Battle
};
// Subsets TCGPlayer lists as their own group but TCGdex folds into the main set.
const SUBSET_SUFFIXES = ["galariangallery", "shinyvault", "trainergallery", "radiantcollection"];

async function getJSON(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Proxydex catalog sync' } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

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

// "SV03: Obsidian Flames" -> "obsidianflames"; "Pokémon GO" -> "pokemongo"
function normalize(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^[A-Za-z0-9 .]{1,10}:\s*/, '')   // TCGPlayer series prefix like "SV: " / "SWSH12: " / "ME: "
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

// "158/128" -> "158"; "TG01/TG30" -> "tg1"; "SWSH001" -> "swsh1"; "025" -> "25"
export function normNumber(n) {
  return String(n).split('/')[0].trim().toLowerCase().replace(/^([a-z-]*)0+(?=\d)/, '$1');
}

async function main() {
  if (process.argv.includes("--if-missing")) {
    try { await access(path.join(OUT, "index.json")); return; } catch { /* not built yet — sync now */ }
  }
  const started = Date.now();
  console.log('Fetching TCGPlayer groups and TCGdex sets…');
  const [{ results: groups }, tcgdexSets] = await Promise.all([
    getJSON(`${TCGCSV}/groups`),
    getJSON(`${TCGDEX}/sets`),
  ]);
  console.log(`${groups.length} TCGPlayer groups, ${tcgdexSets.length} TCGdex sets`);

  // Download every group's products + prices and keep only single cards (ones with a Number).
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'g'), { recursive: true });
  const productToGroup = new Map();
  let cardCount = 0;
  await mapLimit(groups, CONCURRENCY, async (g, i) => {
    const [products, prices] = await Promise.all([
      getJSON(`${TCGCSV}/${g.groupId}/products`),
      getJSON(`${TCGCSV}/${g.groupId}/prices`).catch(() => ({ results: [] })),
    ]);
    const market = new Map();
    for (const p of prices.results || []) {
      // A product can have several printings (Normal / Holofoil / Reverse); keep the highest market price.
      if (p.marketPrice != null && !(market.get(p.productId) >= p.marketPrice)) market.set(p.productId, p.marketPrice);
    }
    const rows = [];
    for (const p of products.results || []) {
      const num = p.extendedData?.find((d) => d.name === 'Number')?.value;
      if (!num) continue; // sealed product, code card, etc.
      rows.push([num, p.productId, p.name, market.get(p.productId) ?? null]);
      productToGroup.set(p.productId, g.groupId);
    }
    cardCount += rows.length;
    if (rows.length) await writeFile(path.join(OUT, 'g', `${g.groupId}.json`), JSON.stringify(rows));
    g.cardRows = rows.length;
    if ((i + 1) % 25 === 0) console.log(`  …${i + 1}/${groups.length} groups`);
  });
  const withCards = groups.filter((g) => g.cardRows > 0);

  // Match TCGdex sets to TCGPlayer groups by normalized name.
  const byNorm = new Map();
  for (const g of withCards) {
    for (const k of new Set([normalize(g.name), normalize(g.name.replace(/^EX /, ""))])) {
      if (!byNorm.has(k)) byNorm.set(k, []);
      byNorm.get(k).push(g.groupId);
    }
  }
  const sets = {};
  const unmatched = [];
  for (const s of tcgdexSets) {
    if (OVERRIDES[s.id]) { sets[s.id] = OVERRIDES[s.id]; continue; }
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

  await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sets }));
  console.log(`\nWrote ${cardCount} cards across ${withCards.length} groups; matched ${Object.keys(sets).length}/${tcgdexSets.length - pocket.size} TCGdex sets in ${((Date.now() - started) / 1000).toFixed(0)}s.`);
  if (stillUnmatched.length) {
    console.log(`Unmatched (${stillUnmatched.length}) — add to OVERRIDES if they matter:\n  ${stillUnmatched.sort().join('\n  ')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
