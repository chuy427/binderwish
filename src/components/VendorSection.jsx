import { useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LockIcon from '@mui/icons-material/Lock';
import PanToolIcon from '@mui/icons-material/PanTool';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PlaceholderCard from './PlaceholderCard';
import { setSlots } from '../catalog';
import pokemon from '../games/pokemon';

const SHOWCASE_SET = 'sv03.5'; // 151 — lots of recognizable high-value cards
const CARD_PX = (63 / 25.4) * 96; // 63mm in CSS px
const SHOWCASE_OPTIONS = { qrPos: 'br', qrSize: 14, price: true };

const BENEFITS = [
  {
    icon: <QrCode2Icon />,
    title: 'Instant price checks',
    body: 'Customers scan a placeholder to see the live TCGPlayer market price — fewer “how much is this?” interruptions while you’re mid-sale.',
  },
  {
    icon: <LockIcon />,
    title: 'Keep chase cards secured',
    body: 'Put placeholders out front and keep the real high-value cards in a locked case or behind the table until someone’s ready to buy — far less exposure to theft and swap scams.',
  },
  {
    icon: <PanToolIcon />,
    title: 'Less handling, less damage',
    body: 'Browsers flip through paper placeholders, not your Near Mint inventory. No more dinged corners from a busy weekend.',
  },
  {
    icon: <AutorenewIcon />,
    title: 'Prices that don’t go stale',
    body: 'The QR always opens today’s market price. Printed prices are a snapshot — reprint a page in seconds whenever the market moves.',
  },
  {
    icon: <ViewModuleIcon />,
    title: 'Build a showcase binder fast',
    body: 'Pick a set, add the cards you stock — variants included — and print whole pages in binder order.',
  },
  {
    icon: <StorefrontIcon />,
    title: 'No confusion at checkout',
    body: 'Every placeholder is marked “placeholder · not a real card” and names its variant, so there’s no question about what the customer is buying.',
  },
];

// Scale factor that fits a real-size card into its container.
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

function CasePocket({ slot }) {
  const [ref, scale] = useFitScale();
  return (
    <Box ref={ref} sx={{ aspectRatio: '63 / 88', borderRadius: '5px', overflow: 'hidden', boxShadow: '0 6px 14px rgba(0,0,0,.35)', bgcolor: 'rgba(255,255,255,.06)' }}>
      {slot && (
        <Box sx={{ width: '63mm', transformOrigin: 'top left', transform: `scale(${scale})` }}>
          <PlaceholderCard slot={slot} options={SHOWCASE_OPTIONS} style={{ borderRadius: 0 }} />
        </Box>
      )}
    </Box>
  );
}

// A "display case" of the set's most valuable cards, with real prices from the catalog.
function DisplayCase({ setsInfo }) {
  const [slots, setSlotsState] = useState([]);
  useEffect(() => {
    if (!setsInfo.loaded) return;
    setSlots(pokemon, SHOWCASE_SET, setsInfo, { variants: false })
      .then((all) => setSlotsState(all.filter((s) => s.price != null).sort((a, b) => b.price - a.price).slice(0, 6)))
      .catch(() => {});
  }, [setsInfo]);
  const cells = slots.length ? slots : Array(6).fill(null);

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{
        p: { xs: 2, sm: 3 }, borderRadius: 3,
        background: 'linear-gradient(160deg, rgba(255,255,255,.14), rgba(255,255,255,.04))',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.18), 0 30px 60px rgba(0,0,0,.4)',
        backdropFilter: 'blur(2px)',
      }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,.8)', fontWeight: 700 }}>Display case · 151 chase cards</Typography>
          <Chip size="small" icon={<LockIcon sx={{ color: '#fff !important' }} />} label="Real cards secured" sx={{ bgcolor: 'rgba(255,255,255,.14)', color: '#fff' }} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1, sm: 1.5 } }}>
          {cells.map((s, i) => <CasePocket key={s?.key || i} slot={s} />)}
        </Box>
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'rgba(255,255,255,.65)', textAlign: 'center' }}>
        Prices shown are today’s TCGPlayer market prices, printed under each QR.
      </Typography>
    </Box>
  );
}

export default function VendorSection({ setsInfo, onStart }) {
  return (
    <Box sx={{ py: { xs: 6, md: 10 }, color: '#fff', background: 'radial-gradient(ellipse at 20% 0%, #3a2f6b 0%, #16131f 65%)' }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: { xs: 5, md: 8 }, alignItems: 'center' }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#b9a8ff', fontWeight: 700 }}>For vendors & card shops</Typography>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 1.5 }}>
              Let the binder answer “how much?”
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.8)', mb: 4, maxWidth: 560 }}>
              At card shows and on shop counters, placeholders let customers browse and price-check on their own —
              while your valuable cards stay safe until the sale.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              {BENEFITS.map((b) => (
                <Stack key={b.title} direction="row" spacing={1.5}>
                  <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(164,139,255,.2)', color: '#cbbcff' }}>
                    {b.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{b.title}</Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.72)' }}>{b.body}</Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 3, color: 'rgba(255,255,255,.55)' }}>
              TCGPlayer’s market price is a reference point — you still set your own prices.
            </Typography>
            <Button variant="contained" size="large" onClick={() => onStart({ set: null, query: '' })}
              sx={{ mt: 3, bgcolor: '#fff', color: '#3b2f7a', borderRadius: 99, px: 4, '&:hover': { bgcolor: '#f0ecff' } }}>
              Build a showcase binder
            </Button>
          </Box>
          <DisplayCase setsInfo={setsInfo} />
        </Box>
      </Container>
    </Box>
  );
}
