# BinderWish

Print card-sized placeholders for the trading cards missing from your master
set binder — Pokémon, Disney Lorcana and the One Piece Card Game so far. Each placeholder is the card art with a subtle
"placeholder / not a real card" band (naming the variant) and a QR code to the
exact TCGPlayer listing — so when you flip through the binder you can scan a gap
and buy the real card.

- **Master sets**: every printing gets its own slot — reverse holos, Poké Ball /
  Master Ball patterns, 1st Edition, Lorcana Cold Foils, Enchanted / Epic /
  Iconic cards, One Piece Alternate Art / Manga / SP / event stamps, etc. — each
  linking to its own listing.
- **Owned checklist**: mark what you have; see progress and what's left to buy,
  and print placeholders only for the missing slots. Marking a card owned takes
  it off the print sheet. (Saved in your browser.)
- **Backup**: export owned cards, print sheet and settings to a JSON file, and
  import it later — merged with what's there, or replacing it (e.g. to move
  between devices).
- **Card styles**: the card's own art with a subtle placeholder band, or
  "Clean" — BinderWish's art-free design (name, number, set, variant, big QR),
  which uses far less ink.
- **Printed & shipped waitlist**: a "Get them printed" button collects emails
  for a planned print-and-ship service (art-free design only). It posts JSON to
  `VITE_WAITLIST_ENDPOINT` (e.g. a Formspree form); set it as the `WAITLIST_ENDPOINT`
  repository variable for deploys, or in `.env.development.local` for local dev.
  Without it the button is hidden in production.
- **Binder order**: prints 9 per page in set order. Optionally each page mirrors
  a real 9-pocket binder page, with blanks for slots you're not printing.
- Placeholders are deliberately unmistakable ("PLACEHOLDER · NOT A REAL CARD").

## Data

- Card lists, images and search (called from the browser, cached locally):
  - Pokémon: [TCGdex](https://tcgdex.dev)
  - Lorcana: [Lorcast](https://lorcast.com) (asks for 50–100 ms between requests)
  - One Piece: the bundled TCGPlayer catalog itself (every variant is its own
    product), with TCGPlayer's product images — which, like all publicly
    available One Piece card images, carry Bandai's "SAMPLE" watermark
- Variants, TCGPlayer product IDs and per-printing prices: a static catalog per
  game built from [tcgcsv.com](https://tcgcsv.com) (a daily mirror of TCGPlayer's
  catalog) by `scripts/sync-tcgplayer.mjs`, into `public/tcgplayer/<game>/`.

## Adding a game

Each game is an adapter in `src/games/` (see `src/games/index.js` for the
interface): where its sets, cards and images come from, how its cards match
TCGPlayer products, and how card numbers are shown. `src/catalog.js` turns any
game's cards into binder slots. Add the game's TCGPlayer category and set matching
to `scripts/sync-tcgplayer.mjs`, and register the adapter in `src/games/index.js`.

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

Routes: `/binderwish/` is the home page, `/binderwish/search?game=<game>&set=<id>`
(or `&q=<name>`; `game` defaults to Pokémon) is the collecting tool. GitHub Pages only serves real files, so the build copies
`index.html` to `404.html` — unknown paths like `/search` then load the app.
Assets use an absolute base (`/binderwish/`, see `vite.config.js`); build with
`BASE_PATH=/` when serving from the root of a custom domain.

Note: GitHub disables scheduled workflows in a public repo after 60 days with
no commits; re-enable it from the Actions tab if that happens.

## Disclaimer

Placeholders are binder fillers for cards you're still collecting — not playable,
tradeable or sellable cards. Pokémon and all related names are trademarks of
Nintendo, Creatures Inc. and GAME FREAK inc. Not affiliated.
