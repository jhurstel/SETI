/**
 * Aide au contexte de « Première vraie partie » : situations clés détectées sur la partie (fonctions pures).
 * Chaque aide s'affiche une fois (l'interface retient celles déjà vues) ; son texte est dans public/docs/tutoriel.md,
 * chapitre « aides-contexte », une section par aide (même identifiant).
 */
import { GAME_CONSTANTS, Game, GOLDEN_MILESTONES } from '../core/types';
import { requirePlayer } from '../core/players';
import { ComputerSystem } from '../systems/ComputerSystem';

/** Chapitre de tutoriel.md qui porte les textes des aides */
export const CONTEXT_HINTS_TEXT_ID = 'aides-contexte';

export interface ContextHint {
  id: string;
  /** La situation est là pour le joueur humain */
  applies: (game: Game, humanId: string) => boolean;
  /** Identifiant d'un titre de public/docs/documentation.md */
  docLink?: string;
}

/** Points d'avance avant un palier doré à partir desquels l'aide le signale */
const MILESTONE_WARNING = 5;

export const CONTEXT_HINTS: ContextHint[] = [
  {
    id: 'analyse-possible',
    applies: (game, humanId) => ComputerSystem.canAnalyzeData(game, humanId).canAnalyze && !requirePlayer(game, humanId).hasPerformedMainAction,
    docLink: '2-4-ordinateur-et-analyse',
  },
  {
    id: 'donnees-pleines',
    applies: (game, humanId) => requirePlayer(game, humanId).data >= GAME_CONSTANTS.MAX_DATA,
    docLink: '2-4-ordinateur-et-analyse',
  },
  {
    id: 'palier-proche',
    applies: (game, humanId) => {
      const player = requirePlayer(game, humanId);
      return GOLDEN_MILESTONES.some(m => !player.claimedGoldenMilestones.includes(m) && player.score < m && player.score >= m - MILESTONE_WARNING);
    },
    docLink: '2-9-paliers-et-fin-de-partie',
  },
  {
    id: 'espece-decouverte',
    applies: game => game.board.alienBoards.some(board => board.isDiscovered),
    docLink: '2-7-traces-de-vie-et-especes',
  },
  {
    id: 'derniere-manche',
    applies: game => game.currentRound === game.maxRounds,
    docLink: '2-9-paliers-et-fin-de-partie',
  },
];

/**
 * Première aide à montrer : c'est au joueur humain de jouer (aucun choix en cours), la situation est là et l'aide
 * n'a pas encore été vue ; null sinon.
 */
export function nextContextHint(game: Game, humanId: string, shown: string[]): ContextHint | null {
  if (game.players[game.currentPlayerIndex].id !== humanId || game.interaction) return null;
  return CONTEXT_HINTS.find(hint => !shown.includes(hint.id) && hint.applies(game, humanId)) ?? null;
}
