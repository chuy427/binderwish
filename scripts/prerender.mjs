#!/usr/bin/env node
// Static, search-friendly pages, written after `vite build` (see package.json):
//
//   dist/sets.html                every Pokémon set, by series, with links       → /sets
//   dist/sets/<setId>.html        one set's master set checklist (cards, prices)  → /sets/<setId>
// (".html" files rather than folders: Cloudflare Pages serves them at the
// extension-less address with no redirect.)
//   dist/sitemap.xml, dist/robots.txt
//
// Each page is the app's own index.html with its own <title>, description,
// canonical link and social tags, plus the content as plain HTML inside #root —
// readable by search engines without running JavaScript. When the app loads it
// renders the same page (interactive) in its place. Data comes from the TCGPlayer
// catalog the build just synced (public/tcgplayer → dist/tcgplayer).

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

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const index = JSON.parse(await readFile(path.join(DIST, 'tcgplayer/pokemon/index.json'), 'utf8'));
  const meta = index.meta || {};
  const today = (index.generatedAt || new Date().toISOString()).slice(0, 10);
  const sets = [];

  for (const [setId, groups] of Object.entries(index.sets)) {
    const [released = '', series = '', name = '', logo = ''] = meta[setId] || [];
    if (!name) continue;
    const rows = [];
    for (const g of groups) {
      try { rows.push(...JSON.parse(await readFile(path.join(DIST, `tcgplayer/pokemon/g/${g}.json`), 'utf8'))); } catch {}
    }
    if (!rows.length) continue;
    rows.sort((a, b) => { const x = numKey(a[0]), y = numKey(b[0]); return x[0] - y[0] || x[1].localeCompare(y[1]); });
    const slots = rows.reduce((t, r) => t + Math.max(1, Object.keys(r[3] || {}).length), 0);
    sets.push({ setId, name, series, released, logo, cards: rows.length, slots });

    const url = `${SITE}${BASE}sets/${encodeURIComponent(setId)}`;
    const when = longDate(released);
    const title = `${name} master set checklist (${slots} cards & variants) | BinderWish`;
    const description = `Every card and variant in Pokémon ${name}${series ? ` (${series}${when ? `, ${released.slice(0, 4)}` : ''})` : ''} with today’s market prices. `
      + 'Check off what you own, see each card’s binder pocket, and print placeholders — free.';
    const table = rows.map((r) => {
      const versions = Object.entries(r[3] || {}).map(([p, price]) => `${esc(PRINTING[p] || p)}${price != null ? ` <span style="${S.muted}">${money(price)}</span>` : ''}`).join(' · ');
      return `<tr><td style="${S.td};white-space:nowrap">${esc(r[0])}</td><td style="${S.td}">${esc(cardName(r[2]))}</td><td style="${S.td}">${versions || '—'}</td></tr>`;
    }).join('');
    const body = `
<p style="margin:0"><a href="${BASE}sets" style="${S.link}">All Pokémon sets</a></p>
<p style="margin:16px 0 4px;${S.accent};font-weight:600">Pokémon${series ? ` · ${esc(series)} series` : ''}${when ? ` · Released ${esc(when)}` : ''}</p>
${logo ? `<img src="${esc(logo)}.webp" alt="${esc(name)} logo" style="max-height:90px;max-width:260px;display:block;margin:8px 0">` : ''}
<h1 style="font-size:32px;line-height:1.15;margin:8px 0">${esc(name)} master set checklist</h1>
<p style="${S.muted}">${esc(name)} has ${rows.length} cards and ${slots} master set slots once every version is counted — normal, reverse holo and special printings. Check off what you own, see the exact binder page and pocket for each card, and print real-size placeholders with a QR code to the card’s current price, free on BinderWish.</p>
<p><a href="${BASE}binder/${encodeURIComponent(setId)}" style="${S.link}">Open ${esc(name)} in the virtual binder</a></p>
<table style="${S.table}"><thead><tr><th style="${S.th}">No.</th><th style="${S.th}">Card</th><th style="${S.th}">Versions (market price)</th></tr></thead><tbody>${table}</tbody></table>
<p style="${S.muted};font-size:13px;margin-top:24px">Prices are TCGPlayer market prices, updated daily. Placeholders are binder fillers, not playable cards. Pokémon is a trademark of Nintendo, Creatures Inc. and GAME FREAK inc.; BinderWish isn’t affiliated with them.</p>`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BinderWish', item: `${SITE}${BASE}` },
        { '@type': 'ListItem', position: 2, name: 'Pokémon sets', item: `${SITE}${BASE}sets` },
        { '@type': 'ListItem', position: 3, name, item: url },
      ],
    };
    await mkdir(path.join(DIST, 'sets'), { recursive: true });
    await writeFile(path.join(DIST, 'sets', `${setId}.html`), page(template, { title, description, url, body, jsonLd }));
  }

  // All sets, newest first, grouped by series.
  sets.sort((a, b) => (b.released || '').localeCompare(a.released || ''));
  const bySeries = new Map();
  for (const s of sets) {
    if (!bySeries.has(s.series || 'Other')) bySeries.set(s.series || 'Other', []);
    bySeries.get(s.series || 'Other').push(s);
  }
  const list = [...bySeries].map(([series, ss]) => `<h2 style="font-size:20px;margin:28px 0 8px">${esc(series)}</h2><ul style="padding-left:20px;margin:0">${
    ss.map((s) => `<li><a href="${BASE}sets/${encodeURIComponent(s.setId)}" style="${S.link}">${esc(s.name)}</a> <span style="${S.muted}">· ${s.slots} cards & variants${s.released ? ` · ${esc(longDate(s.released))}` : ''}</span></li>`).join('')
  }</ul>`).join('');
  await writeFile(path.join(DIST, 'sets.html'), page(template, {
    title: 'Pokémon TCG master set checklists — every set | BinderWish',
    description: `Master set checklists for all ${sets.length} Pokémon TCG sets, with every card, variant and market price. Track your collection and print binder placeholders, free.`,
    url: `${SITE}${BASE}sets`,
    body: `<h1 style="font-size:32px;margin:0 0 8px">Pokémon TCG master set checklists</h1><p style="${S.muted}">Every card and variant in every set, with today’s market prices. Pick a set to see its full checklist.</p>${list}`,
  }));

  // Sitemap + robots.
  const urls = [
    [`${SITE}${BASE}`, today], [`${SITE}${BASE}sets`, today], [`${SITE}${BASE}binder`, today], [`${SITE}${BASE}privacy`, today],
    ...sets.map((s) => [`${SITE}${BASE}sets/${encodeURIComponent(s.setId)}`, today]),
  ];
  await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map(([u, d]) => `  <url><loc>${esc(u)}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${BASE}search\n\nSitemap: ${SITE}${BASE}sitemap.xml\n`);

  console.log(`[prerender] ${sets.length} set pages, sets index, sitemap (${urls.length} URLs), robots.txt`);
}

main().catch((e) => { console.error('[prerender] failed:', e); process.exit(1); });
