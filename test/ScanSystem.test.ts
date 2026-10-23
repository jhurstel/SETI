import { ScanSystem } from '../src/systems/ScanSystem';
import { Game, Sector, SignalType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

/** Marque les signaux d'un secteur dans l'ordre donné (le dernier est le plus récent). */
function markSignals(sector: Sector, playerIds: string[]): void {
  playerIds.forEach((playerId, i) => {
    sector.signals[i].marked = true;
    sector.signals[i].markedBy = playerId;
  });
}

describe('ScanSystem', () => {
  let game: Game;
  let sector: Sector;
  const P1 = 'player_0';
  const P2 = 'player_1';
  const P3 = 'player_2';

  beforeEach(async () => {
    game = await createTestGame(['Alice', 'Bob', 'Carol']);
    sector = game.board.sectors[0];
    // Bonus simples pour rendre les assertions indépendantes du plateau tiré au hasard
    sector.firstBonus = { pv: 3 };
    sector.nextBonus = { pv: 5 };
  });

  describe('canScanSector', () => {
    test('autorisé avec 1 crédit et 2 énergies', () => {
      getPlayer(game, P1).credits = 1;
      getPlayer(game, P1).energy = 2;
      expect(ScanSystem.canScanSector(game, P1).canScan).toBe(true);
    });

    test('refusé sans crédit ou sans énergie suffisante', () => {
      getPlayer(game, P1).credits = 0;
      expect(ScanSystem.canScanSector(game, P1)).toMatchObject({ canScan: false, reason: expect.stringContaining('Crédits') });

      getPlayer(game, P1).credits = 5;
      getPlayer(game, P1).energy = 1;
      expect(ScanSystem.canScanSector(game, P1)).toMatchObject({ canScan: false, reason: expect.stringContaining('Énergie') });
    });

    test('le coût peut être ignoré (scan bonus)', () => {
      getPlayer(game, P1).credits = 0;
      expect(ScanSystem.canScanSector(game, P1, false).canScan).toBe(true);
    });
  });

  describe('scanSector', () => {
    test('marque le premier signal libre et rapporte 1 donnée', () => {
      const { updatedGame, bonuses } = ScanSystem.scanSector(game, P1, sector.id);
      const updatedSector = ScanSystem.getSectorById(updatedGame, sector.id)!;

      expect(updatedSector.signals[0]).toMatchObject({ marked: true, markedBy: P1 });
      expect(updatedSector.signals[1].marked).toBe(false);
      expect(bonuses).toEqual({ data: 1 });
    });

    test('le 2e signal rapporte 2 PV en plus', () => {
      markSignals(sector, [P2]);
      const { bonuses } = ScanSystem.scanSector(game, P1, sector.id);
      expect(bonuses).toEqual({ data: 1, pv: 2 });
    });

    test('option noData : pas de donnée', () => {
      const { bonuses } = ScanSystem.scanSector(game, P1, sector.id, true, true);
      expect(bonuses.data).toBeUndefined();
    });

    test('secteur plein : aucun signal marqué', () => {
      markSignals(sector, sector.signals.map(() => P2));
      const { bonuses, logs } = ScanSystem.scanSector(game, P1, sector.id);
      expect(bonuses).toEqual({});
      expect(logs[0]).toContain('plein');
    });

    test('lève une erreur si le joueur ne peut pas payer', () => {
      getPlayer(game, P1).credits = 0;
      expect(() => ScanSystem.scanSector(game, P1, sector.id)).toThrow('Crédits insuffisants');
    });

    test('ne modifie pas la partie d\'origine', () => {
      ScanSystem.scanSector(game, P1, sector.id);
      expect(sector.signals[0].marked).toBe(false);
    });
  });

  describe('isSectorCovered', () => {
    test('couvert quand tous les signaux Donnée sont marqués (le signal blanc ne compte pas)', () => {
      const dataSignals = sector.signals.filter(s => s.type === SignalType.DATA);
      markSignals(sector, dataSignals.map(() => P1));
      expect(ScanSystem.isSectorCovered(game, sector.id)).toBe(true);
    });

    test('non couvert s\'il reste un signal Donnée libre', () => {
      markSignals(sector, [P1]);
      expect(ScanSystem.isSectorCovered(game, sector.id)).toBe(false);
    });
  });

  describe('calculateMajorities', () => {
    test('trie les joueurs par nombre de marqueurs', () => {
      markSignals(sector, [P2, P1, P1]);
      expect(ScanSystem.calculateMajorities(sector)).toEqual([
        { playerId: P1, count: 2 },
        { playerId: P2, count: 1 },
      ]);
    });

    test('égalité pour la 1re place : le dernier marqueur posé gagne', () => {
      markSignals(sector, [P1, P2]);
      expect(ScanSystem.calculateMajorities(sector)[0].playerId).toBe(P2);

      markSignals(sector, [P2, P1]);
      expect(ScanSystem.calculateMajorities(sector)[0].playerId).toBe(P1);
    });

    test('secteur vide → aucune majorité', () => {
      expect(ScanSystem.calculateMajorities(sector)).toEqual([]);
      expect(ScanSystem.calculateMajority(sector)).toEqual({ playerId: null, count: 0 });
    });

    test('calculateMajority applique la même règle d\'égalité', () => {
      markSignals(sector, [P1, P2, P2, P1]);
      expect(ScanSystem.calculateMajority(sector)).toEqual({ playerId: P1, count: 2 });
    });
  });

  describe('coverSector', () => {
    test('le gagnant reçoit le bonus de 1re couverture et le secteur est marqué couvert', () => {
      markSignals(sector, [P1, P2, P1]);
      const { updatedGame, bonuses, winnerId } = ScanSystem.coverSector(game, P1, sector.id);
      const covered = ScanSystem.getSectorById(updatedGame, sector.id)!;

      expect(winnerId).toBe(P1);
      expect(bonuses.pv).toBe(3);
      expect(covered.isCovered).toBe(true);
      expect(covered.coveredBy).toEqual([P1]);
    });

    test('chaque joueur présent gagne 1 média', () => {
      markSignals(sector, [P1, P2, P1]);
      const mediaBefore = [P1, P2, P3].map(id => getPlayer(game, id).mediaCoverage);
      const { updatedGame } = ScanSystem.coverSector(game, P1, sector.id);

      expect(getPlayer(updatedGame, P1).mediaCoverage).toBe(mediaBefore[0] + 1);
      expect(getPlayer(updatedGame, P2).mediaCoverage).toBe(mediaBefore[1] + 1);
      expect(getPlayer(updatedGame, P3).mediaCoverage).toBe(mediaBefore[2]);
    });

    test('les signaux sont réinitialisés et le 2e garde un marqueur en 1re position', () => {
      markSignals(sector, [P1, P2, P1, P3, P2]);
      const { updatedGame } = ScanSystem.coverSector(game, P1, sector.id);
      const covered = ScanSystem.getSectorById(updatedGame, sector.id)!;

      // P1 et P2 à égalité (2) : P2 a posé en dernier → 1er ; P1 → 2e
      expect(covered.signals[0]).toMatchObject({ marked: true, markedBy: P1 });
      expect(covered.signals.slice(1).every(s => !s.marked)).toBe(true);
    });

    test('une couverture suivante utilise le bonus « suivant »', () => {
      sector.isCovered = true;
      markSignals(sector, [P1]);
      const { bonuses } = ScanSystem.coverSector(game, P1, sector.id);
      expect(bonuses.pv).toBe(5);
    });

    test('si un autre joueur gagne, son bonus lui est appliqué directement', () => {
      markSignals(sector, [P2, P2, P1]);
      const scoreBefore = getPlayer(game, P2).score;
      const { updatedGame, bonuses, winnerId } = ScanSystem.coverSector(game, P1, sector.id);

      expect(winnerId).toBe(P2);
      expect(bonuses.pv).toBeUndefined();
      expect(getPlayer(updatedGame, P2).score).toBe(scoreBefore + 3);
    });
  });
});
