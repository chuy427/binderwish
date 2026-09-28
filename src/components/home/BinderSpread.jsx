import { Box, Skeleton } from '@mui/material';
import CardFit from './CardFit';

// Which pockets hold a real (owned) card, a BinderWish placeholder, or nothing.
const PATTERN = [
  'owned', 'placeholder', 'placeholder', 'owned', 'owned', 'placeholder', 'owned', 'placeholder', 'owned',
  'owned', 'owned', 'placeholder', 'placeholder', 'owned', 'placeholder', 'owned', 'empty', 'owned',
];

function Page({ cells }) {
  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 0.75, sm: 1.25 }, p: { xs: 1, sm: 1.75 },
      borderRadius: '14px', background: 'linear-gradient(180deg, #232120, #1a1817)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)',
    }}>
      {cells}
    </Box>
  );
}

// An open two-page binder, tilted like a product mockup, mixing owned cards,
// placeholders and an empty pocket from the featured game's showcase set.
export default function BinderSpread({ showcase }) {
  const cells = PATTERN.map((kind, i) => {
    const slot = showcase?.cards[i];
    if (!showcase) return <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '63 / 88', height: 'auto', bgcolor: 'rgba(255,255,255,.06)' }} />;
    if (kind === 'empty' || !slot) {
      return <Box key={i} sx={{ aspectRatio: '63 / 88', borderRadius: '6px', border: '1px dashed rgba(255,255,255,.18)' }} />;
    }
    return <CardFit key={`${showcase.gameId}-${i}`} slot={slot} kind={kind} />;
  });
  return (
    <Box
      key={showcase?.gameId || 'loading'}
      className="bw-swap"
      sx={{
        width: '100%',
        display: 'grid', gridTemplateColumns: '1fr 36px 1fr', p: { xs: 1.25, sm: 2 }, borderRadius: '24px',
        background: 'linear-gradient(135deg, #34302e, #1d1b1a)',
        boxShadow: '0 50px 100px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.07)',
        transform: 'perspective(1800px) rotateX(16deg)',
        transformOrigin: 'top center',
      }}
    >
      <Page cells={cells.slice(0, 9)} />
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ width: 24, height: 12, borderRadius: 6, background: 'linear-gradient(180deg,#eeeae6,#9a948f)', boxShadow: '0 2px 4px rgba(0,0,0,.5)' }} />
        ))}
      </Box>
      <Page cells={cells.slice(9, 18)} />
    </Box>
  );
}
