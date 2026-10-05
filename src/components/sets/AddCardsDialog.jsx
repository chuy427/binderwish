import { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography, useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { SlotCard, SlotSkeletons, gridSx } from '../SlotGrid';
import { setSlots, slotsForSearch } from '../../catalog';

// Hand-pick cards for a custom set: search any card by name, or open a set and
// browse its cards; tap to add / remove.
export default function AddCardsDialog({ open, onClose, game, setsInfo, pickedKeys, owned, onTogglePick, onSetMany }) {
  const phone = useMediaQuery('(max-width:600px)');
  const [q, setQ] = useState('');
  const [slots, setSlotsState] = useState([]);
  const [cards, setCards] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState('');
  const [mode, setMode] = useState('name'); // name | set
  const [set, setSet] = useState(null); // { id, name } in set mode
  const [browse, setBrowse] = useState(null); // the chosen set's slots
  const [filter, setFilter] = useState('');

  async function openSet(s) {
    setSet(s); setBrowse(null); setFilter(''); setError(null);
    if (!s) return;
    setLoading(true);
    try {
      setBrowse(await setSlots(game, s.id, setsInfo, { variants: true }));
    } catch (e) {
      setError(`Couldn’t load that set (${e.message}). Try again in a moment.`);
    } finally {
      setLoading(false);
    }
  }
  const needle = filter.trim().toLowerCase();
  const setShown = useMemo(() => (browse || []).filter((sl) => !needle || sl.name.toLowerCase().includes(needle)
    || String(sl.numberLabel || sl.number).toLowerCase().includes(needle)), [browse, needle]);
  const shown = mode === 'set' ? setShown : slots;
  // Select / deselect everything showing (the whole set, or what the filter left).
  const allIn = shown.length > 0 && shown.every((s) => pickedKeys.has(s.key));

  async function run(nextPage = 1) {
    const query = (nextPage === 1 ? q : searched).trim();
    if (!query) return;
    setLoading(true); setError(null);
    try {
      const r = await game.searchByName(query, nextPage, setsInfo);
      const next = nextPage === 1 ? r.cards : [...cards, ...r.cards];
      setCards(next);
      setSlotsState(await slotsForSearch(game, next, setsInfo, { variants: true }));
      setHasMore(r.hasMore); setPage(nextPage); setSearched(query);
    } catch (e) {
      setError(`Search failed (${e.message}). Try again in a moment.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        Add cards
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 2 }} aria-label="Find cards">
          <ToggleButton value="name">By card name</ToggleButton>
          <ToggleButton value="set">By set</ToggleButton>
        </ToggleButtonGroup>
        {mode === 'name' ? (
          <Stack component="form" direction="row" spacing={1.5} onSubmit={(e) => { e.preventDefault(); run(1); }} sx={{ mb: 2 }}>
            <TextField autoFocus fullWidth size="small" type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${game.name} cards, e.g. ${game.exampleCard}`}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
            <Button type="submit" variant="contained" disabled={!q.trim() || loading}>Search</Button>
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <Autocomplete sx={{ flex: 1 }} size="small" options={setsInfo.sets} value={set} loading={!setsInfo.loaded}
              getOptionLabel={(o) => o.name} isOptionEqualToValue={(a, b) => a.id === b.id}
              groupBy={setsInfo.sets.some((x) => x.series) ? (o) => o.series || 'Other' : undefined}
              onChange={(_, v) => openSet(v)}
              renderInput={(params) => <TextField {...params} autoFocus label={`${game.name} set`} placeholder={`e.g. ${game.quickPicks?.[0] || ''}`} />} />
            {set && (
              <TextField size="small" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or number"
                sx={{ flex: 1 }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
            )}
          </Stack>
        )}
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          {mode === 'set'
            ? (loading ? 'Loading the set…'
              : set ? (browse?.length ? `${setShown.length} card${setShown.length === 1 ? '' : 's'} — tap one to add it to your set, tap again to take it out.` : 'No cards found in this set.')
              : 'Choose a set to see all of its cards and versions.')
            : loading && page === 1 ? 'Searching…'
            : searched ? (slots.length ? 'Tap a card to add it to your set — tap again to take it out.' : 'No cards found. Try a shorter name.')
            : 'Find any card by name, from any set, and tap it to add it.'}
        </Typography>
          {onSetMany && shown.length > 1 && !loading && (
            <Button size="small" variant="outlined" sx={{ flexShrink: 0 }} onClick={() => onSetMany(shown, !allIn)}>
              {allIn ? `Remove all ${shown.length}` : `Add all ${shown.length}`}
            </Button>
          )}
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={gridSx}>
          {loading && (mode === 'set' || page === 1) ? <SlotSkeletons count={8} /> : shown.map((s) => (
            <SlotCard key={s.key} slot={s} owned={owned.has(s.key)} queued={false}
              picking={{ picked: pickedKeys.has(s.key) }} onAdd={() => onTogglePick(s)} onToggleOwned={() => {}} />
          ))}
        </Box>
        {mode === 'name' && hasMore && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button disabled={loading} onClick={() => run(page + 1)}>{loading ? 'Loading…' : 'Load more'}</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, pl: 1 }}>{pickedKeys.size} card{pickedKeys.size === 1 ? '' : 's'} in this set</Typography>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
