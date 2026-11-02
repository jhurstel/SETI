import { CardSystem } from '../src/systems/CardSystem';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { createRotationState, getAdjacentCells, getCell } from '../src/core/SolarSystemPosition';
import { DiskName, FreeActionType, Game, Probe, ProbeState, RevenueType, SectorNumber, SectorType } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

describe('cartes : revenus, actions gratuites et récompenses', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });
  afterEach(() => logSpy.mockRestore());

  describe('carte glissée sous les revenus', () => {
    test('revenu Média : +1 revenu Média et +1 Média tout de suite', () => {
      const player = getPlayer(game, P1);
      player.cards.push(makeCard('rm', { revenue: RevenueType.MEDIA }));
      player.mediaCoverage = 2;
      const revenue = player.revenueMedia || 0;
      const res = CardSystem.reserveCard(game, P1, 'rm');
      expect(getPlayer(res, P1).revenueMedia).toBe(revenue + 1);
      expect(getPlayer(res, P1).mediaCoverage).toBe(3);
      expect(player.cards.some(c => c.id === 'rm')).toBe(true);
    });

    test('revenu Donnée : +1 revenu Donnée et +1 Donnée tout de suite', () => {
      const player = getPlayer(game, P1);
      player.cards.push(makeCard('rd', { revenue: RevenueType.DATA }));
      player.data = 1;
      const revenue = player.revenueData || 0;
      const res = CardSystem.reserveCard(game, P1, 'rd');
      expect(getPlayer(res, P1).revenueData).toBe(revenue + 1);
      expect(getPlayer(res, P1).data).toBe(2);
    });
  });

  describe('défausse pour la ressource du revenu (ET.15)', () => {
    test.each([
      [RevenueType.MEDIA, 'mediaCoverage'],
      [RevenueType.DATA, 'data'],
    ] as const)('revenu %s : +1', (revenue, field) => {
      const player = getPlayer(game, P1);
      player.cards.push(makeCard('rv', { revenue, name: 'Revenu' }));
      player.mediaCoverage = 0;
      player.data = 0;
      const res = CardSystem.discardCardForRevenue(game, P1, 'rv', 'seq');
      expect(getPlayer(res.updatedGame, P1)[field]).toBe(1);
      expect(res.historyEntries[0].message).toMatch(/^défausse carte "Revenu" et .+ \(revenu\)$/);
      expect(player[field]).toBe(0);
    });
  });

  describe('action gratuite d\'une carte', () => {
    test('carte gagnée qui déclenche son action gratuite « Donnée » (Subventions) : +1 Donnée', () => {
      game.decks.cardRow[0] = makeCard('gd', { freeAction: FreeActionType.DATA, name: 'Gagnée' });
      getPlayer(game, P1).data = 0;
      const res = CardSystem.acquireCard(game, P1, 'gd', { isFree: true, triggerFreeAction: true }, 'seq');
      expect(getPlayer(res.updatedGame, P1).data).toBe(1);
      expect(res.historyEntries[0].message).toContain('et gagne 1 Donnée');
    });

    test('défausse « PV + Déplacement » : 1 PV et un déplacement gratuit', () => {
      const player = getPlayer(game, P1);
      player.cards.push(makeCard('pm', { freeAction: FreeActionType.PV_MOVEMENT }));
      const score = player.score;
      const res = CardSystem.discardCardForFreeAction(game, P1, 'pm');
      expect(getPlayer(res.updatedGame, P1).score).toBe(score + 1);
      expect(res.newPendingInteractions).toContainEqual(expect.objectContaining({ type: 'MOVING_PROBE', count: 1 }));
    });

    test.each([
      [FreeActionType.DATA, 'data'],
      [FreeActionType.MOVEMENT, 'move'],
    ] as const)('Université Cornell (138) : défausser pour « %s » prépare le cercle correspondant', (freeAction, resource) => {
      const player = getPlayer(game, P1);
      player.credits = 10;
      const index = [game.decks.cards, game.decks.cardRow, ...Object.values(game.decks.roundDecks)].find(cards => cards.some(c => c.id === '138'))!;
      player.cards.push(...index.splice(index.findIndex(c => c.id === '138'), 1));
      game = CardSystem.playCard(game, P1, '138').updatedGame;
      getPlayer(game, P1).cards.push(makeCard('fa', { freeAction }));

      const res = CardSystem.discardCardForFreeAction(game, P1, 'fa');
      const cornell = getPlayer(res.updatedGame, P1).missions.find(m => m.cardId === '138')!;
      const triggered = cornell.requirements.filter(r => cornell.fulfillableRequirementIds.includes(r.id!)).map(r => String(r.value));
      expect(triggered).toEqual([expect.stringContaining(`GAIN_ON_DISCARD:${resource}:`)]);
    });
  });

  test("Recherche d'Astéroïdes (129) : visiter un champ d'astéroïdes prépare un cercle", () => {
    const solar = game.board.solarSystem;
    solar.rotationAngleLevel1 = 0;
    solar.rotationAngleLevel2 = 0;
    solar.rotationAngleLevel3 = 0;
    const rotation = createRotationState(0, 0, 0);
    const isAsteroid = (disk: DiskName, sector: SectorNumber) => !!getCell(disk, sector, rotation, solar.extraCelestialObjects)?.hasAsteroid;
    const isPlain = (disk: DiskName, sector: SectorNumber) => {
      const cell = getCell(disk, sector, rotation, solar.extraCelestialObjects);
      return !!cell && !cell.hasAsteroid && !cell.hasPlanet && !cell.hasComet;
    };
    let route: { from: { disk: DiskName; sector: SectorNumber }; to: { disk: DiskName; sector: SectorNumber } } | undefined;
    for (const disk of ['A', 'B', 'C', 'D', 'E'] as DiskName[]) {
      for (let s = 1; s <= 8 && !route; s++) {
        const sector = s as SectorNumber;
        const from = isAsteroid(disk, sector) ? getAdjacentCells(disk, sector).find(c => isPlain(c.disk, c.sector)) : undefined;
        if (from) route = { from, to: { disk, sector } };
      }
    }
    expect(route).toBeDefined();

    const player = getPlayer(game, P1);
    player.credits = 10;
    player.energy = 10;
    const decks = [game.decks.cards, game.decks.cardRow, ...Object.values(game.decks.roundDecks)].find(cards => cards.some(c => c.id === '129'))!;
    player.cards.push(...decks.splice(decks.findIndex(c => c.id === '129'), 1));
    game = CardSystem.playCard(game, P1, '129').updatedGame;
    const probe: Probe = { id: 'pa', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { ...route!.from, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false };
    getPlayer(game, P1).probes = [probe];
    game.board.solarSystem.probes = [probe];

    const res = ProbeSystem.moveProbe(game, P1, 'pa', route!.to.disk, route!.to.sector, 1, 'seq');
    expect(getPlayer(res.updatedGame, P1).missions.find(m => m.cardId === '129')!.fulfillableRequirementIds).toHaveLength(1);
    expect(getPlayer(game, P1).missions.find(m => m.cardId === '129')!.fulfillableRequirementIds).toEqual([]);
  });

  test('récompenses de mission en signaux de couleur', () => {
    expect(CardSystem.parseRewards(['yellowsignal', '1', 'redsignal', '2', 'bluesignal', '1']).signals).toEqual([
      { amount: 1, scope: SectorType.YELLOW },
      { amount: 2, scope: SectorType.RED },
      { amount: 1, scope: SectorType.BLUE },
    ]);
  });
});
