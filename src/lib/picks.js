import { useEffect, useState } from 'react';
import { supabase } from './cloud';

// BinderWish picks: curated sets published by approved curators (supabase/picks.sql).
// Anyone can read published picks; the list is kept in localStorage so picks you
// collect still work offline (e.g. the wishlist at a card show).

const CACHE = 'binderwish.picks';
const FIELDS = 'id, slug, game, title, description, definition, covers, card_count, source_id, published, updated_at, curator_id, curator:curators(name, kind)';

const readCache = () => {
  try { const v = JSON.parse(localStorage.getItem(CACHE) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; }
};
const writeCache = (list) => { try { localStorage.setItem(CACHE, JSON.stringify(list)); } catch { /* storage full or blocked */ } };

const clean = (p) => ({
  id: p.id,
  slug: p.slug,
  game: p.game,
  title: p.title,
  description: p.description || '',
  definition: {
    names: p.definition?.names || [], artists: p.definition?.artists || [],
    picks: p.definition?.picks || [], hidden: p.definition?.hidden || [],
  },
  covers: Array.isArray(p.covers) ? p.covers.slice(0, 3) : [],
  count: p.card_count || 0,
  sourceId: p.source_id || null,
  published: p.published !== false,
  updated: p.updated_at,
  curatorId: p.curator_id,
  curator: { name: p.curator?.name || 'BinderWish', kind: p.curator?.kind || 'binderwish' },
});

// Shared store: every component sees the same list, fetched once per visit.
let state = { picks: readCache() || [], loaded: false, error: null };
const listeners = new Set();
const emit = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l(state)); };
let inflight = null;

export function reloadPicks() {
  inflight = supabase.from('picks').select(FIELDS).eq('published', true).order('updated_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throw error;
      const picks = data.map(clean);
      writeCache(picks);
      emit({ picks, loaded: true, error: null });
    })
    .catch((e) => emit({ loaded: true, error: e.message || 'offline' }));
  return inflight;
}

export function usePicks() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (!inflight) reloadPicks();
    return () => listeners.delete(setS);
  }, []);
  return s;
}

export const findPick = (picks, slug) => picks.find((p) => p.slug === slug) || null;

// A pick in the shape the custom-set engine (lib/customSets) works with.
export const pickToCs = (p) => (p ? {
  id: `pick:${p.slug}`, game: p.game, name: p.title, ...p.definition, created: 0, binder: '', location: '',
} : null);

// "Charizard through the years!" → "charizard-through-the-years"
export const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

// ---------- Curators ----------
export async function fetchCurator(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('curators').select('name, kind').eq('user_id', userId).maybeSingle();
  return data || null;
}

// The signed-in curator's own picks, published or not.
export async function fetchMyPicks(userId) {
  const { data, error } = await supabase.from('picks').select(FIELDS).eq('curator_id', userId).order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(clean);
}

export async function savePick(userId, pick) {
  const row = {
    slug: pick.slug, game: pick.game, title: pick.title.trim(), description: pick.description.trim(),
    definition: pick.definition, covers: pick.covers, card_count: pick.count, source_id: pick.sourceId,
    published: pick.published !== false, curator_id: userId,
  };
  const q = pick.id ? supabase.from('picks').update(row).eq('id', pick.id) : supabase.from('picks').insert(row);
  const { data, error } = await q.select(FIELDS).single();
  if (error) {
    if (error.code === '23505') throw new Error('Another pick already uses that address — change the title or address.');
    if (error.code === '42501') throw new Error('Your account isn’t set up as a curator yet.');
    throw new Error(error.message);
  }
  await reloadPicks();
  return clean(data);
}

export async function deletePick(id) {
  const { error } = await supabase.from('picks').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await reloadPicks();
}
