import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult } from '../core/types';
import { CardSystem } from '../systems/CardSystem';

export class PlayCardAction extends BaseAction {
    constructor(public playerId: string, public cardId: string) {
        super(playerId, ActionType.PLAY_CARD);
    }

    validate(game: Game): ValidationResult {
        const player = game.players.find(p => p.id === this.playerId);
        const card = player?.cards.find(c => c.id === this.cardId);

        if (!player || !card) {
            return { valid: false, errors: [{ code: 'CARD_NOT_FOUND', message: 'Carte non trouvée' }], warnings: [] };
        }

        if (player.credits < card.cost) {
            return { valid: false, errors: [{ code: 'INSUFFICIENT_CREDITS', message: `Crédits insuffisants (Requis: ${card.cost})` }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        const result = CardSystem.playCard(game, this.playerId, this.cardId);
        return result.updatedGame;
    }
}
