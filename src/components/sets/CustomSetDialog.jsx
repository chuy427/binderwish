import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BackHandOutlinedIcon from '@mui/icons-material/BackHandOutlined';
import { GAME_LIST, getGame } from '../../games';

const CHARACTER_WORD = { pokemon: 'Pokémon', lorcana: 'characters', onepiece: 'characters' };
const EXAMPLES = { pokemon: 'e.g. Charizard, Eevee, Umbreon', lorcana: 'e.g. Mickey Mouse, Stitch', onepiece: 'e.g. Monkey.D.Luffy, Nami' };

// Create or edit a custom set: a name, plus optional rules (Pokémon / characters,
// and for Pokémon, artists). With no rules it's a hand-picked set.
export default function CustomSetDialog({ open, initial, defaultGame, onClose, onSave }) {
  const editing = !!initial;
  const [game, setGame] = useState(defaultGame);
  const [name, setName] = useState('');
  const [names, setNames] = useState([]);
  const [artists, setArtists] = useState([]);
  const [kind, setKind] = useState('rules'); // rules | picks (create only)
  const [suggestions, setSuggestions] = useState([]);
  // Text typed but not yet turned into a chip (Enter) still counts.
  const [typedName, setTypedName] = useState('');
  const [typedArtist, setTypedArtist] = useState('');

  useEffect(() => {
    if (!open) return;
    setGame(initial?.game || defaultGame);
    setName(initial?.name || '');
    setNames(initial?.names || []);
    setArtists(initial?.artists || []);
    setKind(initial && !initial.names.length && !initial.artists.length ? 'picks' : 'rules');
    setTypedName(''); setTypedArtist('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // One Piece matches exact character names, so offer the real ones.
  useEffect(() => {
    const g = getGame(game);
    setSuggestions([]);
    if (open && g.characterNames) g.characterNames().then(setSuggestions).catch(() => {});
  }, [game, open]);

  const g = getGame(game);
  const word = CHARACTER_WORD[game] || 'characters';
  const allowsArtists = g.collectionRules?.includes('artist');
  const rules = editing || kind === 'rules';
  const withTyped = (list, typed) => [...new Set([...list, typed.trim()].filter(Boolean))];
  const allNames = withTyped(names, typedName);
  const allArtists = withTyped(artists, typedArtist);
  const autoName = allNames[0] ? `My ${allNames[0]} set` : allArtists[0] ? `Art by ${allArtists[0]}` : '';
  const finalName = name.trim() || autoName || (rules ? '' : 'My custom set');
  const valid = !!finalName && (!rules || allNames.length > 0 || allArtists.length > 0 || editing);

  const chips = (value, onChange, typed, setTyped, options, label, placeholder, helper) => (
    <Autocomplete multiple freeSolo autoSelect options={options} value={value} filterSelectedOptions
      inputValue={typed} onInputChange={(_, v) => setTyped(v)}
      onChange={(_, v) => { onChange([...new Set(v.map((x) => x.trim()).filter(Boolean))]); setTyped(''); }}
      renderValue={(vals, getItemProps) => vals.map((v, i) => { const { key, ...p } = getItemProps({ index: i }); return <Chip key={key} label={v} size="small" {...p} />; })}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? '' : placeholder} helperText={helper} />}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ game, name: finalName, names: rules ? allNames : [], artists: rules && allowsArtists ? allArtists : [] });
      }}>
        <DialogTitle>{editing ? 'Edit custom set' : 'New custom set'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            {!editing && (
              <ToggleButtonGroup exclusive size="small" value={game} onChange={(_, v) => v && setGame(v)} aria-label="Game">
                {GAME_LIST.map((x) => <ToggleButton key={x.id} value={x.id} sx={{ px: 2 }}>{x.name}</ToggleButton>)}
              </ToggleButtonGroup>
            )}
            {!editing && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {[
                  { id: 'rules', icon: <AutoAwesomeIcon />, title: `By ${word === 'Pokémon' ? 'Pokémon' : 'character'}`, body: `Every card of the ${word} you choose — new releases get added automatically.` },
                  { id: 'picks', icon: <BackHandOutlinedIcon />, title: 'Hand-picked', body: 'Start empty and add exactly the cards you want, from any set.' },
                ].map((o) => (
                  <Box key={o.id} component="button" type="button" onClick={() => setKind(o.id)} aria-pressed={kind === o.id}
                    sx={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', p: 2, borderRadius: '14px',
                      bgcolor: kind === o.id ? 'rgba(255,99,71,.12)' : 'rgba(255,255,255,.04)',
                      border: '1px solid', borderColor: kind === o.id ? 'primary.main' : 'rgba(255,255,255,.1)' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: kind === o.id ? 'primary.main' : 'text.primary' }}>
                      {o.icon}<Typography sx={{ fontWeight: 700 }}>{o.title}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{o.body}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {rules && chips(names, setNames, typedName, setTypedName, suggestions, word === 'Pokémon' ? 'Pokémon' : 'Characters', EXAMPLES[game],
              game === 'pokemon'
                ? 'Press Enter after each. Matches every card with that name — “Pikachu” also finds Surfing Pikachu, Pikachu ex… (you can hide any).'
                : game === 'onepiece' ? 'Pick from the list — One Piece matches the exact character name.' : 'Press Enter after each. Includes every version of the character.')}
            {rules && allowsArtists && chips(artists, setArtists, typedArtist, setTypedArtist, [], 'Artists (optional)', 'e.g. Mitsuhiro Arita', 'Every card they illustrated. Use their name as printed on the card.')}
            <TextField label="Set name" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder={autoName || 'My custom set'}
              helperText={!name && autoName ? `Leave blank to call it “${autoName}”.` : ' '} />
            {editing && (
              <Typography variant="body2" color="text.secondary">
                Hand-picked cards stay in the set. Clear every {word === 'Pokémon' ? 'Pokémon' : 'character'} to make it fully hand-picked.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!valid}>{editing ? 'Save' : 'Create set'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
