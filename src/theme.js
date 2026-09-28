import { createTheme } from '@mui/material/styles';

// Brand color: tomato. Contrast (WCAG):
//  - Filled tomato gets near-black text (7.1:1) — white on tomato is only 2.95:1.
//  - Tomato as *text* on light backgrounds is too faint (2.95:1), so text-colored
//    uses switch to a deeper tomato there (4.9:1). On dark backgrounds plain
//    tomato already passes (5.7:1).
export const TOMATO = '#FF6347';
export const TOMATO_TEXT = '#C8412B';
const ON_TOMATO = '#1B1B1F';

// Text-colored primary: deeper tomato in light mode, plain tomato in dark mode.
const primaryText = (theme) => ({
  color: TOMATO_TEXT,
  ...theme.applyStyles('dark', { color: TOMATO }),
});

// Follows the OS light/dark preference automatically.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: TOMATO, dark: '#E5533D', light: '#FF8A73', contrastText: ON_TOMATO },
        secondary: { main: '#2A9D8F' },
        background: { default: '#F7F6F5', paper: '#FFFFFF' },
      },
    },
    dark: {
      palette: {
        primary: { main: TOMATO, dark: '#E5533D', light: '#FF8A73', contrastText: ON_TOMATO },
        secondary: { main: '#4DB6AC' },
        background: { default: '#121318', paper: '#1C1D24' },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
    h6: { fontWeight: 700 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          variants: [
            { props: { variant: 'text', color: 'primary' }, style: primaryText(theme) },
            { props: { variant: 'outlined', color: 'primary' }, style: { ...primaryText(theme), borderColor: TOMATO } },
          ],
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({ variants: [{ props: { color: 'primary' }, style: primaryText(theme) }] }),
      },
    },
    MuiLink: {
      styleOverrides: { root: ({ theme }) => ({ ...primaryText(theme), textDecorationColor: 'currentColor' }) },
    },
    MuiTypography: {
      styleOverrides: {
        root: ({ theme }) => ({ variants: [{ props: { color: 'primary' }, style: primaryText(theme) }] }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({ '&.Mui-selected': primaryText(theme) }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          variants: [{ props: { variant: 'outlined', color: 'primary' }, style: { ...primaryText(theme), borderColor: TOMATO } }],
        }),
      },
    },
  },
});

export default theme;
