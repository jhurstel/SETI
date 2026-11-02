import { SpeciesSystem, DISCOVERY_NOTICE } from '../src/systems/SpeciesSystem';
import { GameSession } from '../src/session/GameSession';
import { InteractionChoices } from '../src/core/InteractionChoices';
import { AlienBoardType, CardType, Game, GamePhase, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { viewFor } from '../src/session/PlayerView';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Plateau 0 = Exertiens, avec une trace rouge de P1 et une jaune de P2 (et éventuellement une bleue neutre) */
function exertienBoard(game: Game, blue?: string) {
  const board = game.board.alienBoards[0];
  board.speciesId = AlienBoardType.EXERTIENS;
  board.isDiscovered = false;
  board.lifeTraces = [
    { id: 't1', type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.TRIANGLE },
    { id: 't2', type: LifeTraceType.YELLOW, playerId: P2, location: LifeTraceLocation.TRIANGLE },
    ...(blue ? [{ id: 't3', type: LifeTraceType.BLUE, playerId: blue, location: LifeTraceLocation.TRIANGLE }] : []),
  ];
  return board;
}

const exertienCount = (game: Game, playerId: string) => getPlayer(game, playerId).cards.filter(c => c.type === CardType.EXERTIEN).length;

describe('découverte d\'une espèce', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
  });
  afterEach(() => logSpy.mockRestore());

  test('l\'espèce est marquée découverte (plateau et espèce), et visible dans la vue d\'un joueur', () => {
    exertienBoard(game);
    const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE);
    expect(res.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);
    expect(res.updatedGame.species.find(s => s.name === AlienBoardType.EXERTIENS)!.discovered).toBe(true);
    expect(viewFor(res.updatedGame, P2).species.map(s => s.name)).toContain(AlienBoardType.EXERTIENS);
    expect(game.board.alienBoards[0].isDiscovered).toBe(false);
  });

  test('vue d\'un joueur : une ancienne sauvegarde (seul le plateau est marqué) montre aussi l\'espèce', () => {
    exertienBoard(game).isDiscovered = true;
    expect(viewFor(game, P2).species.map(s => s.name)).toContain(AlienBoardType.EXERTIENS);
  });

  test('Exertiens : chaque joueur qui a un marqueur de découverte peut jouer tout de suite une carte (palier 0)', () => {
    exertienBoard(game);
    const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE);
    expect(exertienCount(res.updatedGame, P1)).toBeGreaterThanOrEqual(3);
    expect(res.newPendingInteractions.filter(i => i.type === 'CHOOSING_EXERTIEN_CARD')).toEqual([
      { type: 'CHOOSING_EXERTIEN_CARD', milestone: 0, playerId: P1 },
      { type: 'CHOOSING_EXERTIEN_CARD', milestone: 0, playerId: P2 },
    ]);
  });

  test('Exertiens : un marqueur neutre n\'ouvre pas de choix ; un joueur sans marqueur n\'en a pas', async () => {
    game = await createTestGame(['Alice', 'Bob', 'Carol']);
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const board = exertienBoard(game);
    board.lifeTraces[1].playerId = 'neutral';
    const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE);
    expect(res.newPendingInteractions.filter(i => i.type === 'CHOOSING_EXERTIEN_CARD').map(i => i.playerId)).toEqual([P1]);
  });

  test('la carte jouée à la découverte est gratuite et consigne « découverte des Exertiens »', () => {
    exertienBoard(game);
    const discovered = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    const card = getPlayer(discovered, P2).cards.find(c => c.type === CardType.EXERTIEN)!;
    const credits = getPlayer(discovered, P2).credits;
    const played = InteractionChoices.playExertienCard(discovered, P2, { type: 'CHOOSING_EXERTIEN_CARD', milestone: 0, playerId: P2 }, card.id);
    expect(played.error).toBeUndefined();
    expect(getPlayer(played.updatedGame, P2).credits).toBe(credits);
    expect(getPlayer(played.updatedGame, P2).playedCards.map(c => c.id)).toContain(card.id);
    expect(played.historyEntries[0].message).toBe('joue une carte Exertien face cachée (découverte des Exertiens)');
  });

  test('2e palier Exertien : jouer sa carte coûte 1 crédit ; sans crédit, refusé', () => {
    exertienBoard(game);
    const discovered = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    const [first, second] = discovered.exertienMilestones!;
    expect(SpeciesSystem.exertienCardCost(discovered, first)).toBe(0);
    expect(SpeciesSystem.exertienCardCost(discovered, second)).toBe(1);
    expect(SpeciesSystem.exertienCardCost(discovered, 0)).toBe(0);

    const card = getPlayer(discovered, P1).cards.find(c => c.type === CardType.EXERTIEN)!;
    getPlayer(discovered, P1).credits = 3;
    const paid = SpeciesSystem.playExertienCard(discovered, P1, second, card.id);
    expect(paid.error).toBeUndefined();
    expect(getPlayer(paid.updatedGame, P1).credits).toBe(2);
    expect(paid.historyEntries[0].message).toBe(`paye 1 Crédit et joue une carte Exertien face cachée (palier ${second} PV)`);

    getPlayer(discovered, P1).credits = 0;
    expect(SpeciesSystem.playExertienCard(discovered, P1, second, card.id).error).toContain('pour jouer une carte Exertien');
    // Renoncer reste possible sans crédit
    expect(SpeciesSystem.playExertienCard(discovered, P1, second).error).toBeUndefined();
  });

  test('2e palier sans crédit : pas de choix, le palier est consommé', () => {
    exertienBoard(game);
    const discovered = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    const [first, second] = discovered.exertienMilestones!;
    const player = getPlayer(discovered, P1);
    player.claimedExertienMilestones = [first];
    player.claimedGoldenMilestones = [25, 50, 70];
    player.claimedNeutralMilestones = [20, 30];
    player.score = second;
    player.credits = 0;
    discovered.interaction = undefined;
    discovered.pendingInteractions = [];
    discovered.endingTurn = true;
    const turn = GameSession.start(discovered);
    expect(turn.game.interaction?.type).not.toBe('CHOOSING_EXERTIEN_CARD');
    expect(getPlayer(turn.game, P1).claimedExertienMilestones).toContain(second);
  });

  test('régression : une découverte par un palier neutre ouvre la fenêtre « Découverte » et les choix Exertiens', () => {
    exertienBoard(game);
    const alice = getPlayer(game, P1);
    alice.score = 20;
    alice.claimedGoldenMilestones = [25, 50, 70];
    game.neutralMilestonesAvailable = { 20: 1, 30: 1 };
    getPlayer(game, P2).type = 'robot';
    getPlayer(game, P2).aiDifficulty = 'EASY';

    const ended = GameSession.dispatch(game, P1, { type: 'END_TURN' });
    expect(ended.error).toBeUndefined();
    expect(ended.notifications).toContain(DISCOVERY_NOTICE);
    // Le choix d'Alice (en tête de file) attend ; celui du robot Bob suit, puis le tour se termine
    expect(ended.game.interaction).toEqual({ type: 'CHOOSING_EXERTIEN_CARD', milestone: 0, playerId: P1 });
    expect(ended.game.pendingInteractions).toEqual([{ type: 'CHOOSING_EXERTIEN_CARD', milestone: 0, playerId: P2 }]);
    expect(ended.game.currentPlayerIndex).toBe(0);

    const chosen = GameSession.dispatch(ended.game, P1, { type: 'CHOOSE', choice: { kind: 'EXERTIEN' } });
    expect(chosen.error).toBeUndefined();
    expect(getPlayer(chosen.game, P2).claimedExertienMilestones).toContain(0);
    expect(chosen.game.interaction).toBeUndefined();
    expect(chosen.game.currentPlayerIndex).toBe(1);
  });

  describe('Mascamites : les 7 spécimens', () => {
    const discoverMascamites = () => {
      const board = exertienBoard(game);
      board.speciesId = AlienBoardType.MASCAMITES;
      return SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    };
    const key = (bonus: object) => JSON.stringify(bonus);

    test('3 sur Jupiter, 3 sur Saturne, le 7e face cachée sur la piste bleue (3e case)', () => {
      const g = discoverMascamites();
      const species = g.species.find(s => s.name === AlienBoardType.MASCAMITES)!;
      const jupiter = g.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens!;
      const saturn = g.board.planets.find(p => p.id === 'saturn')!.mascamiteTokens!;
      expect(jupiter).toHaveLength(3);
      expect(saturn).toHaveLength(3);
      expect(species.hiddenSpecimenSlot).toBe(2);
      const onBoard = species.fixedSlots.bluelifetrace[2];
      expect(Object.keys(onBoard).length).toBeGreaterThan(0);
      // Les 7 jetons de l'espèce, chacun une fois
      const placed = [...jupiter.map(t => t.bonus), ...saturn.map(t => t.bonus), onBoard].map(key).sort();
      expect(placed).toEqual(species.specimen!.map(t => key(t.bonus)).sort());
    });

    test("vue d'un joueur : la récompense du 7e spécimen est cachée tant que sa case est libre", () => {
      const g = discoverMascamites();
      const hidden = viewFor(g, P2).species.find(s => s.name === AlienBoardType.MASCAMITES)!;
      expect(hidden.fixedSlots.bluelifetrace[2]).toEqual({});
      expect(hidden.fixedSlots.bluelifetrace[0]).toEqual(g.species.find(s => s.name === AlienBoardType.MASCAMITES)!.fixedSlots.bluelifetrace[0]);

      const bonus = g.species.find(s => s.name === AlienBoardType.MASCAMITES)!.fixedSlots.bluelifetrace[2];
      const placed = SpeciesSystem.placeLifeTrace(g, 0, LifeTraceType.BLUE, P2, 's', LifeTraceLocation.SPECIES, 2);
      expect(placed.historyEntries[0].message).toContain('place une trace de vie Bleu');
      expect(viewFor(placed.updatedGame, P1).species.find(s => s.name === AlienBoardType.MASCAMITES)!.fixedSlots.bluelifetrace[2]).toEqual(bonus);
    });
  });
});
