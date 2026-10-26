import { ProbeSystem } from '../src/systems/ProbeSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { DiskName, Game, Mission, Probe, ProbeState, SectorNumber, Technology } from '../src/core/types';
import { InteractionResolver } from '../src/core/InteractionResolver';
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

    test("shouldCollectSpecimen : une lune de Jupiter ou Saturne compte (Exploration en Rover, La Reine)", () => {
      getPlayer(game, P1).cards.push(makeCard('rover', { passiveEffects: [{ type: 'GAIN_SATELLITE_LANDING_AND_SPECIMEN', value: true }] }));
      const moonId = game.board.planets.find(p => p.id === 'jupiter')!.satellites![0].id;
      expect(ProbeSystem.shouldCollectSpecimen(game, moonId, 'rover')).toBe(true);
      expect(ProbeSystem.specimenPlanetId(game, moonId)).toBe('jupiter');
    });

    test('prélever retire le jeton et le place dans une capsule sur la case de la planète, sans gagner sa récompense', () => {
      const scoreBefore = getPlayer(game, P1).score;
      const res = SpeciesSystem.takeMascamiteSpecimen(game, P1, 'jupiter', 0, 'collect', 'seq')!;

      expect(res.updatedGame.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toEqual([{ bonus: { media: 1 } }]);
      expect(getPlayer(res.updatedGame, P1).score).toBe(scoreBefore);
      const capsule = getPlayer(res.updatedGame, P1).probes.find(p => p.state === ProbeState.CAPSULE)!;
      expect(capsule).toMatchObject({ planetId: 'jupiter', specimen: { bonus: { pv: 3 } }, solarPosition: { disk: 'C', sector: 5, level: 1 } });
      expect(res.updatedGame.board.solarSystem.probes.some(p => p.id === capsule.id)).toBe(true);
      expect(res.historyEntries[0].message).toBe('prélève un spécimen Mascamite sur Jupiter et le place dans une capsule');
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

  describe('capsules Mascamites', () => {
    const missionReturning = (value: string): Mission => ({
      id: 'm1', cardId: 'ET', name: 'Retour de spécimen', description: '', ownerId: P1,
      requirements: [{ id: 'r1', type: 'GAIN_IF_SPECIMEN', target: value.split(':')[1], value }],
      completedRequirementIds: [], fulfillableRequirementIds: [], completed: false,
    });

    test("une capsule se déplace comme une sonde mais n'en est pas une (lancement, orbite)", () => {
      const withCapsule = SpeciesSystem.takeMascamiteSpecimen(
        { ...game, board: { ...game.board, planets: game.board.planets.map(p => p.id === 'jupiter' ? { ...p, mascamiteTokens: [{ bonus: { pv: 3 } }] } : p) } },
        P1, 'jupiter', 0, 'collect', 'seq')!.updatedGame;
      const capsule = getPlayer(withCapsule, P1).probes.find(p => p.state === ProbeState.CAPSULE)!;
      getPlayer(withCapsule, P1).energy = 3;

      expect(ProbeSystem.canMoveProbe(withCapsule, P1, capsule.id).canMove).toBe(true);
      expect(ProbeSystem.canOrbit(withCapsule, P1, capsule.id).canOrbit).toBe(false);
      expect(ProbeSystem.canLaunchProbe(withCapsule, P1).canLaunch).toBe(true);

      const moved = ProbeSystem.moveProbe(withCapsule, P1, capsule.id, 'C', 4, 0, 'seq');
      expect(getPlayer(moved.updatedGame, P1).probes.find(p => p.id === capsule.id)!.state).toBe(ProbeState.CAPSULE);
      expect(moved.historyEntries[0].message).toContain('déplacer une capsule');
    });

    test('ramener le spécimen sur Terre accomplit la mission : récompense de la carte + celle du spécimen, la capsule disparaît', () => {
      const capsule = ProbeSystem.createCapsule(game, P1, 'earth', { bonus: { pv: 3 } })!;
      getPlayer(game, P1).missions = [missionReturning('GAIN_IF_SPECIMEN:earth:pv:3:data:3')];
      const { score, data } = getPlayer(game, P1);

      const res = InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm1', requirementId: 'r1', sequenceId: 'seq' });

      expect(res.error).toBeUndefined();
      expect(getPlayer(res.updatedGame, P1).score).toBe(score + 6);
      expect(getPlayer(res.updatedGame, P1).data).toBe(data + 3);
      expect(getPlayer(res.updatedGame, P1).probes.some(p => p.id === capsule.id)).toBe(false);
      expect(res.updatedGame.board.solarSystem.probes.some(p => p.id === capsule.id)).toBe(false);
      expect(res.historyEntries[0].message).toContain('en ramenant un spécimen sur Terre');
    });

    test('Prélèvement de Reproducteurs : la récompense du spécimen est gagnée deux fois', () => {
      ProbeSystem.createCapsule(game, P1, 'earth', { bonus: { pv: 3 } });
      getPlayer(game, P1).missions = [missionReturning('GAIN_IF_SPECIMEN:earth:specimen:2')];
      const score = getPlayer(game, P1).score;
      const res = InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm1', requirementId: 'r1', sequenceId: 'seq' });
      expect(getPlayer(res.updatedGame, P1).score).toBe(score + 6);
    });

    test('sans capsule sur la destination, la mission ne peut pas être accomplie', () => {
      ProbeSystem.createCapsule(game, P1, 'jupiter', { bonus: { pv: 3 } });
      getPlayer(game, P1).missions = [missionReturning('GAIN_IF_SPECIMEN:earth:pv:3:data:3')];
      const res = InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm1', requirementId: 'r1', sequenceId: 'seq' });
      expect(res.error).toBe('Conditions non remplies.');
    });
  });

  describe("historique de l'orbite et de l'atterrissage (rédigé par le moteur, pour les robots aussi)", () => {
    test("l'atterrissage sur une lune nomme la lune et son coût, puis les gains", () => {
      const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
      const moon = jupiter.satellites![0];
      getPlayer(game, P1).probes = [probeAt('p1', 'C', 5, 1)];
      game.board.solarSystem.probes = structuredClone(getPlayer(game, P1).probes);
      getPlayer(game, P1).energy = 5;
      getPlayer(game, P1).technologies.push({ id: 'exploration-4-x', name: 'Exploration IV', type: 'Exploration', effects: [], bonus: {}, description: '', shorttext: '' } as unknown as Technology);

      const res = ProbeSystem.landProbe(game, P1, 'p1', moon.id, true, undefined, undefined, 'seq');
      expect(res.historyEntries[0]).toEqual({ message: `<strong>Pose une sonde</strong> (bonus) sur ${moon.name}`, playerId: P1, sequenceId: 'seq' });
      expect(res.historyEntries.every(e => e.sequenceId === 'seq')).toBe(true);
    });

    test("la mise en orbite payante indique son coût", () => {
      getPlayer(game, P1).probes = [probeAt('p1', 'B', 1, 2)];
      game.board.solarSystem.probes = structuredClone(getPlayer(game, P1).probes);
      Object.assign(getPlayer(game, P1), { credits: 5, energy: 5 });
      const res = ProbeSystem.orbitProbe(game, P1, 'p1', 'mars', 'seq');
      expect(res.historyEntries[0].message).toMatch(/^paye .+ pour <strong>Mettre en orbite<\/strong> une sonde autour de Mars$/);
    });
  });
});
