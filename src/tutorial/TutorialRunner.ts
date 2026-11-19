import type { Game } from '../core/types';
import type { TutorialChapter, TutorialContext, TutorialDeadEnd, TutorialState, TutorialStep } from './types';

/** Section de la documentation des étapes d'impasse : l'historique, où se trouve l'annulation */
export const DEAD_END_DOC = 'historique';

/** Étape affichée en mode annulation : rien à faire d'autre qu'annuler (ou recommencer le chapitre) */
export function deadEndStep(deadEnd: TutorialDeadEnd): TutorialStep {
  return {
    id: deadEnd.id,
    target: deadEnd.target ?? 'history',
    docLink: deadEnd.docLink ?? DEAD_END_DOC,
    done: () => false,
    allowedActions: [],
    deadEnd: true,
  };
}

/**
 * Déroulement d'un chapitre (fonctions pures) : l'étape courante se déduit de la partie et des explications validées.
 * Une étape d'action est passée quand son prédicat est vrai ; une étape d'explication, quand le joueur a cliqué
 * sur « Suivant ». Après une commande comme après une annulation, l'étape courante est donc toujours la première
 * étape encore à faire : une annulation ramène naturellement à l'étape correspondante.
 * Une impasse du chapitre passe avant toute étape (mode annulation), tant qu'elle est vraie.
 */
export class TutorialRunner {
  static start(chapter: TutorialChapter): TutorialState {
    return { chapterId: chapter.id, explained: [] };
  }

  /** Index de l'étape courante ; `chapter.steps.length` quand le chapitre est terminé */
  static currentIndex(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): number {
    for (let i = 0; i < chapter.steps.length; i++) {
      const step = chapter.steps[i];
      const passed = step.done ? step.done(context) : state.explained.includes(step.id);
      if (!passed) return i;
    }
    return chapter.steps.length;
  }

  /**
   * Impasse en cours : la première impasse vraie du chapitre, null sinon. Évaluée hors d'un choix en cours (la bulle ne
   * recouvre pas une fenêtre de choix au milieu d'une action) et tant que le chapitre n'est pas terminé.
   */
  static deadEnd(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): TutorialDeadEnd | null {
    if (!chapter.deadEnds || context.game.interaction) return null;
    if (this.currentIndex(chapter, state, context) >= chapter.steps.length) return null;
    return chapter.deadEnds.find(deadEnd => deadEnd.when(context)) ?? null;
  }

  /**
   * Étape à afficher : pendant un choix en cours (carte, secteur, bonus…), l'étape ne revient jamais en arrière, le
   * temps que la partie retrouve un état stable ; ensuite, l'étape courante.
   */
  static displayIndex(chapter: TutorialChapter, state: TutorialState, context: TutorialContext, previous: number | null): number {
    const current = this.currentIndex(chapter, state, context);
    return context.game.interaction && previous !== null ? Math.max(previous, current) : current;
  }

  /** L'étape reste affichée pendant le choix en cours (son type est celui de duringChoice) */
  static shownDuringChoice(step: TutorialStep | null, game: Game): boolean {
    return !!step?.duringChoice && game.interaction?.type === step.duringChoice;
  }

  /** Étape courante : l'étape d'impasse en mode annulation, sinon la première étape encore à faire */
  static currentStep(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): TutorialStep | null {
    const deadEnd = this.deadEnd(chapter, state, context);
    if (deadEnd) return deadEndStep(deadEnd);
    return chapter.steps[this.currentIndex(chapter, state, context)] ?? null;
  }

  static isFinished(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): boolean {
    return this.currentIndex(chapter, state, context) >= chapter.steps.length;
  }

  /** « Suivant » sur une étape d'explication ; sans effet sur une étape qui attend une action (ou une impasse) */
  static next(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): TutorialState {
    const step = this.currentStep(chapter, state, context);
    if (!step || step.done) return state;
    return { ...state, explained: [...state.explained, step.id] };
  }
}
