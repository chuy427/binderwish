import { useId } from 'react';
import { Box } from '@mui/material';

// The BinderWish logo: a soft diamond outline and an Urbanist Light wordmark, both
// in the red → orange → gold gradient. public/icon.svg (and the PNG icons made
// from it) use the same diamond and colours.
export const LOGO_GRADIENT = ['#EF4436', '#F77E3C', '#FBAF3F'];
export const LOGO_FONT = '"Urbanist", system-ui, sans-serif';
export const MARK_PATH = 'M60.0 32.0C60.0 30.3 59.2 28.3 58.3 26.8C57.4 25.2 55.8 23.9 54.6 22.6C53.3 21.4 51.9 20.5 50.7 19.5C49.5 18.5 48.5 17.6 47.4 16.6C46.4 15.5 45.5 14.5 44.5 13.3C43.5 12.1 42.6 10.7 41.4 9.4C40.1 8.2 38.8 6.6 37.2 5.7C35.7 4.8 33.7 4.0 32.0 4.0C30.3 4.0 28.3 4.8 26.8 5.7C25.2 6.6 23.9 8.2 22.6 9.4C21.4 10.7 20.5 12.1 19.5 13.3C18.5 14.5 17.6 15.5 16.6 16.6C15.5 17.6 14.5 18.5 13.3 19.5C12.1 20.5 10.7 21.4 9.4 22.6C8.2 23.9 6.6 25.2 5.7 26.8C4.8 28.3 4.0 30.3 4.0 32.0C4.0 33.7 4.8 35.7 5.7 37.2C6.6 38.8 8.2 40.1 9.4 41.4C10.7 42.6 12.1 43.5 13.3 44.5C14.5 45.5 15.5 46.4 16.6 47.4C17.6 48.5 18.5 49.5 19.5 50.7C20.5 51.9 21.4 53.3 22.6 54.6C23.9 55.8 25.2 57.4 26.8 58.3C28.3 59.2 30.3 60.0 32.0 60.0C33.7 60.0 35.7 59.2 37.2 58.3C38.8 57.4 40.1 55.8 41.4 54.6C42.6 53.3 43.5 51.9 44.5 50.7C45.5 49.5 46.4 48.5 47.4 47.4C48.5 46.4 49.5 45.5 50.7 44.5C51.9 43.5 53.3 42.6 54.6 41.4C55.8 40.1 57.4 38.8 58.3 37.2C59.2 35.7 60.0 33.7 60.0 32.0Z';

export function LogoMark({ size = 36, strokeWidth = 3, sx }) {
  const id = useId();
  return (
    <Box component="svg" viewBox="0 0 64 64" aria-hidden="true" sx={{ width: size, height: size, flexShrink: 0, display: 'block', ...sx }}>
      <defs>
        <linearGradient id={id} x1="4" y1="0" x2="60" y2="0" gradientUnits="userSpaceOnUse">
          {LOGO_GRADIENT.map((c, i) => <stop key={c} offset={i / (LOGO_GRADIENT.length - 1)} stopColor={c} />)}
        </linearGradient>
      </defs>
      <path d={MARK_PATH} fill="none" stroke={`url(#${id})`} strokeWidth={strokeWidth} />
    </Box>
  );
}

export function Wordmark({ sx }) {
  return (
    <Box component="span" sx={{
      fontFamily: LOGO_FONT, fontWeight: 300, letterSpacing: '-.005em', lineHeight: 1.1, whiteSpace: 'nowrap',
      background: `linear-gradient(90deg, ${LOGO_GRADIENT[0]}, ${LOGO_GRADIENT[1]} 55%, ${LOGO_GRADIENT[2]})`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', ...sx,
    }}>
      BinderWish
    </Box>
  );
}
