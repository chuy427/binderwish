import { createClient } from '@supabase/supabase-js';

// Optional accounts (Supabase): sign in by emailed link to sync the collection
// across devices. The publishable key is meant to be public — row-level
// security (supabase/schema.sql) is what keeps each collection private.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://tbissnuzjfjuvjwtseza.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_d9GuSWBWrka2KDNgUF1N0w_e0cAsznX';

// Sign-in shows only when enabled: always in dev, and in production builds once
// the ACCOUNTS repo variable is "on" (it needs working sign-in email first).
export const ACCOUNTS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ACCOUNTS === 'on';

export const supabase = createClient(URL, KEY, {
  // Implicit flow: the emailed link works even when it opens in a different
  // browser than the one that asked for it (e.g. a mail app's browser).
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
});

export async function sendSignInLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}${location.pathname}${location.search}` },
  });
  if (error) throw new Error(friendlyError(error));
}

export const signOut = () => supabase.auth.signOut({ scope: 'local' });

export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(friendlyError(error));
  await signOut();
}

function friendlyError(error) {
  if (error.status === 429 || /rate limit/i.test(error.message)) return 'Too many sign-in emails just now — please wait a few minutes and try again.';
  if (/invalid.*email/i.test(error.message)) return 'That email address doesn’t look right.';
  return error.message || 'Something went wrong — please try again.';
}

export const fetchCollection = (userId) =>
  supabase.from('collections').select('owned, queue, options, updated_at').eq('user_id', userId).maybeSingle();

// Conditional save: writes only if the account still has the version we last saw
// (`expectedAt`, or no row yet when null). Returns { at } on success, or
// { conflict: true } when another device saved first — the caller merges and retries.
export async function saveCollection(userId, { owned, queue, options }, expectedAt) {
  const row = { owned, queue, options, updated_at: new Date().toISOString() };
  if (expectedAt == null) {
    const { data, error } = await supabase.from('collections').insert({ user_id: userId, ...row }).select('updated_at').single();
    if (error?.code === '23505') return { conflict: true }; // a row appeared meanwhile
    if (error) throw error;
    return { at: data.updated_at };
  }
  const { data, error } = await supabase.from('collections').update(row)
    .eq('user_id', userId).eq('updated_at', expectedAt).select('updated_at');
  if (error) throw error;
  return data.length ? { at: data[0].updated_at } : { conflict: true };
}
