import { Box, Container, LinearProgress, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CardFit from './CardFit';
import Reveal from './Reveal';
import { DISPLAY_FONT, TOMATO } from '../../theme';

const money = (n) => (n == null ? '' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

// ---------- Tile visuals, all from the featured game's real cards ----------
function TrackVisual({ cards, total }) {
  const row = cards.slice(4, 8);
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
        {row.map((s, i) => (
          <Box key={s.key} sx={{ position: 'relative' }}>
            <CardFit slot={s} radius={4} sx={{ filter: i % 3 === 1 ? 'grayscale(1)' : 'none', opacity: i % 3 === 1 ? 0.4 : 1 }} />
            {i % 3 !== 1 && <CheckCircleIcon sx={{ position: 'absolute', top: 3, left: 3, fontSize: 14, color: '#4caf50', bgcolor: '#111', borderRadius: '50%' }} />}
          </Box>
        ))}
      </Box>
      <LinearProgress variant="determinate" value={62} sx={{ mt: 1.25, height: 6, borderRadius: 3 }} />
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{Math.round(total * 0.62)} / {total} owned · 62%</Typography>
    </Box>
  );
}

function CustomVisual({ chase }) {
  const fan = chase.slice(0, 3);
  return (
    <Box sx={{ position: 'relative', height: 132, width: '100%' }}>
      {fan.map((s, i) => {
        const off = i - (fan.length - 1) / 2;
        return (
          <Box key={s.key} sx={{ position: 'absolute', left: '50%', top: 4, width: 84, zIndex: i === 1 ? 2 : 1,
            transform: `translateX(calc(-50% + ${off * 58}px)) rotate(${off * 9}deg)`, transformOrigin: 'bottom center',
            boxShadow: '0 10px 24px rgba(0,0,0,.5)', borderRadius: '5px' }}>
            <CardFit slot={s} radius={5} />
          </Box>
        );
      })}
    </Box>
  );
}

function BinderVisual({ cards }) {
  const page = cards.slice(9, 18);
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, p: 0.75, bgcolor: '#141414', borderRadius: '8px', maxWidth: 104, mx: 'auto' }}>
        {page.map((s, i) => (
          <CardFit key={s.key} slot={s} radius={3}
            sx={{ filter: [1, 4, 6].includes(i) ? 'grayscale(1)' : 'none', opacity: [1, 4, 6].includes(i) ? 0.35 : 1,
              outline: i === 8 ? `2px solid ${TOMATO}` : 'none', outlineOffset: 1 }} />
        ))}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.75, textAlign: 'center' }}>Page 5 · row 3 · pocket 3</Typography>
    </Box>
  );
}

function WishlistVisual({ chase }) {
  return (
    <Stack spacing={0.75} sx={{ width: '100%' }}>
      {chase.slice(1, 4).map((s) => (
        <Stack key={s.key} direction="row" spacing={1} sx={{ alignItems: 'center', bgcolor: '#141414', borderRadius: '8px', p: 0.75 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Box sx={{ width: 22, flexShrink: 0 }}><CardFit slot={s} radius={2} /></Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{s.name}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{money(s.price)}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function PrintVisual({ cards }) {
  const s = cards[5];
  return (
    <Box sx={{ width: 104, mx: 'auto', transform: 'rotate(-4deg)', boxShadow: '0 12px 28px rgba(0,0,0,.5)', borderRadius: '4px' }}>
      {s && <CardFit slot={s} kind="placeholder" radius={4} />}
    </Box>
  );
}

function DevicesVisual({ chase }) {
  const s = chase[0];
  const card = (w) => (
    <Box sx={{ width: w, position: 'relative' }}>
      {s && <CardFit slot={s} radius={3} />}
      <CheckCircleIcon sx={{ position: 'absolute', top: 2, left: 2, fontSize: 12, color: '#4caf50', bgcolor: '#111', borderRadius: '50%' }} />
    </Box>
  );
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-end', justifyContent: 'center', width: '100%' }}>
      <Box sx={{ border: '3px solid #2f2f2f', borderRadius: '12px', p: 0.75, bgcolor: '#141414' }}>{card(40)}</Box>
      <Box>
        <Box sx={{ border: '3px solid #2f2f2f', borderRadius: '6px 6px 0 0', p: 1, bgcolor: '#141414', display: 'flex', gap: 0.5 }}>
          {card(40)}<Box sx={{ width: 40, opacity: 0.35 }}>{chase[1] && <CardFit slot={chase[1]} radius={3} />}</Box>
        </Box>
        <Box sx={{ height: 6, bgcolor: '#2f2f2f', borderRadius: '0 0 6px 6px', mx: -1 }} />
      </Box>
    </Stack>
  );
}

// "Built for finishing master sets": one tile per feature, each a way in.
export default function FeatureGrid({ showcase, onGo, signedIn }) {
  const cards = showcase?.cards || [];
  const chase = showcase?.chase || [];
  const ready = cards.length >= 18 && chase.length >= 4;
  const tiles = [
    { title: 'Track your sets', body: 'Every card and variant, checked off — with your progress and what’s left to spend.', go: 'sets', visual: <TrackVisual cards={cards} total={showcase?.total || 0} /> },
    { title: 'Custom sets', body: 'Every Charizard ever printed, a favourite artist’s work, or cards you hand-pick.', go: 'sets', visual: <CustomVisual chase={chase} /> },
    { title: 'Virtual binder', body: 'Page by page in your binder’s layout — the exact pocket for every card. Share it.', go: 'binderIndex', visual: <BinderVisual cards={cards} /> },
    { title: 'Wishlist for card shows', body: 'Everything you still need, priced — and it works offline at the show.', go: 'need', visual: <WishlistVisual chase={chase} /> },
    { title: 'Print placeholders', body: 'Real card size, in binder order, with a QR code to the exact TCGPlayer listing.', go: 'search', visual: <PrintVisual cards={cards} /> },
    { title: 'On every device', body: signedIn ? 'Your collection syncs across your phone and computer.' : 'Free account, no password. Check off on your phone, print at home.', go: signedIn ? 'sets' : 'signIn', visual: <DevicesVisual chase={chase} /> },
  ];
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Reveal sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="overline" color="primary">Everything in one place</Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 48 } }}>Built for finishing<br />master sets</Typography>
      </Reveal>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {tiles.map((t, i) => (
          <Reveal key={t.title} delay={(i % 3) * 100}>
            <Box component="button" type="button" onClick={() => onGo(t.go)}
              sx={{ width: '100%', height: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer',
                p: 2.5, borderRadius: '22px', bgcolor: '#171717', border: '1px solid rgba(255,255,255,.07)',
                display: 'flex', flexDirection: 'column', gap: 2, transition: 'border-color .2s, transform .2s',
                '&:hover': { borderColor: 'rgba(255,99,71,.45)', transform: 'translateY(-2px)' },
                '&:focus-visible': { outline: `2px solid ${TOMATO}`, outlineOffset: 2 } }}>
              <Box sx={{ height: 176, overflow: 'hidden', display: 'grid', placeItems: 'center', borderRadius: '14px', p: 1.5,
                background: 'radial-gradient(ellipse at 50% 120%, rgba(255,99,71,.14), transparent 65%)' }}>
                {ready ? t.visual : <Box sx={{ height: 120 }} />}
              </Box>
              <Box>
                <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 18 }}>{t.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t.body}</Typography>
              </Box>
            </Box>
          </Reveal>
        ))}
      </Box>
    </Container>
  );
}
