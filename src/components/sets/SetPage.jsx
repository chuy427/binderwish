import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, InputAdornment, LinearProgress, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PrintIcon from '@mui/icons-material/Print';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import { SetLogo, releaseLabel } from './SetTile';
import { SlotCard, SlotSkeletons, gridSx } from '../SlotGrid';
import { setSlots } from '../../catalog';
import { DISPLAY_FONT } from '../../theme';

const money = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// One set's page: its header (logo, series, release, progress) and every card —
// and, for master sets, every variant — to check off or add to the print sheet.
export default function SetPage({
  game, setId, setsInfo, variants, owned, queuedKeys, tracked,
  onToggleTracked, onToggleOwned, onAdd, onAddMany, onOpenSheet, onBack, backHref,
}) {
  const set = setsInfo.sets.find((s) => s.id === setId);
  const [slots, setSlotsState] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | missing | owned
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!setsInfo.loaded || !set) return undefined;
    let cancelled = false;
    setSlotsState(null); setError(null);
    setSlots(game, setId, setsInfo, { variants })
      .then((s) => { if (!cancelled) setSlotsState(s); })
      .catch((e) => { if (!cancelled) setError(`Couldn’t load this set (${e.message}). Try again in a moment.`); });
    return () => { cancelled = true; };
  }, [game, setId, setsInfo, variants, !!set]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    let have = 0, missingValue = 0;
    for (const s of slots || []) {
      if (owned.has(s.key)) have++;
      else if (s.price != null) missingValue += s.price;
    }
    return { have, total: slots?.length || 0, missingValue };
  }, [slots, owned]);
  const pct = stats.total ? Math.round((stats.have / stats.total) * 100) : 0;
  const missingNotQueued = (slots || []).filter((s) => !owned.has(s.key) && !queuedKeys.has(s.key));
  const needle = q.trim().toLowerCase();
  const visible = (slots || []).filter((s) => (filter === 'all' || (filter === 'owned') === owned.has(s.key))
    && (!needle || s.name.toLowerCase().includes(needle) || String(s.numberLabel || '').toLowerCase().includes(needle)));

  const back = (
    <Button component="a" href={backHref} onClick={(e) => { e.preventDefault(); onBack(); }} startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2, ml: -1 }}>
      My sets
    </Button>
  );

  if (setsInfo.loaded && !set) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        {back}
        <Alert severity="warning">We couldn’t find that {game.name} set. It may have been renamed — pick it again from My sets.</Alert>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      {back}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '220px minmax(0, 1fr)' }, gap: { xs: 2, sm: 3 }, alignItems: 'center' }}>
        <Box sx={{ height: 150, borderRadius: '18px', display: 'grid', placeItems: 'center', p: 2, bgcolor: '#141414', border: '1px solid rgba(255,255,255,.07)',
          backgroundImage: 'radial-gradient(ellipse at 50% 120%, rgba(255,99,71,.18), transparent 65%)' }}>
          {set && <SetLogo set={set} gameName={game.name} height={110} />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {[game.name, set?.series].filter(Boolean).join(' · ')}
          </Typography>
          <Typography component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: { xs: 24, md: 32 }, lineHeight: 1.15, mt: 0.5 }}>
            {set?.name || '…'}
          </Typography>
          {set?.released && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{releaseLabel(set.released)}</Typography>}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {slots ? (
              <>You own <b>{stats.have}</b> of {stats.total}{variants ? ' (master set)' : ''} · {pct}%
                {stats.missingValue > 0 && <> · missing ≈ <b>{money(stats.missingValue)}</b></>}</>
            ) : 'Loading cards…'}
          </Typography>
          <LinearProgress variant={slots ? 'determinate' : 'indeterminate'} value={pct} sx={{ mt: 1, height: 8, borderRadius: 4 }} />
        </Box>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
        {slots && !missingNotQueued.length && stats.have < stats.total ? (
          <Button variant="contained" startIcon={<PrintIcon />} onClick={onOpenSheet}>View print sheet</Button>
        ) : (
          <Button variant="contained" startIcon={<PlaylistAddIcon />} disabled={!slots || missingNotQueued.length === 0} onClick={() => onAddMany(missingNotQueued)}>
            {!slots ? 'Add missing to print' : missingNotQueued.length ? `Add ${missingNotQueued.length} missing to print` : 'Set complete'}
          </Button>
        )}
        <Button variant={tracked ? 'text' : 'outlined'} startIcon={tracked ? <BookmarkAddedIcon /> : <BookmarkAddOutlinedIcon />} onClick={onToggleTracked}>
          {tracked ? 'In My sets — remove' : 'Add to My sets'}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 3, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField size="small" type="search" placeholder="Filter by name or number" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ flex: '1 1 220px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="missing">Missing</ToggleButton>
          <ToggleButton value="owned">Owned</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {slots ? `${visible.length} slot${visible.length === 1 ? '' : 's'} — tap a card you own to check it off.` : ' '}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={gridSx}>
        {!slots && !error ? <SlotSkeletons /> : visible.map((s) => (
          <SlotCard key={s.key} slot={s} owned={owned.has(s.key)} queued={queuedKeys.has(s.key)}
            onToggleOwned={() => onToggleOwned(s.key, s)} onAdd={() => onAdd(s)} tapToOwn />
        ))}
      </Box>
    </Paper>
  );
}
