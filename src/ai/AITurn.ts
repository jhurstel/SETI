import { Game, Player, ActionType, GamePhase, RevenueType, FreeActionType, ProbeState, DiskName, SectorNumber, LifeTraceType, LifeTraceLocation, HistoryEntry, InteractionState } from '../core/types';
import { GameEngine } from '../core/Game';
import { cloneGame } from '../core/cloneGame';
import { TurnManager } from '../core/TurnManager';
import { createRotationState, getAbsoluteSectorForProbe, calculateReachableCellsWithEnergy } from '../core/SolarSystemPosition';
import { BaseAction } from '../actions/Action';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { ScanSectorAction } from '../actions/ScanSectorAction';
import { AnalyzeDataAction } from '../actions/AnalyzeDataAction';
import { ResearchTechAction } from '../actions/ResearchTechAction';
import { PlayCardAction } from '../actions/PlayCardAction';
import { OrbitAction } from '../actions/OrbitAction';
import { LandAction } from '../actions/LandAction';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { AIBehavior } from './AIBehavior';
import { AIController } from './AIController';

/**
 * Résultat d'une étape de jeu d'un robot.
 * - WAIT : rien à faire (l'IA attend)
 * - SETUP_RESERVED : carte réservée pendant la mise en place → passer au joueur suivant du SETUP
 * - UPDATED : une action (gratuite ou principale) a été jouée, le robot continue son tour
 * - END_TURN : le robot a fini son tour
 * - PASS : le robot passe pour la manche (à exécuter via PassAction)
 */
export type AIStep =
  | { kind: 'WAIT' }
  | { kind: 'SETUP_RESERVED'; updatedGame: Game; historyEntries: HistoryEntry[] }
  | { kind: 'UPDATED'; updatedGame: Game; historyEntries: HistoryEntry[] }
  | { kind: 'END_TURN' }
  | { kind: 'PASS'; cardsToKeep: string[] };

type StepResult = { updatedGame: Game; historyEntries: HistoryEntry[] };

/**
 * Tour d'un robot, sans dépendance à React : une étape à la fois
 * (réservation de mise en place, action gratuite, action principale ou fin de tour).
 */
export class AITurn {
  static playStep(game: Game): AIStep {
    const player = game.players[game.currentPlayerIndex];

    if (game.phase === GamePhase.SETUP) {
      return this.reserveForSetup(game, player);
    }

    // Actions gratuites (avant ou après l'action principale)
    const freeAction = this.tryFreeAction(game, player);
    if (freeAction) return { kind: 'UPDATED', ...freeAction };

    if (player.hasPerformedMainAction) return { kind: 'END_TURN' };

    const decision = AIBehavior.decideAction(game, player, 'EASY');
    if (decision.action === ActionType.PASS) {
      return { kind: 'PASS', cardsToKeep: decision.data.cardsToKeep };
    }

    const result = this.playMainAction(game, player, decision);
    if (!result) {
      // Action refusée par le moteur : le robot termine son tour plutôt que de bloquer la partie
      console.warn(`[AI] ${player.name} : action ${decision.action} refusée, fin de tour`);
      return { kind: 'END_TURN' };
    }
    return { kind: 'UPDATED', ...result };
  }

  /**
   * Fin de tour d'un robot : les choix liés aux paliers de score (marqueur d'objectif,
   * récompense centaurienne…) sont résolus par l'IA au lieu d'être confiés à l'interface.
   */
  static endTurn(game: Game): { updatedGame: Game; historyEntries: HistoryEntry[]; discoveryNotification?: { message: string } } {
    const player = game.players[game.currentPlayerIndex];
    const historyEntries: HistoryEntry[] = [];
    let discoveryNotification: { message: string } | undefined;
    let current = game;

    // Garde-fou : une interaction que l'IA ne sait pas résoudre ne doit pas bloquer la partie
    for (let attempt = 0; attempt < 5; attempt++) {
      const turn = TurnManager.finishTurn(current);
      historyEntries.push(...turn.milestoneEntries, ...turn.turnEntries);
      discoveryNotification = turn.discoveryNotification ?? discoveryNotification;
      if (turn.turnEnded || !turn.pendingInteraction) {
        return { updatedGame: turn.updatedGame, historyEntries, discoveryNotification };
      }
      const res = AIController.processInteractionQueue(turn.updatedGame, [turn.pendingInteraction], `ai-milestone-${Date.now()}`, player);
      historyEntries.push(...res.historyEntries);
      current = res.updatedGame;
    }

    console.warn(`[AI] ${player.name} : palier non résolu, passage forcé au joueur suivant`);
    const updatedGame = TurnManager.nextPlayer(current);
    const next = updatedGame.players[updatedGame.currentPlayerIndex];
    historyEntries.push({ message: `--- Tour de ${next.name} ---`, playerId: next.id });
    return { updatedGame, historyEntries, discoveryNotification };
  }

  private static reserveForSetup(game: Game, player: Player): AIStep {
    const cardId = AIBehavior.decideReservation(game, player);
    if (!cardId) return { kind: 'WAIT' };

    const card = player.cards.find(c => c.id === cardId)!;
    const gain = card.revenue === RevenueType.CREDIT ? '1 Crédit'
      : card.revenue === RevenueType.ENERGY ? '1 Énergie'
      : card.revenue === RevenueType.CARD ? '1 Carte' : '';
    return {
      kind: 'SETUP_RESERVED',
      updatedGame: CardSystem.reserveCard(game, player.id, cardId),
      historyEntries: [{ message: `réserve carte "${card.name}" et gagne ${gain}`, playerId: player.id }],
    };
  }

  /** Exécute une action principale via le moteur, puis résout automatiquement les interactions qu'elle déclenche. */
  private static playMainAction(game: Game, player: Player, decision: ReturnType<typeof AIBehavior.decideAction>): StepResult | null {
    let action: BaseAction;
    switch (decision.action) {
      case ActionType.LAUNCH_PROBE: action = new LaunchProbeAction(player.id); break;
      case ActionType.SCAN_SECTOR: action = new ScanSectorAction(player.id); break;
      case ActionType.ANALYZE_DATA: action = new AnalyzeDataAction(player.id); break;
      case ActionType.RESEARCH_TECH: action = new ResearchTechAction(player.id); break;
      case ActionType.PLAY_CARD: action = new PlayCardAction(player.id, decision.data.cardId); break;
      case ActionType.ORBIT: action = new OrbitAction(player.id, decision.data.probeId, decision.data.planetId); break;
      case ActionType.LAND: action = new LandAction(player.id, decision.data.probeId, decision.data.planetId); break;
      default: return null;
    }

    const result = new GameEngine(game).executeAction(action);
    if (!result.success || !result.updatedState) return null;

    let updatedGame = result.updatedState;
    const sequenceId = `ai-${decision.action.toLowerCase()}-${Date.now()}`;
    const historyEntries: HistoryEntry[] = action.historyEntries.map(e => ({ ...e, sequenceId: e.sequenceId || sequenceId }));
    let pending: InteractionState[] = action.newPendingInteractions;

    if (decision.action === ActionType.ANALYZE_DATA) {
      // L'analyse place une trace de vie bleue
      historyEntries.push({ message: `paye ${ResourceSystem.formatResource(1, 'ENERGY')} pour <strong>Analyser les données</strong>`, playerId: player.id, sequenceId });
      const location = Math.random() < 0.5 ? LifeTraceLocation.TRIANGLE : LifeTraceLocation.SPECIES;
      const slotIndex = location === LifeTraceLocation.SPECIES ? SpeciesSystem.getNextSpeciesSlotIndex(updatedGame, 0, LifeTraceType.BLUE, location) : undefined;
      const trace = SpeciesSystem.placeLifeTrace(updatedGame, 0, LifeTraceType.BLUE, player.id, sequenceId, location, slotIndex);
      updatedGame = trace.updatedGame;
      historyEntries.push(...trace.historyEntries);
      if (updatedGame.isSpeciesDiscovered) {
        historyEntries.push({ message: 'découvre une nouvelle espèce Alien !', playerId: player.id, sequenceId });
        updatedGame.isSpeciesDiscovered = false;
      }
      pending = trace.newPendingInteractions;
    } else if (decision.action === ActionType.RESEARCH_TECH) {
      // La technologie est choisie par l'IA : l'interaction ACQUIRING_TECH de l'action n'est pas utilisée
      const tech = TechnologySystem.acquireTechnology(updatedGame, player.id, decision.data.tech);
      updatedGame = tech.updatedGame;
      historyEntries.push(...tech.historyEntries);
      pending = tech.newPendingInteractions || [];
    }

    return this.resolvePending(updatedGame, player, historyEntries, pending, sequenceId);
  }

  private static resolvePending(game: Game, player: Player, historyEntries: HistoryEntry[], pending: InteractionState[], sequenceId: string): StepResult {
    if (pending.length === 0) return { updatedGame: game, historyEntries };
    const res = AIController.processInteractionQueue(game, pending, sequenceId, player);
    return { updatedGame: res.updatedGame, historyEntries: [...historyEntries, ...res.historyEntries] };
  }

  /** Tente une action gratuite (avec une part d'aléatoire). Renvoie null si aucune n'est jouée. */
  private static tryFreeAction(game: Game, player: Player): StepResult | null {
    return this.tryClaimMission(game, player)
      ?? this.tryTransferData(game, player)
      ?? this.tryBuyCard(game, player)
      ?? this.tryDiscardForFreeAction(game, player);
  }

  private static tryClaimMission(game: Game, player: Player): StepResult | null {
    if (!player.missions || Math.random() >= 0.4) return null;

    for (const mission of player.missions) {
      if (mission.completed) continue;
      for (const req of mission.requirements) {
        if (!req.id || (mission.completedRequirementIds || []).includes(req.id)) continue;
        if (!req.type.startsWith('GAIN_IF_')) continue;

        const bonus = CardSystem.evaluateMission(game, player.id, req.value);
        if (!bonus) continue;

        const updatedGame = cloneGame(game);
        const m = updatedGame.players.find(p => p.id === player.id)?.missions.find(x => x.id === mission.id);
        if (!m) return null;
        m.completedRequirementIds.push(req.id);
        if (m.completedRequirementIds.length >= m.requirements.length) m.completed = true;

        const sequenceId = `ai-mission-${Date.now()}`;
        const res = ResourceSystem.processBonuses(bonus, updatedGame, player.id, 'mission-claim', sequenceId);
        const actionText = m.completed ? 'accomplit' : 'valide un objectif de';
        const historyEntries: HistoryEntry[] = [
          { message: `${actionText} la mission "${m.name}" ${res.logs.length > 0 ? ' et ' + res.logs.join(', ') : ''}`, playerId: player.id, sequenceId },
          ...res.historyEntries.map(e => ({ ...e, sequenceId })),
        ];
        // Les interactions déclenchées sont résolues par l'IA (et non confiées à l'interface du joueur humain)
        return this.resolvePending(res.updatedGame, player, historyEntries, res.newPendingInteractions, sequenceId);
      }
    }
    return null;
  }

  private static tryTransferData(game: Game, player: Player): StepResult | null {
    if (player.data <= 0 || Math.random() >= 0.4) return null;

    const slotId = Object.keys(player.dataComputer.slots).find(id => ComputerSystem.canFillSlot(player, id));
    if (!slotId) return null;

    const { updatedGame, gains, bonusEffects } = ComputerSystem.fillSlot(game, player.id, slotId);
    let aiGame = updatedGame;
    bonusEffects.forEach(effect => {
      if (effect.type === 'card') {
        aiGame = CardSystem.drawCards(aiGame, player.id, effect.amount);
      } else if (effect.type === 'reservation') {
        const row = aiGame.decks.cardRow;
        if (row.length > 0) {
          aiGame = CardSystem.reserveCard(aiGame, player.id, row[Math.floor(Math.random() * row.length)].id);
        }
      }
    });

    const gainText = gains.length > 0 ? ` et gagne ${gains.join(', ')}` : '';
    return {
      updatedGame: aiGame,
      historyEntries: [{ message: `transfère 1 donnée vers l'ordinateur ${gainText}`, playerId: player.id, sequenceId: `ai-computer-${Date.now()}` }],
    };
  }

  private static tryBuyCard(game: Game, player: Player): StepResult | null {
    if (player.mediaCoverage < 3 || Math.random() >= 0.1) return null;
    const row = game.decks.cardRow;
    if (row.length === 0) return null;

    const card = row[Math.floor(Math.random() * row.length)];
    const res = CardSystem.buyCard(game, player.id, card.id, false);
    if (res.error) return null;
    return { updatedGame: res.updatedGame, historyEntries: [{ message: `achète la carte "${card.name}"`, playerId: player.id }] };
  }

  private static tryDiscardForFreeAction(game: Game, player: Player): StepResult | null {
    const hand = CardSystem.getHandCards(player);
    if (hand.length === 0 || Math.random() >= 0.1) return null;

    const withAction = hand.filter(c => c.freeAction);
    const pool = withAction.length > 0 ? withAction : hand;
    const card = pool[Math.floor(Math.random() * pool.length)];
    if (!card.freeAction) return null;

    const sequenceId = `ai-free-action-${Date.now()}`;
    let updatedGame = game;
    let logMsg = '';

    if (card.freeAction === FreeActionType.MEDIA) {
      updatedGame = ResourceSystem.updateMedia(updatedGame, player.id, 1).updatedGame;
      logMsg = 'gagne 1 Média';
    } else if (card.freeAction === FreeActionType.DATA) {
      updatedGame = ResourceSystem.updateData(updatedGame, player.id, 1).updatedGame;
      logMsg = 'gagne 1 Donnée';
    } else if (card.freeAction === FreeActionType.MOVEMENT) {
      const moved = this.moveRandomProbe(updatedGame, player, sequenceId);
      updatedGame = moved ?? updatedGame;
      logMsg = moved ? 'déplace une sonde' : 'gagne 1 déplacement (inutilisé)';
    }

    updatedGame = CardSystem.discardCard(updatedGame, player.id, card.id);
    return { updatedGame, historyEntries: [{ message: `défausse "${card.name}" et ${logMsg}`, playerId: player.id, sequenceId }] };
  }

  /** Déplace une sonde au hasard d'une case (déplacement gratuit). Renvoie null si impossible. */
  private static moveRandomProbe(game: Game, player: Player, sequenceId: string): Game | null {
    const probes = player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition);
    if (probes.length === 0) return null;

    const probe = probes[Math.floor(Math.random() * probes.length)];
    const solarSystem = game.board.solarSystem;
    const rotationState = createRotationState(solarSystem.rotationAngleLevel1 || 0, solarSystem.rotationAngleLevel2 || 0, solarSystem.rotationAngleLevel3 || 0);
    const absSector = getAbsoluteSectorForProbe(probe.solarPosition, rotationState);
    const reachable = calculateReachableCellsWithEnergy(probe.solarPosition.disk, absSector, 1, player.energy, rotationState, false);
    const destinations = Array.from(reachable.keys()).filter(k => k !== `${probe.solarPosition.disk}${absSector}`);
    if (destinations.length === 0) return null;

    const destKey = destinations[Math.floor(Math.random() * destinations.length)];
    return ProbeSystem.moveProbe(game, player.id, probe.id, destKey[0] as DiskName, parseInt(destKey.substring(1)) as SectorNumber, 1, sequenceId).updatedGame;
  }
}
