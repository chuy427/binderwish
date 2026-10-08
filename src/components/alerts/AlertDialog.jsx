import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment,
  Stack, TextField, Typography,
} from '@mui/material';
import CardImg from '../CardImg';
import { usd } from '../../lib/alerts';

// Set (or change) a price alert on one card version: drops to and/or rises to.
export default function AlertDialog({ slot, existing, count, limit, onSave, onDelete, onClose }) {
  const price = slot?.price ?? null;
  const [useBelow, setUseBelow] = useState(true);
  const [useAbove, setUseAbove] = useState(false);
  const [below, setBelow] = useState('');
  const [above, setAbove] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slot) return;
    setUseBelow(existing ? existing.below != null : true);
    setUseAbove(existing ? existing.above != null : false);
    // Suggest 15% under / 25% over today's price.
    setBelow(existing?.below != null ? String(existing.below) : price ? (price * 0.85).toFixed(2) : '');
    setAbove(existing?.above != null ? String(existing.above) : '');
    setError(null);
  }, [slot]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!slot) return null;
  const num = (v) => { const n = parseFloat(String(v).replace(/[$,\s]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
  const b = useBelow ? num(below) : null;
  const a = useAbove ? num(above) : null;
  const invalid = (useBelow && b == null) || (useAbove && a == null) || (!useBelow && !useAbove) || (b != null && a != null && b >= a);
  const full = !existing && count >= limit;
  const vs = (n) => (price && n ? ` ${Math.abs(Math.round((1 - n / price) * 100))}% ${n < price ? 'below' : 'above'} today` : '');

  async function save() {
    setBusy(true); setError(null);
    try { await onSave({ below: b, above: a }); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError(null);
    try { await onDelete(); } catch (e) { setError(e.message); setBusy(false); }
  }

  const field = (value, set, enabled, placeholder, n) => (
    <TextField size="small" fullWidth disabled={!enabled} value={value} placeholder={placeholder}
      onChange={(e) => set(e.target.value.replace(/[^\d.]/g, '').slice(0, 9))}
      slotProps={{
        htmlInput: { inputMode: 'decimal' },
        input: {
          startAdornment: <InputAdornment position="start">$</InputAdornment>,
          endAdornment: enabled && n ? <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{vs(n)}</Typography></InputAdornment> : null,
        },
      }} />
  );

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{existing ? 'Edit price alert' : 'Price alert'}</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
          <Box component={CardImg} slot={slot} alt="" sx={{ width: 48, aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{slot.name}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {[slot.setName, slot.numberLabel && `#${slot.numberLabel}`, slot.variantLabel].filter(Boolean).join(' · ')}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.25 }}>
              {price != null ? <>Market price today <b>{usd(price)}</b></> : 'No market price yet'}
            </Typography>
          </Box>
        </Stack>
        {full ? (
          <Alert severity="info">You’re using all {limit} of your price alerts. Remove one on My alerts to add another.</Alert>
        ) : (
          <Stack spacing={1}>
            <FormControlLabel control={<Checkbox checked={useBelow} onChange={(e) => setUseBelow(e.target.checked)} />}
              label={<>Email me when it <b>drops to</b></>} />
            {field(below, setBelow, useBelow, 'e.g. 35.00', b)}
            <FormControlLabel control={<Checkbox checked={useAbove} onChange={(e) => setUseAbove(e.target.checked)} />}
              label={<>Email me when it <b>rises to</b></>} sx={{ mt: 1 }} />
            {field(above, setAbove, useAbove, price ? `e.g. ${(price * 1.25).toFixed(2)}` : 'e.g. 60.00', a)}
            {b != null && a != null && b >= a && <Typography variant="caption" color="error">The “drops to” price should be below the “rises to” price.</Typography>}
            {price != null && ((b != null && price <= b) || (a != null && price >= a)) && !(b != null && a != null && b >= a) && (
              <Typography variant="caption" color="warning.main">Today’s price is already there — you’ll get an email tonight.</Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ pt: 1, lineHeight: 1.5 }}>
              Prices update once a day, so you’ll hear the evening after it gets there. Market price is TCGPlayer’s
              recent-sales average — what you’d get selling is usually a bit less. {!existing && `${count} of ${limit} alerts in use.`}
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {existing && <Button color="error" onClick={remove} disabled={busy} sx={{ mr: 'auto' }}>Delete alert</Button>}
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {!full && <Button variant="contained" onClick={save} disabled={busy || invalid}>{busy ? 'Saving…' : existing ? 'Save' : 'Set alert'}</Button>}
      </DialogActions>
    </Dialog>
  );
}
