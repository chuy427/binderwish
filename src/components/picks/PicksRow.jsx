import { Box, Link, Stack, Typography } from '@mui/material';
import { PickTile, pickGrid } from './PickParts';
import { usePicks } from '../../lib/picks';

// "BinderWish picks" row for the home page and My sets: the newest few picks (for
// one game when given), with a link to all of them. Renders nothing until there are picks.
export default function PicksRow({ game, limit = 3, pickHref, onOpenPick, allHref, onOpenAll, sx }) {
  const { picks } = usePicks();
  const list = (game ? picks.filter((p) => p.game === game) : picks).slice(0, limit);
  if (!list.length) return null;
  return (
    <Box sx={sx}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>BinderWish picks</Typography>
        <Link href={allHref} onClick={(e) => { e.preventDefault(); onOpenAll(); }} underline="hover" sx={{ fontWeight: 600, flexShrink: 0 }}>See all ›</Link>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Themed sets put together by BinderWish and collectors we trust.
      </Typography>
      <Box sx={pickGrid}>
        {list.map((p) => <PickTile key={p.id} pick={p} href={pickHref(p.slug)} onOpen={() => onOpenPick(p.slug)} />)}
      </Box>
    </Box>
  );
}
