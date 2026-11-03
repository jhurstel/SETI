import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult, CostType } from '../core/types';
import { CardSystem } from '../systems/CardSystem';

export class PlayCardAction extends BaseAction {
    constructor(playerId: string, public cardId: string) {
        super(playerId, ActionType.PLAY_CARD);
    }

    validate(game: Game): ValidationResult {
        const player = game.players.find(p => p.id === this.playerId);
        const card = player?.cards.find(c => c.id === this.cardId);

        if (!player || !card) {
            return { valid: false, errors: [{ code: 'CARD_NOT_FOUND', message: 'Carte non trouvée' }], warnings: [] };
        }

        // Coût en énergie (cartes Centauriens…) ou en crédits : même vérification que CardSystem.canPlayCard
        if (card.costType === CostType.ENERGY) {
            if (player.energy < card.cost) {
                return { valid: false, errors: [{ code: 'INSUFFICIENT_ENERGY', message: `Énergie insuffisante (Requis: ${card.cost})` }], warnings: [] };
            }
        } else if (player.credits < card.cost) {
            return { valid: false, errors: [{ code: 'INSUFFICIENT_CREDITS', message: `Crédits insuffisants (Requis: ${card.cost})` }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        const result = CardSystem.playCard(game, this.playerId, this.cardId);
        this.historyEntries = result.historyEntries;
        this.newPendingInteractions = result.newPendingInteractions;
        return result.updatedGame;
    }
}
