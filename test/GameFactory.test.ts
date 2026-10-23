import { GAME_CONSTANTS, GamePhase } from '../src/core/types';
import { createTestGame } from './helpers/gameFixture';

describe('GameFactory (partie réelle)', () => {
  test('crée une partie à 2 joueurs prête à jouer', async () => {
    const game = await createTestGame(['Alice', 'Bob']);

    expect(game.phase).toBe(GamePhase.PLAYING);
    expect(game.players).toHaveLength(2);
    game.players.forEach(p => {
      expect(p.cards).toHaveLength(GAME_CONSTANTS.INITIAL_HAND_SIZE);
      expect(p.credits).toBe(GAME_CONSTANTS.INITIAL_CREDITS);
      expect(p.energy).toBe(GAME_CONSTANTS.INITIAL_ENERGY);
    });
    expect(game.decks.cardRow).toHaveLength(3);
  });

  test('prépare un paquet de fin de manche (joueurs + 1 cartes) pour les manches 1 à 4', async () => {
    const game = await createTestGame(['Alice', 'Bob', 'Carol']);
    for (let round = 1; round < GAME_CONSTANTS.MAX_ROUNDS; round++) {
      expect(game.decks.roundDecks[round]).toHaveLength(4);
    }
  });

  test('aucune carte n\'est dupliquée entre pioche, rangée, mains et paquets de manche', async () => {
    const game = await createTestGame();
    const ids = [
      ...game.decks.cards,
      ...game.decks.cardRow,
      ...game.players.flatMap(p => p.cards),
      ...Object.values(game.decks.roundDecks).flat(),
    ].map(c => c.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test('refuse un nombre de joueurs invalide', async () => {
    await expect(createTestGame(['Solo'])).rejects.toThrow('Nombre de joueurs invalide');
  });
});
