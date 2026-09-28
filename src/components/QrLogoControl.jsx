import { useRef, useState } from 'react';
import { Alert, Box, Button, FormHelperText, Stack, Typography } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { MIN_QR_WITH_LOGO, logoFromFile } from '../lib/logo';

// "Your logo in the QR code" — for vendors and shops. Stored with the print
// settings (and so in backups); applies to both card styles.
export default function QrLogoControl({ options, setOption }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);
  const logo = options.qrLogo;

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      setOption('qrLogo', await logoFromFile(file));
      if (options.qrSize < MIN_QR_WITH_LOGO) setOption('qrSize', MIN_QR_WITH_LOGO);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Box>
      <Typography variant="body2" gutterBottom>Your logo in the QR code</Typography>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        {logo?.src && (
          <Box sx={{ width: 44, height: 44, borderRadius: 1, bgcolor: '#fff', display: 'grid', placeItems: 'center', p: 0.5, flexShrink: 0 }}>
            <Box component="img" src={logo.src} alt="Your logo" sx={{ maxWidth: '100%', maxHeight: '100%' }} />
          </Box>
        )}
        <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} onClick={() => fileRef.current.click()}>
          {logo?.src ? 'Change' : 'Add logo'}
        </Button>
        {logo?.src && (
          <Button size="small" color="inherit" startIcon={<DeleteOutlineIcon />} onClick={() => setOption('qrLogo', null)}>Remove</Button>
        )}
      </Stack>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={onFile} />
      <FormHelperText>
        Shown in the center of every QR code — great for shops and vendors. Uses the strongest error correction and a
        QR of at least {MIN_QR_WITH_LOGO} mm so it still scans. Square logos work best.
      </FormHelperText>
      {error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}
    </Box>
  );
}
