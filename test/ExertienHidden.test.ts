import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { ScoreManager } from '../src/engine/ScoreManager';
import { viewFor } from '../src/session/PlayerView';
import { AlienBoardType, Card, CardType, Game, GamePhase, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const exertien = (id: string, danger: number): Card =>
  makeCard(id, { type: CardType.EXERTIEN, danger, name: `Exertien ${id}`, description: `DANGER ${danger}. Fin de jeu: ...` });

/** Plateau des Exertiens découvert, P2 a un marqueur sur un emplacement dangereux de la piste et une carte jouée */
function exertienGame(game: Game): { trackDanger: number } {
  const board = game.board.alienBoards[0];
  board.speciesId = AlienBoardType.EXERTIENS;
  board.isDiscovered = true;
  const species = game.species.find(s => s.name === AlienBoardType.EXERTIENS)!;
  const slotIndex = species.fixedSlots.redlifetrace.findIndex(slot => (slot.danger || 0) !== 0);
  const trackDanger = Math.abs(species.fixedSlots.redlifetrace[slotIndex].danger || 0);
  board.lifeTraces.push({ id: 't-p2', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.SPECIES, slotIndex });
  const p2 = getPlayer(game, P2);
  p2.playedCards = [...p2.playedCards, exertien('joue', 3)];
  p2.danger = trackDanger + 3;
  return { trackDanger };
}

describe('cartes Exertiens jouées face cachée : danger visible des adversaires', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('un adversaire ne voit que le danger de la piste, et sait qu\'une carte cachée s\'y ajoute', () => {
    const { trackDanger } = exertienGame(game);
    const p2 = getPlayer(game, P2);
    expect(trackDanger).toBeGreaterThan(0);
    expect(ScoreManager.exertienTrackDanger(game, p2)).toBe(trackDanger);
    expect(ScoreManager.visibleExertienDanger(game, p2, P1)).toEqual({ danger: trackDanger, hidden: true });
    // Le joueur lui-même voit tout
    expect(ScoreManager.visibleExertienDanger(game, p2, P2)).toEqual({ danger: trackDanger + 3, hidden: false });
    // Sans carte jouée : rien de caché
    expect(ScoreManager.visibleExertienDanger(game, getPlayer(game, P1), P2)).toEqual({ danger: 0, hidden: false });
    // Le danger total (décompte) compte toujours les cartes
    expect(ScoreManager.calculateExertienDanger(game, p2)).toBe(trackDanger + 3);
  });

  test('au décompte final, tout est révélé', () => {
    const { trackDanger } = exertienGame(game);
    game.phase = GamePhase.FINAL_SCORING;
    expect(ScoreManager.visibleExertienDanger(game, getPlayer(game, P2), P1)).toEqual({ danger: trackDanger + 3, hidden: false });
    expect(getPlayer(viewFor(game, P1), P2).danger).toBe(trackDanger + 3);
  });

  test('vue en ligne : le danger d\'un adversaire n\'inclut pas ses cartes cachées, le sien si', () => {
    const { trackDanger } = exertienGame(game);
    const view = viewFor(game, P1);
    expect(getPlayer(view, P2).danger).toBe(trackDanger);
    expect(getPlayer(view, P2).playedCards.find(c => c.type === CardType.EXERTIEN)!.name).not.toBe('Exertien joue');
    expect(getPlayer(viewFor(game, P2), P2).danger).toBe(trackDanger + 3);
    // La partie reçue n'est pas modifiée
    expect(getPlayer(game, P2).danger).toBe(trackDanger + 3);
  });
});

describe('avertissement du 2e palier Exertien sans crédit', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.exertienMilestones = [30, 50];
    const p1 = getPlayer(game, P1);
    p1.cards.push(exertien('e1', 2));
    p1.claimedExertienMilestones = [30];
    p1.score = 52;
    p1.credits = 0;
  });

  test('palier payant atteint, carte à jouer, aucun crédit : avertissement', () => {
    expect(SpeciesSystem.exertienMilestoneWarning(game, P1)).toMatch(/palier Exertien de 50 PV.*1 crédit/);
  });

  test('rien à signaler : de quoi payer, palier gratuit, déjà utilisé, pas atteint, pas de carte', () => {
    const p1 = getPlayer(game, P1);
    p1.credits = 1;
    expect(SpeciesSystem.exertienMilestoneWarning(game, P1)).toBeNull();
    p1.credits = 0;
    p1.claimedExertienMilestones = [];
    p1.score = 31;
    expect(SpeciesSystem.exertienMilestoneWarning(game, P1)).toBeNull(); // 1er palier : gratuit
    p1.claimedExertienMilestones = [30, 50];
    p1.score = 52;
    expect(SpeciesSystem.exertienMilestoneWarning(game, P1)).toBeNull();
    p1.claimedExertienMilestones = [30];
    p1.score = 45;
    expect(SpeciesSystem.exertienMilestoneWarning(game, P1)).toBeNull();
    p1.score = 52;
    p1.cards = p1.cards.filter(c => c.type !== CardType.EXERTIEN);
    expect(SpeciesSystem.exertienMilestoneWarning(game, P1)).toBeNull();
    game.exertienMilestones = undefined;
    expect(SpeciesSystem.exertienMilestoneWarning(game, P1)).toBeNull();
  });
});
