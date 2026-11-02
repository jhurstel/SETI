import { AIEvaluator } from '../src/ai/AIEvaluator';
import { Game, Mission, Probe, ProbeState } from '../src/core/types';
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

  test('poids propres à un joueur (réglage) : utilisés à la place des poids par défaut', () => {
    const defaults = AIEvaluator.weightsFor(P1);
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
