// Three-way merge for synced collections. `base` is the version this device last
// synced; `local` is what it has now; `remote` is what the account has now. Each
// change this device made since `base` is applied on top of `remote`, so edits
// from two devices combine instead of one overwriting the other. (When both
// changed the same thing, this device's edit wins.)
//
// States are plain: { owned: [key], queue: [item], options: {…} }.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function mergeSet(base, local, remote) {
  const b = new Set(base), l = new Set(local);
  const out = new Set(remote);
  for (const k of l) if (!b.has(k)) out.add(k);     // added here
  for (const k of b) if (!l.has(k)) out.delete(k);  // removed here
  return [...out].sort();
}

// Lists of objects with an id: additions, removals and edits made here win;
// everything else is the account's version (in its order, new items after).
export function mergeById(base = [], local = [], remote = [], id) {
  const b = new Map(base.map((x) => [id(x), x]));
  const l = new Map(local.map((x) => [id(x), x]));
  const out = new Map(remote.map((x) => [id(x), x]));
  for (const [k, v] of l) if (!b.has(k) || !same(b.get(k), v)) out.set(k, v);
  for (const k of b.keys()) if (!l.has(k)) out.delete(k);
  return [...out.values()];
}

const BY_ID = {
  mySets: (m) => `${m.game}|${m.setId}`,
  customSets: (c) => c.id,
};

// Settings: per field — this device's value where it changed it, else the account's.
export function mergeOptions(base = {}, local = {}, remote = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (BY_ID[k]) out[k] = mergeById(base[k] || [], local[k] || [], remote[k] || [], BY_ID[k]);
    else if (!same(local[k], base[k])) out[k] = local[k];
    else out[k] = k in remote ? remote[k] : local[k];
  }
  return out;
}

export function mergeState(base, local, remote) {
  const owned = mergeSet(base.owned, local.owned, remote.owned);
  const have = new Set(owned);
  return {
    owned,
    // Owned cards never stay on the print sheet.
    queue: mergeById(base.queue, local.queue, remote.queue, (c) => c.key).filter((c) => !have.has(c.key)),
    options: mergeOptions(base.options, local.options, remote.options),
  };
}

// Base for a device that's never synced with this account: nothing of its own was
// "removed", and for plain settings the account's values win.
export const freshBase = (local) => ({
  owned: [],
  queue: [],
  options: { ...local.options, mySets: [], customSets: [] },
});
