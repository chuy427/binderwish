import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { matchImport, parseCsv } from '../../lib/importCsv';
import { GAME_LIST } from '../../games';
import { TOMATO } from '../../theme';

// "Import collection": a CSV from TCGPlayer, Collectr or a spreadsheet → check off
// the matching cards. Shows what matched (and what didn't) before changing anything.
export default function ImportDialog({ open, defaultGame, getSetsInfo, owned, onClose, onImport }) {
  const fileRef = useRef(null);
  const [game, setGame] = useState(defaultGame);
  const [state, setState] = useState({ step: 'pick' }); // pick | reading | review | error
  const [dragging, setDragging] = useState(false);

  const reset = () => { setState({ step: 'pick' }); setGame(defaultGame); };
  const close = () => { onClose(); setTimeout(reset, 200); };

  async function read(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setState({ step: 'error', error: 'That file is too large — exports are usually well under 10 MB.' }); return; }
    setState({ step: 'reading', file: file.name, progress: 0 });
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('That file has no rows to import. Export it as CSV and try again.');
      const result = await matchImport(rows, {
        defaultGame: game, getSetsInfo,
        onProgress: (done, total) => setState((s) => ({ ...s, progress: total ? done / total : 0 })),
      });
      setState({ step: 'review', file: file.name, result });
    } catch (err) {
      setState({ step: 'error', error: err.message || 'Couldn’t read that file.' });
    }
  }

  const result = state.result;
  const fresh = result ? result.slots.filter((s) => !owned.has(s.key)) : [];

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>Import your collection</DialogTitle>
      <DialogContent>
        {(state.step === 'pick' || state.step === 'error') && (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Already tracking somewhere else? Export your collection as a CSV file and we’ll check off the matching
              cards here. Works with TCGPlayer and Collectr exports, or any spreadsheet with a set and card number
              (or name) for each card.
            </Typography>
            <TextField select size="small" label="Game, if the file doesn’t say" value={game} onChange={(e) => setGame(e.target.value)} sx={{ mb: 2, minWidth: 240 }}>
              {GAME_LIST.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
            </TextField>
            <Box component="button" type="button" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); read(e.dataTransfer.files?.[0]); }}
              sx={{ width: '100%', font: 'inherit', color: 'inherit', cursor: 'pointer', bgcolor: dragging ? 'rgba(255,99,71,.08)' : 'transparent',
                border: `1.5px dashed ${dragging ? TOMATO : 'rgba(255,255,255,.2)'}`, borderRadius: '14px', py: 4, px: 2,
                display: 'grid', placeItems: 'center', gap: 1, '&:hover': { borderColor: TOMATO } }}>
              <UploadFileIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 700 }}>Choose a CSV file</Typography>
              <Typography variant="body2" color="text.secondary">or drop it here</Typography>
            </Box>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; read(f); }} />
            {state.step === 'error' && <Alert severity="error" sx={{ mt: 2 }}>{state.error}</Alert>}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              The file is read in your browser — it isn’t uploaded anywhere.
            </Typography>
          </>
        )}

        {state.step === 'reading' && (
          <Box sx={{ py: 3 }}>
            <Typography sx={{ mb: 1.5 }}>Matching cards from <b>{state.file}</b>…</Typography>
            <LinearProgress variant={state.progress ? 'determinate' : 'indeterminate'} value={(state.progress || 0) * 100} />
          </Box>
        )}

        {state.step === 'review' && (
          <>
            <Typography sx={{ mb: 2 }}>
              Matched <b>{result.slots.length}</b> of {result.total} card{result.total === 1 ? '' : 's'} from <b>{state.file}</b>
              {result.slots.length > 0 && <> — <b>{fresh.length}</b> you haven’t checked off yet</>}.
            </Typography>
            {result.sets.length > 0 && (
              <Box sx={{ maxHeight: 200, overflow: 'auto', borderRadius: '10px', bgcolor: 'rgba(255,255,255,.04)', p: 1.5, mb: 2 }}>
                {result.sets.map((s) => (
                  <Stack key={`${s.game}|${s.setId}`} direction="row" sx={{ justifyContent: 'space-between', gap: 2, py: 0.25 }}>
                    <Typography variant="body2" noWrap>{s.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{s.count} card{s.count === 1 ? '' : 's'}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
            {result.unmatched.length > 0 && (
              <Alert severity="warning" sx={{ '& .MuiAlert-message': { minWidth: 0, width: '100%' } }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {result.unmatched.length} row{result.unmatched.length === 1 ? '' : 's'} couldn’t be matched
                </Typography>
                <Box sx={{ maxHeight: 140, overflow: 'auto' }}>
                  {result.unmatched.slice(0, 100).map((u) => (
                    <Typography key={u.line} variant="caption" sx={{ display: 'block' }} noWrap title={u.text}>
                      Row {u.line}: {u.text} — {u.reason}
                    </Typography>
                  ))}
                  {result.unmatched.length > 100 && <Typography variant="caption">…and {result.unmatched.length - 100} more</Typography>}
                </Box>
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {state.step === 'review' ? (
          <>
            <Button onClick={reset} sx={{ mr: 'auto' }}>Choose another file</Button>
            <Button onClick={close}>Cancel</Button>
            <Button variant="contained" disabled={!fresh.length} onClick={() => { onImport(result.slots); close(); }}>
              {fresh.length ? `Check off ${fresh.length} card${fresh.length === 1 ? '' : 's'}` : 'Nothing new to add'}
            </Button>
          </>
        ) : (
          <Button onClick={close}>Cancel</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
