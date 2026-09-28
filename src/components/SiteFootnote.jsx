import { Link } from '@mui/material';

const BASE = import.meta.env.BASE_URL;

// Shared footer text: purpose, data credits, trademarks and the privacy link.
export default function SiteFootnote({ onPrivacy }) {
  return (
    <>
      Placeholders are binder fillers for cards you’re still collecting — not playable or sellable cards.
      Card data & images via <Link href="https://tcgdex.dev" target="_blank" rel="noopener">TCGdex</Link> and{' '}
      <Link href="https://lorcast.com" target="_blank" rel="noopener">Lorcast</Link>; product links to TCGPlayer.
      Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc.
      Disney Lorcana is a trademark of Disney. ONE PIECE © Eiichiro Oda/Shueisha, Toei Animation; the One Piece
      Card Game is by Bandai. Not affiliated with any of them.{' '}
      <Link href={`${BASE}privacy`} onClick={(e) => { e.preventDefault(); onPrivacy(); }}>Privacy policy</Link>
    </>
  );
}
