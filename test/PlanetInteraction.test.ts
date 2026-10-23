import { ProbeSystem } from '../src/systems/ProbeSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { DiskName, Game, Probe, ProbeState, SectorNumber } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

const probeAt = (id: string, disk: DiskName, sector: SectorNumber, level: number): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false,
});

describe('Orbite / atterrissage : fonctions moteur utilisées par l\'interface', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  describe('ProbeSystem.findProbeAtPlanet', () => {
    test('trouve la sonde du joueur sur la case de la planète (Mars : disque B, secteur 1, niveau 2)', () => {
      getPlayer(game, P1).probes = [probeAt('p1', 'B', 1, 2)];
      expect(ProbeSystem.findProbeAtPlanet(game, P1, 'mars')).toEqual({ probe: expect.objectContaining({ id: 'p1' }), planetName: 'Mars' });
    });

    test('un satellite est ramené à sa planète parente', () => {
      const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
      const moonId = jupiter.satellites![0].id;
      getPlayer(game, P1).probes = [probeAt('p1', 'C', 5, 1)];
      expect(ProbeSystem.findProbeAtPlanet(game, P1, moonId)?.planetName).toBe('Jupiter');
    });

    test('pas de sonde sur la planète, ou sonde déjà posée : null', () => {
      getPlayer(game, P1).probes = [probeAt('p1', 'B', 2, 2)];
      expect(ProbeSystem.findProbeAtPlanet(game, P1, 'mars')).toBeNull();

      getPlayer(game, P1).probes = [{ ...probeAt('p1', 'B', 1, 2), state: ProbeState.LANDED }];
      expect(ProbeSystem.findProbeAtPlanet(game, P1, 'mars')).toBeNull();
    });
  });

  describe('ProbeSystem.getSlotBonus', () => {
    test('emplacements d\'orbite et d\'atterrissage d\'une planète', () => {
      const mars = game.board.planets.find(p => p.id === 'mars')!;
      expect(ProbeSystem.getSlotBonus(game, 'mars', 'orbit', 0)).toEqual(mars.orbitSlots[0]);
      expect(ProbeSystem.getSlotBonus(game, 'mars', 'land', 1)).toEqual(mars.landSlots[1]);
    });

    test('bonus d\'atterrissage d\'un satellite ; pas d\'orbite autour d\'un satellite', () => {
      const moon = game.board.planets.find(p => p.id === 'jupiter')!.satellites![0];
      expect(ProbeSystem.getSlotBonus(game, moon.id, 'land', 0)).toEqual(moon.landBonus);
      expect(ProbeSystem.getSlotBonus(game, moon.id, 'orbit', 0)).toBeUndefined();
    });
  });

  describe('spécimens Mascamites', () => {
    beforeEach(() => {
      const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
      jupiter.mascamiteTokens = [{ bonus: { pv: 3 } }, { bonus: { media: 1 } }];
    });

    test('shouldCollectSpecimen : seulement pour une carte « … et spécimen », sur Jupiter/Saturne avec jetons', () => {
      getPlayer(game, P1).cards.push(makeCard('spec', { passiveEffects: [{ type: 'GAIN_ORBIT_OR_LAND_AND_SPECIMEN', value: true }] }));
      expect(ProbeSystem.shouldCollectSpecimen(game, 'jupiter', 'spec')).toBe(true);
      expect(ProbeSystem.shouldCollectSpecimen(game, 'mars', 'spec')).toBe(false);
      expect(ProbeSystem.shouldCollectSpecimen(game, 'jupiter', getPlayer(game, P1).cards[0].id)).toBe(false);
      expect(ProbeSystem.shouldCollectSpecimen(game, 'jupiter', undefined)).toBe(false);
    });

    test('prélever retire le jeton et applique son bonus', () => {
      const scoreBefore = getPlayer(game, P1).score;
      const res = SpeciesSystem.takeMascamiteSpecimen(game, P1, 'jupiter', 0, 'collect', 'seq')!;

      expect(res.updatedGame.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toEqual([{ bonus: { media: 1 } }]);
      expect(getPlayer(res.updatedGame, P1).score).toBe(scoreBefore + 3);
      expect(res.historyEntries[0].message).toBe('prélève un spécimen Mascamite sur Jupiter');
      expect(game.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toHaveLength(2);
    });

    test('étudier laisse le jeton en place', () => {
      const res = SpeciesSystem.takeMascamiteSpecimen(game, P1, 'jupiter', 1, 'consult', 'seq')!;
      expect(res.updatedGame.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toHaveLength(2);
      expect(res.historyEntries[0].message).toBe('étudie un spécimen Mascamite sur Jupiter');
    });

    test('aucun jeton à cet index : null', () => {
      expect(SpeciesSystem.takeMascamiteSpecimen(game, P1, 'jupiter', 5, 'collect', 'seq')).toBeNull();
      expect(SpeciesSystem.takeMascamiteSpecimen(game, P1, 'mars', 0, 'collect', 'seq')).toBeNull();
    });
  });
});
