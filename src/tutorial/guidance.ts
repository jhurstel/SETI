import { ActionType } from '../core/types';
import type { Command } from '../session/commands';
import type { TutorialAction, TutorialChapter, TutorialStep } from './types';

/** Raison affichée sur une action que l'étape en cours ne permet pas */
export const TUTORIAL_BLOCK_REASON = "Tutoriel : suivez l'étape en cours (bulle d'aide)";
/** Raison affichée en mode annulation (impasse) : l'erreur doit rester annulable, le tour ne se termine pas */
export const TUTORIAL_UNDO_REASON = "Tutoriel : annulez l'erreur signalée dans la bulle (ou recommencez le chapitre)";
/** Raison affichée quand l'étape demande de jouer une autre carte */
export const TUTORIAL_CARD_REASON = "Tutoriel : jouez la carte demandée par l'étape en cours (bulle d'aide)";
/** Raison affichée pendant une étape d'explication */
export const TUTORIAL_READ_REASON = 'Tutoriel : lisez l\'étape puis cliquez sur « Suivant »';

/** Action principale (ou fin du tour) que demande une commande ; null pour une action gratuite ou un choix */
export function commandAction(command: Command): TutorialAction | null {
  switch (command.type) {
    case 'LAUNCH_PROBE': return ActionType.LAUNCH_PROBE;
    case 'SCAN': return ActionType.SCAN_SECTOR;
    case 'ANALYZE': return ActionType.ANALYZE_DATA;
    case 'RESEARCH_TECH': return ActionType.RESEARCH_TECH;
    case 'ORBIT': return ActionType.ORBIT;
    case 'LAND': return ActionType.LAND;
    case 'PLAY_CARD': return ActionType.PLAY_CARD;
    case 'PASS': return ActionType.PASS;
    case 'END_TURN': return 'END_TURN';
    default: return null;
  }
}

/**
 * Guidage souple : raison pour laquelle l'étape en cours refuse une action principale (ou la fin du tour),
 * null si elle est permise. En mode annulation, toute action principale et la fin du tour sont refusées. Les actions gratuites, les choix d'une interaction en cours et l'annulation ne sont
 * jamais filtrés ; sans étape (chapitre terminé, partie normale), tout est permis.
 */
export function tutorialBlockReason(step: TutorialStep | null, action: TutorialAction): string | null {
  if (!step) return null;
  if (step.deadEnd) return TUTORIAL_UNDO_REASON;
  if (!step.done) return TUTORIAL_READ_REASON;
  return step.allowedActions?.includes(action) ? null : TUTORIAL_BLOCK_REASON;
}

/** Raison pour laquelle l'étape refuse une commande, null si elle passe */
export function tutorialCommandBlockReason(step: TutorialStep | null, command: Command): string | null {
  const action = commandAction(command);
  if (action === null) return null;
  const reason = tutorialBlockReason(step, action);
  if (reason || command.type !== 'PLAY_CARD' || !step?.allowedCards) return reason;
  return step.allowedCards.includes(command.cardId) ? null : TUTORIAL_CARD_REASON;
}

/** Raison affichée quand le chapitre est terminé : seules les options de la bulle restent possibles */
export const TUTORIAL_FINISHED_REASON = 'Tutoriel : chapitre terminé, choisissez une option dans la bulle';

/**
 * Chapitre terminé : sa position préparée n'a plus rien à apprendre, toute commande est refusée (actions principales,
 * gratuites et fin du tour). « Première vraie partie » (sans position préparée) est une vraie partie : elle continue.
 */
export function tutorialFinishedReason(chapter: TutorialChapter, finished: boolean): string | null {
  return finished && chapter.seed !== undefined ? TUTORIAL_FINISHED_REASON : null;
}
