import { Game, HistoryEntry, InteractionState, LifeTraceLocation, LifeTraceType } from './types';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { ScoreManager } from './ScoreManager';
import { uniqueId } from './ids';

/** Résultat d'un choix fait sur une interaction en attente. */
export interface ChoiceResult {
  updatedGame: Game;
  historyEntries: HistoryEntry[];
  newPendingInteractions: InteractionState[];
  /** Le choix a fait découvrir une espèce (l'interface affiche une notification) */
  discoveredSpecies?: boolean;
  error?: string;
}

type Interaction<T extends InteractionState['type']> = Extract<InteractionState, { type: T }>;

/**
 * Application d'un choix sur une interaction en attente : même implémentation pour le joueur humain
 * (BoardUI, le choix vient d'un clic) et pour les robots (AIController, le choix vient d'une simulation
 * ou d'un tirage). Seul le choix diffère, jamais la règle.
 */
export class InteractionChoices {
  /**
   * Détecte une découverte d'espèce due au choix (comparaison des plateaux Alien avant/après :
   * un indicateur `isSpeciesDiscovered` resté actif ne compte pas) et l'ajoute à l'historique.
   */
  static noteDiscovery(before: Game, result: ChoiceResult, playerId: string, sequenceId: string): ChoiceResult {
    const updatedGame = result.updatedGame;
    if (updatedGame === before) return result;
    const discovered = updatedGame.board.alienBoards.some((board, i) => board.isDiscovered && !before.board.alienBoards[i]?.isDiscovered);
    updatedGame.isSpeciesDiscovered = false;
    if (!discovered) return result;
    return {
      ...result,
      discoveredSpecies: true,
      historyEntries: [...result.historyEntries, { message: 'découvre une nouvelle espèce Alien !', playerId, sequenceId }],
    };
  }

  /** Place une trace de vie sur l'emplacement choisi d'un plateau Alien. */
  static placeLifeTrace(
    game: Game,
    playerId: string,
    interaction: Interaction<'PLACING_LIFE_TRACE'>,
    boardIndex: number,
    color: LifeTraceType,
    slotType: LifeTraceLocation,
    slotIndex?: number,
  ): ChoiceResult {
    if (interaction.color !== LifeTraceType.ANY && interaction.color !== color) {
      return { updatedGame: game, historyEntries: [], newPendingInteractions: [], error: 'Couleur de trace de vie non autorisée' };
    }
    if (interaction.boardIndices && !interaction.boardIndices.includes(boardIndex)) {
      return { updatedGame: game, historyEntries: [], newPendingInteractions: [], error: 'Plateau Alien non autorisé' };
    }
    const sequenceId = interaction.sequenceId || `trace-${uniqueId()}`;
    const placed = SpeciesSystem.placeLifeTrace(game, boardIndex, color, playerId, sequenceId, slotType, slotIndex);
    const result: ChoiceResult = {
      updatedGame: placed.updatedGame,
      historyEntries: placed.historyEntries.map(e => ({ ...e, sequenceId: e.sequenceId || sequenceId })),
      newPendingInteractions: placed.newPendingInteractions.map(i => ({ ...i, sequenceId: i.sequenceId || sequenceId })),
    };
    return this.noteDiscovery(game, result, playerId, sequenceId);
  }

  /** Prend une carte Alien (`cardId` de la rangée de l'espèce, ou 'deck' pour la pioche). */
  static acquireAlienCard(game: Game, playerId: string, interaction: Interaction<'ACQUIRING_ALIEN_CARD'>, cardId: string): ChoiceResult {
    const sequenceId = interaction.sequenceId || `alien-card-${uniqueId()}`;
    const { updatedGame, drawnCard } = SpeciesSystem.acquireAlienCard(game, playerId, interaction.speciesId, cardId);
    if (!drawnCard) {
      return { updatedGame: game, historyEntries: [], newPendingInteractions: [], error: 'Aucune carte Alien disponible' };
    }
    const source = cardId === 'deck' ? 'de la pioche' : 'de la rangée';
    return {
      updatedGame,
      historyEntries: [{ message: `acquiert la carte Alien "${drawnCard.name}" ${source}`, playerId, sequenceId }],
      // Plusieurs cartes à prendre : la même interaction reste en attente pour les suivantes
      newPendingInteractions: interaction.count > 1 ? [{ ...interaction, count: interaction.count - 1, sequenceId }] : [],
    };
  }

  /** Place un marqueur sur une tuile objectif (palier de score). */
  static placeObjectiveMarker(game: Game, playerId: string, interaction: Interaction<'PLACING_OBJECTIVE_MARKER'>, tileId: string): ChoiceResult {
    const sequenceId = interaction.sequenceId || `objective-${uniqueId()}`;
    const result = ScoreManager.placeObjectiveMarker(game, playerId, tileId, interaction.milestone);
    if (!result.success) {
      return { updatedGame: game, historyEntries: [], newPendingInteractions: [], error: result.error || 'Marqueur impossible à placer' };
    }
    return {
      updatedGame: result.updatedGame,
      historyEntries: result.logMessage ? [{ message: result.logMessage, playerId, sequenceId }] : [],
      newPendingInteractions: [],
    };
  }
}
