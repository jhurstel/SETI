import { Game } from './types';
import { uniqueId } from './ids';

export class Logger {
  static log(game: Game, message: string, playerId?: string): void {
    game.gameLog.push({
      id: `log_${uniqueId()}`,
      message,
      timestamp: Date.now(),
      playerId
    });
  }
}