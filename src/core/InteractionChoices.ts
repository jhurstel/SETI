import { Game, HistoryEntry, InteractionState, LifeTraceLocation, LifeTraceType, Technology, TechnologyCategory } from './types';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScoreManager } from './ScoreManager';
import { uniqueId } from './ids';

/** Résultat d'un choix fait sur une interaction en attente. */
export interface ChoiceResult {
  updatedGame: Game;
  historyEntries: HistoryEntry[];
  newPendingInteractions: InteractionState[];
  /** Le choix a fait découvrir une espèce (l'interface affiche une notification) */
  discoveredSpecies?: boolean;
  /** Même interaction à poursuivre (placements ou déplacements restants), après les interactions déclenchées */
  nextInteraction?: InteractionState;
  error?: string;
}

type Interaction<T extends InteractionState['type']> = Extract<InteractionState, { type: T }>;

const refused = (game: Game, error: string): ChoiceResult => ({ updatedGame: game, historyEntries: [], newPendingInteractions: [], error });

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

  /**
   * Technologie choisie pour un gain (ACQUIRING_TECH) ou après le choix de la colonne d'ordinateur
   * (SELECTING_COMPUTER_SLOT). La technologie doit faire partie de TechnologySystem.acquirableTechs ;
   * une technologie Informatique demande d'abord une colonne (interaction SELECTING_COMPUTER_SLOT renvoyée)
   * si le joueur en a une de libre. Le renoncement au bonus de tuile (noTileBonus) suit l'interaction.
   */
  static acquireTech(
    game: Game,
    playerId: string,
    interaction: Interaction<'ACQUIRING_TECH'> | Interaction<'SELECTING_COMPUTER_SLOT'>,
    tech: Technology,
    computerCol?: number,
  ): ChoiceResult {
    const sequenceId = interaction.sequenceId || `tech-${uniqueId()}`;
    const player = game.players.find(p => p.id === playerId);
    if (!player) return refused(game, 'Joueur introuvable');
    const freeColumns = ComputerSystem.TECH_COLUMNS.filter(col => ComputerSystem.canAssignTechnology(player, col).canAssign);

    if (interaction.type === 'ACQUIRING_TECH') {
      const allowed = TechnologySystem.acquirableTechs(game, playerId, { categories: interaction.categories, sharedOnly: interaction.sharedOnly });
      if (!allowed.some(t => t.id === tech.id)) return refused(game, 'Cette technologie ne peut pas être prise pour ce gain');
      if (tech.type === TechnologyCategory.COMPUTING && computerCol === undefined && freeColumns.length > 0) {
        return { updatedGame: game, historyEntries: [], newPendingInteractions: [{ type: 'SELECTING_COMPUTER_SLOT', tech, noTileBonus: interaction.noTileBonus, sequenceId }] };
      }
    }
    if (tech.type === TechnologyCategory.COMPUTING && computerCol !== undefined) {
      const check = ComputerSystem.canAssignTechnology(player, computerCol);
      if (!check.canAssign) return refused(game, check.reason || 'Colonne indisponible');
    } else if (tech.type === TechnologyCategory.COMPUTING && freeColumns.length > 0) {
      return refused(game, "Choisissez une colonne de l'ordinateur");
    }

    const res = TechnologySystem.acquireTechnology(game, playerId, tech, computerCol, interaction.noTileBonus ?? false);
    return {
      updatedGame: res.updatedGame,
      historyEntries: res.historyEntries.map(e => ({ ...e, sequenceId: e.sequenceId || sequenceId })),
      newPendingInteractions: (res.newPendingInteractions || []).map(i => ({ ...i, sequenceId: i.sequenceId || sequenceId })),
    };
  }

  /** Tuile Message Centaurienne choisie : elle résout le palier qui a déclenché l'interaction (markerId). */
  static claimCentaurienReward(game: Game, playerId: string, interaction: Interaction<'CHOOSING_CENTAURIEN_REWARD'>, tokenIndex: number): ChoiceResult {
    const res = SpeciesSystem.claimCentaurienReward(game, playerId, tokenIndex, interaction.markerId);
    if (res.updatedGame === game) return refused(game, 'Tuile Message indisponible');
    return { updatedGame: res.updatedGame, historyEntries: res.historyEntries, newPendingInteractions: res.newPendingInteractions };
  }

  /**
   * Choix dans le menu des actions bonus : l'action choisie devient active ; le menu, mis à jour, revient
   * ensuite tant qu'il reste des actions (sauf pour une mission : ses conditions ne sont pas imposées
   * toutes d'un coup).
   */
  static chooseBonusAction(interaction: Interaction<'CHOOSING_BONUS_ACTION'>, choiceIndex: number): { next: InteractionState; menu?: InteractionState } | null {
    const choice = interaction.choices[choiceIndex];
    if (!choice || choice.done) return null;
    const choices = interaction.choices.map((c, i) => i === choiceIndex ? { ...c, done: true } : c);
    const keepMenu = choice.state.type !== 'CLAIMING_MISSION_REQUIREMENT' && choices.some(c => !c.done);
    return { next: choice.state, menu: keepMenu ? { ...interaction, choices } : undefined };
  }

  /**
   * Orbite ou atterrissage gratuit (gain d'une carte ou d'un bonus) avec la sonde du joueur sur la planète.
   * S'il reste des placements (count > 1), la même interaction est à poursuivre (nextInteraction).
   */
  static placeBonusProbe(game: Game, playerId: string, interaction: Interaction<'ORBITING_PROBE'> | Interaction<'LANDING_PROBE'>, planetId: string, slotIndex?: number): ChoiceResult {
    const found = ProbeSystem.findProbeAtPlanet(game, playerId, planetId);
    if (!found) return refused(game, 'Aucune de vos sondes sur cette planète');
    const sequenceId = interaction.sequenceId || `seq-${uniqueId()}`;
    try {
      const res = interaction.type === 'ORBITING_PROBE'
        ? ProbeSystem.orbitProbe(game, playerId, found.probe.id, planetId, sequenceId, true, interaction.source)
        : ProbeSystem.landProbe(game, playerId, found.probe.id, planetId, true, slotIndex, interaction.source, sequenceId);
      return {
        updatedGame: res.updatedGame,
        historyEntries: res.historyEntries,
        newPendingInteractions: res.newPendingInteractions,
        nextInteraction: interaction.count > 1 ? { ...interaction, count: interaction.count - 1, sequenceId } : undefined,
      };
    } catch (error) {
      return refused(game, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Une sonde ne sert qu'une fois pour les signaux « secteur d'une sonde » d'une même action :
   * après un scan qui l'a utilisée, les scans suivants de la séquence la notent comme prise.
   */
  static markProbeUsed(queue: InteractionState[], scan: Interaction<'SELECTING_SCAN_SECTOR'>, probeId: string): InteractionState[] {
    const usedProbeIds = [...(scan.usedProbeIds || []), probeId];
    return queue.map(i => i.type === 'SELECTING_SCAN_SECTOR' && i.sequenceId === scan.sequenceId ? { ...i, usedProbeIds } : i);
  }
}
