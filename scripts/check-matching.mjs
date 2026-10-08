#!/usr/bin/env node
// Nightly card-matching check: runs the site's own card ↔ TCGPlayer matching
// (src/lib/match.js) over every Pokémon and Lorcana set and reports what looks wrong:
//
//   duplicate   two different cards matched to the same TCGPlayer product (they'd
//               share art, price and owned status — e.g. reprint sets numbered
//               differently on TCGdex and TCGPlayer)
//   mismatch    a card matched to a product with a clearly different name
//   unmatched   cards in a recent set (released in the last 6 months) with no
//               product — no price, link or (often) art
//
// Reads the catalog the build just synced (public/tcgplayer) and the card lists
// from TCGdex / Lorcast. Writes a Markdown report (--out) and, in GitHub Actions,
// `problems=<n>` to $GITHUB_OUTPUT. Always exits 0: it reports, never blocks.
// Known, accepted cases go in scripts/check-matching-ignore.json
// (["setId"] skips a set, ["setId#number"] one card).

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchByNumberAndName, normName } from '../src/lib/match.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'public', 'tcgplayer');
const RECENT_DAYS = 183;
const args = process.argv.slice(2);
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const only = args.includes('--set') ? args[args.indexOf('--set') + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'BinderWish matching check' } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (i >= 5) throw e;
      await sleep(2000 * i); // TCGdex has the odd 503 — give it a moment
    }
  }
}
const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'));
async function groupRows(game, groups) {
  const rows = [];
  for (const g of groups || []) {
    try { rows.push(...await readJSON(path.join(CATALOG, game, 'g', `${g}.json`))); } catch {}
  }
  return rows.filter((r) => r[3] && typeof r[3] === 'object');
}
// Same card, possibly named a little differently: "Empoleon" / "Empoleon LV.X",
// "δ Rainbow Energy" / "Delta Rainbow Energy", "Horror Psychic Energy" / "Horror P
// Energy", "Impostor" / "Imposter". Different cards ("Lightning Energy" / "Fighting
// Energy") still differ.
const bigrams = (s) => { const out = []; for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2)); return out; };
function sameName(a, b) {
  const x = normName(a), y = normName(b);
  if (!x || !y || x === y || x.includes(y) || y.includes(x)) return true;
  let prefix = 0;
  while (prefix < Math.min(x.length, y.length) && x[prefix] === y[prefix]) prefix++;
  if (prefix >= 5) return true;
  const bx = bigrams(x), by = bigrams(y);
  const pool = [...by];
  let common = 0;
  for (const g of bx) { const i = pool.indexOf(g); if (i >= 0) { common++; pool.splice(i, 1); } }
  return prefix >= 2 && (2 * common) / (bx.length + by.length) >= 0.6;
}
// "28" and "28a": an alternate version TCGPlayer sells as the same product.
const baseNumber = (n) => String(n).toLowerCase().replace(/[a-z]$/, '');
const isRecent = (iso) => iso && Date.now() - new Date(iso).getTime() < RECENT_DAYS * 864e5;

// One set's cards → problems. cards: [{ number, name, matchName, product }]
function checkSet(cards) {
  const problems = [];
  const byProduct = new Map();
  for (const c of cards) {
    if (!c.product) continue;
    if (!byProduct.has(c.product[1])) byProduct.set(c.product[1], []);
    byProduct.get(c.product[1]).push(c);
    if (!sameName(c.matchName, c.product[2])) {
      problems.push({ kind: 'mismatch', number: c.number, text: `#${c.number} ${c.name} → TCGPlayer “${c.product[2]}” (${c.product[0]})` });
    }
  }
  for (const [, list] of byProduct) {
    if (list.length < 2) continue;
    if (new Set(list.map((c) => baseNumber(c.number))).size === 1) continue;
    const p = list[0].product;
    problems.push({ kind: 'duplicate', number: list[0].number, text: `${list.map((c) => `#${c.number} ${c.name}`).join(', ')} → all matched to “${p[2]}” (${p[0]})` });
  }
  return problems;
}

async function pokemon(ignore) {
  const index = await readJSON(path.join(CATALOG, 'pokemon', 'index.json'));
  const out = [];
  for (const [setId, groups] of Object.entries(index.sets)) {
    if (only && setId !== only) continue;
    if (ignore.has(setId)) continue;
    const [released = '', , name = setId] = index.meta?.[setId] || [];
    let data;
    try { data = await getJSON(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(setId)}`); } catch (e) {
      out.push({ game: 'Pokémon', setId, name, problems: [{ kind: 'error', text: `Couldn’t load from TCGdex (${e.message})` }] });
      continue;
    }
    const rows = await groupRows('pokemon', groups);
    const list = (data.cards || []).map((c) => ({ number: c.localId, name: c.name, image: c.image }));
    const cards = list.map((c) => ({ ...c, matchName: c.name, product: matchByNumberAndName(rows, c.number, c.name, list)[0] || null }));
    const problems = checkSet(cards);
    if (isRecent(released)) {
      const missing = cards.filter((c) => !c.product);
      if (missing.length) problems.push({ kind: 'unmatched', text: `${missing.length} of ${cards.length} cards have no TCGPlayer product${missing.some((c) => !c.image) ? ' (some have no art either)' : ''}: ${missing.slice(0, 12).map((c) => `#${c.number} ${c.name}`).join(', ')}${missing.length > 12 ? ', …' : ''}` });
    }
    out.push({ game: 'Pokémon', setId, name, problems });
  }
  return out;
}

async function lorcana(ignore) {
  const index = await readJSON(path.join(CATALOG, 'lorcana', 'index.json'));
  const { results } = await getJSON('https://api.lorcast.com/v0/sets');
  const out = [];
  for (const s of results) {
    const groups = index.sets?.[s.code];
    if (!groups || ignore.has(`lorcana:${s.code}`) || (only && only !== `lorcana:${s.code}`)) continue;
    await sleep(100); // Lorcast asks for 50–100ms between requests
    let list;
    try { list = await getJSON(`https://api.lorcast.com/v0/sets/${encodeURIComponent(s.code)}/cards`); } catch (e) {
      out.push({ game: 'Lorcana', setId: `lorcana:${s.code}`, name: s.name, problems: [{ kind: 'error', text: `Couldn’t load from Lorcast (${e.message})` }] });
      continue;
    }
    const rows = await groupRows('lorcana', groups);
    // As in src/games/lorcana.js: Lorcast's own product id first, then number + name.
    const cards = list.map((c) => {
      const exact = c.tcgplayer_id ? rows.find((r) => r[1] === c.tcgplayer_id) : null;
      const full = c.version ? `${c.name} - ${c.version}` : c.name;
      return {
        number: c.collector_number, name: full, matchName: c.name, image: c.image_uris?.digital?.small,
        product: exact || matchByNumberAndName(rows, c.collector_number, full)[0] || null,
      };
    });
    const problems = checkSet(cards);
    if (isRecent(s.released_at)) {
      const missing = cards.filter((c) => !c.product);
      if (missing.length) problems.push({ kind: 'unmatched', text: `${missing.length} of ${cards.length} cards have no TCGPlayer product: ${missing.slice(0, 12).map((c) => `#${c.number} ${c.name}`).join(', ')}${missing.length > 12 ? ', …' : ''}` });
    }
    out.push({ game: 'Lorcana', setId: `lorcana:${s.code}`, name: s.name, problems });
  }
  return out;
}

async function main() {
  let ignoreList = [];
  try { ignoreList = await readJSON(path.join(ROOT, 'scripts', 'check-matching-ignore.json')); } catch {}
  const ignore = new Set(ignoreList.filter((x) => !x.includes('#')));
  const ignoreCards = new Set(ignoreList.filter((x) => x.includes('#')));

  const sets = [...await pokemon(ignore), ...await lorcana(ignore)]
    .map((s) => ({ ...s, problems: s.problems.filter((p) => !p.number || !ignoreCards.has(`${s.setId}#${p.number}`)) }));
  // Sets that couldn't be checked (source down) are listed, but aren't problems.
  const failed = sets.filter((s) => s.problems.some((p) => p.kind === 'error'));
  const bad = sets.filter((s) => s.problems.some((p) => p.kind !== 'error'))
    .map((s) => ({ ...s, problems: s.problems.filter((p) => p.kind !== 'error') }));
  const count = bad.reduce((t, s) => t + s.problems.length, 0);

  const label = { duplicate: 'Duplicate', mismatch: 'Wrong card?', unmatched: 'Unmatched', error: 'Error' };
  const lines = [
    `Checked ${sets.length} sets (${sets.filter((s) => s.game === 'Pokémon').length} Pokémon, ${sets.filter((s) => s.game === 'Lorcana').length} Lorcana) on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    count ? `**${count} problem${count === 1 ? '' : 's'} in ${bad.length} set${bad.length === 1 ? '' : 's'}:**` : '**No problems found.**',
    '',
  ];
  for (const s of bad) {
    lines.push(`### ${s.game} · ${s.name} (\`${s.setId}\`)`);
    for (const p of s.problems.slice(0, 40)) lines.push(`- **${label[p.kind]}:** ${p.text}`);
    if (s.problems.length > 40) lines.push(`- …and ${s.problems.length - 40} more`);
    lines.push('');
  }
  if (failed.length) lines.push(`Couldn’t check ${failed.length} set${failed.length === 1 ? '' : 's'} (source unavailable): ${failed.map((s) => s.name).join(', ')}.`, '');
  lines.push('<sub>From scripts/check-matching.mjs. Accepted cases can be listed in scripts/check-matching-ignore.json.</sub>');
  const report = lines.join('\n');

  if (outFile) await writeFile(outFile, report);
  else console.log(report);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `problems=${count}\n`);
  console.error(`[check-matching] ${sets.length} sets, ${count} problems`);
}

main().catch(async (e) => {
  console.error('[check-matching] failed:', e);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'problems=error\n');
});
