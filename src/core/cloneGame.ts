import { Board, Card, Decks, Game, Player, Species, Technology, TechnologyBoard } from './types';

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.values(value).forEach(deepFreeze);
  Object.freeze(value);
}

/** Fige les effets d'une carte (une seule fois par tableau) : ils sont alors partagés entre les copies. */
function freezeEffects(effects: Card['immediateEffects']): void {
  if (effects && !Object.isFrozen(effects)) deepFreeze(effects);
}

/**
 * Copie d'une carte : ses champs variables (propriétaire, révélée, accomplie…) sont copiés,
 * ses effets, qui ne changent jamais, sont figés et partagés.
 */
function cloneCard(card: Card): Card {
  freezeEffects(card.immediateEffects);
  freezeEffects(card.passiveEffects);
  freezeEffects(card.permanentEffects);
  return { ...card };
}

function cloneCards(cards: Card[]): Card[] {
  return cards ? cards.map(cloneCard) : cards;
}

/** Copie d'une technologie : effets et bonus figés et partagés, propriétaire copié. */
function cloneTech(tech: Technology): Technology {
  deepFreeze(tech.effects);
  deepFreeze(tech.bonus);
  return { ...tech };
}

function cloneTechs(techs: Technology[]): Technology[] {
  return techs ? techs.map(cloneTech) : techs;
}

function cloneTechnologyBoard(board: TechnologyBoard): TechnologyBoard {
  return {
    ...board,
    available: cloneTechs(board.available),
    researched: cloneTechs(board.researched),
    categorySlots: board.categorySlots?.map(slot => ({ ...slot, technologies: cloneTechs(slot.technologies) })),
  };
}

function cloneBoard(board: Board): Board {
  const { technologyBoard, ...rest } = board;
  return { ...structuredClone(rest), technologyBoard: technologyBoard && cloneTechnologyBoard(technologyBoard) };
}

function cloneDecks(decks: Decks): Decks {
  if (!decks) return decks;
  const roundDecks: Decks['roundDecks'] = {};
  for (const round in decks.roundDecks) roundDecks[round] = cloneCards(decks.roundDecks[round]);
  return {
    ...structuredClone({ ...decks, cards: [], cardRow: [], discardPile: [], roundDecks: {} }),
    cards: cloneCards(decks.cards),
    cardRow: cloneCards(decks.cardRow),
    discardPile: cloneCards(decks.discardPile),
    roundDecks,
  };
}

function clonePlayer(player: Player): Player {
  const { cards, playedCards, reservedCards, technologies, ...rest } = player;
  return {
    ...structuredClone(rest),
    technologies: cloneTechs(technologies),
    cards: cloneCards(cards),
    playedCards: cloneCards(playedCards),
    reservedCards: cloneCards(reservedCards),
  };
}

function cloneSpecies(species: Species): Species {
  const { cards, cardRow, ...rest } = species;
  return { ...structuredClone(rest), cards: cloneCards(cards), cardRow: cloneCards(cardRow) };
}

/**
 * Copie profonde d'une partie, à utiliser avant toute modification d'état dans le moteur.
 *
 * C'est l'opération la plus coûteuse du moteur (environ 40 copies par étape d'un robot Expert,
 * près de 90 % de son temps avec un simple structuredClone). Les cartes (pioches, mains, espèces)
 * et les technologies (plateau, joueurs) sont copiées en surface : leurs effets et bonus, qui ne
 * changent jamais, sont figés (Object.freeze) et partagés. Toute modification d'un effet lève donc
 * une erreur au lieu d'altérer les autres copies. Le reste de l'état passe par structuredClone.
 */
export function cloneGame(game: Game): Game {
  const { board, decks, players, species, discoveredSpecies, ...rest } = game;
  return {
    ...structuredClone(rest),
    board: cloneBoard(board),
    decks: cloneDecks(decks),
    players: players.map(clonePlayer),
    species: species?.map(cloneSpecies),
    discoveredSpecies: discoveredSpecies?.map(cloneSpecies),
  };
}
