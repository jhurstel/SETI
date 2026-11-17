import { Bonus, GAME_CONSTANTS, Game, InteractionState, Signal } from '../../core/types';
import { SLOT_COLORS } from '../styles/slotColors';

/** État affiché d'une case de signal (secteurs et secteur d'Oumuamua) : même message partout */
export interface SignalSlotState {
  status: string;
  color: string;
  note: string | null;
  /** Coût affiché sur la ligne du bonus (case à scanner maintenant) */
  cost?: Bonus;
}

/**
 * Texte de l'infobulle d'une case de signal :
 * - marquée (par qui) ; indisponible car le signal précédent manque ;
 * - pendant le choix d'un secteur : cliquable ;
 * - case qu'un scan marquerait maintenant (celle qui pulse : secteur de la Terre, ou adjacent avec Observation I) :
 *   disponible, avec le coût du scan sur la ligne du bonus ; sans les ressources du scan : ressources insuffisantes ;
 * - toute autre prochaine case : indisponible pour l'instant, elle se marque par un scan ou un signal.
 */
export function signalSlotState(game: Game, interactionState: InteractionState, signal: Signal, isDisabled: boolean, isSectorClickable: boolean, scannable: boolean): SignalSlotState {
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (signal.marked) {
    const markerPlayer = game.players.find(p => p.id === signal.markedBy);
    return { status: `Marqué par ${markerPlayer?.name || 'Inconnu'}`, color: markerPlayer?.color || '#ccc', note: null };
  }
  if (isDisabled) return { status: 'Indisponible', color: SLOT_COLORS.unavailable, note: 'Nécessite le signal précédent' };
  if (isSectorClickable && interactionState.type === 'SELECTING_SCAN_SECTOR') {
    return { status: 'Disponible', color: SLOT_COLORS.available, note: 'Cliquez pour marquer le signal' };
  }
  const scanCost: Bonus = { credits: GAME_CONSTANTS.SCAN_COST_CREDITS, energy: GAME_CONSTANTS.SCAN_COST_ENERGY };
  if (scannable) return { status: 'Disponible', color: SLOT_COLORS.available, note: 'Scannez pour envoyer un signal', cost: scanCost };
  const canAffordScan = currentPlayer.credits >= GAME_CONSTANTS.SCAN_COST_CREDITS && currentPlayer.energy >= GAME_CONSTANTS.SCAN_COST_ENERGY;
  if (isSectorClickable && !canAffordScan && interactionState.type === 'IDLE') {
    return {
      status: 'Ressources insuffisantes', color: SLOT_COLORS.unavailable, cost: scanCost,
      note: `Vous avez ${currentPlayer.credits} crédit(s) et ${currentPlayer.energy} énergie(s)`,
    };
  }
  return { status: 'Indisponible', color: SLOT_COLORS.unavailable, note: 'Nécessite un scan ou un signal' };
}
