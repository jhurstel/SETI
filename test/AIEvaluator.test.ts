import { AIEvaluator, DEFAULT_WEIGHTS, WEIGHTS_BY_PLAYER_COUNT } from '../src/ai/AIEvaluator';
import { Game, Mission, Probe, ProbeState } from '../src/core/types';
import { ScoreManager } from '../src/engine/ScoreManager';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

const capsule = (disk: 'A' | 'B' | 'C' | 'D' | 'E', sector: number): Probe => ({
  id: `cap-${disk}${sector}`,
  ownerId: P1,
  position: { x: 0, y: 0 },
  solarPosition: { disk, sector, level: 0 },
  state: ProbeState.CAPSULE,
  isOrbiter: false,
  isLander: false,
  planetId: 'jupiter',
  specimen: { bonus: { pv: 3 } },
} as Probe);

const marsMission = (): Mission => ({
  id: 'm', cardId: 'c', name: 'Laboratoire Martien', description: '', ownerId: P1,
  requirements: [{ id: 'r', type: 'GAIN_IF_SPECIMEN', value: 'GAIN_IF_SPECIMEN:mars:specimen:2', target: 'mars' }],
  completedRequirementIds: [], fulfillableRequirementIds: [], completed: false,
});

describe('AIEvaluator', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  test('joueur inconnu : 0', () => {
    expect(AIEvaluator.evaluate(game, 'inconnu')).toBe(0);
  });

  test('une capsule augmente la valeur de la position, sans modifier la partie', () => {
    const before = AIEvaluator.evaluate(game, P1);
    getPlayer(game, P1).probes = [capsule('E', 1)];
    const snapshot = JSON.stringify(game);
    expect(AIEvaluator.evaluate(game, P1)).toBeGreaterThan(before);
    expect(JSON.stringify(game)).toBe(snapshot);
  });

  test('capsule : Mars compte comme destination avec le Laboratoire Martien (jamais moins de valeur)', () => {
    getPlayer(game, P1).probes = [capsule('E', 1)];
    const earthOnly = AIEvaluator.evaluate(game, P1);
    getPlayer(game, P1).missions = [marsMission()];
    expect(AIEvaluator.evaluate(game, P1)).toBeGreaterThanOrEqual(earthOnly);
  });

  test('poids selon le nombre de joueurs de la partie, DEFAULT_WEIGHTS pour un autre nombre', () => {
    for (const count of [2, 3, 4]) {
      const sized = { ...game, players: Array.from({ length: count }, (_, i) => game.players[i % game.players.length]) };
      expect(AIEvaluator.weightsFor(sized, P1)).toBe(WEIGHTS_BY_PLAYER_COUNT[count]);
    }
    expect(AIEvaluator.weightsFor({ ...game, players: [game.players[0]] }, P1)).toBe(DEFAULT_WEIGHTS);
  });

  describe('selon la manche et la passe', () => {
    const credits = (g: Game, n: number) => { const copy = JSON.parse(JSON.stringify(g)) as Game; getPlayer(copy, P1).credits += n; return copy; };
    afterEach(() => AIEvaluator.weightOverrides.clear());

    test('dernière manche : passer fait perdre la valeur des ressources, chaque passe coûte passCost', () => {
      AIEvaluator.weightOverrides.set(P1, { ...AIEvaluator.weightsFor(game, P1), lastRoundPassFactor: 0, passCost: 2 });
      game.currentRound = game.maxRounds;
      const snapshot = JSON.stringify(game);
      expect(AIEvaluator.passValue(game, P1)).toBeCloseTo(AIEvaluator.evaluate(game, P1, true) - 2);
      // Les crédits gardés comptent encore en jouant, plus après la passe
      expect(AIEvaluator.evaluate(credits(game, 10), P1)).toBeGreaterThan(AIEvaluator.evaluate(game, P1));
      expect(AIEvaluator.passValue(credits(game, 10), P1)).toBeCloseTo(AIEvaluator.passValue(game, P1));
      expect(JSON.stringify(game)).toBe(snapshot);
    });

    test('avant la dernière manche : la passe garde les ressources, moins passCost', () => {
      AIEvaluator.weightOverrides.set(P1, { ...AIEvaluator.weightsFor(game, P1), lastRoundPassFactor: 0, passCost: 1.5 });
      game.currentRound = 2;
      expect(AIEvaluator.passValue(game, P1)).toBeCloseTo(AIEvaluator.evaluate(game, P1) - 1.5);
    });

    test('ressources et décompte final pondérés selon la manche', () => {
      const base = AIEvaluator.weightsFor(game, P1);
      AIEvaluator.weightOverrides.set(P1, { ...base, resourceRound2: 1, resourceRound3: 3 });
      const gain = (round: number) => { game.currentRound = round; return AIEvaluator.evaluate(credits(game, 10), P1) - AIEvaluator.evaluate(game, P1); };
      expect(gain(3)).toBeCloseTo(3 * gain(2));
      game.currentRound = 4;
      const spy = jest.spyOn(ScoreManager, 'calculateFinalScore').mockReturnValue({ missionEndGame: 0, objectiveTiles: 10, speciesBonuses: 0, exertienCards: 0, total: 10 });
      try {
        const projected = AIEvaluator.evaluate(game, P1);
        AIEvaluator.weightOverrides.set(P1, { ...base, resourceRound2: 1, resourceRound3: 3, endGameRound4: 0 });
        expect(projected - AIEvaluator.evaluate(game, P1)).toBeCloseTo(10 * base.endGameRound4);
      } finally {
        spy.mockRestore();
      }
    });
  });

  test('poids propres à un joueur (réglage) : utilisés à la place des poids par défaut', () => {
    const defaults = AIEvaluator.weightsFor(game, P1);
    AIEvaluator.weightOverrides.set(P1, { ...defaults, capsule: defaults.capsule + 50 });
    try {
      getPlayer(game, P1).probes = [capsule('E', 1)];
      const boosted = AIEvaluator.evaluate(game, P1);
      AIEvaluator.weightOverrides.clear();
      expect(boosted).toBeGreaterThan(AIEvaluator.evaluate(game, P1));
    } finally {
      AIEvaluator.weightOverrides.clear();
    }
  });
});
