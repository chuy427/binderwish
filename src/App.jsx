import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppBar, Box, Button, CircularProgress, Container, GlobalStyles, Link, Snackbar, Toolbar, Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import SearchPanel from './components/SearchPanel';
import PrintSheetPanel from './components/PrintSheetPanel';
import PrintArea from './components/PrintArea';
import { fetchCardExtras, loadSets, setIdFromCardId } from './api';

// Key kept from the app's earlier "ProxyScan" name so saved sheets carry over.
const STORAGE_KEY = 'proxyscan.v1';
const DEFAULT_OPTIONS = { paper: 'letter', qrPos: 'br', qrSize: 14, qrOpacity: 100, gap: 0.5, cutLines: true, price: false };
// Parallel detail lookups (TCGPlayer id + price) — kept low to be polite to TCGdex.
const CONCURRENCY = 4;

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      // Re-resolve cards saved without a TCGPlayer product id — the bundled
      // catalog may know them now.
      queue: Array.isArray(saved.queue)
        ? saved.queue.map((c) => (c.tcgplayerId ? c : { ...c, status: 'pending' }))
        : [],
      options: { ...DEFAULT_OPTIONS, ...saved.options },
    };
  } catch {
    return { queue: [], options: DEFAULT_OPTIONS };
  }
}

export default function App() {
  const initial = useMemo(loadSaved, []);
  // queue: [{ id, name, setName, number, image, tcgplayerId, price, qty, status: 'pending'|'ready'|'error' }]
  const [queue, setQueue] = useState(initial.queue);
  const [options, setOptions] = useState(initial.options);
  const [setsInfo, setSetsInfo] = useState({ sets: [], names: new Map(), pocketIds: new Set(), loaded: false });
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ queue, options })); } catch {}
  }, [queue, options]);

  useEffect(() => {
    loadSets()
      .then((info) => setSetsInfo({ ...info, loaded: true }))
      .catch(() => setSetsInfo((s) => ({ ...s, loaded: true })));
  }, []);

  // Background enrichment: cards are added instantly, then their TCGPlayer id
  // and price are fetched a few at a time.
  const inProgress = useRef(new Set());
  useEffect(() => {
    const free = CONCURRENCY - inProgress.current.size;
    if (free <= 0) return;
    const next = queue.filter((c) => c.status === 'pending' && !inProgress.current.has(c.id)).slice(0, free);
    for (const card of next) {
      inProgress.current.add(card.id);
      const finish = (patch) => {
        inProgress.current.delete(card.id);
        setQueue((q) => q.map((c) => (c.id === card.id ? { ...c, ...patch } : c)));
      };
      fetchCardExtras(card.id)
        .then((x) => finish({
          tcgplayerId: x.tcgplayerId,
          price: x.price,
          setName: x.setName || card.setName,
          image: card.image || x.image || null,
          status: 'ready',
        }))
        .catch(() => finish({ status: 'error' }));
    }
  }, [queue]);

  const queuedIds = useMemo(() => new Set(queue.map((c) => c.id)), [queue]);

  const toQueueItem = useCallback((summary, setName) => ({
    id: summary.id,
    name: summary.name,
    setName: setName || setsInfo.names.get(setIdFromCardId(summary.id)) || '',
    number: summary.localId,
    image: summary.image || null,
    tcgplayerId: null,
    price: null,
    qty: 1,
    status: 'pending',
  }), [setsInfo]);

  const addCard = useCallback((summary) => {
    setQueue((q) => (q.some((c) => c.id === summary.id)
      ? q.map((c) => (c.id === summary.id ? { ...c, qty: c.qty + 1 } : c))
      : [...q, toQueueItem(summary)]));
    setToast(`Added ${summary.name}`);
  }, [toQueueItem]);

  const addMany = useCallback((summaries, setName) => {
    setQueue((q) => {
      const have = new Set(q.map((c) => c.id));
      return [...q, ...summaries.filter((s) => !have.has(s.id)).map((s) => toQueueItem(s, setName))];
    });
    setToast(`Added ${summaries.length} cards from ${setName}`);
  }, [toQueueItem]);

  const changeQty = useCallback((id, delta) => {
    setQueue((q) => q.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0));
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
              width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center',
              bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0,
            }}>
              <QrCode2Icon />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h1" sx={{ lineHeight: 1.2 }}>Proxydex</Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                Pokémon proxies with a scannable TCGPlayer price link
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
                ? `Fetching prices ${readyCount}/${queue.length}`
                : `Print ${stats.count} card${stats.count === 1 ? '' : 's'}`}
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
            <SearchPanel setsInfo={setsInfo} queuedIds={queuedIds} onAdd={addCard} onAddMany={addMany} />
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
            Card data & images via <Link href="https://tcgdex.dev" target="_blank" rel="noopener">TCGdex</Link>. Prices link to TCGPlayer.
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

      {printing && <PrintArea queue={queue} options={options} onDone={() => setPrinting(false)} />}
    </>
  );
}
