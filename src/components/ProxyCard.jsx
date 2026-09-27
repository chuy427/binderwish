import { QRCodeSVG } from 'qrcode.react';
import { cardImage, tcgplayerUrl } from '../api';

const QR_INSET = '3.5mm';
const QR_POSITION = {
  br: { right: QR_INSET, bottom: QR_INSET },
  bl: { left: QR_INSET, bottom: QR_INSET },
  tr: { right: QR_INSET, top: QR_INSET },
  tl: { left: QR_INSET, top: QR_INSET },
};

// A real-size (63×88mm) proxy with the TCGPlayer QR overlaid. Plain elements +
// inline styles rather than MUI so it prints identically everywhere.
export default function ProxyCard({ card, options, highRes = false, style }) {
  const src = cardImage(card, highRes ? 'high' : 'low');
  return (
    <div
      className="pcard"
      style={{
        position: 'relative',
        width: '63mm',
        height: '88mm',
        overflow: 'hidden',
        borderRadius: '3mm',
        background: '#ddd',
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '6mm',
          font: '600 11pt/1.3 system-ui, sans-serif', color: '#333', textAlign: 'center',
        }}>
          {card.name}{card.setName ? ` — ${card.setName} #${card.number}` : ''}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          ...QR_POSITION[options.qrPos],
          width: `${options.qrSize}mm`,
          background: '#fff',
          padding: '0.8mm',
          borderRadius: '1.2mm',
          opacity: options.qrOpacity / 100,
          lineHeight: 0,
          textAlign: 'center',
        }}
      >
        <QRCodeSVG value={tcgplayerUrl(card)} level="M" marginSize={0} style={{ width: '100%', height: 'auto', display: 'block' }} />
        {options.price && card.price != null && (
          <span style={{ display: 'block', font: '700 5.5pt/1.2 system-ui, sans-serif', color: '#000', marginTop: '0.4mm' }}>
            ${card.price.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
