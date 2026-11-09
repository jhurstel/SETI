import { AIDifficulty, Game, HistoryEntry } from '../core/types';
import { GameFactory } from '../engine/GameFactory';
import { random } from '../core/random';

/** Une place à la table : un joueur humain ou un robot (avec son niveau) */
export interface SeatConfig {
  name: string;
  type: 'human' | 'robot';
  aiDifficulty?: AIDifficulty;
}

export interface NewGameOptions {
  /** Graine de la partie (tirée au hasard si absente) */
  seed?: number;
  /**
   * Premier joueur : un index de place, 'random' (n'importe quelle place) ou 'randomOther' (une autre place que la
   * première : le joueur humain du jeu local ne commence pas). 0 par défaut.
   */
  firstPlayer?: number | 'random' | 'randomOther';
}

/** Création d'une partie prête pour la session : joueurs, premier joueur, mise en place et journal de départ */
export class GameSetup {
  static async newGame(seats: SeatConfig[], options: NewGameOptions = {}): Promise<{ game: Game; entries: HistoryEntry[] }> {
    const created = await GameFactory.createGame(seats.map(seat => seat.name), true, options.seed);
    seats.forEach((seat, index) => {
      const player = created.players[index];
      player.type = seat.type;
      if (seat.type === 'robot') player.aiDifficulty = seat.aiDifficulty ?? 'EASY';
    });

    // Tirage fait avec le générateur de la partie (déjà amorcé par la graine) : même graine, même premier joueur
    const { firstPlayer = 0 } = options;
    const first = firstPlayer === 'random'
      ? Math.floor(random() * seats.length)
      : firstPlayer === 'randomOther'
        ? (seats.length > 1 ? 1 + Math.floor(random() * (seats.length - 1)) : 0)
        : firstPlayer;
    const game = GameFactory.initializeGame(GameFactory.setFirstPlayer(created, first));
    const entries: HistoryEntry[] = (game.gameLog || []).map(log => ({
      id: log.id,
      message: log.message,
      playerId: log.playerId ?? '',
      timestamp: log.timestamp,
      sequenceId: log.sequenceId,
    }));
    return { game, entries };
  }
}
