import { privateText, revealText, textFor } from '../src/core/historyText';
import { viewEntries } from '../src/session/PlayerView';
import { CardSystem } from '../src/systems/CardSystem';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { InteractionChoices } from '../src/engine/InteractionChoices';
import { cloneGame } from '../src/core/cloneGame';
import { AlienBoardType, Card, Game, HistoryEntry, RevenueType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Cartes gagnées par le joueur entre deux états */
const drawnCards = (before: Game, after: Game, playerId: string): Card[] => {
  const ids = new Set(getPlayer(before, playerId).cards.map(c => c.id));
  return getPlayer(after, playerId).cards.filter(c => !ids.has(c.id));
};

/** Le nom de chaque carte piochée est lisible par son propriétaire seul, et le message reste lisible sans lui */
const expectPrivate = (message: string, owner: string, other: string, cards: Card[]) => {
  expect(cards.length).toBeGreaterThan(0);
  cards.forEach(card => {
    expect(textFor(message, owner)).toContain(`"${card.name}`);
    expect(revealText(message)).toContain(`"${card.name}`);
    expect(textFor(message, other)).not.toContain(card.name);
  });
  expect(textFor(message, other)).not.toMatch(/⟦|⟧|\s{2}/);
};

describe('historique : passages privés', () => {
  test('textFor retire les passages des autres joueurs, revealText retire seulement les marqueurs', () => {
    const message = `pioche carte ${privateText(P1, '"Sonde"')}, gagne 1 Média`;
    expect(revealText(message)).toBe('pioche carte "Sonde", gagne 1 Média');
    expect(textFor(message, P1)).toBe('pioche carte "Sonde", gagne 1 Média');
    expect(textFor(message, P2)).toBe('pioche carte, gagne 1 Média');
  });

  test('viewEntries filtre les messages et ne transmet pas les états d\'annulation', async () => {
    const game = await createTestGame();
    const entries: HistoryEntry[] = [{ message: `pioche carte ${privateText(P1, '"Sonde"')}`, playerId: P1, sequenceId: 's', previousState: game }];
    expect(viewEntries(entries, P2)).toEqual([{ message: 'pioche carte', playerId: P1, sequenceId: 's' }]);
    expect(viewEntries(entries, P1)[0].message).toBe('pioche carte "Sonde"');
    expect(entries[0].previousState).toBe(game);
  });
});

describe('les cartes piochées face cachée ne sont nommées que pour leur propriétaire', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('carte gagnée ou achetée dans la pioche ; une carte de la rangée reste publique', () => {
    const free = CardSystem.acquireCard(game, P1, undefined, { isFree: true }, 's');
    expect(revealText(free.historyEntries[0].message)).toMatch(/^choisit ".+" de la pioche$/);
    // Les autres joueurs lisent « une carte » à la place du nom
    expect(textFor(free.historyEntries[0].message, P2)).toBe('choisit une carte de la pioche');
    expectPrivate(free.historyEntries[0].message, P1, P2, drawnCards(game, free.updatedGame, P1));

    getPlayer(game, P1).mediaCoverage = 5;
    const row = CardSystem.acquireCard(game, P1, game.decks.cardRow[0].id, {}, 's');
    expect(textFor(row.historyEntries[0].message, P2)).toContain(`"${game.decks.cardRow[0].name}" depuis la rangée`);
  });

  test('échange contre une carte', () => {
    getPlayer(game, P1).credits = 5;
    const res = ResourceSystem.tradeResources(game, P1, 'credit', 'card');
    expect(res.error).toBeUndefined();
    expectPrivate(res.historyEntries[0].message, P1, P2, drawnCards(game, res.updatedGame, P1));
  });

  test('bonus de carte (processBonuses)', () => {
    const res = ResourceSystem.processBonuses({ card: 2 }, game, P1, 'test', 's');
    const message = res.logs.find(log => log.startsWith('pioche '))!;
    expectPrivate(message, P1, P2, drawnCards(game, res.updatedGame, P1));
    expect(textFor(message, P2)).toBe('pioche 2 cartes');
  });

  test('réservation d\'une carte à revenu « carte »', () => {
    const card = getPlayer(game, P1).cards[0];
    getPlayer(game, P1).cards[0] = { ...card, revenue: RevenueType.CARD };
    const res = CardSystem.reserveCards(game, P1, [card.id], 's');
    expect(textFor(res.historyEntries[0].message, P2)).toContain(`réserve "${card.name}"`);
    const drawn = drawnCards(game, res.updatedGame, P1).filter(c => c.id !== card.id);
    expectPrivate(res.historyEntries[0].message, P1, P2, drawn);
  });

  test('carte Alien prise dans la pioche de l\'espèce', () => {
    const species = game.species[0];
    const res = InteractionChoices.acquireAlienCard(game, P1, { type: 'ACQUIRING_ALIEN_CARD', count: 1, speciesId: species.id, sequenceId: 's' }, 'deck');
    expect(textFor(res.historyEntries[0].message, P2)).toBe('choisit la carte Alien de la pioche');
    expectPrivate(res.historyEntries[0].message, P1, P2, drawnCards(game, res.updatedGame, P1));
  });

  test('cartes reçues à la découverte (Exertiens : 3 par joueur)', () => {
    game.board.alienBoards[0].speciesId = AlienBoardType.EXERTIENS;
    game.board.alienBoards[0].lifeTraces = [];
    // Méthode interne : elle modifie la partie reçue (l'appelant l'a copiée), on garde les mains d'avant
    const before = cloneGame(game);
    const { updatedGame, logs } = SpeciesSystem['distributeDiscoveryCards'](game, 0);
    [P1, P2].forEach(owner => {
      const other = owner === P1 ? P2 : P1;
      const message = logs.find(log => log.startsWith(getPlayer(game, owner).name))!;
      expectPrivate(message, owner, other, drawnCards(before, updatedGame, owner));
      expect(textFor(message, other)).toBe(`${getPlayer(game, owner).name} pioche 3 cartes Alien (Découverte)`);
    });
  });
});
