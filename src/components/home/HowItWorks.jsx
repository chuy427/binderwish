import { useEffect, useRef, useState } from 'react';
import { Box, Container, LinearProgress, Stack, Typography, useMediaQuery } from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PrintIcon from '@mui/icons-material/Print';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SearchIcon from '@mui/icons-material/Search';
import Reveal from './Reveal';
import CardFit from './CardFit';
import { useRotation } from './useShowcase';
import { TOMATO } from '../../theme';

const STEPS = [
  { icon: <LayersIcon />, title: 'Pick your set', body: 'See every card in the set — and for master sets, every variant: reverse holos, cold foils, Poké Ball patterns, Alternate Arts, Enchanteds and more.' },
  { icon: <TaskAltIcon />, title: 'Check off what you own', body: 'Tap the cards you already have. Your progress, and the value of what’s left to buy, update as you go.' },
  { icon: <PrintIcon />, title: 'Print what’s missing', body: 'Placeholders print at real card size, 9 to a page in binder order — optionally matching your binder’s exact pages.' },
  { icon: <QrCodeScannerIcon />, title: 'Sleeve, scan, swap', body: 'Slide them into your binder. When you’re ready to buy, scan a placeholder to open that exact card on TCGPlayer.' },
];

function PickVisual({ showcase }) {
  return (
    <Stack spacing={2} sx={{ width: '100%', maxWidth: 380 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', bgcolor: '#F4F1EE', color: '#111', borderRadius: 99, px: 2, py: 1.25 }}>
        <SearchIcon sx={{ color: '#555' }} /><Typography sx={{ fontWeight: 600 }}>{showcase?.setName || '…'}</Typography>
      </Stack>
      <Box sx={{ bgcolor: '#222', borderRadius: '14px', p: 2 }}>
        <Typography variant="overline" color="primary">{showcase?.gameName} master set</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 22 }}>{showcase?.total ?? '—'} slots</Typography>
        <LinearProgress variant="determinate" value={38} sx={{ mt: 1.5, height: 8, borderRadius: 4 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mt: 2 }}>
          {(showcase?.cards || []).slice(0, 4).map((s) => <CardFit key={s.key} slot={s} />)}
        </Box>
      </Box>
    </Stack>
  );
}

function OwnVisual({ showcase }) {
  const cards = (showcase?.cards || []).slice(4, 10);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, width: '100%', maxWidth: 380 }}>
      {cards.map((s, i) => {
        const owned = [0, 2, 3].includes(i);
        return (
          <Box key={s.key} sx={{ position: 'relative' }}>
            <CardFit slot={s} sx={{ filter: owned ? 'none' : 'grayscale(1)', opacity: owned ? 1 : 0.5 }} />
            <Box sx={{ position: 'absolute', top: 6, left: 6, bgcolor: '#1a1a1a', borderRadius: '50%', display: 'grid', color: owned ? '#4caf50' : 'rgba(255,255,255,.6)' }}>
              {owned ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function PrintVisual({ showcase }) {
  const cards = (showcase?.cards || []).slice(1, 10);
  return (
    <Box sx={{ bgcolor: '#F4F1EE', p: 1.5, borderRadius: '4px', width: '100%', maxWidth: 330, transform: 'rotate(-3deg)', boxShadow: '0 30px 60px rgba(0,0,0,.5)' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
        {cards.map((s) => <CardFit key={s.key} slot={s} kind="placeholder" radius={2} />)}
      </Box>
      <Typography sx={{ color: '#777', fontSize: 9, textAlign: 'center', mt: 0.75 }}>BinderWish · {showcase?.setName} · binder page 1</Typography>
    </Box>
  );
}

function ScanVisual({ showcase }) {
  const s = showcase?.chase[0];
  return (
    <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 150, transform: 'rotate(-5deg)', boxShadow: '0 30px 60px rgba(0,0,0,.5)', borderRadius: '4px' }}>
        <CardFit slot={s} kind="placeholder" radius={6} />
      </Box>
      <Box sx={{ width: 170, borderRadius: '22px', border: '6px solid #2a2a2a', bgcolor: '#F4F1EE', color: '#111', p: 1.5, boxShadow: '0 30px 60px rgba(0,0,0,.5)' }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#666' }}>TCGPLAYER</Typography>
        <Box sx={{ width: 80, mx: 'auto', my: 1 }}><CardFit slot={s} radius={4} /></Box>
        <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }} noWrap>{s?.name}</Typography>
        <Typography sx={{ fontSize: 11, color: '#666' }}>{s?.variantLabel}</Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mt: 0.5 }}>{s ? `$${s.price.toFixed(2)}` : ''}</Typography>
        <Box sx={{ mt: 1, bgcolor: TOMATO, color: '#1B1B1F', fontSize: 11, fontWeight: 700, textAlign: 'center', borderRadius: 99, py: 0.5 }}>Add to cart</Box>
      </Box>
    </Stack>
  );
}

const VISUALS = [PickVisual, OwnVisual, PrintVisual, ScanVisual];

const STEP_VH = 70; // scroll distance per step while the panel is pinned

// The step panel. On desktop it's pinned (sticky) while the section scrolls by,
// and the scroll position picks the step — scroll down to advance, and the page
// moves on after step 4. On phones (where the stacked panel is taller than the
// screen) the steps are tapped through and auto-advance instead.
export default function HowItWorks({ showcase }) {
  const desktop = useMediaQuery('(min-width: 900px)');
  const [hover, setHover] = useState(false);
  const [rotStep, setRotStep] = useRotation(STEPS.length, { interval: 5000, paused: hover || desktop });
  const [scrollStep, setScrollStep] = useState(0);
  const trackRef = useRef(null);

  useEffect(() => {
    if (!desktop) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const progress = Math.min(0.9999, Math.max(0, -rect.top / Math.max(1, travel)));
      setScrollStep(Math.floor(progress * STEPS.length));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [desktop]);

  const step = desktop ? scrollStep : rotStep;
  // Desktop: clicking a step scrolls to the middle of that step's stretch.
  const goTo = (i) => {
    if (!desktop) { setRotStep(i); return; }
    const el = trackRef.current;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / STEPS.length) * travel, behavior: 'smooth' });
  };
  const Visual = VISUALS[step];

  const panel = (
    <Box onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      sx={{ position: 'relative', borderRadius: '28px', bgcolor: '#171717', border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: { xs: '1fr', md: '72px 1fr 1fr' }, minHeight: { md: 460 } }}>
      {/* Vertical step nav, with a progress rail on desktop */}
      <Stack direction={{ xs: 'row', md: 'column' }} spacing={1.5} sx={{ p: 2, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        {STEPS.map((s, i) => (
          <Box key={s.title} component="button" onClick={() => goTo(i)} aria-label={s.title} aria-pressed={i === step}
            sx={{ width: 44, height: 44, borderRadius: '50%', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', position: 'relative', zIndex: 1,
              bgcolor: i === step ? '#F4F1EE' : i < step ? 'rgba(255,99,71,.35)' : 'rgba(255,255,255,.08)',
              color: i === step ? '#111' : 'rgba(255,255,255,.75)', transition: 'background-color .25s' }}>
            {s.icon}
          </Box>
        ))}
      </Stack>
      <Box key={`t${step}`} className="bw-swap" sx={{ p: { xs: 3, md: 6 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography variant="overline" color="text.secondary">Step {step + 1} of 4</Typography>
        <Typography variant="h3" sx={{ fontSize: { xs: 26, md: 38 }, mb: 2 }}>{STEPS[step].title}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 420 }}>{STEPS[step].body}</Typography>
        {desktop && step < STEPS.length - 1 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 4, opacity: 0.7 }}>Scroll to continue ↓</Typography>
        )}
      </Box>
      <Box key={`v${step}-${showcase?.gameId}`} className="bw-swap" sx={{ p: { xs: 3, md: 5 }, display: 'grid', placeItems: 'center',
        background: 'radial-gradient(ellipse at 60% 40%, rgba(255,99,71,.16), transparent 60%)' }}>
        <Visual showcase={showcase} />
      </Box>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Reveal sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="overline" color="primary">How it works</Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: 28, md: 48 } }}>From empty pockets<br />to a finished binder</Typography>
      </Reveal>
      {desktop ? (
        // Tall track; the panel sticks (vertically centered below the app bar) while it scrolls past.
        <Box ref={trackRef} sx={{ height: `calc(${STEPS.length * STEP_VH}vh + 460px)`, position: 'relative' }}>
          <Box sx={{ position: 'sticky', top: 'max(88px, calc(50vh - 230px + 32px))' }}>{panel}</Box>
        </Box>
      ) : (
        <Reveal>{panel}</Reveal>
      )}
    </Container>
  );
}
