import { Box, Stack, Typography } from '@mui/material';
import { CustomSetArt } from '../sets/CustomSetPage';
import { LogoMark } from '../Logo';
import { getGame } from '../../games';
import { DISPLAY_FONT, TOMATO } from '../../theme';

const KIND = { binderwish: null, vendor: 'Vendor', creator: 'Creator' };

// "◇ BinderWish" / "[Vendor] Pallet Town Cards" — who made a pick.
export function CuratorLine({ curator, sx }) {
  const tag = KIND[curator.kind];
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0, ...sx }}>
      {tag ? (
        <Box component="span" sx={{ fontSize: 11, fontWeight: 600, px: 0.9, py: 0.2, borderRadius: 99, bgcolor: 'rgba(251,175,63,.14)', color: '#FBAF3F', flexShrink: 0 }}>{tag}</Box>
      ) : <LogoMark size={15} strokeWidth={4} />}
      <Typography variant="body2" color="text.secondary" noWrap>{curator.name}</Typography>
    </Stack>
  );
}

// A pick's cover: a fan of its cover cards (same look as custom sets).
export function PickArt({ pick, height = 160 }) {
  const preview = pick.covers.filter((c) => c.img).map((c) => ({ key: c.key, images: { small: c.img } }));
  return <CustomSetArt cs={{ name: pick.title }} gameName={getGame(pick.game).name} preview={preview} height={height} label="Pick" />;
}

// One pick in a grid or row.
export function PickTile({ pick, href, onOpen, progress }) {
  return (
    <Box component="a" href={href} onClick={(e) => { e.preventDefault(); onOpen(); }}
      sx={{ display: 'block', color: 'inherit', textDecoration: 'none', borderRadius: '22px', p: 1.25, minWidth: 0,
        transition: 'background-color .2s, transform .2s',
        '&:hover': { bgcolor: 'rgba(255,255,255,.04)', transform: 'translateY(-2px)' }, '&:focus-visible': { outline: `2px solid ${TOMATO}`, outlineOffset: 2 } }}>
      <PickArt pick={pick} />
      <Box sx={{ px: 0.5, pt: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
          {getGame(pick.game).name}{pick.count ? ` · ${pick.count} cards` : ''}
        </Typography>
        <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 17, lineHeight: 1.25, mt: 0.5, overflowWrap: 'anywhere' }}>{pick.title}</Typography>
        <CuratorLine curator={pick.curator} sx={{ mt: 0.75 }} />
        {progress && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            You own {progress.have} of {progress.total}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export const pickGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: { xs: 1, sm: 2 } };
