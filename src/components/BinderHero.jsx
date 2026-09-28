import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import PlaceholderCard from './PlaceholderCard';

// Decorative open binder for the home page hero: two 9-pocket pages mixing real
// cards (owned), BinderWish placeholders (missing) and one empty pocket.
const IMG = (n) => `https://assets.tcgdex.net/en/sv/sv03.5/${String(n).padStart(3, '0')}`;
const LEFT = [
  { n: 1, kind: 'owned' }, { n: 2, kind: 'placeholder' }, { n: 3, kind: 'placeholder', variant: 'Reverse Holo', price: 1.12 },
  { n: 4, kind: 'owned' }, { n: 5, kind: 'owned' }, { n: 6, kind: 'placeholder', price: 7.56 },
  { n: 7, kind: 'owned' }, { n: 8, kind: 'placeholder', variant: 'Reverse Holo', price: 0.31 }, { n: 9, kind: 'owned' },
];
const RIGHT = [
  { n: 10, kind: 'owned' }, { n: 11, kind: 'owned' }, { n: 12, kind: 'placeholder', price: 0.44 },
  { n: 13, kind: 'placeholder', variant: 'Reverse Holo', price: 0.25 }, { n: 14, kind: 'owned' }, { n: 15, kind: 'placeholder', price: 1.89 },
  { n: 16, kind: 'owned' }, { n: 17, kind: 'empty' }, { n: 18, kind: 'owned' },
];
const HERO_OPTIONS = { qrCorner: 'br', qrSize: 14, price: true };
const CARD_PX = (63 / 25.4) * 96; // 63mm in CSS px

// Scale factor that fits a real-size card into its pocket.
function useFitScale() {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / CARD_PX));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, scale];
}

function Pocket({ slot }) {
  const [ref, scale] = useFitScale();
  const pocketSx = {
    aspectRatio: '63 / 88',
    borderRadius: '6px',
    background: 'linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.03))',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)',
    overflow: 'hidden',
    position: 'relative',
  };
  if (slot.kind === 'empty') return <Box ref={ref} sx={pocketSx} />;
  if (slot.kind === 'owned') {
    return (
      <Box ref={ref} sx={pocketSx}>
        <Box component="img" src={`${IMG(slot.n)}/low.webp`} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </Box>
    );
  }
  // Scale the real-size (63mm wide) placeholder down to the pocket.
  return (
    <Box ref={ref} sx={pocketSx}>
      <Box sx={{ width: '63mm', transformOrigin: 'top left', transform: `scale(${scale})` }}>
        <PlaceholderCard
          slot={{ name: '', image: IMG(slot.n), tcgplayerId: 502558, variantLabel: slot.variant, price: slot.price }}
          options={HERO_OPTIONS}
          style={{ borderRadius: 0 }}
        />
      </Box>
    </Box>
  );
}

function Page({ slots }) {
  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 0.75, sm: 1.25 },
      p: { xs: 1, sm: 1.75 }, borderRadius: 2,
      background: 'linear-gradient(180deg, #2a2627, #1f1c1d)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)',
    }}>
      {slots.map((s, i) => <Pocket key={i} slot={s} />)}
    </Box>
  );
}

export default function BinderHero() {
  return (
    <Box aria-hidden sx={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      display: 'grid', placeItems: 'center',
      background: 'radial-gradient(ellipse at 50% 40%, #3d2a26 0%, #141213 70%)',
    }}>
      <Box sx={{
        width: { xs: '160%', sm: '120%', md: 'min(1250px, 100%)' },
        transform: 'perspective(1600px) rotateX(18deg) rotateZ(-4deg) translateY(4%)',
        display: 'grid', gridTemplateColumns: '1fr 44px 1fr', alignItems: 'stretch',
        p: { xs: 1.5, sm: 2.5 }, borderRadius: 4,
        background: 'linear-gradient(135deg, #3a3435, #231f20)',
        boxShadow: '0 40px 80px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.06)',
        opacity: 0.9,
      }}>
        <Page slots={LEFT} />
        {/* Spine with rings */}
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ width: 30, height: 14, borderRadius: 7, background: 'linear-gradient(180deg,#e9e9f1,#9a9ab0)', boxShadow: '0 2px 4px rgba(0,0,0,.5)' }} />
          ))}
        </Box>
        <Page slots={RIGHT} />
      </Box>
      {/* Legibility overlay for the search on top */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,12,12,.65) 0%, rgba(16,12,12,.55) 45%, rgba(16,12,12,.88) 100%)' }} />
    </Box>
  );
}
