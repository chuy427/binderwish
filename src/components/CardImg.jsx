import { useEffect, useState } from 'react';
import { cardImage } from '../catalog';

// Card art that never shows a broken image: tries the requested size, then the
// other size, then the game's alternate source (e.g. Bandai's official image for
// One Piece), and finally renders `fallback` and calls `onFail`. Brand-new sets
// are often listed on TCGPlayer before any images exist.
export default function CardImg({ slot, quality = 'low', fallback = null, onFail, alt = '', ...imgProps }) {
  const sources = [...new Set([
    cardImage(slot, quality),
    cardImage(slot, quality === 'high' ? 'low' : 'high'),
    slot?.images?.alt,
  ].filter(Boolean))];
  const key = sources.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [key]);
  const exhausted = index >= sources.length;
  useEffect(() => { if (exhausted) onFail?.(); }, [exhausted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (exhausted) return fallback;
  return <img src={sources[index]} alt={alt} onError={() => setIndex((i) => i + 1)} {...imgProps} />;
}
