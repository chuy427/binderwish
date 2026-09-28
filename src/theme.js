import { createTheme } from '@mui/material/styles';

// Brand: tomato on a near-black, lightly grained background, with a wide
// display face (Unbounded) for headlines — the whole site is dark.
//
// Contrast (WCAG): tomato on the dark surfaces is 5.7:1, so it's used directly
// for accent text; filled tomato gets near-black text (white on tomato is only
// 2.95:1). TOMATO_TEXT is the deeper tomato for accent text on white surfaces
// (placeholder cards, white buttons).
export const TOMATO = '#FF6347';
export const TOMATO_TEXT = '#C8412B';
export const DISPLAY_FONT = '"Unbounded", "Roboto", system-ui, sans-serif';
const ON_TOMATO = '#1B1B1F';

const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    dark: {
      palette: {
        primary: { main: TOMATO, dark: '#E5533D', light: '#FF8A73', contrastText: ON_TOMATO },
        secondary: { main: '#4DB6AC' },
        background: { default: '#111111', paper: '#1A1A1A' },
        divider: 'rgba(255,255,255,0.09)',
        text: { primary: '#F4F1EE', secondary: 'rgba(244,241,238,0.64)' },
      },
    },
  },
  defaultColorScheme: 'dark',
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
    h1: { fontFamily: DISPLAY_FONT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.04 },
    h2: { fontFamily: DISPLAY_FONT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.08 },
    h3: { fontFamily: DISPLAY_FONT, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.1 },
    h4: { fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.15 },
    h5: { fontFamily: DISPLAY_FONT, fontWeight: 700 },
    h6: { fontWeight: 700 },
    overline: { fontFamily: DISPLAY_FONT, fontWeight: 600, letterSpacing: '0.12em', lineHeight: 1.6 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, paddingLeft: 18, paddingRight: 18 },
        outlined: { borderColor: TOMATO },
      },
    },
    MuiToggleButton: { styleOverrides: { root: { '&.Mui-selected': { color: TOMATO } } } },
    MuiLink: { styleOverrides: { root: { textDecorationColor: 'currentColor' } } },
    MuiDialog: { styleOverrides: { paper: { border: '1px solid rgba(255,255,255,0.08)' } } },
  },
});

export default theme;
