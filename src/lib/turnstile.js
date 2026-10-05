import { useCallback, useEffect, useRef, useState } from 'react';

// Cloudflare Turnstile guards the sign-in email (Supabase checks the token when
// CAPTCHA protection is on). The site key is public. Local builds use Cloudflare's
// always-pass test key, since the real one only works on binderwish.com.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
  || (import.meta.env.DEV ? '1x00000000000000000000AA' : '0x4AAAAAAFN9rtvA1H02c7lY');

let loading;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { loading = null; reject(new Error('Couldn’t load the security check — check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return loading;
}

// Renders a Turnstile widget into the element given to the returned (callback) ref
// whenever it mounts (e.g. each time a dialog opens), invisible unless Cloudflare
// wants an interaction, and returns getToken(): resolves with a fresh, single-use
// token — waiting for the check to finish if needed — then resets the widget so the
// next call gets a new one.
export function useTurnstile() {
  const [el, ref] = useState(null);
  const widget = useRef(null);
  const token = useRef(null);
  const waiters = useRef([]);

  useEffect(() => {
    if (!el) return undefined;
    let cancelled = false;
    const settle = (value, error) => {
      const ws = waiters.current;
      waiters.current = [];
      ws.forEach((w) => (error ? w.reject(error) : w.resolve(value)));
    };
    loadTurnstile().then((ts) => {
      if (cancelled) return;
      widget.current = ts.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        appearance: 'interaction-only',
        callback: (t) => { token.current = t; settle(t); },
        'expired-callback': () => { token.current = null; },
        'error-callback': () => { token.current = null; settle(null, new Error('The security check failed — please try again.')); },
      });
    }).catch((e) => settle(null, e));
    return () => {
      cancelled = true;
      if (widget.current != null) window.turnstile?.remove(widget.current);
      widget.current = null;
      token.current = null;
    };
  }, [el]);

  const getToken = useCallback(() => {
    const take = (t) => {
      token.current = null;
      if (widget.current != null) window.turnstile?.reset(widget.current);
      return t;
    };
    if (token.current) return Promise.resolve(take(token.current));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The security check is taking too long — please try again.')), 30000);
      waiters.current.push({
        resolve: (t) => { clearTimeout(timer); resolve(take(t)); },
        reject: (e) => { clearTimeout(timer); if (widget.current != null) window.turnstile?.reset(widget.current); reject(e); },
      });
    });
  }, []);

  return { ref, getToken };
}
