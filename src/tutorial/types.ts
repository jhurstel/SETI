/** Tutoriel : chapitres, étapes et commandes de préparation (TS pur, sans React) */
import type { ActionType, Game, InteractionState } from '../core/types';
import type { Command } from '../session/commands';

/** Commande jouée par le joueur humain pendant la préparation ou la solution : fixe, ou calculée sur la partie */
export type TutorialCommand = Command | ((game: Game, humanId: string) => Command);

/** Ce qu'un prédicat d'étape peut lire : la partie, le joueur humain et la position de départ du chapitre */
export interface TutorialContext {
  game: Game;
  humanId: string;
  start: Game;
}

/** Action qu'une étape peut permettre : une action principale, ou la fin du tour */
export type TutorialAction = ActionType | 'END_TURN';

export interface TutorialStep {
  /** Identifiant de la section de l'étape dans public/docs/tutoriel.md */
  id: string;
  /** Valeur de l'attribut data-tutorial de l'élément mis en avant */
  target?: string;
  /**
   * L'étape est terminée quand la partie atteint cet état (absent : étape d'explication, terminée par « Suivant »).
   * Le prédicat doit rester vrai une fois atteint pendant le chapitre (il décrit un acquis, pas un instant).
   */
  done?: (context: TutorialContext) => boolean;
  /** Actions principales (et fin du tour) permises pendant l'étape ; les actions gratuites le sont toujours */
  allowedActions?: TutorialAction[];
  /** Identifiant d'un titre de public/docs/documentation.md (« En savoir plus ») */
  docLink?: string;
  /**
   * Type du choix pendant lequel l'étape reste affichée (ex. : la rotation, montrée avant de choisir la technologie ;
   * « posez la trace de vie » pendant son placement) ; les autres étapes s'effacent pendant un choix.
   */
  duringChoice?: InteractionState['type'];
}

export interface TutorialChapter {
  /** Identifiant : clé de la progression et du chapitre dans public/docs/tutoriel.md */
  id: string;
  /** Graine de la partie (absente : partie normale, « Première vraie partie ») */
  seed?: number;
  /** Ajustements de scénario, appliqués à une copie de la partie après la mise en place */
  adjust?: (game: Game, humanId: string) => Game;
  /** Commandes du joueur humain jouées avant qu'il prenne la main (tours des adversaires passifs joués entre elles) */
  prepare: TutorialCommand[];
  steps: TutorialStep[];
  /** Commandes qui terminent toutes les étapes, dans l'ordre (tests) */
  solution: TutorialCommand[];
}

/** Où en est le joueur dans un chapitre : étapes d'explication validées par « Suivant » */
export interface TutorialState {
  chapterId: string;
  explained: string[];
}
