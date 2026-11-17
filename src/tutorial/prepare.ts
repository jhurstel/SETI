import { Game, HistoryEntry } from '../core/types';
import { cloneGame } from '../core/cloneGame';
import { setRandomState } from '../core/random';
import { uniqueId } from '../core/ids';
import { CardSystem } from '../systems/CardSystem';
import { AITurn } from '../ai/AITurn';
import { GameSession } from '../session/GameSession';
import { GameSetup } from '../session/GameSetup';
import { answerInteraction } from './scenario';
import type { ChapterOptions, TutorialChapter, TutorialCommand } from './types';

/** Nom de l'adversaire passif des chapitres */
export const TUTORIAL_OPPONENT_NAME = 'Robot passif';
/** Garde-fou : étapes de robot jouées d'affilée au plus */
const MAX_ROBOT_STEPS = 50;

export interface PreparedChapter {
  game: Game;
  /** Entrées d'historique de la préparation (sans état d'annulation : on ne revient pas avant le début du chapitre) */
  entries: HistoryEntry[];
  humanId: string;
}

/** Commande calculée sur la partie, le cas échéant */
export function resolveCommand(command: TutorialCommand, game: Game, humanId: string) {
  return typeof command === 'function' ? command(game, humanId) : command;
}

/**
 * Joue les tours des robots tant que c'est à eux (comme useAITurn, sans délai) : pour les adversaires passifs,
 * une passe par manche. Une erreur de robot est une erreur de programmation du chapitre.
 */
export function playRobots(initial: Game): { game: Game; entries: HistoryEntry[] } {
  let game = initial;
  const entries: HistoryEntry[] = [];
  for (let i = 0; i < MAX_ROBOT_STEPS && GameSession.robotCanPlay(game); i++) {
    if (game.rngState !== undefined) setRandomState(game.rngState);
    const step = AITurn.playStep(game);
    const result = step.kind === 'END_TURN'
      ? GameSession.applyRobotStep(game, { kind: 'END_TURN_DONE', end: AITurn.endTurn(game) })
      : GameSession.applyRobotStep(game, step);
    if (result.error) throw new Error(`Tutoriel : étape de robot refusée (${result.error})`);
    game = result.game;
    entries.push(...result.entries);
  }
  return { game, entries };
}

/** Commande du joueur humain pendant la préparation ou la solution, puis tours des robots */
export function applyTutorialCommand(game: Game, humanId: string, command: TutorialCommand): { game: Game; entries: HistoryEntry[] } {
  const resolved = resolveCommand(command, game, humanId);
  const result = GameSession.dispatch(game, humanId, resolved);
  if (result.error) throw new Error(`Tutoriel : commande ${resolved.type} refusée (${result.error})`);
  const robots = playRobots(result.game);
  return { game: robots.game, entries: [...result.entries, ...robots.entries] };
}

/**
 * Position de départ d'un chapitre : partie à graine fixe (le joueur humain commence, adversaires passifs),
 * mise en place (le joueur réserve la première carte de sa main), ajustements de scénario, puis commandes
 * de préparation (leurs choix éventuels reçoivent la réponse par défaut, `answerInteraction`).
 * Toujours la même position pour la même version du jeu.
 */
export async function prepareChapter(chapter: TutorialChapter, humanName: string, options: ChapterOptions = { unlockedSpecies: [] }): Promise<PreparedChapter> {
  if (chapter.seed === undefined) throw new Error(`Tutoriel : le chapitre ${chapter.id} n'a pas de position préparée`);
  const created = await GameSetup.newGame(
    [{ name: humanName, type: 'human' }, { name: TUTORIAL_OPPONENT_NAME, type: 'robot', aiDifficulty: 'IDLE' }],
    { seed: chapter.seed, firstPlayer: 0 },
  );
  const humanId = created.game.players[0].id;
  const started = GameSession.start(created.game);
  let game = started.game;
  const entries: HistoryEntry[] = [...created.entries, ...started.entries];

  // Mise en place : le joueur (premier) réserve la première carte de sa main, puis les robots réservent la leur
  const first = CardSystem.getHandCards(game.players[0])[0];
  const reserved = applyTutorialCommand(game, humanId, { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [first.id] } });
  game = reserved.game;
  entries.push(...reserved.entries);

  if (chapter.adjust) game = chapter.adjust(cloneGame(game), humanId, options);

  for (const command of chapter.prepare) {
    const step = applyTutorialCommand(game, humanId, command);
    game = step.game;
    entries.push(...step.entries);
    // Choix ouverts par la commande (bonus d'une orbite…) : premier choix possible
    for (let i = 0; i < MAX_ROBOT_STEPS && game.interaction; i++) {
      const answered = applyTutorialCommand(game, humanId, answerInteraction);
      game = answered.game;
      entries.push(...answered.entries);
    }
  }
  // Identifiants posés comme le fait SessionJournal en jeu (clés de l'historique affiché)
  return { game, entries: entries.map(({ previousState: _previous, ...entry }) => ({ ...entry, id: entry.id ?? uniqueId() })), humanId };
}
