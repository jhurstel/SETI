import { viewFor, HIDDEN_SPECIES } from '../src/session/PlayerView';
import { cloneGame } from '../src/core/cloneGame';
import { CardType, Game, GamePhase, LifeTraceType, Probe, ProbeState } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const A = 'player_0';
const B = 'player_1';

describe('viewFor : vue de la partie pour un joueur', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  test('cache les cartes en main de l\'adversaire, garde leur nombre et la main du joueur', () => {
    const view = viewFor(game, A);
    const hiddenHand = getPlayer(view, B).cards;
    expect(hiddenHand).toHaveLength(getPlayer(game, B).cards.length);
    expect(hiddenHand.every(c => c.id.startsWith('hidden-') && c.immediateEffects.length === 0)).toBe(true);
    const ids = new Set(getPlayer(game, B).cards.map(c => c.id));
    expect(JSON.stringify(view)).not.toContain(getPlayer(game, B).cards[0].description);
    expect(getPlayer(view, A).cards).toEqual(getPlayer(game, A).cards);
    expect(getPlayer(view, A).cards.some(c => ids.has(c.id))).toBe(false);
  });

  test('une carte révélée de l\'adversaire reste visible', () => {
    getPlayer(game, B).cards[0].isRevealed = true;
    const view = viewFor(game, A);
    expect(getPlayer(view, B).cards[0]).toEqual(getPlayer(game, B).cards[0]);
    expect(getPlayer(view, B).cards[1].id).toMatch(/^hidden-/);
  });

  test('cache l\'ordre de la pioche, la graine et le générateur, mais pas la rangée de cartes', () => {
    const view = viewFor(game, A);
    expect(view.decks.cards).toHaveLength(game.decks.cards.length);
    expect(view.decks.cards.every(c => c.id.startsWith('hidden-'))).toBe(true);
    expect(view.decks.cardRow).toEqual(game.decks.cardRow);
    expect(view.seed).toBeUndefined();
    expect(view.rngState).toBeUndefined();
  });

  test('cache les piles de fin de manche, sauf au joueur qui a passé et choisit sa carte', () => {
    const hidden = (view: Game, round: number) => view.decks.roundDecks[round].every(c => c.id.startsWith('hidden-'));
    let view = viewFor(game, A);
    expect(view.decks.roundDecks[1]).toHaveLength(game.decks.roundDecks[1].length);
    expect(hidden(view, 1) && hidden(view, 2)).toBe(true);

    game.interaction = { type: 'CHOOSING_ROUND_CARD', round: 1, playerId: A, sequenceId: 's' };
    view = viewFor(game, A);
    expect(view.decks.roundDecks[1]).toEqual(game.decks.roundDecks[1]);
    expect(hidden(view, 2)).toBe(true);
    expect(hidden(viewFor(game, B), 1)).toBe(true);
  });

  test('ne modifie pas la partie reçue', () => {
    game.interaction = { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED, playerId: B, sequenceId: 's' };
    const snapshot = cloneGame(game);
    viewFor(game, A);
    expect(game).toEqual(snapshot);
  });

  test('cache les espèces non découvertes et la pioche Alien des espèces découvertes', () => {
    const view = viewFor(game, A);
    expect(view.species).toHaveLength(0);
    expect(view.board.alienBoards.every(b => b.speciesId === HIDDEN_SPECIES)).toBe(true);

    game.species[0].discovered = true;
    game.board.alienBoards.find(b => b.speciesId === game.species[0].name)!.isDiscovered = true;
    const after = viewFor(game, A);
    expect(after.species.map(s => s.name)).toEqual([game.species[0].name]);
    expect(after.species[0].cards).toHaveLength(game.species[0].cards.length);
    expect(after.species[0].cards.every(c => c.id.startsWith('hidden-'))).toBe(true);
    expect(after.board.alienBoards.filter(b => b.speciesId !== HIDDEN_SPECIES)).toHaveLength(1);
  });

  test('cache les cartes Exertiens jouées par l\'adversaire jusqu\'au décompte final', () => {
    getPlayer(game, B).playedCards = [makeCard('ET.1', { type: CardType.EXERTIEN, danger: 2 }), makeCard('fin', { type: CardType.END_GAME })];
    const view = viewFor(game, A);
    expect(getPlayer(view, B).playedCards[0]).toMatchObject({ type: CardType.EXERTIEN, id: 'hidden-0' });
    expect(getPlayer(view, B).playedCards[0].danger).toBeUndefined();
    expect(getPlayer(view, B).playedCards[1].id).toBe('fin');
    expect(getPlayer(viewFor(game, B), B).playedCards[0].id).toBe('ET.1');

    game.phase = GamePhase.FINAL_SCORING;
    expect(getPlayer(viewFor(game, A), B).playedCards[0].id).toBe('ET.1');
  });

  test("spécimens Mascamites face cachée : visibles seulement par qui les a regardés, celui d'une capsule par son propriétaire", () => {
    const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
    const tokens = [{ bonus: { credits: 2 } }, { bonus: { media: 3 } }];
    jupiter.mascamiteTokens = tokens;
    const capsuleB = { ...makeProbe(B), specimen: { bonus: { energy: 2 } } };
    getPlayer(game, B).probes = [capsuleB];
    game.board.solarSystem.probes = [capsuleB];
    getPlayer(game, A).probes = [{ ...makeProbe(A), specimen: { bonus: { media: 3 } } }];
    const hidden = [{ bonus: {} }, { bonus: {} }];

    const view = viewFor(game, A);
    expect(view.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toEqual(hidden);
    expect(getPlayer(view, B).probes[0].specimen).toEqual({ bonus: {} });
    expect(view.board.solarSystem.probes[0].specimen).toEqual({ bonus: {} });
    expect(getPlayer(view, A).probes[0].specimen).toEqual({ bonus: { media: 3 } });
    expect(viewFor(game, B).board.solarSystem.probes[0].specimen).toEqual({ bonus: { energy: 2 } });

    // A a regardé les spécimens de Jupiter : il les voit, B non
    jupiter.mascamiteSeenBy = [A];
    expect(viewFor(game, A).board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toEqual(tokens);
    expect(viewFor(game, B).board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toEqual(hidden);
  });

  test('une interaction qui attend un autre joueur ne montre que son type et ce joueur', () => {
    game.currentPlayerIndex = 0;
    game.interaction = { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED, playerId: B, sequenceId: 's' };
    game.pendingInteractions = [{ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, sequenceId: 't' }];
    const view = viewFor(game, A);
    expect(view.interaction).toEqual({ type: 'PLACING_LIFE_TRACE', playerId: B });
    expect(view.pendingInteractions).toEqual(game.pendingInteractions);
    expect(viewFor(game, B).interaction).toEqual(game.interaction);
  });
});

/** Capsule portant un spécimen, posée sur Jupiter */
function makeProbe(ownerId: string): Probe {
  return {
    id: `capsule-${ownerId}`, ownerId, position: { x: 0, y: 0 }, solarPosition: { disk: 'A', sector: 1, level: 0 },
    state: ProbeState.CAPSULE, planetId: 'jupiter', isOrbiter: false, isLander: false,
  };
}
