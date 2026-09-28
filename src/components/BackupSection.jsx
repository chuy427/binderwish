import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { parseBackup } from '../lib/backup';

// "Your data" sidebar section: export a backup file, or import one (merge or replace).
export default function BackupSection({ ownedCount, queueCount, defaultOptions, onExport, onImport }) {
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // parsed backup awaiting confirmation
  const [error, setError] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('That file is too large to be a BinderWish backup.');
      setPending(parseBackup(await file.text(), defaultOptions));
    } catch (err) {
      setError(err.message);
    }
  }

  function apply(mode) {
    onImport(mode, pending);
    setPending(null);
  }

  const date = pending?.exportedAt ? new Date(pending.exportedAt).toLocaleDateString() : null;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Your owned cards and print sheet are saved only in this browser. Export a backup to keep them safe
        or move them to another device.
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={onExport}>Export backup</Button>
        <Button variant="outlined" size="small" startIcon={<UploadIcon />} onClick={() => fileRef.current.click()}>Import backup</Button>
      </Stack>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      {error && <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Import backup?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            This backup{date ? ` from ${date}` : ''} has <b>{pending?.owned.length}</b> owned
            card{pending?.owned.length === 1 ? '' : 's'} and <b>{pending?.queue.length}</b> placeholder
            {pending?.queue.length === 1 ? '' : 's'} on its print sheet.
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5 }}>
            This browser currently has {ownedCount} owned and {queueCount} on the print sheet.
          </DialogContentText>
          <Typography variant="body2" sx={{ mt: 2 }}>
            <b>Merge</b> combines both. <b>Replace</b> swaps everything here — including your print settings —
            for the backup.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>Cancel</Button>
          <Button color="error" onClick={() => apply('replace')}>Replace</Button>
          <Button variant="contained" onClick={() => apply('merge')}>Merge</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
