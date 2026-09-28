// Supported games. Each adapter provides: id, name, exampleCard, quickPicks,
// loadSets(), loadSetCards(setId, setsInfo), searchByName(query, page, setsInfo),
// matchProducts(catalogRows, card), numberLabel(card, setsInfo), and optionally
// specialVariant(card), isVariantCard(card) (variants that are separate cards,
// hidden when "Master set" is off), qrCorner (preferred QR corner for "Auto") and
// fetchCardExtras(cardId). See catalog.js for how cards
// become binder slots.
import pokemon from './pokemon';
import lorcana from './lorcana';
import onepiece from './onepiece';

export const GAMES = { pokemon, lorcana, onepiece };
export const GAME_LIST = [pokemon, lorcana, onepiece];
export const DEFAULT_GAME = 'pokemon';

export const getGame = (id) => GAMES[id] || GAMES[DEFAULT_GAME];
