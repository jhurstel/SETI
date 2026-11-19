/** Tutoriel : chapitres, étapes et commandes de préparation (TS pur, sans React) */
import type { ActionType, AlienBoardType, Game, InteractionState } from '../core/types';
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
  /** Cartes que l'étape permet de jouer (absent : toute carte) : une autre carte gâcherait l'action principale du tour */
  allowedCards?: string[];
  /** Identifiant d'un titre de public/docs/documentation.md (« En savoir plus ») */
  docLink?: string;
  /**
   * Type du choix pendant lequel l'étape reste affichée (ex. : la rotation, montrée avant de choisir la technologie ;
   * « posez la trace de vie » pendant son placement) ; les autres étapes s'effacent pendant un choix.
   */
  duringChoice?: InteractionState['type'];
  /**
   * Ellipse d'une étape d'explication : la partie avance d'un coup quand le joueur clique sur « Suivant »
   * (« deux tours plus tard… », expliqué par le texte de l'étape). Fonction pure qui n'appelle que des opérations du moteur.
   */
  ellipsis?: (game: Game, humanId: string) => Game;
  /** Étape d'impasse (mode annulation) : construite par TutorialRunner à partir d'une impasse du chapitre */
  deadEnd?: boolean;
}

/**
 * Impasse d'un chapitre : la partie ne permet plus de le terminer (énergie dépensée loin de l'objectif, trace posée
 * ailleurs, carte perdue…). Tant qu'elle est vraie, le tutoriel passe en mode annulation, quelle que soit l'étape.
 * La condition porte sur l'état créé par l'erreur, pour être vraie dès l'action fautive (encore annulable).
 */
export interface TutorialDeadEnd {
  /** Identifiant de la section de texte dans public/docs/tutoriel.md (« annuler-<cause> ») */
  id: string;
  when: (context: TutorialContext) => boolean;
  /** Élément mis en avant (par défaut : l'historique, où se trouve l'annulation) */
  target?: string;
  /** Section de la documentation (par défaut : l'historique) */
  docLink?: string;
}

/** Ce que la préparation d'un chapitre peut savoir du joueur : les espèces qu'il a déjà rencontrées en partie */
export interface ChapterOptions {
  unlockedSpecies: string[];
}

export interface TutorialChapter {
  /** Identifiant : clé de la progression et du chapitre dans public/docs/tutoriel.md */
  id: string;
  /** Graine de la partie (absente : partie normale, « Première vraie partie ») */
  seed?: number;
  /** Chapitre d'une espèce : verrouillé tant que l'espèce n'a pas été découverte dans une vraie partie */
  species?: AlienBoardType;
  /**
   * L'espèce découverte pendant le chapitre reste anonyme à l'écran si le joueur ne l'a pas débloquée
   * (« Traces de vie et espèces » : enseigner la découverte sans dévoiler d'espèce)
   */
  masksSpecies?: boolean;
  /** Ajustements de scénario, appliqués à une copie de la partie après la mise en place */
  adjust?: (game: Game, humanId: string, options: ChapterOptions) => Game;
  /** Commandes du joueur humain jouées avant qu'il prenne la main (tours des adversaires passifs joués entre elles) */
  prepare: TutorialCommand[];
  steps: TutorialStep[];
  /** Impasses du chapitre (mode annulation), vérifiées avant l'étape courante */
  deadEnds?: TutorialDeadEnd[];
  /** Commandes qui terminent toutes les étapes, dans l'ordre (tests) */
  solution: TutorialCommand[];
  /**
   * Réponse de la solution à un choix ouvert par une commande, quand la réponse par défaut ne convient pas (trace sur la
   * piste d'une espèce, secteur d'Oumuamua…) ; undefined : réponse par défaut
   */
  answer?: (game: Game, humanId: string) => Command | undefined;
  /**
   * Écarts que l'explorateur (tutorial/explore.ts) ne doit pas signaler, avec leur raison : faux positifs connus
   * (écart rattrapable autrement que par la suite de la solution)
   */
  explorerAllows?: { deviation: RegExp; stepId?: string; reason: string }[];
}

/** Où en est le joueur dans un chapitre : étapes d'explication validées par « Suivant » */
export interface TutorialState {
  chapterId: string;
  explained: string[];
}
