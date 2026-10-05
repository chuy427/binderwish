import { useState } from 'react';
import { Box, CircularProgress, Container, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { PickTile, pickGrid } from './PickParts';
import { usePicks } from '../../lib/picks';
import { GAME_LIST } from '../../games';
import { DISPLAY_FONT, TOMATO } from '../../theme';

// /picks — every published pick, newest first, filterable by game.
export default function PicksIndexPage({ pickHref, onOpenPick, followed }) {
  const { picks, loaded, error } = usePicks();
  const [game, setGame] = useState('all');
  const list = game === 'all' ? picks : picks.filter((p) => p.game === game);
  const games = GAME_LIST.filter((g) => picks.some((p) => p.game === g.id));

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="overline" color="primary">Curated sets</Typography>
      <Typography variant="h1" sx={{ fontFamily: DISPLAY_FONT, fontSize: { xs: 34, md: 52 }, mt: 0.5 }}>BinderWish picks</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 640 }}>
        Themed sets worth a binder, put together by BinderWish and collectors we trust. Open one to see every card,
        check off what you own, and collect it like any set.
      </Typography>

      {games.length > 1 && (
        <ToggleButtonGroup exclusive size="small" value={game} onChange={(_, v) => v && setGame(v)} aria-label="Game"
          sx={{ mt: 3, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 99, p: 0.5,
            '& .MuiToggleButton-root': { border: 0, borderRadius: '99px !important', px: 2.5, py: 0.6, color: 'text.secondary' },
            '& .Mui-selected': { bgcolor: `${TOMATO} !important`, color: '#1B1B1F !important' } }}>
          <ToggleButton value="all">All</ToggleButton>
          {games.map((g) => <ToggleButton key={g.id} value={g.id}>{g.name}</ToggleButton>)}
        </ToggleButtonGroup>
      )}

      <Box sx={{ ...pickGrid, mt: 3 }}>
        {list.map((p) => (
          <Box key={p.id} sx={{ position: 'relative' }}>
            <PickTile pick={p} href={pickHref(p.slug)} onOpen={() => onOpenPick(p.slug)} />
            {followed.has(p.slug) && (
              <Box sx={{ position: 'absolute', top: 20, right: 20, fontSize: 11, fontWeight: 700, px: 1, py: 0.25, borderRadius: 99, bgcolor: TOMATO, color: '#1B1B1F' }}>Collecting</Box>
            )}
          </Box>
        ))}
      </Box>
      {!list.length && (
        <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
          {!loaded ? <CircularProgress size={28} /> : error && !picks.length ? 'Couldn’t load picks — check your connection and try again.' : 'No picks yet — check back soon.'}
        </Box>
      )}
    </Container>
  );
}
