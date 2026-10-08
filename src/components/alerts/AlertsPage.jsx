import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, FormControlLabel, IconButton, Paper, Stack, Switch, Tooltip, Typography,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { catalogRows } from '../../catalog';
import { alertTargets, fetchAlertEmails, setAlertEmails, unsubscribeAlerts, usd } from '../../lib/alerts';
import { DISPLAY_FONT } from '../../theme';

// Today's price for an alert's product + printing, from the bundled catalog.
async function currentPrice(a) {
  const rows = await catalogRows(a.game, a.set_id).catch(() => []);
  const r = rows.find((x) => x[1] === Number(a.product_id));
  if (!r) return null;
  const prices = r[3] || {};
  return prices[a.printing] ?? Object.values(prices).find((v) => v != null) ?? null;
}

// The alert as a binder slot, for the edit dialog.
export const alertSlot = (a, price) => ({
  key: a.slot_key, game: a.game, setId: a.set_id, tcgplayerId: Number(a.product_id), name: a.card_name,
  setName: a.set_name, variantLabel: a.variant_label, numberLabel: a.number_label,
  images: a.image ? { small: a.image, large: a.image } : null, price: price ?? null,
});

const STATUS = {
  active: { label: 'Watching', color: 'success' },
  paused: { label: 'Paused', color: 'default' },
  hit: { label: 'Reached', color: 'warning' },
};

// "My alerts": each alert's target vs today's price, with edit / pause / re-arm /
// delete, and the alert-email switch. Also lands the email's unsubscribe link.
export default function AlertsPage({ api, userId, signedIn, onSignIn, onEdit, unsubscribeToken }) {
  const [prices, setPrices] = useState({});
  const [emails, setEmails] = useState(null);
  const [unsub, setUnsub] = useState(unsubscribeToken ? 'working' : null); // working | done | failed
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!unsubscribeToken) return;
    unsubscribeAlerts(unsubscribeToken).then((ok) => setUnsub(ok ? 'done' : 'failed')).catch(() => setUnsub('failed'));
  }, [unsubscribeToken]);
  useEffect(() => { if (signedIn) fetchAlertEmails().then(setEmails).catch(() => {}); }, [signedIn, unsub]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const a of api.alerts) {
        const p = await currentPrice(a);
        if (!cancelled) setPrices((m) => ({ ...m, [a.id]: p }));
      }
    })();
    return () => { cancelled = true; };
  }, [api.alerts]);

  const act = (fn) => async () => { setError(null); try { await fn(); } catch (e) { setError(e.message); } };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="overline" color="primary">Price alerts</Typography>
      <Typography variant="h1" sx={{ fontFamily: DISPLAY_FONT, fontSize: { xs: 34, md: 48 }, mt: 0.5 }}>My alerts</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 640 }}>
        Get an email when a card drops to the price you want to pay — or rises to the price you’d sell at. Set one with
        the <NotificationsActiveIcon sx={{ fontSize: 17, verticalAlign: '-3px' }} /> bell on any card. Prices update once a day.
      </Typography>

      {unsub === 'done' && <Alert severity="success" sx={{ mt: 3 }}>Alert emails are off. Your alerts are still here — turn emails back on below any time.</Alert>}
      {unsub === 'failed' && <Alert severity="warning" sx={{ mt: 3 }}>That unsubscribe link didn’t work. Sign in and turn alert emails off below.</Alert>}

      {!signedIn ? (
        <Paper variant="outlined" sx={{ p: 3, mt: 3, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>Sign in to set price alerts</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Alerts are emailed to your account’s address. Accounts are free.</Typography>
          {onSignIn && <Button variant="contained" onClick={onSignIn}>Sign in</Button>}
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 3, mb: 1.5, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <Typography color="text.secondary">{api.alerts.length} of {api.limit} alerts in use</Typography>
            <FormControlLabel label="Email me when an alert is reached" disabled={emails == null}
              control={<Switch checked={!!emails} onChange={(e) => { const v = e.target.checked; setEmails(v); setAlertEmails(userId, v).catch(() => setEmails(!v)); }} />} />
          </Stack>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {!api.loaded ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box> : !api.alerts.length ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              No alerts yet. Open a set or your wishlist and tap the bell on a card.
            </Paper>
          ) : (
            <Paper variant="outlined">
              {api.alerts.map((a, i) => {
                const p = prices[a.id];
                const st = STATUS[a.status] || STATUS.active;
                return (
                  <Stack key={a.id} direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 1.5, borderTop: i ? '1px solid' : 0, borderColor: 'divider' }}>
                    {a.image ? <Box component="img" src={a.image} alt="" sx={{ width: 40, aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                      : <Box sx={{ width: 40, aspectRatio: '63 / 88', borderRadius: '4px', bgcolor: 'action.hover', flexShrink: 0 }} />}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>{a.card_name}{a.variant_label ? ` · ${a.variant_label}` : ''}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>{[a.set_name, a.number_label && `#${a.number_label}`].filter(Boolean).join(' · ')}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{alertTargets(a)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {a.status === 'hit' && a.hit_price != null ? `hit ${usd(a.hit_price)} on ${new Date(a.hit_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : p != null ? `now ${usd(p)}` : ' '}
                      </Typography>
                    </Box>
                    <Chip size="small" label={st.label} color={st.color} variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
                    <Stack direction="row" sx={{ flexShrink: 0 }}>
                      {a.status === 'hit' ? (
                        <Tooltip title="Re-arm — watch for this price again"><IconButton size="small" onClick={act(() => api.update(a.id, { status: 'active', hit_at: null, hit_price: null }))} aria-label={`Re-arm alert: ${a.card_name}`}><ReplayIcon fontSize="small" /></IconButton></Tooltip>
                      ) : a.status === 'paused' ? (
                        <Tooltip title="Resume"><IconButton size="small" onClick={act(() => api.update(a.id, { status: 'active' }))} aria-label={`Resume alert: ${a.card_name}`}><PlayArrowIcon fontSize="small" /></IconButton></Tooltip>
                      ) : (
                        <Tooltip title="Pause"><IconButton size="small" onClick={act(() => api.update(a.id, { status: 'paused' }))} aria-label={`Pause alert: ${a.card_name}`}><PauseIcon fontSize="small" /></IconButton></Tooltip>
                      )}
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => onEdit(alertSlot(a, p))} aria-label={`Edit alert: ${a.card_name}`}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" onClick={act(() => api.remove(a.id))} aria-label={`Delete alert: ${a.card_name}`}><DeleteOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  </Stack>
                );
              })}
            </Paper>
          )}
        </>
      )}
    </Container>
  );
}
