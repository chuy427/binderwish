import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  FormGroup, FormLabel, Link, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceholderCard from './PlaceholderCard';
import { GAME_LIST } from '../games';
import { SAMPLE_LOGO } from '../lib/logo';

// Where signups go: any form backend that accepts a JSON POST and allows
// cross-origin requests (e.g. Formspree: https://formspree.io/f/<id>). Set
// VITE_WAITLIST_ENDPOINT at build time; without it the button is hidden in
// production builds (and shown in dev with a notice).
export const WAITLIST_ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT || '';
export const WAITLIST_ENABLED = !!WAITLIST_ENDPOINT || import.meta.env.DEV;

const SAMPLE = {
  game: 'pokemon', name: 'Charizard ex', setName: '151', number: '006', numberLabel: '006/165',
  variantLabel: 'Holo', tcgplayerId: 502558, price: 7.56,
};
const PREVIEW_PX = 190;
const CARD_PX = (63 / 25.4) * 96;

// What vendors can tell us they'd use, and where they sell.
const VENDOR_INTERESTS = [
  { id: 'logo-qr', label: 'My shop’s logo on the QR codes' },
  { id: 'printed', label: 'Printed & shipped placeholders' },
];
const VENDOR_CHANNELS = [
  { id: 'card-shows', label: 'Card shows' },
  { id: 'store', label: 'A local game store' },
  { id: 'online', label: 'Online' },
];

// The waitlist: gauges demand before building any ordering, fulfillment or
// payments. Collectors: printed-and-shipped, art-free placeholders. Vendors:
// logo QR codes and display placeholders for shows and shops.
export default function WaitlistDialog({ open, onClose, queue, count, audience = 'collector' }) {
  const [role, setRole] = useState(audience);
  const [business, setBusiness] = useState('');
  const [channels, setChannels] = useState(() => new Set());
  const [interests, setInterests] = useState(() => new Set());
  const [email, setEmail] = useState('');
  const [qty, setQty] = useState('');
  const [games, setGames] = useState(() => new Set());
  const [gotcha, setGotcha] = useState(''); // honeypot — bots fill it, people never see it
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState(null);

  // Prefill from the current print sheet when opened (without overwriting edits).
  useEffect(() => {
    if (!open) return;
    setRole(audience);
    if (count) setQty((q) => q || String(count));
    if (queue.length) setGames((g) => (g.size ? g : new Set(queue.map((c) => c.game || 'pokemon'))));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const vendor = role === 'vendor';
  const sample = queue.find((c) => c.name) || SAMPLE;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function submit(e) {
    e.preventDefault();
    if (!validEmail || status === 'sending') return;
    if (!WAITLIST_ENDPOINT) {
      setError('The waitlist isn’t connected yet (VITE_WAITLIST_ENDPOINT is not set).');
      setStatus('error');
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          placeholders: qty ? Number(qty) : null,
          games: [...games],
          role,
          ...(vendor && { business: business.trim() || null, sellsAt: [...channels], interestedIn: [...interests] }),
          source: vendor ? 'binderwish-vendor-waitlist' : 'binderwish-print-waitlist',
          _subject: vendor ? `BinderWish vendor waitlist${business.trim() ? ` — ${business.trim()}` : ''}` : 'BinderWish printing waitlist',
          _gotcha: gotcha,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setStatus('done');
    } catch {
      setError('Couldn’t join the waitlist just now — please try again in a moment.');
      setStatus('error');
    }
  }

  const toggleIn = (setter) => (id) => setter((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleGame = toggleIn(setGames);
  const checkboxes = (items, selected, toggle) => (
    <FormGroup row>
      {items.map((o) => (
        <FormControlLabel key={o.id} label={o.label} control={<Checkbox checked={selected.has(o.id)} onChange={() => toggle(o.id)} />} />
      ))}
    </FormGroup>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{vendor ? 'BinderWish for vendors & shops' : 'Get your placeholders printed & shipped'}</DialogTitle>
      {status === 'done' ? (
        <>
          <DialogContent>
            <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
              <Typography variant="h6">You’re on the list!</Typography>
              <Typography color="text.secondary">
                {vendor
                  ? `Thanks! We’ll email ${email.trim()} as vendor features launch — and we may reach out to ask what would help your table or shop most.`
                  : `We’ll email ${email.trim()} when printed placeholders are available.`}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions><Button variant="contained" onClick={onClose}>Done</Button></DialogActions>
        </>
      ) : (
        <Box component="form" onSubmit={submit} noValidate>
          <DialogContent>
            <ToggleButtonGroup exclusive fullWidth size="small" value={role} onChange={(_, v) => v && setRole(v)} aria-label="I am a" sx={{ mb: 3 }}>
              <ToggleButton value="collector">I’m a collector</ToggleButton>
              <ToggleButton value="vendor">I’m a vendor or shop</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `${PREVIEW_PX}px 1fr` }, gap: 3, alignItems: 'start' }}>
              <Box sx={{ width: PREVIEW_PX, height: PREVIEW_PX * (88 / 63), mx: 'auto', borderRadius: 2, overflow: 'hidden', boxShadow: 4 }}>
                <Box sx={{ width: '63mm', transformOrigin: 'top left', transform: `scale(${PREVIEW_PX / CARD_PX})` }}>
                  <PlaceholderCard slot={sample} options={{ cardStyle: 'clean', price: false, qrLogo: vendor ? SAMPLE_LOGO : null }} style={{ borderRadius: 0 }} />
                </Box>
              </Box>
              <Box>
                <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Coming soon</Typography>
                {vendor ? (
                  <>
                    <Typography sx={{ mb: 1.5 }}>
                      Placeholders for your display binders — with your shop’s logo in the middle of every QR code, so
                      each price check keeps your name in front of the customer.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      We’re shaping vendor features now. Tell us how you sell and we’ll let you know when they launch.
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography sx={{ mb: 1.5 }}>
                      Skip the printer and the scissors. We’re planning to print your placeholders on sturdy cardstock,
                      pre-cut to card size, in our clean design — and ship them to you, ready to sleeve.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Join the waitlist and we’ll let you know when it launches.
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {!WAITLIST_ENDPOINT && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Dev preview: set <code>VITE_WAITLIST_ENDPOINT</code> to a form endpoint to collect signups.
              </Alert>
            )}

            <Stack spacing={2} sx={{ mt: 3 }}>
              <TextField
                label="Email" type="email" required fullWidth autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                error={!!email && !validEmail} helperText={email && !validEmail ? 'Enter a valid email address' : ' '}
              />
              {vendor && (
                <TextField label="Shop or business name (optional)" fullWidth autoComplete="organization"
                  value={business} onChange={(e) => setBusiness(e.target.value.slice(0, 120))} />
              )}
              {vendor && (
                <Box>
                  <FormLabel component="legend" sx={{ fontSize: 14 }}>Where do you sell?</FormLabel>
                  {checkboxes(VENDOR_CHANNELS, channels, toggleIn(setChannels))}
                </Box>
              )}
              {vendor && (
                <Box>
                  <FormLabel component="legend" sx={{ fontSize: 14 }}>What would you use?</FormLabel>
                  {checkboxes(VENDOR_INTERESTS, interests, toggleIn(setInterests))}
                </Box>
              )}
              <TextField
                label={vendor ? 'Roughly how many cards do you keep on display?' : 'Roughly how many placeholders would you order?'} type="number" fullWidth
                value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
              />
              <Box>
                <FormLabel component="legend" sx={{ fontSize: 14 }}>{vendor ? 'Which games do you sell?' : 'For which games?'}</FormLabel>
                <FormGroup row>
                  {GAME_LIST.map((g) => (
                    <FormControlLabel key={g.id} label={g.name}
                      control={<Checkbox checked={games.has(g.id)} onChange={() => toggleGame(g.id)} />} />
                  ))}
                  <FormControlLabel label="Other games" control={<Checkbox checked={games.has('other')} onChange={() => toggleGame('other')} />} />
                </FormGroup>
              </Box>
              {/* Honeypot: hidden from people, tempting to bots. */}
              <input type="text" name="_gotcha" value={gotcha} onChange={(e) => setGotcha(e.target.value)}
                tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
              {error && <Alert severity="error">{error}</Alert>}
              <Typography variant="caption" color="text.secondary">
                We’ll only use your email to tell you when {vendor ? 'vendor features launch' : 'printing launches'} — no spam, and you can ask us to remove it
                anytime. Please don’t sign up if you’re under 13. See our{' '}
                <Link href={`${import.meta.env.BASE_URL}privacy`} target="_blank" rel="noopener">privacy policy</Link>.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Not now</Button>
            <Button type="submit" variant="contained" disabled={!validEmail || status === 'sending'}>
              {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}
