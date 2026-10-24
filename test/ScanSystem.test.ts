import { ScanSystem } from '../src/systems/ScanSystem';
import { Game, InteractionState, Sector, SectorType, SignalType } from '../src/core/types';

type ScanSectorSelection = Extract<InteractionState, { type: 'SELECTING_SCAN_SECTOR' }>;
import { createTestGame, getPlayer } from './helpers/gameFixture';
import { CardSystem } from '../src/systems/CardSystem';
import { InteractionResolver } from '../src/core/InteractionResolver';

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
  describe('resolveScanSectorSelection', () => {
    const scanInteraction = (overrides: Partial<ScanSectorSelection> = {}): ScanSectorSelection =>
      ({ type: 'SELECTING_SCAN_SECTOR', color: SectorType.ANY, sequenceId: 'seq', ...overrides });
    const markedBy = (g: Game, sectorId: string, playerId: string) =>
      ScanSystem.getSectorById(g, sectorId)!.signals.filter(s => s.marked && s.markedBy === playerId).length;

    test('refuse un secteur de la mauvaise couleur', () => {
      const other = game.board.sectors.find(s => s.color !== sector.color)!;
      const res = ScanSystem.resolveScanSectorSelection(game, P1, scanInteraction({ color: other.color }), sector.id, 'seq');
      expect(res.error).toContain('Couleur incorrecte');
      expect(res.updatedGame).toBe(game);
    });

    test('défausse la carte de la rangée et marque un signal sans modifier la partie reçue', () => {
      const rowCard = game.decks.cardRow[0];
      const res = ScanSystem.resolveScanSectorSelection(game, P1, scanInteraction({ cardId: rowCard.id }), sector.id, 'seq');

      expect(res.error).toBeUndefined();
      expect(res.updatedGame.decks.cardRow.some(c => c.id === rowCard.id)).toBe(false);
      expect(res.updatedGame.decks.discardPile.some(c => c.id === rowCard.id)).toBe(true);
      expect(markedBy(res.updatedGame, sector.id, P1)).toBe(1);
      expect(markedBy(game, sector.id, P1)).toBe(0);
      expect(res.historyEntries[0].message).toContain('de la rangée');
    });

    test('markAdjacents marque aussi les deux secteurs voisins', () => {
      const res = ScanSystem.resolveScanSectorSelection(game, P1, scanInteraction({ markAdjacents: true }), 'sector_1', 'seq');
      ['sector_8', 'sector_1', 'sector_2'].forEach(id => expect(markedBy(res.updatedGame, id, P1)).toBe(1));
    });

    test("keepCardIfOnly remet la carte en main s'il s'agit du seul signal du joueur", () => {
      const card = getPlayer(game, P1).cards[0];
      const res = ScanSystem.resolveScanSectorSelection(game, P1, scanInteraction({ cardId: card.id, keepCardIfOnly: true }), sector.id, 'seq');
      expect(getPlayer(res.updatedGame, P1).cards.some(c => c.id === card.id)).toBe(true);
      expect(res.updatedGame.decks.discardPile.some(c => c.id === card.id)).toBe(false);
    });

    test('onlyProbes exige une sonde du joueur dans le secteur', () => {
      const res = ScanSystem.resolveScanSectorSelection(game, P1, scanInteraction({ color: SectorType.PROBE, onlyProbes: true }), sector.id, 'seq');
      expect(res.error).toContain('une de vos sondes');
    });
  });

  describe('Observation II et IV', () => {
    test('Observation II coûte 1 Média', () => {
      getPlayer(game, P1).mediaCoverage = 0;
      expect(ScanSystem.applyObservation2(game, P1, 'seq').error).toBeDefined();

      getPlayer(game, P1).mediaCoverage = 2;
      const res = ScanSystem.applyObservation2(game, P1, 'seq');
      expect(res.error).toBeUndefined();
      expect(res.historyEntries[0].message).toContain('Observation II');
      expect(getPlayer(game, P1).mediaCoverage).toBe(2);
    });

    test('Observation IV : 1 Énergie pour lancer une sonde, ou 1 déplacement', () => {
      getPlayer(game, P1).energy = 0;
      expect(ScanSystem.applyObservation4(game, P1, 'PROBE', 'seq').error).toBeDefined();
      expect(ScanSystem.applyObservation4(game, P1, 'MOVE', 'seq').newPendingInteractions).toEqual([{ type: 'MOVING_PROBE', count: 1, sequenceId: 'seq' }]);

      getPlayer(game, P1).energy = 3;
      const probesBefore = getPlayer(game, P1).probes.length;
      const res = ScanSystem.applyObservation4(game, P1, 'PROBE', 'seq');
      expect(getPlayer(res.updatedGame, P1).energy).toBe(2);
      expect(getPlayer(res.updatedGame, P1).probes.length).toBe(probesBefore + 1);
      expect(getPlayer(game, P1).energy).toBe(3);
    });
  });
  describe('missions « après avoir effectué l’action Scanner un secteur »', () => {
    test('Temps de Télescope : un scan ne déclenche qu’un objectif, et le signal gagné ne relance pas la mission', () => {
      const playerId = game.players[game.currentPlayerIndex].id;
      const card = [...game.decks.cards, ...game.decks.cardRow, ...game.players.flatMap(p => p.cards)].find(c => c.id === '101')!;
      game.decks.cards = game.decks.cards.filter(c => c.id !== '101');
      game.decks.cardRow = game.decks.cardRow.filter(c => c.id !== '101');
      game.players.forEach(p => (p.cards = p.cards.filter(c => c.id !== '101')));
      getPlayer(game, playerId).cards.push(card);
      getPlayer(game, playerId).credits = 10;
      let current = CardSystem.playCard(game, playerId, '101').updatedGame;
      const missionOf = (g: Game) => getPlayer(g, playerId).missions.find(m => m.cardId === '101')!;

      // Un signal qui ne vient pas de l'action Scanner ne déclenche rien
      current = ScanSystem.performSignalAndCover(current, playerId, 'sector_1', [], false, 'seq').updatedGame;
      expect(missionOf(current).fulfillableRequirementIds).toEqual([]);

      // L'action Scanner rend les objectifs réalisables
      current = ScanSystem.performScanAction(current, true, 'seq', 'sector_1').updatedGame;
      expect(missionOf(current).fulfillableRequirementIds.length).toBeGreaterThan(0);

      // Valider l'objectif « signal jaune » puis marquer ce signal
      const requirementId = missionOf(current).requirements[0].id!;
      const claim = InteractionResolver.resolve(current, playerId, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: missionOf(current).id, requirementId, sequenceId: 'seq' });
      const signal = claim.newInteractions.find(i => i.type === 'SELECTING_SCAN_SECTOR') as ScanSectorSelection;
      expect(signal).toBeDefined();
      const yellowSector = claim.updatedGame.board.sectors.find(s => s.color === SectorType.YELLOW)!;
      current = ScanSystem.resolveScanSectorSelection(claim.updatedGame, playerId, signal, yellowSector.id, 'seq').updatedGame;

      expect(missionOf(current).completedRequirementIds).toEqual([requirementId]);
      expect(missionOf(current).fulfillableRequirementIds).toEqual([]);
    });
  });
});
