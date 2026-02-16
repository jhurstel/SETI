import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult, GAME_CONSTANTS } from '../core/types';
import { CardSystem } from '../systems/CardSystem';

export class BuyCardAction extends BaseAction {
    constructor(public playerId: string) {
        super(playerId, ActionType.BUY_CARD);
    }

    validate(game: Game): ValidationResult {
        const player = game.players.find(p => p.id === this.playerId);

        if (!player) {
            return { valid: false, errors: [{ code: 'PLAYER_NOT_FOUND', message: 'Joueur non trouvée' }], warnings: [] };
        }

        if (player.mediaCoverage < GAME_CONSTANTS.BUY_CARD_COST_MEDIA) {
            return { valid: false, errors: [{ code: 'INSUFFICIENT_MEDIAS', message: `Médias insuffisants (Requis: ${GAME_CONSTANTS.BUY_CARD_COST_MEDIA})` }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        const result = CardSystem.buyCard(game, this.playerId, this.cardId);
        this.historyEntries = result.historyEntries;
        this.newPendingInteractions = result.newPendingInteractions;
        return result.updatedGame;
    }
}