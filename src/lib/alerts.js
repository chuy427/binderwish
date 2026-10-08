import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './cloud';

// Price alerts (supabase/alerts.sql): "email me when this card drops to / rises to
// $X". Signed-in collectors only; checked nightly by scripts/check-alerts.mjs.

export const ALERT_LIMIT = 5;
const FIELDS = 'id, game, set_id, slot_key, product_id, printing, card_name, set_name, variant_label, number_label, image, below, above, status, hit_at, hit_price, created_at';

// What the cards and the wishlist read: { enabled, byKey: Map(slotKey → alert), open(slot) }.
export const AlertsContext = createContext(null);
export const useAlertsContext = () => useContext(AlertsContext);

// A slot's TCGPlayer printing, from its key ("<card>|<productId>:<printing>").
export const slotPrinting = (slot) => (slot.key.split('|')[1] || '').split(':').slice(1).join(':') || null;

const clean = (a) => ({
  ...a,
  below: a.below == null ? null : Number(a.below),
  above: a.above == null ? null : Number(a.above),
  hit_price: a.hit_price == null ? null : Number(a.hit_price),
});

// The signed-in collector's alerts, kept in sync as they change.
export function useAlerts(userId) {
  const [alerts, setAlerts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    if (!userId) { setAlerts([]); setLoaded(true); return; }
    const { data, error } = await supabase.from('price_alerts').select(FIELDS).order('created_at');
    if (!error) setAlerts(data.map(clean));
    setLoaded(true);
  }, [userId]);
  useEffect(() => { setLoaded(false); reload(); }, [reload]);

  const save = useCallback(async (slot, { below, above }, existing) => {
    const row = {
      game: slot.game || 'pokemon', set_id: slot.setId, slot_key: slot.key, product_id: slot.tcgplayerId,
      printing: slotPrinting(slot), card_name: slot.name, set_name: slot.setName || null,
      variant_label: slot.variantLabel || null, number_label: slot.numberLabel ? String(slot.numberLabel) : null,
      image: slot.images?.small || null, below, above, status: 'active', hit_at: null, hit_price: null,
    };
    const q = existing ? supabase.from('price_alerts').update(row).eq('id', existing.id) : supabase.from('price_alerts').insert(row);
    const { error } = await q;
    if (error) {
      if (/alert limit/i.test(error.message)) throw new Error(`You can have up to ${ALERT_LIMIT} price alerts — remove one to add another.`);
      throw new Error(error.message);
    }
    await reload();
  }, [reload]);

  const update = useCallback(async (id, patch) => {
    const { error } = await supabase.from('price_alerts').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    const { error } = await supabase.from('price_alerts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await reload();
  }, [reload]);

  return { alerts, loaded, reload, save, update, remove };
}

// Whether alert emails are on (a missing row means on).
export async function fetchAlertEmails() {
  const { data } = await supabase.from('alert_settings').select('emails').maybeSingle();
  return data ? data.emails : true;
}
export async function setAlertEmails(userId, emails) {
  const { error } = await supabase.from('alert_settings').upsert({ user_id: userId, emails });
  if (error) throw new Error(error.message);
}

// The email's "Turn off alert emails" link (no sign-in needed).
export async function unsubscribeAlerts(token) {
  const { data, error } = await supabase.rpc('alerts_unsubscribe', { token });
  if (error) throw new Error(error.message);
  return !!data;
}

// "≤ $35.00" / "≥ $60.00" / both.
const usd = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const alertTargets = (a) => [a.below != null && `≤ ${usd(a.below)}`, a.above != null && `≥ ${usd(a.above)}`].filter(Boolean).join(' · ');
export { usd };
