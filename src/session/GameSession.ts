import { acceptsChoice, ChoiceFor, ChoiceInteractionType, Game, GamePhase, HistoryEntry, Interaction, InteractionState, InteractionType, isAutomaticInteraction, isSkippable } from '../core/types';
import { GameEngine } from '../engine/Game';
import { BaseAction } from '../actions/Action';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { ScanSectorAction } from '../actions/ScanSectorAction';
import { AnalyzeDataAction } from '../actions/AnalyzeDataAction';
import { ResearchTechAction } from '../actions/ResearchTechAction';
import { OrbitAction } from '../actions/OrbitAction';
import { LandAction } from '../actions/LandAction';
import { PlayCardAction } from '../actions/PlayCardAction';
import { PassAction } from '../actions/PassAction';
import { InteractionChoices, ChoiceResult } from '../engine/InteractionChoices';
import { InteractionResolver } from '../engine/InteractionResolver';
import { TurnManager } from '../engine/TurnManager';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { requirePlayer } from '../core/players';
import { AIController } from '../ai/AIController';
import { AIStep, AITurn } from '../ai/AITurn';
import { getRandomState, setRandomState } from '../core/random';
import { uniqueId } from '../core/ids';
import { Choice, Command } from './commands';
import { InteractionQueue } from './InteractionQueue';
import { DISCOVERY_MESSAGE, DISCOVERY_NOTICE, discoveryNotice } from '../systems/SpeciesSystem';
import { trace } from '../core/trace';

/** Étape d'un robot à appliquer : calculée par AITurn.playStep, ou fin de tour calculée par AITurn.endTurn */
export type RobotStepInput = AIStep | { kind: 'END_TURN_DONE'; end: ReturnType<typeof AITurn.endTurn> };

export interface DispatchResult {
  /** La partie après la commande (inchangée si refusée) */
  game: Game;
  /** Entrées d'historique produites, dans l'ordre */
  entries: HistoryEntry[];
  /** Annonces à montrer aux joueurs (découverte d'une espèce…) */
  notifications: string[];
  error?: string;
}

/** Cartes dont les gains se résolvent dans l'ordre de la carte, sans menu de choix */
const FORCE_STACKING_CARDS = ['27', '28', '29', '30'];

/** Marque la première entrée (hors séparateur) d'une action principale */
const markMainAction = (entries: HistoryEntry[]): HistoryEntry[] => {
  const index = entries.findIndex(e => !e.message.startsWith('---'));
  return entries.map((e, i) => (i === index ? { ...e, mainAction: true } : e));
};

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

/**
 * Annonces renvoyées à l'interface : l'annonce générique de découverte devient celle de chaque espèce découverte
 * pendant la commande (nom de l'espèce dans la fenêtre « Découverte »)
 */
const namedNotifications = (before: Game, after: Game, notifications: string[]): string[] => {
  if (!notifications.includes(DISCOVERY_NOTICE)) return notifications;
  const named = after.species
    .filter(s => s.discovered && !before.species.find(b => b.name === s.name)?.discovered)
    .map(s => discoveryNotice(s.name));
  return notifications.flatMap(n => (n === DISCOVERY_NOTICE && named.length > 0 ? named : [n]));
};

class Refusal extends Error {}
const refuse = (message: string): never => { throw new Refusal(message); };

// --- Choix sur l'interaction en cours ---

/** Contexte d'un choix : la partie sans l'interaction en cours (`base`), la partie reçue, le joueur, l'historique */
interface ChoiceContext {
  base: Game;
  game: Game;
  playerId: string;
  outcome: Outcome;
}

/** Un choix appliqué : le résultat d'une opération de InteractionChoices (file mise à jour ensuite), ou la partie prête */
type ChoiceOutcome = ChoiceResult | { game: Game };
type ChoiceHandler<T extends InteractionType> = (c: ChoiceContext, active: Interaction<T>, choice: ChoiceFor<T>) => ChoiceOutcome;
/** Interactions auxquelles répond une commande CHOOSE (MOVING_PROBE, par exemple, répond à MOVE_PROBE) */
type ChosenInteractionType = { [T in ChoiceInteractionType]: [ChoiceFor<T>] extends [never] ? never : T }[ChoiceInteractionType];

const wrongChoice = (): never => refuse('Choix sans rapport avec l\'action en cours');

/** Signal dans le secteur choisi ; contrainte des scans suivants de la même action (ScanSystem.scanFollowUp) */
function scanSector(game: Game, playerId: string, active: Interaction<'SELECTING_SCAN_SECTOR'>, sectorId: string, outcome: Outcome): Game {
  const sequenceId = active.sequenceId || `scan-${uniqueId()}`;
  const res = ScanSystem.resolveScanSectorSelection(game, playerId, active, sectorId, sequenceId);
  if (res.error) refuse(res.error);
  outcome.add(res.historyEntries, sequenceId);
  let updated = res.updatedGame;
  if (res.scanFollowUp) updated = InteractionQueue.set(updated, undefined, InteractionChoices.applyScanFollowUp(InteractionQueue.pending(updated), active, res.scanFollowUp));
  return InteractionQueue.enqueue(updated, res.newPendingInteractions, sequenceId);
}

/**
 * Opération appliquée pour chaque interaction à choix (les genres de choix acceptés sont dans `INTERACTIONS`) :
 * un type d'interaction oublié est une erreur de compilation.
 */
const CHOICE_HANDLERS: { [T in ChosenInteractionType]: ChoiceHandler<T> } = {
  PLACING_LIFE_TRACE: (c, active, choice) => InteractionChoices.placeLifeTrace(c.base, c.playerId, active, choice.boardIndex, choice.color, choice.slotType, choice.slotIndex),
  ACQUIRING_ALIEN_CARD: (c, active, choice) => InteractionChoices.acquireAlienCard(c.base, c.playerId, active, choice.cardId),
  PLACING_OBJECTIVE_MARKER: (c, active, choice) => InteractionChoices.placeObjectiveMarker(c.base, c.playerId, active, choice.tileId),
  ACQUIRING_TECH: (c, active, choice) => {
    const tech = TechnologySystem.acquirableTechs(c.base, c.playerId, { categories: active.categories, sharedOnly: active.sharedOnly }).find(t => t.id === choice.techId)
      ?? refuse('Cette technologie ne peut pas être prise pour ce gain');
    return InteractionChoices.acquireTech(c.base, c.playerId, active, tech);
  },
  SELECTING_COMPUTER_SLOT: (c, active, choice) => InteractionChoices.acquireTech(c.base, c.playerId, active, active.tech, choice.column),
  ORBITING_PROBE: (c, active, choice) => InteractionChoices.placeBonusProbe(c.base, c.playerId, active, choice.planetId, choice.slotIndex),
  LANDING_PROBE: (c, active, choice) => InteractionChoices.placeBonusProbe(c.base, c.playerId, active, choice.planetId, choice.slotIndex),
  REMOVING_ORBITER: (c, active, choice) => InteractionChoices.removeProbe(c.base, c.playerId, active, choice.planetId, choice.slotIndex),
  REMOVING_LANDER: (c, active, choice) => InteractionChoices.removeProbe(c.base, c.playerId, active, choice.planetId, choice.slotIndex),
  CHOOSING_CENTAURIEN_REWARD: (c, active, choice) => InteractionChoices.claimCentaurienReward(c.base, c.playerId, active, choice.tokenIndex),
  CHOOSING_BONUS_ACTION: (c, active, choice) => {
    const chosen = InteractionChoices.chooseBonusAction(active, choice.index) ?? refuse('Choix indisponible');
    // L'action choisie devient active, le menu mis à jour revient ensuite
    return { game: InteractionQueue.set(c.base, chosen.next, [...(chosen.menu ? [chosen.menu] : []), ...InteractionQueue.pending(c.base)]) };
  },
  ACQUIRING_CARD: (c, active, choice) => InteractionChoices.acquireCard(c.base, c.playerId, active, choice.cardId),
  SELECTING_SCAN_CARD: (c, active, choice) => InteractionChoices.selectScanCard(c.base, active, choice.cardId ?? wrongChoice()),
  RESERVING_CARD: (c, active, choice) => {
    const result = InteractionChoices.reserveCards(c.base, c.playerId, active, choice.cardIds);
    if (result.error || c.game.phase !== GamePhase.SETUP) return result;
    // Mise en place : la réservation faite, au joueur suivant
    c.outcome.add(result.historyEntries);
    const setup = TurnManager.advanceSetup(result.updatedGame);
    c.outcome.add(setup.historyEntries);
    return { game: setup.updatedGame };
  },
  CHOOSING_ROUND_CARD: (c, active, choice) => InteractionChoices.chooseRoundCard(c.base, c.playerId, active, choice.cardId ?? wrongChoice()),
  DISCARDING_DRAWN_CARD: (c, active, choice) => InteractionChoices.discardDrawnCard(c.base, c.playerId, active, choice.cardId ?? wrongChoice()),
  DISCARDING_FOR_SIGNAL: (c, active, choice) => InteractionChoices.discardForSignals(c.base, c.playerId, active, choice.cardIds),
  CHOOSING_MEDIA_OR_MOVE: (c, active, choice) => InteractionChoices.chooseMediaOrMove(c.base, c.playerId, active, choice.choice),
  COLLECTING_SPECIMEN: (c, active, choice) => InteractionChoices.takeSpecimen(c.base, c.playerId, active, choice.planetId, choice.tokenIndex),
  CONSULTING_SPECIMEN: (c, active, choice) => InteractionChoices.takeSpecimen(c.base, c.playerId, active, choice.planetId, choice.tokenIndex),
  CHOOSING_EXERTIEN_CARD: (c, active, choice) => InteractionChoices.playExertienCard(c.base, c.playerId, active, choice.cardId),
  CHOOSING_MISSION_REQUIREMENT: (c, active, choice) => InteractionChoices.chooseMissionRequirement(c.base, c.playerId, active, choice.missionId, choice.requirementId),
  DISCARDING_TOKEN: (c, active, choice) => InteractionChoices.discardToken(c.base, c.playerId, active, choice.accepted),
  CHOOSING_OBS2_ACTION: (c, active, choice) => InteractionChoices.observation2(c.base, c.playerId, active, choice.accepted),
  CHOOSING_OBS3_ACTION: (c, active, choice) => InteractionChoices.observation3(c.base, active, choice.accepted),
  CHOOSING_OBS4_ACTION: (c, active, choice) => InteractionChoices.observation4(c.base, c.playerId, active, choice.choice),
  SELECTING_SCAN_SECTOR: (c, active, choice) => ({ game: scanSector(c.base, c.playerId, active, choice.sectorId, c.outcome) }),
};

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
      return { game: { ...settled, rngState: getRandomState() }, entries: outcome.entries, notifications: namedNotifications(game, settled, outcome.notifications) };
    } catch (error) {
      if (!(error instanceof Refusal)) trace.error('[Session]', error);
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
  static applyRobotStep(game: Game, step: RobotStepInput, rngState?: number): DispatchResult {
    // Le générateur reprend là où le calcul de l'étape l'a laissé (robotCompute) ; sans état fourni, l'étape vient
    // d'être calculée sur place et le générateur y est encore
    if (rngState !== undefined) setRandomState(rngState);
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
        case 'UPDATED': {
          // L'étape qui fait l'action principale du robot la marque (barre de progression de l'historique)
          const robotId = game.players[game.currentPlayerIndex].id;
          const playedMain = !requirePlayer(game, robotId).hasPerformedMainAction && requirePlayer(step.updatedGame, robotId).hasPerformedMainAction;
          outcome.add(playedMain ? markMainAction(step.historyEntries) : step.historyEntries);
          updated = InteractionQueue.enqueue(step.updatedGame, step.humanInteractions || [], step.historyEntries[0]?.sequenceId);
          break;
        }
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
      return { game: { ...settled, rngState: getRandomState() }, entries: outcome.entries, notifications: namedNotifications(game, settled, outcome.notifications) };
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
    outcome.add(markMainAction(action.historyEntries));
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
    if (!isSkippable(active)) refuse('Cette action ne peut pas être abandonnée');
    return InteractionQueue.clear(game);
  }

  private static choose(game: Game, playerId: string, active: InteractionState, choice: Choice, outcome: Outcome): Game {
    if (!acceptsChoice(active, choice)) return wrongChoice();
    // acceptsChoice : l'interaction a une opération dans la table, et le choix est d'un genre qu'elle accepte
    const handler = CHOICE_HANDLERS[active.type as ChosenInteractionType] as ChoiceHandler<InteractionType>;
    const result = handler({ base: InteractionQueue.clear(game), game, playerId, outcome }, active, choice);
    if ('game' in result) return result.game;

    if (result.error) refuse(result.error);
    outcome.add(result.historyEntries, active.sequenceId);
    let updated = InteractionQueue.enqueue(result.updatedGame, result.newPendingInteractions, active.sequenceId);
    if (result.nextInteraction) updated = InteractionQueue.pushFront(updated, result.nextInteraction);
    return updated;
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
        return mission.fulfillableRequirementIds.filter(id => !wasFulfillable.includes(id)).map(requirementId => ({ missionId: mission.id, requirementId }));
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
