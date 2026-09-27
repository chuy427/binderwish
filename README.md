# Proxydex

Print Pokémon TCG proxy cards with a QR code that opens each card's TCGPlayer
product page, for quick price checks.

- Card search, set browsing and images: [TCGdex](https://tcgdex.dev) (called from the browser, cached locally).
- TCGPlayer product IDs and prices for cards TCGdex hasn't linked: a static
  catalog built from [tcgcsv.com](https://tcgcsv.com) by `scripts/sync-tcgplayer.mjs`.

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

Proxies are for casual play and collection planning only — not for sale or
sanctioned tournaments. Pokémon and all related names are trademarks of
Nintendo, Creatures Inc. and GAME FREAK inc. Not affiliated.
