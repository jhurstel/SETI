import { CardSystem } from '../src/systems/CardSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { InteractionChoices } from '../src/core/InteractionChoices';
import { Game, LifeTraceLocation, LifeTraceType } from '../src/core/types';
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

  test('régression : une trace de vie posée par la carte 98 déclenche la mission (un cercle à la fois)', () => {
    // Une trace rouge déjà marquée : la carte 98 en ajoute une sur ce plateau
    game = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    getPlayer(game, P1).missions.find(m => m.cardId === 'ET.29')!.fulfillableRequirementIds = [];
    giveCard(game, '98');
    const played = CardSystem.playCard(game, P1, '98');
    const placing = played.newPendingInteractions.find(i => i.type === 'PLACING_LIFE_TRACE')!;
    expect(placing).toBeDefined();

    const placed = InteractionChoices.placeLifeTrace(played.updatedGame, P1, placing as Extract<typeof placing, { type: 'PLACING_LIFE_TRACE' }>, 0, LifeTraceType.RED, LifeTraceLocation.TRIANGLE);
    expect(placed.error).toBeUndefined();
    expect(fulfillable(placed.updatedGame)).toHaveLength(1);
  });

  test('chaque trace de vie, de n\'importe quelle couleur, prépare le cercle suivant', () => {
    let g = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    expect(fulfillable(g)).toHaveLength(1);
    g = SpeciesSystem.placeLifeTrace(g, 1, LifeTraceType.YELLOW, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    expect(fulfillable(g)).toHaveLength(2);
    expect(fulfillable(game)).toHaveLength(0);
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
    expect(fulfillable(placed.updatedGame)).toHaveLength(1);
  });

  test.failing('règles : un même déclencheur ne recouvre qu\'un cercle, toutes cartes confondues (choix du joueur non géré)', () => {
    // Carte 77 : se déclenche aussi sur une trace rouge ; la règle ne permet d'en recouvrir qu'un des deux cercles
    giveCard(game, '77');
    game = CardSystem.playCard(game, P1, '77').updatedGame;
    const g = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    const total = getPlayer(g, P1).missions.reduce((n, m) => n + (m.fulfillableRequirementIds?.length || 0), 0);
    expect(total).toBe(1);
  });
});
