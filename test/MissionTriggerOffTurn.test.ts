import { GameSession } from '../src/session/GameSession';
import { CardSystem } from '../src/systems/CardSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { InteractionResolver } from '../src/core/InteractionResolver';
import { Game, GamePhase, LifeTraceLocation, LifeTraceType, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Le joueur joue les cartes (cartes de base ou d'espèce) avant le tour de P1 */
function playCards(game: Game, playerId: string, cardIds: string[]): Game {
  game.currentPlayerIndex = game.players.findIndex(p => p.id === playerId);
  const player = getPlayer(game, playerId);
  player.credits = 20;
  player.energy = 20;
  for (const cardId of cardIds) {
    const source = [game.decks.cards, game.decks.cardRow, ...Object.values(game.decks.roundDecks), ...game.species.map(s => s.cards)].find(cards => cards.some(c => c.id === cardId))!;
    getPlayer(game, playerId).cards.push(...source.splice(source.findIndex(c => c.id === cardId), 1));
    game = CardSystem.playCard(game, playerId, cardId).updatedGame;
  }
  game.currentPlayerIndex = 0;
  return game;
}

const placeRedTrace = () => ({ type: 'CHOOSE' as const, choice: { kind: 'LIFE_TRACE' as const, boardIndex: 0, color: LifeTraceType.RED, slotType: LifeTraceLocation.TRIANGLE } });
const fulfillable = (game: Game, playerId: string) => getPlayer(game, playerId).missions.flatMap(m => m.fulfillableRequirementIds);

describe('missions déclenchées hors du tour de leur joueur', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.phase = GamePhase.PLAYING;
  });
  afterEach(() => logSpy.mockRestore());

  /** P2 (humain) place une trace rouge gagnée pendant le tour de P1 */
  function traceDuringOtherTurn(cardIds: string[]) {
    game = playCards(game, P2, cardIds);
    game.interaction = { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED, playerId: P2 };
    const res = GameSession.dispatch(game, P2, placeRedTrace());
    expect(res.error).toBeUndefined();
    return res.game;
  }

  test('le joueur choisit aussitôt le cercle à recouvrir ; personne d\'autre ne peut répondre', () => {
    const offered = traceDuringOtherTurn(['77']);
    const choice = offered.interaction;
    expect(choice).toMatchObject({ type: 'CHOOSING_MISSION_REQUIREMENT', playerId: P2 });
    if (choice?.type !== 'CHOOSING_MISSION_REQUIREMENT') throw new Error('choix attendu');
    expect(choice.options).toHaveLength(1);
    expect(GameSession.dispatch(offered, P1, { type: 'CHOOSE', choice: { kind: 'MISSION' } }).error).toBe("Ce n'est pas à vous de jouer");

    const data = getPlayer(offered, P2).data;
    const res = GameSession.dispatch(offered, P2, { type: 'CHOOSE', choice: { kind: 'MISSION', ...choice.options[0] } });
    expect(res.error).toBeUndefined();
    expect(res.game.interaction).toBeUndefined();
    expect(getPlayer(res.game, P2).data).toBe(data + 1);
    expect(getPlayer(res.game, P2).missions.find(m => m.cardId === '77')!.completedRequirementIds).toEqual([choice.options[0].requirementId]);
    expect(fulfillable(res.game, P2)).toEqual([]);
    expect(offered.interaction).toBe(choice);
  });

  test('le joueur peut y renoncer : les cercles proposés ne sont plus réalisables', () => {
    const offered = traceDuringOtherTurn(['77']);
    const data = getPlayer(offered, P2).data;
    const res = GameSession.dispatch(offered, P2, { type: 'CHOOSE', choice: { kind: 'MISSION' } });
    expect(res.error).toBeUndefined();
    expect(res.game.interaction).toBeUndefined();
    expect(getPlayer(res.game, P2).data).toBe(data);
    expect(fulfillable(res.game, P2)).toEqual([]);
    expect(res.entries.map(e => e.message)).toContain('ne recouvre pas de cercle de mission');
  });

  test('deux cartes déclenchées : un seul cercle, toutes cartes confondues', () => {
    const offered = traceDuringOtherTurn(['77', 'ET.29']);
    if (offered.interaction?.type !== 'CHOOSING_MISSION_REQUIREMENT') throw new Error('choix attendu');
    expect(offered.interaction.options).toHaveLength(2);
    const nasa = offered.interaction.options.find(o => getPlayer(offered, P2).missions.find(m => m.id === o.missionId)!.cardId === '77')!;

    const res = GameSession.dispatch(offered, P2, { type: 'CHOOSE', choice: { kind: 'MISSION', ...nasa } });
    const completed = getPlayer(res.game, P2).missions.flatMap(m => m.completedRequirementIds);
    expect(completed).toEqual([nasa.requirementId]);
    expect(fulfillable(res.game, P2)).toEqual([]);
  });

  test('un cercle qui n\'a pas été déclenché est refusé', () => {
    const offered = traceDuringOtherTurn(['77']);
    const res = GameSession.dispatch(offered, P2, { type: 'CHOOSE', choice: { kind: 'MISSION', missionId: 'autre', requirementId: 'r' } });
    expect(res.error).toBe("Ce cercle de mission n'a pas été déclenché");
  });

  test('pendant son propre tour : pas de fenêtre, les cercles restent surlignés sur la carte', () => {
    game = playCards(game, P1, ['77']);
    game.interaction = { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED };
    const res = GameSession.dispatch(game, P1, placeRedTrace());
    expect(res.game.interaction).toBeUndefined();
    expect(fulfillable(res.game, P1)).toHaveLength(1);
  });

  test('robot : il choisit lui-même pendant le tour d\'un autre robot', () => {
    game = playCards(game, P2, ['77']);
    getPlayer(game, P1).type = 'robot';
    getPlayer(game, P2).type = 'robot';
    const data = getPlayer(game, P2).data;
    const placed = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P2, 'seq', LifeTraceLocation.TRIANGLE);

    const res = GameSession.applyRobotStep(game, { kind: 'UPDATED', updatedGame: placed.updatedGame, historyEntries: placed.historyEntries } as never);
    expect(res.error).toBeUndefined();
    expect(res.game.interaction).toBeUndefined();
    expect(getPlayer(res.game, P2).data).toBe(data + 1);
    expect(fulfillable(res.game, P2)).toEqual([]);
  });

  test('deux déclencheurs (2 technologies) : deux cercles recouverts (non-régression, Vulgarisation Scientifique)', () => {
    game = playCards(game, P1, ['94']);
    const techOf = (type: TechnologyCategory) => game.board.technologyBoard.available.find(t => t.type === type)!;
    game = TechnologySystem.acquireTechnology(game, P1, techOf(TechnologyCategory.EXPLORATION)).updatedGame;
    game = TechnologySystem.acquireTechnology(game, P1, techOf(TechnologyCategory.OBSERVATION)).updatedGame;
    const mission = getPlayer(game, P1).missions.find(m => m.cardId === '94')!;
    expect(mission.fulfillableRequirementIds).toHaveLength(2);
    const [first, second] = mission.fulfillableRequirementIds;
    const before = JSON.stringify(game);

    const claim = (g: Game, requirementId: string) =>
      InteractionResolver.resolve(g, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: mission.id, requirementId }).updatedGame;
    const once = claim(game, first);
    expect(fulfillable(once, P1)).toEqual([second]);
    const twice = claim(once, second);
    expect(getPlayer(twice, P1).missions.find(m => m.cardId === '94')!.completedRequirementIds).toEqual([first, second]);
    expect(fulfillable(twice, P1)).toEqual([]);
    expect(JSON.stringify(game)).toBe(before);
  });
});
