import { GamePhase } from '../src/core/types';
import { TurnManager } from '../src/engine/TurnManager';
import { createTestGame } from './helpers/gameFixture';

describe('TurnManager.roundFirstPlayer', () => {
  test('premier joueur de chaque manche passée ou en cours, y compris au décompte final', async () => {
    let game = await createTestGame(['Alice', 'Bob', 'Carol']);
    game.firstPlayerIndex = 1;
    game.currentPlayerIndex = 1;
    const snapshot = JSON.stringify(game);
    expect(TurnManager.roundFirstPlayer(game, 1).name).toBe('Bob');
    expect(JSON.stringify(game)).toBe(snapshot);

    // Trois fins de manche : le premier joueur tourne d'une place à chaque fois
    for (let i = 0; i < 3; i++) game = TurnManager.endRound(game);
    expect(game.currentRound).toBe(4);
    expect(TurnManager.roundFirstPlayer(game, 1).name).toBe('Bob');
    expect(TurnManager.roundFirstPlayer(game, 2).name).toBe('Carol');
    expect(TurnManager.roundFirstPlayer(game, 3).name).toBe('Alice');
    expect(TurnManager.roundFirstPlayer(game, 4).name).toBe('Bob');

    // Fin de la dernière manche : la rotation a encore lieu, la manche reste la 5e
    game = TurnManager.endRound(TurnManager.endRound(game));
    expect(game.phase).toBe(GamePhase.FINAL_SCORING);
    expect(game.currentRound).toBe(5);
    expect(TurnManager.roundFirstPlayer(game, 5).name).toBe('Carol');
    expect(TurnManager.roundFirstPlayer(game, 1).name).toBe('Bob');
  });
});
