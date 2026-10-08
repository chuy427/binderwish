// Card ↔ TCGPlayer product matching. No browser or build-tool dependencies, so the
// nightly matching check (scripts/check-matching.mjs) runs this exact code in Node.

// "158/128" -> "158"; "TG01/TG30" -> "tg1"; "025" -> "25"
export const normNumber = (n) => String(n).split('/')[0].trim().toLowerCase().replace(/^([a-z-]*)0+(?=\d)/, '$1');
// "Mew ex - 158/128" / "Pikachu (Poke Ball Pattern)" -> "mewex" / "pikachu"
export const normName = (n) => String(n).split(' - ')[0].replace(/\([^)]*\)/g, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Default product matching by card number + name: the plain product first, then
// same-numbered variants like "(Poke Ball Pattern)". `cards` (the whole set) lets
// same-named cards be told apart when the numbers don't line up.
export function matchByNumberAndName(rows, number, name, cards = []) {
  const key = normName(name);
  const nameMatches = (r) => normName(r[2]) === key;
  // The same card under a slightly different name ("Empoleon" / "Empoleon LV.X").
  const near = (r) => { const n = normName(r[2]); return n.startsWith(key) || key.startsWith(n); };
  const byNumber = rows.filter((r) => normNumber(r[0]) === normNumber(number));
  let pool = byNumber.filter(nameMatches);
  if (!pool.length && byNumber.length === 1 && near(byNumber[0])) pool = byNumber;
  // Numbering can differ between sources: reprint sets (Classic Collections) are
  // 001–030 on TCGdex but keep each card's original number on TCGPlayer — so a
  // number match with a clearly different name is a different card. Go by name.
  if (!pool.length) {
    const byName = rows.filter(nameMatches);
    const groups = [...new Set(byName.map((r) => normNumber(r[0])))]
      .sort((a, b) => (parseInt(a.replace(/^\D+/, ''), 10) || 0) - (parseInt(b.replace(/^\D+/, ''), 10) || 0));
    if (groups.length === 1) pool = byName;
    else if (groups.length > 1) {
      // Several products with this name (e.g. a LEGEND's "(Top)" / "(Bottom)" halves):
      // pair them up with the set's same-named cards in number order.
      const same = cards.filter((c) => normName(c.name) === key)
        .sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
      const i = same.findIndex((c) => normNumber(c.number) === normNumber(number));
      pool = same.length === groups.length && i >= 0
        ? byName.filter((r) => normNumber(r[0]) === groups[i])
        : byName.filter((r) => /\(Top\)/i.test(r[2]));
    }
  }
  // A product named with a known suffix ("Palkia LV.X" for "Palkia"), when unique.
  if (!pool.length) {
    const suffixed = rows.filter((r) => /^(lvx|star|prime)$/.test(normName(r[2]).slice(key.length)) && normName(r[2]).startsWith(key));
    if (new Set(suffixed.map((r) => normNumber(r[0]))).size === 1) pool = suffixed;
  }
  // Last resort: the only product at this number.
  if (!pool.length && byNumber.length === 1) pool = byNumber;
  const isPlain = (r) => !/\(/.test(r[2]);
  return [...pool.filter(isPlain), ...pool.filter((r) => !isPlain(r))];
}
