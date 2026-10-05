import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { deletePick, savePick, slugify } from '../../lib/picks';
import { TOMATO } from '../../theme';

// Publish a custom set as a BinderWish pick (or edit an existing pick's details).
//   source: { cs, slots } — the curator's custom set and its cards (publish / update cards)
//   existing: the pick being edited, if any
//   slots: cards to choose covers from
export default function PublishPickDialog({ open, onClose, userId, curator, existing, source, slots, onSaved, onDeleted }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [covers, setCovers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const choices = (slots || []).filter((s) => s.images?.small).slice(0, 24);
  useEffect(() => {
    if (!open) return;
    setTitle(existing?.title || source?.cs.name || '');
    setDescription(existing?.description || '');
    setSlug(existing?.slug || slugify(source?.cs.name || ''));
    setSlugTouched(!!existing);
    setCovers(existing?.covers?.length ? existing.covers : choices.slice(0, 3).map((s) => ({ key: s.key, img: s.images.small })));
    setError(null);
    setConfirmDelete(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCover = (s) => setCovers((c) => (c.some((x) => x.key === s.key)
    ? c.filter((x) => x.key !== s.key)
    : c.length >= 3 ? c : [...c, { key: s.key, img: s.images.small }]));

  const valid = title.trim() && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  async function save(published = existing ? existing.published : true) {
    setBusy(true); setError(null);
    try {
      const cs = source?.cs;
      const pick = await savePick(userId, {
        id: existing?.id,
        slug, title, description, covers, published,
        game: cs?.game || existing.game,
        definition: cs ? { names: cs.names, artists: cs.artists, picks: cs.picks, hidden: cs.hidden } : existing.definition,
        count: source ? source.slots.length : existing.count,
        sourceId: cs?.id || existing?.sourceId || null,
      });
      onSaved(pick, { published });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try { await deletePick(existing.id); onDeleted?.(existing); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const verb = existing ? (source ? 'Update pick' : 'Save') : 'Publish';
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existing ? `Edit “${existing.title}”` : 'Publish as a BinderWish pick'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {source
            ? <>From your custom set “{source.cs.name}” · {source.slots.length} cards{existing ? ' — updating replaces the pick’s cards with this set’s current ones.' : '.'} </>
            : 'To change which cards are in it, edit the custom set it was published from and choose Update pick there.'}
          {' '}Published as <b>{curator?.name}</b>.
        </Typography>
        <Stack spacing={2}>
          <TextField label="Title" value={title} required fullWidth autoFocus
            onChange={(e) => { const v = e.target.value.slice(0, 80); setTitle(v); if (!slugTouched) setSlug(slugify(v)); }} />
          <TextField label="Why collect it" value={description} multiline minRows={3} fullWidth
            helperText={`${description.length}/600 — shown on the pick’s page and in search results`}
            onChange={(e) => setDescription(e.target.value.slice(0, 600))} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Cover cards — choose up to 3</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 0.75 }}>
              {choices.map((s) => {
                const i = covers.findIndex((c) => c.key === s.key);
                return (
                  <Box key={s.key} component="button" type="button" onClick={() => toggleCover(s)} aria-pressed={i >= 0}
                    aria-label={`${s.name}${i >= 0 ? `, cover ${i + 1}` : ''}`}
                    sx={{ p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer', position: 'relative', borderRadius: '5px',
                      outline: i >= 0 ? `2px solid ${TOMATO}` : 'none', outlineOffset: 1, opacity: i >= 0 || covers.length < 3 ? 1 : 0.4 }}>
                    <Box component="img" src={s.images.small} alt="" loading="lazy" sx={{ width: '100%', aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: '5px', display: 'block' }} />
                    {i >= 0 && <Box sx={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', bgcolor: TOMATO, color: '#1B1B1F', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</Box>}
                  </Box>
                );
              })}
            </Box>
          </Box>
          <TextField label="Address" value={slug} disabled={!!existing} fullWidth
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80)); }}
            helperText={existing ? 'The address stays the same so shared links keep working.' : `binderwish.com/picks/${slug || '…'}`} />
          {error && <Alert severity="error">{error}</Alert>}
          {confirmDelete && (
            <Alert severity="warning" action={<Button color="inherit" size="small" onClick={remove} disabled={busy}>Delete</Button>}>
              Delete this pick for everyone? Collectors following it lose it from My sets (their checked-off cards stay).
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {existing && (
          <>
            <Button color="error" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete</Button>
            <Button onClick={() => save(!existing.published)} disabled={busy || !valid} sx={{ mr: 'auto' }}>
              {existing.published ? 'Unpublish' : 'Publish again'}
            </Button>
          </>
        )}
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={() => save()} disabled={busy || !valid}>{busy ? 'Saving…' : verb}</Button>
      </DialogActions>
    </Dialog>
  );
}
