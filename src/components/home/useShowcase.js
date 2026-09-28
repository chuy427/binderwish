import { useEffect, useState } from 'react';
import { setSlots } from '../../catalog';
import { getGame } from '../../games';

// Real cards + live prices for the home page's rotating visuals, per game.
// Pokémon: 151; Lorcana: The First Chapter; One Piece: the newest booster that
// already has card images and real prices (brand-new sets often have neither).
const SHOWCASE_SET = { pokemon: 'sv03.5', lorcana: '1' };

const cache = new Map(); // gameId -> Promise<showcase>

async function buildShowcase(gameId, setsInfo) {
  const game = getGame(gameId);
  let candidates = SHOWCASE_SET[gameId] ? [SHOWCASE_SET[gameId]] : setsInfo.sets.filter((s) => s.group === 'Booster' && !s.artPending).slice(0, 3).map((s) => s.id);
  for (const setId of candidates) {
    const slots = await setSlots(game, setId, setsInfo, { variants: true });
    const priced = slots.filter((s) => s.price != null && s.images);
    const top = [...priced].sort((a, b) => b.price - a.price);
    if (!top.length || top[0].price < 20) continue; // try the next candidate
    // One slot per card for the binder spreads (first printing, in set order).
    const seen = new Set();
    const cards = slots.filter((s) => s.images && !seen.has(s.cardId) && seen.add(s.cardId));
    // Chase cards: highest prices, one per card.
    const seenTop = new Set();
    const chase = top.filter((s) => !seenTop.has(s.cardId) && seenTop.add(s.cardId)).slice(0, 6);
    const setName = setsInfo.names?.get(setId) || setId;
    return { gameId, gameName: game.name, setId, setName, cards, chase, total: slots.length };
  }
  return null;
}

// Loads (and caches) the showcase for a game once its set list is available.
export function useShowcase(gameId, setsInfo) {
  const [showcase, setShowcase] = useState(null);
  useEffect(() => {
    if (!setsInfo?.loaded) return;
    let cancelled = false;
    if (!cache.has(gameId)) cache.set(gameId, buildShowcase(gameId, setsInfo).catch(() => null));
    cache.get(gameId).then((s) => { if (!cancelled) setShowcase(s); });
    return () => { cancelled = true; };
  }, [gameId, setsInfo]);
  return showcase;
}

// Rotates through games on a timer (paused while `paused`; off entirely for
// visitors who prefer reduced motion).
export function useRotation(count, { interval = 7000, paused = false } = {}) {
  const [index, setIndex] = useState(0);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // A timeout keyed on the index, so every change — automatic or a manual pick —
  // gets the full interval before the next one.
  useEffect(() => {
    if (reduced || paused || count < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearTimeout(t);
  }, [index, count, interval, paused, reduced]);
  return [index, setIndex];
}
