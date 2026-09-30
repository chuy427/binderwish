import { useMemo, useState } from 'react';
import {
  Box, Button, Container, InputAdornment, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SetTile, { ProgressLine } from './SetTile';
import { CustomSetArt } from './CustomSetPage';
import CustomSetDialog from './CustomSetDialog';
import { useCustomProgress, useSetProgress } from './useSetProgress';
import { ruleSummary } from '../../lib/customSets';
import { BinderLine } from './BinderInfo';
import { GAME_LIST } from '../../games';
import { DISPLAY_FONT, TOMATO } from '../../theme';

const tileGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: { xs: 1, sm: 2 } };
const newestFirst = (a, b) => (b.released || '').localeCompare(a.released || '');

// "My sets": every set for a game (logo, series, release date), newest first,
// with the sets you're collecting — and your progress in each — up top.
export default function MySetsPage({
  game, onGameChange, setsInfo, mySets, customSets, owned, variants, setHref, onOpenSet, customHref, onOpenCustom, onCreateCustom,
  wantHref, onOpenWant,
}) {
  const [series, setSeries] = useState('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [binder, setBinder] = useState('all'); // all | '' (no binder) | a binder name
  const inBinder = (b) => binder === 'all' || (b || '') === binder;
  const myCustomAll = customSets.filter((c) => c.game === game.id);
  const myCustom = myCustomAll.filter((c) => inBinder(c.binder));
  const customProgress = useCustomProgress(game, myCustom, setsInfo, variants, owned);

  const sets = useMemo(() => {
    const list = setsInfo.sets.slice();
    return list.some((s) => s.released) ? list.sort(newestFirst) : list;
  }, [setsInfo.sets]);
  const seriesList = useMemo(() => [...new Set(sets.map((s) => s.series).filter(Boolean))], [sets]);

  const trackedIds = useMemo(() => new Set(mySets.filter((m) => m.game === game.id).map((m) => m.setId)), [mySets, game.id]);
  const placeOf = useMemo(() => new Map(mySets.filter((m) => m.game === game.id).map((m) => [m.setId, m])), [mySets, game.id]);
  const collectingAll = sets.filter((s) => trackedIds.has(s.id));
  const binderNames = [...new Set([...collectingAll.map((s) => placeOf.get(s.id)?.binder), ...myCustomAll.map((c) => c.binder)].filter(Boolean))].sort();
  const collecting = collectingAll.filter((s) => inBinder(placeOf.get(s.id)?.binder));
  const progress = useSetProgress(game, collecting.map((s) => s.id), setsInfo, variants, owned);

  const needle = q.trim().toLowerCase();
  const shown = sets.filter((s) => (series === 'all' || s.series === series)
    && (!needle || s.name.toLowerCase().includes(needle) || (s.code || '').toLowerCase().includes(needle)));

  const tile = (s) => (
    <SetTile key={s.id} set={s} gameName={game.name} href={setHref(s.id)} tracked={trackedIds.has(s.id)} place={placeOf.get(s.id)}
      progress={progress.get(s.id)} onOpen={() => onOpenSet(s.id)} />
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="overline" color="primary">Your collection</Typography>
      <Typography variant="h1" sx={{ fontFamily: DISPLAY_FONT, fontSize: { xs: 34, md: 52 }, mt: 0.5 }}>My sets</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 620 }}>
        Open a set to see every card and variant, check off what you own, and add what’s missing to your print sheet.
      </Typography>
      <Button component="a" href={wantHref} onClick={(e) => { e.preventDefault(); onOpenWant(); }} variant="outlined"
        startIcon={<FactCheckOutlinedIcon />} sx={{ mt: 2 }}>
        Want list — for card shows
      </Button>

      <ToggleButtonGroup exclusive size="small" value={game.id} onChange={(_, v) => v && v !== game.id && onGameChange(v)} aria-label="Game"
        sx={{ mt: 3, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 99, p: 0.5,
          '& .MuiToggleButton-root': { border: 0, borderRadius: '99px !important', px: 2.5, py: 0.6, color: 'text.secondary' },
          '& .Mui-selected': { bgcolor: `${TOMATO} !important`, color: '#1B1B1F !important' } }}>
        {GAME_LIST.map((g) => <ToggleButton key={g.id} value={g.id}>{g.name}</ToggleButton>)}
      </ToggleButtonGroup>

      {/* Sets you're collecting */}
      <Box sx={{ mt: 5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5, alignItems: { sm: 'center' } }}>
          <Typography variant="h5" sx={{ fontWeight: 800, flex: 1 }}>Collecting</Typography>
          {binderNames.length > 0 && (
            <TextField select size="small" value={binder} onChange={(e) => setBinder(e.target.value)} sx={{ minWidth: { sm: 220 } }}
              slotProps={{ htmlInput: { 'aria-label': 'Binder' } }}>
              <MenuItem value="all">All binders</MenuItem>
              {binderNames.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
              <MenuItem value="">No binder yet</MenuItem>
            </TextField>
          )}
        </Stack>
        {collecting.length ? (
          <Box sx={tileGrid}>{collecting.map(tile)}</Box>
        ) : (
          <Box sx={{ p: 3, borderRadius: '18px', border: '1px dashed rgba(255,255,255,.14)', color: 'text.secondary' }}>
            {!setsInfo.loaded ? 'Loading…'
              : collectingAll.length ? 'No sets in this binder.'
              : <>No {game.name} sets yet. Open any set below and check off a card — it’ll show up here with your progress.</>}
          </Box>
        )}
      </Box>

      {/* Custom sets */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Custom sets</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Your own sets — every card of a {game.id === 'pokemon' ? 'Pokémon' : 'character'}{game.id === 'pokemon' ? ' or artist' : ''}, or any cards you hand-pick.
        </Typography>
        <Box sx={tileGrid}>
          {myCustom.map((c) => {
            const p = customProgress.get(c.id);
            return (
              <Box key={c.id} component="a" href={customHref(c.id)} onClick={(e) => { e.preventDefault(); onOpenCustom(c.id); }}
                sx={{ display: 'block', color: 'inherit', textDecoration: 'none', borderRadius: '22px', p: 1.25, transition: 'background-color .2s, transform .2s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,.04)', transform: 'translateY(-2px)' }, '&:focus-visible': { outline: `2px solid ${TOMATO}`, outlineOffset: 2 } }}>
                <CustomSetArt cs={c} gameName={game.name} preview={p?.preview || []} />
                <Box sx={{ px: 0.5, pt: 1.5 }}>
                  <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>Custom set</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{ruleSummary(c) || 'Hand-picked'}</Typography>
                  <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 17, lineHeight: 1.25, mt: 0.75, overflowWrap: 'anywhere' }}>{c.name}</Typography>
                  <BinderLine binder={c.binder} location={c.location} sx={{ mt: 0.75 }} />
                  <ProgressLine progress={p} />
                </Box>
              </Box>
            );
          })}
          <Box component="button" type="button" onClick={() => setCreating(true)}
            sx={{ font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left', bgcolor: 'transparent', border: 0, borderRadius: '22px', p: 1.25,
              '&:hover .new-box': { borderColor: TOMATO, color: TOMATO }, '&:focus-visible': { outline: `2px solid ${TOMATO}`, outlineOffset: 2 } }}>
            <Box className="new-box" sx={{ height: 160, borderRadius: '18px', border: '1.5px dashed rgba(255,255,255,.2)', display: 'grid', placeItems: 'center',
              color: 'text.secondary', transition: 'border-color .2s, color .2s' }}>
              <Stack sx={{ alignItems: 'center' }} spacing={0.5}><AddIcon sx={{ fontSize: 36 }} /><Typography sx={{ fontWeight: 700 }}>New custom set</Typography></Stack>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, pt: 1.5 }}>
              e.g. {game.id === 'pokemon' ? 'every Charizard, or your Eevee favourites' : game.id === 'lorcana' ? 'every Stitch, or your favourite heroes' : 'every Luffy, or the Straw Hat crew'}
            </Typography>
          </Box>
        </Box>
      </Box>
      <CustomSetDialog open={creating} defaultGame={game.id} onClose={() => setCreating(false)}
        onSave={(v) => { setCreating(false); onCreateCustom(v); }} />

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
