/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { AlienBoardType, Game } from '../../src/core/types';
import { useSpeciesUnlock } from '../../src/ui/hooks/useSpeciesUnlock';
import { tutorialProgress } from '../../src/ui/tutorialProgress';

/** Partie réduite aux plateaux Alien : seul ce que lit le relevé des découvertes */
const gameWith = (boards: { speciesId: AlienBoardType; isDiscovered: boolean }[]) =>
  ({ board: { alienBoards: boards } }) as unknown as Game;

beforeEach(() => localStorage.clear());

describe('déblocage des espèces découvertes en partie', () => {
  test('découverte (par un robot comme par un humain) : espèce débloquée et annoncée une seule fois', () => {
    const onUnlock = jest.fn();
    const hidden = gameWith([{ speciesId: AlienBoardType.EXERTIENS, isDiscovered: false }, { speciesId: AlienBoardType.ANOMALIES, isDiscovered: false }]);
    const { rerender } = renderHook(({ game }) => useSpeciesUnlock(game, false, onUnlock), { initialProps: { game: hidden } });
    expect(onUnlock).not.toHaveBeenCalled();

    const discovered = gameWith([{ speciesId: AlienBoardType.EXERTIENS, isDiscovered: true }, { speciesId: AlienBoardType.ANOMALIES, isDiscovered: false }]);
    rerender({ game: discovered });
    expect(onUnlock).toHaveBeenCalledWith([AlienBoardType.EXERTIENS]);
    expect(tutorialProgress().species).toEqual([AlienBoardType.EXERTIENS]);

    // Même espèce dans une autre partie : rien de nouveau
    rerender({ game: gameWith([{ speciesId: AlienBoardType.EXERTIENS, isDiscovered: true }, { speciesId: AlienBoardType.OUMUAMUA, isDiscovered: false }]) });
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  test('partie reprise avec deux espèces déjà découvertes : les deux sont débloquées', () => {
    const onUnlock = jest.fn();
    renderHook(() => useSpeciesUnlock(gameWith([
      { speciesId: AlienBoardType.MASCAMITES, isDiscovered: true }, { speciesId: AlienBoardType.CENTAURIENS, isDiscovered: true },
    ]), false, onUnlock));
    expect(onUnlock).toHaveBeenCalledWith([AlienBoardType.MASCAMITES, AlienBoardType.CENTAURIENS]);
  });

  test('chapitre du tutoriel, ou pas de partie : rien n\'est débloqué', () => {
    const onUnlock = jest.fn();
    renderHook(() => useSpeciesUnlock(gameWith([{ speciesId: AlienBoardType.MASCAMITES, isDiscovered: true }]), true, onUnlock));
    renderHook(() => useSpeciesUnlock(null, false, onUnlock));
    expect(onUnlock).not.toHaveBeenCalled();
    expect(tutorialProgress().species).toEqual([]);
  });
});
