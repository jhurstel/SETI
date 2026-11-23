import { GameSession } from '../src/session/GameSession';
import { Command } from '../src/session/commands';
import { knowledgeOf, revealedTo } from '../src/session/Revelation';
import { CardSystem } from '../src/systems/CardSystem';
import { cloneGame } from '../src/core/cloneGame';
import { FreeActionType, Game } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Commande acceptée, partie reçue intacte */
function play(game: Game, command: Command, playerId = P1): Game {
  const snapshot = JSON.stringify(game);
  const result = GameSession.dispatch(game, playerId, command);
  expect(result.error).toBeUndefined();
  expect(JSON.stringify(game)).toBe(snapshot);
  return result.game;
}

/** `revealedTo` ne modifie aucune des deux parties */
function revealed(before: Game, after: Game, options: Parameters<typeof revealedTo>[3] = { actorId: P1 }): boolean {
  const snapshots = [JSON.stringify(before), JSON.stringify(after)];
  const result = revealedTo(before, after, [P1, P2], options);
  expect([JSON.stringify(before), JSON.stringify(after)]).toEqual(snapshots);
  return result;
}

describe('Révélations : ce qu\'une commande fait connaître', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    getPlayer(game, P1).credits = 10;
    getPlayer(game, P1).energy = 10;
    getPlayer(game, P1).mediaCoverage = 6;
    game = GameSession.start(game).game;
  });

  test('carte de la pioche vers la main', () => {
    const paid = play(game, { type: 'TRADE', spend: 'credit', gain: 'card' });
    expect(revealed(game, paid)).toBe(false);
    const drawn = play(paid, { type: 'CHOOSE', choice: { kind: 'CARD' } });
    expect(revealed(paid, drawn)).toBe(true);
    expect(knowledgeOf(drawn, P1).has(`card:${game.decks.cards[0].id}`)).toBe(true);
    expect(knowledgeOf(drawn, P2).has(`card:${game.decks.cards[0].id}`)).toBe(false);
  });

  test('carte de la rangée remplacée : la nouvelle carte est révélée à tous', () => {
    const opened = play(game, { type: 'BUY_CARD' });
    const bought = play(opened, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: game.decks.cardRow[0].id } });
    expect(revealed(opened, bought)).toBe(true);
    // Même pour l'adversaire seul
    expect(revealedTo(opened, bought, [P2], { actorId: P1 })).toBe(true);
  });

  test('pile de fin de manche découverte en passant', () => {
    const hand = CardSystem.getHandCards(getPlayer(game, P1));
    const passed = play(game, { type: 'PASS', cardsToKeep: hand.slice(0, 4).map(c => c.id) });
    expect(passed.interaction).toMatchObject({ type: 'CHOOSING_ROUND_CARD', playerId: P1 });
    expect(revealed(game, passed)).toBe(true);
  });

  test('spécimens regardés sur une planète', () => {
    const before = cloneGame(game);
    const jupiter = before.board.planets.find(p => p.id === 'jupiter')!;
    jupiter.mascamiteTokens = [{ bonus: { pv: 2 } }, { bonus: { media: 1 } }];
    const after = cloneGame(before);
    after.board.planets.find(p => p.id === 'jupiter')!.mascamiteSeenBy = [P1];
    expect(revealed(before, after)).toBe(true);
    expect(revealedTo(before, after, [P2], { actorId: P1 })).toBe(false);
  });

  test('spécimen dans une capsule : vu par son propriétaire seul', () => {
    const after = cloneGame(game);
    const probe = { ...getPlayer(game, P1).probes[0] ?? { id: 'capsule-1', ownerId: P1, position: { x: 0, y: 0 } }, id: 'capsule-1', ownerId: P1, specimen: { bonus: { pv: 3 } } };
    after.board.solarSystem.probes = [...after.board.solarSystem.probes, probe as typeof after.board.solarSystem.probes[number]];
    expect(knowledgeOf(after, P1).has('specimen:capsule-1:{"pv":3}')).toBe(true);
    expect(revealedTo(game, after, [P1])).toBe(true);
    expect(revealedTo(game, after, [P2])).toBe(false);
  });

  test('espèce découverte : son plateau est retourné pour tous', () => {
    const after = cloneGame(game);
    expect(game.board.alienBoards[0].isDiscovered).toBe(false);
    after.board.alienBoards[0].isDiscovered = true;
    expect(revealedTo(game, after, [P2])).toBe(true);
  });

  test('tirage au hasard : révélation, sauf pour un robot qui tire pour décider', () => {
    const after = { ...game, rngState: (game.rngState ?? 0) + 1 };
    expect(revealed(game, after)).toBe(true);
    expect(revealed(game, after, { ignoreRng: true })).toBe(false);
    // Ancienne partie sans état du hasard : pas de comparaison
    expect(revealed({ ...game, rngState: undefined }, after)).toBe(false);
  });

  test('sans révélation : lancer une sonde, échanger des ressources, défausser une carte de sa main', () => {
    expect(revealed(game, play(game, { type: 'LAUNCH_PROBE' }))).toBe(false);
    expect(revealed(game, play(game, { type: 'TRADE', spend: 'energy', gain: 'credit' }))).toBe(false);
    getPlayer(game, P1).cards.push(makeCard('media-card', { freeAction: FreeActionType.MEDIA }));
    const discarded = play(game, { type: 'DISCARD_FOR_FREE_ACTION', cardId: 'media-card' });
    // L'adversaire découvre la carte défaussée, mais elle vient de la main de l'auteur : pas une révélation
    expect(knowledgeOf(discarded, P2).has('card:media-card')).toBe(true);
    expect(revealed(game, discarded)).toBe(false);
    // Sans auteur, la même défausse révèle la carte à l'adversaire
    expect(revealed(game, discarded, {})).toBe(true);
  });
});
