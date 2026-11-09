import { CardSystem } from '../src/systems/CardSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { InteractionChoices } from '../src/engine/InteractionChoices';
import { Game, GamePhase, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { GameSession } from '../src/session/GameSession';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

/** Met la carte en main (cartes de base ou d'espèce) */
function giveCard(game: Game, cardId: string) {
  const sources = [game.decks.cards, game.decks.cardRow, ...game.species.map(s => s.cards)];
  for (const source of sources) {
    const index = source.findIndex(c => c.id === cardId);
    if (index !== -1) {
      const [card] = source.splice(index, 1);
      getPlayer(game, P1).cards.push(card);
      return card;
    }
  }
  throw new Error(`Carte ${cardId} introuvable`);
}

const fulfillable = (game: Game) => getPlayer(game, P1).missions.find(m => m.cardId === 'ET.29')!.fulfillableRequirementIds;

describe('missions déclenchées par une trace de vie (ET.29 « Analyse Comparative »)', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    const player = getPlayer(game, P1);
    player.credits = 20;
    player.energy = 20;
    giveCard(game, 'ET.29');
    game = CardSystem.playCard(game, P1, 'ET.29').updatedGame;
  });
  afterEach(() => logSpy.mockRestore());

  test('régression : une trace de vie posée par la carte 98 déclenche la mission (ses cercles au choix)', () => {
    // Une trace rouge déjà marquée : la carte 98 en ajoute une sur ce plateau
    game = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    getPlayer(game, P1).missions.find(m => m.cardId === 'ET.29')!.fulfillableRequirementIds = [];
    giveCard(game, '98');
    const played = CardSystem.playCard(game, P1, '98');
    const placing = played.newPendingInteractions.find(i => i.type === 'PLACING_LIFE_TRACE')!;
    expect(placing).toBeDefined();

    const placed = InteractionChoices.placeLifeTrace(played.updatedGame, P1, placing as Extract<typeof placing, { type: 'PLACING_LIFE_TRACE' }>, 0, LifeTraceType.RED, LifeTraceLocation.TRIANGLE);
    expect(placed.error).toBeUndefined();
    expect(fulfillable(placed.updatedGame)).toHaveLength(3);
  });

  test("règles (FAQ Q28) : chaque trace de vie propose tous les cercles non recouverts, recouverts dans l'ordre choisi", () => {
    game.phase = GamePhase.PLAYING;
    let g = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    const mission = getPlayer(g, P1).missions.find(m => m.cardId === 'ET.29')!;
    const [first, second, third] = mission.requirements.map(r => r.id!);
    expect(fulfillable(g)).toEqual([first, second, third]);
    expect(fulfillable(game)).toHaveLength(0);

    // Le joueur recouvre le dernier cercle (3 PV) : les autres attendent une autre trace de vie
    const claimed = GameSession.dispatch(g, P1, { type: 'CLAIM_MISSION', missionId: mission.id, requirementId: third });
    expect(claimed.error).toBeUndefined();
    expect(fulfillable(claimed.game)).toEqual([]);

    g = SpeciesSystem.placeLifeTrace(claimed.game, 1, LifeTraceType.YELLOW, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    expect(fulfillable(g)).toEqual([first, second]);
  });

  test('régression : les deux cercles de la carte 107 (2 Médias ou 4 PV) sont proposés après une trace bleue', () => {
    giveCard(game, '107');
    game = CardSystem.playCard(game, P1, '107').updatedGame;
    const g = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    const card107 = getPlayer(g, P1).missions.find(m => m.cardId === '107')!;
    expect(card107.fulfillableRequirementIds).toEqual(card107.requirements.map(r => r.id));
    expect(getPlayer(game, P1).missions.find(m => m.cardId === '107')!.fulfillableRequirementIds).toEqual([]);
  });

  test('une trace de couleur quelconque prend la couleur de la piste choisie : missions de cette couleur et « toute trace »', () => {
    giveCard(game, '77');
    game = CardSystem.playCard(game, P1, '77').updatedGame;
    const placed = InteractionChoices.placeLifeTrace(game, P1, { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.ANY }, 0, LifeTraceType.YELLOW, LifeTraceLocation.TRIANGLE);

    expect(placed.error).toBeUndefined();
    expect(placed.updatedGame.board.alienBoards[0].lifeTraces).toEqual([expect.objectContaining({ type: LifeTraceType.YELLOW, playerId: P1 })]);
    const nasa = getPlayer(placed.updatedGame, P1).missions.find(m => m.cardId === '77')!;
    const triggered = nasa.requirements.filter(r => nasa.fulfillableRequirementIds.includes(r.id!)).map(r => String(r.value));
    expect(triggered).toEqual([expect.stringContaining(':yellow:')]);
    expect(fulfillable(placed.updatedGame)).toHaveLength(3);
  });

  test("règles : un même déclencheur ne recouvre qu'un cercle, toutes cartes confondues, au choix du joueur", () => {
    // Carte 77 : se déclenche aussi sur une trace rouge ; tous les cercles sont proposés (1 de la carte 77, les 3 d'ET.29),
    // en recouvrir un efface les autres
    giveCard(game, '77');
    game = CardSystem.playCard(game, P1, '77').updatedGame;
    game.phase = GamePhase.PLAYING;
    const g = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    const offered = getPlayer(g, P1).missions.flatMap(m => m.fulfillableRequirementIds.map(requirementId => ({ missionId: m.id, requirementId })));
    expect(offered).toHaveLength(4);

    const claimed = GameSession.dispatch(g, P1, { type: 'CLAIM_MISSION', ...offered[0] });
    expect(claimed.error).toBeUndefined();
    expect(getPlayer(claimed.game, P1).missions.flatMap(m => m.completedRequirementIds)).toEqual([offered[0].requirementId]);
    expect(getPlayer(claimed.game, P1).missions.flatMap(m => m.fulfillableRequirementIds)).toEqual([]);
  });
});
