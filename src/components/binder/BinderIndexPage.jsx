import { Autocomplete, Box, Button, Chip, Container, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import { GAME_LIST } from '../../games';
import { DISPLAY_FONT, TOMATO } from '../../theme';

// "Open virtual binder": choose a collection to lay out page by page — the last
// one opened, one of your sets or custom sets, or any set.
export default function BinderIndexPage({ game, onGameChange, setsInfo, mySets, customSets, last, onOpenSet, onOpenCustom }) {
  const names = setsInfo.names || new Map();
  const mine = mySets.filter((m) => m.game === game.id && names.has(m.setId));
  const myCustom = customSets.filter((c) => c.game === game.id);
  const lastCustom = last?.custom ? customSets.find((c) => c.id === last.custom) : null;
  const lastName = last ? (lastCustom?.name || last.name) : null;
  const canContinue = last && (last.custom ? !!lastCustom : !!last.set);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="overline" color="primary">Virtual binder</Typography>
      <Typography variant="h1" sx={{ fontFamily: DISPLAY_FONT, fontSize: { xs: 32, md: 46 }, mt: 0.5 }}>Open a binder</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 600 }}>
        See a collection page by page in your binder’s layout — exactly which pocket each card goes in.
      </Typography>

      {canContinue && (
        <Button variant="contained" size="large" startIcon={<AutoStoriesOutlinedIcon />} sx={{ mt: 3 }}
          onClick={() => (last.custom ? onOpenCustom(last.game, last.custom) : onOpenSet(last.game, last.set))}>
          Continue with {lastName}
        </Button>
      )}

      <ToggleButtonGroup exclusive size="small" value={game.id} onChange={(_, v) => v && onGameChange(v)} aria-label="Game"
        sx={{ mt: 4, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 99, p: 0.5,
          '& .MuiToggleButton-root': { border: 0, borderRadius: '99px !important', px: 2.5, py: 0.6, color: 'text.secondary' },
          '& .Mui-selected': { bgcolor: `${TOMATO} !important`, color: '#1B1B1F !important' } }}>
        {GAME_LIST.map((g) => <ToggleButton key={g.id} value={g.id}>{g.name}</ToggleButton>)}
      </ToggleButtonGroup>

      <Autocomplete sx={{ mt: 2.5, maxWidth: 520 }} options={setsInfo.sets} loading={!setsInfo.loaded}
        getOptionLabel={(o) => o.name} isOptionEqualToValue={(a, b) => a.id === b.id}
        groupBy={setsInfo.sets.some((s) => s.series) ? (o) => o.series || 'Other' : undefined}
        onChange={(_, v) => v && onOpenSet(game.id, v.id)}
        renderInput={(params) => <TextField {...params} label={`Any ${game.name} set`} placeholder={`e.g. ${game.quickPicks?.[0] || ''}`} />} />

      {(mine.length > 0 || myCustom.length > 0) && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Your sets</Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {mine.map((m) => (
              <Chip key={m.setId} label={names.get(m.setId)} onClick={() => onOpenSet(game.id, m.setId)} variant="outlined"
                sx={{ borderColor: 'rgba(255,255,255,.18)' }} />
            ))}
            {myCustom.map((c) => (
              <Chip key={c.id} label={`${c.name} (custom)`} onClick={() => onOpenCustom(game.id, c.id)} variant="outlined"
                sx={{ borderColor: 'rgba(255,99,71,.45)' }} />
            ))}
          </Stack>
        </Box>
      )}
    </Container>
  );
}
