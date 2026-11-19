import { AITurn } from '../src/ai/AITurn';
import { AIBehavior } from '../src/ai/AIBehavior';
import { AIController } from '../src/ai/AIController';
import { AIEvaluator } from '../src/ai/AIEvaluator';
import { Card, Game, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

/** Falcon Heavy (2 sondes + 1 Média), rendue gratuite : une carte qui vaut nettement plus que 2 énergies */
function freeGoodCard(game: Game, id: string): Card {
  const source = [...game.decks.cards, ...game.decks.cardRow, ...game.players.flatMap(p => p.cards)].find(c => c.id === '9')!;
  return { ...source, id, cost: 0 };
}

/**
 * Le robot ne se sert pas de ce qu'il ne voit pas : une carte piochée face cachée par un échange
 * ne décide pas de l'échange, et une découverte d'espèce ne lui fait pas perdre la valeur de ses traces.
 */
describe('Robots : préparation d\'une action avec une carte de la pioche ou de la rangée', () => {
  let game: Game;
  let before: string;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EXPERT'; });
    AIBehavior.lookaheadOverrides.set(P1, 0);
    // Rien d'autre à faire : ni crédit, ni Média, ni donnée, main vide ; 2 énergies à échanger contre 1 carte
    const p1 = getPlayer(game, P1);
    Object.assign(p1, { credits: 0, energy: 2, mediaCoverage: 0, data: 0, cards: [] });
    // Rangée injouable (trop chère)
    game.decks.cardRow = game.decks.cardRow.map(c => ({ ...c, cost: 99 }));
  });
  afterEach(() => AIBehavior.lookaheadOverrides.clear());

  const play = () => {
    before = JSON.stringify(game);
    const step = AITurn.playStep(game);
    expect(JSON.stringify(game)).toBe(before);
    return step.kind === 'UPDATED' ? step.updatedGame : game;
  };

  test('une bonne carte gratuite sur le dessus de la pioche ne décide pas l\'échange (il ne la voit pas)', () => {
    game.decks.cards = [freeGoodCard(game, 'TOP'), ...game.decks.cards];
    game.decks.cardRow = [];
    const after = play();
    expect(getPlayer(after, P1).playedCards.map(c => c.id)).not.toContain('TOP');
    expect(after.decks.discardPile.map(c => c.id)).not.toContain('TOP');
  });

  test('la même carte dans la rangée : il l\'échange contre 2 énergies et la joue', () => {
    game.decks.cardRow = [freeGoodCard(game, 'ROW'), ...game.decks.cardRow.slice(1)];
    const after = play();
    const p1 = getPlayer(after, P1);
    expect(p1.energy).toBe(0);
    expect([...p1.playedCards, ...after.decks.discardPile].map(c => c.id)).toContain('ROW');
  });

  test('pioche et rangée vides : aucun échange contre une carte', () => {
    game.decks.cards = [];
    game.decks.cardRow = [];
    const after = play();
    expect(getPlayer(after, P1).energy).toBe(2);
  });
});

describe('Robots : une découverte d\'espèce ne fait pas perdre la valeur des 1res traces', () => {
  test('le robot complète la découverte (5 PV) plutôt qu\'une trace sur l\'autre espèce (3 PV)', async () => {
    const game = await createTestGame(['A', 'B', 'C', 'D']);
    game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EXPERT'; });
    // Plateau de gauche : rouge (du robot) et jaune déjà posés, il manque le bleu
    game.board.alienBoards[0].lifeTraces = [
      { id: 'r', type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.TRIANGLE },
      { id: 'y', type: LifeTraceType.YELLOW, playerId: 'player_1', location: LifeTraceLocation.TRIANGLE },
    ];
    const before = JSON.stringify(game);
    const scoreBefore = getPlayer(game, P1).score;
    const evalBefore = AIEvaluator.evaluate(game, P1);

    const res = AIController.processInteractionQueue(game, [{ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, sequenceId: 's' }], 's', getPlayer(game, P1));

    // Espèce complétée (révélée à la fin du tour, règles p. 20) : la valeur des 1res traces reste comptée
    expect(res.updatedGame.pendingDiscoveries).toEqual([0]);
    expect(getPlayer(res.updatedGame, P1).score - scoreBefore).toBe(5);
    expect(AIEvaluator.evaluate(res.updatedGame, P1)).toBeGreaterThan(evalBefore);
    expect(JSON.stringify(game)).toBe(before);
  });
});
