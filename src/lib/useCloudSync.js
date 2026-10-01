import { useEffect, useRef, useState } from 'react';
import { ACCOUNTS_ENABLED, fetchCollection, saveCollection, supabase } from './cloud';
import { freshBase, mergeState } from './merge';

// Keeps { owned, queue, options } in sync with the signed-in account — merging,
// never overwriting. This device remembers the version it last synced (the
// "base", saved on the device so offline edits survive a reload). Each sync
// fetches the account's version and, if it moved on, applies this device's
// changes since the base on top of it (see merge.js). Saves are conditional on
// the account still being at the version just read, so two devices saving at
// once merge and retry instead of overwriting each other.
//
// `apply(next)` replaces the app's state with { owned: Set, queue, options }.
// status: 'signed-out' | 'loading' | 'saving' | 'saved' | 'error'
const BASE_KEY = 'binderwish.syncBase';
const LEGACY_LINKED_KEY = 'binderwish.linkedAccount';
const SAVE_DELAY = 800;
const MAX_TRIES = 4;

const plain = ({ owned, queue, options }) => ({ owned: [...owned].sort(), queue, options });
const fp = (s) => JSON.stringify(s);
const toApp = (s) => ({ ...s, owned: new Set(s.owned) });

function readBase(userId) {
  try {
    const b = JSON.parse(localStorage.getItem(BASE_KEY));
    return b?.userId === userId && b.state ? b : null;
  } catch { return null; }
}
function writeBase(b) {
  try { if (b) localStorage.setItem(BASE_KEY, JSON.stringify(b)); else localStorage.removeItem(BASE_KEY); } catch {}
}

export function useCloudSync({ owned, queue, options, apply, onSignedOut, onLoaded }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('signed-out');
  const userId = user?.id || null;
  const userIdRef = useRef(null);
  userIdRef.current = userId;
  const latest = useRef(null);
  latest.current = plain({ owned, queue, options });
  const cb = useRef({ apply, onSignedOut, onLoaded });
  cb.current = { apply, onSignedOut, onLoaded };
  const base = useRef(null);       // { userId, at, state } — last synced version
  const ready = useRef(false);     // first sync for this user finished
  const running = useRef(null);    // the sync in progress (one at a time)
  const again = useRef(false);     // another sync was asked for while one ran

  // Session (restored from storage, or arriving from an emailed link).
  useEffect(() => {
    if (!ACCOUNTS_ENABLED) return undefined;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser((u) => (u?.id === session?.user?.id ? u : session?.user ?? null));
      if (event === 'SIGNED_OUT') {
        writeBase(null);
        try { localStorage.removeItem(LEGACY_LINKED_KEY); } catch {}
        cb.current.onSignedOut?.();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // One sync: read the account, merge if it moved on, save if we have changes.
  // Returns whether this was the device's first sync with this account.
  async function syncOnce(id) {
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      const { data: remote, error } = await fetchCollection(id);
      if (error) throw error;
      if (id !== userIdRef.current) return false;
      const local = latest.current;
      // Read from storage, not memory: another tab may have synced since.
      let b = readBase(id) || (base.current?.userId === id ? base.current : null);
      const first = !b;
      if (!b) b = { userId: id, at: null, state: freshBase(local) };

      let next = local;
      if (remote && remote.updated_at !== b.at) {
        // The account changed since we last synced (or we never have): combine.
        const rs = { owned: remote.owned || [], queue: remote.queue || [], options: remote.options || {} };
        next = mergeState(b.state, local, rs);
        if (fp(next) === fp(rs)) {
          // Nothing of ours to add — just take the account's version.
          base.current = { userId: id, at: remote.updated_at, state: rs };
          writeBase(base.current);
          if (fp(rs) !== fp(latest.current)) cb.current.apply(toApp(rs));
          return first;
        }
      } else if (remote && fp(local) === fp(b.state)) {
        return first; // already in sync
      }

      const res = await saveCollection(id, next, remote ? remote.updated_at : null);
      if (res.conflict) continue; // another device saved first — read again and re-merge
      base.current = { userId: id, at: res.at, state: next };
      writeBase(base.current);
      if (fp(next) !== fp(latest.current)) cb.current.apply(toApp(next));
      return first;
    }
    throw new Error('Too many conflicting saves');
  }

  // Run syncs one at a time; asking during a run schedules one more after it.
  function requestSync() {
    const id = userIdRef.current;
    if (!id) return;
    if (running.current) { again.current = true; return; }
    setStatus((s) => (s === 'loading' ? s : 'saving'));
    running.current = (async () => {
      try {
        do {
          again.current = false;
          const first = await syncOnce(id);
          if (!ready.current && id === userIdRef.current) {
            ready.current = true;
            try { localStorage.removeItem(LEGACY_LINKED_KEY); } catch {}
            cb.current.onLoaded?.({ fresh: first });
          }
        } while (again.current && id === userIdRef.current);
        if (id === userIdRef.current) {
          const dirty = fp(latest.current) !== fp(base.current?.state);
          setStatus(dirty ? 'saving' : 'saved');
          if (dirty) setTimeout(requestSync, SAVE_DELAY);
        }
      } catch {
        if (id === userIdRef.current) setStatus('error');
      } finally {
        running.current = null;
      }
    })();
  }

  // Signing in / switching accounts: first sync (also picks up offline edits).
  useEffect(() => {
    ready.current = false;
    base.current = null;
    if (!userId) { setStatus('signed-out'); return; }
    setStatus('loading');
    requestSync();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local changes: sync shortly after they happen.
  const timer = useRef(null);
  useEffect(() => {
    if (!userId || !ready.current) return undefined;
    if (fp(latest.current) === fp(base.current?.state)) return undefined;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(requestSync, SAVE_DELAY);
    return () => clearTimeout(timer.current);
  }, [userId, owned, queue, options]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back to the tab, or back online: catch up with other devices.
  useEffect(() => {
    if (!userId) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible' && ready.current) requestSync(); };
    const onOnline = () => { if (ready.current) requestSync(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { user, status, retry: requestSync };
}
