import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppBar, Box, Button, CircularProgress, Container, GlobalStyles, Link, Snackbar, Toolbar, Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import SearchPanel from './components/SearchPanel';
import PrintSheetPanel from './components/PrintSheetPanel';
import PrintArea from './components/PrintArea';
import { fetchCardExtras, loadSets } from './api';

// Keys kept from the app's earlier "ProxyScan" name so saved data carries over.
const STORAGE_KEY = 'proxyscan.v1';
const OWNED_KEY = 'binderwish.owned';
const DEFAULT_OPTIONS = {
  paper: 'letter', style: 'ghost', qrPos: 'br', qrSize: 14, gap: 0.5, cutLines: true, price: false,
  variants: true, keepPositions: false, newPagePerSet: true,
};
// Parallel TCGdex lookups for cards the bundled catalog couldn't match.
const CONCURRENCY = 4;

// Print-sheet items saved by the pre-BinderWish version were one per card, not per
// variant — give them the fields the slot-based code expects.
function migrateItem(c) {
  if (c.key) return c;
  return {
    ...c,
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

function loadSaved() {
  let queue = [], options = DEFAULT_OPTIONS, owned = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(saved.queue)) {
      queue = saved.queue.map(migrateItem).map((c) => (c.needsLookup && !c.tcgplayerId ? { ...c, status: 'pending' } : c));
    }
    options = { ...DEFAULT_OPTIONS, ...saved.options };
    delete options.qrOpacity; // removed option
  } catch {}
  try { owned = new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')); } catch {}
  return { queue, options, owned };
}

// Binder order: sets in the order they were first added, then set order within each.
function sortQueue(queue) {
  const setRank = new Map();
  queue.forEach((c) => { if (!setRank.has(c.setId)) setRank.set(c.setId, setRank.size); });
  return [...queue].sort((a, b) => setRank.get(a.setId) - setRank.get(b.setId) || a.order - b.order);
}

export default function App() {
  const initial = useMemo(loadSaved, []);
  // queue: binder slots to print, each with a qty (see api.js makeSlot for the shape)
  const [queue, setQueue] = useState(initial.queue);
  const [options, setOptions] = useState(initial.options);
  const [owned, setOwned] = useState(initial.owned);
  const [setsInfo, setSetsInfo] = useState({ sets: [], names: new Map(), official: new Map(), pocketIds: new Set(), loaded: false });
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ queue, options })); } catch {}
  }, [queue, options]);
  useEffect(() => {
    try { localStorage.setItem(OWNED_KEY, JSON.stringify([...owned])); } catch {}
  }, [owned]);

  useEffect(() => {
    loadSets()
      .then((info) => setSetsInfo({ ...info, loaded: true }))
      .catch(() => setSetsInfo((s) => ({ ...s, loaded: true })));
  }, []);

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
      fetchCardExtras(item.cardId)
        .then((x) => finish({
          tcgplayerId: x.tcgplayerId,
          price: item.price ?? x.price,
          setName: item.setName || x.setName,
          image: item.image || x.image || null,
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
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar sx={{ gap: 2 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center',
              bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0,
            }}>
              <CollectionsBookmarkIcon />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h1" sx={{ lineHeight: 1.2 }}>BinderWish</Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                Placeholder cards for your master set binder — scan to find the real one
              </Typography>
            </Box>
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
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
            gap: 3,
            alignItems: 'start',
          }}>
            <SearchPanel
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
            />
          </Box>

          <Typography variant="caption" color="text.secondary" component="footer" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
            Placeholders are binder fillers for cards you’re still collecting — not playable or sellable cards.
            Card data & images via <Link href="https://tcgdex.dev" target="_blank" rel="noopener">TCGdex</Link>; product links to TCGPlayer.
            Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. Not affiliated.
          </Typography>
        </Container>

        <Snackbar
          open={!!toast}
          message={toast}
          autoHideDuration={2000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>

      {printing && <PrintArea queue={queue} options={options} setsInfo={setsInfo} onDone={() => setPrinting(false)} />}
    </>
  );
}
