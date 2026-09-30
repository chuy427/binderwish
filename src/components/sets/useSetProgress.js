import { useEffect, useMemo, useState } from 'react';
import { setSlots } from '../../catalog';

// Slot keys per set (game|set|variants) — loaded once, then progress is just a
// count of owned keys, so checking cards off updates instantly.
const keysCache = new Map();
function loadKeys(game, setId, setsInfo, variants) {
  const k = `${game.id}|${setId}|${variants ? 1 : 0}`;
  if (!keysCache.has(k)) {
    keysCache.set(k, setSlots(game, setId, setsInfo, { variants })
      .then((slots) => slots.map((s) => s.key))
      .catch((e) => { keysCache.delete(k); throw e; }));
  }
  return keysCache.get(k);
}

// Progress for a few sets: Map setId -> { have, total } (missing while loading).
export function useSetProgress(game, setIds, setsInfo, variants, owned) {
  const [keys, setKeys] = useState({}); // "<setId>|<variants>" -> [slot keys]
  const idList = setIds.join(',');
  useEffect(() => {
    if (!setsInfo.loaded) return undefined;
    let cancelled = false;
    (async () => {
      for (const id of setIds) {
        try {
          const ks = await loadKeys(game, id, setsInfo, variants);
          if (!cancelled) setKeys((m) => ({ ...m, [`${game.id}|${id}|${variants}`]: ks }));
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [game, idList, setsInfo, variants]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const out = new Map();
    for (const id of setIds) {
      const ks = keys[`${game.id}|${id}|${variants}`];
      if (ks) out.set(id, { have: ks.filter((k) => owned.has(k)).length, total: ks.length });
    }
    return out;
  }, [keys, idList, owned, variants, game]); // eslint-disable-line react-hooks/exhaustive-deps
}
