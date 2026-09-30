import { Box, Card, CardActionArea, Chip, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import PrintIcon from '@mui/icons-material/Print';
import CardImg from './CardImg';

// The card grid shared by search and the set pages: one tile per binder slot,
// with an owned toggle and tap-to-print.
export const gridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: 2,
};

export function SlotSkeletons({ count = 12 }) {
  return Array.from({ length: count }, (_, i) => (
    <Box key={i}>
      <Skeleton variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '63 / 88' }} />
      <Skeleton width="80%" sx={{ mt: 1 }} />
      <Skeleton width="50%" />
    </Box>
  ));
}

// tapToOwn: tapping the card marks it owned (set pages, which track a collection);
// otherwise tapping adds it to the print sheet (search).
export function SlotCard({ slot, owned, queued, onToggleOwned, onAdd, tapToOwn = false }) {
  return (
    <Card
      sx={{
        position: 'relative',
        borderColor: queued ? 'primary.main' : undefined,
        borderWidth: queued ? 2 : 1,
        transition: 'transform .15s ease, box-shadow .15s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
        '&:hover .add-chip': { opacity: 1 },
        '&:hover .sheet-chip': { opacity: 0 },
      }}
    >
      <CardActionArea onClick={tapToOwn ? onToggleOwned : onAdd} sx={{ p: 1 }}
        aria-label={tapToOwn ? `${slot.name}${slot.variantLabel ? ` (${slot.variantLabel})` : ''}: ${owned ? 'owned — tap to unmark' : 'tap if you own this card'}` : undefined}
        aria-pressed={tapToOwn ? owned : undefined}>
        <Box component={CardImg} slot={slot} alt={slot.name} loading="lazy"
            fallback={<ArtPending slot={slot} />}
            sx={{
              width: '100%', aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: 1.5, display: 'block', bgcolor: 'action.hover',
              // Missing cards look like "ghosts" until you own them.
              filter: owned ? 'none' : 'grayscale(1)', opacity: owned ? 1 : 0.55, transition: 'filter .2s, opacity .2s',
            }} />
        <Box sx={{ px: 0.5, pt: 1 }}>
          <Typography variant="subtitle2" noWrap>{slot.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            #{slot.numberLabel} · {slot.setName}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: 'center', minHeight: 22 }}>
            {slot.variantLabel && <Chip size="small" variant="outlined" label={slot.variantLabel} sx={{ height: 20, fontSize: 11, maxWidth: '100%' }} />}
            {slot.price != null && <Typography variant="caption" sx={{ fontWeight: 600, ml: 'auto !important' }}>${slot.price.toFixed(2)}</Typography>}
          </Stack>
        </Box>
      </CardActionArea>

      <Tooltip title={owned ? 'Owned — tap to unmark' : 'Mark as owned'}>
        <IconButton
          size="small"
          aria-label={owned ? 'Mark as not owned' : 'Mark as owned'}
          aria-pressed={owned}
          onClick={onToggleOwned}
          sx={{
            position: 'absolute', top: 12, left: 12, bgcolor: 'background.paper', boxShadow: 2, p: 0.25,
            color: owned ? 'success.main' : 'text.secondary', '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          {owned ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      {tapToOwn ? (
        <>
          {queued && (
            <Chip className="sheet-chip" size="small" color="primary" icon={<PrintIcon />} label="On sheet"
              sx={{ position: 'absolute', top: 14, right: 14, pointerEvents: 'none', transition: 'opacity .15s', boxShadow: 2 }} />
          )}
          <Chip className="add-chip" size="small" color={owned ? 'default' : 'success'}
            icon={owned ? <RadioButtonUncheckedIcon /> : <CheckCircleIcon />} label={owned ? 'Unmark' : 'I own this'}
            sx={{ position: 'absolute', top: 14, right: 14, pointerEvents: 'none', opacity: 0, transition: 'opacity .15s', boxShadow: 2 }} />
        </>
      ) : (
        <>
          {queued && (
            <Chip className="sheet-chip" size="small" color="primary" icon={<PrintIcon />} label="On sheet"
              sx={{ position: 'absolute', top: 14, right: 14, pointerEvents: 'none', transition: 'opacity .15s', boxShadow: 2 }} />
          )}
          <Chip className="add-chip" size="small" color={queued ? 'default' : 'primary'}
            icon={queued ? <RemoveIcon /> : <AddIcon />} label={queued ? 'Remove' : 'Print'}
            sx={{ position: 'absolute', top: 14, right: 14, pointerEvents: 'none', opacity: 0, transition: 'opacity .15s', boxShadow: 2 }} />
        </>
      )}
    </Card>
  );
}

// Shown when a card has no art anywhere yet (typically a set in its reveal season).
function ArtPending({ slot }) {
  return (
    <Box sx={{ width: '100%', aspectRatio: '63 / 88', borderRadius: 1.5, bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 1, gap: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>#{slot.numberLabel || slot.number}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>Art not released yet</Typography>
    </Box>
  );
}
