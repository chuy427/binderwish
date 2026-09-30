import { useEffect, useRef, useState } from 'react';
import { ACCOUNTS_ENABLED, fetchCollection, saveCollection, supabase } from './cloud';
import { mergeBackup } from './backup';

// Which account this browser's saved collection belongs to. When it matches the
// signed-in user, the account is the source of truth; when it doesn't (a fresh
// sign-in), whatever was collected here as a guest is merged into the account.
const LINKED_KEY = 'binderwish.linkedAccount';
const SAVE_DELAY = 800;

const toPlain = ({ owned, queue, options }) => ({ owned: [...owned].sort(), queue, options });
const fingerprint = (state) => JSON.stringify(toPlain(state));
const readLinked = () => { try { return localStorage.getItem(LINKED_KEY); } catch { return null; } };
const writeLinked = (id) => { try { if (id) localStorage.setItem(LINKED_KEY, id); else localStorage.removeItem(LINKED_KEY); } catch {} };

// Keeps { owned, queue, options } in sync with the signed-in account.
// `apply(next)` replaces the app's state with { owned: Set, queue, options }.
// status: 'signed-out' | 'loading' | 'saving' | 'saved' | 'error'
export function useCloudSync({ owned, queue, options, apply, onSignedOut, onLoaded }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('signed-out');
  const [loadTick, setLoadTick] = useState(0); // bumped to retry a failed load
  const [saveTick, setSaveTick] = useState(0); // bumped to retry a failed save
  const userId = user?.id || null;
  const loadedFor = useRef(null);     // user id whose collection has been loaded
  const lastSynced = useRef(null);    // fingerprint of what the account holds
  const remoteAt = useRef(null);      // updated_at of the account's copy
  const latest = useRef({ owned, queue, options });
  latest.current = { owned, queue, options };
  const cb = useRef({ apply, onSignedOut, onLoaded });
  cb.current = { apply, onSignedOut, onLoaded };

  // Session (restored from storage, or arriving from an emailed link).
  useEffect(() => {
    if (!ACCOUNTS_ENABLED) return undefined;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser((u) => (u?.id === session?.user?.id ? u : session?.user ?? null));
      if (event === 'SIGNED_OUT') {
        writeLinked(null);
        cb.current.onSignedOut?.();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Load (and on a fresh sign-in, merge) the account's collection.
  const load = async (id, { fresh }) => {
    const { data, error } = await fetchCollection(id);
    if (error) throw error;
    const local = latest.current;
    let next, needsSave;
    if (!data) {
      next = local; needsSave = true;                       // new account: start from this browser
    } else if (fresh) {
      const merged = mergeBackup({ owned: [...local.owned], queue: local.queue }, { owned: data.owned || [], queue: data.queue || [] });
      next = { owned: merged.owned, queue: merged.queue, options: { ...local.options, ...data.options } };
      needsSave = true;
    } else {
      next = { owned: new Set(data.owned || []), queue: data.queue || [], options: { ...local.options, ...data.options } };
      needsSave = false;
    }
    remoteAt.current = data?.updated_at ?? null;
    lastSynced.current = needsSave ? null : fingerprint(next);
    return next;
  };

  useEffect(() => {
    loadedFor.current = null;
    if (!userId) { setStatus('signed-out'); return; }
    let cancelled = false;
    setStatus('loading');
    const fresh = readLinked() !== userId;
    load(userId, { fresh })
      .then((next) => {
        if (cancelled) return;
        writeLinked(userId);
        loadedFor.current = userId;
        cb.current.apply(next);
        cb.current.onLoaded?.({ fresh });
        setStatus(lastSynced.current ? 'saved' : 'saving');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [userId, loadTick]);

  // Save changes to the account, shortly after they happen.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!userId || loadedFor.current !== userId) return;
    const fp = fingerprint({ owned, queue, options });
    if (fp === lastSynced.current) return;
    setStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      const { data, error } = await saveCollection(userId, toPlain({ owned, queue, options }));
      if (loadedFor.current !== userId) return;
      if (error) { setStatus('error'); return; }
      lastSynced.current = fp;
      remoteAt.current = data.updated_at;
      setStatus('saved');
    }, SAVE_DELAY);
    return () => clearTimeout(saveTimer.current);
  }, [userId, owned, queue, options, saveTick]);

  // Coming back to the tab: pick up changes made on another device.
  useEffect(() => {
    if (!userId) return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || loadedFor.current !== userId || saveTimer.current) return;
      const { data } = await fetchCollection(userId);
      if (!data || data.updated_at === remoteAt.current || saveTimer.current || loadedFor.current !== userId) return;
      const next = { owned: new Set(data.owned || []), queue: data.queue || [], options: { ...latest.current.options, ...data.options } };
      remoteAt.current = data.updated_at;
      lastSynced.current = fingerprint(next);
      cb.current.apply(next);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId]);

  // Retry after an error (e.g. a dropped connection).
  const retry = () => {
    if (!userId) return;
    if (loadedFor.current === userId) { lastSynced.current = null; setSaveTick((t) => t + 1); }
    else setLoadTick((t) => t + 1);
  };

  return { user, status, retry };
}
