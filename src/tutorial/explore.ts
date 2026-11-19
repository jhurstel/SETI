/**
 * Explorateur des écarts d'un chapitre (tests et outil tools/tutorial/deadEnds.ts) : depuis chaque étape de la solution,
 * joue les écarts que le guidage permet au joueur (actions gratuites, actions principales permises avec chaque cible,
 * chaque réponse aux choix ouverts) et vérifie que la partie obtenue est soit une impasse déclarée (mode annulation),
 * soit encore terminable par la suite de la solution. Fonctions pures, qui n'appellent que des opérations du moteur.
 */
import { CardSystem } from '../systems/CardSystem';
import { GAME_CONSTANTS, Game } from '../core/types';
import type { Command } from '../session/commands';
import { tutorialCommandBlockReason } from './guidance';
import { applyTutorialCommand, PreparedChapter, resolveCommand } from './prepare';
import { freeProbeCells, humanOf, interactionAnswers, neighbourCells } from './scenario';
import { answerAll, readExplanationsAndAdvance } from './solve';
import { TutorialRunner } from './TutorialRunner';
import type { TutorialChapter, TutorialState, TutorialStep } from './types';

/** Écart qui rend le chapitre impossible à terminer sans passer en mode annulation */
export interface DeadEndFinding {
  chapterId: string;
  /** Étape où l'écart commence */
  stepId: string;
  /** Commandes de l'écart (écart et réponses aux choix), lisibles */
  deviation: string[];
}

export interface ExploreOptions {
  /** Écarts enchaînés depuis une même étape (1 : un écart, suivi de ses choix) */
  depth?: number;
  /** Niveaux de choix explorés en entier après un écart ; au-delà, réponse par défaut */
  choiceLevels?: number;
}

/** Commande lisible dans un rapport */
export function describeCommand(command: Command): string {
  if (command.type === 'CHOOSE') return `CHOOSE ${JSON.stringify(command.choice)}`;
  const { type, ...rest } = command;
  return Object.keys(rest).length ? `${type} ${JSON.stringify(rest)}` : type;
}

/** Commande appliquée, ou null si le moteur la refuse */
function tryApply(game: Game, humanId: string, command: Command): Game | null {
  try {
    return applyTutorialCommand(game, humanId, command).game;
  } catch {
    return null;
  }
}

/** Écarts possibles du joueur à cette étape : commandes que le guidage permet (le moteur refusera les autres) */
export function candidateCommands(game: Game, humanId: string, step: TutorialStep | null): Command[] {
  const player = humanOf(game, humanId);
  const hand = CardSystem.getHandCards(player);
  const commands: Command[] = [
    { type: 'BUY_CARD' },
    { type: 'TRADE', spend: 'credit', gain: 'energy' },
    { type: 'TRADE', spend: 'energy', gain: 'credit' },
    { type: 'TRADE', spend: 'credit', gain: 'card' },
    { type: 'TRADE', spend: 'energy', gain: 'card' },
    // Chaque carte de la main échangée (avec la suivante)
    ...hand.map((card, i) => ({ type: 'TRADE' as const, spend: 'card', gain: 'credit', cardIds: [card.id, hand[(i + 1) % hand.length].id] })),
    ...hand.map(card => ({ type: 'DISCARD_FOR_FREE_ACTION' as const, cardId: card.id })),
    ...Object.keys(player.dataComputer.slots).map(slotId => ({ type: 'TRANSFER_DATA' as const, slotId })),
    ...freeProbeCells(game, humanId).flatMap(({ probeId, cell }) => neighbourCells(game, cell)
      .map(next => ({ type: 'MOVE_PROBE' as const, probeId, disk: next[0] as never, sector: Number(next.slice(1)) as never }))),
    // Actions principales, avec chaque cible
    { type: 'LAUNCH_PROBE' }, { type: 'SCAN' }, { type: 'ANALYZE' }, { type: 'RESEARCH_TECH' },
    ...game.board.planets.flatMap(planet => [{ type: 'ORBIT' as const, planetId: planet.id }, { type: 'LAND' as const, planetId: planet.id }]),
    ...hand.map(card => ({ type: 'PLAY_CARD' as const, cardId: card.id })),
    { type: 'PASS', cardsToKeep: hand.slice(0, GAME_CONSTANTS.HAND_SIZE_AFTER_PASS).map(card => card.id) },
    { type: 'END_TURN' },
  ];
  return commands.filter(command => !tutorialCommandBlockReason(step, command));
}

/**
 * Parties obtenues après une commande : chaque réponse aux choix qu'elle ouvre, sur `levels` niveaux, puis les réponses
 * par défaut du chapitre ; avec les commandes jouées
 */
function outcomes(chapter: TutorialChapter, game: Game, humanId: string, levels: number): { game: Game; path: Command[] }[] {
  if (!game.interaction) return [{ game, path: [] }];
  if (levels <= 0) {
    try {
      return [{ game: answerAll(game, humanId, chapter), path: [] }];
    } catch {
      return [];
    }
  }
  return interactionAnswers(game, humanId).flatMap(answer => {
    const next = tryApply(game, humanId, answer);
    if (!next) return [];
    return outcomes(chapter, next, humanId, levels - 1).map(o => ({ game: o.game, path: [answer, ...o.path] }));
  });
}

/** Déplacements de rattrapage essayés au plus avant la suite de la solution (sonde à ramener) */
const RECOVERY_MOVES = 3;

/**
 * La suite de la solution, à partir de la commande `from`, termine-t-elle le chapitre ? Choix par défaut du chapitre ;
 * une commande que l'étape ou le moteur refuse est sautée (l'écart l'a peut-être rendue inutile) : seul compte que le
 * chapitre se termine.
 */
function replays(chapter: TutorialChapter, prepared: PreparedChapter, game: Game, state: TutorialState, from: number): boolean {
  const { humanId, game: start } = prepared;
  let current = game;
  let currentState = state;
  for (const command of chapter.solution.slice(from)) {
    ({ state: currentState, game: current } = readExplanationsAndAdvance(chapter, currentState, current, humanId, start));
    const step = TutorialRunner.currentStep(chapter, currentState, { game: current, humanId, start });
    try {
      const resolved = resolveCommand(command, current, humanId);
      if (tutorialCommandBlockReason(step, resolved)) continue;
      current = answerAll(applyTutorialCommand(current, humanId, resolved).game, humanId, chapter);
    } catch {
      // Commande refusée (ou devenue impossible à calculer) : sautée
    }
  }
  ({ state: currentState, game: current } = readExplanationsAndAdvance(chapter, currentState, current, humanId, start));
  return TutorialRunner.isFinished(chapter, currentState, { game: current, humanId, start });
}

/** Le chapitre reste terminable : suite de la solution, après au plus RECOVERY_MOVES déplacements de rattrapage */
function finishes(chapter: TutorialChapter, prepared: PreparedChapter, game: Game, state: TutorialState, from: number, moves = RECOVERY_MOVES): boolean {
  if (replays(chapter, prepared, game, state, from)) return true;
  if (moves === 0) return false;
  const { humanId } = prepared;
  return freeProbeCells(game, humanId).some(({ probeId, cell }) => neighbourCells(game, cell).some(next => {
    const moved = tryApply(game, humanId, { type: 'MOVE_PROBE', probeId, disk: next[0] as never, sector: Number(next.slice(1)) as never });
    return !!moved && !moved.interaction && finishes(chapter, prepared, moved, state, from, moves - 1);
  }));
}

/**
 * Écarts fautifs d'un chapitre : depuis chaque étape où la solution joue une commande, chaque écart (et ses choix) doit
 * mener à une impasse déclarée ou laisser le chapitre terminable (suite de la solution depuis cette commande, ou depuis
 * la suivante quand l'écart l'a remplacée). Les exceptions du chapitre (`explorerAllows`) sont écartées.
 */
export function exploreDeadEnds(chapter: TutorialChapter, prepared: PreparedChapter, options: ExploreOptions = {}): DeadEndFinding[] {
  const { depth = 1, choiceLevels = 2 } = options;
  const { humanId, game: start } = prepared;
  const findings: DeadEndFinding[] = [];
  const seen = new Set<string>();

  const explore = (game: Game, state: TutorialState, index: number, stepId: string, path: Command[], left: number) => {
    const step = TutorialRunner.currentStep(chapter, state, { game, humanId, start });
    for (const command of candidateCommands(game, humanId, step)) {
      const applied = tryApply(game, humanId, command);
      if (!applied) continue;
      for (const outcome of outcomes(chapter, applied, humanId, choiceLevels)) {
        const deviation = [...path, command, ...outcome.path];
        const key = `${stepId}|${deviation.map(describeCommand).join(' ; ')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const advanced = readExplanationsAndAdvance(chapter, state, outcome.game, humanId, start);
        if (TutorialRunner.deadEnd(chapter, advanced.state, { game: advanced.game, humanId, start })) continue;
        if (TutorialRunner.isFinished(chapter, advanced.state, { game: advanced.game, humanId, start })) continue;
        const ok = finishes(chapter, prepared, outcome.game, state, index);
        if (!ok) {
          const described = deviation.map(describeCommand);
          const allowed = chapter.explorerAllows?.some(allow => described.some(text => allow.deviation.test(text)) && (!allow.stepId || allow.stepId === stepId));
          if (!allowed) findings.push({ chapterId: chapter.id, stepId, deviation: described });
        } else if (left > 1) {
          explore(outcome.game, state, index, stepId, deviation, left - 1);
        }
      }
    }
  };

  let game = start;
  let state = TutorialRunner.start(chapter);
  chapter.solution.forEach((command, index) => {
    ({ state, game } = readExplanationsAndAdvance(chapter, state, game, humanId, start));
    const step = TutorialRunner.currentStep(chapter, state, { game, humanId, start });
    explore(game, state, index, step?.id ?? '?', [], depth);
    game = answerAll(applyTutorialCommand(game, humanId, resolveCommand(command, game, humanId)).game, humanId, chapter);
  });
  return findings;
}
