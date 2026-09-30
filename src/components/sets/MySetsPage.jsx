import { useMemo, useState } from 'react';
import {
  Box, Container, InputAdornment, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SetTile from './SetTile';
import { useSetProgress } from './useSetProgress';
import { GAME_LIST } from '../../games';
import { DISPLAY_FONT, TOMATO } from '../../theme';

const tileGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: { xs: 1, sm: 2 } };
const newestFirst = (a, b) => (b.released || '').localeCompare(a.released || '');

// "My sets": every set for a game (logo, series, release date), newest first,
// with the sets you're collecting — and your progress in each — up top.
export default function MySetsPage({ game, onGameChange, setsInfo, mySets, owned, variants, setHref, onOpenSet }) {
  const [series, setSeries] = useState('all');
  const [q, setQ] = useState('');

  const sets = useMemo(() => {
    const list = setsInfo.sets.slice();
    return list.some((s) => s.released) ? list.sort(newestFirst) : list;
  }, [setsInfo.sets]);
  const seriesList = useMemo(() => [...new Set(sets.map((s) => s.series).filter(Boolean))], [sets]);

  const trackedIds = useMemo(() => new Set(mySets.filter((m) => m.game === game.id).map((m) => m.setId)), [mySets, game.id]);
  const collecting = sets.filter((s) => trackedIds.has(s.id));
  const progress = useSetProgress(game, collecting.map((s) => s.id), setsInfo, variants, owned);

  const needle = q.trim().toLowerCase();
  const shown = sets.filter((s) => (series === 'all' || s.series === series)
    && (!needle || s.name.toLowerCase().includes(needle) || (s.code || '').toLowerCase().includes(needle)));

  const tile = (s) => (
    <SetTile key={s.id} set={s} gameName={game.name} href={setHref(s.id)} tracked={trackedIds.has(s.id)}
      progress={progress.get(s.id)} onOpen={() => onOpenSet(s.id)} />
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="overline" color="primary">Your collection</Typography>
      <Typography variant="h1" sx={{ fontFamily: DISPLAY_FONT, fontSize: { xs: 34, md: 52 }, mt: 0.5 }}>My sets</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 620 }}>
        Open a set to see every card and variant, check off what you own, and add what’s missing to your print sheet.
      </Typography>

      <ToggleButtonGroup exclusive size="small" value={game.id} onChange={(_, v) => v && v !== game.id && onGameChange(v)} aria-label="Game"
        sx={{ mt: 3, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 99, p: 0.5,
          '& .MuiToggleButton-root': { border: 0, borderRadius: '99px !important', px: 2.5, py: 0.6, color: 'text.secondary' },
          '& .Mui-selected': { bgcolor: `${TOMATO} !important`, color: '#1B1B1F !important' } }}>
        {GAME_LIST.map((g) => <ToggleButton key={g.id} value={g.id}>{g.name}</ToggleButton>)}
      </ToggleButtonGroup>

      {/* Sets you're collecting */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5 }}>Collecting</Typography>
        {collecting.length ? (
          <Box sx={tileGrid}>{collecting.map(tile)}</Box>
        ) : (
          <Box sx={{ p: 3, borderRadius: '18px', border: '1px dashed rgba(255,255,255,.14)', color: 'text.secondary' }}>
            {setsInfo.loaded
              ? <>No {game.name} sets yet. Open any set below and check off a card — it’ll show up here with your progress.</>
              : 'Loading…'}
          </Box>
        )}
      </Box>

      {/* Every set */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 6, mb: 2, alignItems: { sm: 'center' } }}>
        <Typography variant="h5" sx={{ fontWeight: 800, flex: 1 }}>All {game.name} sets</Typography>
        <TextField size="small" type="search" placeholder="Find a set" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: { sm: 220 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
        {seriesList.length > 1 && (
          <TextField select size="small" value={series} onChange={(e) => setSeries(e.target.value)} sx={{ minWidth: { sm: 220 } }}
            slotProps={{ htmlInput: { 'aria-label': 'Series' } }}>
            <MenuItem value="all">All series</MenuItem>
            {seriesList.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        )}
      </Stack>
      <Box sx={tileGrid}>{shown.map(tile)}</Box>
      {setsInfo.loaded && !shown.length && <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No sets match.</Typography>}
    </Container>
  );
}
