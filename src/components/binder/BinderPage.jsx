import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, IconButton, MenuItem, Paper, Skeleton, Stack, TextField, Typography, useMediaQuery,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CardImg from '../CardImg';
import { setSlots, tcgplayerUrl } from '../../catalog';
import { customSetSlots } from '../../lib/customSets';
import { DISPLAY_FONT } from '../../theme';

// Binder layouts: columns × rows of pockets per page.
export const PRESETS = [
  { cols: 2, rows: 2, label: '2 × 2' },
  { cols: 3, rows: 3, label: '3 × 3' },
  { cols: 4, rows: 3, label: '4 × 3' },
  { cols: 3, rows: 4, label: '3 × 4' },
  { cols: 5, rows: 4, label: '5 × 4' },
];
const MAX = 8;
export const parseLayout = (s) => {
  const m = /^(\d)x(\d)$/.exec(s || '');
  if (!m) return null;
  const cols = +m[1], rows = +m[2];
  return cols >= 1 && rows >= 1 && cols <= MAX && rows <= MAX ? { cols, rows } : null;
};
export const layoutParam = (l) => `${l.cols}x${l.rows}`;

// On a computer, pages show as an open binder: page 1 alone on the right, then
// the back of one sheet beside the front of the next (2–3, 4–5, …).
const spreadOf = (p) => (p === 0 ? [null, 0] : p % 2 === 1 ? [p, p + 1] : [p - 1, p]);

// The virtual binder: a collection laid out page by page, pocket by pocket, so
// you can see (or show someone) exactly where each card goes.
export default function BinderPage({
  game, setId, cs, setsInfo, variants, owned, onToggleOwned,
  layout, onLayout, initialPage, initialCard, onBack, backLabel, shareUrl, onState,
}) {
  const wide = useMediaQuery('(min-width:900px)');
  const [slots, setSlotsState] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(Math.max(0, (initialPage || 1) - 1));
  const [selKey, setSelKey] = useState(initialCard || null);
  const [custom, setCustom] = useState(() => !PRESETS.some((p) => p.cols === layout.cols && p.rows === layout.rows));
  const [copied, setCopied] = useState(false);

  const set = setId ? setsInfo.sets.find((s) => s.id === setId) : null;
  const title = cs ? cs.name : set?.name;

  useEffect(() => {
    if (!setsInfo.loaded || (!cs && !set)) return undefined;
    let cancelled = false;
    setError(null);
    const load = cs
      ? customSetSlots(game, cs, setsInfo, variants).then((all) => { const h = new Set(cs.hidden); return all.filter((s) => !h.has(s.key)); })
      : setSlots(game, setId, setsInfo, { variants });
    load.then((s) => { if (!cancelled) setSlotsState(s); })
      .catch((e) => { if (!cancelled) setError(`Couldn’t load this collection (${e.message}). Try again in a moment.`); });
    return () => { cancelled = true; };
  }, [game, setId, cs, setsInfo, variants, !!set]); // eslint-disable-line react-hooks/exhaustive-deps

  const per = layout.cols * layout.rows;
  const pages = slots ? Math.max(1, Math.ceil(slots.length / per)) : 1;
  const selIndex = slots && selKey ? slots.findIndex((s) => s.key === selKey) : -1;

  // Arriving from a shared link, or after changing the layout: show the selected card's page.
  useEffect(() => {
    if (slots && selIndex >= 0) setPage(Math.floor(selIndex / per));
  }, [slots, per]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the page in range — only once the cards are in (until then the count is unknown).
  useEffect(() => { if (slots) setPage((p) => Math.min(p, pages - 1)); }, [pages, slots]);
  // Report state for the address bar (layout / page / card).
  useEffect(() => { onState?.({ page: page + 1, card: selKey }); }, [page, selKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = wide ? spreadOf(page).filter((p) => p != null && p < pages) : [page];
  const go = (delta) => {
    if (!wide) { setPage((p) => Math.min(pages - 1, Math.max(0, p + delta))); return; }
    const [l, r] = spreadOf(page);
    setPage(delta > 0 ? Math.min(pages - 1, r + 1) : Math.max(0, (l ?? 0) - 1));
  };

  // Swipe between pages on phones.
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  const pickLayout = (l) => { setCustom(false); onLayout(l); };
  const sel = selIndex >= 0 ? slots[selIndex] : null;
  const pos = sel ? {
    page: Math.floor(selIndex / per) + 1,
    row: Math.floor((selIndex % per) / layout.cols) + 1,
    col: (selIndex % per) % layout.cols + 1,
    n: (selIndex % per) + 1,
  } : null;

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl({ page: pos.page, card: sel.key })); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  const options = useMemo(() => (slots || []).map((s, i) => ({ s, i })), [slots]);
  const pageLabel = wide && shown.length === 2 ? `Pages ${shown[0] + 1}–${shown[1] + 1} of ${pages}` : `Page ${shown[0] + 1} of ${pages}`;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Button onClick={onBack} startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 1, ml: -1 }}>{backLabel}</Button>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>{game.name} · Binder view</Typography>
          <Typography component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: { xs: 22, md: 28 }, lineHeight: 1.15 }}>{title || '…'}</Typography>
        </Box>
        <Autocomplete size="small" sx={{ width: { xs: '100%', md: 300 } }} options={options}
          getOptionLabel={(o) => `${o.s.name} #${o.s.numberLabel}${o.s.variantLabel ? ` · ${o.s.variantLabel}` : ''}`}
          isOptionEqualToValue={(a, b) => a.s.key === b.s.key}
          onChange={(_, v) => { if (v) { setSelKey(v.s.key); setPage(Math.floor(v.i / per)); } }}
          renderOption={(props, o) => <li {...props} key={o.s.key}>{o.s.name} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>#{o.s.numberLabel}{o.s.variantLabel ? ` · ${o.s.variantLabel}` : ''}</Typography></li>}
          renderInput={(params) => <TextField {...params} placeholder="Find a card’s pocket"
            slotProps={{ ...params.slotProps, input: { ...params.slotProps?.input, startAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} /> } }} />} />
      </Stack>

      {/* Layout */}
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        {PRESETS.map((p) => (
          <Chip key={p.label} label={p.label} onClick={() => pickLayout(p)}
            color={!custom && p.cols === layout.cols && p.rows === layout.rows ? 'primary' : 'default'}
            variant={!custom && p.cols === layout.cols && p.rows === layout.rows ? 'filled' : 'outlined'} />
        ))}
        <Chip label="Custom" onClick={() => setCustom(true)} color={custom ? 'primary' : 'default'} variant={custom ? 'filled' : 'outlined'} />
        {custom && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: { sm: 1 } }}>
            <TextField select size="small" label="Columns" id="binder-cols" value={layout.cols} onChange={(e) => onLayout({ ...layout, cols: +e.target.value })} sx={{ width: 96 }}>
              {Array.from({ length: MAX }, (_, i) => <MenuItem key={i} value={i + 1}>{i + 1}</MenuItem>)}
            </TextField>
            <Typography color="text.secondary">×</Typography>
            <TextField select size="small" label="Rows" id="binder-rows" value={layout.rows} onChange={(e) => onLayout({ ...layout, rows: +e.target.value })} sx={{ width: 96 }}>
              {Array.from({ length: MAX }, (_, i) => <MenuItem key={i} value={i + 1}>{i + 1}</MenuItem>)}
            </TextField>
          </Stack>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>{per} pockets a page</Typography>
      </Stack>

      {/* Page navigation */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <IconButton aria-label="Previous page" onClick={() => go(-1)} disabled={shown[0] === 0}><ChevronLeftIcon /></IconButton>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>{slots ? pageLabel : 'Loading…'}</Typography>
          {slots && pages > 1 && (
            <TextField select size="small" value={page} onChange={(e) => setPage(+e.target.value)} aria-label="Go to page"
              slotProps={{ select: { renderValue: () => 'Go to' } }} sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 13 } }}>
              {Array.from({ length: pages }, (_, i) => <MenuItem key={i} value={i}>Page {i + 1}</MenuItem>)}
            </TextField>
          )}
        </Stack>
        <IconButton aria-label="Next page" onClick={() => go(1)} disabled={shown[shown.length - 1] >= pages - 1}><ChevronRightIcon /></IconButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* The page(s) */}
      <Box onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        sx={{ display: 'grid', gridTemplateColumns: wide ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)', gap: { xs: 1, md: 2 }, maxWidth: wide ? 1100 : 520, mx: 'auto' }}>
        {(wide ? spreadOf(page) : [page]).map((p, i) => (
          <BinderSheet key={`${p}-${i}`} pageIndex={p} pages={pages} slots={slots} layout={layout} owned={owned}
            selKey={selKey} onSelect={setSelKey} />
        ))}
      </Box>

      {/* Selected pocket */}
      <Box sx={{ mt: 2, p: 1.5, borderRadius: '14px', border: '1px solid rgba(255,255,255,.08)', bgcolor: '#141414', maxWidth: wide ? 1100 : 520, mx: 'auto' }}>
        {sel ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 54, flexShrink: 0 }}>
              <Box component={CardImg} slot={sel} alt="" sx={{ width: '100%', aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>{sel.name}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                #{sel.numberLabel}{sel.variantLabel ? ` · ${sel.variantLabel}` : ''}{sel.price != null ? ` · $${sel.price.toFixed(2)}` : ''}
                {cs && sel.setName ? ` · ${sel.setName}` : ''}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                <b>Page {pos.page}</b> · row {pos.row}, pocket {pos.col} <Typography component="span" variant="body2" color="text.secondary">({pos.n} of {per})</Typography>
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant={owned.has(sel.key) ? 'text' : 'outlined'} color={owned.has(sel.key) ? 'success' : 'primary'}
                  startIcon={owned.has(sel.key) ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />} onClick={() => onToggleOwned(sel.key, sel)}>
                  {owned.has(sel.key) ? 'Owned' : 'I own this'}
                </Button>
                <Button size="small" startIcon={<LinkIcon />} onClick={copyLink}>{copied ? 'Link copied' : 'Copy link to this pocket'}</Button>
                <Button size="small" component="a" href={tcgplayerUrl(sel)} target="_blank" rel="noopener" startIcon={<OpenInNewIcon />}>TCGPlayer</Button>
              </Stack>
              {cs && <Typography variant="caption" color="text.secondary">Custom sets are personal, so a link to one only opens on your own devices.</Typography>}
            </Box>
          </Stack>
        ) : (
          <Typography color="text.secondary" variant="body2">
            Tap a pocket to see which card goes there and its exact position{wide ? '' : ' — swipe to turn pages'}.
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

// One binder page: a grid of pockets. Owned cards in full colour; the rest as
// faded "ghosts" so gaps stand out; pockets past the end of the collection empty.
function BinderSheet({ pageIndex, pages, slots, layout, owned, selKey, onSelect }) {
  const per = layout.cols * layout.rows;
  const blank = pageIndex == null || (slots && pageIndex >= pages);
  return (
    <Box sx={{ p: { xs: 1, sm: 1.5 }, borderRadius: '14px', bgcolor: blank ? 'transparent' : '#1a1a1a',
      border: blank ? '1px dashed rgba(255,255,255,.08)' : '1px solid rgba(255,255,255,.08)', minHeight: 120 }}>
      {!blank && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${layout.cols}, minmax(0,1fr))`, gap: { xs: 0.75, sm: 1 } }}>
            {Array.from({ length: per }, (_, k) => {
              const i = pageIndex * per + k;
              if (!slots) return <Skeleton key={k} variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '63 / 88' }} />;
              const s = slots[i];
              if (!s) return <Box key={k} sx={{ aspectRatio: '63 / 88', borderRadius: '5px', border: '1px solid rgba(255,255,255,.05)' }} />;
              const own = owned.has(s.key);
              const selected = s.key === selKey;
              return (
                <Box key={s.key} component="button" type="button" onClick={() => onSelect(s.key)}
                  aria-label={`${s.name}${s.variantLabel ? ` (${s.variantLabel})` : ''}, pocket ${k + 1}${own ? ', owned' : ''}`}
                  sx={{ p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer', position: 'relative', borderRadius: '5px', display: 'block', width: '100%',
                    outline: selected ? '2px solid #FF6347' : 'none', outlineOffset: 2 }}>
                  <Box component={CardImg} slot={s} alt="" loading="lazy"
                    fallback={<Box sx={{ aspectRatio: '63 / 88', borderRadius: '5px', border: '1px dashed rgba(255,255,255,.25)', display: 'grid', placeItems: 'center', fontSize: 11, color: 'text.secondary' }}>#{s.numberLabel}</Box>}
                    sx={{ width: '100%', aspectRatio: '63 / 88', objectFit: 'cover', borderRadius: '5px', display: 'block',
                      filter: own ? 'none' : 'grayscale(1)', opacity: own ? 1 : 0.38 }} />
                  {!own && <Box sx={{ position: 'absolute', inset: 0, borderRadius: '5px', border: '1px dashed rgba(255,255,255,.35)', pointerEvents: 'none' }} />}
                </Box>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.75 }}>Page {pageIndex + 1}</Typography>
        </>
      )}
    </Box>
  );
}
