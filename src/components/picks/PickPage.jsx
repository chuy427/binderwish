import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, InputAdornment, LinearProgress, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PrintIcon from '@mui/icons-material/Print';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import EditIcon from '@mui/icons-material/Edit';
import { SlotCard, SlotSkeletons, gridSx } from '../SlotGrid';
import { CuratorLine, PickArt } from './PickParts';
import PublishPickDialog from './PublishPickDialog';
import { customSetSlots } from '../../lib/customSets';
import { pickToCs } from '../../lib/picks';
import { DISPLAY_FONT } from '../../theme';

const money = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthYear = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '');

// A BinderWish pick: the curator's description and every card, tap to own —
// "Collect" adds it to My sets (and the wishlist), following later changes.
export default function PickPage({
  pick, loaded, game, setsInfo, variants, owned, queuedKeys, collecting, onToggleCollect, isOwner, curator, userId, onPickSaved, onPickDeleted,
  onToggleOwned, onAddMany, onOpenSheet, onOpenBinder, onBack, backHref, shareUrl, onShared,
}) {
  const [all, setAll] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const cs = useMemo(() => pickToCs(pick), [pick]);
  const defKey = cs ? JSON.stringify([cs.names, cs.artists, cs.picks.map((p) => p.key), variants]) : '';

  useEffect(() => {
    if (!cs || !setsInfo.loaded) return undefined;
    let cancelled = false;
    setError(null);
    customSetSlots(game, cs, setsInfo, variants)
      .then((s) => { if (!cancelled) setAll(s); })
      .catch((e) => { if (!cancelled) setError(`Couldn’t load this pick (${e.message}). Try again in a moment.`); });
    return () => { cancelled = true; };
  }, [defKey, setsInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const inSet = useMemo(() => {
    if (!all) return null;
    const hidden = new Set(cs.hidden);
    return all.filter((s) => !hidden.has(s.key));
  }, [all, cs]);

  const back = (
    <Button component="a" href={backHref} onClick={(e) => { e.preventDefault(); onBack(); }} startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2, ml: -1 }}>
      All picks
    </Button>
  );
  if (!pick) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        {back}
        {loaded ? <Alert severity="warning">This pick isn’t available any more — it may have been unpublished.</Alert> : <CircularProgress size={28} />}
      </Paper>
    );
  }

  const stats = { have: 0, missingValue: 0 };
  for (const s of inSet || []) {
    if (owned.has(s.key)) stats.have++;
    else if (s.price != null) stats.missingValue += s.price;
  }
  const total = inSet?.length || 0;
  const pct = total ? Math.round((stats.have / total) * 100) : 0;
  const missingNotQueued = (inSet || []).filter((s) => !owned.has(s.key) && !queuedKeys.has(s.key));
  const needle = q.trim().toLowerCase();
  const visible = (inSet || [])
    .filter((s) => filter === 'all' || (filter === 'owned') === owned.has(s.key))
    .filter((s) => !needle || s.name.toLowerCase().includes(needle) || (s.setName || '').toLowerCase().includes(needle));
  const setCount = new Set((inSet || []).map((s) => s.setId)).size;
  const kindLabel = pick.curator.kind === 'binderwish' ? 'BinderWish pick' : pick.curator.kind === 'vendor' ? 'Vendor pick' : 'Creator pick';

  async function share() {
    const url = shareUrl();
    try {
      if (navigator.share) await navigator.share({ title: pick.title, url });
      else { await navigator.clipboard.writeText(url); onShared?.(); }
    } catch { /* dismissed */ }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      {back}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '240px minmax(0, 1fr)' }, gap: { xs: 2, sm: 3 }, alignItems: 'start' }}>
        <PickArt pick={pick} height={170} />
        <Box sx={{ minWidth: 0 }}>
          <Box component="span" sx={{ display: 'inline-block', fontSize: 12, fontWeight: 600, px: 1.25, py: 0.4, borderRadius: 99, bgcolor: 'rgba(255,99,71,.14)', color: 'primary.main' }}>
            {game.name} · {kindLabel}
          </Box>
          <Typography component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: { xs: 24, md: 32 }, lineHeight: 1.15, mt: 1, overflowWrap: 'anywhere' }}>
            {pick.title}
          </Typography>
          {pick.description && (
            <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line', maxWidth: 720 }}>{pick.description}</Typography>
          )}
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.25, alignItems: 'center', flexWrap: 'wrap', color: 'text.secondary' }}>
            <Typography variant="body2" color="text.secondary">Curated by</Typography>
            <CuratorLine curator={pick.curator} />
            <Typography variant="body2" color="text.secondary">
              · {inSet ? total : pick.count} cards{inSet && setCount > 1 ? ` across ${setCount} sets` : ''}{pick.updated ? ` · updated ${monthYear(pick.updated)}` : ''}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {inSet ? <>You own <b>{stats.have}</b> of {total} · {pct}%{stats.missingValue > 0 && <> · missing ≈ <b>{money(stats.missingValue)}</b></>}</> : 'Loading cards…'}
          </Typography>
          <LinearProgress variant={inSet ? 'determinate' : 'indeterminate'} value={pct} sx={{ mt: 1, height: 8, borderRadius: 4 }} />
        </Box>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap sx={{ mt: 2.5, flexWrap: 'wrap' }}>
        <Button variant={collecting ? 'outlined' : 'contained'} startIcon={collecting ? <CheckIcon /> : <AddIcon />} onClick={onToggleCollect}>
          {collecting ? 'Collecting' : 'Collect this set'}
        </Button>
        {inSet && total > 0 && !missingNotQueued.length && stats.have < total ? (
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={onOpenSheet}>View print sheet</Button>
        ) : (
          <Button variant="outlined" startIcon={<PlaylistAddIcon />} disabled={!inSet || !missingNotQueued.length} onClick={() => onAddMany(missingNotQueued)}>
            {inSet && missingNotQueued.length ? `Add ${missingNotQueued.length} missing to print` : inSet && total ? 'Set complete' : 'Add missing to print'}
          </Button>
        )}
        <Button variant="outlined" startIcon={<AutoStoriesOutlinedIcon />} onClick={onOpenBinder}>Binder view</Button>
        <Button color="inherit" startIcon={<LinkIcon />} onClick={share}>Share</Button>
        {isOwner && <Button color="inherit" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit pick</Button>}
      </Stack>
      {isOwner && !pick.published && <Alert severity="info" sx={{ mt: 2 }}>This pick is unpublished — only you can see it.</Alert>}

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 3, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField size="small" type="search" placeholder="Filter by name or set" value={q} onChange={(e) => setQ(e.target.value)} sx={{ flex: '1 1 220px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="missing">Missing</ToggleButton>
          <ToggleButton value="owned">Owned</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={gridSx}>
        {!inSet && !error ? <SlotSkeletons /> : visible.map((s) => (
          <SlotCard key={s.key} slot={s} owned={owned.has(s.key)} queued={queuedKeys.has(s.key)} tapToOwn
            onToggleOwned={() => onToggleOwned(s.key)} onAdd={() => {}} />
        ))}
      </Box>
      {isOwner && (
        <PublishPickDialog open={editing} onClose={() => setEditing(false)} userId={userId} curator={curator}
          existing={pick} source={null} slots={inSet}
          onSaved={(p, info) => { setEditing(false); onPickSaved(p, info); }}
          onDeleted={() => { setEditing(false); onPickDeleted(); }} />
      )}
    </Paper>
  );
}
