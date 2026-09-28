import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppBar, Box, Button, IconButton, CircularProgress, Container, GlobalStyles, Link, Snackbar, Toolbar, Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CollectionsIcon from '@mui/icons-material/Collections';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import SearchPanel from './components/SearchPanel';
import PrintSheetPanel from './components/PrintSheetPanel';
import PrintArea from './components/PrintArea';
import HomePage from './components/HomePage';
import BackupSection from './components/BackupSection';
import PrivacyPage from './components/PrivacyPage';
import SiteFootnote from './components/SiteFootnote';
import WaitlistDialog, { WAITLIST_ENABLED } from './components/WaitlistDialog';
import { downloadBackup, mergeBackup } from './lib/backup';
import { DEFAULT_GAME, GAMES, getGame } from './games';
import { DISPLAY_FONT } from './theme';

// Keys kept from the app's earlier "ProxyScan" name so saved data carries over.
const STORAGE_KEY = 'proxyscan.v1';
const OWNED_KEY = 'binderwish.owned';
const DEFAULT_OPTIONS = {
  paper: 'letter', cardStyle: 'art', qrCorner: 'auto', qrSize: 14, qrLogo: null, gap: 0.5, cutLines: true, price: false,
  variants: true, keepPositions: false, newPagePerSet: true,
};
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
// Real paths (/search) rather than hash routes. GitHub Pages serves unknown paths
// from 404.html, which the build makes a copy of index.html, so deep links and
// refreshes load the app.
const BASE = import.meta.env.BASE_URL; // e.g. "/binderwish/"

function routeUrl(view, { game, set, q } = {}) {
  if (view === 'privacy') return `${BASE}privacy`;
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
  return {
    view: ({ search: 'search', privacy: 'privacy' })[path.replace(/\/$/, '')] || 'home',
    game: GAMES[params.get('game')] ? params.get('game') : DEFAULT_GAME,
    set: params.get('set') || null,
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
    options = { ...DEFAULT_OPTIONS, ...saved.options };
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
  const [toast, setToast] = useState(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  // Routes: <base> = home, <base>search?set=<id>|q=<name> = the tool.
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (view, params = {}) => {
    history.pushState(null, '', routeUrl(view, params));
    setRoute(readRoute());
    window.scrollTo(0, 0);
  };
  const view = route.view;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ queue, options })); } catch {}
  }, [queue, options]);
  useEffect(() => {
    try { localStorage.setItem(OWNED_KEY, JSON.stringify([...owned])); } catch {}
  }, [owned]);

  // The current game's sets, plus Pokémon's for the home page showcase.
  useEffect(() => { getSetsInfo(route.game); getSetsInfo(DEFAULT_GAME); }, [route.game, getSetsInfo]);
  const game = getGame(route.game);
  const setsInfo = setsByGame[route.game] || EMPTY_SETS;

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

  const addSlot = useCallback((slot) => {
    if (owned.has(slot.key)) {
      setToast('You own this one — unmark it (✓) to print a placeholder');
      return;
    }
    setQueue((q) => sortQueue(q.some((c) => c.key === slot.key)
      ? q.map((c) => (c.key === slot.key ? { ...c, qty: c.qty + 1 } : c))
      : [...q, toItem(slot)]));
    setToast(`Added ${slot.name}${slot.variantLabel ? ` (${slot.variantLabel})` : ''}`);
  }, [owned]);

  const addMany = useCallback((slots) => {
    setQueue((q) => {
      const have = new Set(q.map((c) => c.key));
      return sortQueue([...q, ...slots.filter((s) => !have.has(s.key)).map(toItem)]);
    });
    setToast(`Added ${slots.length} placeholder${slots.length === 1 ? '' : 's'}`);
  }, []);

  // Marking a card owned also takes it off the print sheet — no placeholder needed.
  const toggleOwned = useCallback((key) => {
    const adding = !owned.has(key);
    setOwned((prev) => {
      const next = new Set(prev);
      if (adding) next.add(key); else next.delete(key);
      return next;
    });
    if (adding) setQueue((q) => q.filter((c) => c.key !== key));
  }, [owned]);

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
      setOptions({ ...DEFAULT_OPTIONS, ...data.options });
      setToast(`Replaced with backup: ${data.owned.length} owned, ${data.queue.length} on print sheet`);
    } else {
      const merged = mergeBackup({ owned: [...owned], queue }, data);
      setOwned(merged.owned);
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

  return (
    <>
      <GlobalStyles styles={`@page { size: ${options.paper === 'a4' ? 'A4' : 'letter'} portrait; margin: 0; }`} />

      <Box className="no-print" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="sticky" color="inherit" elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(17,17,17,.72)', backdropFilter: 'blur(14px)' }}>
          <Toolbar sx={{ gap: 2 }}>
            <Box component="a" href={BASE} onClick={(e) => { e.preventDefault(); navigate('home'); }} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'inherit', textDecoration: 'none', flex: 1, minWidth: 0 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center',
                bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0,
              }}>
                <CollectionsBookmarkIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="div" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 18, lineHeight: 1.2, letterSpacing: '-.01em' }}>BinderWish</Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                  Placeholder cards for your master set binder — scan to find the real one
                </Typography>
              </Box>
            </Box>
            {view !== 'search' ? (
              <Button variant="contained" size="large" startIcon={<CollectionsIcon />} onClick={() => navigate('search')}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Open my binder</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Binder</Box>
              </Button>
            ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={stats.pending ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
              disabled={stats.count === 0 || stats.pending > 0 || printing}
              onClick={() => setPrinting(true)}
            >
              {stats.pending
                ? `Looking up ${readyCount}/${queue.length}`
                : printing ? 'Preparing…' : `Print ${stats.count}`}
            </Button>
            )}
            {view === 'search' && WAITLIST_ENABLED && (
              <>
                <Button
                  variant="outlined" size="large" startIcon={<LocalShippingIcon />}
                  onClick={() => setWaitlistOpen(true)}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}
                >
                  Get them printed
                </Button>
                <IconButton color="primary" aria-label="Get them printed" onClick={() => setWaitlistOpen(true)}
                  sx={{ display: { xs: 'inline-flex', sm: 'none' }, border: 1, borderColor: 'divider' }}>
                  <LocalShippingIcon />
                </IconButton>
              </>
            )}
          </Toolbar>
        </AppBar>

        {view === 'privacy' && <PrivacyPage />}
        {view === 'home' && (
          <HomePage
            setsByGame={setsByGame}
            loadGameSets={getSetsInfo}
            onStart={({ game: g, set, query }) => navigate('search', { game: g, set: set?.id, q: query })}
            onPrivacy={() => navigate('privacy')}
          />
        )}
        {view === 'search' && (
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
            gap: 3,
            alignItems: 'start',
          }}>
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
              onAdd={addSlot}
              onAddMany={addMany}
            />
            <PrintSheetPanel
              queue={queue}
              options={options}
              setOption={setOption}
              onQty={changeQty}
              onClear={() => setQueue([])}
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
          </Box>

          <Typography variant="caption" color="text.secondary" component="footer" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
            <SiteFootnote onPrivacy={() => navigate('privacy')} />
          </Typography>
        </Container>
        )}

        <Snackbar
          open={!!toast}
          message={toast}
          autoHideDuration={2000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>

      <WaitlistDialog open={waitlistOpen} onClose={() => setWaitlistOpen(false)} queue={queue} count={stats.count} />
      {printing && <PrintArea queue={queue} options={options} getSetsInfo={getSetsInfo} onDone={() => setPrinting(false)} />}
    </>
  );
}

