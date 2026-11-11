import { determinize } from '../src/ai/Determinize';
import { seedRandom } from '../src/core/random';
import { Card, CardType, Game } from '../src/core/types';
import { createTestGame, makeCard } from './helpers/gameFixture';

/** Déterminisation : ce que le robot ne voit pas est redistribué au hasard, ce qu'il voit ne bouge pas */
describe('determinize', () => {
  let game: Game;
  const ids = (cards: Card[]) => cards.map(c => c.id).sort();
  const hiddenCards = (g: Game, viewerId: string) => [
    ...g.decks.cards,
    ...Object.values(g.decks.roundDecks).flat(),
    ...g.players.filter(p => p.id !== viewerId).flatMap(p => p.cards.filter(c => c.type !== CardType.EXERTIEN)),
  ];

  beforeEach(async () => {
    game = await createTestGame(['A', 'B', 'C']);
    game.players[1].cards.push(makeCard('ET.x', { type: CardType.EXERTIEN }));
  });

  test('mêmes cartes cachées, en mêmes nombres ; la main du robot, la rangée et les cartes Exertiens ne bougent pas', () => {
    const snapshot = JSON.stringify(game);
    seedRandom(1);
    const seen = determinize(game, game.players[0].id);

    expect(ids(hiddenCards(seen, game.players[0].id))).toEqual(ids(hiddenCards(game, game.players[0].id)));
    expect(seen.decks.cards).toHaveLength(game.decks.cards.length);
    Object.keys(game.decks.roundDecks).forEach(round => expect(seen.decks.roundDecks[Number(round)]).toHaveLength(game.decks.roundDecks[Number(round)].length));
    seen.players.forEach((p, i) => expect(p.cards).toHaveLength(game.players[i].cards.length));
    expect(ids(seen.players[0].cards)).toEqual(ids(game.players[0].cards));
    expect(ids(seen.decks.cardRow)).toEqual(ids(game.decks.cardRow));
    expect(seen.players[1].cards.some(c => c.id === 'ET.x')).toBe(true);
    expect(JSON.stringify(game)).toBe(snapshot);
  });

  test('les mains adverses changent selon le tirage', () => {
    seedRandom(1);
    const first = determinize(game, game.players[0].id);
    seedRandom(2);
    const second = determinize(game, game.players[0].id);
    expect(ids(first.players[1].cards)).not.toEqual(ids(second.players[1].cards));
  });
});
