import { useState } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { DISPLAY_FONT, TOMATO } from '../../theme';
import { BinderLine } from './BinderInfo';

const toDate = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00`);
export const formatDate = (iso) => {
  if (!iso) return '';
  const d = toDate(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};
export const isUpcoming = (iso) => !!iso && toDate(iso) > new Date();
export const releaseLabel = (iso) => (formatDate(iso) ? `${isUpcoming(iso) ? 'Releases ' : ''}${formatDate(iso)}` : '');

// A set's logo, or — for games / sets without one — a typographic stand-in.
export function SetLogo({ set, gameName, height = 120 }) {
  const [failed, setFailed] = useState(false);
  if (set.logo && !failed) {
    return (
      <Box component="img" src={set.logo} alt={set.name} loading="lazy" onError={() => setFailed(true)}
        sx={{ maxWidth: '100%', maxHeight: height, objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.45))' }} />
    );
  }
  const label = set.code || set.name;
  return (
    <Box sx={{ textAlign: 'center', px: 1, maxWidth: '100%' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: TOMATO }}>{gameName}</Typography>
      <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, lineHeight: 1.05, mt: 0.5, overflowWrap: 'anywhere',
        fontSize: label.length > 14 ? 18 : label.length > 8 ? 24 : 34, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {label}
      </Typography>
    </Box>
  );
}

export function ProgressLine({ progress, sx }) {
  if (!progress) {
    return <Box sx={sx}><LinearProgress sx={{ mt: 1, height: 6, borderRadius: 3, opacity: 0.4 }} /><Box sx={{ height: 20 }} /></Box>;
  }
  const pct = progress.total ? Math.round((progress.have / progress.total) * 100) : 0;
  return (
    <Box sx={sx}>
      <LinearProgress variant="determinate" value={pct} sx={{ mt: 1, height: 6, borderRadius: 3 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        <Box component="b" sx={{ color: 'text.primary' }}>{progress.have}</Box> / {progress.total} owned · {pct}%
      </Typography>
    </Box>
  );
}

// One set in the "My sets" grid: logo, series, release date and name — plus
// progress for sets you're collecting.
export default function SetTile({ set, gameName, href, progress, tracked, place, onOpen }) {
  return (
    <Box component="a" href={href} onClick={(e) => { e.preventDefault(); onOpen(); }}
      sx={{ display: 'block', color: 'inherit', textDecoration: 'none', borderRadius: '22px', p: 1.25, transition: 'background-color .2s, transform .2s',
        '&:hover': { bgcolor: 'rgba(255,255,255,.04)', transform: 'translateY(-2px)' }, '&:hover .logo-box': { borderColor: 'rgba(255,99,71,.45)' },
        '&:focus-visible': { outline: `2px solid ${TOMATO}`, outlineOffset: 2 } }}>
      <Box className="logo-box" sx={{ height: 160, borderRadius: '18px', display: 'grid', placeItems: 'center', p: 2.5, position: 'relative', overflow: 'hidden',
        bgcolor: '#171717', border: '1px solid', borderColor: tracked ? 'rgba(255,99,71,.35)' : 'rgba(255,255,255,.07)', transition: 'border-color .2s',
        backgroundImage: 'radial-gradient(ellipse at 50% 120%, rgba(255,99,71,.16), transparent 65%)' }}>
        <SetLogo set={set} gameName={gameName} />
        {set.artPending && (
          <Typography variant="caption" sx={{ position: 'absolute', top: 10, right: 12, color: 'text.secondary' }}>art coming soon</Typography>
        )}
      </Box>
      <Box sx={{ px: 0.5, pt: 1.5 }}>
        {set.series && <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>{set.series}</Typography>}
        {set.released && <Typography variant="body2" color="text.secondary">{releaseLabel(set.released)}</Typography>}
        <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 17, lineHeight: 1.25, mt: 0.75 }}>{set.name}</Typography>
        {tracked && <BinderLine binder={place?.binder} location={place?.location} sx={{ mt: 0.75 }} />}
        {tracked && <ProgressLine progress={progress} />}
      </Box>
    </Box>
  );
}
