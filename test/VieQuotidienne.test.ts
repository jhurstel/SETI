import { CardSystem } from '../src/systems/CardSystem';
import { InteractionChoices } from '../src/core/InteractionChoices';
import { AIController } from '../src/ai/AIController';
import { FreeActionType, Game, InteractionState, RevenueType } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

type Discarding = Extract<InteractionState, { type: 'DISCARDING_DRAWN_CARD' }>;

/** Joue ET.15 « Vie Quotidienne » avec, en haut de la pioche, 3 cartes connues */
function playVieQuotidienne(game: Game) {
  const species = game.species.find(s => s.cards.some(c => c.id === 'ET.15'))!;
  const card = species.cards.splice(species.cards.findIndex(c => c.id === 'ET.15'), 1)[0];
  const player = getPlayer(game, P1);
  player.cards.push(card);
  player.credits = 10;
  game.decks.cards.unshift(
    makeCard('media', { freeAction: FreeActionType.MEDIA, revenue: RevenueType.ENERGY }),
    makeCard('data', { freeAction: FreeActionType.DATA, revenue: RevenueType.CREDIT }),
    makeCard('move', { freeAction: FreeActionType.MOVEMENT, revenue: RevenueType.CARD }),
  );
  return CardSystem.playCard(game, P1, 'ET.15');
}

describe('ET.15 « Vie Quotidienne » : 3 cartes piochées, une défaussée pour son action gratuite, une autre pour son revenu', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });
  afterEach(() => logSpy.mockRestore());

  test('jouer la carte pioche 3 cartes et ouvre le choix sur ces 3 cartes', () => {
    const played = playVieQuotidienne(game);
    const discarding = played.newPendingInteractions.find(i => i.type === 'DISCARDING_DRAWN_CARD') as Discarding;
    expect(discarding.step).toBe('FREE_ACTION');
    expect([...discarding.cardIds].sort()).toEqual(['data', 'media', 'move']);
  });

  test('action gratuite puis revenu, sans modifier la partie reçue', () => {
    const played = playVieQuotidienne(game);
    const discarding = played.newPendingInteractions.find(i => i.type === 'DISCARDING_DRAWN_CARD') as Discarding;
    const before = played.updatedGame;
    const snapshot = JSON.stringify(before);
    const media = getPlayer(before, P1).mediaCoverage;

    const first = InteractionChoices.discardDrawnCard(before, P1, discarding, 'media');
    expect(first.error).toBeUndefined();
    expect(getPlayer(first.updatedGame, P1).mediaCoverage).toBe(media + 1);
    expect(getPlayer(first.updatedGame, P1).cards.some(c => c.id === 'media')).toBe(false);
    expect(first.nextInteraction).toEqual(expect.objectContaining({ type: 'DISCARDING_DRAWN_CARD', step: 'REVENUE', cardIds: ['data', 'move'] }));
    expect(JSON.stringify(before)).toBe(snapshot);

    const credits = getPlayer(first.updatedGame, P1).credits;
    const second = InteractionChoices.discardDrawnCard(first.updatedGame, P1, first.nextInteraction as Discarding, 'data');
    expect(second.error).toBeUndefined();
    expect(getPlayer(second.updatedGame, P1).credits).toBe(credits + 1);
    expect(second.nextInteraction).toBeUndefined();
    expect(second.historyEntries[0].message).toContain('défausse carte "Carte data" et gagne 1 Crédit (revenu)');
  });

  test('une carte qui n\'est pas une des cartes piochées est refusée', () => {
    const played = playVieQuotidienne(game);
    const discarding = played.newPendingInteractions.find(i => i.type === 'DISCARDING_DRAWN_CARD') as Discarding;
    const other = getPlayer(played.updatedGame, P1).cards.find(c => !discarding.cardIds.includes(c.id))!;
    expect(InteractionChoices.discardDrawnCard(played.updatedGame, P1, discarding, other.id).error).toBe('Choisissez une des cartes piochées');
  });

  test("une carte piochée sans action gratuite : refusée pour l'action gratuite (régression : défaussée pour rien)", () => {
    const played = playVieQuotidienne(game);
    const discarding = played.newPendingInteractions.find(i => i.type === 'DISCARDING_DRAWN_CARD') as Discarding;
    const drawn = getPlayer(played.updatedGame, P1).cards.find(c => c.id === 'move')!;
    drawn.freeAction = FreeActionType.UNDEFINED;
    const res = InteractionChoices.discardDrawnCard(played.updatedGame, P1, discarding, 'move');
    expect(res.error).toBe('Cette carte ne peut pas être défaussée');
    expect(res.updatedGame).toBe(played.updatedGame);
  });

  test('robot : les deux défausses sont faites (cartes simulées)', () => {
    const played = playVieQuotidienne(game);
    const res = AIController.processInteractionQueue(played.updatedGame, played.newPendingInteractions, 's', getPlayer(played.updatedGame, P1));
    const hand = getPlayer(res.updatedGame, P1).cards.map(c => c.id);
    expect(['media', 'data', 'move'].filter(id => hand.includes(id))).toHaveLength(1);
    expect(res.historyEntries.filter(e => e.message.startsWith('défausse carte'))).toHaveLength(2);
  });
});
