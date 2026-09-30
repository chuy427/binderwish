import { useState } from 'react';
import {
  Alert, Avatar, Badge, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, ListItemIcon, Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { deleteAccount, sendSignInLink, signOut } from '../lib/cloud';

const STATUS = {
  loading: { icon: <CloudSyncIcon fontSize="small" />, text: 'Loading your collection…', color: 'text.secondary' },
  saving: { icon: <CloudSyncIcon fontSize="small" />, text: 'Saving…', color: 'text.secondary' },
  saved: { icon: <CloudDoneIcon fontSize="small" />, text: 'Synced to your account', color: 'success.main' },
  error: { icon: <CloudOffIcon fontSize="small" />, text: 'Couldn’t sync — changes are kept on this device', color: 'error.main' },
};

// Header control: "Sign in" for guests; an avatar with a sync menu once signed in.
export default function AccountMenu({ sync, onPrivacy }) {
  const { user, status, retry } = sync;
  const [signInOpen, setSignInOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user) {
    return (
      <>
        <Button color="inherit" startIcon={<PersonOutlineIcon />} onClick={() => setSignInOpen(true)}
          sx={{ flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }}>Sign in</Button>
        <IconButton aria-label="Sign in" onClick={() => setSignInOpen(true)} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
          <PersonOutlineIcon />
        </IconButton>
        <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} onPrivacy={onPrivacy} />
      </>
    );
  }

  const st = STATUS[status] || STATUS.saved;
  return (
    <>
      <Tooltip title={st.text}>
        <IconButton aria-label="Account" onClick={(e) => setAnchor(e.currentTarget)} sx={{ p: 0.5, flexShrink: 0 }}>
          <Badge overlap="circular" variant="dot" invisible={status === 'saved'}
            color={status === 'error' ? 'error' : 'warning'} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(255,255,255,.12)', color: 'text.primary', fontWeight: 700 }}>
              {(user.email || '?')[0].toUpperCase()}
            </Avatar>
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ px: 2, py: 1, maxWidth: 300 }}>
          <Typography variant="body2" color="text.secondary">Signed in as</Typography>
          <Typography sx={{ fontWeight: 700 }} noWrap>{user.email}</Typography>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 1, color: st.color }}>
            {st.icon}<Typography variant="body2">{st.text}</Typography>
          </Stack>
          {status === 'error' && <Button size="small" onClick={retry} sx={{ mt: 0.5, px: 0 }}>Try again</Button>}
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); signOut(); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>Sign out
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); setConfirmDelete(true); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutlinedIcon fontSize="small" color="error" /></ListItemIcon>Delete account…
        </MenuItem>
      </Menu>
      <DeleteAccountDialog open={confirmDelete} email={user.email} onClose={() => setConfirmDelete(false)} />
    </>
  );
}

function SignInDialog({ open, onClose, onPrivacy }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState(null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const close = () => { onClose(); setTimeout(() => { setState('idle'); setError(null); }, 200); };
  async function submit(e) {
    e.preventDefault();
    if (!valid || state === 'sending') return;
    setState('sending'); setError(null);
    try { await sendSignInLink(email.trim()); setState('sent'); }
    catch (err) { setError(err.message); setState('idle'); }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      {state === 'sent' ? (
        <>
          <DialogContent>
            <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
              <MarkEmailReadIcon color="primary" sx={{ fontSize: 48 }} />
              <Typography variant="h6">Check your email</Typography>
              <Typography color="text.secondary">
                We sent a sign-in link to <b>{email.trim()}</b>. Open it on this device to sign in — it may take a minute
                to arrive, and could land in spam.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setState('idle')}>Use a different email</Button>
            <Button variant="contained" onClick={close}>Done</Button>
          </DialogActions>
        </>
      ) : (
        <Box component="form" onSubmit={submit} noValidate>
          <DialogTitle>Save your progress</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary" sx={{ mb: 2.5 }}>
              Sign in to keep your checklist, print sheet and settings in your account and pick up on any device.
              No password — we’ll email you a sign-in link. Anything you’ve already checked off here comes with you.
            </Typography>
            <TextField autoFocus fullWidth label="Email" type="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Accounts are free and optional. See our{' '}
              <Box component="a" href="#" onClick={(e) => { e.preventDefault(); close(); onPrivacy(); }} sx={{ color: 'primary.main' }}>privacy policy</Box>.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!valid || state === 'sending'}
              startIcon={state === 'sending' ? <CircularProgress size={16} color="inherit" /> : null}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}

function DeleteAccountDialog({ open, email, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function confirm() {
    setBusy(true); setError(null);
    try { await deleteAccount(); onClose(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete your account?</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          This permanently deletes <b>{email}</b> and the collection saved to it — checklist, print sheet and settings.
          It can’t be undone. Export a backup first if you might want your data later.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button color="error" variant="contained" onClick={confirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete account'}</Button>
      </DialogActions>
    </Dialog>
  );
}
