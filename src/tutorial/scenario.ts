/**
 * Aides des chapitres du tutoriel (fonctions pures) : ajustements de scénario, commandes calculées sur la partie
 * (pas vers une planète, réponse par défaut à une interaction) et prédicats des étapes.
 */
import { AlienBoardType, Card, ComputerSlot, GAME_CONSTANTS, Game, LifeTraceLocation, LifeTraceType, Player, ProbeState } from '../core/types';
import { requirePlayer } from '../core/players';
import { calculateReachableCells, createRotationState, getAbsoluteSectorForProbe, getAllCells } from '../core/SolarSystemPosition';
import { CardSystem } from '../systems/CardSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import type { Command } from '../session/commands';
import type { TutorialContext, TutorialDeadEnd } from './types';

export const humanOf = (game: Game, humanId: string): Player => requirePlayer(game, humanId);

// --- Ajustements de scénario (sur une copie de la partie : cloneGame fait par prepareChapter) ---

/** Les adversaires ont déjà passé : le joueur joue seul jusqu'à la fin de la manche, sans rotation due à leur passe */
export function opponentsPassed(game: Game, humanId: string): Game {
  game.players.forEach(p => { if (p.id !== humanId) p.hasPassed = true; });
  return game;
}

/** Met une carte (par son identifiant) dans la main d'un joueur, où qu'elle soit (pioche, rangée, piles de manche) */
export function giveCardToHand(game: Game, playerId: string, cardId: string): Game {
  const pools: Card[][] = [game.decks.cards, game.decks.cardRow, game.decks.discardPile, ...Object.values(game.decks.roundDecks)];
  for (const pool of pools) {
    const index = pool.findIndex(c => c.id === cardId);
    if (index !== -1) {
      requirePlayer(game, playerId).cards.push(pool.splice(index, 1)[0]);
      return game;
    }
  }
  throw new Error(`Tutoriel : carte ${cardId} introuvable`);
}

/** Remplit des cases de l'ordinateur d'un joueur (sans leurs bonus : position de départ d'un chapitre) */
export function fillComputer(game: Game, playerId: string, slotIds: string[]): Game {
  const computer = requirePlayer(game, playerId).dataComputer;
  computer.slots = { ...computer.slots };
  for (const id of slotIds) computer.slots[id] = { ...computer.slots[id], filled: true } as ComputerSlot;
  if (computer.slots['6a']?.filled) computer.canAnalyze = true;
  return game;
}

/**
 * Met une espèce sur le premier plateau Alien (les cinq espèces existent toujours dans la partie) ; si elle était
 * sur l'autre plateau, celui-ci prend l'espèce que le premier avait
 */
export function speciesOnFirstBoard(game: Game, species: AlienBoardType): Game {
  const boards = game.board.alienBoards;
  boards.forEach((board, index) => { if (index > 0 && board.speciesId === species) board.speciesId = boards[0].speciesId; });
  boards[0].speciesId = species;
  return game;
}

/**
 * Découverte d'une espèce prête à jouer : l'espèce sur le premier plateau, les traces rouge et jaune du joueur déjà sur
 * son triangle de découverte, et la ligne du haut de l'ordinateur remplie : analyser donne la trace bleue qui la découvre
 */
export function readyToDiscover(game: Game, humanId: string, species: AlienBoardType): Game {
  let updated = fillComputer(speciesOnFirstBoard(game, species), humanId, ['1a', '2', '3a', '4', '5a', '6a']);
  for (const color of [LifeTraceType.RED, LifeTraceType.YELLOW]) {
    updated = SpeciesSystem.placeLifeTrace(updated, 0, color, humanId, '', LifeTraceLocation.TRIANGLE).updatedGame;
  }
  const human = requirePlayer(updated, humanId);
  human.energy = Math.max(human.energy, GAME_CONSTANTS.ANALYZE_COST_ENERGY);
  return updated;
}

/** Met une carte d'une espèce (par son identifiant) dans la main d'un joueur, depuis la pioche de l'espèce */
export function giveSpeciesCardToHand(game: Game, playerId: string, cardId: string): Game {
  for (const species of game.species) {
    const index = species.cards.findIndex(c => c.id === cardId);
    if (index !== -1) {
      species.cards = [...species.cards];
      requirePlayer(game, playerId).cards.push(species.cards.splice(index, 1)[0]);
      return game;
    }
  }
  throw new Error(`Tutoriel : carte d'espèce ${cardId} introuvable`);
}

// --- Géométrie : planètes et sondes ---

const rotationOf = (game: Game) => {
  const s = game.board.solarSystem;
  return createRotationState(s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3);
};

/** Case (« B8 ») où se trouve une planète */
export function planetCell(game: Game, planetId: string): string | undefined {
  for (const [key, cell] of getAllCells(rotationOf(game), game.board.solarSystem.extraCelestialObjects)) {
    if (cell.hasPlanet && cell.planetId === planetId) return key;
  }
  return undefined;
}

/** Sonde du joueur encore dans le système solaire (pas en orbite ni posée), ou sa capsule de spécimen */
export function freeProbe(game: Game, humanId: string, state: ProbeState = ProbeState.IN_SOLAR_SYSTEM) {
  return humanOf(game, humanId).probes.find(p => p.state === state);
}

/** Case actuelle d'une sonde libre du joueur (ou de sa capsule) */
export function probeCell(game: Game, humanId: string, state: ProbeState = ProbeState.IN_SOLAR_SYSTEM): string | undefined {
  const probe = freeProbe(game, humanId, state);
  if (!probe) return undefined;
  return `${probe.solarPosition.disk}${getAbsoluteSectorForProbe(probe.solarPosition, rotationOf(game))}`;
}

/** Plus court chemin (déplacements, sorties d'astéroïde comprises) d'une case (« B8 ») vers une planète */
function pathFrom(game: Game, cell: string, planetId: string) {
  const target = planetCell(game, planetId);
  if (!target) return undefined;
  const reachable = calculateReachableCells(cell[0] as never, Number(cell.slice(1)) as never, 8, rotationOf(game), false, undefined, game.board.solarSystem.extraCelestialObjects);
  // Toute planète est à moins de 8 cases d'une autre case du système solaire
  return reachable.get(target)!;
}

/** Plus court chemin de la sonde libre du joueur vers une planète */
function pathTo(game: Game, humanId: string, planetId: string, state: ProbeState = ProbeState.IN_SOLAR_SYSTEM) {
  const probe = freeProbe(game, humanId, state);
  const cell = probeCell(game, humanId, state);
  const path = cell ? pathFrom(game, cell, planetId) : undefined;
  return probe && path ? { probe, ...path } : undefined;
}

/** Déplacements de la sonde libre du joueur (ou de sa capsule) jusqu'à une planète ; undefined sans sonde libre */
export function movesTo(game: Game, humanId: string, planetId: string, state: ProbeState = ProbeState.IN_SOLAR_SYSTEM): number | undefined {
  return pathTo(game, humanId, planetId, state)?.movements;
}

/** Déplacements entre deux planètes (plus court chemin) */
export function movesBetween(game: Game, fromPlanetId: string, toPlanetId: string): number {
  return pathFrom(game, planetCell(game, fromPlanetId)!, toPlanetId)!.movements;
}

/** Commande : un pas de la sonde libre du joueur vers une planète (plus court chemin) */
export function stepTowards(planetId: string, state: ProbeState = ProbeState.IN_SOLAR_SYSTEM) {
  return (game: Game, humanId: string): Command => {
    const path = pathTo(game, humanId, planetId, state);
    if (!path) throw new Error(`Tutoriel : pas de sonde ou de planète ${planetId}`);
    const probe = path.probe;
    const next = path.path[1];
    return { type: 'MOVE_PROBE', probeId: probe.id, disk: next[0] as never, sector: Number(next.slice(1)) as never };
  };
}

// --- Prédicats ---

export const probeOnPlanet = (game: Game, humanId: string, planetId: string, state: ProbeState = ProbeState.IN_SOLAR_SYSTEM) =>
  probeCell(game, humanId, state) === planetCell(game, planetId);
export const hasOrbiter = (game: Game, humanId: string, planetId: string) =>
  humanOf(game, humanId).probes.some(p => p.state === ProbeState.IN_ORBIT && p.planetId === planetId);
export const hasLander = (game: Game, humanId: string, planetId: string) =>
  humanOf(game, humanId).probes.some(p => p.state === ProbeState.LANDED && p.planetId === planetId);
/**
 * La sonde libre du joueur ne peut plus se mettre en orbite autour d'une planète : son énergie ne suffit plus
 * pour la rejoindre puis payer l'orbite (sans orbiteur déjà posé, ni sonde libre : faux)
 */
export function cannotReachOrbit(game: Game, humanId: string, planetId: string): boolean {
  return !hasOrbiter(game, humanId, planetId) && cannotReachWith(game, humanId, planetId, GAME_CONSTANTS.ORBIT_COST_ENERGY);
}
/** La capsule du joueur ne peut plus rejoindre une planète : son énergie ne suffit plus (sans capsule : faux) */
export function cannotReachWithCapsule(game: Game, humanId: string, planetId: string): boolean {
  return cannotReachWith(game, humanId, planetId, 0, ProbeState.CAPSULE);
}
/**
 * La sonde libre du joueur ne peut plus rejoindre une planète puis dépenser encore `extra` énergies (atterrissage,
 * retour d'une capsule…) : son énergie ne suffit plus (sans sonde libre : faux)
 */
export function cannotReachWith(game: Game, humanId: string, planetId: string, extra: number, state: ProbeState = ProbeState.IN_SOLAR_SYSTEM): boolean {
  const path = pathTo(game, humanId, planetId, state);
  return !!path && humanOf(game, humanId).energy < path.movements + extra;
}
/** Énergie d'un atterrissage sur une planète (réduite par un orbiteur ; les chapitres n'ont pas la technologie d'exploration) */
export function landCost(game: Game, planetId: string): number {
  const hasOrbiter = game.board.planets.find(p => p.id === planetId)!.orbiters.length > 0;
  return hasOrbiter ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_ORBITER : GAME_CONSTANTS.LAND_COST_ENERGY;
}
/** Trace bleue du joueur posée sur un autre plateau Alien que celui de l'espèce à découvrir (encore à découvrir) */
export function blueTraceElsewhere(game: Game, humanId: string, boardIndex = 0): boolean {
  const target = game.board.alienBoards[boardIndex];
  if (target.isDiscovered || SpeciesSystem.isDiscoveryPending(game, boardIndex)) return false;
  return game.board.alienBoards.some((board, index) =>
    index !== boardIndex && board.lifeTraces.some(t => t.playerId === humanId && t.type === LifeTraceType.BLUE));
}
/** Carte du joueur ni en main ni jouée (missions et cartes jouées) : défaussée ou échangée */
export function cardGone(game: Game, humanId: string, cardId: string): boolean {
  const player = humanOf(game, humanId);
  return !player.cards.some(c => c.id === cardId) && !player.playedCards.some(c => c.id === cardId) && !player.missions.some(m => m.cardId === cardId);
}

// --- Impasses communes ---

/** Ressource dont une étape restante a besoin */
export type TutorialResource = 'credits' | 'energy' | 'mediaCoverage' | 'data';
/** Section de texte de l'impasse de chaque ressource (dans la section du chapitre de public/docs/tutoriel.md) */
export const RESOURCE_DEAD_END_IDS: Record<TutorialResource, string> = {
  credits: 'annuler-credits', energy: 'annuler-energie', mediaCoverage: 'annuler-medias', data: 'annuler-donnees',
};
/**
 * Impasses de ressources : pour chaque ressource, le besoin des étapes restantes (selon l'avancement) ; impasse quand le
 * joueur en a moins (dépensée par un échange, un achat, une case de l'ordinateur…). Une ressource que les étapes restantes
 * rapporteraient n'est pas comptée : le besoin se calcule sans les gains à venir.
 */
export function resourceDeadEnds(needs: Partial<Record<TutorialResource, (context: TutorialContext) => number>>): TutorialDeadEnd[] {
  return (Object.keys(needs) as TutorialResource[]).map(resource => ({
    id: RESOURCE_DEAD_END_IDS[resource],
    when: (context: TutorialContext) => humanOf(context.game, context.humanId)[resource] < needs[resource]!(context),
  }));
}

export const handSize = (game: Game, humanId: string) => CardSystem.getHandCards(humanOf(game, humanId)).length;
export const signalsOf = (game: Game, humanId: string) =>
  game.board.sectors.reduce((n, sector) => n + sector.signals.filter(s => s.markedBy === humanId).length, 0);
export const lifeTracesOf = (game: Game, humanId: string) =>
  game.board.alienBoards.reduce((n, board) => n + board.lifeTraces.filter(t => t.playerId === humanId).length, 0);
export const filledTopSlots = (game: Game, humanId: string) =>
  Object.values(humanOf(game, humanId).dataComputer.slots).filter(s => s.type === 'top' && s.filled).length;
/** Nouveau tour du joueur : c'est à lui, et il n'a pas encore joué d'action principale */
export const freshTurn = (game: Game, humanId: string) =>
  game.players[game.currentPlayerIndex].id === humanId && !humanOf(game, humanId).hasPerformedMainAction && !game.interaction;

// --- Réponse par défaut à une interaction (solutions des chapitres, tests) ---

/** Commande qui répond à l'interaction en cours par le premier choix possible */
export function answerInteraction(game: Game, humanId: string): Command {
  const interaction = game.interaction;
  if (!interaction) throw new Error('Tutoriel : aucune interaction en cours');
  const player = humanOf(game, humanId);
  switch (interaction.type) {
    case 'SELECTING_SCAN_CARD':
    case 'ACQUIRING_CARD':
      return { type: 'CHOOSE', choice: { kind: 'CARD', cardId: game.decks.cardRow[0].id } };
    case 'CHOOSING_ROUND_CARD':
      return { type: 'CHOOSE', choice: { kind: 'CARD', cardId: game.decks.roundDecks[interaction.round][0].id } };
    case 'RESERVING_CARD':
    case 'DISCARDING_CARD':
      return { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: CardSystem.getHandCards(player).slice(0, interaction.count).map(c => c.id) } };
    case 'ACQUIRING_TECH':
      return { type: 'CHOOSE', choice: { kind: 'TECH', techId: TechnologySystem.acquirableTechs(game, humanId, interaction)[0].id } };
    case 'PLACING_LIFE_TRACE': {
      const option = SpeciesSystem.lifeTraceOptions(game, interaction.color)
        .find(o => !interaction.boardIndices || interaction.boardIndices.includes(o.boardIndex));
      // Les emplacements de découverte (triangles) acceptent toujours une trace
      return { type: 'CHOOSE', choice: { kind: 'LIFE_TRACE', boardIndex: option!.boardIndex, color: option!.color, slotType: option!.location, slotIndex: option!.slotIndex } };
    }
    case 'PLACING_OBJECTIVE_MARKER':
      return { type: 'CHOOSE', choice: { kind: 'OBJECTIVE', tileId: game.board.objectiveTiles.find(t => !t.markers.includes(humanId))!.id } };
    case 'SELECTING_SCAN_SECTOR': {
      const sector = game.board.sectors.find(s => s.id === interaction.sectorId)
        ?? game.board.sectors.find(s => s.color === interaction.color);
      // Chaque couleur de scan a ses secteurs sur le plateau
      return { type: 'CHOOSE', choice: { kind: 'SECTOR', sectorId: sector!.id } };
    }
    case 'CHOOSING_EXERTIEN_CARD':
      return { type: 'CHOOSE', choice: { kind: 'EXERTIEN', cardId: player.cards.find(c => CardSystem.isExertienCard(c))!.id } };
    case 'CHOOSING_CENTAURIEN_REWARD': {
      const tiles = game.species.find(s => s.name === AlienBoardType.CENTAURIENS)!.message!;
      return { type: 'CHOOSE', choice: { kind: 'CENTAURIEN', tokenIndex: tiles.findIndex(t => t.isAvailable) } };
    }
    case 'COLLECTING_SPECIMEN':
      return { type: 'CHOOSE', choice: { kind: 'SPECIMEN', planetId: interaction.planetId, tokenIndex: 0 } };
    case 'CHOOSING_BONUS_ACTION':
      return { type: 'CHOOSE', choice: { kind: 'MENU', index: interaction.choices.findIndex(c => !c.done) } };
    default:
      return { type: 'SKIP' };
  }
}

/**
 * Toutes les réponses possibles à l'interaction en cours (explorateur des écarts) : chaque carte, technologie,
 * emplacement de trace, secteur, carte Exertien, tuile ou bonus proposé, et le renoncement. Une réponse que le moteur
 * refuse est simplement écartée par l'appelant ; sans choix énuméré, la réponse par défaut.
 */
export function interactionAnswers(game: Game, humanId: string): Command[] {
  const interaction = game.interaction;
  if (!interaction) return [];
  const choose = (choice: Extract<Command, { type: 'CHOOSE' }>['choice']): Command => ({ type: 'CHOOSE', choice });
  const player = humanOf(game, humanId);
  const answers: Command[] = [];
  switch (interaction.type) {
    case 'SELECTING_SCAN_CARD':
    case 'ACQUIRING_CARD':
      answers.push(...game.decks.cardRow.map(card => choose({ kind: 'CARD', cardId: card.id })));
      break;
    case 'ACQUIRING_TECH':
      answers.push(...TechnologySystem.acquirableTechs(game, humanId, interaction).map(tech => choose({ kind: 'TECH', techId: tech.id })));
      break;
    case 'PLACING_LIFE_TRACE':
      answers.push(...SpeciesSystem.lifeTraceOptions(game, interaction.color)
        .filter(o => !interaction.boardIndices || interaction.boardIndices.includes(o.boardIndex))
        .map(o => choose({ kind: 'LIFE_TRACE', boardIndex: o.boardIndex, color: o.color, slotType: o.location, slotIndex: o.slotIndex })));
      break;
    case 'SELECTING_SCAN_SECTOR':
      answers.push(...[...game.board.sectors.map(sector => sector.id), 'oumuamua'].map(sectorId => choose({ kind: 'SECTOR', sectorId })));
      break;
    case 'CHOOSING_EXERTIEN_CARD':
      answers.push(...player.cards.filter(c => CardSystem.isExertienCard(c)).map(c => choose({ kind: 'EXERTIEN', cardId: c.id })), choose({ kind: 'EXERTIEN', cardId: undefined }));
      break;
    case 'CHOOSING_CENTAURIEN_REWARD':
      game.species.find(s => s.name === AlienBoardType.CENTAURIENS)!.message!
        .forEach((tile, tokenIndex) => { if (tile.isAvailable) answers.push(choose({ kind: 'CENTAURIEN', tokenIndex })); });
      break;
    case 'PLACING_OBJECTIVE_MARKER':
      answers.push(...game.board.objectiveTiles.map(tile => choose({ kind: 'OBJECTIVE', tileId: tile.id })));
      break;
    case 'CHOOSING_BONUS_ACTION':
      interaction.choices.forEach((choice, index) => { if (!choice.done) answers.push(choose({ kind: 'MENU', index })); });
      break;
    default:
      answers.push(answerInteraction(game, humanId));
  }
  return [...answers, { type: 'SKIP' }];
}

/** Sondes libres et capsules du joueur, avec leur case (« B8 ») */
export function freeProbeCells(game: Game, humanId: string): { probeId: string; cell: string }[] {
  return humanOf(game, humanId).probes
    .filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM || p.state === ProbeState.CAPSULE)
    .map(p => ({ probeId: p.id, cell: `${p.solarPosition.disk}${getAbsoluteSectorForProbe(p.solarPosition, rotationOf(game))}` }));
}

/** Cases voisines d'une case (un pas ; sortir d'un champ d'astéroïdes coûte 2 déplacements) */
export function neighbourCells(game: Game, cell: string): string[] {
  const reachable = calculateReachableCells(cell[0] as never, Number(cell.slice(1)) as never, 2, rotationOf(game), false, undefined, game.board.solarSystem.extraCelestialObjects);
  return [...reachable.entries()].filter(([, value]) => value.path.length === 2).map(([key]) => key);
}
