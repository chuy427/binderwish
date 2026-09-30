import { Box, Container, Typography } from '@mui/material';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { TOMATO } from '../../theme';

export const AUDIENCES = [
  { id: 'collector', icon: <CollectionsBookmarkIcon />, label: 'I collect', sub: 'Finish a master set' },
  { id: 'vendor', icon: <StorefrontIcon />, label: 'I sell', sub: 'Vendors, shows & card shops' },
];

// Right below the hero: picks which story the rest of the home page tells.
export default function AudienceSwitch({ value, onChange }) {
  return (
    <Container maxWidth="sm" sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 1, md: 2 }, textAlign: 'center' }}>
      <Typography variant="overline" color="text.secondary">Who’s BinderWish for?</Typography>
      <Box role="tablist" aria-label="Show information for"
        sx={{ mt: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, p: 0.75, borderRadius: '22px',
          bgcolor: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)' }}>
        {AUDIENCES.map((a) => {
          const on = a.id === value;
          return (
            <Box key={a.id} component="button" type="button" role="tab" aria-selected={on} onClick={() => onChange(a.id)}
              sx={{ border: 0, cursor: 'pointer', borderRadius: '16px', px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.5, sm: 2 }, font: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, textAlign: 'left',
                bgcolor: on ? TOMATO : 'transparent', color: on ? '#1B1B1F' : 'text.primary',
                transition: 'background-color .25s, color .25s', '&:hover': { bgcolor: on ? TOMATO : 'rgba(255,255,255,.06)' },
                '&:focus-visible': { outline: `2px solid ${TOMATO}`, outlineOffset: 2 } }}>
              <Box sx={{ display: { xs: 'none', sm: 'grid' }, '& svg': { fontSize: 28 } }}>{a.icon}</Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, sm: 18 }, lineHeight: 1.2 }}>{a.label}</Typography>
                <Typography sx={{ fontSize: { xs: 12, sm: 13 }, opacity: on ? 0.8 : 0.6, lineHeight: 1.3 }}>{a.sub}</Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Container>
  );
}
