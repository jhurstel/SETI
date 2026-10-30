import { random, seedRandom, getRandomState, setRandomState } from '../src/core/random';
import { GameFactory } from '../src/core/GameFactory';
import { serializeGame, deserializeGame } from '../src/core/GamePersistence';
import { AITurn } from '../src/ai/AITurn';
import { TurnManager } from '../src/core/TurnManager';
import { GameEngine } from '../src/core/Game';
import { PassAction } from '../src/actions/PassAction';
import { CardSystem } from '../src/systems/CardSystem';
import { Game, GamePhase } from '../src/core/types';
import { createTestGame, mockFetchFromPublic } from './helpers/gameFixture';

/** Mise en place visible d'une partie (sans les identifiants horodatés). */
function setupOf(game: Game) {
  return {
    seed: game.seed,
    firstPlayer: game.firstPlayerIndex,
    deck: game.decks.cards.map(c => c.id),
    row: game.decks.cardRow.map(c => c.id),
    hands: game.players.map(p => p.cards.map(c => c.id)),
    rotation: [game.board.solarSystem.rotationAngleLevel1, game.board.solarSystem.rotationAngleLevel2, game.board.solarSystem.rotationAngleLevel3],
    species: game.species.map(s => s.name),
    sectors: game.board.sectors.map(s => s.color),
    objectives: game.board.objectiveTiles.map(t => t.id),
  };
}

async function robotGame(seed: number): Promise<Game> {
  const fetchSpy = mockFetchFromPublic();
  let game: Game;
  try {
    game = await GameFactory.createGame(['A', 'B'], true, seed);
  } finally {
    fetchSpy.mockRestore();
  }
  game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EASY'; });
  game = GameFactory.initializeGame(game);
  for (let steps = 0; steps < 5000 && game.phase !== GamePhase.FINAL_SCORING; steps++) {
    game = CardSystem.refillCardRow(game);
    const step = AITurn.playStep(game);
    if (step.kind === 'SETUP_RESERVED') game = TurnManager.advanceSetup(step.updatedGame).updatedGame;
    else if (step.kind === 'UPDATED') game = step.updatedGame;
    else if (step.kind === 'END_TURN') game = AITurn.endTurn(game).updatedGame;
    else if (step.kind === 'PASS') {
      const player = game.players[game.currentPlayerIndex];
      game = new GameEngine(game).executeAction(new PassAction(player.id, step.cardsToKeep)).updatedState!;
    } else throw new Error('Robot bloqué');
  }
  return game;
}

describe('Générateur aléatoire à graine', () => {
  test('une même graine redonne la même suite de tirages', () => {
    seedRandom(42);
    const first = [random(), random(), random()];
    seedRandom(42);
    expect([random(), random(), random()]).toEqual(first);
    expect(first.every(x => x >= 0 && x < 1)).toBe(true);
  });

  test('setRandomState reprend la suite là où getRandomState l\'a laissée', () => {
    seedRandom(7);
    random();
    const saved = getRandomState();
    const next = [random(), random()];
    setRandomState(saved);
    expect([random(), random()]).toEqual(next);
  });

  test('une même graine redonne la même mise en place', async () => {
    const a = await createTestGame(['A', 'B', 'C'], 123);
    const b = await createTestGame(['A', 'B', 'C'], 123);
    const c = await createTestGame(['A', 'B', 'C'], 124);

    expect(a.seed).toBe(123);
    expect(setupOf(b)).toEqual(setupOf(a));
    expect(setupOf(c)).not.toEqual(setupOf(a));
  });

  test('une partie entre robots est reproductible avec la même graine', async () => {
    const a = await robotGame(99);
    const b = await robotGame(99);

    expect(a.phase).toBe(GamePhase.FINAL_SCORING);
    expect(a.finalScores?.length).toBe(2);
    expect(b.finalScores).toEqual(a.finalScores);
  }, 120000);

  test('la sauvegarde enregistre l\'état du générateur et le rend à la relecture', async () => {
    const game = await createTestGame();
    seedRandom(5);
    random();
    const state = getRandomState();

    const { rngState, game: restored } = deserializeGame(JSON.stringify(serializeGame(game, [])));

    expect(rngState).toBe(state);
    expect('rngState' in restored).toBe(false);
  });
});
