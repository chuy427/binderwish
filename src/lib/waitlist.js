// Where signups go: any form backend that accepts a JSON POST and allows
// cross-origin requests (e.g. Formspree: https://formspree.io/f/<id>). Set
// VITE_WAITLIST_ENDPOINT at build time; without it the button is hidden in
// production builds (and shown in dev with a notice).
export const WAITLIST_ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT || '';
export const WAITLIST_ENABLED = !!WAITLIST_ENDPOINT || import.meta.env.DEV;
