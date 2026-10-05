import { useState } from 'react';
import {
  Autocomplete, Box, Button, Chip, Container, InputAdornment, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { QRCodeSVG } from 'qrcode.react';
import BinderSpread from './BinderSpread';
import CardFit from './CardFit';
import { GAME_LIST, getGame } from '../../games';
import { tcgplayerUrl } from '../../catalog';
import { TOMATO } from '../../theme';

const money = (n) => `$${Math.round(n).toLocaleString()}`;

// Tilted "sticker" that floats gently (see .bw-float in site.css).
function Sticker({ children, rot = 0, dur = 6, delay = 0, sx }) {
  return (
    <Box className="bw-float" sx={{ position: 'absolute', zIndex: 2, display: { xs: 'none', md: 'block' }, '--rot': `${rot}deg`, '--dur': `${dur}s`, '--delay': `${delay}s`, ...sx }}>
      {children}
    </Box>
  );
}

function Starburst({ children, size = 120 }) {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 ? 0.72 : 1;
    const a = (i / 24) * Math.PI * 2;
    return `${50 + 50 * r * Math.cos(a)},${50 + 50 * r * Math.sin(a)}`;
  }).join(' ');
  return (
    <Box sx={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
      <Box component="svg" viewBox="0 0 100 100" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,.4))' }}>
        <polygon points={pts} fill={TOMATO} />
      </Box>
      <Box sx={{ position: 'relative', textAlign: 'center', color: '#1B1B1F', lineHeight: 1.05 }}>{children}</Box>
    </Box>
  );
}

// `gameId` is the page's one featured game: it drives both the search and the
// binder visuals, and changes only when the visitor picks another game.
export default function Hero({ setsByGame, loadGameSets, onStart, showcase, gameId, onGame }) {
  const [input, setInput] = useState('');
  const [value, setValue] = useState(null);
  const game = getGame(gameId);
  const setsInfo = setsByGame[gameId] || { sets: [], loaded: false };

  function start(v = value, text = input) {
    if (v && typeof v === 'object') onStart({ game: gameId, set: v, query: '' });
    else onStart({ game: gameId, set: null, query: text.trim() });
  }
  const pickGame = (v) => { if (v && v !== gameId) { onGame(v); setValue(null); setInput(''); loadGameSets(v); } };
  const chase = showcase?.chase || [];

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', pt: { xs: 7, md: 10 }, pb: { xs: 6, md: 10 } }}>
      {/* Tomato glow behind the binder */}
      <Box sx={{ position: 'absolute', left: '50%', bottom: '-10%', width: '90%', height: '60%', transform: 'translateX(-50%)', background: `radial-gradient(ellipse at center, rgba(255,99,71,.28), transparent 65%)`, pointerEvents: 'none' }} />

      <Container maxWidth="lg" sx={{ position: 'relative', textAlign: 'center' }}>
        <Typography variant="overline" color="primary" component="div">For master set collectors</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: 34, sm: 50, md: 68 }, mt: 1.5 }}>
          Track every card.<br />Fill every pocket.
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 2.5, mx: 'auto', maxWidth: 620, fontSize: { xs: 16, sm: 18 } }}>
          Check off your master sets, see exactly where each card goes in your binder, and print placeholders
          for the gaps — each with a QR code to that card’s price today.
        </Typography>

        <ToggleButtonGroup exclusive size="small" value={gameId} onChange={(_, v) => pickGame(v)} aria-label="Game"
          sx={{ mt: 4, mb: 1.5, bgcolor: 'rgba(255,255,255,.06)', borderRadius: 99, p: 0.5,
            '& .MuiToggleButton-root': { border: 0, borderRadius: '99px !important', px: 2.5, py: 0.6, color: 'text.secondary' },
            '& .Mui-selected': { bgcolor: `${TOMATO} !important`, color: '#1B1B1F !important' } }}>
          {GAME_LIST.map((g) => <ToggleButton key={g.id} value={g.id}>{g.name}</ToggleButton>)}
        </ToggleButtonGroup>

        <Paper component="form" onSubmit={(e) => { e.preventDefault(); start(); }}
          sx={{ display: 'flex', gap: 1, p: 0.75, pl: 1, borderRadius: 99, maxWidth: 640, mx: 'auto', alignItems: 'center', bgcolor: '#F4F1EE', color: '#111' }}>
          <Autocomplete
            freeSolo sx={{ flex: 1 }}
            options={setsInfo.sets} loading={!setsInfo.loaded}
            value={value} inputValue={input}
            onInputChange={(_, v) => setInput(v)}
            onChange={(_, v) => { setValue(v); if (v && typeof v === 'object') start(v); }}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            groupBy={setsInfo.sets.some((s) => s.group) ? (o) => o.group : undefined}
            slotProps={{ paper: { elevation: 8 } }}
            renderInput={(params) => (
              <TextField {...params} variant="standard" placeholder={`What ${game.name} set are you collecting? (or a card)`}
                slotProps={{ ...params.slotProps, input: { ...params.slotProps.input, disableUnderline: true,
                  startAdornment: <InputAdornment position="start" sx={{ ml: 1 }}><SearchIcon sx={{ color: '#555' }} /></InputAdornment>,
                  sx: { fontSize: 16, py: 0.75, color: '#111', '& input::placeholder': { color: '#666', opacity: 1 } } } }} />
            )}
          />
          <Button type="submit" variant="contained" size="large" sx={{ px: 3.5, flexShrink: 0 }}>Start now</Button>
        </Paper>
        <Stack direction="row" spacing={1} useFlexGap sx={{ justifyContent: 'center', flexWrap: 'wrap', mt: 2 }}>
          {game.quickPicks.map((name) => {
            const s = setsInfo.sets.find((x) => x.name === name);
            return s ? <Chip key={name} label={name} onClick={() => start(s)} clickable variant="outlined" sx={{ borderColor: 'rgba(255,255,255,.18)' }} /> : null;
          })}
        </Stack>
      </Container>

      {/* Binder mockup with floating stickers, for the picked game */}
      <Container maxWidth="lg" sx={{ position: 'relative', mt: { xs: 6, md: 9 } }}>
        <Box sx={{ position: 'relative', mx: { md: 8 } }}>
          <BinderSpread showcase={showcase} />

          {showcase && (
            // Overlay the binder exactly: the fade-in animation makes this box the
            // stickers' positioning reference.
            <Box key={showcase.gameId} className="bw-swap" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <Sticker rot={-9} dur={7} sx={{ left: -70, top: -40, width: 150 }}>
                <Box sx={{ borderRadius: '10px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
                  <CardFit slot={chase[0]} kind="owned" radius={10} />
                </Box>
              </Sticker>
              {chase[0] && (
                <Sticker rot={8} dur={6.5} delay={0.8} sx={{ right: -60, top: -50 }}>
                  <Box sx={{ bgcolor: '#F4F1EE', p: 1.25, borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,.5)', textAlign: 'center' }}>
                    <QRCodeSVG value={tcgplayerUrl(chase[0])} size={96} marginSize={0} />
                    <Typography sx={{ color: '#111', fontSize: 11, fontWeight: 700, mt: 0.5 }}>Scan for price</Typography>
                  </Box>
                </Sticker>
              )}
              {chase[0] && (
                <Sticker rot={-6} dur={8} delay={0.4} sx={{ right: -80, top: '42%' }}>
                  <Starburst size={128}>
                    <Box sx={{ fontFamily: 'Unbounded', fontWeight: 800, fontSize: 20 }}>{money(chase[0].price)}</Box>
                    <Box sx={{ fontSize: 10, fontWeight: 700 }}>top chase</Box>
                  </Starburst>
                </Sticker>
              )}
              <Sticker rot={5} dur={7.5} delay={1.2} sx={{ left: -64, top: '55%' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', bgcolor: '#1f1d1c', border: '1px solid rgba(255,255,255,.1)', px: 1.5, py: 1, borderRadius: 99, boxShadow: '0 16px 32px rgba(0,0,0,.5)' }}>
                  <CheckCircleIcon sx={{ color: '#4caf50' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{Math.round(showcase.total * 0.62)} / {showcase.total} owned</Typography>
                </Stack>
              </Sticker>
            </Box>
          )}
        </Box>

        {/* Which game is featured — click to switch (the search follows) */}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mt: { xs: 3, md: 5 } }}>
          {GAME_LIST.map((g) => (
            <Chip key={g.id} size="small" onClick={() => pickGame(g.id)}
              label={g.id === gameId && showcase ? `${g.name} · ${showcase.setName}` : g.name}
              sx={{ bgcolor: g.id === gameId ? TOMATO : 'rgba(255,255,255,.08)', color: g.id === gameId ? '#1B1B1F' : 'text.secondary', fontWeight: 600 }} />
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
