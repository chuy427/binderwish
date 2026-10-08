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
  // A product named "Lightning Energy (#3)" is card #3, whatever number it's filed under.
  const tag = new RegExp(`\\(#0*${normNumber(number).replace(/[^a-z0-9]/g, '')}\\)`, 'i');
  const byNumber = rows.filter((r) => normNumber(r[0]) === normNumber(number) || tag.test(r[2]));
  let pool = byNumber.filter(nameMatches);
  if (!pool.length && byNumber.length === 1 && near(byNumber[0])) pool = byNumber;
  // Numbering can differ between sources: reprint sets (Classic Collections) are
  // 001–030 on TCGdex but keep each card's original number on TCGPlayer — so a
  // number match with a clearly different name is a different card. Go by name.
  if (!pool.length) {
    // A product numbered exactly like another same-named card in the set is that
    // card's (BW54 Pikachu's product isn't BW77 Pikachu's) — unmatched beats borrowed.
    // ("28a" is an alternate version of 28 that TCGPlayer sells as the same product.)
    const claimed = new Set(cards.filter((c) => normName(c.name) === key && baseNumber(c.number) !== baseNumber(number)).map((c) => normNumber(c.number)));
    const byName = rows.filter((r) => nameMatches(r) && !claimed.has(normNumber(r[0])));
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

// "28a" → "28": an alternate version of the same card.
const baseNumber = (n) => normNumber(n).replace(/[a-z]$/, '');

// Nearly the same name — a typo in one source ("Russel" / "Russell", "Markey" /
// "Market"), not a different card ("Lightning Energy" / "Fighting Energy").
function similar(x, y) {
  let prefix = 0;
  while (prefix < Math.min(x.length, y.length) && x[prefix] === y[prefix]) prefix++;
  if (prefix >= 5) return true;
  const grams = (s) => Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2));
  const a = grams(x), b = grams(y);
  let common = 0;
  for (const g of a) { const i = b.indexOf(g); if (i >= 0) { common++; b.splice(i, 1); } }
  return prefix >= 2 && (2 * common) / (a.length + grams(y).length) >= 0.75;
}

// Lorcana: "Snow White – Unexpected Houseguest" ↔ "Snow White - Unexpected Houseguest
// (JP Exclusive)" — character and version both count (only "(…)" notes are dropped).
const lorcanaKey = (s) => String(s).replace(/\([^)]*\)/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

// Lorcast usually knows each card's TCGPlayer product. Otherwise: same number and
// name (allowing a typo), else the same name filed under another number — unless
// that product is another same-named card's (an Enchanted reprint isn't its base
// card). Never by number alone: a different character there is a different card.
// card: { number, name ("Name – Version"), tcgplayerId }; cards: the whole set.
export function matchLorcana(rows, card, cards = []) {
  const exact = card.tcgplayerId ? rows.filter((r) => r[1] === card.tcgplayerId) : [];
  if (exact.length) return exact;
  const key = lorcanaKey(card.name);
  const named = rows.filter((r) => lorcanaKey(r[2]) === key);
  const sameNumber = named.filter((r) => normNumber(r[0]) === normNumber(card.number));
  if (sameNumber.length) return sameNumber;
  // The same number with a nearly identical name: a typo in one of the sources.
  const typo = rows.filter((r) => normNumber(r[0]) === normNumber(card.number) && similar(lorcanaKey(r[2]), key));
  if (typo.length === 1) return typo;
  const claimed = new Set(cards.filter((c) => lorcanaKey(c.name) === key && normNumber(c.number) !== normNumber(card.number))
    .flatMap((c) => [normNumber(c.number), c.tcgplayerId && String(c.tcgplayerId)]).filter(Boolean));
  return named.filter((r) => !claimed.has(normNumber(r[0])) && !claimed.has(String(r[1])));
}
