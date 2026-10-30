import { ComputerSystem } from '../src/systems/ComputerSystem';
import { AITurn } from '../src/ai/AITurn';
import { Game, Player } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

type StepResult = { updatedGame: Game } | null;
const tryTransferData = (game: Game, player: Player): StepResult =>
  (AITurn as unknown as { tryTransferData(g: Game, p: Player, always: boolean): StepResult }).tryTransferData(game, player, true);

describe('ComputerSystem.transferData', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    getPlayer(game, P1).data = 2;
  });

  test('case « carte » : carte de la rangée ou de la pioche à choisir, sans modifier la partie reçue', () => {
    getPlayer(game, P1).dataComputer.slots['1a'].bonus = 'card';
    const before = JSON.stringify(game);

    const res = ComputerSystem.transferData(game, P1, '1a', 'seq');

    expect(getPlayer(res.updatedGame, P1).dataComputer.slots['1a'].filled).toBe(true);
    expect(res.newPendingInteractions).toEqual([{ type: 'ACQUIRING_CARD', count: 1, isFree: true, sequenceId: 'seq' }]);
    expect(res.historyEntries).toEqual([{ message: "transfère 1 donnée vers l'ordinateur et gagne 1 Carte", playerId: P1, sequenceId: 'seq' }]);
    expect(JSON.stringify(game)).toBe(before);
  });

  test('case « réservation » sans carte en main : aucune interaction', () => {
    getPlayer(game, P1).dataComputer.slots['1a'].bonus = 'reservation';
    getPlayer(game, P1).cards = [];

    const res = ComputerSystem.transferData(game, P1, '1a', 'seq');

    expect(res.newPendingInteractions).toEqual([]);
  });

  test('case « réservation » : réservation d\'une carte de la main', () => {
    getPlayer(game, P1).dataComputer.slots['1a'].bonus = 'reservation';

    const res = ComputerSystem.transferData(game, P1, '1a', 'seq');

    expect(res.newPendingInteractions).toEqual([{ type: 'RESERVING_CARD', count: 1, selectedCards: [], sequenceId: 'seq' }]);
  });

  test('robot : reçoit la carte de la case « carte » (régression : bonus jamais appliqué)', () => {
    const player = getPlayer(game, P1);
    player.dataComputer.slots['1a'].bonus = 'card';
    const handSize = player.cards.length;

    const res = tryTransferData(game, player);

    expect(res).not.toBeNull();
    expect(getPlayer(res!.updatedGame, P1).cards).toHaveLength(handSize + 1);
  });
});
