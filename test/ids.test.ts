import { uniqueId } from '../src/core/ids';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { createTestGame, getPlayer } from './helpers/gameFixture';

describe('uniqueId', () => {
  test('ne se répète pas dans la même milliseconde (régression : sequenceId dupliqués)', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const ids = Array.from({ length: 1000 }, () => uniqueId());
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      now.mockRestore();
    }
  });

  test('deux lancements de sonde dans la même milliseconde ont des séquences distinctes', async () => {
    const game = await createTestGame();
    getPlayer(game, 'player_0').credits = 10;
    getPlayer(game, 'player_0').energy = 10;
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const first = ProbeSystem.launchProbe(game, 'player_0');
      const second = ProbeSystem.launchProbe(first.updatedGame, 'player_0');
      const firstSeq = first.historyEntries[0]?.sequenceId;
      const secondSeq = second.historyEntries[0]?.sequenceId;
      expect(firstSeq).toBeDefined();
      expect(secondSeq).not.toBe(firstSeq);
    } finally {
      now.mockRestore();
    }
  });
});
