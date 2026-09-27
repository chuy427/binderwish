import { useEffect, useState } from 'react';
import {
  ToggleButton, ToggleButtonGroup,
  Autocomplete, Box, Button, Card, CardContent, Chip, Container, InputAdornment, Link, Paper, Stack, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LayersIcon from '@mui/icons-material/Layers';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PrintIcon from '@mui/icons-material/Print';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import BinderHero from './BinderHero';
import PlaceholderCard from './PlaceholderCard';
import VendorSection from './VendorSection';
import { GAME_LIST, getGame } from '../games';

const STEPS = [
  { icon: <LayersIcon />, title: 'Pick your set', body: 'See every card in the set — and for master sets, every variant: reverse holos, Poké Ball and Master Ball patterns, 1st Editions.' },
  { icon: <TaskAltIcon />, title: 'Check off what you own', body: 'Tap the cards you already have. Your progress and the value of what’s left to buy update as you go.' },
  { icon: <PrintIcon />, title: 'Print what’s missing', body: 'Placeholders print at real card size, 9 per page in binder order — optionally matching your binder’s exact pages.' },
  { icon: <QrCodeScannerIcon />, title: 'Sleeve, scan, swap', body: 'Slide them into your binder. When you’re ready to buy, scan a placeholder to open that exact card on TCGPlayer.' },
];

const OPTIONS = [
  {
    title: 'BinderWish placeholders',
    recommended: true,
    visual: 'placeholder',
    pros: [
      'Binder looks complete and in order from day one',
      'Card art shows exactly which card goes where — no guessing',
      'Variant named on each one (reverse holo, Poké Ball, Master Ball…)',
      'Scan to see the price and buy that exact printing',
      'Motivating: watch placeholders get replaced by the real thing',
    ],
    cons: [
      'Costs color ink and paper',
      'Takes time to print and cut',
      'Need to remember to pull a placeholder when the real card arrives',
    ],
  },
  {
    title: 'Empty pockets',
    visual: 'empty',
    pros: [
      'Free — nothing to print',
      'Gaps are obvious at a glance',
    ],
    cons: [
      'No idea which card belongs in a gap without a checklist',
      'Easy to file cards in the wrong pocket and shift the whole page',
      'Variants are nearly impossible to track this way',
      'Looking up prices means searching every card by hand',
    ],
  },
  {
    title: 'Number-only slips',
    visual: 'number',
    pros: [
      'Cheap and low-ink',
      'Keeps every card in its correct position',
    ],
    cons: [
      'A number alone doesn’t tell you what the card looks like',
      'Tedious to make by hand for a 400+ card master set',
      'Variants need extra notes on every slip',
      'No price or link — you still have to look each one up',
    ],
  },
];

const SAMPLE_OPTIONS = { qrPos: 'br', qrSize: 14, price: true };
const SAMPLE_SLOT = {
  name: 'Charizard ex', image: 'https://assets.tcgdex.net/en/sv/sv03.5/006', tcgplayerId: 502558,
  variantLabel: null, price: 7.56,
};

function PocketVisual({ kind }) {
  const pocket = {
    width: 120, aspectRatio: '63 / 88', borderRadius: 1.5, mx: 'auto', position: 'relative', overflow: 'hidden',
    bgcolor: 'action.hover', boxShadow: (t) => `inset 0 0 0 1px ${t.palette.divider}`,
  };
  if (kind === 'placeholder') {
    return (
      <Box sx={pocket}>
        <Box sx={{ width: '63mm', transformOrigin: 'top left', transform: `scale(${120 / ((63 / 25.4) * 96)})` }}>
          <PlaceholderCard slot={SAMPLE_SLOT} options={SAMPLE_OPTIONS} style={{ borderRadius: 0 }} />
        </Box>
      </Box>
    );
  }
  if (kind === 'number') {
    return (
      <Box sx={{ ...pocket, display: 'grid', placeItems: 'center', bgcolor: '#fff' }}>
        <Typography sx={{ fontFamily: '"Comic Sans MS", "Marker Felt", cursive', color: '#333', fontSize: 22 }}>#006</Typography>
      </Box>
    );
  }
  return <Box sx={pocket} />;
}

const EMPTY = { sets: [], loaded: false };

export default function HomePage({ setsByGame, loadGameSets, onStart }) {
  const [input, setInput] = useState('');
  const [value, setValue] = useState(null);
  const [gameId, setGameId] = useState('pokemon');
  const game = getGame(gameId);
  const setsInfo = setsByGame[gameId] || EMPTY;
  useEffect(() => { loadGameSets(gameId); }, [gameId, loadGameSets]);

  function start(v = value, text = input) {
    if (v && typeof v === 'object') onStart({ game: gameId, set: v, query: '' });
    else if (text.trim()) onStart({ game: gameId, set: null, query: text.trim() });
    else onStart({ game: gameId, set: null, query: '' });
  }

  return (
    <Box>
      {/* ---------- Hero ---------- */}
      <Box sx={{ position: 'relative', minHeight: { xs: 560, md: 640 }, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <BinderHero />
        <Container maxWidth="md" sx={{ position: 'relative', textAlign: 'center', color: '#fff', py: 8 }}>
          <Chip label="For master set collectors" size="small" sx={{ bgcolor: 'rgba(255,255,255,.14)', color: '#fff', mb: 2, backdropFilter: 'blur(6px)' }} />
          <Typography variant="h2" component="h1" sx={{ fontWeight: 800, letterSpacing: '-.02em', fontSize: { xs: 36, sm: 48, md: 60 }, textShadow: '0 2px 24px rgba(0,0,0,.5)' }}>
            See your master set complete —<br />before it is.
          </Typography>
          <Typography sx={{ mt: 2, mb: 4, fontSize: { xs: 16, sm: 19 }, opacity: 0.9, maxWidth: 640, mx: 'auto', textShadow: '0 1px 12px rgba(0,0,0,.6)' }}>
            Print card-sized placeholders for the cards you’re missing. Each one holds its spot in your binder
            and has a QR code that opens that exact card on TCGPlayer.
          </Typography>

          <ToggleButtonGroup
            exclusive size="small" value={gameId}
            onChange={(_, v) => { if (v) { setGameId(v); setValue(null); setInput(''); } }}
            aria-label="Game"
            sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,.1)', backdropFilter: 'blur(6px)', borderRadius: 99, p: 0.5,
              '& .MuiToggleButton-root': { color: 'rgba(255,255,255,.85)', border: 0, borderRadius: '99px !important', px: 2.5, py: 0.5 },
              '& .Mui-selected': { bgcolor: 'rgba(255,255,255,.95) !important', color: '#3b2f7a !important' } }}
          >
            {GAME_LIST.map((g) => <ToggleButton key={g.id} value={g.id}>{g.name}</ToggleButton>)}
          </ToggleButtonGroup>
          <Paper
            component="form"
            elevation={12}
            onSubmit={(e) => { e.preventDefault(); start(); }}
            sx={{ display: 'flex', gap: 1, p: 1, borderRadius: 99, maxWidth: 640, mx: 'auto', alignItems: 'center' }}
          >
            <Autocomplete
              freeSolo
              sx={{ flex: 1 }}
              options={setsInfo.sets}
              loading={!setsInfo.loaded}
              value={value}
              inputValue={input}
              onInputChange={(_, v) => setInput(v)}
              onChange={(_, v) => { setValue(v); if (v && typeof v === 'object') start(v); }}
              getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              slotProps={{ paper: { elevation: 8 } }}
              renderOption={(props, o) => (
                <li {...props} key={o.id}>
                  <Box sx={{ flex: 1 }}>{o.name}</Box>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>set</Typography>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="standard"
                  placeholder={`What ${game.name} set are you collecting? (or a card name)`}
                  slotProps={{
                    ...params.slotProps,
                    input: {
                      ...params.slotProps.input,
                      disableUnderline: true,
                      startAdornment: <InputAdornment position="start" sx={{ ml: 1.5 }}><SearchIcon /></InputAdornment>,
                      sx: { fontSize: 17, py: 0.75 },
                    },
                  }}
                />
              )}
            />
            <Button type="submit" variant="contained" size="large" sx={{ borderRadius: 99, px: 3, flexShrink: 0 }}>
              Start
            </Button>
          </Paper>
          <Stack direction="row" spacing={1} useFlexGap sx={{ justifyContent: 'center', flexWrap: 'wrap', mt: 2 }}>
            {game.quickPicks.map((name) => {
              const s = setsInfo.sets.find((x) => x.name === name);
              return s ? (
                <Chip key={name} label={name} onClick={() => start(s)} clickable
                  sx={{ bgcolor: 'rgba(255,255,255,.14)', color: '#fff', backdropFilter: 'blur(6px)', '&:hover': { bgcolor: 'rgba(255,255,255,.24)' } }} />
              ) : null;
            })}
          </Stack>
        </Container>
      </Box>

      {/* ---------- How it works ---------- */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>How it works</Typography>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 4 }}>From empty pockets to a finished binder</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5 }}>
          {STEPS.map((s, i) => (
            <Card key={s.title} sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                    {s.icon}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>STEP {i + 1}</Typography>
                </Stack>
                <Typography variant="h6" gutterBottom>{s.title}</Typography>
                <Typography variant="body2" color="text.secondary">{s.body}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* ---------- Anatomy of a placeholder ---------- */}
      <Box sx={{ bgcolor: 'action.hover', py: { xs: 6, md: 9 } }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' }, gap: { xs: 4, md: 8 }, alignItems: 'center' }}>
            <Box sx={{ mx: 'auto', transform: 'rotate(-3deg)' }}>
              <PlaceholderCard slot={SAMPLE_SLOT} options={SAMPLE_OPTIONS} style={{ boxShadow: '0 24px 48px rgba(0,0,0,.3)' }} />
            </Box>
            <Box>
              <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>What you print</Typography>
              <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 3 }}>A placeholder, not a proxy</Typography>
              <Stack spacing={2}>
                {[
                  ['Real card size', '63 × 88 mm — fits standard sleeves and 9-pocket binder pages.'],
                  ['The card’s own art', 'Name, number and set are right there on the art, so you always know what goes where.'],
                  ['Clearly marked', 'A “placeholder · not a real card” band — which also names the variant, like Poké Ball Pattern.'],
                  ['QR to the exact listing', 'Scan it to see today’s price and buy that exact printing on TCGPlayer. Optional price printed under the code.'],
                ].map(([t, b]) => (
                  <Stack key={t} direction="row" spacing={1.5}>
                    <CheckIcon color="primary" sx={{ mt: 0.25 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{t}</Typography>
                      <Typography variant="body2" color="text.secondary">{b}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ---------- Comparison ---------- */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Compare</Typography>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 1 }}>How should you fill the gaps?</Typography>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 700 }}>
          Three common ways collectors handle the cards they don’t have yet — each has trade-offs.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
          {OPTIONS.map((o) => (
            <Card key={o.title} sx={{ height: '100%', position: 'relative', borderColor: o.recommended ? 'primary.main' : undefined, borderWidth: o.recommended ? 2 : 1 }}>
              <CardContent sx={{ p: 3 }}>
                {o.recommended && <Chip label="What BinderWish does" color="primary" size="small" sx={{ position: 'absolute', top: 12, left: 12 }} />}
                <Box sx={{ mb: 2, mt: o.recommended ? 3.5 : 1 }}><PocketVisual kind={o.visual} /></Box>
                <Typography variant="h6" sx={{ mb: 2 }}>{o.title}</Typography>
                <Typography variant="overline" color="success.main" sx={{ fontWeight: 700 }}>Pros</Typography>
                <Stack spacing={0.75} sx={{ mb: 2 }}>
                  {o.pros.map((p) => (
                    <Stack key={p} direction="row" spacing={1}><CheckIcon fontSize="small" color="success" sx={{ mt: 0.25 }} /><Typography variant="body2">{p}</Typography></Stack>
                  ))}
                </Stack>
                <Typography variant="overline" color="error.main" sx={{ fontWeight: 700 }}>Cons</Typography>
                <Stack spacing={0.75}>
                  {o.cons.map((c) => (
                    <Stack key={c} direction="row" spacing={1}><CloseIcon fontSize="small" color="error" sx={{ mt: 0.25 }} /><Typography variant="body2">{c}</Typography></Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* ---------- Vendors ---------- */}
      <VendorSection setsInfo={setsByGame.pokemon || EMPTY} onStart={() => onStart({ game: 'pokemon', set: null, query: '' })} />

      {/* ---------- Closing CTA ---------- */}
      <Box sx={{ py: { xs: 6, md: 8 }, textAlign: 'center', background: 'linear-gradient(135deg, #3b2f7a, #6d4aff)', color: '#fff' }}>
        <Container maxWidth="sm">
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 1 }}>Ready to fill your binder?</Typography>
          <Typography sx={{ opacity: 0.9, mb: 3 }}>Free, no account needed. Your checklist is saved in your browser.</Typography>
          <Button variant="contained" size="large" onClick={() => onStart({ game: gameId, set: null, query: '' })}
            sx={{ bgcolor: '#fff', color: '#3b2f7a', borderRadius: 99, px: 4, '&:hover': { bgcolor: '#f0ecff' } }}>
            Start your checklist
          </Button>
        </Container>
      </Box>

      <Container maxWidth="lg" component="footer" sx={{ py: 4 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          Placeholders are binder fillers for cards you’re still collecting — not playable or sellable cards.
          Card data & images via <Link href="https://tcgdex.dev" target="_blank" rel="noopener">TCGdex</Link>; product links to TCGPlayer.
          Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. Not affiliated.
        </Typography>
      </Container>
    </Box>
  );
}
