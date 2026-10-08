#!/usr/bin/env node
// Nightly price alerts: compares every active alert (supabase/alerts.sql) with the
// TCGPlayer prices the build just synced (public/tcgplayer), emails each collector
// one digest of the alerts that were reached (via Resend), and marks those alerts
// "hit" so they pause until re-armed.
//
//   SUPABASE_URL          https://<project>.supabase.co
//   SUPABASE_SECRET_KEY   the project's secret (service-role) key — reads every
//                         collector's alerts and email address; never in the site
//   RESEND_API_KEY        sends the emails
//   --dry                 report what would be sent; send and change nothing
//
// Never fails the deploy: problems are logged and the step ends normally.

import { appendFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'public', 'tcgplayer');
const SITE = 'https://binderwish.com';
const FROM = 'BinderWish <noreply@binderwish.com>';
const DRY = process.argv.includes('--dry');
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SECRET_KEY || '';
const RESEND = process.env.RESEND_API_KEY || '';

const log = (...a) => console.log('[alerts]', ...a);
const summary = async (text) => { if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${text}\n`); };

// Supabase with the secret key (bypasses row-level security, by design).
async function sb(pathAndQuery, init = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json', ...init.headers };
  // Legacy service-role keys are JWTs and go in Authorization too; new sb_secret_ keys don't.
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`;
  const res = await fetch(`${URL_}${pathAndQuery}`, { ...init, headers });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${pathAndQuery.split('?')[0]}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// productId → { printing: price } for one game, from the synced catalog.
const priceCache = new Map();
export async function pricesFor(game) {
  if (priceCache.has(game)) return priceCache.get(game);
  const map = new Map();
  const dir = path.join(CATALOG, game, 'g');
  for (const f of await readdir(dir).catch(() => [])) {
    try {
      for (const r of JSON.parse(await readFile(path.join(dir, f), 'utf8'))) if (r[3] && typeof r[3] === 'object') map.set(Number(r[1]), r[3]);
    } catch {}
  }
  priceCache.set(game, map);
  return map;
}
export const priceOf = (prices, printing) => (prices ? prices[printing] ?? Object.values(prices).find((v) => v != null) ?? null : null);

const usd = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tcgUrl = (a) => `https://www.tcgplayer.com/product/${a.product_id}${a.printing ? `?Printing=${encodeURIComponent(a.printing).replace(/%20/g, '+')}` : ''}`;

export function email(hits, token) {
  const n = hits.length;
  const subject = n === 1 ? `Price alert: ${hits[0].a.card_name} is now ${usd(hits[0].price)}` : `${n} of your price alerts were reached`;
  const rows = hits.map(({ a, price, dir }) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #eee;vertical-align:middle;width:56px">
      ${a.image ? `<img src="${esc(a.image)}" alt="" width="46" style="border-radius:4px;display:block">` : ''}
    </td><td style="padding:12px;border-bottom:1px solid #eee;vertical-align:middle">
      <div style="font-weight:700">${esc(a.card_name)}${a.variant_label ? ` · ${esc(a.variant_label)}` : ''}</div>
      <div style="font-size:12px;color:#6b6b6b">${esc([a.set_name, a.number_label && `#${a.number_label}`].filter(Boolean).join(' · '))} · your target ${dir === 'below' ? '≤' : '≥'} ${usd(dir === 'below' ? a.below : a.above)}</div>
      <div style="margin-top:4px">Now <b style="color:${dir === 'below' ? '#2e7d32' : '#d84315'}">${usd(price)}</b> ${dir === 'below' ? '↓' : '↑'}</div>
    </td><td style="padding:12px 0;border-bottom:1px solid #eee;vertical-align:middle;text-align:right;white-space:nowrap">
      <a href="${esc(tcgUrl(a))}" style="color:#d84315;font-weight:700;font-size:13px;text-decoration:none">View on TCGPlayer ›</a>
    </td></tr>`).join('');
  const unsub = `${SITE}/alerts?unsubscribe=${token}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1b1f">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="font-size:18px;font-weight:700;margin-bottom:12px">${n === 1 ? 'Your price alert was reached' : `${n} of your price alerts were reached`}</div>
    <div style="background:#fff;border-radius:10px;padding:4px 16px"><table style="width:100%;border-collapse:collapse">${rows}</table></div>
    <p style="font-size:12px;color:#6b6b6b;line-height:1.6;margin-top:14px">
      Prices are TCGPlayer market prices (recent-sales averages), checked once a day. ${n === 1 ? 'This alert is' : 'These alerts are'} now paused —
      <a href="${SITE}/alerts" style="color:#6b6b6b">re-arm or manage your alerts</a> ·
      <a href="${unsub}" style="color:#6b6b6b">turn off alert emails</a>
    </p>
  </div></body></html>`;
  const text = `${hits.map(({ a, price, dir }) => `${a.card_name}${a.variant_label ? ` (${a.variant_label})` : ''}: now ${usd(price)} (target ${dir === 'below' ? '≤' : '≥'} ${usd(dir === 'below' ? a.below : a.above)}) — ${tcgUrl(a)}`).join('\n')}\n\nThese alerts are now paused. Manage them: ${SITE}/alerts\nTurn off alert emails: ${unsub}\n`;
  return { subject, html, text, unsub };
}

async function main() {
  if (!URL_ || !KEY) { log('SUPABASE_URL / SUPABASE_SECRET_KEY not set — skipping.'); return; }
  const alerts = await sb('/rest/v1/price_alerts?status=eq.active&select=*');
  log(`${alerts.length} active alerts`);

  // Which alerts were reached tonight.
  const hitsByUser = new Map();
  for (const a of alerts) {
    const price = priceOf((await pricesFor(a.game)).get(Number(a.product_id)), a.printing);
    if (price == null) continue;
    const dir = a.below != null && price <= Number(a.below) ? 'below' : a.above != null && price >= Number(a.above) ? 'above' : null;
    if (!dir) continue;
    if (!hitsByUser.has(a.user_id)) hitsByUser.set(a.user_id, []);
    hitsByUser.get(a.user_id).push({ a, price, dir });
  }
  const total = [...hitsByUser.values()].reduce((t, h) => t + h.length, 0);
  log(`${total} reached, for ${hitsByUser.size} collectors`);

  let sent = 0, failed = 0;
  for (const [userId, hits] of hitsByUser) {
    try {
      // Email address, preference and unsubscribe token (creating settings on first use).
      const user = await sb(`/auth/v1/admin/users/${userId}`);
      let [settings] = await sb(`/rest/v1/alert_settings?user_id=eq.${userId}&select=emails,unsubscribe_token`);
      if (!settings && !DRY) [settings] = await sb('/rest/v1/alert_settings', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: userId }) });
      const wantsEmail = settings ? settings.emails : true;
      const msg = email(hits, settings?.unsubscribe_token || 'preview');
      if (DRY) {
        log(`[dry] would email ${user.email || userId}: “${msg.subject}”${wantsEmail ? '' : ' (emails off — would only mark reached)'}`);
        continue;
      }
      if (wantsEmail && user.email) {
        if (!RESEND) throw new Error('RESEND_API_KEY not set');
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM, to: [user.email], subject: msg.subject, html: msg.html, text: msg.text,
            headers: { 'List-Unsubscribe': `<${msg.unsub}>` },
          }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
        sent++;
      }
      // Pause the reached alerts until the collector re-arms them.
      for (const { a, price } of hits) {
        await sb(`/rest/v1/price_alerts?id=eq.${a.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'hit', hit_at: new Date().toISOString(), hit_price: price }) });
      }
    } catch (e) {
      failed++;
      log(`couldn’t notify ${userId}: ${e.message}`);
    }
  }
  const line = `Price alerts: ${alerts.length} active, ${total} reached, ${sent} email${sent === 1 ? '' : 's'} sent${failed ? `, ${failed} failed` : ''}${DRY ? ' (dry run)' : ''}.`;
  log(line);
  await summary(line);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (e) => {
    log('failed:', e.message);
    await summary(`Price alerts check failed: ${e.message}`);
  });
}
