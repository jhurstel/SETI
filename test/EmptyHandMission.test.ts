import { GameSession } from '../src/session/GameSession';
import { CardSystem } from '../src/systems/CardSystem';
import { CardType, Game, GamePhase } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

/** Carte 89 (Programme NIAC) : « Gagnez 1 Carte si vous n'avez aucune carte en main » */
describe('Programme NIAC (carte 89) : mission « main vide »', () => {
  let game: Game;

  const niac = (g: Game) => getPlayer(g, P1).missions.find(m => m.cardId === '89')!;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const player = getPlayer(game, P1);
    player.credits = 20;
    const source = [game.decks.cards, game.decks.cardRow, ...Object.values(game.decks.roundDecks)].find(cards => cards.some(c => c.id === '89'))!;
    player.cards = source.splice(source.findIndex(c => c.id === '89'), 1);
    game = CardSystem.playCard(game, P1, '89').updatedGame;
  });

  afterEach(() => jest.restoreAllMocks());

  test('la mission est réalisable dès que la main est vide', () => {
    const mission = niac(game);
    // Jouée la main vide, elle pioche 3 cartes : la mission n'est pas validée à la pose
    expect(mission.completedRequirementIds).toEqual([]);
    expect(getPlayer(game, P1).cards).toHaveLength(3);
    expect(CardSystem.claimableRequirements(game, P1)).toEqual([]);
    getPlayer(game, P1).cards = [];
    expect(CardSystem.claimableRequirements(game, P1)).toEqual([{ missionId: mission.id, requirementId: mission.requirements[0].id }]);

    const res = GameSession.dispatch(game, P1, { type: 'CLAIM_MISSION', missionId: mission.id, requirementId: mission.requirements[0].id! });
    expect(res.error).toBeUndefined();
  });

  test("les cartes Exertiens ne sont pas en main : elles n'empêchent pas la mission (FAQ Q40)", () => {
    getPlayer(game, P1).cards = [makeCard('ET.40', { type: CardType.EXERTIEN })];
    expect(CardSystem.claimableRequirements(game, P1)).toHaveLength(1);
  });
});
