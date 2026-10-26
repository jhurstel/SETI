import { AITurn } from '../src/ai/AITurn';
import { GameEngine } from '../src/core/Game';
import { GameFactory } from '../src/core/GameFactory';
import { TurnManager } from '../src/core/TurnManager';
import { PassAction } from '../src/actions/PassAction';
import { CardSystem } from '../src/systems/CardSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { AIEvaluator } from '../src/ai/AIEvaluator';
import { createRotationState, getAbsoluteSectorForProbe } from '../src/core/SolarSystemPosition';
import { AIDifficulty, Game, GamePhase } from '../src/core/types';
import { giveCard, mockFetchFromPublic } from './helpers/gameFixture';

/** Partie en phase SETUP dont tous les joueurs sont des robots. */
async function createRobotGame(names: string[], levels: AIDifficulty[] = []): Promise<Game> {
  const fetchSpy = mockFetchFromPublic();
  try {
    const game = await GameFactory.createGame(names);
    game.players.forEach((p, i) => {
      p.type = 'robot';
      p.aiDifficulty = levels[i];
    });
    return GameFactory.initializeGame(game);
  } finally {
    fetchSpy.mockRestore();
  }
}

/**
 * Reproduit la boucle de useAITurn sans React : une étape de robot à la fois,
 * plus le remplissage de la rangée que fait l'interface quand rien n'est en cours.
 */
function playRobotGame(initial: Game, maxSteps = 5000): { game: Game; steps: number } {
  let game = initial;
  let steps = 0;
  for (; steps < maxSteps && game.phase !== GamePhase.FINAL_SCORING; steps++) {
    game = CardSystem.refillCardRow(game);
    const step = AITurn.playStep(game);
    switch (step.kind) {
      case 'WAIT':
        throw new Error(`Robot bloqué (étape ${steps}, manche ${game.currentRound})`);
      case 'SETUP_RESERVED':
        game = TurnManager.advanceSetup(step.updatedGame).updatedGame;
        break;
      case 'UPDATED':
        game = step.updatedGame;
        break;
      case 'END_TURN':
        game = AITurn.endTurn(game).updatedGame;
        break;
      case 'PASS': {
        const player = game.players[game.currentPlayerIndex];
        const result = new GameEngine(game).executeAction(new PassAction(player.id, step.cardsToKeep));
        if (!result.success || !result.updatedState) throw new Error(`Passe refusée : ${result.error}`);
        game = result.updatedState;
        break;
      }
    }
  }
  return { game, steps };
}

describe('AITurn (parties complètes entre robots)', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test.each([2, 3, 4])('une partie à %i robots va jusqu\'au décompte final', async (playerCount) => {
    const names = ['R1', 'R2', 'R3', 'R4'].slice(0, playerCount);
    const game = await createRobotGame(names);
    expect(game.phase).toBe(GamePhase.SETUP);

    const result = playRobotGame(game);

    expect(result.game.phase).toBe(GamePhase.FINAL_SCORING);
    expect(result.game.currentRound).toBe(result.game.maxRounds);
    expect(result.game.finalScores).toHaveLength(playerCount);
    result.game.players.forEach(p => {
      expect(p.score).toBe(result.game.finalScores!.find(s => s.playerId === p.id)!.finalScore);
    });
    expect(result.steps).toBeLessThan(5000);
  }, 60000);

  test("une partie entre robots intermédiaires et débutants va jusqu'au décompte final", async () => {
    const game = await createRobotGame(['R1', 'R2', 'R3'], ['MEDIUM', 'EASY', 'MEDIUM']);
    const result = playRobotGame(game);

    expect(result.game.phase).toBe(GamePhase.FINAL_SCORING);
    expect(result.game.finalScores).toHaveLength(3);
  }, 120000);

  test('un robot intermédiaire ne modifie pas la partie reçue', async () => {
    const started = playRobotGame(await createRobotGame(['R1', 'R2'], ['MEDIUM', 'MEDIUM']), 2).game;
    const snapshot = JSON.stringify(started);
    for (let i = 0; i < 3; i++) AITurn.playStep(started);
    expect(JSON.stringify(started)).toBe(snapshot);
  }, 60000);

  test("un robot valide un objectif de mission GAIN_ON_… réalisable (Temps de Télescope)", async () => {
    let game = playRobotGame(await createRobotGame(['R1', 'R2'], ['MEDIUM', 'MEDIUM']), 2).game;
    const robot = game.players[game.currentPlayerIndex];
    giveCard(game, robot.id, '101');
    game.players.find(p => p.id === robot.id)!.credits = 10;
    game = CardSystem.playCard(game, robot.id, '101').updatedGame;
    game = ScanSystem.performScanAction(game, true, 'seq', 'sector_1').updatedGame;
    const missionOf = (g: Game) => g.players.find(p => p.id === robot.id)!.missions.find(m => m.cardId === '101')!;
    expect(missionOf(game).fulfillableRequirementIds.length).toBeGreaterThan(0);

    const step = AITurn.playStep(game);
    expect(step.kind).toBe('UPDATED');
    if (step.kind !== 'UPDATED') return;
    expect(missionOf(step.updatedGame).completedRequirementIds).toHaveLength(1);
    expect(missionOf(step.updatedGame).fulfillableRequirementIds).toEqual([]);
  }, 60000);

  test('un robot débutant rapproche sa capsule de la Terre', async () => {
    const game = playRobotGame(await createRobotGame(['R1', 'R2'], ['EASY', 'EASY']), 2).game;
    const robot = game.players[game.currentPlayerIndex];
    robot.energy = 5;
    const capsule = ProbeSystem.createCapsule(game, robot.id, 'jupiter', { bonus: { pv: 3 } })!;
    const solar = game.board.solarSystem;
    const rotation = createRotationState(solar.rotationAngleLevel1, solar.rotationAngleLevel2, solar.rotationAngleLevel3);
    const distance = (g: Game) => {
      const c = g.players.find(p => p.id === robot.id)!.probes.find(p => p.id === capsule.id)!;
      return AIEvaluator.distanceToPlanet(c.solarPosition.disk, getAbsoluteSectorForProbe(c.solarPosition, rotation), rotation, solar.extraCelestialObjects, 'earth');
    };

    const step = AITurn.playStep(game);
    expect(step.kind).toBe('UPDATED');
    if (step.kind !== 'UPDATED') return;
    expect(distance(step.updatedGame)).toBe(distance(game) - 1);
  });

  test('la mise en place : chaque robot réserve une carte puis la partie démarre', async () => {
    let game = await createRobotGame(['R1', 'R2']);
    for (let i = 0; i < 2; i++) {
      const step = AITurn.playStep(game);
      expect(step.kind).toBe('SETUP_RESERVED');
      if (step.kind !== 'SETUP_RESERVED') return;
      game = TurnManager.advanceSetup(step.updatedGame).updatedGame;
    }
    expect(game.phase).toBe(GamePhase.PLAYING);
    expect(game.players.every(p => p.reservedCards.length === 1)).toBe(true);
  });

  test('playStep ne modifie pas la partie reçue', async () => {
    const started = playRobotGame(await createRobotGame(['R1', 'R2']), 2).game; // les deux réservations
    const snapshot = JSON.stringify(started);
    for (let i = 0; i < 20; i++) AITurn.playStep(started);
    expect(JSON.stringify(started)).toBe(snapshot);
  });
});
