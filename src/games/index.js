// Supported games. Each adapter provides: id, name, exampleCard, quickPicks,
// loadSets(), loadSetCards(setId, setsInfo), searchByName(query, page, setsInfo),
// matchProducts(catalogRows, card), numberLabel(card, setsInfo), and optionally
// specialVariant(card) and fetchCardExtras(cardId). See catalog.js for how cards
// become binder slots.
import pokemon from './pokemon';
import lorcana from './lorcana';

export const GAMES = { pokemon, lorcana };
export const GAME_LIST = [pokemon, lorcana];
export const DEFAULT_GAME = 'pokemon';

export const getGame = (id) => GAMES[id] || GAMES[DEFAULT_GAME];
