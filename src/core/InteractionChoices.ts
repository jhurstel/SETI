import { DiskName, Game, HistoryEntry, InteractionState, LifeTraceLocation, LifeTraceType, SectorNumber, Technology, TechnologyCategory } from './types';
import { GameEngine } from './Game';
import { MoveProbeAction } from '../actions/MoveProbeAction';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { CardSystem } from '../systems/CardSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ScoreManager } from './ScoreManager';
import { uniqueId } from './ids';
import { cloneGame } from './cloneGame';
import { privateText } from './historyText';
import { requirePlayer } from './players';

/** Résultat d'un choix fait sur une interaction en attente. */
export interface ChoiceResult {
  updatedGame: Game;
  historyEntries: HistoryEntry[];
  newPendingInteractions: InteractionState[];
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
   * un indicateur `isSpeciesDiscovered` resté actif ne compte pas) et l'ajoute à l'historique (la session en tire l'annonce).
   */
  static noteDiscovery(before: Game, result: ChoiceResult, playerId: string, sequenceId: string): ChoiceResult {
    const updatedGame = result.updatedGame;
    if (updatedGame === before) return result;
    const discovered = updatedGame.board.alienBoards.some((board, i) => board.isDiscovered && !before.board.alienBoards[i]?.isDiscovered);
    updatedGame.isSpeciesDiscovered = false;
    if (!discovered) return result;
    return {
      ...result,
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
    const name = cardId === 'deck' ? privateText(playerId, `"${drawnCard.name}"`) : `"${drawnCard.name}"`;
    return {
      updatedGame,
      historyEntries: [{ message: `acquiert la carte Alien ${name} ${cardId === 'deck' ? 'de la pioche' : 'de la rangée'}`, playerId, sequenceId }],
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
    const player = requirePlayer(game, playerId);
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
      if (!check.canAssign) return refused(game, check.reason);
    } else if (tech.type === TechnologyCategory.COMPUTING && freeColumns.length > 0) {
      return refused(game, "Choisissez une colonne de l'ordinateur");
    }

    const res = TechnologySystem.acquireTechnology(game, playerId, tech, computerCol, interaction.noTileBonus ?? false);
    return {
      updatedGame: res.updatedGame,
      historyEntries: res.historyEntries.map(e => ({ ...e, sequenceId: e.sequenceId || sequenceId })),
      newPendingInteractions: [],
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
    const res = interaction.type === 'ORBITING_PROBE'
      ? ProbeSystem.orbitProbe(game, playerId, found.probe.id, planetId, sequenceId, true, interaction.source)
      : ProbeSystem.landProbe(game, playerId, found.probe.id, planetId, true, slotIndex, interaction.source, sequenceId);
    return {
      updatedGame: res.updatedGame,
      historyEntries: res.historyEntries,
      newPendingInteractions: res.newPendingInteractions,
      nextInteraction: interaction.count > 1 ? { ...interaction, count: interaction.count - 1, sequenceId } : undefined,
    };
  }

  /**
   * Une sonde ne sert qu'une fois pour les signaux « secteur d'une sonde » d'une même action :
   * après un scan qui l'a utilisée, les scans suivants de la séquence la notent comme prise.
   */
  static markProbeUsed(queue: InteractionState[], scan: Interaction<'SELECTING_SCAN_SECTOR'>, probeId: string): InteractionState[] {
    const usedProbeIds = [...(scan.usedProbeIds || []), probeId];
    return queue.map(i => i.type === 'SELECTING_SCAN_SECTOR' && i.sequenceId === scan.sequenceId ? { ...i, usedProbeIds } : i);
  }

  /**
   * Carte gagnée ou achetée (ACQUIRING_CARD) : `cardId` de la rangée, ou la pioche (absent).
   * S'il reste des cartes à prendre, la même interaction suit (nextInteraction).
   */
  static acquireCard(game: Game, playerId: string, interaction: Interaction<'ACQUIRING_CARD'>, cardId?: string): ChoiceResult {
    const res = CardSystem.acquireCard(game, playerId, cardId, { isFree: interaction.isFree, triggerFreeAction: interaction.triggerFreeAction }, interaction.sequenceId);
    if (res.error) return refused(game, res.error);
    return {
      updatedGame: res.updatedGame,
      historyEntries: res.historyEntries,
      newPendingInteractions: res.newPendingInteractions,
      nextInteraction: interaction.count > 1 ? { ...interaction, count: interaction.count - 1 } : undefined,
    };
  }

  /** Carte de la rangée choisie pour un signal (SELECTING_SCAN_CARD) : elle est défaussée, puis le secteur de sa couleur est à choisir. */
  static selectScanCard(game: Game, interaction: Interaction<'SELECTING_SCAN_CARD'>, cardId: string): ChoiceResult {
    const { updatedGame, discardedCard } = CardSystem.discardFromRow(game, cardId);
    if (!discardedCard) return refused(game, 'Carte absente de la rangée');
    return {
      updatedGame,
      historyEntries: [],
      newPendingInteractions: [{
        type: 'SELECTING_SCAN_SECTOR',
        color: discardedCard.scanSector,
        sequenceId: interaction.sequenceId,
        cardId: discardedCard.id,
        cardProcessed: true,
        message: `utilise carte "${discardedCard.name}" (${discardedCard.scanSector}) de la rangée`,
      }],
    };
  }

  /** Cartes de la main réservées (RESERVING_CARD) ; s'il en reste à réserver, la même interaction suit. */
  static reserveCards(game: Game, playerId: string, interaction: Interaction<'RESERVING_CARD'>, cardIds: string[]): ChoiceResult {
    if (cardIds.length === 0 || cardIds.length > interaction.count) return refused(game, `Sélectionnez jusqu'à ${interaction.count} carte${interaction.count > 1 ? 's' : ''}`);
    const res = CardSystem.reserveCards(game, playerId, cardIds, interaction.sequenceId);
    const remaining = interaction.count - cardIds.length;
    return {
      updatedGame: res.updatedGame,
      historyEntries: res.historyEntries,
      newPendingInteractions: [],
      nextInteraction: remaining > 0 ? { type: 'RESERVING_CARD', count: remaining, selectedCards: [], sequenceId: interaction.sequenceId } : undefined,
    };
  }

  /**
   * ET.15 (DISCARDING_DRAWN_CARD) : une des cartes piochées défaussée pour son action gratuite, puis une autre pour
   * la ressource de son revenu (nextInteraction, s'il en reste en main).
   */
  static discardDrawnCard(game: Game, playerId: string, interaction: Interaction<'DISCARDING_DRAWN_CARD'>, cardId: string): ChoiceResult {
    const hand = game.players.find(p => p.id === playerId)?.cards || [];
    if (!interaction.cardIds.includes(cardId) || !hand.some(c => c.id === cardId)) return refused(game, 'Choisissez une des cartes piochées');
    const sequenceId = interaction.sequenceId || `discard-drawn-${uniqueId()}`;
    const res = interaction.step === 'FREE_ACTION'
      ? CardSystem.discardCardForFreeAction(game, playerId, cardId)
      : CardSystem.discardCardForRevenue(game, playerId, cardId, sequenceId);
    if (res.updatedGame === game) return refused(game, 'Cette carte ne peut pas être défaussée');
    const rest = interaction.cardIds.filter(id => id !== cardId && hand.some(c => c.id === id));
    return {
      updatedGame: res.updatedGame,
      historyEntries: res.historyEntries.map(e => ({ ...e, sequenceId })),
      newPendingInteractions: res.newPendingInteractions,
      nextInteraction: interaction.step === 'FREE_ACTION' && rest.length > 0 ? { ...interaction, cardIds: rest, step: 'REVENUE', sequenceId } : undefined,
    };
  }

  /** Cartes de la main défaussées pour marquer un signal dans le secteur de leur couleur (DISCARDING_FOR_SIGNAL). */
  static discardForSignals(game: Game, playerId: string, interaction: Interaction<'DISCARDING_FOR_SIGNAL'>, cardIds: string[]): ChoiceResult {
    if (cardIds.length > interaction.count) return refused(game, `Défaussez au plus ${interaction.count} carte${interaction.count > 1 ? 's' : ''}`);
    const res = CardSystem.discardForSignals(game, playerId, cardIds, interaction.sequenceId);
    return { updatedGame: game, historyEntries: res.historyEntries, newPendingInteractions: res.newPendingInteractions };
  }

  /** Média ou déplacement (carte 19, case à microphone) ; les déplacements restants suivent (nextInteraction). */
  static chooseMediaOrMove(game: Game, playerId: string, interaction: Interaction<'CHOOSING_MEDIA_OR_MOVE'>, choice: 'MEDIA' | 'MOVE'): ChoiceResult {
    const res = ProbeSystem.chooseMediaOrMove(game, playerId, choice, interaction.remainingMoves || 0, interaction.sequenceId);
    return { updatedGame: res.updatedGame, historyEntries: res.historyEntries, newPendingInteractions: [], nextInteraction: res.nextInteraction };
  }

  /**
   * Un pas de sonde (ou de capsule) vers une case voisine : déplacements gratuits en cours (`moving`) d'abord, puis énergie.
   * Les déplacements gratuits restants suivent (nextInteraction), sauf si le choix Média / déplacement de la carte 19
   * interrompt le déplacement (il les reprend lui-même).
   */
  static moveProbe(game: Game, playerId: string, moving: Interaction<'MOVING_PROBE'> | undefined, probeId: string, disk: DiskName, sector: SectorNumber, sequenceId: string): ChoiceResult {
    const free = moving?.count ?? 0;
    const used = ProbeSystem.freeMovementsUsed(game, playerId, probeId, free);
    const action = new MoveProbeAction(playerId, probeId, { disk, sector }, free, sequenceId);
    const result = new GameEngine(game).executeAction(action);
    if (!result.success || !result.updatedState) return refused(game, result.error || 'Déplacement impossible');
    const interrupted = action.newPendingInteractions.some(i => i.type === 'CHOOSING_MEDIA_OR_MOVE');
    return {
      updatedGame: result.updatedState,
      historyEntries: action.historyEntries,
      newPendingInteractions: action.newPendingInteractions,
      nextInteraction: moving && !interrupted && free - used > 0 ? { ...moving, count: free - used } : undefined,
    };
  }

  /** Planètes où le joueur peut prélever ou consulter un spécimen Mascamite pour cette interaction */
  static specimenPlanets(game: Game, playerId: string, interaction: Interaction<'COLLECTING_SPECIMEN'> | Interaction<'CONSULTING_SPECIMEN'>): string[] {
    return interaction.type === 'COLLECTING_SPECIMEN' ? [interaction.planetId] : SpeciesSystem.consultablePlanets(game, playerId, interaction);
  }

  /**
   * Spécimen Mascamite prélevé (capsule) ou consulté sur une planète autorisée.
   * Plus de jeton sur la planète : rien ne se passe, l'interaction se termine.
   */
  static takeSpecimen(game: Game, playerId: string, interaction: Interaction<'COLLECTING_SPECIMEN'> | Interaction<'CONSULTING_SPECIMEN'>, planetId: string, tokenIndex: number): ChoiceResult {
    if (!this.specimenPlanets(game, playerId, interaction).includes(planetId)) return refused(game, 'Planète non autorisée pour ce spécimen');
    const sequenceId = interaction.sequenceId || `mascamite-${uniqueId()}`;
    const mode = interaction.type === 'CONSULTING_SPECIMEN' ? 'consult' : 'collect';
    const res = SpeciesSystem.takeMascamiteSpecimen(game, playerId, planetId, tokenIndex, mode, sequenceId);
    if (!res) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
    return res;
  }

  /** Retrait d'un orbiteur (carte 15) ou d'un atterrisseur (carte 84) du joueur : celui de l'emplacement choisi, sinon le premier sur la planète. */
  static removeProbe(game: Game, playerId: string, interaction: Interaction<'REMOVING_ORBITER'> | Interaction<'REMOVING_LANDER'>, planetId: string, slotIndex?: number): ChoiceResult {
    const planet = game.board.planets.find(p => p.id === planetId);
    const probes = interaction.type === 'REMOVING_ORBITER' ? planet?.orbiters : planet?.landers;
    const index = slotIndex ?? probes?.findIndex(p => p.ownerId === playerId) ?? -1;
    if (!probes || index === -1 || probes[index]?.ownerId !== playerId) return refused(game, 'Aucune de vos sondes à retirer ici');
    return interaction.type === 'REMOVING_ORBITER'
      ? ProbeSystem.removeOrbiter(game, playerId, planetId, index, interaction.sequenceId)
      : ProbeSystem.removeLander(game, playerId, planetId, index, interaction.sequenceId);
  }

  /** Carte Exertien jouée à un palier (cardId absent : le joueur renonce). */
  static playExertienCard(game: Game, playerId: string, interaction: Interaction<'CHOOSING_EXERTIEN_CARD'>, cardId?: string): ChoiceResult {
    const res = SpeciesSystem.playExertienCard(game, playerId, interaction.milestone, cardId);
    if (res.error) return refused(game, res.error);
    return { updatedGame: res.updatedGame, historyEntries: res.historyEntries, newPendingInteractions: [] };
  }

  /**
   * Mission déclenchée hors du tour du joueur : le cercle choisi parmi `options` est recouvert (validation
   * automatique, CLAIMING_MISSION_REQUIREMENT) ; sans choix, le joueur y renonce et les cercles proposés ne sont plus réalisables.
   */
  static chooseMissionRequirement(game: Game, playerId: string, interaction: Interaction<'CHOOSING_MISSION_REQUIREMENT'>, missionId?: string, requirementId?: string): ChoiceResult {
    if (missionId === undefined) {
      const updatedGame = cloneGame(game);
      const player = updatedGame.players.find(p => p.id === playerId)!;
      player.missions.forEach(mission => {
        mission.fulfillableRequirementIds = mission.fulfillableRequirementIds
          .filter(id => !interaction.options.some(o => o.missionId === mission.id && o.requirementId === id));
      });
      return { updatedGame, historyEntries: [{ message: 'ne recouvre pas de cercle de mission', playerId, sequenceId: interaction.sequenceId || '' }], newPendingInteractions: [] };
    }
    if (!interaction.options.some(o => o.missionId === missionId && o.requirementId === requirementId)) {
      return refused(game, "Ce cercle de mission n'a pas été déclenché");
    }
    const sequenceId = interaction.sequenceId || `mission-claim-${uniqueId()}`;
    return { updatedGame: game, historyEntries: [], newPendingInteractions: [{ type: 'CLAIMING_MISSION_REQUIREMENT', missionId, requirementId: requirementId!, playerId, sequenceId }] };
  }

  /** Technologie Observation II acceptée (ou refusée : rien ne change). */
  static observation2(game: Game, playerId: string, interaction: Interaction<'CHOOSING_OBS2_ACTION'>, accepted: boolean): ChoiceResult {
    if (!accepted) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
    const res = ScanSystem.applyObservation2(game, playerId, interaction.sequenceId || `obs2-${uniqueId()}`);
    if (res.error) return refused(game, res.error);
    return res;
  }

  /**
   * Technologie Observation III acceptée : défausser 1 carte de la main pour marquer un signal dans le secteur
   * de sa couleur (DISCARDING_FOR_SIGNAL, puis discardForSignals) ; refusée : rien ne change.
   */
  static observation3(game: Game, interaction: Interaction<'CHOOSING_OBS3_ACTION'>, accepted: boolean): ChoiceResult {
    if (!accepted) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
    const sequenceId = interaction.sequenceId || `obs3-${uniqueId()}`;
    return { updatedGame: game, historyEntries: [], newPendingInteractions: [{ type: 'DISCARDING_FOR_SIGNAL', count: 1, selectedCards: [], sequenceId }] };
  }

  /** Technologie Observation IV : lancer une sonde ou gagner un déplacement. */
  static observation4(game: Game, playerId: string, interaction: Interaction<'CHOOSING_OBS4_ACTION'>, choice: 'PROBE' | 'MOVE'): ChoiceResult {
    const res = ScanSystem.applyObservation4(game, playerId, choice, interaction.sequenceId || `obs4-${uniqueId()}`);
    if (res.error) return refused(game, res.error);
    return res;
  }
}
