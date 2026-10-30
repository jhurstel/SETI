import { Game } from './types';
import { uniqueId } from './ids';

export class Logger {
  static log(game: Game, message: string, playerId?: string): void {
    if (!game.gameLog) {
      game.gameLog = [];
    }
    game.gameLog.push({
      id: `log_${uniqueId()}`,
      message,
      timestamp: Date.now(),
      playerId
    });
  }
}