import { Game } from './types';

export class Logger {
  static log(game: Game, message: string, playerId?: string): void {
    if (!game.gameLog) {
      game.gameLog = [];
    }
    game.gameLog.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      timestamp: Date.now(),
      playerId
    });
  }
}