import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';

// Where a set is kept: the binder it's in and where that binder lives.
export const binderLabel = ({ binder, location } = {}) => [binder, location].filter(Boolean).join(' · ');

// Compact line for tiles.
export function BinderLine({ binder, location, sx }) {
  if (!binder && !location) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary', minWidth: 0, ...sx }}>
      <CollectionsBookmarkOutlinedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
      <Typography variant="caption" noWrap>{binderLabel({ binder, location })}</Typography>
    </Stack>
  );
}

// On a set page: the binder + location, with an edit dialog. `binders` / `locations`
// are names already in use, offered as suggestions so sets can share a binder.
export default function BinderInfo({ binder = '', location = '', binders = [], locations = [], onSave }) {
  const [open, setOpen] = useState(false);
  const has = !!(binder || location);
  return (
    <>
      {has ? (
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap', color: 'text.secondary' }}>
          {binder && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <CollectionsBookmarkOutlinedIcon fontSize="small" /><Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>{binder}</Typography>
            </Stack>
          )}
          {location && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <PlaceOutlinedIcon fontSize="small" /><Typography variant="body2">{location}</Typography>
            </Stack>
          )}
          <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={() => setOpen(true)} sx={{ minWidth: 0 }}>Edit</Button>
        </Stack>
      ) : (
        <Button size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ mt: 0.5, ml: -0.75 }}>Add binder &amp; location</Button>
      )}
      <BinderDialog open={open} onClose={() => setOpen(false)} binder={binder} location={location}
        binders={binders} locations={locations} onSave={(v) => { onSave(v); setOpen(false); }} />
    </>
  );
}

function BinderDialog({ open, onClose, binder, location, binders, locations, onSave }) {
  const [b, setB] = useState(binder);
  const [l, setL] = useState(location);
  useEffect(() => { if (open) { setB(binder); setL(location); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = (value, setValue, options, label, placeholder, helper) => (
    <Autocomplete freeSolo options={options.filter((o) => o !== value)} value={value || null} inputValue={value}
      onChange={(_, v) => setValue((v || '').slice(0, 60))} onInputChange={(_, v) => setValue(v.slice(0, 60))}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} helperText={helper}
          slotProps={{ ...params.slotProps, inputLabel: { ...params.slotProps?.inputLabel, shrink: !!value || undefined } }} />
      )} />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); onSave({ binder: b.trim(), location: l.trim() }); }}>
        <DialogTitle>Where is this set kept?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Name the binder and where it lives, so you can find it later. Both are optional.
          </Typography>
          <Stack spacing={2}>
            {field(b, setB, binders, 'Binder', 'e.g. Blue Vault X binder', binders.length ? 'Pick one you already use, or name a new one.' : ' ')}
            {field(l, setL, locations, 'Location', 'e.g. Office shelf 2', ' ')}
          </Stack>
        </DialogContent>
        <DialogActions>
          {(binder || location) && <Button color="error" onClick={() => onSave({ binder: '', location: '' })} sx={{ mr: 'auto' }}>Clear</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
