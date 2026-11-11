import { GameSession } from '../src/session/GameSession';
import { CardSystem } from '../src/systems/CardSystem';
import { Game, GamePhase } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

/**
 * Mission déclenchable (Pioneer 11, carte 1 : visite de Jupiter) et mission conditionnelle (carte 51 : 8 Médias)
 * réalisables pendant le même tour : en recouvrir une ne doit pas effacer l'autre.
 */
describe('mission déclenchable et mission conditionnelle réalisables le même tour', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const player = getPlayer(game, P1);
    player.credits = 20;
    player.energy = 20;
    for (const cardId of ['1', '51']) {
      const source = [game.decks.cards, game.decks.cardRow, ...Object.values(game.decks.roundDecks)].find(cards => cards.some(c => c.id === cardId))!;
      getPlayer(game, P1).cards.push(...source.splice(source.findIndex(c => c.id === cardId), 1));
      game = CardSystem.playCard(game, P1, cardId).updatedGame;
    }
    // Visite de Jupiter : le cercle de Pioneer 11 est déclenché ; 8 Médias : la condition de la carte 51 est remplie
    const updated = getPlayer(game, P1);
    CardSystem.processMissionBuffs(updated, buff => buff.type === 'GAIN_ON_VISIT_JUPITER');
    updated.mediaCoverage = 8;
    game.players[0].hasPerformedMainAction = true;
  });
  afterEach(() => logSpy.mockRestore());

  const mission = (g: Game, cardId: string) => getPlayer(g, P1).missions.find(m => m.cardId === cardId)!;
  const triggered = (g: Game) => mission(g, '1').fulfillableRequirementIds[0];
  const condition = (g: Game) => mission(g, '51').requirements[0].id!;
  const claimable = (g: Game, cardId: string, requirementId: string) => CardSystem.isRequirementClaimable(g, P1, mission(g, cardId), requirementId);

  test('les deux sont réalisables au départ', () => {
    expect(triggered(game)).toBeDefined();
    expect(claimable(game, '1', triggered(game))).toBe(true);
    expect(claimable(game, '51', condition(game))).toBe(true);
  });

  test('recouvrir le cercle déclenché laisse la mission conditionnelle réalisable', () => {
    const circle = triggered(game);
    const res = GameSession.dispatch(game, P1, { type: 'CLAIM_MISSION', missionId: mission(game, '1').id, requirementId: circle });
    expect(res.error).toBeUndefined();
    expect(mission(res.game, '1').completedRequirementIds).toEqual([circle]);
    expect(claimable(res.game, '51', condition(res.game))).toBe(true);

    const next = GameSession.dispatch(res.game, P1, { type: 'CLAIM_MISSION', missionId: mission(res.game, '51').id, requirementId: condition(res.game) });
    expect(next.error).toBeUndefined();
    expect(mission(next.game, '51').completed).toBe(true);
  });

  test('accomplir la mission conditionnelle laisse le cercle déclenché réalisable', () => {
    const circle = triggered(game);
    const claimed = GameSession.dispatch(game, P1, { type: 'CLAIM_MISSION', missionId: mission(game, '51').id, requirementId: condition(game) });
    expect(claimed.error).toBeUndefined();
    // Récompense de la carte 51 : une carte à prendre (dans la pioche) avant toute autre action
    expect(claimed.game.interaction?.type).toBe('ACQUIRING_CARD');
    const res = GameSession.dispatch(claimed.game, P1, { type: 'CHOOSE', choice: { kind: 'CARD' } });
    expect(res.error).toBeUndefined();
    expect(mission(res.game, '51').completed).toBe(true);
    expect(mission(res.game, '1').fulfillableRequirementIds).toEqual([circle]);
    expect(claimable(res.game, '1', circle)).toBe(true);

    const next = GameSession.dispatch(res.game, P1, { type: 'CLAIM_MISSION', missionId: mission(res.game, '1').id, requirementId: circle });
    expect(next.error).toBeUndefined();
    expect(mission(next.game, '1').completedRequirementIds).toEqual([circle]);
    expect(game.players[0].missions.every(m => m.completedRequirementIds.length === 0)).toBe(true);
  });
});
