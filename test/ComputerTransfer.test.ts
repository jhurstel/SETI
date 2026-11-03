import { ComputerSystem } from '../src/systems/ComputerSystem';
import { AITurn } from '../src/ai/AITurn';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { cloneGame } from '../src/core/cloneGame';
import { CardType, Game, Player } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

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
    // La réservation perdue est signalée dans l'historique
    expect(res.historyEntries[0].message).toBe("transfère 1 donnée vers l'ordinateur et gagne 1 Réservation (aucune carte en main : pas de réservation)");
  });

  test('réservation gagnée en bonus sans carte en main (une carte Exertien ne compte pas) : notée dans l\'historique', () => {
    const player = getPlayer(game, P1);
    player.cards = [makeCard('ex', { type: CardType.EXERTIEN })];
    const res = ResourceSystem.processBonuses({ revenue: 1 }, cloneGame(game), P1, 'test', 'seq');
    expect(res.newPendingInteractions).toEqual([]);
    expect(res.logs).toContain("n'a aucune carte en main : pas de réservation");
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

describe('ComputerSystem : transferts refusés', () => {
  let game: Game;
  beforeEach(async () => { game = await createTestGame(); });

  test('case inconnue, sans donnée ou déjà remplie : refusée, la partie reçue est renvoyée telle quelle', () => {
    const player = getPlayer(game, P1);
    player.data = 3;
    expect(ComputerSystem.canFillSlot(player, 'inconnue')).toBe(false);
    player.data = 0;
    expect(ComputerSystem.canFillSlot(player, '1a')).toBe(false);
    player.data = 3;

    player.dataComputer.slots['1a'].filled = true;
    expect(ComputerSystem.canFillSlot(player, '1a')).toBe(false);
    const res = ComputerSystem.transferData(game, P1, '1a', 'seq');
    expect(res.updatedGame).toBe(game);
    expect(res.historyEntries).toEqual([]);
  });
});

describe('ComputerSystem : bonus des cases', () => {
  test('case « énergie » : +1 Énergie', async () => {
    const game = await createTestGame();
    const player = getPlayer(game, P1);
    player.data = 1;
    player.dataComputer.slots['1a'].bonus = 'energy';
    const energy = player.energy;
    const res = ComputerSystem.transferData(game, P1, '1a', 'seq');
    expect(getPlayer(res.updatedGame, P1).energy).toBe(energy + 1);
    expect(res.historyEntries[0].message).toContain('1 Énergie');
  });
});

describe('ComputerSystem.nextTransferSlot (action gratuite « Transférer une donnée »)', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  test('case suivante de la ligne du haut', () => {
    const player = getPlayer(game, P1);
    player.data = 1;
    expect(ComputerSystem.nextTransferSlot(player)).toBe('1a');
    player.dataComputer.slots['1a'].filled = true;
    expect(ComputerSystem.nextTransferSlot(player)).toBe('2');
  });

  test('ligne du haut pleine : première case libre de la ligne du bas sous une technologie', () => {
    const player = getPlayer(game, P1);
    player.data = 1;
    Object.values(player.dataComputer.slots).filter(slot => slot.type === 'top').forEach(slot => { slot.filled = true; });
    expect(ComputerSystem.nextTransferSlot(player)).toBeUndefined();
    player.dataComputer.slots['5b'].bonus = 'media';
    player.dataComputer.slots['3b'].bonus = 'energy';
    expect(ComputerSystem.nextTransferSlot(player)).toBe('3b');
  });

  test('sans donnée : aucune case', () => {
    const player = getPlayer(game, P1);
    player.data = 0;
    expect(ComputerSystem.nextTransferSlot(player)).toBeUndefined();
  });
});
