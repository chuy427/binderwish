#!/usr/bin/env node
// Static, search-friendly pages, written after `vite build` (see package.json):
//
//   dist/sets.html                every set of every game, by series, with links  → /sets
//   dist/sets/<setId>.html        one Pokémon set's master set checklist          → /sets/<setId>
//   dist/sets/<game>/<setId>.html a Lorcana / One Piece set's checklist          → /sets/lorcana/<setId>
// (".html" files rather than folders: Cloudflare Pages serves them at the
// extension-less address with no redirect.)
//   dist/picks.html, dist/picks/<slug>.html   BinderWish picks (from Supabase)  → /picks/<slug>
//   dist/sitemap.xml, dist/robots.txt
//
// Each page is the app's own index.html with its own <title>, description,
// canonical link and social tags, plus the content as plain HTML inside #root —
// readable by search engines without running JavaScript. When the app loads it
// renders the same page (interactive) in its place. Data comes from the TCGPlayer
// catalog the build just synced (public/tcgplayer → dist/tcgplayer), plus Lorcast
// for Lorcana's card list (those pages are skipped if it can't be reached).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITE = (process.env.SITE_URL || 'https://binderwish.com').replace(/\/$/, '');
const BASE = process.env.BASE_PATH || '/';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (n == null ? '' : `$${n.toFixed(2)}`);
const longDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};
const PRINTING = {
  'Reverse Holofoil': 'Reverse Holo', Holofoil: 'Holo', '1st Edition Holofoil': '1st Edition Holo',
  'Unlimited Holofoil': 'Unlimited Holo',
};
// "Fomantis - 003/084" → "Fomantis"
const cardName = (name) => name.replace(/\s+-\s+[\w/.-]+$/, '').trim();
const numKey = (n) => [parseInt(String(n).replace(/^\D+/, ''), 10) || 0, String(n)];

const S = {
  page: 'max-width:980px;margin:0 auto;padding:24px 16px 48px;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#F4F1EE',
  muted: 'color:#A9A4A0', accent: 'color:#FF6347', link: 'color:#FF6347',
  table: 'width:100%;border-collapse:collapse;font-size:14px;margin-top:16px',
  th: 'text-align:left;padding:8px;border-bottom:1px solid #333;color:#A9A4A0;font-weight:600',
  td: 'padding:6px 8px;border-bottom:1px solid #222;vertical-align:top',
};

function page(template, { title, description, url, body, jsonLd }) {
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="BinderWish">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${SITE}${BASE}og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta name="twitter:card" content="summary_large_image">`,
    jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ].join('\n  ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta (?:property="og:|name="twitter:)[^>]*>/g, '')
    .replace('</head>', `  ${head}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root"><main style="${S.page}">${body}</main></div>`);
}

const readJSON = async (file) => JSON.parse(await readFile(path.join(DIST, file), 'utf8'));
async function groupRows(game, groups) {
  const rows = [];
  for (const g of groups) {
    try { rows.push(...await readJSON(`tcgplayer/${game}/g/${g}.json`)); } catch {}
  }
  return rows;
}
// Printings in the app's order (Normal before foils), as [label, price].
const ORDER = ['1st Edition Holofoil', '1st Edition', 'Unlimited Holofoil', 'Unlimited', 'Normal', 'Holofoil', 'Foil', 'Reverse Holofoil', 'Cold Foil'];
const rank = (p) => { const i = ORDER.indexOf(p); return i < 0 ? 99 : i; };
const versionsOf = (prices) => Object.entries(prices || {}).sort(([a], [b]) => rank(a) - rank(b)).map(([p, price]) => [PRINTING[p] || p, price]);
const byNumber = (a, b) => { const x = numKey(a.num), y = numKey(b.num); return x[0] - y[0] || x[1].localeCompare(y[1]); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'BinderWish prerender' } });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (e) { if (i >= 3) throw e; await sleep(500 * i); }
  }
}

// Each game → its sets: { setId, name, series, released, logo, entries: [{ num, name, versions: [[label, price]] }] }.
async function pokemonSets() {
  const index = await readJSON('tcgplayer/pokemon/index.json');
  const out = [];
  for (const [setId, groups] of Object.entries(index.sets)) {
    const [released = '', series = '', name = '', logo = ''] = index.meta?.[setId] || [];
    if (!name) continue;
    const entries = (await groupRows('pokemon', groups)).map((r) => ({ num: r[0], name: cardName(r[2]), versions: versionsOf(r[3]) }));
    out.push({ setId, name, series, released, logo, entries });
  }
  return { sets: out, generatedAt: index.generatedAt };
}

// Lorcana: the card list comes from Lorcast (as in the app), prices from the catalog.
async function lorcanaSets() {
  const index = await readJSON('tcgplayer/lorcana/index.json');
  const { results } = await getJSON('https://api.lorcast.com/v0/sets');
  const out = [];
  for (const s of results) {
    const groups = index.sets?.[s.code];
    if (!groups) continue;
    await sleep(100); // Lorcast asks for 50–100ms between requests
    const cards = await getJSON(`https://api.lorcast.com/v0/sets/${encodeURIComponent(s.code)}/cards`);
    const products = new Map((await groupRows('lorcana', groups)).map((r) => [r[1], r]));
    const entries = cards.map((c) => ({
      num: c.collector_number,
      name: c.version ? `${c.name} – ${c.version}` : c.name,
      versions: versionsOf(products.get(c.tcgplayer_id)?.[3]),
    }));
    const main = /^\d+$/.test(s.code);
    out.push({ setId: s.code, name: s.name, series: main ? 'Main sets' : 'Promos & special', released: s.released_at || '', logo: '', entries });
  }
  return { sets: out };
}

// One Piece: the catalog is the card list — every product (Parallel, Manga, SP…) is its own card.
async function onePieceSets() {
  const index = await readJSON('tcgplayer/onepiece/index.json');
  const out = [];
  for (const s of index.setList || []) {
    const rows = await groupRows('onepiece', index.sets?.[s.id] || []);
    if (!rows.length) continue;
    const entries = rows.map((r) => ({
      num: r[0],
      name: r[2].replace(new RegExp(`\\s*-\\s*${r[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), '').replace(/\s*\(\d{1,3}\)/g, '').trim(),
      // Each product is one card; only a foil printing is worth naming.
      versions: versionsOf(r[3]).map(([label, price]) => [label === 'Normal' ? '' : label, price]),
    }));
    out.push({ setId: s.id, name: s.code ? `${s.name} (${s.code})` : s.name, series: s.kind || '', released: s.released || '', logo: '', entries });
  }
  return { sets: out };
}

const GAMES = [
  { id: 'pokemon', name: 'Pokémon', full: 'Pokémon TCG', load: pokemonSets,
    variantsNote: 'normal, reverse holo and special printings',
    trademark: 'Pokémon is a trademark of Nintendo, Creatures Inc. and GAME FREAK inc.' },
  { id: 'lorcana', name: 'Lorcana', full: 'Disney Lorcana', load: lorcanaSets,
    variantsNote: 'normal and cold foil printings, plus Enchanted cards',
    trademark: 'Disney Lorcana is a trademark of Disney; published by Ravensburger.' },
  { id: 'onepiece', name: 'One Piece', full: 'One Piece Card Game', load: onePieceSets,
    variantsNote: 'parallels, alternate arts, manga and SP cards',
    trademark: 'One Piece Card Game is a trademark of Bandai and Eiichiro Oda/Shueisha.' },
];
// Pokémon sets keep their original addresses (/sets/sv08.5); the others live under the game.
const setPath = (game, setId) => `sets/${game.id === 'pokemon' ? '' : `${game.id}/`}${encodeURIComponent(setId)}`;

// BinderWish picks (curated sets), from Supabase — anyone can read published ones.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tbissnuzjfjuvjwtseza.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_d9GuSWBWrka2KDNgUF1N0w_e0cAsznX';
async function loadPicks() {
  const select = 'slug,game,title,description,covers,card_count,updated_at,curator:curators(name,kind)';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/picks?select=${select}&published=eq.true&order=updated_at.desc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function writePicks(template) {
  let picks;
  try { picks = await loadPicks(); } catch (e) {
    console.warn(`[prerender] skipped pick pages: ${e.message}`);
    return [];
  }
  const gameName = (id) => GAMES.find((g) => g.id === id)?.full || id;
  const curatorOf = (p) => p.curator?.name || 'BinderWish';
  const covers = (p, h) => (p.covers || []).filter((c) => c.img).map((c) => `<img src="${esc(c.img)}" alt="" style="height:${h}px;border-radius:6px;margin-right:8px">`).join('');
  await mkdir(path.join(DIST, 'picks'), { recursive: true });
  for (const p of picks) {
    const url = `${SITE}${BASE}picks/${p.slug}`;
    const description = (p.description || `${p.title}: a curated ${gameName(p.game)} set to collect.`).slice(0, 300);
    const body = `
<p style="margin:0"><a href="${BASE}picks" style="${S.link}">All BinderWish picks</a></p>
<p style="margin:16px 0 4px;${S.accent};font-weight:600">${esc(gameName(p.game))} · BinderWish pick</p>
<h1 style="font-size:32px;line-height:1.15;margin:8px 0">${esc(p.title)}</h1>
<p>${esc(p.description || '')}</p>
<p style="${S.muted}">Curated by ${esc(curatorOf(p))} · ${p.card_count || 0} cards</p>
<p>${covers(p, 160)}</p>
<p>Collect this set on BinderWish: check off what you own, see every card’s binder pocket, take the missing cards to card shows, and print placeholders — free.</p>`;
    await writeFile(path.join(DIST, 'picks', `${p.slug}.html`), page(template, {
      title: `${p.title} — ${gameName(p.game)} collection checklist | BinderWish`, description, url, body,
    }));
  }
  const list = picks.map((p) => `<li><a href="${BASE}picks/${p.slug}" style="${S.link}">${esc(p.title)}</a> <span style="${S.muted}">· ${esc(gameName(p.game))} · ${p.card_count || 0} cards · by ${esc(curatorOf(p))}</span></li>`).join('');
  await writeFile(path.join(DIST, 'picks.html'), page(template, {
    title: 'BinderWish picks — curated sets to collect | BinderWish',
    description: 'Themed Pokémon, Lorcana and One Piece card collections put together by BinderWish and collectors we trust. Track them, see every card’s binder pocket, and print placeholders.',
    url: `${SITE}${BASE}picks`,
    body: `<h1 style="font-size:32px;margin:0 0 8px">BinderWish picks</h1><p style="${S.muted}">Themed sets worth a binder, put together by BinderWish and collectors we trust.</p><ul style="padding-left:20px">${list}</ul>`,
  }));
  return picks;
}

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  let today = new Date().toISOString().slice(0, 10);
  const all = [];

  for (const game of GAMES) {
    let loaded;
    try { loaded = await game.load(); } catch (e) {
      // Pokémon must build; the others only need the network (Lorcast) — skip them offline.
      if (game.id === 'pokemon') throw e;
      console.warn(`[prerender] skipped ${game.name} set pages: ${e.message}`);
      continue;
    }
    if (loaded.generatedAt) today = loaded.generatedAt.slice(0, 10);
    const sets = [];
    for (const set of loaded.sets) {
      const { setId, name, series, released, logo } = set;
      const entries = set.entries.slice().sort(byNumber);
      if (!entries.length) continue;
      const slots = entries.reduce((t, e) => t + Math.max(1, e.versions.length), 0);
      sets.push({ ...set, entries: undefined, cards: entries.length, slots });

      const url = `${SITE}${BASE}${setPath(game, setId)}`;
      const when = longDate(released);
      const title = `${name} master set checklist (${slots} cards & variants) | BinderWish`;
      const description = `Every card and variant in ${game.full} ${name}${series ? ` (${series}${when ? `, ${released.slice(0, 4)}` : ''})` : ''} with today’s market prices. `
        + 'Check off what you own, see each card’s binder pocket, and print placeholders — free.';
      const table = entries.map((e) => {
        const versions = e.versions.map(([label, price]) => [esc(label), price != null ? `<span style="${S.muted}">${money(price)}</span>` : ''].filter(Boolean).join(' ')).filter(Boolean).join(' · ');
        return `<tr><td style="${S.td};white-space:nowrap">${esc(e.num)}</td><td style="${S.td}">${esc(e.name)}</td><td style="${S.td}">${versions || '—'}</td></tr>`;
      }).join('');
      const binder = `${BASE}binder/${encodeURIComponent(setId)}${game.id === 'pokemon' ? '' : `?game=${game.id}`}`;
      const body = `
<p style="margin:0"><a href="${BASE}sets" style="${S.link}">All sets</a></p>
<p style="margin:16px 0 4px;${S.accent};font-weight:600">${esc(game.full)}${series ? ` · ${esc(series)}` : ''}${when ? ` · Released ${esc(when)}` : ''}</p>
${logo ? `<img src="${esc(logo)}.webp" alt="${esc(name)} logo" style="max-height:90px;max-width:260px;display:block;margin:8px 0">` : ''}
<h1 style="font-size:32px;line-height:1.15;margin:8px 0">${esc(name)} master set checklist</h1>
<p style="${S.muted}">${esc(name)} has ${entries.length} cards and ${slots} master set slots once every version is counted — ${game.variantsNote}. Check off what you own, see the exact binder page and pocket for each card, and print real-size placeholders with a QR code to the card’s current price, free on BinderWish.</p>
<p><a href="${binder}" style="${S.link}">Open ${esc(name)} in the virtual binder</a></p>
<table style="${S.table}"><thead><tr><th style="${S.th}">No.</th><th style="${S.th}">Card</th><th style="${S.th}">Versions (market price)</th></tr></thead><tbody>${table}</tbody></table>
<p style="${S.muted};font-size:13px;margin-top:24px">Prices are TCGPlayer market prices, updated daily. Placeholders are binder fillers, not playable cards. ${esc(game.trademark)} BinderWish isn’t affiliated with them.</p>`;
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'BinderWish', item: `${SITE}${BASE}` },
          { '@type': 'ListItem', position: 2, name: 'Sets', item: `${SITE}${BASE}sets` },
          { '@type': 'ListItem', position: 3, name, item: url },
        ],
      };
      const file = path.join(DIST, `${setPath(game, setId).split('/').map(decodeURIComponent).join('/')}.html`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, page(template, { title, description, url, body, jsonLd }));
    }
    sets.sort((a, b) => (b.released || '').localeCompare(a.released || ''));
    all.push({ game, sets });
  }

  // All sets, per game, newest first, grouped by series.
  const sections = all.map(({ game, sets }) => {
    const bySeries = new Map();
    for (const s of sets) {
      if (!bySeries.has(s.series || 'Other')) bySeries.set(s.series || 'Other', []);
      bySeries.get(s.series || 'Other').push(s);
    }
    return `<h2 style="font-size:26px;margin:40px 0 0">${esc(game.full)}</h2>${[...bySeries].map(([series, ss]) => `<h3 style="font-size:18px;margin:20px 0 8px">${esc(series)}</h3><ul style="padding-left:20px;margin:0">${
      ss.map((s) => `<li><a href="${BASE}${setPath(game, s.setId)}" style="${S.link}">${esc(s.name)}</a> <span style="${S.muted}">· ${s.slots} cards & variants${s.released ? ` · ${esc(longDate(s.released))}` : ''}</span></li>`).join('')
    }</ul>`).join('')}`;
  }).join('');
  const total = all.reduce((t, g) => t + g.sets.length, 0);
  const names = all.map((g) => g.game.name);
  const gameList = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  await writeFile(path.join(DIST, 'sets.html'), page(template, {
    title: `Master set checklists — ${gameList} | BinderWish`,
    description: `Master set checklists for ${total} ${gameList} sets, with every card, variant and market price. Track your collection and print binder placeholders, free.`,
    url: `${SITE}${BASE}sets`,
    body: `<h1 style="font-size:32px;margin:0 0 8px">Master set checklists</h1><p style="${S.muted}">Every card and variant in every ${gameList} set, with today’s market prices. Pick a set to see its full checklist.</p>${sections}`,
  }));

  const picks = await writePicks(template);

  // Sitemap + robots.
  const urls = [
    [`${SITE}${BASE}`, today], [`${SITE}${BASE}sets`, today], [`${SITE}${BASE}binder`, today], [`${SITE}${BASE}privacy`, today],
    ...all.flatMap(({ game, sets }) => sets.map((s) => [`${SITE}${BASE}${setPath(game, s.setId)}`, today])),
    ...(picks.length ? [[`${SITE}${BASE}picks`, today]] : []),
    ...picks.map((p) => [`${SITE}${BASE}picks/${p.slug}`, (p.updated_at || today).slice(0, 10)]),
  ];
  await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map(([u, d]) => `  <url><loc>${esc(u)}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${BASE}search\n\nSitemap: ${SITE}${BASE}sitemap.xml\n`);

  console.log(`[prerender] ${all.map((g) => `${g.sets.length} ${g.game.name}`).join(', ')} set pages, ${picks.length} picks, sets index, sitemap (${urls.length} URLs), robots.txt`);
}

main().catch((e) => { console.error('[prerender] failed:', e); process.exit(1); });
