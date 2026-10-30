import { ProbeSystem } from '../src/systems/ProbeSystem';
import { createRotationState, getAdjacentCells, getCell, getObjectPosition } from '../src/core/SolarSystemPosition';
import { DiskName, Game, Mission, Probe, ProbeState, SectorNumber } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const probeAt = (id: string, disk: DiskName, sector: SectorNumber, level: number, state = ProbeState.IN_SOLAR_SYSTEM, ownerId = P1): Probe => ({
  id, ownerId, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state, isOrbiter: false, isLander: false,
});

function place(game: Game, probes: Probe[]): void {
  getPlayer(game, P1).probes = probes;
  game.board.solarSystem.probes = [...probes];
}

/** Mission « déclenchable » du joueur, avec son buff permanent */
function addTriggeredMission(game: Game, buffType: string): void {
  const player = getPlayer(game, P1);
  player.missions.push({ id: 'm', cardId: 'c', name: 'Mission test', description: '', ownerId: P1, requirements: [{ id: 'r', type: buffType, value: `${buffType}:pv:1` }], completedRequirementIds: [], fulfillableRequirementIds: [], completed: false } as Mission);
  player.permanentBuffs.push({ type: buffType, value: `${buffType}:pv:1`, id: 'r', source: 'Mission test' });
}

describe('Sondes : cas limites et refus', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    getPlayer(game, P1).credits = 10;
    getPlayer(game, P1).energy = 10;
  });

  const rotation = () => {
    const s = game.board.solarSystem;
    return createRotationState(s.rotationAngleLevel1 || 0, s.rotationAngleLevel2 || 0, s.rotationAngleLevel3 || 0);
  };
  /** Case absolue de Mars, et une case voisine (sonde posée au niveau fixe, secteur absolu) */
  const marsAndNeighbour = () => {
    const r = rotation();
    const mars = getObjectPosition('mars', r.level1Angle, r.level2Angle, r.level3Angle, game.board.solarSystem.extraCelestialObjects)!;
    const neighbour = getAdjacentCells(mars.disk, mars.absoluteSector)[0];
    return { mars, neighbour };
  };

  describe('Lancement', () => {
    test('joueur inconnu, crédits insuffisants, limite de sondes (2 avec Exploration I)', () => {
      expect(ProbeSystem.canLaunchProbe(game, 'inconnu').reason).toBe('Joueur introuvable');
      getPlayer(game, P1).credits = 0;
      expect(ProbeSystem.canLaunchProbe(game, P1).canLaunch).toBe(false);

      getPlayer(game, P1).credits = 10;
      place(game, [probeAt('p1', 'A', 1, 0)]);
      expect(ProbeSystem.canLaunchProbe(game, P1).reason).toContain('max 1');
      expect(ProbeSystem.canLaunchProbe(game, P1, true, true).canLaunch).toBe(true);

      getPlayer(game, P1).technologies.push(game.board.technologyBoard.available.find(t => t.id.startsWith('exploration-1'))!);
      expect(ProbeSystem.canLaunchProbe(game, P1).canLaunch).toBe(true);
      place(game, [probeAt('p1', 'A', 1, 0), probeAt('p2', 'A', 2, 0)]);
      expect(ProbeSystem.canLaunchProbe(game, P1).reason).toContain('max 2');
    });

    test('mission « lancer une sonde » : signalée comme à recouvrir', () => {
      addTriggeredMission(game, 'GAIN_ON_LAUNCH');
      const res = ProbeSystem.launchProbe(game, P1);
      expect(res.probeId).not.toBeNull();
      expect(res.historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);
    });
  });

  describe('Déplacement', () => {
    test('refus : joueur ou sonde inconnus, sonde hors du système solaire', () => {
      place(game, [probeAt('p1', 'A', 1, 0, ProbeState.IN_ORBIT)]);
      expect(ProbeSystem.canMoveProbe(game, 'inconnu', 'p1', 1).reason).toBe('Joueur introuvable');
      expect(ProbeSystem.canMoveProbe(game, P1, 'inconnue', 1).reason).toBe('Sonde introuvable');
      expect(ProbeSystem.canMoveProbe(game, P1, 'p1', 1).reason).toBe('La sonde doit être dans le système solaire');
      expect(() => ProbeSystem.moveProbe(game, P1, 'p1', 'A', 2, 1)).toThrow('La sonde doit être dans le système solaire');
      expect(ProbeSystem.getMovementCost(game, P1, 'inconnue')).toBe(1);
    });

    test('visite de Mars : 1 Média, mission « visiter Mars » à recouvrir, Média retiré par la carte ET.12', () => {
      const { mars, neighbour } = marsAndNeighbour();
      place(game, [probeAt('p1', neighbour.disk, neighbour.sector, 0)]);
      addTriggeredMission(game, 'GAIN_ON_VISIT_MARS');
      const media = getPlayer(game, P1).mediaCoverage;

      const res = ProbeSystem.moveProbe(game, P1, 'p1', mars.disk, mars.absoluteSector, 1, 's');
      const after = getPlayer(res.updatedGame, P1);
      expect(after.visitedPlanetsThisTurn).toContain('mars');
      expect(after.mediaCoverage).toBe(media + 1);
      expect(res.historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);

      getPlayer(game, P1).activeBuffs.push({ type: 'NO_MEDIA', value: 1, source: 'ET.12' });
      const noMedia = ProbeSystem.moveProbe(game, P1, 'p1', mars.disk, mars.absoluteSector, 1, 's');
      expect(getPlayer(noMedia.updatedGame, P1).mediaCoverage).toBe(media);
    });

    test('champ d\'astéroïdes : bonus « Survol d\'Astéroïdes » en Données, consommé', () => {
      const r = rotation();
      const extra = game.board.solarSystem.extraCelestialObjects;
      let target: { disk: DiskName; sector: SectorNumber } | undefined;
      let from: { disk: DiskName; sector: SectorNumber } | undefined;
      for (const disk of ['A', 'B', 'C', 'D', 'E'] as DiskName[]) {
        for (let s = 1; s <= 8 && !target; s++) {
          if (!getCell(disk, s as SectorNumber, r, extra)?.hasAsteroid) continue;
          const plain = getAdjacentCells(disk, s as SectorNumber).find(c => !getCell(c.disk, c.sector, r, extra)?.hasAsteroid);
          if (plain) { target = { disk, sector: s as SectorNumber }; from = plain; }
        }
      }
      place(game, [probeAt('p1', from!.disk, from!.sector, 0)]);
      const player = getPlayer(game, P1);
      player.data = 0;
      player.activeBuffs.push({ type: 'VISIT_ASTEROID', value: 1, source: 'Survol' });

      const res = ProbeSystem.moveProbe(game, P1, 'p1', target!.disk, target!.sector, 1, 's');

      expect(getPlayer(res.updatedGame, P1).data).toBe(1);
      expect(getPlayer(res.updatedGame, P1).activeBuffs.some(b => b.type === 'VISIT_ASTEROID')).toBe(false);
    });
  });

  describe('Orbite et atterrissage', () => {
    test('refus : joueur ou sonde inconnus, sonde pas sur une planète', () => {
      place(game, [probeAt('p1', 'A', 1, 0)]);
      expect(ProbeSystem.canOrbit(game, 'inconnu', 'p1').canOrbit).toBe(false);
      expect(ProbeSystem.canOrbit(game, P1, 'inconnue').canOrbit).toBe(false);
      expect(ProbeSystem.canOrbit(game, P1, 'p1').reason).toBe('La sonde doit être sur une planète autre que la Terre');
      expect(() => ProbeSystem.orbitProbe(game, P1, 'p1', 'mars')).toThrow();

      expect(ProbeSystem.canLand(game, 'inconnu', 'p1').canLand).toBe(false);
      expect(ProbeSystem.canLand(game, P1, 'inconnue').canLand).toBe(false);
      expect(ProbeSystem.canLand(game, P1, 'p1').reason).toBe('La sonde doit être sur une planète autre que la Terre');
      place(game, [probeAt('p1', 'B', 1, 2, ProbeState.IN_ORBIT)]);
      expect(ProbeSystem.canLand(game, P1, 'p1').reason).toBe('La sonde doit être dans le système solaire');
      expect(() => ProbeSystem.landProbe(game, P1, 'p1', 'mars')).toThrow();
    });

    test('carte 13 (Rover Perseverance) : +4 PV sur Mars, rien de plus ailleurs', () => {
      place(game, [probeAt('p1', 'B', 1, 2)]);
      const score = getPlayer(game, P1).score;
      const withRover = ProbeSystem.landProbe(game, P1, 'p1', 'mars', true, undefined, '13', 's');
      const without = ProbeSystem.landProbe(game, P1, 'p1', 'mars', true, undefined, undefined, 's');

      expect(getPlayer(withRover.updatedGame, P1).score - getPlayer(without.updatedGame, P1).score).toBe(4);
      expect(getPlayer(without.updatedGame, P1).score).toBeGreaterThanOrEqual(score);
    });

    test('missions « mettre en orbite » et « atterrir » : signalées comme à recouvrir', () => {
      place(game, [probeAt('p1', 'B', 1, 2)]);
      addTriggeredMission(game, 'GAIN_ON_ORBIT');
      addTriggeredMission(game, 'GAIN_ON_LAND');
      expect(ProbeSystem.orbitProbe(game, P1, 'p1', 'mars', 's', true).historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);
      expect(ProbeSystem.landProbe(game, P1, 'p1', 'mars', true, undefined, undefined, 's').historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);
    });

    test('retirer l\'orbiteur ou l\'atterrisseur d\'un adversaire : refusé', () => {
      const mars = game.board.planets.find(p => p.id === 'mars')!;
      mars.orbiters = [{ ...probeAt('o', 'B', 1, 2, ProbeState.IN_ORBIT, P2), planetId: 'mars' }];
      mars.landers = [{ ...probeAt('l', 'B', 1, 2, ProbeState.LANDED, P2), planetId: 'mars' }];
      expect(() => ProbeSystem.removeOrbiter(game, P1, 'mars', 0)).toThrow("Impossible de retirer l'orbiteur.");
      expect(() => ProbeSystem.removeLander(game, P1, 'mars', 0)).toThrow("Impossible de retirer l'atterrisseur.");
      expect(() => ProbeSystem.removeOrbiter(game, P1, 'mars', 5)).toThrow();
    });
  });
});
