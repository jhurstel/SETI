import type { Game } from '../core/types';
import { tutorialCommandBlockReason } from './guidance';
import { applyTutorialCommand, PreparedChapter, resolveCommand } from './prepare';
import { answerInteraction } from './scenario';
import { TutorialRunner } from './TutorialRunner';
import type { TutorialChapter, TutorialContext, TutorialState } from './types';

/** Garde-fou : choix répondus d'affilée au plus après une commande */
const MAX_ANSWERS = 20;

/** Répond aux interactions du joueur en attente par le premier choix possible */
export function answerAll(game: Game, humanId: string): Game {
  let current = game;
  for (let i = 0; i < MAX_ANSWERS && current.interaction; i++) {
    current = applyTutorialCommand(current, humanId, answerInteraction).game;
  }
  if (current.interaction) throw new Error(`Tutoriel : interaction ${current.interaction.type} sans fin`);
  return current;
}

/** Valide les explications jusqu'à la prochaine étape d'action (ou la fin du chapitre) */
export function readExplanations(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): TutorialState {
  let current = state;
  for (let step = TutorialRunner.currentStep(chapter, current, context); step && !step.done; step = TutorialRunner.currentStep(chapter, current, context)) {
    current = TutorialRunner.next(chapter, current, context);
  }
  return current;
}

/**
 * Joue la solution d'un chapitre depuis sa position préparée : explications validées, chaque commande permise par
 * l'étape en cours, choix répondus par défaut, étape courante jamais en recul. Renvoie l'erreur rencontrée, ou null
 * si le chapitre est terminé (tests et outil tools/tutorial/findSeed.ts).
 */
export function checkSolution(chapter: TutorialChapter, prepared: PreparedChapter): string | null {
  const { humanId } = prepared;
  const start = prepared.game;
  try {
    if (start.players[start.currentPlayerIndex].id !== humanId || start.interaction) return 'le joueur n\'a pas la main au départ';
    const firstAction = chapter.steps.find(s => s.done);
    if (firstAction?.done?.({ game: start, humanId, start })) return `l'étape ${firstAction.id} est déjà faite au départ`;
    let game = start;
    let state = TutorialRunner.start(chapter);
    let index = 0;
    for (const command of chapter.solution) {
      state = readExplanations(chapter, state, { game, humanId, start });
      const step = TutorialRunner.currentStep(chapter, state, { game, humanId, start });
      const resolved = resolveCommand(command, game, humanId);
      const blocked = tutorialCommandBlockReason(step, resolved);
      if (blocked) return `commande ${resolved.type} refusée à l'étape ${step?.id} : ${blocked}`;
      game = answerAll(applyTutorialCommand(game, humanId, resolved).game, humanId);
      const next = TutorialRunner.currentIndex(chapter, state, { game, humanId, start });
      if (next < index) return `l'étape ${chapter.steps[next].id} redevient à faire après ${resolved.type}`;
      index = next;
    }
    state = readExplanations(chapter, state, { game, humanId, start });
    const left = TutorialRunner.currentStep(chapter, state, { game, humanId, start });
    return left ? `l'étape ${left.id} n'est pas terminée par la solution` : null;
  } catch (error) {
    // Erreurs du moteur ou du chapitre : toujours des Error
    return (error as Error).message;
  }
}
