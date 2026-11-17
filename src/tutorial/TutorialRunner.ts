import type { Game } from '../core/types';
import type { TutorialChapter, TutorialContext, TutorialState, TutorialStep } from './types';

/**
 * Déroulement d'un chapitre (fonctions pures) : l'étape courante se déduit de la partie et des explications validées.
 * Une étape d'action est passée quand son prédicat est vrai ; une étape d'explication, quand le joueur a cliqué
 * sur « Suivant ». Après une commande comme après une annulation, l'étape courante est donc toujours la première
 * étape encore à faire : une annulation ramène naturellement à l'étape correspondante.
 */
export class TutorialRunner {
  static start(chapter: TutorialChapter): TutorialState {
    return { chapterId: chapter.id, explained: [] };
  }

  /** Index de l'étape courante ; `chapter.steps.length` quand le chapitre est terminé */
  static currentIndex(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): number {
    for (let i = 0; i < chapter.steps.length; i++) {
      const step = chapter.steps[i];
      const passed = (step.onlyIf && !step.onlyIf(context))
        || (step.done ? step.done(context) : state.explained.includes(step.id));
      if (!passed) return i;
    }
    return chapter.steps.length;
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

  static currentStep(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): TutorialStep | null {
    return chapter.steps[this.currentIndex(chapter, state, context)] ?? null;
  }

  static isFinished(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): boolean {
    return this.currentIndex(chapter, state, context) >= chapter.steps.length;
  }

  /** « Suivant » sur une étape d'explication ; sans effet sur une étape qui attend une action */
  static next(chapter: TutorialChapter, state: TutorialState, context: TutorialContext): TutorialState {
    const step = this.currentStep(chapter, state, context);
    if (!step || step.done) return state;
    return { ...state, explained: [...state.explained, step.id] };
  }
}
