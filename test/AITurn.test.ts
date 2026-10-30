import { AITurn } from '../src/ai/AITurn';
import * as randomModule from '../src/core/random';
import { GameEngine } from '../src/core/Game';
import { GameFactory } from '../src/core/GameFactory';
import { TurnManager } from '../src/core/TurnManager';
import { PassAction } from '../src/actions/PassAction';
import { CardSystem } from '../src/systems/CardSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { AIEvaluator, DEFAULT_WEIGHTS } from '../src/ai/AIEvaluator';
import { AIBehavior } from '../src/ai/AIBehavior';
import { ScoreManager } from '../src/core/ScoreManager';
import { createRotationState, getAbsoluteSectorForProbe } from '../src/core/SolarSystemPosition';
import { AIDifficulty, Game, GamePhase, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { giveCard, makeCard, mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

/** Partie en phase SETUP dont tous les joueurs sont des robots (graine fixe : même partie à chaque exécution). */
async function createRobotGame(names: string[], levels: AIDifficulty[] = [], seed: number = TEST_SEED): Promise<Game> {
  const fetchSpy = mockFetchFromPublic();
  try {
    const game = await GameFactory.createGame(names, true, seed);
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

  test("un robot intermédiaire échange des ressources quand c'est ce qui lui permet de jouer une carte rentable", async () => {
    const game = playRobotGame(await createRobotGame(['R1', 'R2'], ['MEDIUM', 'MEDIUM']), 2).game;
    const robot = game.players[game.currentPlayerIndex];
    // Carte à 3 crédits pour 2 crédits en main : 2 énergies → 1 crédit la rend jouable
    const rich = makeCard('rich', { cost: 3, immediateEffects: [{ type: 'GAIN', target: 'DATA', value: 3 }, { type: 'ACTION', target: 'LIFETRACE', value: { amount: 2, scope: LifeTraceType.ANY } }] });
    Object.assign(robot, { credits: 2, energy: 2, mediaCoverage: 0, data: 0, cards: [rich], missions: [] });

    const step = AITurn.playStep(game);
    expect(step.kind).toBe('UPDATED');
    if (step.kind !== 'UPDATED') return;
    const messages = step.historyEntries.map(e => e.message);
    expect(messages[0]).toMatch(/^échange 2 .* contre 1 /);
    expect(messages.some(m => m.includes('pour jouer carte "Carte rich"'))).toBe(true);
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

  test('un robot débutant joue une action principale qui améliore sa position, tirée parmi les meilleures', async () => {
    const started = playRobotGame(await createRobotGame(['R1', 'R2'], ['EASY', 'EASY']), 2).game;
    const player = started.players[started.currentPlayerIndex];
    const before = AIEvaluator.evaluate(started, player.id);

    // Tirage haut : aucune action gratuite au hasard, et la 3e meilleure action principale
    const randomSpy = jest.spyOn(randomModule, 'random').mockReturnValue(0.99);
    const step = AITurn.playStep(started);
    randomSpy.mockRestore();

    expect(step.kind).toBe('UPDATED');
    if (step.kind !== 'UPDATED') return;
    expect(step.updatedGame.players.find(p => p.id === player.id)!.hasPerformedMainAction).toBe(true);
    expect(AIEvaluator.evaluate(step.updatedGame, player.id)).toBeGreaterThan(before);
  });

  test("un robot expert compte dans sa position une part des points du décompte final (partielle avant la dernière manche)", async () => {
    const game = await createRobotGame(['R1', 'R2'], ['EXPERT', 'MEDIUM']);
    const [expert, medium] = game.players;
    const finalSpy = jest.spyOn(ScoreManager, 'calculateFinalScore').mockReturnValue({ missionEndGame: 4, objectiveTiles: 6, speciesBonuses: 0, exertienCards: 0, total: 10 });

    const withProjection = AIEvaluator.evaluate(game, expert.id);
    expert.aiDifficulty = 'MEDIUM';
    const withoutProjection = AIEvaluator.evaluate(game, expert.id);
    const mediumValue = AIEvaluator.evaluate(game, medium.id);
    const calls = finalSpy.mock.calls.length;
    finalSpy.mockRestore();

    expect(withProjection - withoutProjection).toBeCloseTo(10 * DEFAULT_WEIGHTS.endGameBefore);
    expect(calls).toBe(1); // l'Intermédiaire n'anticipe pas le décompte final
    expect(mediumValue).toBeGreaterThan(0);
  });

  test("l'évaluation compte la carte Alien promise par la 1re trace d'une couleur, selon l'avancement de la découverte", async () => {
    const game = await createRobotGame(['R1', 'R2'], ['MEDIUM', 'MEDIUM']);
    const [p1, p2] = game.players;
    const board = game.board.alienBoards[0];
    const trace = (type: LifeTraceType, playerId: string) => ({ id: `${type}-${playerId}`, type, playerId, location: LifeTraceLocation.TRIANGLE });

    board.lifeTraces = [trace(LifeTraceType.RED, p2.id), trace(LifeTraceType.YELLOW, p2.id)];
    const withoutClaim = AIEvaluator.evaluate(game, p1.id);
    board.lifeTraces = [trace(LifeTraceType.RED, p1.id), trace(LifeTraceType.YELLOW, p2.id)];
    const withClaim = AIEvaluator.evaluate(game, p1.id);
    // 1 couleur à soi, 2 couleurs sur 3 présentes ; la trace elle-même n'est pas dans player.lifeTraces ici
    expect(withClaim - withoutClaim).toBeCloseTo(DEFAULT_WEIGHTS.discoveryClaim * 2 / 3);

    board.isDiscovered = true;
    expect(AIEvaluator.evaluate(game, p1.id)).toBeCloseTo(withoutClaim);
  });

  test("l'évaluation compte la majorité d'un secteur selon son remplissage et son bonus de couverture", async () => {
    const game = await createRobotGame(['R1', 'R2'], ['MEDIUM', 'MEDIUM']);
    const [p1, p2] = game.players;
    const sector = game.board.sectors.find(s => !s.isCovered)!;
    sector.firstBonus = { pv: 3, lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] };
    const mark = (owners: string[]) => sector.signals.forEach((s, i) => {
      s.marked = i < owners.length;
      s.markedBy = owners[i];
    });

    mark([p1.id, p2.id, p2.id]);
    const behind = AIEvaluator.evaluate(game, p1.id);
    mark([p1.id, p1.id, p2.id]);
    const ahead = AIEvaluator.evaluate(game, p1.id);

    // Un signal de plus, et la majorité : part du bonus (3 PV + 1 trace) selon le remplissage
    const fill = 3 / sector.signals.length;
    const w = DEFAULT_WEIGHTS;
    expect(ahead - behind).toBeCloseTo(w.signal + fill * w.sectorLead * (3 + w.sectorLifeTraceValue));
  });

  test('tirages comparés pour les choix aléatoires : 2 pour le débutant, 4 pour un robot stratégique', async () => {
    const game = await createRobotGame(['R1', 'R2', 'R3'], ['EASY', 'MEDIUM', 'PASS']);
    expect(game.players.map(p => AIBehavior.choiceSamples(p))).toEqual([2, 4, 1]);
  });

  test('playStep ne modifie pas la partie reçue', async () => {
    const started = playRobotGame(await createRobotGame(['R1', 'R2']), 2).game; // les deux réservations
    const snapshot = JSON.stringify(started);
    for (let i = 0; i < 20; i++) AITurn.playStep(started);
    expect(JSON.stringify(started)).toBe(snapshot);
  });
});
