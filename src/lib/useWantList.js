import { useEffect, useState } from 'react';
import { setSlots } from '../catalog';
import { getGame } from '../games';
import { customSetSlots } from './customSets';
import { saveLocal } from './cache';

// The want list: every slot in the sets you're collecting and your custom sets,
// grouped by set (the page shows the ones you don't own). A copy is saved on the
// device so the list opens at a card show with no signal.
const SNAPSHOT_KEY = 'binderwish.wantlist.v1';

// Compact rows for the saved copy:
// [key, name, numberLabel, variantLabel, price, tcgplayerId, printing, setId, setName]
// (set fields only for custom sets, whose cards come from many sets)
const pack = (s, g) => {
  const row = [s.key, s.name, s.numberLabel || s.number || '', s.variantLabel || '', s.price ?? null, s.tcgplayerId ?? null, s.printing ?? null];
  return g.kind === 'custom' ? [...row, s.setId, s.setName] : row;
};
const unpack = (r, g) => ({
  key: r[0], name: r[1], numberLabel: r[2], variantLabel: r[3] || null, price: r[4], tcgplayerId: r[5], printing: r[6],
  game: g.game, setId: r[7] ?? g.setId, setName: r[8] ?? g.setName,
});

function readSnapshot() {
  try {
    const s = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    if (!s?.groups) return null;
    return { at: s.at, groups: s.groups.map((g) => ({ ...g, slots: g.rows.map((r) => unpack(r, g)) })) };
  } catch { return null; }
}
function writeSnapshot(groups) {
  const at = Date.now();
  const compact = groups.map(({ slots, ...g }) => ({ ...g, rows: slots.map((sl) => pack(sl, g)) }));
  saveLocal(SNAPSHOT_KEY, JSON.stringify({ at, groups: compact }));
  return at;
}

// sources: [{ id, kind: 'set' | 'custom', game, setId?, cs?, binder, location }]
export function useWantList(sources, getSetsInfo, variants) {
  const [state, setState] = useState(() => {
    const snap = readSnapshot();
    const byId = new Map((snap?.groups || []).map((g) => [g.id, g]));
    return { groups: sources.map((src) => byId.get(src.id)).filter(Boolean), at: snap?.at || null, loading: true, offline: false };
  });
  const sig = JSON.stringify([sources.map((s) => [s.id, s.cs?.names, s.cs?.artists, s.cs?.picks?.length, s.binder, s.location]), variants]);

  useEffect(() => {
    let cancelled = false;
    const saved = new Map((readSnapshot()?.groups || []).map((g) => [g.id, g]));
    const fresh = new Map();
    // Refreshed groups replace saved ones as they arrive; the rest keep their saved copy.
    const merged = () => sources.map((src) => fresh.get(src.id) || saved.get(src.id)).filter(Boolean);
    setState((st) => ({ ...st, loading: true }));
    (async () => {
      let failed = 0;
      for (const src of sources) {
        try {
          const game = getGame(src.game);
          const info = await getSetsInfo(src.game);
          let slots, title, setName = null;
          if (src.kind === 'custom') {
            const hidden = new Set(src.cs.hidden);
            slots = (await customSetSlots(game, src.cs, info, variants)).filter((sl) => !hidden.has(sl.key));
            title = src.cs.name;
          } else {
            slots = await setSlots(game, src.setId, info, { variants });
            title = info.names?.get(src.setId) || src.setId;
            setName = title;
          }
          if (!slots.length && src.kind === 'set') throw new Error('no cards');
          fresh.set(src.id, {
            id: src.id, kind: src.kind, game: src.game, gameName: game.name, setId: src.setId || null, setName,
            title, label: src.label || null, binder: src.binder || '', location: src.location || '', slots,
          });
        } catch {
          failed++;
          // Keep the saved copy, but with the latest binder / location.
          const old = saved.get(src.id);
          if (old) saved.set(src.id, { ...old, binder: src.binder || '', location: src.location || '' });
        }
        if (!cancelled) setState((st) => ({ ...st, groups: merged() }));
      }
      if (cancelled) return;
      const groups = merged();
      const offline = failed > 0;
      const at = fresh.size ? writeSnapshot(groups) : readSnapshot()?.at || null;
      setState({ groups, at, loading: false, offline, allOffline: failed === sources.length && sources.length > 0 });
    })();
    return () => { cancelled = true; };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
