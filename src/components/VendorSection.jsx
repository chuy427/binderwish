import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LockIcon from '@mui/icons-material/Lock';
import PanToolIcon from '@mui/icons-material/PanTool';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CardFit from './home/CardFit';
import Reveal from './home/Reveal';


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

// A "display case" of the featured game's most valuable cards, with live prices.
function DisplayCase({ showcase }) {
  const cells = showcase?.chase.length ? showcase.chase : Array(6).fill(null);
  return (
    <Box sx={{ position: 'relative' }}>
      <Box key={showcase?.gameId} className="bw-swap" sx={{
        p: { xs: 2, sm: 3 }, borderRadius: '24px',
        background: 'linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.03))',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.45)',
      }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>Display case · {showcase?.setName || '…'}</Typography>
          <Chip size="small" icon={<LockIcon />} label="Real cards secured" sx={{ bgcolor: 'rgba(255,255,255,.1)', flexShrink: 0 }} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1, sm: 1.5 } }}>
          {cells.map((s, i) => <CardFit key={s?.key || i} slot={s} kind="placeholder" radius={5} sx={{ boxShadow: '0 6px 14px rgba(0,0,0,.35)' }} />)}
        </Box>
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary', textAlign: 'center' }}>
        Prices shown are today’s TCGPlayer market prices, printed under each QR.
      </Typography>
    </Box>
  );
}

export default function VendorSection({ showcase, onStart }) {
  return (
    <Box sx={{ py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: { xs: 5, md: 8 }, alignItems: 'center' }}>
          <Reveal>
            <Typography variant="overline" color="primary">For vendors & card shops</Typography>
            <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 44 }, mb: 2 }}>
              Let the binder answer “how much?”
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 560 }}>
              At card shows and on shop counters, placeholders let customers browse and price-check on their own —
              while your valuable cards stay safe until the sale.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              {BENEFITS.map((b) => (
                <Stack key={b.title} direction="row" spacing={1.5}>
                  <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,99,71,.16)', color: 'primary.main' }}>
                    {b.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{b.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{b.body}</Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
              TCGPlayer’s market price is a reference point — you still set your own prices.
            </Typography>
            <Button variant="contained" size="large" onClick={onStart} sx={{ mt: 3, px: 4 }}>
              Build a showcase binder
            </Button>
          </Reveal>
          <Reveal delay={150}><DisplayCase showcase={showcase} /></Reveal>
        </Box>
      </Container>
    </Box>
  );
}
