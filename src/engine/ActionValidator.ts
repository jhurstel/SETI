import { ActionType, Game, GamePhase, MAIN_ACTION_TYPES, ProbeState, ValidationError, ValidationResult } from '../core/types';
import { BaseAction } from '../actions/Action';
import { requirePlayer } from '../core/players';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { CardSystem } from '../systems/CardSystem';
import { TechnologySystem } from '../systems/TechnologySystem';

/** Les huit actions principales du plateau joueur */
export type MainActionType = ActionType.LAUNCH_PROBE | ActionType.ORBIT | ActionType.LAND | ActionType.SCAN_SECTOR
  | ActionType.ANALYZE_DATA | ActionType.PLAY_CARD | ActionType.RESEARCH_TECH | ActionType.PASS;

/** Action principale possible maintenant, ou raison qui l'empêche (affichable telle quelle) */
export interface ActionAvailability {
  available: boolean;
  reason?: string;
}

export class ActionValidator {
  /**
   * Refus commun aux commandes d'un joueur (partie terminée, tour, passe, action principale déjà faite),
   * partagé par la validation d'une action et la disponibilité des actions principales
   */
  private static generalRefusal(game: Game, playerId: string, isMainAction: boolean): ValidationError | null {
    // Plus aucune action une fois la partie terminée
    if (game.phase === GamePhase.FINAL_SCORING) return { code: 'GAME_OVER', message: 'La partie est terminée' };
    if (game.currentPlayerIndex < 0 || game.currentPlayerIndex >= game.players.length) return { code: 'INVALID_TURN', message: 'Tour invalide' };
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return { code: 'NOT_PLAYER_TURN', message: 'Ce n\'est pas votre tour' };
    if (currentPlayer.hasPassed) return { code: 'PLAYER_PASSED', message: 'Vous avez déjà passé ce tour' };
    if (isMainAction && currentPlayer.hasPerformedMainAction) {
      return { code: 'MAIN_ACTION_ALREADY_PERFORMED', message: 'Vous avez déjà effectué votre action principale pour ce tour' };
    }
    return null;
  }

  /**
   * Valide une action avant son exécution
   */
  static validateAction(game: Game, action: BaseAction): ValidationResult {
    const refusal = this.generalRefusal(game, action.playerId, MAIN_ACTION_TYPES.includes(action.type));
    if (refusal) return { valid: false, errors: [refusal], warnings: [] };

    // Valider l'action elle-même
    return action.validate(game);
  }

  /**
   * Disponibilité de chaque action principale pour un joueur, avec la raison d'un refus : mêmes vérifications que
   * la session (partie commencée, interaction en cours) et que la validation de l'action, avant le choix d'une cible
   * (orbite et atterrissage : possibles si l'une des sondes du système solaire le permet).
   */
  static mainActionAvailability(game: Game, playerId: string): Record<MainActionType, ActionAvailability> {
    let general = this.generalRefusal(game, playerId, true)?.message;
    if (!general && game.phase !== GamePhase.PLAYING) general = 'La partie n\'a pas commencé';
    if (!general && game.interaction) general = 'Terminez d\'abord l\'action en cours';

    /** Règle propre à l'action, après les refus généraux : raison du moteur en cas de refus */
    const rule = (check: () => string | null): ActionAvailability => {
      const reason = general ?? check();
      return reason ? { available: false, reason } : { available: true };
    };
    const probeRule = (mode: 'orbit' | 'land') => () => {
      const probes = requirePlayer(game, playerId).probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
      if (probes.length === 0) return 'Nécessite une sonde dans le système solaire';
      const checks = probes.map(p => {
        if (mode === 'orbit') {
          const res = ProbeSystem.canOrbit(game, playerId, p.id);
          return res.canOrbit ? null : res.reason;
        }
        const res = ProbeSystem.canLand(game, playerId, p.id);
        return res.canLand ? null : res.reason;
      });
      return checks.some(reason => reason === null) ? null : checks[0];
    };

    return {
      [ActionType.LAUNCH_PROBE]: rule(() => { const r = ProbeSystem.canLaunchProbe(game, playerId); return r.canLaunch ? null : r.reason; }),
      [ActionType.ORBIT]: rule(probeRule('orbit')),
      [ActionType.LAND]: rule(probeRule('land')),
      [ActionType.SCAN_SECTOR]: rule(() => { const r = ScanSystem.canScanSector(game, playerId); return r.canScan ? null : r.reason; }),
      [ActionType.ANALYZE_DATA]: rule(() => { const r = ComputerSystem.canAnalyzeData(game, playerId); return r.canAnalyze ? null : r.reason; }),
      [ActionType.PLAY_CARD]: rule(() => { const r = CardSystem.canPlayCards(game, playerId); return r.canPlay ? null : r.reason; }),
      [ActionType.RESEARCH_TECH]: rule(() => { const r = TechnologySystem.canResearchTech(game, playerId); return r.canResearch ? null : r.reason; }),
      [ActionType.PASS]: rule(() => null),
    };
  }
}
