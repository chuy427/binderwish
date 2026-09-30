import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider, FormControl, FormControlLabel, FormHelperText,
  IconButton, InputLabel, Link, List, ListItem, ListItemAvatar, ListItemText, MenuItem, Paper,
  Select, Slider, Stack, Switch, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import NorthWestIcon from '@mui/icons-material/NorthWest';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthWestIcon from '@mui/icons-material/SouthWest';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import PlaceholderCard from './PlaceholderCard';
import QrLogoControl from './QrLogoControl';
import { MIN_QR_WITH_LOGO } from '../lib/logo';
import { cardImage, tcgplayerUrl } from '../catalog';

const SAMPLE = {
  name: 'Exeggcute', setName: 'Prismatic Evolutions', number: '001', numberLabel: '001/131',
  variantLabel: 'Poké Ball Pattern', image: 'https://assets.tcgdex.net/en/sv/sv08.5/001', tcgplayerId: 610536, price: 0.32,
};

function SectionTitle({ children }) {
  return (
    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', fontWeight: 700, letterSpacing: '.08em', mb: 1 }}>
      {children}
    </Typography>
  );
}

function Toggle({ checked, onChange, label, help }) {
  return (
    <Box>
      <FormControlLabel control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />} label={label} />
      {help && <FormHelperText sx={{ mt: -0.5, ml: 6 }}>{help}</FormHelperText>}
    </Box>
  );
}

// `embedded`: shown inside a drawer (no border, no sticky scrolling of its own).
export default function PrintSheetPanel({ queue, options, setOption, onQty, onClear, stats, dataSection, embedded = false }) {
  const preview = queue[queue.length - 1] || SAMPLE;

  return (
    <Paper
      variant="outlined"
      sx={embedded ? { p: { xs: 2, sm: 2.5 }, border: 0, borderRadius: 0, bgcolor: 'transparent' } : {
        p: { xs: 2, sm: 2.5 },
        position: { md: 'sticky' },
        top: { md: 88 },
        maxHeight: { md: 'calc(100vh - 104px)' },
        overflow: { md: 'auto' },
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle>Print sheet</SectionTitle>
        {queue.length > 0 && (
          <Button size="small" color="error" startIcon={<DeleteSweepIcon />} onClick={onClear} sx={{ mb: 1 }}>
            Clear
          </Button>
        )}
      </Stack>

      {queue.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          <CollectionsBookmarkIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body2">No placeholders yet — pick a set and add the cards you’re missing.</Typography>
        </Box>
      ) : (
        <>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
            <Chip size="small" label={`${stats.count} placeholder${stats.count === 1 ? '' : 's'}`} />
            <Chip size="small" label={`≈ ${stats.sheets} page${stats.sheets === 1 ? '' : 's'}`} />
            {stats.priced > 0 && (
              <Chip size="small" color="success" variant="outlined"
                label={`To buy ≈ $${stats.total.toFixed(2)}${stats.priced < stats.count ? ' (partial)' : ''}`} />
            )}
          </Stack>
          <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto', mx: -1 }}>
            {queue.map((slot) => (
              <ListItem
                key={slot.key}
                sx={{ px: 1 }}
                secondaryAction={
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <IconButton size="small" aria-label="Remove one" onClick={() => onQty(slot.key, -1)}><RemoveIcon fontSize="small" /></IconButton>
                    <Typography variant="body2" sx={{ minWidth: 18, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{slot.qty}</Typography>
                    <IconButton size="small" aria-label="Add one" onClick={() => onQty(slot.key, 1)}><AddIcon fontSize="small" /></IconButton>
                  </Stack>
                }
              >
                <ListItemAvatar sx={{ minWidth: 48 }}>
                  <Avatar variant="rounded" src={cardImage(slot) || undefined} sx={{ width: 36, height: 50, filter: 'grayscale(1)', opacity: 0.7 }} />
                </ListItemAvatar>
                <ListItemText
                  sx={{ pr: 11 }}
                  primary={`${slot.name}${slot.variantLabel ? ` · ${slot.variantLabel}` : ''}`}
                  slotProps={{ primary: { noWrap: true, fontWeight: 500 }, secondary: { component: 'div', noWrap: true } }}
                  secondary={
                    <>
                      {slot.setName} #{slot.numberLabel || slot.number} ·{' '}
                      {slot.status === 'pending'
                        ? <CircularProgress size={10} sx={{ verticalAlign: 'middle' }} />
                        : <Link href={tcgplayerUrl(slot)} target="_blank" rel="noopener" underline="hover">
                            {slot.price != null ? `$${slot.price.toFixed(2)}` : 'TCGPlayer'}
                          </Link>}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Divider sx={{ my: 2 }} />
      <SectionTitle>Collecting</SectionTitle>
      <Toggle
        checked={options.variants}
        onChange={(v) => setOption('variants', v)}
        label="Master set (every variant)"
        help="Every printing gets its own slot — reverse holos, cold foils, Poké Ball / Master Ball patterns, Enchanted cards and more."
      />


      <Divider sx={{ my: 2 }} />
      <SectionTitle>Binder layout</SectionTitle>
      <Stack spacing={0.5}>
        <Toggle
          checked={options.keepPositions}
          onChange={(v) => setOption('keepPositions', v)}
          label="Match binder page positions"
          help="Each printed page mirrors a 9-pocket binder page of the set; slots you’re not printing are left blank."
        />
        <Toggle
          checked={options.newPagePerSet}
          onChange={(v) => setOption('newPagePerSet', v)}
          label="Start each set on a new page"
        />
      </Stack>

      <Divider sx={{ my: 2 }} />
      <SectionTitle>Printing</SectionTitle>
      <Stack spacing={2}>
        <Box>
          <Typography variant="body2" gutterBottom>Card style</Typography>
          <ToggleButtonGroup exclusive fullWidth size="small" color="primary" value={options.cardStyle} onChange={(_, v) => v && setOption('cardStyle', v)}>
            <ToggleButton value="art">Card art</ToggleButton>
            <ToggleButton value="clean">Clean (no art)</ToggleButton>
          </ToggleButtonGroup>
          {options.cardStyle === 'clean' && (
            <FormHelperText>Name, number, set and variant with a big QR code — uses far less ink.</FormHelperText>
          )}
        </Box>

        <FormControl size="small" fullWidth>
          <InputLabel id="paper-label">Paper</InputLabel>
          <Select labelId="paper-label" label="Paper" value={options.paper} onChange={(e) => setOption('paper', e.target.value)}>
            <MenuItem value="letter">US Letter (8.5 × 11 in)</MenuItem>
            <MenuItem value="a4">A4 (210 × 297 mm)</MenuItem>
          </Select>
        </FormControl>

        {options.cardStyle !== 'clean' && (<>
        <Box>
          <Typography variant="body2" gutterBottom>QR position</Typography>
          <ToggleButtonGroup
            exclusive size="small" fullWidth color="primary"
            value={options.qrCorner}
            onChange={(_, v) => v && setOption('qrCorner', v)}
          >
            <ToggleButton value="auto" aria-label="Auto"><Tooltip title="Best corner for each game (One Piece: top right)"><span>Auto</span></Tooltip></ToggleButton>
            <ToggleButton value="tl" aria-label="Top left"><Tooltip title="Top left"><NorthWestIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="tr" aria-label="Top right"><Tooltip title="Top right"><NorthEastIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="bl" aria-label="Bottom left"><Tooltip title="Bottom left"><SouthWestIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="br" aria-label="Bottom right"><Tooltip title="Bottom right"><SouthEastIcon fontSize="small" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <LabeledSlider label="QR size" unit="mm" min={options.qrLogo?.src ? MIN_QR_WITH_LOGO : 12} max={24} step={1}
          value={options.qrLogo?.src ? Math.max(options.qrSize, MIN_QR_WITH_LOGO) : options.qrSize} onChange={(v) => setOption('qrSize', v)} />
        </>)}
        <QrLogoControl options={options} setOption={setOption} />
        <LabeledSlider label="Gap between cards" unit="mm" min={0} max={3} step={0.5} value={options.gap} onChange={(v) => setOption('gap', v)} />

        <Box>
          <Toggle checked={options.cutLines} onChange={(v) => setOption('cutLines', v)} label="Cut guides" />
          <Toggle checked={options.price} onChange={(v) => setOption('price', v)} label="Print price under QR" />
        </Box>
      </Stack>

      <Divider sx={{ my: 2 }} />
      <SectionTitle>Preview</SectionTitle>
      <Box sx={{ display: 'grid', placeItems: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <PlaceholderCard slot={preview} options={options} style={{ boxShadow: '0 4px 16px rgba(0,0,0,.25)' }} />
      </Box>
      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        Print at <strong>100% / Actual size</strong> (not “Fit to page”) so placeholders come out card-sized (63 × 88 mm) and fit binder pockets.
      </Alert>

      {dataSection && (
        <>
          <Divider sx={{ my: 2 }} />
          <SectionTitle>Your data</SectionTitle>
          {dataSection}
        </>
      )}
    </Paper>
  );
}

function LabeledSlider({ label, unit, value, onChange, ...rest }) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">{value}{unit}</Typography>
      </Stack>
      <Slider size="small" value={value} onChange={(_, v) => onChange(v)} valueLabelDisplay="auto" {...rest} />
    </Box>
  );
}
