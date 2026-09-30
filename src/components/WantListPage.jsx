import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Collapse, Container, IconButton, InputAdornment, Link, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import { useWantList } from '../lib/useWantList';
import { tcgplayerUrl } from '../catalog';
import { DISPLAY_FONT } from '../theme';

const money = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PRICE_FILTERS = [{ id: 0, label: 'All' }, { id: 5, label: '$5+' }, { id: 20, label: '$20+' }, { id: 50, label: '$50+' }];
const since = (t) => {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Card-show mode: everything still missing from your sets and custom sets, as a
// fast list — search it, filter by price, tap "Got it" when you buy one. Saved on
// the device so it works with no signal.
export default function WantListPage({ sources, getSetsInfo, variants, owned, onGotIt, onOpenSets, setsHref }) {
  const { groups, at, loading, offline: loadFailed, allOffline } = useWantList(sources, getSetsInfo, variants);
  // The device's own connection status (the list may have loaded fine from its saved copy).
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  const offline = loadFailed || !online;
  const [q, setQ] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [sort, setSort] = useState('binder'); // binder | price
  const [closed, setClosed] = useState(() => new Set());

  // Each card once (a card in both its set and a custom set shows in the first).
  const shown = useMemo(() => {
    const seen = new Set();
    const needle = q.trim().toLowerCase();
    return groups.map((g) => {
      const rows = g.slots.filter((s) => {
        if (owned.has(s.key) || seen.has(s.key)) return false;
        seen.add(s.key);
        if (minPrice && !(s.price >= minPrice)) return false;
        return !needle || s.name.toLowerCase().includes(needle) || String(s.numberLabel).toLowerCase().includes(needle)
          || (s.setName || '').toLowerCase().includes(needle);
      });
      return { ...g, rows, value: rows.reduce((t, s) => t + (s.price || 0), 0) };
    });
  }, [groups, owned, q, minPrice]);
  const total = shown.reduce((t, g) => t + g.rows.length, 0);
  const value = shown.reduce((t, g) => t + g.value, 0);
  const flat = useMemo(() => (sort === 'price'
    ? shown.flatMap((g) => g.rows.map((r) => ({ ...r, group: g }))).sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
    : null), [shown, sort]);

  const toggleGroup = (id) => setClosed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const row = (s, showSet) => (
    <Stack key={s.key} direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.75, px: { xs: 0.5, sm: 1 }, borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <Tooltip title="Got it — mark as owned">
        <IconButton onClick={() => onGotIt(s)} aria-label={`Got it: ${s.name}${s.variantLabel ? ` (${s.variantLabel})` : ''}`}
          sx={{ color: 'text.secondary', '&:hover': { color: 'success.main' } }}>
          <CheckCircleOutlineIcon />
        </IconButton>
      </Tooltip>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.25 }} noWrap>{s.name}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          #{s.numberLabel}{s.variantLabel ? ` · ${s.variantLabel}` : ''}{showSet && s.setName ? ` · ${s.setName}` : ''}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>
        {s.price != null ? money(s.price) : '—'}
      </Typography>
      <Tooltip title="Open on TCGPlayer">
        <IconButton component="a" href={tcgplayerUrl(s)} target="_blank" rel="noopener" size="small" aria-label={`Open ${s.name} on TCGPlayer`}
          sx={{ color: 'text.secondary', display: offline ? 'none' : 'inline-flex' }}>
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="overline" color="primary">Card show mode</Typography>
      <Typography variant="h1" sx={{ fontFamily: DISPLAY_FONT, fontSize: { xs: 34, md: 48 }, mt: 0.5 }}>Want list</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Everything you still need from <Link href={setsHref} onClick={(e) => { e.preventDefault(); onOpenSets(); }}>My sets</Link> and
        your custom sets. Tap <CheckCircleOutlineIcon sx={{ fontSize: 17, verticalAlign: '-3px' }} /> the moment you buy one.
      </Typography>

      {/* Offline status */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ mt: 2, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}>
        {sources.length > 0 && (
          <Chip size="small" variant="outlined"
            icon={offline ? <CloudOffIcon /> : <CloudDoneIcon />}
            color={offline ? 'warning' : 'success'}
            label={offline
              ? (at ? `Offline — showing your list from ${since(at)}` : 'Offline')
              : loading ? 'Updating prices…' : `Saved for offline · updated ${since(at)}`} />
        )}
      </Stack>

      {!sources.length ? (
        <Box sx={{ mt: 4, p: 4, textAlign: 'center', borderRadius: '18px', border: '1px dashed rgba(255,255,255,.14)' }}>
          <Typography sx={{ fontWeight: 700 }}>Nothing on your list yet</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            Open a set in My sets (or make a custom set) and its missing cards show up here.
          </Typography>
          <Button variant="contained" onClick={onOpenSets}>Go to My sets</Button>
        </Box>
      ) : (
        <>
          {allOffline && !groups.length && (
            <Alert severity="warning" sx={{ mt: 3 }}>You’re offline and this device hasn’t saved your list yet. Open it once with a connection and it’ll work offline after that.</Alert>
          )}

          {/* Totals + filters */}
          <Box sx={{ mt: 3, p: 2, borderRadius: '16px', bgcolor: '#171717', border: '1px solid rgba(255,255,255,.07)' }}>
            <Stack direction="row" spacing={3} sx={{ alignItems: 'baseline' }}>
              <Box><Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 26 }}>{total}</Typography><Typography variant="body2" color="text.secondary">cards to find</Typography></Box>
              <Box><Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 26 }}>{money(value)}</Typography><Typography variant="body2" color="text.secondary">at market price</Typography></Box>
            </Stack>
            <TextField fullWidth size="small" type="search" placeholder="Search name, number or set" value={q} onChange={(e) => setQ(e.target.value)}
              sx={{ mt: 2 }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRICE_FILTERS.map((f) => (
                <Chip key={f.id} label={f.label} onClick={() => setMinPrice(f.id)} color={minPrice === f.id ? 'primary' : 'default'}
                  variant={minPrice === f.id ? 'filled' : 'outlined'} />
              ))}
              <Box sx={{ flex: 1 }} />
              <ToggleButtonGroup size="small" exclusive value={sort} onChange={(_, v) => v && setSort(v)} aria-label="Sort">
                <ToggleButton value="binder">By set</ToggleButton>
                <ToggleButton value="price">Price ↓</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Box>

          {/* The list */}
          <Box sx={{ mt: 2 }}>
            {flat ? (
              <Box sx={{ borderRadius: '16px', bgcolor: '#141414', border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
                {flat.map((s) => row(s, true))}
                {!flat.length && <Typography color="text.secondary" sx={{ p: 2 }}>No cards match.</Typography>}
              </Box>
            ) : shown.map((g) => (
              <Box key={g.id} sx={{ mb: 1.5, borderRadius: '16px', bgcolor: '#141414', border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
                <Box component="button" type="button" onClick={() => toggleGroup(g.id)} aria-expanded={!closed.has(g.id)}
                  sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1, p: 1.5, pl: 2, font: 'inherit', color: 'inherit', textAlign: 'left',
                    bgcolor: 'transparent', border: 0, cursor: 'pointer' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }} noWrap>{g.title}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {g.kind === 'custom' ? `${g.gameName} · Custom set` : g.gameName}
                      {(g.binder || g.location) && <> · <CollectionsBookmarkOutlinedIcon sx={{ fontSize: 14, verticalAlign: '-2px' }} /> {[g.binder, g.location].filter(Boolean).join(' · ')}</>}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{g.rows.length}</Typography>
                    <Typography variant="caption" color="text.secondary">{g.value ? money(g.value) : ''}</Typography>
                  </Box>
                  <ExpandMoreIcon sx={{ transform: closed.has(g.id) ? 'rotate(-90deg)' : 'none', transition: 'transform .2s', color: 'text.secondary' }} />
                </Box>
                <Collapse in={!closed.has(g.id)} unmountOnExit>
                  {g.rows.map((s) => row(s, g.kind === 'custom'))}
                  {!g.rows.length && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
                      {q || minPrice ? 'No cards match.' : 'Complete — nothing left to find!'}
                    </Typography>
                  )}
                </Collapse>
              </Box>
            ))}
            {loading && !groups.length && <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Loading your sets…</Typography>}
          </Box>
        </>
      )}
    </Container>
  );
}
