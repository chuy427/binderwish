import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardActionArea, CardContent, Chip, InputAdornment,
  Paper, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import { cardImage, loadSetCards, searchByName, setIdFromCardId } from '../api';

const gridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 2,
};

export default function SearchPanel({ setsInfo, queuedIds, onAdd, onAddMany }) {
  const [query, setQuery] = useState('');
  const [set, setSet] = useState(null);          // { id, name } | null
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(null); // { query, set } of the last search

  async function run({ q = query, s = set, nextPage = 1 } = {}) {
    if (!q.trim() && !s) return;
    setLoading(true);
    setError(null);
    try {
      if (s) {
        setResults(await loadSetCards(s.id, q, setsInfo.pocketIds));
        setHasMore(false);
      } else {
        const r = await searchByName(q.trim(), nextPage, setsInfo.pocketIds);
        setResults((prev) => (nextPage === 1 ? r.cards : [...prev, ...r.cards]));
        setHasMore(r.hasMore);
      }
      setPage(nextPage);
      setSearched({ query: q.trim(), set: s });
    } catch (e) {
      setError(`Search failed (${e.message}). Try again in a moment.`);
    } finally {
      setLoading(false);
    }
  }

  // Picking a set browses it immediately (narrowed by any name already typed).
  useEffect(() => { if (set) run({ s: set }); }, [set]); // eslint-disable-line react-hooks/exhaustive-deps

  const notYetAdded = results.filter((c) => !queuedIds.has(c.id));
  const where = searched?.set ? ` in ${searched.set.name}` : '';

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        component="form"
        direction="row"
        useFlexGap
        sx={{ flexWrap: 'wrap' }}
        spacing={1.5}
        onSubmit={(e) => { e.preventDefault(); run(); }}
      >
        <TextField
          sx={{ flex: '2 1 240px' }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={set ? `Filter ${set.name} by name…` : 'Card name, e.g. Charizard ex'}
          label="Card name"
          type="search"
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
        />
        <Autocomplete
          sx={{ flex: '1 1 220px' }}
          slotProps={{ paper: { elevation: 8 } }}
          options={setsInfo.sets}
          loading={!setsInfo.loaded}
          value={set}
          onChange={(_, v) => { setSet(v); if (!v) { setResults([]); setSearched(null); } }}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderOption={(props, o) => (
            <li {...props} key={o.id}>
              <Box sx={{ flex: 1 }}>{o.name}</Box>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{o.id}</Typography>
            </li>
          )}
          renderInput={(params) => <TextField {...params} label="Set (optional)" />}
        />
        <Button type="submit" variant="contained" size="large" sx={{ px: 4, flex: { xs: '1 1 100%', sm: '0 0 auto' } }} disabled={!query.trim() && !set}>
          Search
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2.5, mb: 2, minHeight: 36 }}>
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Searching…'
            : searched ? (results.length
              ? `${results.length}${hasMore ? '+' : ''} card${results.length === 1 ? '' : 's'}${where} — click to add to your print sheet.`
              : `No cards found${where}. Try a shorter name.`)
            : 'Search by name, pick a set to browse it, or both.'}
        </Typography>
        {searched?.set && results.length > 0 && !loading && (
          <Button
            variant="outlined"
            startIcon={<LibraryAddIcon />}
            disabled={notYetAdded.length === 0}
            onClick={() => onAddMany(notYetAdded, searched.set.name)}
            sx={{ flexShrink: 0 }}
          >
            {notYetAdded.length === 0 ? 'All added' : `Add all (${notYetAdded.length})`}
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={gridSx}>
        {loading && page === 1 && results.length === 0
          ? Array.from({ length: 12 }, (_, i) => (
            <Box key={i}>
              <Skeleton variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '63 / 88' }} />
              <Skeleton width="80%" sx={{ mt: 1 }} />
              <Skeleton width="50%" />
            </Box>
          ))
          : results.map((c) => (
            <ResultCard
              key={c.id}
              card={c}
              setName={searched?.set?.name || setsInfo.names.get(setIdFromCardId(c.id)) || setIdFromCardId(c.id)}
              added={queuedIds.has(c.id)}
              onClick={() => onAdd(c)}
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

function ResultCard({ card, setName, added, onClick }) {
  const src = cardImage(card);
  return (
    <Card
      sx={{
        position: 'relative',
        borderColor: added ? 'primary.main' : undefined,
        borderWidth: added ? 2 : 1,
        transition: 'transform .15s ease, box-shadow .15s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
        '&:hover .add-chip': { opacity: 1 },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 1 }}>
        {src ? (
          <Box component="img" src={src} alt={card.name} loading="lazy"
            sx={{ width: '100%', aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: 1.5, display: 'block', bgcolor: 'action.hover' }} />
        ) : (
          <Box sx={{ width: '100%', aspectRatio: '63 / 88', borderRadius: 1.5, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">No image</Typography>
          </Box>
        )}
        <CardContent sx={{ px: 0.5, pt: 1, pb: '4px !important' }}>
          <Typography variant="subtitle2" noWrap>{card.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">{setName} · #{card.localId}</Typography>
        </CardContent>
      </CardActionArea>
      <Chip
        className="add-chip"
        size="small"
        color="primary"
        icon={added ? <CheckCircleIcon /> : <AddIcon />}
        label={added ? 'Added' : 'Add'}
        sx={{ position: 'absolute', top: 14, right: 14, pointerEvents: 'none', opacity: added ? 1 : 0, transition: 'opacity .15s', boxShadow: 2 }}
      />
    </Card>
  );
}
