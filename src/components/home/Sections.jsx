import { Box, Button, Container, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import Reveal from './Reveal';
import CardFit from './CardFit';
import PlaceholderCard from '../PlaceholderCard';
import { TOMATO } from '../../theme';
import { SAMPLE_LOGO } from '../../lib/logo';

const INK = '#1B1B1F';

// ---------- Placeholder anatomy ----------
const VENDOR_POINTS = [
  ['Real card size', '63 × 88 mm — slides into the same sleeves and binder pages as your stock.'],
  ['Today’s price, printed', 'The TCGPlayer market price sits under the QR, and the QR always opens the live one.'],
  ['Clearly marked', 'A “placeholder · not a real card” band that names the variant — no confusion at the sale.'],
  ['Your logo on the QR', 'Put your shop’s logo in the middle of every code, so each price check carries your name.'],
];

export function Anatomy({ showcase, vendor = false }) {
  const sample = showcase?.chase[1] || showcase?.cards[0];
  const points = vendor ? VENDOR_POINTS : [
    ['Real card size', '63 × 88 mm — fits standard sleeves and 9-pocket binder pages.'],
    ['The card’s own art', 'Name, number and set are right there on the art, so you always know what goes where.'],
    ['Clearly marked', 'A “placeholder · not a real card” band that also names the variant.'],
    ['QR to the exact listing', 'Scan it to see today’s price and buy that exact printing on TCGPlayer.'],
  ];
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' }, gap: { xs: 5, md: 10 }, alignItems: 'center' }}>
        <Reveal sx={{ mx: 'auto', position: 'relative' }}>
          <Box sx={{ position: 'absolute', inset: -40, background: 'radial-gradient(circle, rgba(255,99,71,.25), transparent 65%)' }} />
          <Box key={showcase?.gameId} className="bw-swap" sx={{ position: 'relative', transform: 'rotate(-4deg)' }}>
            {sample && <PlaceholderCard slot={sample} options={{ qrCorner: 'auto', qrSize: 14, price: true, qrLogo: vendor ? SAMPLE_LOGO : null }} highRes style={{ boxShadow: '0 30px 70px rgba(0,0,0,.6)' }} />}
          </Box>
        </Reveal>
        <Reveal delay={150}>
          <Typography variant="overline" color="primary">What you print</Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 44 }, mb: 4 }}>
            {vendor ? <>What goes<br />on your table</> : <>A placeholder,<br />not a proxy</>}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            {points.map(([t, b]) => (
              <Box key={t} sx={{ borderTop: '1px solid rgba(255,255,255,.1)', pt: 2 }}>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{t}</Typography>
                <Typography variant="body2" color="text.secondary">{b}</Typography>
              </Box>
            ))}
          </Box>
        </Reveal>
      </Box>
    </Container>
  );
}

// ---------- Comparison ----------
const OPTIONS = [
  { title: 'BinderWish placeholders', recommended: true, visual: 'placeholder',
    pros: ['Binder looks complete and in order from day one', 'Card art shows exactly which card goes where', 'Variant named on each one', 'Scan to see the price and buy that exact printing', 'Motivating: watch placeholders get replaced by the real thing'],
    cons: ['Costs ink and paper', 'Takes time to print and cut', 'Remember to pull a placeholder when the real card arrives'] },
  { title: 'Empty pockets', visual: 'empty',
    pros: ['Free — nothing to print', 'Gaps are obvious at a glance'],
    cons: ['No idea which card belongs in a gap without a checklist', 'Easy to file cards in the wrong pocket', 'Variants are nearly impossible to track', 'Looking up prices means searching every card by hand'] },
  { title: 'Number-only slips', visual: 'number',
    pros: ['Cheap and low-ink', 'Keeps every card in its position'],
    cons: ['A number alone doesn’t show what the card looks like', 'Tedious to make by hand for a 400+ card master set', 'Variants need extra notes', 'No price or link — you still look each one up'] },
];

function PocketVisual({ kind, showcase }) {
  const base = { width: 110, aspectRatio: '63 / 88', borderRadius: '6px', mx: 'auto' };
  if (kind === 'placeholder') return <Box sx={base}><CardFit slot={showcase?.cards[5]} kind="placeholder" /></Box>;
  if (kind === 'number') return <Box sx={{ ...base, bgcolor: '#F4F1EE', display: 'grid', placeItems: 'center', color: '#333', fontFamily: '"Marker Felt", "Comic Sans MS", cursive', fontSize: 22 }}>#006</Box>;
  return <Box sx={{ ...base, border: '1px dashed rgba(255,255,255,.25)' }} />;
}

export function Compare({ showcase }) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Reveal sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="overline" color="primary">Compare</Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 48 } }}>How should you<br />fill the gaps?</Typography>
      </Reveal>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
        {OPTIONS.map((o, i) => (
          <Reveal key={o.title} delay={i * 120}>
            <Box sx={{ height: '100%', p: 3, borderRadius: '24px', position: 'relative', bgcolor: o.recommended ? '#1f1a18' : '#171717',
              border: `1px solid ${o.recommended ? TOMATO : 'rgba(255,255,255,.07)'}`, transform: { md: `rotate(${[-1.5, 0, 1.5][i]}deg)` } }}>
              {o.recommended && <Box sx={{ position: 'absolute', top: 16, left: 16, bgcolor: TOMATO, color: INK, fontSize: 11, fontWeight: 700, px: 1.25, py: 0.25, borderRadius: 99 }}>What BinderWish does</Box>}
              <Box sx={{ mt: 4, mb: 2.5 }}><PocketVisual kind={o.visual} showcase={showcase} /></Box>
              <Typography variant="h5" sx={{ fontSize: 18, mb: 2 }}>{o.title}</Typography>
              <Stack spacing={0.75} sx={{ mb: 2 }}>
                {o.pros.map((p) => <Stack key={p} direction="row" spacing={1}><CheckIcon fontSize="small" sx={{ color: '#66bb6a', mt: 0.25 }} /><Typography variant="body2">{p}</Typography></Stack>)}
              </Stack>
              <Stack spacing={0.75}>
                {o.cons.map((c) => <Stack key={c} direction="row" spacing={1}><CloseIcon fontSize="small" sx={{ color: '#ef5350', mt: 0.25 }} /><Typography variant="body2" color="text.secondary">{c}</Typography></Stack>)}
              </Stack>
            </Box>
          </Reveal>
        ))}
      </Box>
    </Container>
  );
}

// ---------- Closing call to action ----------
export function FinalCta({ onStart, vendor = false, onWaitlist, onSignIn }) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Reveal>
        <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: '32px', textAlign: 'center', px: 3, py: { xs: 8, md: 12 },
          background: 'radial-gradient(ellipse at 50% 120%, rgba(255,99,71,.55), rgba(255,99,71,.08) 55%, #171717 80%)', border: '1px solid rgba(255,255,255,.07)' }}>
          <Typography variant="overline" color="primary">Try it for free</Typography>
          {vendor ? (
            <>
              <Typography variant="h2" sx={{ fontSize: { xs: 30, md: 60 }, my: 2 }}>Your display binder,<br />ready by the next show</Typography>
              <Typography color="text.secondary" sx={{ mb: 4 }}>Free, no account needed. Logo QR codes and printed placeholders are on the way.</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center', alignItems: 'center' }}>
                <Button variant="contained" size="large" onClick={onStart} sx={{ px: 4 }}>Build a showcase binder</Button>
                {onWaitlist && <Button variant="outlined" size="large" onClick={onWaitlist} sx={{ px: 3 }}>Join the vendor waitlist</Button>}
              </Stack>
            </>
          ) : (
            <>
              <Typography variant="h2" sx={{ fontSize: { xs: 30, md: 60 }, my: 2 }}>Your binder,<br />finished</Typography>
              <Typography color="text.secondary" sx={{ mb: 4 }}>
                Start right away — no account needed. {onSignIn ? 'Add a free account later to sync across your devices.' : 'Your collection syncs across your devices.'}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'center', alignItems: 'center' }}>
                <Button variant="contained" size="large" onClick={onStart} sx={{ px: 4 }}>Start a set</Button>
                {onSignIn && <Button variant="outlined" size="large" onClick={onSignIn} sx={{ px: 3 }}>Create free account</Button>}
              </Stack>
            </>
          )}
        </Box>
      </Reveal>
    </Container>
  );
}
