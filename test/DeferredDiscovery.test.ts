import { SpeciesSystem, discoveryNotice } from '../src/systems/SpeciesSystem';
import { TurnManager } from '../src/engine/TurnManager';
import { PassAction } from '../src/actions/PassAction';
import { deserializeGame, serializeGame } from '../src/core/GamePersistence';
import { AlienBoardType, Game, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/**
 * Découverte d'une espèce à la fin du tour (règles, p. 20) : la troisième trace la note, la fin du tour la résout
 * après les paliers, avant le joueur suivant.
 */
describe('découverte en fin de tour', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  /** Rouge et jaune posés sur le plateau `boardIndex` : la trace bleue le complète */
  const almostComplete = (g: Game, boardIndex: number, species: AlienBoardType) => {
    const board = g.board.alienBoards[boardIndex];
    board.speciesId = species;
    board.lifeTraces = [
      { id: `r${boardIndex}`, type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.TRIANGLE },
      { id: `y${boardIndex}`, type: LifeTraceType.YELLOW, playerId: P1, location: LifeTraceLocation.TRIANGLE },
    ];
  };
  const complete = (g: Game, boardIndex: number) =>
    SpeciesSystem.placeLifeTrace(g, boardIndex, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;

  test('la troisième trace note la découverte : espèce face cachée, aucune carte Alien distribuée, bonus gagné', () => {
    almostComplete(game, 0, AlienBoardType.CENTAURIENS);
    const scoreBefore = getPlayer(game, P1).score;
    const cardsBefore = getPlayer(game, P1).cards.length;
    const placed = complete(game, 0);

    expect(placed.pendingDiscoveries).toEqual([0]);
    expect(placed.board.alienBoards[0].isDiscovered).toBeFalsy();
    expect(getPlayer(placed, P1).cards).toHaveLength(cardsBefore);
    expect(getPlayer(placed, P1).score).toBeGreaterThan(scoreBefore);
    expect(game.pendingDiscoveries).toBeUndefined();
  });

  test("plateau complété mais pas encore révélé : sa piste n'est pas proposée pour une autre trace du tour", () => {
    almostComplete(game, 0, AlienBoardType.CENTAURIENS);
    const placed = complete(game, 0);
    const options = SpeciesSystem.lifeTraceOptions(placed, LifeTraceType.RED);
    expect(options.some(o => o.boardIndex === 0 && o.location === LifeTraceLocation.SPECIES)).toBe(false);
  });

  test('deux espèces complétées dans le même tour : découvertes dans l\'ordre, la liste vidée, la partie reçue intacte', () => {
    almostComplete(game, 0, AlienBoardType.ANOMALIES);
    almostComplete(game, 1, AlienBoardType.CENTAURIENS);
    const placed = complete(complete(game, 1), 0);
    expect(placed.pendingDiscoveries).toEqual([1, 0]);

    const before = JSON.stringify(placed);
    const res = SpeciesSystem.resolvePendingDiscoveries(placed, P1);
    expect(res.revealed).toEqual([AlienBoardType.CENTAURIENS, AlienBoardType.ANOMALIES]);
    expect(res.updatedGame.board.alienBoards.every(b => b.isDiscovered)).toBe(true);
    expect(res.updatedGame.pendingDiscoveries).toEqual([]);
    expect(JSON.stringify(placed)).toBe(before);
  });

  test('sans découverte en attente : rien ne change', () => {
    const res = SpeciesSystem.resolvePendingDiscoveries(game, P1);
    expect(res.updatedGame).toBe(game);
    expect(res.historyEntries).toEqual([]);
  });

  test('fin du tour : un palier objectif est résolu avant la découverte', () => {
    almostComplete(game, 0, AlienBoardType.CENTAURIENS);
    const placed = complete(game, 0);
    getPlayer(placed, P1).score = 26;

    const first = TurnManager.finishTurn(placed);
    expect(first.turnEnded).toBe(false);
    expect(first.pendingInteractions?.[0]).toEqual(expect.objectContaining({ type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }));
    expect(first.updatedGame.board.alienBoards[0].isDiscovered).toBeFalsy();

    // Marqueur posé : la fin du tour reprend et découvre l'espèce, puis passe au joueur suivant
    getPlayer(first.updatedGame, P1).claimedGoldenMilestones.push(25);
    const second = TurnManager.finishTurn(first.updatedGame);
    expect(second.turnEnded).toBe(true);
    expect(second.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);
    expect(second.discoveryNotification?.message).toBe(discoveryNotice(AlienBoardType.CENTAURIENS));
    expect(second.updatedGame.currentPlayerIndex).not.toBe(0);
  });

  test('Exertiens : les choix des cartes attendent la fin du tour, le joueur suivant ensuite', () => {
    almostComplete(game, 0, AlienBoardType.EXERTIENS);
    const placed = complete(game, 0);

    const turn = TurnManager.finishTurn(placed);
    expect(turn.turnEnded).toBe(false);
    expect(turn.pendingInteractions?.map(i => i.type)).toEqual(['CHOOSING_EXERTIEN_CARD', 'CHOOSING_EXERTIEN_CARD']);
    expect(turn.updatedGame.currentPlayerIndex).toBe(0);
    expect(turn.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);

    // Choix faits : la fin du tour reprend sans redécouvrir l'espèce
    const resumed = TurnManager.finishTurn(turn.updatedGame);
    expect(resumed.turnEnded).toBe(true);
    expect(resumed.milestoneEntries.map(e => e.message)).not.toContain("révèle l'espèce découverte : Exertiens !");
  });

  test('passer après avoir complété une espèce : elle est découverte à la fin de ce tour', () => {
    almostComplete(game, 0, AlienBoardType.ANOMALIES);
    const placed = complete(game, 0);
    const finished = PassAction.finishPass(placed);
    expect(finished.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);
    expect(finished.notification).toBe(discoveryNotice(AlienBoardType.ANOMALIES));
  });

  test('sauvegarde : une découverte en attente est gardée ; une sauvegarde sans ce champ se charge', () => {
    almostComplete(game, 0, AlienBoardType.CENTAURIENS);
    const placed = complete(game, 0);
    expect(deserializeGame(JSON.stringify(serializeGame(placed, []))).game.pendingDiscoveries).toEqual([0]);
    const legacy = deserializeGame(JSON.stringify(serializeGame(game, []))).game;
    expect(legacy.pendingDiscoveries).toBeUndefined();
    expect(SpeciesSystem.resolvePendingDiscoveries(legacy, P1).revealed).toEqual([]);
  });
});
