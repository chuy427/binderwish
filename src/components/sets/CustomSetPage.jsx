import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, LinearProgress, Paper, Stack,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PrintIcon from '@mui/icons-material/Print';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import { SlotCard, SlotSkeletons, gridSx } from '../SlotGrid';
import AddCardsDialog from './AddCardsDialog';
import CustomSetDialog from './CustomSetDialog';
import BinderInfo from './BinderInfo';
import { customSetSlots, hasRules, ruleSummary } from '../../lib/customSets';
import { DISPLAY_FONT, TOMATO } from '../../theme';

const money = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// A custom set: every card matching its Pokémon / characters / artists, plus
// hand-picked cards, minus the ones hidden. Tap to own, like any set page.
export default function CustomSetPage({
  cs, game, setsInfo, variants, owned, queuedKeys, onUpdate, onDelete, binders = [], locations = [],
  onToggleOwned, onAddMany, onOpenSheet, onOpenBinder, onBack, backHref,
}) {
  const [all, setAll] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | missing | owned | hidden
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Hand-picked slots added this visit, shown right away (the full list reloads in the background).
  const [extra, setExtra] = useState([]);

  const defKey = cs ? JSON.stringify([cs.names, cs.artists, cs.picks.map((p) => p.key), variants]) : '';
  useEffect(() => {
    if (!cs || !setsInfo.loaded) return undefined;
    let cancelled = false;
    setError(null);
    customSetSlots(game, cs, setsInfo, variants)
      .then((s) => { if (!cancelled) { setAll(s); setExtra([]); } })
      .catch((e) => { if (!cancelled) setError(`Couldn’t load this set (${e.message}). Try again in a moment.`); });
    return () => { cancelled = true; };
  }, [defKey, setsInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const hidden = useMemo(() => new Set(cs?.hidden || []), [cs]);
  const pickKeys = useMemo(() => new Set((cs?.picks || []).map((p) => p.key)), [cs]);
  const slots = useMemo(() => {
    if (!all) return null;
    const have = new Set(all.map((s) => s.key));
    // Picks added this visit (until the reload lands); drop any since removed.
    return [...all, ...extra.filter((s) => !have.has(s.key))].filter((s) => s.fromRule || pickKeys.has(s.key));
  }, [all, extra, pickKeys]);
  const inSet = useMemo(() => (slots || []).filter((s) => !hidden.has(s.key)), [slots, hidden]);
  const inSetKeys = useMemo(() => new Set(inSet.map((s) => s.key)), [inSet]);

  if (!cs) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Button onClick={onBack} startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2, ml: -1 }}>My sets</Button>
        <Alert severity="warning">This custom set doesn’t exist any more — it may have been deleted on another device.</Alert>
      </Paper>
    );
  }

  const stats = { have: 0, missingValue: 0 };
  for (const s of inSet) {
    if (owned.has(s.key)) stats.have++;
    else if (s.price != null) stats.missingValue += s.price;
  }
  const total = inSet.length;
  const pct = total ? Math.round((stats.have / total) * 100) : 0;
  const missingNotQueued = inSet.filter((s) => !owned.has(s.key) && !queuedKeys.has(s.key));
  const needle = q.trim().toLowerCase();
  const visible = (filter === 'hidden' ? (slots || []).filter((s) => hidden.has(s.key)) : inSet)
    .filter((s) => filter === 'all' || filter === 'hidden' || (filter === 'owned') === owned.has(s.key))
    .filter((s) => !needle || s.name.toLowerCase().includes(needle) || (s.setName || '').toLowerCase().includes(needle));

  const hide = (s) => onUpdate({ hidden: [...cs.hidden, s.key] });
  const unhide = (s) => onUpdate({ hidden: cs.hidden.filter((k) => k !== s.key) });
  const removePick = (s) => onUpdate({ picks: cs.picks.filter((p) => p.key !== s.key) });
  // From the Add cards dialog: add / take out a card.
  const togglePick = (s) => {
    if (inSetKeys.has(s.key)) {
      if (pickKeys.has(s.key)) removePick(s); else hide(s);
    } else if (hidden.has(s.key)) {
      unhide(s);
    } else {
      setExtra((e) => [...e, { ...s, picked: true }]);
      onUpdate({ picks: [...cs.picks, { setId: s.setId, key: s.key }] });
    }
  };

  const back = (
    <Button component="a" href={backHref} onClick={(e) => { e.preventDefault(); onBack(); }} startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2, ml: -1 }}>
      My sets
    </Button>
  );

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      {back}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '220px minmax(0, 1fr)' }, gap: { xs: 2, sm: 3 }, alignItems: 'center' }}>
        <CustomSetArt cs={cs} gameName={game.name} preview={inSet.slice(0, 3)} height={150} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>{game.name} · Custom set</Typography>
          <Typography component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: { xs: 24, md: 32 }, lineHeight: 1.15, mt: 0.5, overflowWrap: 'anywhere' }}>
            {cs.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{ruleSummary(cs) || 'Hand-picked — add any cards you like'}</Typography>
          <BinderInfo binder={cs.binder} location={cs.location} binders={binders} locations={locations}
            onSave={(v) => onUpdate({ binder: v.binder, location: v.location })} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {slots ? (
              <>You own <b>{stats.have}</b> of {total} · {pct}%{stats.missingValue > 0 && <> · missing ≈ <b>{money(stats.missingValue)}</b></>}</>
            ) : hasRules(cs) ? `Finding every ${cs.names[0] || cs.artists[0]} card…` : 'Loading cards…'}
          </Typography>
          <LinearProgress variant={slots ? 'determinate' : 'indeterminate'} value={pct} sx={{ mt: 1, height: 8, borderRadius: 4 }} />
        </Box>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap sx={{ mt: 2.5, flexWrap: 'wrap' }}>
        {slots && total > 0 && !missingNotQueued.length && stats.have < total ? (
          <Button variant="contained" startIcon={<PrintIcon />} onClick={onOpenSheet}>View print sheet</Button>
        ) : (
          <Button variant="contained" startIcon={<PlaylistAddIcon />} disabled={!slots || missingNotQueued.length === 0} onClick={() => onAddMany(missingNotQueued)}>
            {!slots ? 'Add missing to print' : missingNotQueued.length ? `Add ${missingNotQueued.length} missing to print` : total ? 'Set complete' : 'Add missing to print'}
          </Button>
        )}
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add cards</Button>
        <Button variant="outlined" startIcon={<AutoStoriesOutlinedIcon />} onClick={onOpenBinder}>Binder view</Button>
        <Button color="inherit" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>
        <Button color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => setConfirmDelete(true)}>Delete</Button>
      </Stack>

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 3, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField size="small" type="search" placeholder="Filter by name or set" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ flex: '1 1 220px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="missing">Missing</ToggleButton>
          <ToggleButton value="owned">Owned</ToggleButton>
          {cs.hidden.length > 0 && <ToggleButton value="hidden">Hidden ({cs.hidden.length})</ToggleButton>}
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {!slots ? ' '
          : filter === 'hidden' ? 'Cards you’ve left out of this set — tap the eye to put one back.'
          : total ? `${visible.length} slot${visible.length === 1 ? '' : 's'} — tap a card you own to check it off. Use the eye to hide a card from this set.`
          : null}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {slots && !total && filter !== 'hidden' ? (
        <Box sx={{ p: 4, textAlign: 'center', borderRadius: '18px', border: '1px dashed rgba(255,255,255,.14)' }}>
          <Typography sx={{ fontWeight: 700 }}>{hasRules(cs) ? 'No cards matched yet' : 'This set is empty'}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            {hasRules(cs) ? 'Check the spelling under Edit, or add cards by hand.' : 'Add any cards you like — from any set.'}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add cards</Button>
        </Box>
      ) : (
        <Box sx={gridSx}>
          {!slots && !error ? <SlotSkeletons /> : visible.map((s) => (
            <SlotCard key={s.key} slot={s} owned={owned.has(s.key)} queued={queuedKeys.has(s.key)} tapToOwn
              onToggleOwned={() => onToggleOwned(s.key)} onAdd={() => {}}
              hideAction={hidden.has(s.key)
                ? { label: 'Put back in this set', icon: <VisibilityIcon fontSize="small" />, onClick: () => unhide(s) }
                : pickKeys.has(s.key) && !s.fromRule
                  ? { label: 'Remove from this set', icon: <CloseIcon fontSize="small" />, onClick: () => removePick(s) }
                  : { label: 'Hide from this set', icon: <VisibilityOffOutlinedIcon fontSize="small" />, onClick: () => hide(s) }} />
          ))}
        </Box>
      )}

      <AddCardsDialog open={adding} onClose={() => setAdding(false)} game={game} setsInfo={setsInfo}
        pickedKeys={inSetKeys} owned={owned} onTogglePick={togglePick} />
      <CustomSetDialog open={editing} initial={cs} defaultGame={cs.game} onClose={() => setEditing(false)}
        onSave={(v) => { onUpdate({ name: v.name, names: v.names, artists: v.artists }); setEditing(false); }} />
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete “{cs.name}”?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This removes the custom set. Cards you’ve checked off stay owned, and anything on your print sheet stays there.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => { setConfirmDelete(false); onDelete(); }}>Delete set</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// A custom set's cover: a small fan of its first cards, or its name when empty.
export function CustomSetArt({ cs, gameName, preview = [], height = 160 }) {
  return (
    <Box sx={{ height, borderRadius: '18px', position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center',
      bgcolor: '#171717', border: '1px solid rgba(255,99,71,.35)',
      backgroundImage: 'radial-gradient(ellipse at 50% 120%, rgba(255,99,71,.2), transparent 65%)' }}>
      {preview.length ? (
        <Box sx={{ position: 'relative', height: height - 36, width: '100%' }}>
          {preview.map((s, i) => {
            const n = preview.length;
            const offset = i - (n - 1) / 2;
            const img = s.images?.small;
            return img ? (
              <Box key={s.key} component="img" src={img} alt="" loading="lazy"
                sx={{ position: 'absolute', left: '50%', top: 0, height: '100%', aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: '6px',
                  transform: `translateX(calc(-50% + ${offset * 38}%)) rotate(${offset * 8}deg)`, transformOrigin: 'bottom center',
                  boxShadow: '0 10px 24px rgba(0,0,0,.5)', zIndex: i === Math.floor(n / 2) ? 2 : 1 }} />
            ) : null;
          })}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', px: 2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: TOMATO }}>{gameName} · Custom</Typography>
          <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 22, lineHeight: 1.1, mt: 0.5, overflowWrap: 'anywhere' }}>{cs.name}</Typography>
        </Box>
      )}
    </Box>
  );
}
