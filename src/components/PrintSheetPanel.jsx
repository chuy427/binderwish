import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider, FormControl, FormControlLabel,
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
import StyleIcon from '@mui/icons-material/Style';
import ProxyCard from './ProxyCard';
import { cardImage, tcgplayerUrl } from '../api';

const SAMPLE = { name: 'Your card here', setName: '', number: '', image: null, tcgplayerId: null, price: 1.23 };

function SectionTitle({ children }) {
  return (
    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', fontWeight: 700, letterSpacing: '.08em', mb: 1 }}>
      {children}
    </Typography>
  );
}

export default function PrintSheetPanel({ queue, options, setOption, onQty, onClear, stats }) {
  const preview = queue[queue.length - 1] || SAMPLE;

  return (
    <Paper
      variant="outlined"
      sx={{
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
          <StyleIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body2">No cards yet — add some from the search results.</Typography>
        </Box>
      ) : (
        <>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
            <Chip size="small" label={`${stats.count} card${stats.count === 1 ? '' : 's'}`} />
            <Chip size="small" label={`${stats.sheets} sheet${stats.sheets === 1 ? '' : 's'}`} />
            {stats.priced > 0 && (
              <Chip size="small" color="success" variant="outlined"
                label={`≈ $${stats.total.toFixed(2)}${stats.priced < stats.count ? ' (partial)' : ''}`} />
            )}
          </Stack>
          <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto', mx: -1 }}>
            {queue.map((card) => (
              <ListItem
                key={card.id}
                sx={{ px: 1 }}
                secondaryAction={
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <IconButton size="small" aria-label="Remove one" onClick={() => onQty(card.id, -1)}><RemoveIcon fontSize="small" /></IconButton>
                    <Typography variant="body2" sx={{ minWidth: 18, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{card.qty}</Typography>
                    <IconButton size="small" aria-label="Add one" onClick={() => onQty(card.id, 1)}><AddIcon fontSize="small" /></IconButton>
                  </Stack>
                }
              >
                <ListItemAvatar sx={{ minWidth: 48 }}>
                  <Avatar variant="rounded" src={cardImage(card) || undefined} sx={{ width: 36, height: 50 }} />
                </ListItemAvatar>
                <ListItemText
                  sx={{ pr: 11 }}
                  primary={card.name}
                  slotProps={{ primary: { noWrap: true, fontWeight: 500 }, secondary: { component: 'div', noWrap: true } }}
                  secondary={
                    <>
                      {card.setName} #{card.number} ·{' '}
                      {card.status === 'pending'
                        ? <CircularProgress size={10} sx={{ verticalAlign: 'middle' }} />
                        : <Link href={tcgplayerUrl(card)} target="_blank" rel="noopener" underline="hover">
                            {card.price != null ? `$${card.price.toFixed(2)}` : 'TCGPlayer'}
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
      <SectionTitle>Options</SectionTitle>
      <Stack spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel id="paper-label">Paper</InputLabel>
          <Select labelId="paper-label" label="Paper" value={options.paper} onChange={(e) => setOption('paper', e.target.value)}>
            <MenuItem value="letter">US Letter (8.5 × 11 in)</MenuItem>
            <MenuItem value="a4">A4 (210 × 297 mm)</MenuItem>
          </Select>
        </FormControl>

        <Box>
          <Typography variant="body2" gutterBottom>QR position</Typography>
          <ToggleButtonGroup
            exclusive size="small" fullWidth color="primary"
            value={options.qrPos}
            onChange={(_, v) => v && setOption('qrPos', v)}
          >
            <ToggleButton value="tl" aria-label="Top left"><Tooltip title="Top left"><NorthWestIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="tr" aria-label="Top right"><Tooltip title="Top right"><NorthEastIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="bl" aria-label="Bottom left"><Tooltip title="Bottom left"><SouthWestIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="br" aria-label="Bottom right"><Tooltip title="Bottom right"><SouthEastIcon fontSize="small" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <LabeledSlider label="QR size" unit="mm" min={10} max={24} step={1} value={options.qrSize} onChange={(v) => setOption('qrSize', v)} />
        <LabeledSlider label="QR opacity" unit="%" min={40} max={100} step={5} value={options.qrOpacity} onChange={(v) => setOption('qrOpacity', v)} />
        <LabeledSlider label="Card gap" unit="mm" min={0} max={4} step={0.5} value={options.gap} onChange={(v) => setOption('gap', v)} />

        <Box>
          <FormControlLabel control={<Switch checked={options.cutLines} onChange={(e) => setOption('cutLines', e.target.checked)} />} label="Cut guides" />
          <FormControlLabel control={<Switch checked={options.price} onChange={(e) => setOption('price', e.target.checked)} />} label="Print price under QR" />
        </Box>
      </Stack>

      <Divider sx={{ my: 2 }} />
      <SectionTitle>Preview</SectionTitle>
      <Box sx={{ display: 'grid', placeItems: 'center', p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <ProxyCard card={preview} options={options} style={{ boxShadow: '0 4px 16px rgba(0,0,0,.25)' }} />
      </Box>
      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        Print at <strong>100% / Actual size</strong> (not “Fit to page”) so cards come out 63 × 88 mm.
      </Alert>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        Proxies are for casual play and collection planning only — not for sale or sanctioned tournaments.
      </Typography>
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
