import { setSlots, slotsForSearch } from '../catalog';

// Custom sets (stored with the settings, so they save, back up and sync):
//   { id, game, name, names: [..], artists: [..], picks: [{ setId, key }], hidden: [key], created,
//     binder, location }   (binder / location: where the collector keeps it)
// names / artists are rules — every matching card is included, new releases too.
// picks are cards added by hand; hidden are matched cards the collector left out.

export const newCustomSetId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`).slice(0, 12);

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strList = (v, max) => [...new Set((Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean))];

export function cleanCustomSets(list, games) {
  return (Array.isArray(list) ? list : [])
    .filter((c) => c && typeof c.id === 'string' && games[c.game])
    .map((c) => ({
      id: c.id.slice(0, 40),
      game: c.game,
      name: str(c.name, 80) || 'Custom set',
      names: strList(c.names, 80).slice(0, 30),
      artists: strList(c.artists, 80).slice(0, 10),
      picks: (Array.isArray(c.picks) ? c.picks : [])
        .filter((p) => p && str(p.setId) && str(p.key, 300))
        .slice(0, 2000)
        .map((p) => ({ setId: p.setId, key: p.key })),
      hidden: strList(c.hidden, 300).slice(0, 5000),
      created: Number(c.created) || 0,
      binder: str(c.binder, 60),
      location: str(c.location, 60),
    }))
    .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);
}

export const hasRules = (cs) => cs.names.length > 0 || cs.artists.length > 0;
export const ruleSummary = (cs) => {
  const parts = [...cs.names, ...cs.artists.map((a) => `art by ${a}`)];
  if (cs.picks.length) parts.push(`${cs.picks.length} hand-picked`);
  return parts.join(' · ');
};

// Binder order: oldest set first (a timeline of the character), then card number.
function sortSlots(slots, setsInfo) {
  const released = new Map(setsInfo.sets.map((s, i) => [s.id, s.released || `~${String(9999 - i).padStart(4, '0')}`]));
  const num = (s) => parseInt(String(s.number).replace(/^\D+/, ''), 10) || 0;
  return slots.sort((a, b) => (released.get(a.setId) || '').localeCompare(released.get(b.setId) || '')
    || a.setId.localeCompare(b.setId) || num(a) - num(b) || String(a.number).localeCompare(String(b.number)) || a.order - b.order);
}

// Every slot in a custom set (hidden ones included — the page filters them),
// cached per definition so revisiting is instant.
const cache = new Map();
export function customSetSlots(game, cs, setsInfo, variants) {
  const k = JSON.stringify([game.id, cs.names, cs.artists, cs.picks.map((p) => p.key), !!variants]);
  if (!cache.has(k)) {
    cache.set(k, build(game, cs, setsInfo, variants).catch((e) => { cache.delete(k); throw e; }));
  }
  return cache.get(k);
}

async function build(game, cs, setsInfo, variants) {
  const rules = [...cs.names.map((value) => ({ type: 'name', value })), ...cs.artists.map((value) => ({ type: 'artist', value }))]
    .filter((r) => game.collectionRules?.includes(r.type));
  const found = (await Promise.all(rules.map((r) => game.collectionCards(r, setsInfo)))).flat();
  const cards = [...new Map(found.map((c) => [c.id, c])).values()];
  const ruleSlots = cards.length ? await slotsForSearch(game, cards, setsInfo, { variants }) : [];

  // Hand-picked cards: load each of their sets (cached) and take the exact slots.
  const bySet = new Map();
  for (const p of cs.picks) {
    if (!bySet.has(p.setId)) bySet.set(p.setId, new Set());
    bySet.get(p.setId).add(p.key);
  }
  const picked = (await Promise.all([...bySet].map(async ([setId, keys]) => {
    const all = await setSlots(game, setId, setsInfo, { variants: true }).catch(() => []);
    return all.filter((s) => keys.has(s.key));
  }))).flat();

  const byKey = new Map();
  for (const s of ruleSlots) byKey.set(s.key, { ...s, fromRule: true });
  for (const s of picked) if (!byKey.has(s.key)) byKey.set(s.key, { ...s, picked: true });
  return sortSlots([...byKey.values()], setsInfo);
}
