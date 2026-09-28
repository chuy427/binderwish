import { QRCodeSVG } from 'qrcode.react';
import { cardImage, tcgplayerUrl } from '../catalog';
import { getGame } from '../games';
import { TOMATO, TOMATO_TEXT } from '../theme';

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
  if (options.cardStyle === 'clean') return <CleanPlaceholder slot={slot} options={options} style={style} />;
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
        background: 'rgba(255,99,71,.5)', color: 'rgba(255,255,255,.95)',
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

const FONT = 'Roboto, system-ui, sans-serif';
const INK = '#1d1b26';
const MUTED = '#6b6879';
const ACCENT = TOMATO;            // lines and borders
const ACCENT_TEXT = TOMATO_TEXT;  // small text — readable contrast on white

// The art-free placeholder: BinderWish's own design built only from the card's
// details (game, set, number, name, variant) plus a large QR code. No official
// artwork — low-ink at home, and the design offered for printed-and-shipped
// placeholders. Layout is fixed (the QR options don't apply).
function CleanPlaceholder({ slot, options, style }) {
  const gameName = slot.game ? getGame(slot.game).name : 'Pokémon';
  return (
    <div
      className="pcard"
      style={{
        position: 'relative', width: '63mm', height: '88mm', overflow: 'hidden', borderRadius: '3mm',
        background: '#fff', color: INK, fontFamily: FONT, boxShadow: 'inset 0 0 0 0.3mm #d8d6e0',
        display: 'flex', flexDirection: 'column', ...style,
      }}
    >
      {/* Header: game · set, and the big card number */}
      <div style={{
        padding: '2.6mm 3.5mm 2.2mm', background: '#fff1ee', borderBottom: `0.4mm solid ${ACCENT}`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '2mm',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: `700 5pt/1.2 ${FONT}`, letterSpacing: '.12em', textTransform: 'uppercase', color: ACCENT_TEXT }}>{gameName}</div>
          <div style={{ font: `600 6.5pt/1.2 ${FONT}`, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.setName}</div>
        </div>
        <div style={{ font: `800 13pt/1 ${FONT}`, whiteSpace: 'nowrap' }}>#{slot.numberLabel || slot.number}</div>
      </div>

      {/* Name + variant */}
      <div style={{ padding: '3.5mm 3.5mm 0', textAlign: 'center', minHeight: '19mm' }}>
        <div style={{
          font: `800 12.5pt/1.15 ${FONT}`, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{slot.name}</div>
        {slot.variantLabel && (
          <div style={{
            display: 'inline-block', marginTop: '1.6mm', padding: '0.5mm 2.2mm', borderRadius: '5mm',
            border: `0.3mm solid ${ACCENT}`, color: ACCENT_TEXT, font: `700 6.5pt/1.3 ${FONT}`,
          }}>{slot.variantLabel}</div>
        )}
      </div>

      {/* Big QR to the exact TCGPlayer listing */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.4mm' }}>
        <QRCodeSVG value={tcgplayerUrl(slot)} level="M" marginSize={0} style={{ width: '27mm', height: '27mm', display: 'block' }} />
        <div style={{ font: `600 6pt/1.2 ${FONT}`, color: MUTED }}>
          Scan for today’s price
          {options.price && slot.price != null && <b style={{ color: INK }}> · ${slot.price.toFixed(2)}</b>}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '1.6mm 3mm', textAlign: 'center', borderTop: '0.3mm dashed #d8d6e0',
        font: `700 5pt/1.2 ${FONT}`, letterSpacing: '.12em', textTransform: 'uppercase', color: MUTED,
      }}>
        BinderWish placeholder · not a real card
      </div>
    </div>
  );
}
