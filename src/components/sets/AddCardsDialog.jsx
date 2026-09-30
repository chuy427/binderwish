import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Typography,
  useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { SlotCard, SlotSkeletons, gridSx } from '../SlotGrid';
import { slotsForSearch } from '../../catalog';

// Hand-pick cards for a custom set: search any card by name, tap to add / remove.
export default function AddCardsDialog({ open, onClose, game, setsInfo, pickedKeys, owned, onTogglePick }) {
  const phone = useMediaQuery('(max-width:600px)');
  const [q, setQ] = useState('');
  const [slots, setSlotsState] = useState([]);
  const [cards, setCards] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState('');

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
        <Stack component="form" direction="row" spacing={1.5} onSubmit={(e) => { e.preventDefault(); run(1); }} sx={{ mb: 2 }}>
          <TextField autoFocus fullWidth size="small" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${game.name} cards, e.g. ${game.exampleCard}`}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
          <Button type="submit" variant="contained" disabled={!q.trim() || loading}>Search</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {loading && page === 1 ? 'Searching…'
            : searched ? (slots.length ? 'Tap a card to add it to your set — tap again to take it out.' : 'No cards found. Try a shorter name.')
            : 'Find any card by name, from any set, and tap it to add it.'}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={gridSx}>
          {loading && page === 1 ? <SlotSkeletons count={8} /> : slots.map((s) => (
            <SlotCard key={s.key} slot={s} owned={owned.has(s.key)} queued={false}
              picking={{ picked: pickedKeys.has(s.key) }} onAdd={() => onTogglePick(s)} onToggleOwned={() => {}} />
          ))}
        </Box>
        {hasMore && (
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
