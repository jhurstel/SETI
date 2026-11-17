/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { ExertienCardModal } from '../../src/ui/modals/GameModals';
import { CardType, Game } from '../../src/core/types';
import { makeCard } from '../helpers/gameFixture';

const exertien = (id: string) => makeCard(id, { type: CardType.EXERTIEN, danger: 2, name: `Exertien ${id}` });

/** Partie réduite à ce que lit la fenêtre : le joueur, ses cartes Exertiens, ses crédits et son danger */
const game = {
  players: [{ id: 'player_0', name: 'Alice', cards: [exertien('e1'), exertien('e2'), exertien('e3')], credits: 0, danger: 0 }],
  currentPlayerIndex: 0,
  exertienMilestones: [40, 60],
} as unknown as Game;

describe('fenêtre des cartes Exertiens', () => {
  test('découverte avec deux marqueurs : deux cartes choisies dans la même fenêtre', () => {
    const onChoice = jest.fn();
    render(<ExertienCardModal game={game} interactionState={{ type: 'CHOOSING_EXERTIEN_CARD', milestone: 0, count: 2, playerId: 'player_0' }} onChoice={onChoice} />);
    expect(screen.getByText(/jusqu'à 2 cartes Exertiens/)).toBeTruthy();
    // Un seul bouton : « Ne pas jouer » sans sélection, « Jouer » ensuite
    expect(screen.getByText('Ne pas jouer')).toBeTruthy();
    fireEvent.click(screen.getByText('Exertien e1'));
    expect(screen.queryByText('Ne pas jouer')).toBeNull();
    expect(screen.getByText('Sélectionnées : 1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Exertien e3'));
    // Pas plus de deux cartes
    fireEvent.click(screen.getByText('Exertien e2'));
    expect(screen.getByText('Sélectionnées : 2 / 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Jouer'));
    expect(onChoice).toHaveBeenCalledWith(['e1', 'e3']);
  });

  test('palier : une seule carte, un nouveau clic la remplace ; renoncer', () => {
    const onChoice = jest.fn();
    render(<ExertienCardModal game={game} interactionState={{ type: 'CHOOSING_EXERTIEN_CARD', milestone: 40 }} onChoice={onChoice} />);
    fireEvent.click(screen.getByText('Exertien e1'));
    fireEvent.click(screen.getByText('Exertien e2'));
    fireEvent.click(screen.getByText('Jouer'));
    expect(onChoice).toHaveBeenCalledWith(['e2']);
    fireEvent.click(screen.getByText('Ne pas jouer'));
    expect(onChoice).toHaveBeenLastCalledWith([]);
  });
});
