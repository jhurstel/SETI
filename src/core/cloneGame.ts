import { Board, Card, Decks, Game, Player, Species, Technology, TechnologyBoard } from './types';

/**
 * Copie profonde de données de partie (objets simples, tableaux, valeurs primitives : l'état n'a ni Map, ni Set,
 * ni Date, ni fonction). Environ dix fois plus rapide que structuredClone, qui sérialise puis désérialise chaque
 * objet : c'était près de 90 % du temps de calcul des robots.
 * Comme les copies séparées du plateau, des joueurs et des pioches, elle ne conserve pas les références partagées :
 * un même objet présent à deux endroits devient deux objets. Un objet figé (Object.freeze) est partagé, pas copié.
 */
function deepCopy<T>(value: T): T {
  // Données figées (bonus des emplacements, effets des cartes) : partagées entre les copies
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    const copy = new Array(value.length);
    for (let i = 0; i < value.length; i++) copy[i] = deepCopy(value[i]);
    return copy as T;
  }
  const copy: Record<string, unknown> = {};
  for (const key in value) copy[key] = deepCopy((value as Record<string, unknown>)[key]);
  return copy as T;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.values(value).forEach(deepFreeze);
  Object.freeze(value);
}

/**
 * Une carte est figée (effets compris) et partagée entre les copies : ses champs variables (propriétaire,
 * révélée…) changent en la remplaçant ({ ...carte, isRevealed: true }), jamais sur place.
 */
function shareCard(card: Card): Card {
  if (!Object.isFrozen(card)) deepFreeze(card);
  return card;
}

function cloneCards(cards: Card[]): Card[] {
  return cards ? cards.map(shareCard) : cards;
}

/** Une technologie ne change jamais : figée et partagée entre les copies (comme les cartes). */
function cloneTech(tech: Technology): Technology {
  if (!Object.isFrozen(tech)) deepFreeze(tech);
  return tech;
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

/**
 * Bonus des emplacements du plateau (planètes, satellites, secteurs, signaux) : des données de règles qui ne
 * changent jamais. Figés une fois, ils sont partagés par toutes les copies (la moitié des objets du plateau).
 */
function freezeBoardBonuses(board: Board): void {
  board.planets.forEach(planet => {
    deepFreeze(planet.orbitFirstBonus);
    deepFreeze(planet.orbitNextBonus);
    deepFreeze(planet.landFirstBonus);
    deepFreeze(planet.landSecondBonus);
    deepFreeze(planet.landThirdBonus);
    deepFreeze(planet.landNextBonus);
    deepFreeze(planet.orbitSlots);
    deepFreeze(planet.landSlots);
    planet.satellites?.forEach(satellite => deepFreeze(satellite.landBonus));
  });
  board.sectors.forEach(sector => {
    deepFreeze(sector.firstBonus);
    deepFreeze(sector.nextBonus);
    sector.signals.forEach(signal => deepFreeze(signal.bonus));
  });
}

function cloneBoard(board: Board): Board {
  freezeBoardBonuses(board);
  const { technologyBoard, ...rest } = board;
  return { ...deepCopy(rest), technologyBoard: technologyBoard && cloneTechnologyBoard(technologyBoard) };
}

function cloneDecks(decks: Decks): Decks {
  const roundDecks: Decks['roundDecks'] = {};
  for (const round in decks.roundDecks) roundDecks[round] = cloneCards(decks.roundDecks[round]);
  return {
    ...deepCopy({ ...decks, cards: [], cardRow: [], discardPile: [], roundDecks: {} }),
    cards: cloneCards(decks.cards),
    cardRow: cloneCards(decks.cardRow),
    discardPile: cloneCards(decks.discardPile),
    roundDecks,
  };
}

function clonePlayer(player: Player): Player {
  // Missions : leurs prérequis et les effets de la carte d'origine ne changent jamais (seuls les cercles
  // recouverts, completedRequirementIds, évoluent) : figés et partagés
  player.missions.forEach(mission => {
    deepFreeze(mission.requirements);
    if (mission.originalCard) shareCard(mission.originalCard);
  });
  const { cards, playedCards, reservedCards, technologies, ...rest } = player;
  return {
    ...deepCopy(rest),
    technologies: cloneTechs(technologies),
    cards: cloneCards(cards),
    playedCards: cloneCards(playedCards),
    reservedCards: cloneCards(reservedCards),
  };
}

function cloneSpecies(species: Species): Species {
  // Récompenses des emplacements de la piste : remplacées d'un bloc (spécimen Mascamite), jamais modifiées sur place
  deepFreeze(species.fixedSlots);
  deepFreeze(species.infiniteSlots);
  const { cards, cardRow, ...rest } = species;
  return { ...deepCopy(rest), cards: cloneCards(cards), cardRow: cloneCards(cardRow) };
}

/**
 * Copie profonde d'une partie, à utiliser avant toute modification d'état dans le moteur.
 *
 * C'est l'opération la plus coûteuse du moteur (des dizaines de copies par étape d'un robot Expert ; près de
 * 90 % de son temps quand elle passait par structuredClone). Les cartes (pioches, mains, espèces) et les
 * technologies (plateau, joueurs) sont copiées en surface : leurs effets et bonus, qui ne changent jamais, sont
 * figés (Object.freeze) et partagés. Toute modification d'un effet lève donc une erreur au lieu d'altérer les
 * autres copies. Le reste de l'état passe par deepCopy. Mesure : `npm run bench:ai`.
 */
export function cloneGame(game: Game): Game {
  const { board, decks, players, species, discoveredSpecies, ...rest } = game;
  return {
    ...deepCopy(rest),
    board: cloneBoard(board),
    decks: cloneDecks(decks),
    players: players.map(clonePlayer),
    species: species?.map(cloneSpecies),
    discoveredSpecies: discoveredSpecies?.map(cloneSpecies),
  };
}
