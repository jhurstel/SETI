import { GameSession } from '../src/session/GameSession';
import { Game, GamePhase, InteractionState, Sector, SectorType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';

const P1 = 'player_0';
const P2 = 'player_1';
const P3 = 'player_2';

/** Remplit les premiers emplacements du secteur dans l'ordre donné (le dernier est le plus récent) */
function markSignals(sector: Sector, playerIds: string[]): void {
  playerIds.forEach((playerId, i) => {
    sector.signals[i].marked = true;
    sector.signals[i].markedBy = playerId;
  });
}

/**
 * Égalité sur un secteur couvert : le dernier à avoir posé un signal l'emporte (règles), que l'emplacement en
 * pointillé (signal sans Donnée, au-delà des emplacements qui remplissent le secteur) soit resté libre ou non.
 */
describe('égalité à la couverture d\'un secteur', () => {
  let game: Game;
  let sector: Sector;

  beforeEach(async () => {
    game = await createTestGame(['Alice', 'Bob', 'Carol']);
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    sector = game.board.sectors[0];
    sector.firstBonus = { pv: 3 };
    sector.nextBonus = { pv: 5 };
    expect(sector.signals).toHaveLength(7);
  });

  /** P1 marque un signal par interaction, dans le secteur, au cours d'une même action */
  const scan = (count: number) => {
    const pick: InteractionState = { type: 'SELECTING_SCAN_SECTOR', color: SectorType.ANY, sequenceId: 'scan' };
    game.interaction = pick;
    game.pendingInteractions = Array.from({ length: count - 1 }, () => ({ ...pick }));
    let current = game;
    for (let i = 0; i < count; i++) {
      const res = GameSession.dispatch(current, P1, { type: 'CHOOSE', choice: { kind: 'SECTOR', sectorId: sector.id } });
      expect(res.error).toBeUndefined();
      current = res.game;
    }
    return current;
  };

  test('pointillé libre : à égalité, le dernier à avoir posé (sur le dernier emplacement) couvre le secteur', () => {
    markSignals(sector, [P2, P2, P2, P1, P1]);
    const scores = [P1, P2].map(id => getPlayer(game, id).score);

    const after = scan(1);
    const covered = after.board.sectors[0];

    expect(covered.coveredBy).toEqual([P1]);
    expect(getPlayer(after, P1).score).toBe(scores[0] + 3);
    expect(getPlayer(after, P2).score).toBe(scores[1]);
    // Le 2e garde un marqueur sur le premier emplacement
    expect(covered.signals.map(s => s.markedBy)).toEqual([P2, undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  test('pointillé rempli dans la même action : à égalité, son signal départage, et le secteur n\'est couvert qu\'une fois', () => {
    markSignals(sector, [P2, P2, P2, P3, P1]);
    const scores = [P1, P2, P3].map(id => getPlayer(game, id).score);

    const after = scan(2);
    const covered = after.board.sectors[0];

    // P1 et P2 à 3 signaux : P1 a posé en dernier (pointillé)
    expect(covered.coveredBy).toEqual([P1]);
    expect(getPlayer(after, P1).score).toBe(scores[0] + 3);
    expect(getPlayer(after, P2).score).toBe(scores[1]);
    expect(getPlayer(after, P3).score).toBe(scores[2]);
    expect(covered.signals.map(s => s.markedBy)).toEqual([P2, undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  test('pointillé rempli par un joueur à égalité qui n\'avait pas posé le dernier signal Donnée', () => {
    markSignals(sector, [P1, P1, P2, P2, P2]);
    const after = scan(2);
    // P1 marque le 6e emplacement (3-3, P1 dernier), puis le pointillé (4-3)
    expect(after.board.sectors[0].coveredBy).toEqual([P1]);
    expect(after.board.sectors[0].signals[0].markedBy).toBe(P2);
  });
});

describe('plusieurs secteurs complétés par une même action', () => {
  test.each([
    ['un adversaire humain', P2, false],
    ['un robot', P2, true],
    ['le joueur qui scanne', P1, false],
  ])('signal dans un secteur et ses deux voisins, gagnés par %s : les trois secteurs sont résolus, chacun après la trace de vie du précédent', async (_label, winner, robot) => {
    const game = await createTestGame(['Alice', 'Bob', 'Carol']);
    if (robot) Object.assign(getPlayer(game, winner), { type: 'robot', aiDifficulty: 'EXPERT' });
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const sectorIds = [game.board.sectors[7].id, game.board.sectors[0].id, game.board.sectors[1].id];
    // Il ne reste que le dernier emplacement Donnée de chaque secteur ; le gagnant y a la majorité
    sectorIds.forEach(id => markSignals(game.board.sectors.find(s => s.id === id)!, [winner, winner, winner, P3]));
    sectorIds.forEach(id => {
      const sector = game.board.sectors.find(s => s.id === id)!;
      const free = sector.signals.filter(s => !s.marked).length;
      markSignals(sector, [...sector.signals.slice(0, 4).map(s => s.markedBy!), ...Array(free - 2).fill(P3)]);
    });
    game.interaction = { type: 'SELECTING_SCAN_SECTOR', color: SectorType.ANY, markAdjacents: true, sequenceId: 'scan' };

    let res = GameSession.dispatch(game, P1, { type: 'CHOOSE', choice: { kind: 'SECTOR', sectorId: sectorIds[1] } });
    expect(res.error).toBeUndefined();
    // Chaque secteur résolu demande une trace de vie au gagnant : il la pose, puis le secteur suivant est résolu
    for (let i = 0; i < 3 && res.game.interaction?.type === 'PLACING_LIFE_TRACE'; i++) {
      const color = res.game.interaction.color;
      const [option] = SpeciesSystem.lifeTraceOptions(res.game, color);
      res = GameSession.dispatch(res.game, winner, { type: 'CHOOSE', choice: { kind: 'LIFE_TRACE', boardIndex: option.boardIndex, color: option.color, slotType: option.location, slotIndex: option.slotIndex } });
      expect(res.error).toBeUndefined();
    }

    expect(sectorIds.map(id => res.game.board.sectors.find(s => s.id === id)!.coveredBy)).toEqual([[winner], [winner], [winner]]);
    expect(res.game.pendingInteractions ?? []).toEqual([]);
  });
});
