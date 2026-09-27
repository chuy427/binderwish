# BinderWish

Print card-sized placeholders for the Pokémon TCG cards missing from your
master set binder. Each placeholder shows the card's number, name and variant
over faded "ghost" art, plus a QR code to the exact TCGPlayer listing — so when
you flip through the binder you can scan a gap and buy the real card.

- **Master sets**: every printing gets its own slot — reverse holos, Poké Ball /
  Master Ball patterns, 1st Edition, etc. — each linking to its own listing.
- **Owned checklist**: mark what you have; see progress and what's left to buy,
  and print placeholders only for the missing slots. Marking a card owned takes
  it off the print sheet. (Saved in your browser.)
- **Binder order**: prints 9 per page in set order. Optionally each page mirrors
  a real 9-pocket binder page, with blanks for slots you're not printing.
- Placeholders are deliberately unmistakable ("PLACEHOLDER · NOT A REAL CARD").

## Data

- Card lists, images and search: [TCGdex](https://tcgdex.dev) (called from the browser, cached locally).
- Variants, TCGPlayer product IDs and per-printing prices: a static catalog built
  from [tcgcsv.com](https://tcgcsv.com) (a daily mirror of TCGPlayer's catalog)
  by `scripts/sync-tcgplayer.mjs`.

## Development

```bash
npm install
npm run dev              # builds the TCGPlayer catalog on first run if missing
npm run sync-tcgplayer   # refresh the catalog manually
npm run build            # refreshes the catalog, then builds to dist/
```

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`, on every push to `main` and
daily at 21:30 UTC (after tcgcsv's daily refresh) so new sets and prices stay current.
The workflow can also be run manually from the Actions tab.

Note: GitHub disables scheduled workflows in a public repo after 60 days with
no commits; re-enable it from the Actions tab if that happens.

## Disclaimer

Placeholders are binder fillers for cards you're still collecting — not playable,
tradeable or sellable cards. Pokémon and all related names are trademarks of
Nintendo, Creatures Inc. and GAME FREAK inc. Not affiliated.
