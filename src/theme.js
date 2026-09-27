import { createTheme } from '@mui/material/styles';

// Follows the OS light/dark preference automatically.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#6D4AFF' },
        secondary: { main: '#FF7A59' },
        background: { default: '#F6F5FB', paper: '#FFFFFF' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#A48BFF' },
        secondary: { main: '#FF9A80' },
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
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
  },
});

export default theme;
