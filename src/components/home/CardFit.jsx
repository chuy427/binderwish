import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import PlaceholderCard from '../PlaceholderCard';
import { cardImage } from '../../catalog';

const CARD_PX = (63 / 25.4) * 96; // 63mm in CSS px

// A card sized to fill its container's width: either the real card art ("owned")
// or a real-size BinderWish placeholder scaled down to fit.
export default function CardFit({ slot, kind = 'owned', options, radius = 6, sx }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / CARD_PX));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const src = slot ? cardImage(slot) : null;
  return (
    <Box ref={ref} sx={{ aspectRatio: '63 / 88', borderRadius: `${radius}px`, overflow: 'hidden', position: 'relative', bgcolor: 'rgba(255,255,255,.05)', ...sx }}>
      {slot && kind === 'owned' && src && (
        <Box component="img" src={src} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      {slot && kind === 'placeholder' && (
        <Box sx={{ width: '63mm', transformOrigin: 'top left', transform: `scale(${scale})` }}>
          <PlaceholderCard slot={slot} options={{ qrCorner: 'auto', qrSize: 14, price: true, ...options }} style={{ borderRadius: 0 }} />
        </Box>
      )}
    </Box>
  );
}
