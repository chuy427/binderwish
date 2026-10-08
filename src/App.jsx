import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppBar, Box, Button, IconButton, CircularProgress, Container, Drawer, GlobalStyles, Link, ListItemIcon, Menu, MenuItem, Snackbar, Stack, Toolbar, Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import GridViewIcon from '@mui/icons-material/GridView';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { layoutParam, parseLayout } from './components/binder/layout';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import { cleanCustomSets, newCustomSetId } from './lib/customSets';
import { saveLocal } from './lib/cache';


import SiteFootnote from './components/SiteFootnote';
import { WAITLIST_ENABLED } from './lib/waitlist';
import AccountMenu, { openSignIn } from './components/AccountMenu';
import { useCloudSync } from './lib/useCloudSync';
import { ACCOUNTS_ENABLED } from './lib/cloud';
import { downloadBackup, mergeBackup } from './lib/backup';
import { DEFAULT_GAME, GAMES, getGame } from './games';
import { LogoMark, Wordmark } from './components/Logo';
import { fetchCurator, fetchMyPicks, findPick, pickToCs, usePicks } from './lib/picks';

// Pages load on demand, so the first visit downloads only what it shows.
const HomePage = lazy(() => import('./components/HomePage'));
const MySetsPage = lazy(() => import('./components/sets/MySetsPage'));
const SetPage = lazy(() => import('./components/sets/SetPage'));
const CustomSetPage = lazy(() => import('./components/sets/CustomSetPage'));
const WantListPage = lazy(() => import('./components/WantListPage'));
const BinderPage = lazy(() => import('./components/binder/BinderPage'));
const BinderIndexPage = lazy(() => import('./components/binder/BinderIndexPage'));
const PrivacyPage = lazy(() => import('./components/PrivacyPage'));
const PrintArea = lazy(() => import('./components/PrintArea'));
const SearchPanel = lazy(() => import('./components/SearchPanel'));
const PrintSheetPanel = lazy(() => import('./components/PrintSheetPanel'));
const BackupSection = lazy(() => import('./components/BackupSection'));
const WaitlistDialog = lazy(() => import('./components/WaitlistDialog'));
const PickPage = lazy(() => import('./components/picks/PickPage'));
const PicksIndexPage = lazy(() => import('./components/picks/PicksIndexPage'));

const PageLoading = () => (
  <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}><CircularProgress /></Box>
);

// Keys kept from the app's earlier "ProxyScan" name so saved data carries over.
const STORAGE_KEY = 'proxyscan.v1';
const OWNED_KEY = 'binderwish.owned';
const DEFAULT_OPTIONS = {
  paper: 'letter', cardStyle: 'art', qrCorner: 'auto', qrSize: 14, qrLogo: null, gap: 0.5, cutLines: true, price: false,
  variants: true, keepPositions: false, newPagePerSet: true,
  // Sets shown under "Collecting" on My sets: [{ game, setId }]. Kept with the
  // settings so it saves, backs up and syncs along with them.
  mySets: [],
  // Custom sets (see lib/customSets.js).
  customSets: [],
  // BinderWish picks being collected: [{ slug }] (the picks themselves load from the server).
  followedPicks: [],
  // Virtual binder layout: pockets per page as columns × rows.
  binderLayout: { cols: 3, rows: 3 },
  // The last collection opened in the virtual binder: { game, set | custom, name }.
  lastBinder: null,
};
// Each entry can also say where the set is kept: { binder, location }.
const place = (v) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');
const cleanMySets = (list) => {
  const out = new Map();
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || !GAMES[m.game] || typeof m.setId !== 'string' || !m.setId) continue;
    const k = `${m.game}|${m.setId}`;
    const prev = out.get(k);
    out.set(k, { game: m.game, setId: m.setId, binder: prev?.binder || place(m.binder), location: prev?.location || place(m.location) });
  }
  return [...out.values()];
};
const cleanFollowed = (list) => [...new Map((Array.isArray(list) ? list : [])
  .filter((f) => f && typeof f.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(f.slug))
  .map((f) => [f.slug, { slug: f.slug }])).values()];
const withDefaults = (o) => ({
  ...DEFAULT_OPTIONS, ...o,
  mySets: cleanMySets(o?.mySets),
  customSets: cleanCustomSets(o?.customSets, GAMES),
  followedPicks: cleanFollowed(o?.followedPicks),
  binderLayout: parseLayout(o?.binderLayout && layoutParam(o.binderLayout)) || DEFAULT_OPTIONS.binderLayout,
});
// Parallel card-data lookups for cards the bundled catalog couldn't match.
const CONCURRENCY = 4;

// Print-sheet items saved by the pre-BinderWish version were one per card, not per
// variant — give them the fields the slot-based code expects.
function migrateItem(c) {
  if (c.key) return c;
  return {
    ...c,
    game: 'pokemon',
    key: `${c.id}|legacy`,
    cardId: c.id,
    setId: c.id.slice(0, c.id.lastIndexOf('-')),
    numberLabel: c.number,
    variantLabel: null,
    printing: null,
    order: 0,
    needsLookup: !c.tcgplayerId,
  };
}

// ---------- Routing ----------
// Real paths (/search) rather than hash routes. Cloudflare Pages serves the app
// for any path, so deep links and refreshes load it.
const BASE = import.meta.env.BASE_URL; // "/"

function routeUrl(view, { game, set, q, custom, pick, layout, page, card } = {}) {
  if (view === 'privacy') return `${BASE}privacy`;
  if (view === 'picks') return `${BASE}picks`;
  if (view === 'pick') return `${BASE}picks/${encodeURIComponent(set)}`;
  if (view === 'binderIndex') return `${BASE}binder${game && game !== DEFAULT_GAME ? `?game=${game}` : ''}`;
  if (view === 'binder') {
    const params = new URLSearchParams();
    if (game && game !== DEFAULT_GAME) params.set('game', game);
    if (layout) params.set('layout', layout);
    if (page && page > 1) params.set('page', page);
    if (card) params.set('card', card);
    const qs = params.toString();
    const where = pick ? `pick/${encodeURIComponent(pick)}` : custom ? `custom/${encodeURIComponent(custom)}` : encodeURIComponent(set);
    return `${BASE}binder/${where}${qs ? `?${qs}` : ''}`;
  }
  const gameQs = game && game !== DEFAULT_GAME ? `?game=${game}` : '';
  if (view === 'sets') return `${BASE}sets${gameQs}`;
  if (view === 'need') return `${BASE}need`;
  // Non-Pokémon sets live under the game: /sets/lorcana/7 (the static, search-friendly pages too).
  if (view === 'set') return `${BASE}sets/${game && game !== DEFAULT_GAME ? `${game}/` : ''}${encodeURIComponent(set)}`;
  if (view === 'custom') return `${BASE}sets/custom/${encodeURIComponent(set)}${gameQs}`;
  if (view !== 'search') return BASE;
  const params = new URLSearchParams();
  if (game && game !== DEFAULT_GAME) params.set('game', game);
  if (set) params.set('set', set);
  if (q) params.set('q', q);
  const qs = params.toString();
  return `${BASE}search${qs ? `?${qs}` : ''}`;
}

function readRoute() {
  // Old hash links (#/binder) from before /search existed.
  if (location.hash.startsWith('#/binder')) history.replaceState(null, '', routeUrl('search'));
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : '';
  const params = new URLSearchParams(location.search);
  const clean = path.replace(/\/$/, '');
  const binderCustom = clean.startsWith('binder/custom/') ? decodeURIComponent(clean.slice(14)) : null;
  const binderPick = clean.startsWith('binder/pick/') ? decodeURIComponent(clean.slice(12)) : null;
  const binderSet = !binderCustom && !binderPick && clean.startsWith('binder/') ? decodeURIComponent(clean.slice(7)) : null;
  if (binderCustom || binderPick || binderSet) {
    return {
      view: 'binder', game: GAMES[params.get('game')] ? params.get('game') : DEFAULT_GAME,
      set: binderSet, custom: binderCustom, pick: binderPick, layout: parseLayout(params.get('layout')),
      page: Math.max(1, parseInt(params.get('page'), 10) || 1), card: params.get('card') || null, key: String(Date.now()),
    };
  }
  if (clean.startsWith('picks/')) {
    return { view: 'pick', game: GAMES[params.get('game')] ? params.get('game') : DEFAULT_GAME, set: decodeURIComponent(clean.slice(6)), key: String(Date.now()) };
  }
  const customPath = clean.startsWith('sets/custom/') ? decodeURIComponent(clean.slice(12)) : null;
  let setPath = !customPath && clean.startsWith('sets/') ? decodeURIComponent(clean.slice(5)) : null;
  // /sets/lorcana/7 → game from the path (older links carry ?game= instead).
  const gamePrefix = setPath?.match(/^([a-z]+)\/(.+)$/);
  let game = GAMES[params.get('game')] ? params.get('game') : DEFAULT_GAME;
  if (gamePrefix && GAMES[gamePrefix[1]]) [, game, setPath] = gamePrefix;
  else if (setPath && !customPath && game !== DEFAULT_GAME) history.replaceState(null, '', routeUrl('set', { game, set: setPath }));
  return {
    view: customPath ? 'custom' : setPath ? 'set' : ({ search: 'search', privacy: 'privacy', sets: 'sets', need: 'need', binder: 'binderIndex', picks: 'picks' })[clean] || 'home',
    game,
    set: customPath || setPath || params.get('set') || null,
    q: params.get('q') || '',
    // Remounts the search panel when arriving from somewhere else (home, back/forward).
    key: `${params.get('game') || ''}|${params.get('set') || ''}|${params.get('q') || ''}|${Date.now()}`,
  };
}

function loadSaved() {
  let queue = [], options = DEFAULT_OPTIONS, owned = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(saved.queue)) {
      queue = saved.queue.map(migrateItem).map((c) => (c.needsLookup && !c.tcgplayerId ? { ...c, status: 'pending' } : c));
    }
    options = withDefaults(saved.options);
    // Before My sets existed: start the list from the print sheet's sets (and,
    // for Pokémon, owned cards — their ids start with the set id).
    if (!Array.isArray(saved.options?.mySets)) {
      const fromQueue = queue.map((c) => ({ game: c.game || 'pokemon', setId: c.setId }));
      let fromOwned = [];
      try {
        fromOwned = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')
          .map((k) => k.split('|')[0]).filter((id) => /^[a-z0-9.]+-[^-]+$/i.test(id) && !id.startsWith('op-'))
          .map((id) => ({ game: 'pokemon', setId: id.slice(0, id.lastIndexOf('-')) }));
      } catch {}
      options.mySets = cleanMySets([...fromQueue, ...fromOwned]);
    }
    // Removed / renamed options (qrPos became qrCorner, which adds 'auto').
    delete options.qrOpacity; delete options.style; delete options.qrPos;
  } catch {}
  try { owned = new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')); } catch {}
  return { queue, options, owned };
}

// Binder order: sets in the order they were first added, then set order within each.
const setKey = (c) => `${c.game || 'pokemon'}|${c.setId}`;
function sortQueue(queue) {
  const setRank = new Map();
  queue.forEach((c) => { if (!setRank.has(setKey(c))) setRank.set(setKey(c), setRank.size); });
  return [...queue].sort((a, b) => setRank.get(setKey(a)) - setRank.get(setKey(b)) || a.order - b.order);
}

const EMPTY_SETS = { sets: [], names: new Map(), official: new Map(), pocketIds: new Set(), loaded: false };

export default function App() {
  const initial = useMemo(loadSaved, []);
  // queue: binder slots to print, each with a qty (see catalog.js makeSlot for the shape)
  const [queue, setQueue] = useState(initial.queue);
  const [options, setOptions] = useState(initial.options);
  const [owned, setOwned] = useState(initial.owned);
  // Each game's set list, loaded the first time that game is used.
  const [setsByGame, setSetsByGame] = useState({});
  const setsLoading = useRef(new Map());
  const getSetsInfo = useCallback((gameId) => {
    if (!setsLoading.current.has(gameId)) {
      const p = getGame(gameId).loadSets()
        .then((info) => ({ ...info, loaded: true }))
        .catch(() => ({ ...EMPTY_SETS, loaded: true }))
        .then((info) => { setSetsByGame((m) => ({ ...m, [gameId]: info })); return info; });
      setsLoading.current.set(gameId, p);
    }
    return setsLoading.current.get(gameId);
  }, []);
  const [printing, setPrinting] = useState(false);
  // On set pages the print sheet lives in a drawer, opened by "Add missing to print".
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // Said once per visit if this browser can't save the collection (storage blocked or full).
  const storageWarned = useRef(false);
  const warnStorage = () => {
    if (storageWarned.current) return;
    storageWarned.current = true;
    setToast('This browser couldn’t save your latest changes — its storage is full or blocked. Sign in to keep them in your account.');
  };
  // Curators (supabase/picks.sql) can publish picks; their own picks include unpublished ones.
  const [curator, setCurator] = useState(null);
  const [myPicks, setMyPicks] = useState([]);
  const [waitlist, setWaitlist] = useState(null); // null | 'collector' | 'vendor'
  // Routes: <base> = home, <base>search?set=<id>|q=<name> = the tool.
  const [route, setRoute] = useState(readRoute);
  // A layout in a shared binder link applies to that view only; picking one saves it.
  const [binderLayoutOverride, setBinderLayoutOverride] = useState(() => (route.view === 'binder' ? route.layout : null));
  useEffect(() => { setBinderLayoutOverride(route.view === 'binder' ? route.layout : null); }, [route.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (view, params = {}) => {
    setSheetOpen(false);
    history.pushState(null, '', routeUrl(view, params));
    setRoute(readRoute());
    window.scrollTo(0, 0);
  };
  const view = route.view;
  const binderLayout = binderLayoutOverride || options.binderLayout;
  // BinderWish picks (published, cached for offline); the one this page shows, if any.
  const picksState = usePicks();
  const routePickSlug = view === 'pick' ? route.set : route.pick;
  const routePick = routePickSlug ? findPick(picksState.picks, routePickSlug) || myPicks.find((p) => p.slug === routePickSlug) || null : null;
  // A pick's page uses the pick's game.
  const gameId = routePick?.game || route.game;
  // The browser tab title follows the page (static set pages start with theirs).
  const titleSetName = (view === 'set' || view === 'binder') && route.set ? setsByGame[route.game]?.names?.get(route.set) : null;
  const titleCustom = (view === 'custom' || view === 'binder') && (route.custom || route.set) ? options.customSets.find((c) => c.id === (route.custom || route.set))?.name : null;
  useEffect(() => {
    const t = {
      home: 'BinderWish — Track master sets, see every binder pocket, print placeholders',
      sets: 'My sets | BinderWish',
      need: 'Wishlist | BinderWish',
      search: 'Search cards | BinderWish',
      privacy: 'Privacy policy | BinderWish',
      binderIndex: 'Virtual binder | BinderWish',
      picks: 'BinderWish picks — curated sets to collect | BinderWish',
      pick: routePick && `${routePick.title} | BinderWish picks`,
      set: titleSetName && `${titleSetName} master set checklist | BinderWish`,
      custom: titleCustom && `${titleCustom} | BinderWish`,
      binder: (titleSetName || titleCustom || routePick?.title) && `${titleSetName || titleCustom || routePick.title} · virtual binder | BinderWish`,
    }[view];
    if (t) document.title = t;
  }, [view, titleSetName, titleCustom, routePick]);
  // Remember the last collection opened in the virtual binder ("Continue with …").
  const lastBinderName = view === 'binder' && !route.pick
    ? (route.custom ? options.customSets.find((c) => c.id === route.custom)?.name : setsByGame[route.game]?.names?.get(route.set))
    : null;
  useEffect(() => {
    if (view !== 'binder' || !lastBinderName) return;
    const next = { game: route.game, set: route.set || null, custom: route.custom || null, name: lastBinderName };
    setOptions((o) => (JSON.stringify(o.lastBinder) === JSON.stringify(next) ? o : { ...o, lastBinder: next }));
  }, [view, route.game, route.set, route.custom, lastBinderName]); // eslint-disable-line react-hooks/exhaustive-deps
  // Views with the print sheet (and the header's Print button).
  const toolView = view === 'search' || view === 'set' || view === 'custom' || view === 'pick';
  // Collection pages (a set, a custom set): no sidebar — the print sheet opens in a drawer.
  const drawerView = view === 'set' || view === 'custom' || view === 'pick';

  useEffect(() => {
    if (!saveLocal(STORAGE_KEY, JSON.stringify({ queue, options }))) warnStorage();
  }, [queue, options]);
  // Another tab of BinderWish changed the collection: take its version, so an
  // older tab never saves stale data over newer changes.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY && e.key !== OWNED_KEY) return;
      const s = loadSaved();
      setOwned(s.owned);
      setQueue(s.queue);
      setOptions(s.options);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    if (!saveLocal(OWNED_KEY, JSON.stringify([...owned]))) warnStorage();
  }, [owned]);

  // The current game's sets, plus Pokémon's for the home page showcase.
  useEffect(() => { getSetsInfo(gameId); getSetsInfo(DEFAULT_GAME); }, [gameId, getSetsInfo]);
  const game = getGame(gameId);
  const setsInfo = setsByGame[gameId] || EMPTY_SETS;

  // Cards the bundled TCGPlayer catalog couldn't match get their TCGPlayer id and
  // price from TCGdex in the background, a few at a time.
  const inProgress = useRef(new Set());
  useEffect(() => {
    const free = CONCURRENCY - inProgress.current.size;
    if (free <= 0) return;
    const next = queue.filter((c) => c.status === 'pending' && !inProgress.current.has(c.key)).slice(0, free);
    for (const item of next) {
      inProgress.current.add(item.key);
      const finish = (patch) => {
        inProgress.current.delete(item.key);
        setQueue((q) => q.map((c) => (c.key === item.key ? { ...c, ...patch } : c)));
      };
      const lookup = getGame(item.game).fetchCardExtras;
      if (!lookup) { finish({ status: 'ready' }); continue; }
      lookup(item.cardId)
        .then((x) => finish({
          tcgplayerId: x.tcgplayerId,
          price: item.price ?? x.price,
          setName: item.setName || x.setName,
          ...(item.images || item.image ? {} : { images: x.images }),
          status: 'ready',
        }))
        .catch(() => finish({ status: 'error' }));
    }
  }, [queue]);

  const queuedKeys = useMemo(() => new Set(queue.map((c) => c.key)), [queue]);

  const toItem = (slot) => ({ ...slot, qty: 1, status: slot.needsLookup ? 'pending' : 'ready' });

  // Checking off or printing a card adds its set to My sets.
  const trackSets = useCallback((slots) => setOptions((o) => {
    const next = cleanMySets([...o.mySets, ...slots.filter((s) => s?.setId).map((s) => ({ game: s.game || 'pokemon', setId: s.setId }))]);
    return next.length === o.mySets.length ? o : { ...o, mySets: next };
  }), []);
  // Binder + location for a set (adds it to My sets if it isn't there yet).
  const setSetPlace = useCallback((gameId, setId, { binder, location }) => setOptions((o) => {
    const has = o.mySets.some((m) => m.game === gameId && m.setId === setId);
    const list = has ? o.mySets : [...o.mySets, { game: gameId, setId }];
    return { ...o, mySets: cleanMySets(list.map((m) => (m.game === gameId && m.setId === setId ? { ...m, binder: place(binder), location: place(location) } : m))) };
  }), []);
  const toggleFollow = useCallback((slug) => setOptions((o) => ({
    ...o,
    followedPicks: o.followedPicks.some((f) => f.slug === slug) ? o.followedPicks.filter((f) => f.slug !== slug) : [...o.followedPicks, { slug }],
  })), []);
  const toggleTracked = useCallback((gameId, setId) => setOptions((o) => {
    const has = o.mySets.some((m) => m.game === gameId && m.setId === setId);
    return { ...o, mySets: has ? o.mySets.filter((m) => !(m.game === gameId && m.setId === setId)) : [...o.mySets, { game: gameId, setId }] };
  }), []);

  // Custom sets
  const createCustomSet = (v) => {
    const id = newCustomSetId();
    setOptions((o) => ({ ...o, customSets: cleanCustomSets([...o.customSets, { ...v, id, picks: [], hidden: [], created: Date.now() }], GAMES) }));
    navigate('custom', { game: v.game, set: id });
  };
  const updateCustomSet = useCallback((id, patch) => setOptions((o) => ({
    ...o, customSets: cleanCustomSets(o.customSets.map((c) => (c.id === id ? { ...c, ...patch } : c)), GAMES),
  })), []);
  const deleteCustomSet = (id) => {
    const removed = options.customSets.find((c) => c.id === id);
    setOptions((o) => ({ ...o, customSets: o.customSets.filter((c) => c.id !== id) }));
    navigate('sets', { game: removed?.game });
    if (removed) {
      setToast({ message: `Deleted “${removed.name}”`, undo: () => setOptions((o) => ({ ...o, customSets: cleanCustomSets([...o.customSets, removed], GAMES) })) });
    }
  };

  // Tapping a card toggles it on / off the print sheet (quantities are set with
  // − / + on the sheet itself).
  const togglePrint = useCallback((slot) => {
    const label = `${slot.name}${slot.variantLabel ? ` (${slot.variantLabel})` : ''}`;
    if (queuedKeys.has(slot.key)) {
      setQueue((q) => q.filter((c) => c.key !== slot.key));
      setToast(`Removed ${label} from the print sheet`);
      return;
    }
    if (owned.has(slot.key)) {
      setToast('You own this one — unmark it (✓) to print a placeholder');
      return;
    }
    setQueue((q) => sortQueue([...q.filter((c) => c.key !== slot.key), toItem(slot)]));
    trackSets([slot]);
    setToast(`Added ${label}`);
  }, [owned, queuedKeys, trackSets]);

  const addMany = useCallback((slots, { track = true } = {}) => {
    setQueue((q) => {
      const have = new Set(q.map((c) => c.key));
      return sortQueue([...q, ...slots.filter((s) => !have.has(s.key)).map(toItem)]);
    });
    if (track) trackSets(slots);
    setToast(`Added ${slots.length} placeholder${slots.length === 1 ? '' : 's'}`);
  }, [trackSets]);

  // Marking a card owned also takes it off the print sheet — no placeholder needed.
  const toggleOwned = useCallback((key, slot) => {
    const adding = !owned.has(key);
    if (adding && slot) trackSets([slot]);
    setOwned((prev) => {
      const next = new Set(prev);
      if (adding) next.add(key); else next.delete(key);
      return next;
    });
    if (adding) setQueue((q) => q.filter((c) => c.key !== key));
  }, [owned, trackSets]);

  // Collection import (CSV): check off every matched card, with undo.
  const importCollection = (slots) => {
    const added = slots.filter((sl) => !owned.has(sl.key));
    if (!added.length) return;
    const keys = new Set(added.map((sl) => sl.key));
    const trackedBefore = options.mySets;
    trackSets(added);
    setOwned((prev) => new Set([...prev, ...keys]));
    setQueue((q) => q.filter((c) => !keys.has(c.key)));
    setToast({
      message: `Checked off ${added.length} card${added.length === 1 ? '' : 's'}`,
      undo: () => {
        setOwned((prev) => { const n = new Set(prev); keys.forEach((k) => n.delete(k)); return n; });
        setOptions((o) => ({ ...o, mySets: trackedBefore }));
      },
    });
  };

  // Wishlist "Got it": mark owned, with undo (which also puts it back on the print sheet).
  const gotIt = (slot) => {
    const item = queue.find((c) => c.key === slot.key);
    toggleOwned(slot.key);
    setToast({
      message: `Got ${slot.name}${slot.variantLabel ? ` (${slot.variantLabel})` : ''}`,
      undo: () => {
        setOwned((prev) => { const n = new Set(prev); n.delete(slot.key); return n; });
        if (item) setQueue((q) => (q.some((c) => c.key === item.key) ? q : sortQueue([...q, item])));
      },
    });
  };
  // Picks being collected (those still published, or the curator's own).
  const followedPicks = useMemo(() => options.followedPicks
    .map((f) => findPick(picksState.picks, f.slug) || myPicks.find((p) => p.slug === f.slug))
    .filter(Boolean), [options.followedPicks, picksState.picks, myPicks]);
  // Everything the wishlist covers: sets being collected, then custom sets and picks.
  const wantSources = useMemo(() => [
    ...options.mySets.map((m) => ({ id: `set|${m.game}|${m.setId}`, kind: 'set', game: m.game, setId: m.setId, binder: m.binder, location: m.location })),
    ...options.customSets.map((c) => ({ id: `custom|${c.id}`, kind: 'custom', game: c.game, cs: c, binder: c.binder, location: c.location })),
    ...followedPicks.map((p) => ({ id: `pick|${p.slug}`, kind: 'custom', game: p.game, cs: pickToCs(p), label: 'BinderWish pick' })),
  ], [options.mySets, options.customSets, followedPicks]);

  const changeQty = useCallback((key, delta) => {
    setQueue((q) => q.map((c) => (c.key === key ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0));
  }, []);

  const exportBackup = () => {
    downloadBackup({ owned, queue, options });
    setToast('Backup downloaded');
  };
  const importBackup = (mode, data) => {
    if (mode === 'replace') {
      const nextOwned = new Set(data.owned);
      setOwned(nextOwned);
      setQueue(sortQueue(data.queue.filter((c) => !nextOwned.has(c.key))));
      setOptions(withDefaults(data.options));
      setToast(`Replaced with backup: ${data.owned.length} owned, ${data.queue.length} on print sheet`);
    } else {
      const merged = mergeBackup({ owned: [...owned], queue }, data);
      setOwned(merged.owned);
      setOptions((o) => ({
        ...o,
        mySets: cleanMySets([...o.mySets, ...(data.options?.mySets || [])]),
        customSets: cleanCustomSets([...o.customSets, ...(data.options?.customSets || []).filter((c) => !o.customSets.some((x) => x.id === c?.id))], GAMES),
      }));
      setQueue(sortQueue(merged.queue));
      setToast(`Merged backup: ${merged.owned.size} owned, ${merged.queue.length} on print sheet`);
    }
  };

  const setOption = useCallback((key, value) => setOptions((o) => ({ ...o, [key]: value })), []);

  const stats = useMemo(() => {
    let count = 0, total = 0, priced = 0, pending = 0;
    for (const c of queue) {
      count += c.qty;
      if (c.status === 'pending') pending += 1;
      if (c.price != null) { total += c.price * c.qty; priced += c.qty; }
    }
    return { count, total, priced, pending, sheets: Math.ceil(count / 9) };
  }, [queue]);

  const readyCount = queue.length - stats.pending;


  // Clearing syncs to every device, so it can be undone for a few seconds.
  // Binder names / locations already in use — suggested when cataloguing a set.
  const places = useMemo(() => {
    const all = [...options.mySets, ...options.customSets];
    const uniq = (k) => [...new Set(all.map((x) => x[k]).filter(Boolean))].sort();
    return { binders: uniq('binder'), locations: uniq('location') };
  }, [options.mySets, options.customSets]);

  const clearQueue = () => {
    const previous = queue;
    setQueue([]);
    setToast({ message: `Cleared ${previous.length} placeholder${previous.length === 1 ? '' : 's'}`, undo: () => setQueue(previous) });
  };

  const printSheet = (embedded) => (
    <PrintSheetPanel
      embedded={embedded}
      queue={queue}
      options={options}
      setOption={setOption}
      onQty={changeQty}
      onClear={clearQueue}
      stats={stats}
      dataSection={
        <BackupSection
          ownedCount={owned.size}
          queueCount={queue.length}
          defaultOptions={DEFAULT_OPTIONS}
          onExport={exportBackup}
          onImport={importBackup}
        />
      }
    />
  );

  // Optional account: syncs owned / print sheet / settings across devices.
  const sync = useCloudSync({
    owned, queue, options,
    apply: (next) => {
      const nextOwned = new Set(next.owned);
      setOwned(nextOwned);
      setQueue(sortQueue(next.queue
        .filter((c) => c && c.key && !nextOwned.has(c.key))
        .map((c) => (c.needsLookup && !c.tcgplayerId ? { ...c, status: 'pending' } : c))));
      setOptions(withDefaults(next.options));
    },
    onLoaded: ({ fresh }) => { if (fresh) setToast('Signed in — your collection now syncs to your account'); },
    // Signing out leaves nothing behind on this (possibly shared) device; the
    // collection stays in the account.
    onSignedOut: () => {
      setOwned(new Set());
      setQueue([]);
      setToast('Signed out — your collection is saved in your account');
    },
  });

  // Header navigation, by whether you're signed in.
  const [navAnchor, setNavAnchor] = useState(null);
  const signedIn = !!sync.user;
  // Curator status and the curator's own picks, for the signed-in account.
  const userId = sync.user?.id || null;
  const refreshMyPicks = useCallback(() => {
    if (!userId) { setCurator(null); setMyPicks([]); return; }
    fetchCurator(userId).then((c) => {
      setCurator(c);
      if (c) fetchMyPicks(userId).then(setMyPicks).catch(() => {});
    }).catch(() => {});
  }, [userId]);
  useEffect(() => { refreshMyPicks(); }, [refreshMyPicks]);
  const setsActive = view === 'sets' || view === 'set' || view === 'custom';
  const picksNav = picksState.picks.length > 0 || myPicks.length > 0
    ? [{ label: 'Picks', icon: <AutoAwesomeOutlinedIcon />, go: () => navigate('picks'), active: view === 'picks' || view === 'pick' }] : [];
  // Links into picks, for the home page and My sets.
  const picksProps = {
    pickHref: (slug) => routeUrl('pick', { set: slug }),
    onOpenPick: (slug) => navigate('pick', { set: slug }),
    allHref: routeUrl('picks'),
    onOpenAll: () => navigate('picks'),
  };
  const navItems = signedIn ? [
    { label: 'My wishlist', icon: <FactCheckOutlinedIcon />, go: () => navigate('need'), active: view === 'need' },
    { label: 'My sets', icon: <GridViewIcon />, go: () => navigate('sets', { game: route.game }), active: setsActive },
    ...picksNav,
    { label: 'Search', icon: <SearchIcon />, go: () => navigate('search', { game: route.game }), active: view === 'search' },
  ] : [
    { label: 'Sets', icon: <GridViewIcon />, go: () => navigate('sets', { game: route.game }), active: setsActive },
    ...picksNav,
    { label: 'Open virtual binder', icon: <AutoStoriesOutlinedIcon />, go: () => navigate('binderIndex', { game: route.game }),
      active: view === 'binder' || view === 'binderIndex', primary: !toolView },
    { label: 'Search', icon: <SearchIcon />, go: () => navigate('search', { game: route.game }), active: view === 'search' },
  ];

  return (
    <>
      <GlobalStyles styles={`@page { size: ${options.paper === 'a4' ? 'A4' : 'letter'} portrait; margin: 0; }`} />

      <Box className="no-print" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="sticky" color="inherit" elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(17,17,17,.72)', backdropFilter: 'blur(14px)' }}>
          <Toolbar sx={{ gap: { xs: 1, sm: 2 } }}>
            <Box component="a" href={BASE} onClick={(e) => { e.preventDefault(); navigate('home'); }} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'inherit', textDecoration: 'none', flex: 1, minWidth: 0 }}>
              <LogoMark size={38} />
              {/* On phones the binder view's header needs the room for its buttons, so just the logo shows. */}
              <Wordmark sx={{ display: { xs: toolView ? 'none' : 'block', sm: 'block' }, fontSize: { xs: 22, sm: 25 }, minWidth: 0 }} />
            </Box>
            {/* Navigation: labelled buttons on larger screens, a menu on phones. */}
            {navItems.map((n) => (
              <Button key={n.label} color={n.primary ? 'primary' : 'inherit'} startIcon={n.icon} onClick={n.go} aria-current={n.active ? 'page' : undefined}
                variant={n.primary ? 'contained' : 'text'}
                sx={{ flexShrink: 0, display: { xs: 'none', md: 'inline-flex' }, ...(n.primary ? {} : { color: n.active ? 'primary.main' : 'inherit' }) }}>
                {n.label}
              </Button>
            ))}
            <IconButton aria-label="Menu" onClick={(e) => setNavAnchor(e.currentTarget)} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
              <MenuIcon />
            </IconButton>
            <Menu anchorEl={navAnchor} open={!!navAnchor} onClose={() => setNavAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
              {navItems.map((n) => (
                <MenuItem key={n.label} selected={n.active} onClick={() => { setNavAnchor(null); n.go(); }}>
                  <ListItemIcon>{n.icon}</ListItemIcon>{n.label}
                </MenuItem>
              ))}
            </Menu>
            {toolView && (
            <Button
              variant="contained"
              size="large"
              startIcon={stats.pending ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
              disabled={stats.count === 0 || (!drawerView && (stats.pending > 0 || printing))}
              // On set pages (no sidebar) this opens the print sheet to review first.
              onClick={() => (drawerView ? setSheetOpen(true) : setPrinting(true))}
            >
              {stats.pending
                ? `Looking up ${readyCount}/${queue.length}`
                : printing ? 'Preparing…' : `Print ${stats.count}`}
            </Button>
            )}
            {toolView && WAITLIST_ENABLED && (
              <>
                <Button
                  variant="outlined" size="large" startIcon={<LocalShippingIcon />}
                  onClick={() => setWaitlist('collector')}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}
                >
                  Get them printed
                </Button>
                <IconButton color="primary" aria-label="Get them printed" onClick={() => setWaitlist('collector')}
                  sx={{ display: { xs: 'inline-flex', sm: 'none' }, border: 1, borderColor: 'divider' }}>
                  <LocalShippingIcon />
                </IconButton>
              </>
            )}
            {/* Account sits at the far right of the header. */}
            {ACCOUNTS_ENABLED && <AccountMenu sync={sync} onPrivacy={() => navigate('privacy')} />}
          </Toolbar>
        </AppBar>

        <Suspense fallback={<PageLoading />}>
        {view === 'privacy' && <PrivacyPage />}
        {view === 'home' && (
          <HomePage
            setsByGame={setsByGame}
            loadGameSets={getSetsInfo}
            onStart={({ game: g, set, query }) => navigate('search', { game: g, set: set?.id, q: query })}
            onPrivacy={() => navigate('privacy')}
            onVendorWaitlist={WAITLIST_ENABLED ? () => setWaitlist('vendor') : null}
            onGo={(where, g) => navigate(where, { game: g })}
            signedIn={signedIn}
            onSignIn={ACCOUNTS_ENABLED ? openSignIn : null}
            picksProps={picksProps}
          />
        )}
        {view === 'picks' && (
          <PicksIndexPage pickHref={(slug) => routeUrl('pick', { set: slug })} onOpenPick={(slug) => navigate('pick', { set: slug })}
            followed={new Set(options.followedPicks.map((f) => f.slug))} />
        )}
        {view === 'binderIndex' && (
          <BinderIndexPage
            game={game}
            onGameChange={(g) => navigate('binderIndex', { game: g })}
            setsInfo={setsInfo}
            mySets={options.mySets}
            customSets={options.customSets}
            last={options.lastBinder}
            onOpenSet={(g, id) => navigate('binder', { game: g, set: id })}
            onOpenCustom={(g, id) => navigate('binder', { game: g, custom: id })}
          />
        )}
        {view === 'binder' && (() => {
          const cs = route.pick ? pickToCs(routePick) : route.custom ? options.customSets.find((c) => c.id === route.custom) : null;
          const binderGame = cs ? getGame(cs.game) : game;
          const back = route.pick ? ['pick', { set: route.pick }] : cs ? ['custom', { game: cs.game, set: cs.id }] : ['set', { game: route.game, set: route.set }];
          if (route.pick && !cs) {
            return (
              <Container maxWidth="md" sx={{ py: 4 }}>
                {picksState.loaded ? (
                  <>
                    <Typography sx={{ mb: 2 }}>This pick isn’t available any more — it may have been unpublished.</Typography>
                    <Button variant="contained" onClick={() => navigate('picks')}>See all picks</Button>
                  </>
                ) : <PageLoading />}
              </Container>
            );
          }
          if (route.custom && !cs) {
            return (
              <Container maxWidth="md" sx={{ py: 4 }}>
                <Typography sx={{ mb: 2 }}>This custom set isn’t in your collection on this device — custom sets are personal, so links to them only open for their owner.</Typography>
                <Button variant="contained" onClick={() => navigate('sets')}>Go to My sets</Button>
              </Container>
            );
          }
          return (
            <Container maxWidth="xl" sx={{ py: 3 }}>
              <BinderPage
                key={route.key}
                game={binderGame}
                setId={cs ? null : route.set}
                cs={cs}
                setsInfo={setsByGame[binderGame.id] || EMPTY_SETS}
                variants={options.variants}
                owned={owned}
                onToggleOwned={toggleOwned}
                layout={binderLayout}
                onLayout={(l) => { setBinderLayoutOverride(null); setOption('binderLayout', l); }}
                initialPage={route.page}
                initialCard={route.card}
                backLabel={cs ? cs.name : 'Back to set'}
                onBack={() => navigate(...back)}
                shareUrl={({ page, card }) => `${location.origin}${routeUrl('binder', { game: binderGame.id, set: route.set, custom: route.custom, pick: route.pick, layout: layoutParam(binderLayout), page, card })}`}
                onState={({ page, card }) => history.replaceState(null, '', routeUrl('binder', {
                  game: binderGame.id, set: route.set, custom: route.custom, pick: route.pick, layout: layoutParam(binderLayout), page, card,
                }))}
              />
            </Container>
          );
        })()}
        {view === 'need' && (
          <WantListPage
            sources={wantSources}
            getSetsInfo={getSetsInfo}
            variants={options.variants}
            owned={owned}
            onGotIt={gotIt}
            setsHref={routeUrl('sets')}
            onOpenSets={() => navigate('sets')}
          />
        )}
        {view === 'sets' && (
          <MySetsPage
            wantHref={routeUrl('need')}
            onOpenWant={() => navigate('need')}
            game={game}
            onGameChange={(g) => navigate('sets', { game: g })}
            setsInfo={setsInfo}
            mySets={options.mySets}
            customSets={options.customSets}
            customHref={(id) => routeUrl('custom', { game: route.game, set: id })}
            onOpenCustom={(id) => navigate('custom', { game: route.game, set: id })}
            onCreateCustom={createCustomSet}
            owned={owned}
            variants={options.variants}
            setHref={(id) => routeUrl('set', { game: route.game, set: id })}
            onOpenSet={(id) => navigate('set', { game: route.game, set: id })}
            getSetsInfo={getSetsInfo}
            onImport={importCollection}
            followedPicks={followedPicks}
            picksProps={picksProps}
          />
        )}
        {toolView && (
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: drawerView ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 360px' },
            gap: 3,
            alignItems: 'start',
          }}>
            {view === 'pick' ? (
              <PickPage
                key={route.set}
                pick={routePick}
                loaded={picksState.loaded}
                game={game}
                setsInfo={setsInfo}
                variants={options.variants}
                owned={owned}
                queuedKeys={queuedKeys}
                collecting={options.followedPicks.some((f) => f.slug === route.set)}
                onToggleCollect={() => {
                  const was = options.followedPicks.some((f) => f.slug === route.set);
                  toggleFollow(route.set);
                  setToast(was ? 'Removed from My sets' : 'Added to My sets — its missing cards are on your wishlist too');
                }}
                isOwner={!!routePick && routePick.curatorId === userId}
                curator={curator}
                userId={userId}
                onPickSaved={(p, { published }) => { refreshMyPicks(); setToast(published ? 'Pick saved' : 'Pick unpublished — only you can see it'); }}
                onPickDeleted={() => { refreshMyPicks(); navigate('picks'); setToast('Pick deleted'); }}
                // Cards edited on the pick also update the custom set it came from, so they match.
                onCardsSaved={(p, definition) => {
                  refreshMyPicks();
                  if (p.sourceId && options.customSets.some((c) => c.id === p.sourceId)) updateCustomSet(p.sourceId, { picks: definition.picks, hidden: definition.hidden });
                }}
                onToggleOwned={toggleOwned}
                onAddMany={(slots) => { addMany(slots, { track: false }); setSheetOpen(true); }}
                onOpenSheet={() => setSheetOpen(true)}
                onOpenBinder={() => navigate('binder', { game: game.id, pick: route.set })}
                backHref={routeUrl('picks')}
                onBack={() => navigate('picks')}
                shareUrl={() => `${location.origin}${routeUrl('pick', { set: route.set })}`}
                onShared={() => setToast('Link copied')}
              />
            ) : view === 'custom' ? (
              <CustomSetPage
                key={route.set}
                curator={curator}
                userId={userId}
                publishedPick={myPicks.find((p) => p.sourceId === route.set) || null}
                onPickSaved={(p) => {
                  refreshMyPicks();
                  setToast({ message: `Published “${p.title}”`, action: { label: 'View', onClick: () => navigate('pick', { set: p.slug }) } });
                }}
                onPickDeleted={() => { refreshMyPicks(); setToast('Pick deleted'); }}
                cs={options.customSets.find((c) => c.id === route.set)}
                game={game}
                setsInfo={setsInfo}
                variants={options.variants}
                owned={owned}
                queuedKeys={queuedKeys}
                onUpdate={(patch) => updateCustomSet(route.set, patch)}
                onDelete={() => deleteCustomSet(route.set)}
                binders={places.binders}
                locations={places.locations}
                onToggleOwned={toggleOwned}
                onAddMany={(slots) => { addMany(slots, { track: false }); setSheetOpen(true); }}
                onOpenSheet={() => setSheetOpen(true)}
                onOpenBinder={() => navigate('binder', { game: route.game, custom: route.set })}
                backHref={routeUrl('sets', { game: route.game })}
                onBack={() => navigate('sets', { game: route.game })}
              />
            ) : view === 'set' ? (
              <SetPage
                key={`${route.game}|${route.set}`}
                game={game}
                setId={route.set}
                setsInfo={setsInfo}
                variants={options.variants}
                owned={owned}
                queuedKeys={queuedKeys}
                tracked={options.mySets.some((m) => m.game === route.game && m.setId === route.set)}
                place={options.mySets.find((m) => m.game === route.game && m.setId === route.set)}
                binders={places.binders}
                locations={places.locations}
                onSavePlace={(v) => setSetPlace(route.game, route.set, v)}
                onToggleTracked={() => toggleTracked(route.game, route.set)}
                onToggleOwned={toggleOwned}
                onAdd={togglePrint}
                onAddMany={(slots) => { addMany(slots); setSheetOpen(true); }}
                onOpenSheet={() => setSheetOpen(true)}
                onOpenBinder={() => navigate('binder', { game: route.game, set: route.set })}
                backHref={routeUrl('sets', { game: route.game })}
                onBack={() => navigate('sets', { game: route.game })}
              />
            ) : (
            <SearchPanel
              game={game}
              onGameChange={(g) => navigate('search', { game: g })}
              key={route.key}
              initialSetId={route.set}
              initialQuery={route.q}
              onSearched={({ set, query }) => history.replaceState(null, '', routeUrl('search', { game: route.game, set: set?.id, q: query }))}
              setsInfo={setsInfo}
              variants={options.variants}
              queuedKeys={queuedKeys}
              owned={owned}
              onToggleOwned={toggleOwned}
              onAdd={togglePrint}
              onAddMany={addMany}
            />
            )}
            {!drawerView && printSheet(false)}
          </Box>
          {drawerView && (
            <Drawer className="no-print" anchor="right" open={sheetOpen} onClose={() => setSheetOpen(false)}
              slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, bgcolor: 'background.default', backgroundImage: 'none' } } }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2 }}>
                <Button variant="contained" startIcon={<PrintIcon />} disabled={stats.count === 0 || stats.pending > 0 || printing}
                  onClick={() => setPrinting(true)}>
                  {stats.pending ? `Looking up ${readyCount}/${queue.length}` : `Print ${stats.count}`}
                </Button>
                <IconButton aria-label="Close print sheet" onClick={() => setSheetOpen(false)}><CloseIcon /></IconButton>
              </Stack>
              {printSheet(true)}
            </Drawer>
          )}

          <Typography variant="caption" color="text.secondary" component="footer" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
            <SiteFootnote onPrivacy={() => navigate('privacy')} />
          </Typography>
        </Container>
        )}

        </Suspense>

        <Snackbar
          open={!!toast}
          message={toast?.message ?? toast}
          autoHideDuration={toast?.undo || toast?.action ? 8000 : 2000}
          action={toast?.undo ? (
            <Button color="primary" size="small" onClick={() => { toast.undo(); setToast(null); }}>Undo</Button>
          ) : toast?.action && (
            <Button color="primary" size="small" onClick={() => { toast.action.onClick(); setToast(null); }}>{toast.action.label}</Button>
          )}
          onClose={(_, reason) => { if (reason !== 'clickaway') setToast(null); }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>

      <Suspense fallback={null}>
        {waitlist && <WaitlistDialog open audience={waitlist} onClose={() => setWaitlist(null)} queue={queue} count={stats.count} />}
        {printing && <PrintArea queue={queue} options={options} getSetsInfo={getSetsInfo} onDone={() => setPrinting(false)} />}
      </Suspense>
    </>
  );
}

