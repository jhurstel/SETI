import { Game } from '../src/core/types';
import { CONTEXT_HINTS, nextContextHint } from '../src/tutorial/contextHints';
import { fillComputer } from '../src/tutorial/scenario';
import { cloneGame } from '../src/core/cloneGame';
import { createTestGame } from './helpers/gameFixture';

const hint = (id: string) => CONTEXT_HINTS.find(h => h.id === id)!;

describe('aide au contexte de la première vraie partie', () => {
  let base: Game;
  let humanId: string;
  beforeAll(async () => {
    base = await createTestGame();
    humanId = base.players[0].id;
  });
  /** Copie de la partie de départ, modifiée pour créer la situation */
  const withChange = (change: (game: Game) => void) => {
    const game = cloneGame(base);
    change(game);
    return game;
  };

  test('début de partie : aucune aide', () => {
    expect(CONTEXT_HINTS.filter(h => h.applies(base, humanId))).toEqual([]);
    expect(nextContextHint(base, humanId, [])).toBeNull();
  });

  test('analyse possible : ligne du haut pleine, énergie et action principale encore à jouer', () => {
    const full = fillComputer(cloneGame(base), humanId, ['1a', '2', '3a', '4', '5a', '6a']);
    expect(hint('analyse-possible').applies(full, humanId)).toBe(true);
    expect(hint('analyse-possible').applies(withChange(g => {
      fillComputer(g, humanId, ['1a', '2', '3a', '4', '5a', '6a']);
      g.players[0].hasPerformedMainAction = true;
    }), humanId)).toBe(false);
  });

  test('réserve de données pleine', () => {
    expect(hint('donnees-pleines').applies(withChange(g => { g.players[0].data = 6; }), humanId)).toBe(true);
    expect(hint('donnees-pleines').applies(withChange(g => { g.players[0].data = 5; }), humanId)).toBe(false);
  });

  test('palier doré à moins de 5 points, pas encore franchi', () => {
    expect(hint('palier-proche').applies(withChange(g => { g.players[0].score = 21; }), humanId)).toBe(true);
    expect(hint('palier-proche').applies(withChange(g => { g.players[0].score = 19; }), humanId)).toBe(false);
    expect(hint('palier-proche').applies(withChange(g => { g.players[0].score = 26; }), humanId)).toBe(false);
    expect(hint('palier-proche').applies(withChange(g => {
      g.players[0].score = 46;
      g.players[0].claimedGoldenMilestones = [25];
    }), humanId)).toBe(true);
  });

  test('espèce découverte et dernière manche', () => {
    expect(hint('espece-decouverte').applies(withChange(g => { g.board.alienBoards[1].isDiscovered = true; }), humanId)).toBe(true);
    expect(hint('derniere-manche').applies(withChange(g => { g.currentRound = g.maxRounds; }), humanId)).toBe(true);
  });

  test("une aide n'est proposée qu'une fois, au joueur humain, sans choix en cours", () => {
    const situation = withChange(g => { g.players[0].data = 6; });
    const snapshot = JSON.stringify(situation);
    expect(nextContextHint(situation, humanId, [])?.id).toBe('donnees-pleines');
    expect(nextContextHint(situation, humanId, ['donnees-pleines'])).toBeNull();
    expect(JSON.stringify(situation)).toBe(snapshot);
    expect(nextContextHint({ ...situation, currentPlayerIndex: 1 }, humanId, [])).toBeNull();
    expect(nextContextHint({ ...situation, interaction: { type: 'SELECTING_SCAN_CARD' } }, humanId, [])).toBeNull();
  });
});
