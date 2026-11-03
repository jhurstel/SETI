import { Game, GamePhase, HistoryEntry, InteractionState } from '../core/types';
import { GameEngine } from '../core/Game';
import { BaseAction } from '../actions/Action';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { ScanSectorAction } from '../actions/ScanSectorAction';
import { AnalyzeDataAction } from '../actions/AnalyzeDataAction';
import { ResearchTechAction } from '../actions/ResearchTechAction';
import { OrbitAction } from '../actions/OrbitAction';
import { LandAction } from '../actions/LandAction';
import { PlayCardAction } from '../actions/PlayCardAction';
import { PassAction } from '../actions/PassAction';
import { InteractionChoices, ChoiceResult } from '../core/InteractionChoices';
import { InteractionResolver, isAutomaticInteraction } from '../core/InteractionResolver';
import { TurnManager } from '../core/TurnManager';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { AIController } from '../ai/AIController';
import { AIStep, AITurn } from '../ai/AITurn';
import { getRandomState, setRandomState } from '../core/random';
import { uniqueId } from '../core/ids';
import { Choice, Command } from './commands';
import { InteractionQueue } from './InteractionQueue';
import { DISCOVERY_NOTICE } from '../systems/SpeciesSystem';

export interface DispatchResult {
  /** La partie après la commande (inchangée si refusée) */
  game: Game;
  /** Entrées d'historique produites, dans l'ordre */
  entries: HistoryEntry[];
  /** Annonces à montrer aux joueurs (découverte d'une espèce…) */
  notifications: string[];
  error?: string;
}

const DISCOVERY_MESSAGE = 'découvre une nouvelle espèce Alien !';
/** Interactions auxquelles le joueur peut renoncer (déplacements gratuits, achat de carte, reste du menu de bonus) */
const SKIPPABLE: InteractionState['type'][] = ['MOVING_PROBE', 'ACQUIRING_CARD', 'CHOOSING_BONUS_ACTION'];
/** Cartes dont les gains se résolvent dans l'ordre de la carte, sans menu de choix */
const FORCE_STACKING_CARDS = ['27', '28', '29', '30'];

type Interaction<T extends InteractionState['type']> = Extract<InteractionState, { type: T }>;

/** Entrées et annonces accumulées pendant une commande */
class Outcome {
  entries: HistoryEntry[] = [];
  notifications: string[] = [];

  /**
   * Ajoute des entrées d'historique. Avec `sequenceId` (résolution d'une interaction, d'un scan…), toutes les entrées
   * sont rattachées à cette séquence, même celles qui en avaient une à elles (sonde lancée par une technologie…) :
   * l'historique les montre sous l'action qui les a provoquées, et l'annulation les traite avec elle.
   */
  add(entries: HistoryEntry[] | undefined, sequenceId?: string): void {
    (entries || []).forEach(e => {
      this.entries.push(sequenceId && !e.message.startsWith('---') ? { ...e, sequenceId } : e);
      if (e.message === DISCOVERY_MESSAGE) this.notify(DISCOVERY_NOTICE);
    });
  }

  notify(message: string | undefined): void {
    if (message && !this.notifications.includes(message)) this.notifications.push(message);
  }
}

class Refusal extends Error {}
const refuse = (message: string): never => { throw new Refusal(message); };

/**
 * Session de jeu : tout ce que les joueurs demandent à la partie passe par `dispatch`, sur un poste comme sur un serveur.
 * Le moteur y vérifie qui joue et ce qui est permis, applique la règle (systems, actions, InteractionChoices), tient la file
 * d'interactions dans l'état (InteractionQueue), résout les interactions automatiques et celles des robots, termine les tours
 * (paliers compris) et rédige l'historique. Fonctions pures : la partie reçue n'est jamais modifiée.
 */
export class GameSession {
  static dispatch(game: Game, playerId: string, command: Command): DispatchResult {
    if (game.rngState !== undefined) setRandomState(game.rngState);
    const outcome = new Outcome();
    try {
      if (game.phase === GamePhase.FINAL_SCORING) refuse('La partie est terminée');
      const applied = this.apply(game, playerId, command, outcome);
      const settled = this.offerTriggeredMissions(game, this.settle(applied, outcome), outcome);
      return { game: { ...settled, rngState: getRandomState() }, entries: outcome.entries, notifications: outcome.notifications };
    } catch (error) {
      if (!(error instanceof Refusal)) console.error('[Session]', error);
      return { game, entries: [], notifications: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Prépare une partie qui vient d'être créée ou chargée : file d'interactions, réservation de mise en place,
   * interactions automatiques en attente. À appeler une fois avant le premier `dispatch`.
   */
  static start(game: Game): DispatchResult {
    const outcome = new Outcome();
    const settled = this.settle({ ...game, pendingInteractions: game.pendingInteractions || [] }, outcome);
    return { game: settled, entries: outcome.entries, notifications: outcome.notifications };
  }

  /** Le robot dont c'est le tour peut jouer : aucune interaction n'attend un joueur humain */
  static robotCanPlay(game: Game): boolean {
    const current = game.players[game.currentPlayerIndex];
    return game.phase !== GamePhase.FINAL_SCORING && current?.type === 'robot' && InteractionQueue.isEmpty(game);
  }

  /**
   * Applique une étape de robot calculée par AITurn (éventuellement dans un Web Worker) : action, fin de tour, passe.
   * Les interactions destinées à un joueur humain entrent dans la file : le robot attend qu'elles soient résolues.
   */
  static applyRobotStep(game: Game, step: AIStep | { kind: 'END_TURN_DONE'; end: ReturnType<typeof AITurn.endTurn> }): DispatchResult {
    const outcome = new Outcome();
    let updated = game;
    try {
      switch (step.kind) {
        case 'WAIT':
        case 'END_TURN':
          return { game, entries: [], notifications: [] };
        case 'SETUP_RESERVED': {
          outcome.add(step.historyEntries);
          const setup = TurnManager.advanceSetup(step.updatedGame);
          outcome.add(setup.historyEntries);
          updated = setup.updatedGame;
          break;
        }
        case 'UPDATED':
          outcome.add(step.historyEntries);
          updated = InteractionQueue.enqueue(step.updatedGame, step.humanInteractions || [], step.historyEntries[0]?.sequenceId);
          break;
        case 'END_TURN_DONE':
          outcome.add(step.end.historyEntries);
          outcome.notify(step.end.discoveryNotification?.message);
          updated = InteractionQueue.enqueue(step.end.updatedGame, step.end.humanInteractions || []);
          break;
        case 'PASS': {
          const player = game.players[game.currentPlayerIndex];
          updated = this.mainAction(game, new PassAction(player.id, step.cardsToKeep), outcome, true);
          break;
        }
      }
      const settled = this.offerTriggeredMissions(game, this.settle(updated, outcome), outcome);
      return { game: { ...settled, rngState: getRandomState() }, entries: outcome.entries, notifications: outcome.notifications };
    } catch (error) {
      return { game, entries: [], notifications: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  // --- Commandes ---

  private static apply(game: Game, playerId: string, command: Command, outcome: Outcome): Game {
    const active = game.interaction;
    if (active) {
      if (InteractionQueue.ownerId(game, active) !== playerId) refuse("Ce n'est pas à vous de jouer");
      if (command.type === 'CHOOSE') return this.choose(game, playerId, active, command.choice, outcome);
      if (command.type === 'SKIP') return this.skip(game, active);
      if (command.type === 'MOVE_PROBE' && active.type === 'MOVING_PROBE') return this.moveProbe(game, playerId, command, outcome);
      refuse("Terminez d'abord l'action en cours");
    }

    const current = game.players[game.currentPlayerIndex];
    if (game.phase !== GamePhase.PLAYING) refuse("La partie n'a pas commencé");
    if (current.id !== playerId) refuse("Ce n'est pas votre tour");
    if (current.hasPassed) refuse('Vous avez déjà passé ce tour');

    switch (command.type) {
      case 'LAUNCH_PROBE':
        return this.mainAction(game, new LaunchProbeAction(playerId), outcome);
      case 'SCAN':
        return this.mainAction(game, new ScanSectorAction(playerId, command.sectorId), outcome);
      case 'ANALYZE':
        return this.mainAction(game, new AnalyzeDataAction(playerId), outcome);
      case 'RESEARCH_TECH': {
        const researched = this.mainAction(game, new ResearchTechAction(playerId), outcome);
        const pick = researched.interaction;
        if (!command.techId || pick?.type !== 'ACQUIRING_TECH') return researched;
        return this.choose(researched, playerId, pick, { kind: 'TECH', techId: command.techId }, outcome);
      }
      case 'ORBIT': {
        const found = ProbeSystem.findProbeAtPlanet(game, playerId, command.planetId) ?? refuse('Aucune de vos sondes sur cette planète');
        return this.mainAction(game, new OrbitAction(playerId, found.probe.id, command.planetId), outcome);
      }
      case 'LAND': {
        const found = ProbeSystem.findProbeAtPlanet(game, playerId, command.planetId) ?? refuse('Aucune de vos sondes sur cette planète');
        return this.mainAction(game, new LandAction(playerId, found.probe.id, command.planetId, command.slotIndex), outcome);
      }
      case 'PLAY_CARD':
        return this.mainAction(game, new PlayCardAction(playerId, command.cardId), outcome, FORCE_STACKING_CARDS.includes(command.cardId));
      case 'PASS':
        return this.mainAction(game, new PassAction(playerId, command.cardsToKeep), outcome, true);
      case 'MOVE_PROBE':
        return this.moveProbe(game, playerId, command, outcome);
      case 'TRADE':
        return this.trade(game, playerId, command, outcome);
      case 'BUY_CARD': {
        if (current.mediaCoverage < 3) refuse('Couverture médiatique insuffisante');
        return InteractionQueue.set(game, { type: 'ACQUIRING_CARD', count: 1, sequenceId: `buy-${uniqueId()}` });
      }
      case 'DISCARD_FOR_FREE_ACTION': {
        const res = CardSystem.discardFromHandForFreeAction(game, playerId, command.cardId);
        if (res.error) refuse(res.error);
        outcome.add(res.historyEntries);
        return InteractionQueue.enqueue(res.updatedGame, res.newPendingInteractions, res.historyEntries[0]?.sequenceId);
      }
      case 'TRANSFER_DATA': {
        if (current.data <= 0 || !ComputerSystem.canFillSlot(current, command.slotId)) refuse('Transfert de donnée impossible sur cette case');
        const res = ComputerSystem.transferData(game, playerId, command.slotId);
        outcome.add(res.historyEntries);
        return InteractionQueue.enqueue(res.updatedGame, res.newPendingInteractions, res.historyEntries[0]?.sequenceId);
      }
      case 'CLAIM_MISSION':
        // Résolue aussitôt par InteractionResolver (interaction automatique), dans `settle`
        return InteractionQueue.set(game, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: command.missionId, requirementId: command.requirementId, sequenceId: `mission-claim-${uniqueId()}` });
      case 'END_TURN':
        return { ...game, endingTurn: true };
      case 'CHOOSE':
      case 'SKIP':
        return refuse('Aucune interaction en cours');
    }
  }

  private static mainAction(game: Game, action: BaseAction, outcome: Outcome, forceStacking = false): Game {
    const result = new GameEngine(game).executeAction(action);
    if (!result.success || !result.updatedState) refuse(result.error || 'Action impossible');
    outcome.add(action.historyEntries);
    return InteractionQueue.enqueue(result.updatedState!, action.newPendingInteractions, action.historyEntries[0]?.sequenceId, undefined, forceStacking);
  }

  /** Un pas de sonde : déplacements gratuits en cours d'abord, puis énergie */
  private static moveProbe(game: Game, playerId: string, command: Extract<Command, { type: 'MOVE_PROBE' }>, outcome: Outcome): Game {
    const moving = game.interaction?.type === 'MOVING_PROBE' ? game.interaction : undefined;
    const sequenceId = moving?.sequenceId || `move-${uniqueId()}`;
    const res = InteractionChoices.moveProbe(game, playerId, moving, command.probeId, command.disk, command.sector, sequenceId);
    if (res.error) refuse(res.error);
    outcome.add(res.historyEntries);

    const updated = InteractionQueue.enqueue(InteractionQueue.clear(res.updatedGame), res.newPendingInteractions, sequenceId);
    return res.nextInteraction ? InteractionQueue.pushFront(updated, res.nextInteraction) : updated;
  }

  private static trade(game: Game, playerId: string, command: Extract<Command, { type: 'TRADE' }>, outcome: Outcome): Game {
    // Carte contre 2 crédits ou 2 énergies : le coût est payé, puis la carte est à choisir (rangée ou pioche)
    if (command.gain === 'card' && (command.spend === 'credit' || command.spend === 'energy')) {
      const res = ResourceSystem.tradeForCard(game, playerId, command.spend);
      if (res.error) refuse(res.error);
      const sequenceId = `trade-${uniqueId()}`;
      outcome.add(res.historyEntries, sequenceId);
      return InteractionQueue.enqueue(res.updatedGame, res.newPendingInteractions, sequenceId);
    }
    const res = ResourceSystem.tradeResources(game, playerId, command.spend, command.gain, command.cardIds);
    if (res.error) refuse(res.error);
    outcome.add(res.historyEntries);
    return res.updatedGame;
  }

  private static skip(game: Game, active: InteractionState): Game {
    if (!SKIPPABLE.includes(active.type) || (active.type === 'ACQUIRING_CARD' && active.isFree)) refuse('Cette action ne peut pas être abandonnée');
    return InteractionQueue.clear(game);
  }

  // --- Choix sur l'interaction en cours ---

  private static choose(game: Game, playerId: string, active: InteractionState, choice: Choice, outcome: Outcome): Game {
    const wrong = (): never => refuse('Choix sans rapport avec l\'action en cours');
    const base = InteractionQueue.clear(game);
    let result: ChoiceResult;

    switch (active.type) {
      case 'PLACING_LIFE_TRACE':
        if (choice.kind !== 'LIFE_TRACE') return wrong();
        result = InteractionChoices.placeLifeTrace(base, playerId, active, choice.boardIndex, choice.color, choice.slotType, choice.slotIndex);
        break;
      case 'ACQUIRING_ALIEN_CARD':
        if (choice.kind !== 'ALIEN_CARD') return wrong();
        result = InteractionChoices.acquireAlienCard(base, playerId, active, choice.cardId);
        break;
      case 'PLACING_OBJECTIVE_MARKER':
        if (choice.kind !== 'OBJECTIVE') return wrong();
        result = InteractionChoices.placeObjectiveMarker(base, playerId, active, choice.tileId);
        break;
      case 'ACQUIRING_TECH': {
        if (choice.kind !== 'TECH') return wrong();
        const tech = TechnologySystem.acquirableTechs(base, playerId, { categories: active.categories, sharedOnly: active.sharedOnly }).find(t => t.id === choice.techId)
          ?? refuse('Cette technologie ne peut pas être prise pour ce gain');
        result = InteractionChoices.acquireTech(base, playerId, active, tech);
        break;
      }
      case 'SELECTING_COMPUTER_SLOT':
        if (choice.kind !== 'COMPUTER_COLUMN') return wrong();
        result = InteractionChoices.acquireTech(base, playerId, active, active.tech, choice.column);
        break;
      case 'ORBITING_PROBE':
      case 'LANDING_PROBE':
        if (choice.kind !== 'PLANET') return wrong();
        result = InteractionChoices.placeBonusProbe(base, playerId, active, choice.planetId, choice.slotIndex);
        break;
      case 'REMOVING_ORBITER':
      case 'REMOVING_LANDER':
        if (choice.kind !== 'PLANET') return wrong();
        result = InteractionChoices.removeProbe(base, playerId, active, choice.planetId, choice.slotIndex);
        break;
      case 'CHOOSING_CENTAURIEN_REWARD':
        if (choice.kind !== 'CENTAURIEN') return wrong();
        result = InteractionChoices.claimCentaurienReward(base, playerId, active, choice.tokenIndex);
        break;
      case 'CHOOSING_BONUS_ACTION': {
        if (choice.kind !== 'MENU') return wrong();
        const chosen = InteractionChoices.chooseBonusAction(active, choice.index) ?? refuse('Choix indisponible');
        // L'action choisie devient active, le menu mis à jour revient ensuite
        return InteractionQueue.set(base, chosen.next, [...(chosen.menu ? [chosen.menu] : []), ...InteractionQueue.pending(base)]);
      }
      case 'ACQUIRING_CARD':
        if (choice.kind !== 'CARD') return wrong();
        result = InteractionChoices.acquireCard(base, playerId, active, choice.cardId);
        break;
      case 'SELECTING_SCAN_CARD':
        if (choice.kind !== 'CARD' || !choice.cardId) return wrong();
        result = InteractionChoices.selectScanCard(base, active, choice.cardId);
        break;
      case 'RESERVING_CARD':
        if (choice.kind !== 'CARDS') return wrong();
        result = InteractionChoices.reserveCards(base, playerId, active, choice.cardIds);
        if (!result.error && game.phase === GamePhase.SETUP) {
          // Mise en place : la réservation faite, au joueur suivant
          outcome.add(result.historyEntries);
          const setup = TurnManager.advanceSetup(result.updatedGame);
          outcome.add(setup.historyEntries);
          return setup.updatedGame;
        }
        break;
      case 'CHOOSING_ROUND_CARD':
        if (choice.kind !== 'CARD' || !choice.cardId) return wrong();
        result = InteractionChoices.chooseRoundCard(base, playerId, active, choice.cardId);
        break;
      case 'DISCARDING_DRAWN_CARD':
        if (choice.kind !== 'CARD' || !choice.cardId) return wrong();
        result = InteractionChoices.discardDrawnCard(base, playerId, active, choice.cardId);
        break;
      case 'DISCARDING_FOR_SIGNAL':
        if (choice.kind !== 'CARDS') return wrong();
        result = InteractionChoices.discardForSignals(base, playerId, active, choice.cardIds);
        break;
      case 'CHOOSING_MEDIA_OR_MOVE':
        if (choice.kind !== 'MEDIA_OR_MOVE') return wrong();
        result = InteractionChoices.chooseMediaOrMove(base, playerId, active, choice.choice);
        break;
      case 'COLLECTING_SPECIMEN':
      case 'CONSULTING_SPECIMEN':
        if (choice.kind !== 'SPECIMEN') return wrong();
        result = InteractionChoices.takeSpecimen(base, playerId, active, choice.planetId, choice.tokenIndex);
        break;
      case 'CHOOSING_EXERTIEN_CARD':
        if (choice.kind !== 'EXERTIEN') return wrong();
        result = InteractionChoices.playExertienCard(base, playerId, active, choice.cardId);
        break;
      case 'CHOOSING_MISSION_REQUIREMENT':
        if (choice.kind !== 'MISSION') return wrong();
        result = InteractionChoices.chooseMissionRequirement(base, playerId, active, choice.missionId, choice.requirementId);
        break;
      case 'DISCARDING_TOKEN':
        if (choice.kind !== 'ACCEPT') return wrong();
        result = InteractionChoices.discardToken(base, playerId, active, choice.accepted);
        break;
      case 'CHOOSING_OBS2_ACTION':
        if (choice.kind !== 'ACCEPT') return wrong();
        result = InteractionChoices.observation2(base, playerId, active, choice.accepted);
        break;
      case 'CHOOSING_OBS3_ACTION':
        if (choice.kind !== 'ACCEPT') return wrong();
        result = InteractionChoices.observation3(base, active, choice.accepted);
        break;
      case 'CHOOSING_OBS4_ACTION':
        if (choice.kind !== 'OBS4') return wrong();
        result = InteractionChoices.observation4(base, playerId, active, choice.choice);
        break;
      case 'SELECTING_SCAN_SECTOR':
        if (choice.kind !== 'SECTOR') return wrong();
        return this.scanSector(base, playerId, active, choice.sectorId, outcome);
      default:
        return wrong();
    }

    if (result.error) refuse(result.error);
    outcome.add(result.historyEntries, active.sequenceId);
    let updated = InteractionQueue.enqueue(result.updatedGame, result.newPendingInteractions, active.sequenceId);
    if (result.nextInteraction) updated = InteractionQueue.pushFront(updated, result.nextInteraction);
    return updated;
  }

  /** Signal dans le secteur choisi ; la sonde utilisée ne sert plus pour les scans suivants de la même action */
  private static scanSector(game: Game, playerId: string, active: Interaction<'SELECTING_SCAN_SECTOR'>, sectorId: string, outcome: Outcome): Game {
    const sequenceId = active.sequenceId || `scan-${uniqueId()}`;
    const res = ScanSystem.resolveScanSectorSelection(game, playerId, active, sectorId, sequenceId);
    if (res.error) refuse(res.error);
    outcome.add(res.historyEntries, sequenceId);
    let updated = res.updatedGame;
    if (res.usedProbeId) updated = InteractionQueue.set(updated, undefined, InteractionChoices.markProbeUsed(InteractionQueue.pending(updated), active, res.usedProbeId));
    return InteractionQueue.enqueue(updated, res.newPendingInteractions, sequenceId);
  }

  // --- Après chaque commande ---

  /**
   * Fait avancer la partie jusqu'à ce qu'un joueur doive décider : interaction suivante de la file,
   * interactions automatiques et celles des robots résolues, fin de tour reprise une fois la file vide,
   * réservation de mise en place du joueur humain, rangée complétée.
   */
  private static settle(game: Game, outcome: Outcome): Game {
    let current = game;
    for (let guard = 0; guard < 200; guard++) {
      current = InteractionQueue.next(current);
      const active = current.interaction;

      if (active && isAutomaticInteraction(active)) {
        const ownerId = InteractionQueue.ownerId(current, active);
        const res = InteractionResolver.resolve(InteractionQueue.clear(current), ownerId, active);
        if (res.error) {
          outcome.notify(res.error);
          current = InteractionQueue.clear(current);
          continue;
        }
        outcome.add(res.historyEntries, active.sequenceId);
        current = InteractionQueue.enqueue(res.updatedGame, res.newInteractions, active.sequenceId, res.summary, res.forceStacking);
        continue;
      }

      if (active) {
        const owner = current.players.find(p => p.id === InteractionQueue.ownerId(current, active));
        if (owner?.type === 'robot') {
          const res = AIController.processInteractionQueue(InteractionQueue.clear(current), [active], active.sequenceId || `ai-${uniqueId()}`, owner);
          outcome.add(res.historyEntries);
          current = InteractionQueue.enqueue(res.updatedGame, res.newPendingInteractions, active.sequenceId);
          continue;
        }
        return current;
      }

      // File vide
      if (current.endingTurn && current.phase === GamePhase.PLAYING) {
        const turn = TurnManager.finishTurn(current);
        outcome.add(turn.milestoneEntries);
        outcome.notify(turn.discoveryNotification?.message);
        if (!turn.turnEnded && turn.pendingInteractions?.length) {
          const [first, ...more] = turn.pendingInteractions;
          current = InteractionQueue.set(turn.updatedGame, first, more);
          continue;
        }
        outcome.add(turn.turnEntries);
        current = { ...turn.updatedGame, endingTurn: false };
        continue;
      }

      if (current.phase === GamePhase.SETUP) {
        const player = current.players[current.currentPlayerIndex];
        if (player.type === 'human' && player.reservedCards.length === 0) {
          return InteractionQueue.set(current, { type: 'RESERVING_CARD', count: 1, selectedCards: [] });
        }
        return current;
      }

      if (current.phase === GamePhase.PLAYING && current.decks.cardRow.length < 3 && current.decks.cards.length > 0) {
        current = CardSystem.refillCardRow(current);
      }
      return current;
    }
    throw new Error('Interactions en boucle');
  }

  /**
   * Missions déclenchées pendant le tour d'un autre joueur (trace de vie gagnée par une majorité…) : les cercles
   * devenus réalisables ne peuvent pas attendre le tour de leur joueur, qui choisit aussitôt celui qu'il recouvre ou y renonce.
   * Pendant son tour, le joueur les recouvre en cliquant sur la carte (CLAIM_MISSION).
   */
  private static offerTriggeredMissions(before: Game, after: Game, outcome: Outcome): Game {
    const currentId = before.players[before.currentPlayerIndex]?.id;
    const offered = new Set([after.interaction, ...InteractionQueue.pending(after)]
      .filter(i => i?.type === 'CHOOSING_MISSION_REQUIREMENT').map(i => i!.playerId));
    let updated = after;
    for (const player of after.players) {
      if (player.id === currentId || offered.has(player.id)) continue;
      const previous = before.players.find(p => p.id === player.id);
      const options = player.missions.flatMap(mission => {
        const wasFulfillable = previous?.missions.find(m => m.id === mission.id)?.fulfillableRequirementIds || [];
        return (mission.fulfillableRequirementIds || []).filter(id => !wasFulfillable.includes(id)).map(requirementId => ({ missionId: mission.id, requirementId }));
      });
      if (options.length > 0) updated = InteractionQueue.enqueue(updated, [{ type: 'CHOOSING_MISSION_REQUIREMENT', options, playerId: player.id, sequenceId: `mission-claim-${uniqueId()}` }]);
    }
    return updated === after ? after : this.settle(updated, outcome);
  }

  // --- Outils pour l'interface ---

  /** Le joueur peut terminer son tour : aucune interaction ne l'en empêche */
  static canEndTurn(game: Game): boolean {
    const active = game.interaction;
    return (!active || !TurnManager.blocksEndOfTurn(active)) && InteractionQueue.pending(game).length === 0;
  }
}
