/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { HistoryList } from '../../src/ui/HistoryBoardUI';
import { playerText } from '../../src/core/historyText';
import { Game } from '../../src/core/types';

describe('HistoryList', () => {
  // Partie réduite à ce que lit l'historique (pas de fetch sous jsdom pour charger les vraies cartes)
  const game = {
    players: [{ id: 'player_0', name: 'Alice', color: '#4a90e2', type: 'human', cards: [], reservedCards: [], playedCards: [] }, { id: 'player_1', name: 'Bob', color: '#ff6b6b', type: 'robot', cards: [], reservedCards: [], playedCards: [] }],
    decks: { cards: [], cardRow: [], discardPile: [], roundDecks: {} },
    board: { technologyBoard: { available: [], categorySlots: [] } },
    species: [],
  } as unknown as Game;

  test('seuls les noms marqués par le moteur sont écrits dans la couleur de leur joueur', () => {
    const [alice, bob] = game.players;
    const { container } = render(
      <HistoryList
        game={game}
        setActiveTooltip={() => {}}
        historyLog={[
          { id: '1', playerId: alice.id, sequenceId: 's', message: `couvre le secteur Vega, les joueurs présents (${playerText(bob.id, 'Bob')} et ${playerText(alice.id, 'Alice')}) gagnent chacun 1 Média` },
          { id: '2', playerId: alice.id, sequenceId: 't', message: 'prend la place de Bob' },
        ]}
      />,
    );

    const items = container.querySelectorAll('.seti-history-item');
    expect(items[0].textContent).toContain('les joueurs présents (Bob et Alice)');
    expect(items[0].textContent).not.toContain('⟪');
    const names = [...items[0].querySelectorAll('.seti-history-text strong')].map(s => [s.textContent?.trim(), (s as HTMLElement).style.color]);
    expect(names).toEqual([['Alice', expect.any(String)], ['Bob', expect.any(String)], ['Alice', expect.any(String)]]);
    expect(names[1][1]).not.toBe(names[2][1]);
    // Un nom non marqué, ailleurs que dans la liste, reste en texte simple
    expect([...items[1].querySelectorAll('.seti-history-text strong')].map(s => s.textContent?.trim())).toEqual(['Alice']);
  });
});
