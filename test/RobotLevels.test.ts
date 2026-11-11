import { AIBehavior, LEVEL_LOOKAHEAD, LEVEL_TEMPERATURE, NOISE_WINDOW } from '../src/ai/AIBehavior';
import { AIEvaluator } from '../src/ai/AIEvaluator';
import { AITurn } from '../src/ai/AITurn';
import { seedRandom, withRandomState } from '../src/core/random';
import { ActionType, Game, GamePhase } from '../src/core/types';
import { createTestGame } from './helpers/gameFixture';

/** Niveaux des robots : même évaluation, seule l'hésitation entre les bonnes actions change (température) */
describe('niveaux des robots', () => {
  const options = [{ value: 10, item: 'meilleure' }, { value: 9, item: 'proche' }, { value: 2, item: 'mauvaise' }];

  /** Fréquence de chaque option sur n tirages à graine fixe */
  const frequencies = (temperature: number, n = 2000) => {
    seedRandom(12345);
    const counts: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const item = AIBehavior.pickWithNoise(options, temperature)!;
      counts[item] = (counts[item] || 0) + 1;
    }
    return counts;
  };

  test('température nulle : toujours la meilleure option, la première en cas d\'égalité', () => {
    expect(frequencies(0)).toEqual({ meilleure: 2000 });
    expect(AIBehavior.pickWithNoise([{ value: 1, item: 'a' }, { value: 1, item: 'b' }], 0)).toBe('a');
    expect(AIBehavior.pickWithNoise([], 3)).toBeNull();
  });

  test('température positive : tirage selon exp(−écart / température), sans les options trop loin de la meilleure', () => {
    const counts = frequencies(2);
    // Proche : exp(−1/2) ≈ 0,61 fois la meilleure ; mauvaise : 8 points d'écart > 3 températures, jamais tirée
    expect(counts.mauvaise).toBeUndefined();
    expect(counts.proche / counts.meilleure).toBeGreaterThan(0.5);
    expect(counts.proche / counts.meilleure).toBeLessThan(0.75);
    expect(8).toBeGreaterThan(NOISE_WINDOW * 2);
    // Plus chaud : la mauvaise option entre dans la fenêtre, mais reste rare
    const hot = frequencies(4);
    expect(hot.mauvaise).toBeGreaterThan(0);
    expect(hot.mauvaise).toBeLessThan(hot.proche);
  });

  test("l'Expert ne doute jamais, l'Avancé hésite moins que le Débutant ; un joueur peut recevoir une autre température", async () => {
    expect(LEVEL_TEMPERATURE.EXPERT).toBe(0);
    expect(LEVEL_TEMPERATURE.MEDIUM).toBeGreaterThan(0);
    expect(LEVEL_TEMPERATURE.EASY).toBeGreaterThan(LEVEL_TEMPERATURE.MEDIUM);
    const game = await createTestGame();
    const robot = { ...game.players[0], type: 'robot' as const, aiDifficulty: 'EASY' as const };
    expect(AIBehavior.temperature(robot)).toBe(LEVEL_TEMPERATURE.EASY);
    expect(AIBehavior.isStrategic(robot)).toBe(true);
    expect(AIBehavior.choiceSamples(robot)).toBe(4);
    AIBehavior.temperatureOverrides.set(robot.id, 0.5);
    try {
      expect(AIBehavior.temperature(robot)).toBe(0.5);
    } finally {
      AIBehavior.temperatureOverrides.clear();
    }
    expect(AIBehavior.isStrategic({ ...robot, aiDifficulty: 'PASS' })).toBe(false);
  });

  describe('action principale', () => {
    let game: Game;

    beforeEach(async () => {
      game = await createTestGame(['R1', 'R2']);
      game.players.forEach(p => { p.type = 'robot'; });
      game.phase = GamePhase.PLAYING;
      game.currentPlayerIndex = 0;
    });

    test("chaque niveau choisit son action avec sa température : l'Expert la mieux évaluée, sans modifier la partie", () => {
      game.players[0].aiDifficulty = 'EASY';
      const snapshot = JSON.stringify(game);
      const spy = jest.spyOn(AIBehavior, 'pickWithNoise');
      try {
        for (const level of ['EXPERT', 'MEDIUM', 'EASY'] as const) {
          spy.mockClear();
          game.players[0].aiDifficulty = level;
          withRandomState(7, () => AITurn.playStep(game));
          expect(spy).toHaveBeenCalled();
          spy.mock.calls.forEach(([, temperature]) => expect(temperature).toBe(LEVEL_TEMPERATURE[level]));
          if (level === 'EXPERT') {
            spy.mock.calls.forEach(([candidates], k) => {
              if (candidates.length === 0) return;
              const best = Math.max(...candidates.map(o => o.value));
              expect(candidates.find(o => o.item === spy.mock.results[k].value)!.value).toBe(best);
            });
          }
        }
      } finally {
        spy.mockRestore();
      }
      expect(JSON.stringify(game)).toBe(snapshot);
    });

    test("anticipation sans suites jouées : l'Expert départage ses 3 meilleures actions par la réponse de l'adversaire, les autres niveaux non", () => {
      const reply = jest.spyOn(AITurn as never, 'valueAfterReply');
      try {
        game.players[0].aiDifficulty = 'MEDIUM';
        withRandomState(7, () => AITurn.playStep(game));
        expect(reply).not.toHaveBeenCalled();
        expect(LEVEL_LOOKAHEAD.EXPERT).toBe(3);
        game.players[0].aiDifficulty = 'EXPERT';
        // Sans suites jouées : réponse du seul adversaire suivant
        AIBehavior.rolloutOverrides.set(game.players[0].id, 0);
        withRandomState(7, () => AITurn['chooseBestMainAction'](game, game.players[0]));
        expect(reply.mock.calls.length).toBeGreaterThan(1);
        expect(reply.mock.calls.length).toBeLessThanOrEqual(LEVEL_LOOKAHEAD.EXPERT);
        reply.mockClear();
        AIBehavior.lookaheadOverrides.set(game.players[0].id, 0);
        withRandomState(7, () => AITurn['chooseBestMainAction'](game, game.players[0]));
        expect(reply).not.toHaveBeenCalled();
      } finally {
        AIBehavior.lookaheadOverrides.clear();
        AIBehavior.rolloutOverrides.clear();
        reply.mockRestore();
      }
    });

    test("réponse de l'adversaire : sa meilleure action sans jouer de carte (sa main reste cachée), position vue par le robot", () => {
      const [robot, opponent] = game.players;
      robot.aiDifficulty = 'EXPERT';
      robot.hasPerformedMainAction = true;
      opponent.credits = 20;
      opponent.energy = 10;
      const snapshot = JSON.stringify(game);
      const played = jest.spyOn(AITurn as never, 'playMainAction');
      try {
        const value = withRandomState(7, () => AITurn['valueAfterReply'](game, robot)).result;
        const decisions = played.mock.calls.map(call => (call as unknown as [Game, { id: string }, { action: string }]));
        expect(decisions.length).toBeGreaterThan(0);
        decisions.forEach(([, player, decision]) => {
          expect(player.id).toBe(opponent.id);
          expect(decision.action).not.toBe('PLAY_CARD');
        });
        expect(Number.isFinite(value)).toBe(true);
      } finally {
        played.mockRestore();
      }
      expect(JSON.stringify(game)).toBe(snapshot);
    });

    test("sans adversaire pour répondre (il a passé) : la position après la fin du tour", () => {
      const [robot, opponent] = game.players;
      robot.hasPerformedMainAction = true;
      opponent.hasPassed = true;
      const ended = AITurn.endTurn(game).updatedGame;
      expect(ended.currentPlayerIndex).toBe(0);
      expect(AITurn['valueAfterReply'](game, robot)).toBeCloseTo(AIEvaluator.evaluate(ended, robot.id));
    });

    test("suites jouées : chaque action départagée est jouée N fois jusqu'à la prochaine action du robot, sans anticipation imbriquée", () => {
      const robot = game.players[0];
      robot.aiDifficulty = 'EXPERT';
      AIBehavior.rolloutOverrides.set(robot.id, 2);
      const rollout = jest.spyOn(AITurn as never, 'rolloutValue');
      const ranking = jest.spyOn(AITurn as never, 'withOpponentReply');
      const snapshot = JSON.stringify(game);
      try {
        withRandomState(7, () => AITurn['chooseBestMainAction'](game, robot));
        // Une seule anticipation (celle du robot) : les joueurs des suites jouent sans anticiper
        expect(ranking).toHaveBeenCalledTimes(1);
        expect(rollout.mock.calls.length).toBe(2 * Math.min(LEVEL_LOOKAHEAD.EXPERT, (ranking.mock.calls[0] as unknown as [unknown[]])[0].length));
        rollout.mock.results.forEach(r => expect(Number.isFinite(r.value)).toBe(true));
      } finally {
        AIBehavior.rolloutOverrides.clear();
        rollout.mockRestore();
        ranking.mockRestore();
      }
      expect(JSON.stringify(game)).toBe(snapshot);
      expect(AITurn['simulating']).toBe(false);
    });

    test("une suite s'arrête à la prochaine action principale du robot ; les passes y sont jouées", () => {
      const [robot, opponent] = game.players;
      robot.aiDifficulty = 'EXPERT';
      robot.hasPerformedMainAction = true;
      opponent.hasPassed = false;
      const steps = jest.spyOn(AITurn, 'playStep');
      try {
        const value = withRandomState(3, () => AITurn['rolloutValue'](game, robot)).result;
        expect(Number.isFinite(value)).toBe(true);
        expect(steps).toHaveBeenCalled();
      } finally {
        steps.mockRestore();
      }
      // Passe d'un robot : la main passe au joueur suivant
      const ended = AITurn.endTurn(game).updatedGame;
      const keep = AIBehavior.createPassDecision(ended.players[1]);
      const passed = AITurn['applyPass'](ended, ended.players[1], keep.action === ActionType.PASS ? keep.data.cardsToKeep : [])!;
      expect(passed.players[1].hasPassed).toBe(true);
    });

    test("une passe refusée (pas le tour du joueur) ne change rien ; une réponse impossible est ignorée", () => {
      const [robot, opponent] = game.players;
      expect(AITurn['applyPass'](game, opponent, [])).toBeNull();
      robot.aiDifficulty = 'EXPERT';
      robot.hasPerformedMainAction = true;
      opponent.credits = 20;
      opponent.energy = 10;
      const played = jest.spyOn(AITurn as never, 'playMainAction').mockReturnValue(null as never);
      try {
        const ended = AITurn.endTurn(game).updatedGame;
        const value = withRandomState(7, () => AITurn['valueAfterReply'](game, robot)).result;
        expect(played).toHaveBeenCalled();
        expect(value).toBeCloseTo(AIEvaluator.evaluate(ended, robot.id));
      } finally {
        played.mockRestore();
      }
    });

    test("une suite enchaîne fins de tour et passes, et s'arrête si un joueur doit attendre", () => {
      const [robot, opponent] = game.players;
      robot.aiDifficulty = 'EXPERT';
      robot.hasPerformedMainAction = true;
      opponent.hasPassed = false;
      const keep = AIBehavior.createPassDecision(opponent);
      const steps = jest.spyOn(AITurn, 'playStep')
        .mockReturnValueOnce({ kind: 'END_TURN' })
        .mockReturnValueOnce({ kind: 'PASS', cardsToKeep: keep.action === ActionType.PASS ? keep.data.cardsToKeep : [] })
        .mockReturnValue({ kind: 'WAIT' });
      const pass = jest.spyOn(AITurn as never, 'applyPass');
      try {
        const value = withRandomState(3, () => AITurn['rolloutValue'](game, robot)).result;
        expect(Number.isFinite(value)).toBe(true);
        expect(steps).toHaveBeenCalledTimes(3);
        expect(pass).toHaveBeenCalledTimes(1);
      } finally {
        steps.mockRestore();
        pass.mockRestore();
      }
    });
  });
});
