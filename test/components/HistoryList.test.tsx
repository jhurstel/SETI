/** @jest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { HistoryBoardUI, HistoryList } from '../../src/ui/HistoryBoardUI';
import { playerText } from '../../src/core/historyText';
import { Game, Technology, TechnologyCategory } from '../../src/core/types';

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

describe('HistoryList : technologies citées', () => {
  // Deux technologies de même niveau dans deux catégories : la catégorie fait la différence
  const tech = (id: string, type: TechnologyCategory, description: string) =>
    ({ id, name: 'I', type, description, shorttext: '', effects: [], bonus: { pv: 3 } }) as unknown as Technology;
  const exploration = tech('exploration-1-1', TechnologyCategory.EXPLORATION, 'Deux sondes dans le système solaire');
  const observation = tech('observation-1-1', TechnologyCategory.OBSERVATION, 'Scan d\'un secteur adjacent à la Terre');
  const game = {
    players: [{ id: 'player_0', name: 'Alice', color: '#4a90e2', type: 'human', cards: [], reservedCards: [], playedCards: [], technologies: [observation] }],
    decks: { cards: [], cardRow: [], discardPile: [], roundDecks: {} },
    board: { technologyBoard: { available: [], categorySlots: [{ category: TechnologyCategory.EXPLORATION, technologies: [exploration] }] } },
    species: [],
  } as unknown as Game;

  test('« Observation I » est un lien vers l\'infobulle de la technologie, comme une carte', () => {
    const setActiveTooltip = jest.fn();
    const { container } = render(
      <HistoryList game={game} setActiveTooltip={setActiveTooltip}
        historyLog={[{ id: '1', playerId: 'player_0', sequenceId: 's', message: 'acquiert technologie "Observation I" et gagne 3 PV' }]} />,
    );
    const link = container.querySelector('.seti-history-card-ref')!;
    expect(link.textContent).toBe('"Observation I"');
    fireEvent.mouseEnter(link);
    const tooltip = render(<>{setActiveTooltip.mock.calls.at(-1)[0].content}</>);
    expect(tooltip.container.textContent).toContain('Scan d\'un secteur adjacent à la Terre');
    expect(tooltip.container.textContent).not.toContain('Deux sondes');
  });

  test('une technologie du plateau est trouvée aussi ; un nom inconnu reste du texte', () => {
    const { container } = render(
      <HistoryList game={game} setActiveTooltip={() => {}}
        historyLog={[
          { id: '1', playerId: 'player_0', sequenceId: 's', message: 'acquiert technologie "Exploration I"' },
          { id: '2', playerId: 'player_0', sequenceId: 't', message: 'acquiert technologie "Informatique IV"' },
        ]} />,
    );
    expect([...container.querySelectorAll('.seti-history-card-ref')].map(e => e.textContent)).toEqual(['"Exploration I"']);
  });
});

describe('Historique : annulation', () => {
  const game = {
    players: [{ id: 'player_0', name: 'Alice', color: '#4a90e2', type: 'human', cards: [], reservedCards: [], playedCards: [] }],
    decks: { cards: [], cardRow: [], discardPile: [], roundDecks: {} },
    board: { technologyBoard: { available: [], categorySlots: [] } },
    species: [],
  } as unknown as Game;

  test("une entrée technique (commande sans message) n'est pas affichée", () => {
    const { container } = render(
      <HistoryList game={game} setActiveTooltip={() => {}} historyLog={[
        { id: '1', playerId: 'player_0', sequenceId: 's', message: 'lance une sonde' },
        { id: '2', playerId: 'player_0', sequenceId: 'buy', message: '', silent: true },
      ]} />,
    );
    expect(container.querySelectorAll('.seti-history-item')).toHaveLength(1);
    expect(render(<HistoryList game={game} setActiveTooltip={() => {}} historyLog={[{ id: '3', playerId: 'player_0', message: '', silent: true }]} />)
      .container.textContent).toContain('Aucune action');
  });

  test('annulation bloquée : ↩ grisé, avec la raison en infobulle', () => {
    // jsdom ne fait pas défiler : l'historique se place sur sa dernière entrée
    Element.prototype.scrollTo = () => {};
    const setActiveTooltip = jest.fn();
    const { container } = render(
      <HistoryBoardUI game={game} historyLog={[]} undoBlockedReason="Action non annulable" setActiveTooltip={setActiveTooltip} />,
    );
    const button = container.querySelector('.seti-history-undo-btn.disabled') as HTMLElement;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.mouseEnter(button);
    expect(setActiveTooltip).toHaveBeenCalledWith(expect.objectContaining({ content: 'Action non annulable' }));
    // Annulation possible : la flèche normale, sans raison
    const onUndo = jest.fn();
    const enabled = render(<HistoryBoardUI game={game} historyLog={[]} onUndo={onUndo} undoBlockedReason="x" setActiveTooltip={() => {}} />).container;
    expect(enabled.querySelector('.seti-history-undo-btn.disabled')).toBeNull();
    fireEvent.click(enabled.querySelector('.seti-history-undo-btn')!);
    expect(onUndo).toHaveBeenCalled();
  });
});
