/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { Game, GamePhase, HistoryEntry } from '../../src/core/types';
import { useAnnouncements } from '../../src/ui/hooks/useAnnouncements';

/** Partie réduite à ce que lit le tirage : phase, joueurs et cartes réservées */
const gameAtStart = (reserved = 0) => ({
  phase: GamePhase.SETUP,
  currentRound: 1,
  currentPlayerIndex: 0,
  players: [{ id: 'p1', name: 'Alice', reservedCards: Array(reserved).fill({}) }, { id: 'p2', name: 'HAL', reservedCards: [] }],
  board: { alienBoards: [] },
}) as unknown as Game;

const log = [{ id: 'start-1', message: 'Mise en place' }] as unknown as HistoryEntry[];

describe('tirage du premier joueur', () => {
  test('nouvelle partie : la roue est due dès le premier rendu (aucune image du plateau avant)', () => {
    const seen: boolean[] = [];
    const { result } = renderHook(() => {
      const value = useAnnouncements({ game: gameAtStart(), historyLog: log, me: 'p1', onMessage: () => {} });
      seen.push(value.drawing);
      return value;
    });
    // Premier rendu (avant tout effet) : déjà en tirage
    expect(seen[0]).toBe(true);
    expect(result.current.drawing).toBe(true);
  });

  test('tirage terminé : la roue ne revient pas pour la même partie', () => {
    const { result, rerender } = renderHook(() => useAnnouncements({ game: gameAtStart(), historyLog: log, me: 'p1', onMessage: () => {} }));
    expect(result.current.drawing).toBe(true);
    // Fin de l'animation
    act(() => result.current.endDrawing());
    rerender();
    expect(result.current.drawing).toBe(false);
  });

  test('partie reprise après la mise en place : pas de tirage', () => {
    const { result } = renderHook(() => useAnnouncements({ game: gameAtStart(1), historyLog: log, me: 'p1', onMessage: () => {} }));
    expect(result.current.drawing).toBe(false);
  });
});
