import { QRCodeSVG } from 'qrcode.react';
import { cardImage, tcgplayerUrl } from '../catalog';

const QR_INSET = '3.5mm';
// Where the "not a real card" band sits, per game — over a part of the card that
// doesn't hide its name or number (Pokémon: attack area; Lorcana: lower art, since
// the name and version sit mid-card).
const BAND_TOP = { pokemon: '52mm', lorcana: '30mm' };
const QR_POSITION = {
  br: { right: QR_INSET, bottom: QR_INSET },
  bl: { left: QR_INSET, bottom: QR_INSET },
  tr: { right: QR_INSET, top: QR_INSET },
  tl: { left: QR_INSET, top: QR_INSET },
};

// A real-size (63×88mm) binder placeholder: the card art (which already shows its
// name, number and set), a subtle "not a real card" band — naming the variant,
// since Poké Ball / Master Ball / reverse printings share the same art — and a
// QR code to the exact TCGPlayer listing. Plain elements + inline styles (not
// MUI) so it prints identically everywhere.
export default function PlaceholderCard({ slot, options, highRes = false, style }) {
  const src = cardImage(slot, highRes ? 'high' : 'low');
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
        <img src={src} alt={slot.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '6mm',
          font: '600 11pt/1.3 Roboto, system-ui, sans-serif', color: '#333', textAlign: 'center',
        }}>
          {slot.name}{slot.setName ? ` — ${slot.setName} #${slot.numberLabel || slot.number}` : ''}
        </div>
      )}

      {/* Subtle "not a real card" band */}
      <div style={{
        position: 'absolute', top: BAND_TOP[slot.game] || BAND_TOP.pokemon, left: 0, right: 0, padding: '0.8mm 2mm', textAlign: 'center',
        background: 'rgba(109,74,255,.45)', color: 'rgba(255,255,255,.95)',
        font: '700 5.5pt/1.25 Roboto, system-ui, sans-serif', letterSpacing: '.14em', textTransform: 'uppercase',
      }}>
        Placeholder · not a real card
        {slot.variantLabel && <span style={{ display: 'block', letterSpacing: '.06em' }}>{slot.variantLabel}</span>}
      </div>

      {/* QR to the exact TCGPlayer listing */}
      <div style={{
        position: 'absolute', ...QR_POSITION[options.qrPos], width: `${options.qrSize}mm`,
        background: '#fff', padding: '0.8mm', borderRadius: '1.2mm', lineHeight: 0, textAlign: 'center',
      }}>
        <QRCodeSVG value={tcgplayerUrl(slot)} level="M" marginSize={0} style={{ width: '100%', height: 'auto', display: 'block' }} />
        {options.price && slot.price != null && (
          <span style={{ display: 'block', font: '700 5.5pt/1.2 Roboto, system-ui, sans-serif', color: '#000', marginTop: '0.4mm' }}>
            ${slot.price.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
