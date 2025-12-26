/**
 * Action : Jouer une carte
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { CardSystem } from '../systems/CardSystem';

export class PlayCardAction extends BaseAction {
  constructor(
    playerId: string,
    public cardId: string
  ) {
    super(ActionType.PLAY_CARD, playerId);
  }

  validate(game: Game): ValidationResult {
    const validation = CardSystem.canPlayCard(game, this.playerId, this.cardId);
    
    if (!validation.canPlay) {
      return this.createInvalidResult(validation.reason || 'Jouer la carte impossible');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    const result = CardSystem.playCard(game, this.playerId, this.cardId);
    return result.updatedGame;
  }
}

