import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, InputAdornment,
  LinearProgress, Paper, Skeleton, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { setSlots, slotsForSearch } from '../catalog';
import { SlotCard, gridSx } from './SlotGrid';
import { GAME_LIST } from '../games';

const money = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SearchPanel({ game, onGameChange, initialSetId, initialQuery, onSearched, setsInfo, variants, queuedKeys, owned, onToggleOwned, onAdd, onAddMany }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [set, setSet] = useState(null);          // { id, name } | null
  const [slots, setSlotsState] = useState([]);
  const [cards, setCards] = useState([]);        // raw name-search results (for paging)
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(null); // { query, set } of the last search
  const [filter, setFilter] = useState('all');    // all | missing | owned

  async function run({ q = query, s = set, nextPage = 1 } = {}) {
    if (!q.trim() && !s) return;
    setLoading(true);
    setError(null);
    try {
      if (s) {
        const all = await setSlots(game, s.id, setsInfo, { variants });
        const needle = q.trim().toLowerCase();
        setSlotsState(needle ? all.filter((sl) => sl.name.toLowerCase().includes(needle)) : all);
        setHasMore(false);
      } else {
        const r = await game.searchByName(q.trim(), nextPage, setsInfo);
        const nextCards = nextPage === 1 ? r.cards : [...cards, ...r.cards];
        setCards(nextCards);
        setSlotsState(await slotsForSearch(game, nextCards, setsInfo, { variants }));
        setHasMore(r.hasMore);
      }
      setPage(nextPage);
      setSearched({ query: q.trim(), set: s });
      onSearched?.({ set: s, query: q.trim() });
    } catch (e) {
      setError(`Search failed (${e.message}). Try again in a moment.`);
    } finally {
      setLoading(false);
    }
  }

  // A card-name search started from the home page.
  // Start from the URL (/search?set=… or ?q=…) once the set list has loaded.
  useEffect(() => {
    if (!setsInfo.loaded) return;
    const s = initialSetId && setsInfo.sets.find((x) => x.id === initialSetId);
    if (s) setSet(s); // browsing starts via the effect below
    else if (initialQuery) run({ q: initialQuery, s: null });
  }, [setsInfo.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  // Picking a set browses it immediately (narrowed by any name already typed).
  useEffect(() => { if (set) run({ s: set }); }, [set]); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-expand results when the master-set (variants) option changes.
  useEffect(() => { if (searched) run({ q: searched.query, s: searched.set, nextPage: 1 }); }, [variants]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    let have = 0, missingValue = 0;
    for (const s of slots) {
      if (owned.has(s.key)) have++;
      else if (s.price != null) missingValue += s.price;
    }
    return { have, total: slots.length, missingValue };
  }, [slots, owned]);

  const visible = slots.filter((s) => filter === 'all' || (filter === 'owned') === owned.has(s.key));
  const missingNotQueued = slots.filter((s) => !owned.has(s.key) && !queuedKeys.has(s.key));
  const setMode = !!searched?.set;
  const pct = stats.total ? Math.round((stats.have / stats.total) * 100) : 0;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <ToggleButtonGroup
        exclusive size="small" color="primary" sx={{ mb: 2 }}
        value={game.id}
        onChange={(_, v) => v && v !== game.id && onGameChange(v)}
        aria-label="Game"
      >
        {GAME_LIST.map((g) => <ToggleButton key={g.id} value={g.id} sx={{ px: 2 }}>{g.name}</ToggleButton>)}
      </ToggleButtonGroup>
      <Stack
        component="form"
        direction="row"
        useFlexGap
        spacing={1.5}
        sx={{ flexWrap: 'wrap' }}
        onSubmit={(e) => { e.preventDefault(); run(); }}
      >
        <Autocomplete
          sx={{ flex: '2 1 260px' }}
          slotProps={{ paper: { elevation: 8 } }}
          options={setsInfo.sets}
          loading={!setsInfo.loaded}
          value={set}
          onChange={(_, v) => { setSet(v); setFilter('all'); if (!v) { setSlotsState([]); setSearched(null); } }}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          groupBy={setsInfo.sets.some((s) => s.group) ? (o) => o.group : undefined}
          renderOption={(props, o) => (
            <li {...props} key={o.id}>
              <Box sx={{ flex: 1 }}>{o.name}</Box>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                {o.artPending ? 'art coming soon · ' : ''}{o.code || o.id}
              </Typography>
            </li>
          )}
          renderInput={(params) => <TextField {...params} label={`${game.name} set you're collecting`} placeholder={`e.g. ${game.quickPicks[0]}`} />}
        />
        <TextField
          sx={{ flex: '1 1 200px' }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={set ? `Filter ${set.name}…` : `e.g. ${game.exampleCard}`}
          label={set ? 'Filter by name (optional)' : 'Or search a card name'}
          type="search"
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
        />
        <Button type="submit" variant="contained" size="large" sx={{ px: 4, flex: { xs: '1 1 100%', sm: '0 0 auto' } }} disabled={!query.trim() && !set}>
          {set ? 'Browse' : 'Search'}
        </Button>
      </Stack>

      {setMode && !loading && slots.length > 0 && (
        <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {searched.set.name}{variants ? ' master set' : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You own <b>{stats.have}</b> of {stats.total} ({pct}%)
                {stats.missingValue > 0 && <> · missing cards ≈ <b>{money(stats.missingValue)}</b></>}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<PlaylistAddIcon />}
              disabled={missingNotQueued.length === 0}
              onClick={() => onAddMany(missingNotQueued)}
            >
              {missingNotQueued.length ? `Add ${missingNotQueued.length} missing to print` : 'All missing cards added'}
            </Button>
          </Stack>
          <LinearProgress variant="determinate" value={pct} sx={{ mt: 1.5, height: 8, borderRadius: 4 }} />
        </Box>
      )}

      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2.5, mb: 2, minHeight: 36, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Loading…'
            : searched ? (slots.length
              ? `${visible.length} slot${visible.length === 1 ? '' : 's'} — tap ○ to mark owned, tap a card to add it to your print sheet (tap again to remove).`
              : 'No cards found. Try a shorter name.')
            : 'Pick the set you’re collecting to see every card and variant, or search a card by name.'}
        </Typography>
        {setMode && slots.length > 0 && (
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="missing">Missing</ToggleButton>
            <ToggleButton value="owned">Owned</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={gridSx}>
        {loading && page === 1
          ? Array.from({ length: 12 }, (_, i) => (
            <Box key={i}>
              <Skeleton variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '63 / 88' }} />
              <Skeleton width="80%" sx={{ mt: 1 }} />
              <Skeleton width="50%" />
            </Box>
          ))
          : visible.map((s) => (
            <SlotCard
              key={s.key}
              slot={s}
              owned={owned.has(s.key)}
              queued={queuedKeys.has(s.key)}
              onToggleOwned={() => onToggleOwned(s.key, s)}
              onAdd={() => onAdd(s)}
            />
          ))}
      </Box>

      {hasMore && (
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button variant="text" disabled={loading} onClick={() => run({ q: searched.query, s: null, nextPage: page + 1 })}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
