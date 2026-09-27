import { QRCodeSVG } from 'qrcode.react';
import { cardImage, tcgplayerUrl } from '../api';

const QR_INSET = '3mm';
const QR_POSITION = {
  br: { right: QR_INSET, bottom: QR_INSET },
  bl: { left: QR_INSET, bottom: QR_INSET },
  tr: { right: QR_INSET, top: '13mm' },
  tl: { left: QR_INSET, top: '13mm' },
};
const ART_STYLE = {
  ghost: { filter: 'grayscale(1) contrast(.9)', opacity: 0.22 },
  tinted: { filter: 'saturate(.8)', opacity: 0.32 },
};

// A real-size (63×88mm) binder placeholder: faded "ghost" art, the card's number,
// name and variant, and a QR code to the exact TCGPlayer listing. Deliberately
// looks nothing like a real card. Plain elements + inline styles (not MUI) so it
// prints identically everywhere.
export default function PlaceholderCard({ slot, options, highRes = false, style }) {
  const src = cardImage(slot, highRes ? 'high' : 'low');
  const qrBottom = options.qrPos === 'br' || options.qrPos === 'bl';
  const qrLeft = options.qrPos === 'bl' || options.qrPos === 'tl';
  return (
    <div
      className="pcard"
      style={{
        position: 'relative',
        width: '63mm',
        height: '88mm',
        overflow: 'hidden',
        borderRadius: '3mm',
        background: '#fff',
        color: '#1d1d24',
        fontFamily: 'Roboto, system-ui, sans-serif',
        boxShadow: 'inset 0 0 0 0.3mm #c9c9d2',
        ...style,
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...ART_STYLE[options.style || 'ghost'] }}
        />
      )}

      {/* Header: set + big card number */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '11mm', padding: '0 3mm',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2mm',
        background: 'rgba(255,255,255,.88)', borderBottom: '0.3mm solid #d7d7df',
      }}>
        <span style={{ font: '600 6pt/1.1 Roboto, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', color: '#5b5b68', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {slot.setName}
        </span>
        <span style={{ font: '700 12pt/1 Roboto, sans-serif', whiteSpace: 'nowrap' }}>#{slot.numberLabel || slot.number}</span>
      </div>

      {/* Name + variant */}
      <div style={{ position: 'absolute', top: '28mm', left: '3mm', right: '3mm', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', maxWidth: '100%', padding: '1.5mm 2.5mm', borderRadius: '1.5mm',
          background: 'rgba(255,255,255,.9)',
        }}>
          <div style={{ font: '700 12pt/1.15 Roboto, sans-serif' }}>{slot.name}</div>
          {slot.variantLabel && (
            <div style={{
              display: 'inline-block', marginTop: '1mm', padding: '0.4mm 2mm', borderRadius: '5mm',
              border: '0.25mm solid #6d4aff', color: '#4b2fd1', font: '600 6.5pt/1.3 Roboto, sans-serif',
            }}>
              {slot.variantLabel}
            </div>
          )}
        </div>
      </div>

      {/* "Not a real card" band */}
      <div style={{
        position: 'absolute', top: '52mm', left: 0, right: 0, padding: '1mm 0', textAlign: 'center',
        background: 'rgba(109,74,255,.9)', color: '#fff', font: '700 6pt/1.2 Roboto, sans-serif', letterSpacing: '.18em',
      }}>
        PLACEHOLDER · NOT A REAL CARD
      </div>

      {/* QR to the exact TCGPlayer listing */}
      <div style={{
        position: 'absolute', ...QR_POSITION[options.qrPos], width: `${options.qrSize}mm`,
        background: '#fff', padding: '0.8mm', borderRadius: '1.2mm', lineHeight: 0, textAlign: 'center',
      }}>
        <QRCodeSVG value={tcgplayerUrl(slot)} level="M" marginSize={0} style={{ width: '100%', height: 'auto', display: 'block' }} />
        {options.price && slot.price != null && (
          <span style={{ display: 'block', font: '700 5.5pt/1.2 Roboto, sans-serif', color: '#000', marginTop: '0.4mm' }}>
            ${slot.price.toFixed(2)}
          </span>
        )}
      </div>
      {qrBottom && (
        <div style={{
          position: 'absolute', bottom: '3mm', [qrLeft ? 'right' : 'left']: '3mm', maxWidth: `${60 - options.qrSize - 8}mm`,
          font: '600 5.5pt/1.3 Roboto, sans-serif', color: '#5b5b68', textAlign: qrLeft ? 'right' : 'left',
          background: 'rgba(255,255,255,.85)', padding: '0.6mm 1.2mm', borderRadius: '1mm',
        }}>
          Scan to find this card<br />on TCGPlayer
        </div>
      )}
    </div>
  );
}
