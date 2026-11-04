import { ProbeSystem } from '../src/systems/ProbeSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { DiskName, Game, Mission, Probe, ProbeState, SectorNumber, Technology } from '../src/core/types';
import { InteractionResolver } from '../src/core/InteractionResolver';
import { InteractionChoices } from '../src/core/InteractionChoices';
import { LandAction } from '../src/actions/LandAction';
import { AIBehavior } from '../src/ai/AIBehavior';
import { ActionType, FreeActionType, AlienBoardType, LifeTraceType, LifeTraceLocation } from '../src/core/types';
import { cloneGame } from '../src/core/cloneGame';
import { CardSystem } from '../src/systems/CardSystem';
import { getObjectPosition } from '../src/core/SolarSystemPosition';
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

  describe('ProbeSystem.getPlayablePlanets', () => {
    const placeProbe = (probe: Probe) => {
      getPlayer(game, P1).probes = [probe];
      game.board.solarSystem.probes = [probe];
    };

    test('la planète où se trouve la sonde, si le joueur peut payer', () => {
      placeProbe(probeAt('p1', 'B', 1, 2));
      const player = getPlayer(game, P1);
      player.credits = 5;
      player.energy = 5;
      expect(ProbeSystem.getPlayablePlanets(game, P1, 'orbit')).toEqual(['mars']);
      expect(ProbeSystem.getPlayablePlanets(game, P1, 'land')).toEqual(['mars']);
    });

    test('sans énergie : rien à jouer, sauf si le coût est ignoré (bonus)', () => {
      placeProbe(probeAt('p1', 'B', 1, 2));
      getPlayer(game, P1).energy = 0;
      expect(ProbeSystem.getPlayablePlanets(game, P1, 'land')).toEqual([]);
      expect(ProbeSystem.getPlayablePlanets(game, P1, 'land', false)).toEqual(['mars']);
    });

    test("sonde hors d'une planète : aucune planète", () => {
      placeProbe(probeAt('p1', 'B', 2, 2));
      getPlayer(game, P1).energy = 5;
      expect(ProbeSystem.getPlayablePlanets(game, P1, 'land')).toEqual([]);
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

    test("défausser une carte Déplacement permet de déplacer une capsule (seule pièce du joueur dans le système solaire)", () => {
      getPlayer(game, P1).probes = [];
      expect(CardSystem.canDiscardFreeAction(game, P1, FreeActionType.MOVEMENT).canDiscard).toBe(false);

      const capsule = ProbeSystem.createCapsule(game, P1, 'jupiter', { bonus: { pv: 3 } })!;
      getPlayer(game, P1).energy = 0;
      const before = JSON.stringify(game);
      expect(CardSystem.canDiscardFreeAction(game, P1, FreeActionType.MOVEMENT).canDiscard).toBe(true);

      const res = InteractionChoices.moveProbe(game, P1, { type: 'MOVING_PROBE', count: 1, sequenceId: 's' }, capsule.id, 'C', 4, 's');
      expect(res.error).toBeUndefined();
      expect(getPlayer(res.updatedGame, P1).probes.find(p => p.id === capsule.id)!.solarPosition).toMatchObject({ disk: 'C' });
      expect(res.historyEntries[0].message).toContain('déplace une capsule gratuitement');
      expect(JSON.stringify(game)).toBe(before);
    });

    test('une capsule déclenche les effets de déplacement d\'une sonde (visite d\'une planète : bonus de carte et Média)', () => {
      const capsule = ProbeSystem.createCapsule(game, P1, 'jupiter', { bonus: { pv: 3 } })!;
      const player = getPlayer(game, P1);
      player.energy = 5;
      const solar = game.board.solarSystem;
      const jupiter = getObjectPosition('jupiter', solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0, solar.extraCelestialObjects)!;
      const awaySector = (jupiter.absoluteSector % 8) + 1 as SectorNumber;
      const away = ProbeSystem.moveProbe(game, P1, capsule.id, jupiter.disk, awaySector, 0, 's').updatedGame;
      const p = getPlayer(away, P1);
      p.activeBuffs = [...p.activeBuffs, { type: 'VISIT_BONUS', target: 'jupiter', value: 3, source: 'Test' }, { type: 'VISIT_BONUS', target: 'jupiter', value: { token: 1 }, source: 'Test' }];
      const { score, mediaCoverage, tokens = 0 } = p;

      const back = ProbeSystem.moveProbe(away, P1, capsule.id, jupiter.disk, jupiter.absoluteSector, 0, 's');

      expect(getPlayer(back.updatedGame, P1).score).toBe(score + 3);
      expect(getPlayer(back.updatedGame, P1).tokens).toBe(tokens + 1);
      expect(getPlayer(back.updatedGame, P1).mediaCoverage).toBe(mediaCoverage + 1);
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

    test('le spécimen ramené devient le bonus de la première case libre de la piste bleue des Mascamites', () => {
      const species = game.species.find(s => s.name === AlienBoardType.MASCAMITES)!;
      // Cases 0 et 1 imprimées, case 2 : 7e spécimen ; case 3 libre mais déjà occupée par une trace
      species.fixedSlots = { ...species.fixedSlots, bluelifetrace: species.fixedSlots.bluelifetrace.map((b, i) => (i === 2 ? { media: 1 } : b)) };
      const board = game.board.alienBoards[0];
      board.speciesId = AlienBoardType.MASCAMITES;
      board.lifeTraces = [{ id: 't', type: LifeTraceType.BLUE, playerId: P1, location: LifeTraceLocation.SPECIES, slotIndex: 3 }];
      ProbeSystem.createCapsule(game, P1, 'earth', { bonus: { pv: 3 } });
      getPlayer(game, P1).missions = [missionReturning('GAIN_IF_SPECIMEN:earth:pv:1')];
      const before = JSON.stringify(game);

      const res = InteractionResolver.resolve(game, P1, { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm1', requirementId: 'r1', sequenceId: 'seq' });

      const blue = res.updatedGame.species.find(s => s.name === AlienBoardType.MASCAMITES)!.fixedSlots.bluelifetrace;
      expect(blue[2]).toEqual({ media: 1 });
      expect(blue[3]).toEqual({});
      expect(blue[4]).toEqual({ pv: 3 });
      expect(res.historyEntries[0].message).toContain('le spécimen rejoint la piste bleue des Mascamites');
      expect(JSON.stringify(game)).toBe(before);
    });

    test('piste bleue pleine : le spécimen ramené ne se pose nulle part', () => {
      const species = game.species.find(s => s.name === AlienBoardType.MASCAMITES)!;
      species.fixedSlots = { ...species.fixedSlots, bluelifetrace: species.fixedSlots.bluelifetrace.map(() => ({ pv: 1 })) };
      const g = cloneGame(game);
      expect(SpeciesSystem.placeSpecimenOnTrack(g, { bonus: { pv: 3 } })).toBe(-1);
      expect(SpeciesSystem.placeSpecimenOnTrack({ ...g, species: g.species.filter(s => s.name !== AlienBoardType.MASCAMITES) }, { bonus: { pv: 3 } })).toBe(-1);
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

  describe('atterrissage sur une lune : Exploration IV ou carte qui le permet (non-régression : un robot y atterrissait sans)', () => {
    const exploration4 = { id: 'exploration-4-x', name: 'Exploration IV', type: 'Exploration', effects: [], bonus: {}, description: '', shorttext: '' } as unknown as Technology;
    let moonId: string;

    beforeEach(() => {
      moonId = game.board.planets.find(p => p.id === 'jupiter')!.satellites![0].id;
      getPlayer(game, P1).probes = [probeAt('p1', 'C', 5, 1)];
      game.board.solarSystem.probes = structuredClone(getPlayer(game, P1).probes);
      getPlayer(game, P1).energy = 10;
      game.currentPlayerIndex = 0;
    });

    test('sans la technologie : action refusée et absente des actions des robots ; la planète reste possible', () => {
      const before = JSON.stringify(game);
      expect(ProbeSystem.canLandOnSatellite(game, P1, moonId)).toEqual({ canLand: false, reason: 'Nécessite la technologie Exploration IV' });
      expect(new LandAction(P1, 'p1', moonId).validate(game).errors[0]?.message).toBe('Nécessite la technologie Exploration IV');
      expect(new LandAction(P1, 'p1', 'jupiter').validate(game).valid).toBe(true);
      const lands = AIBehavior.listMainActions(game, getPlayer(game, P1)).filter(a => a.action === ActionType.LAND).map(a => (a.data as { planetId: string }).planetId);
      expect(lands).toContain('jupiter');
      expect(lands).not.toContain(moonId);
      expect(JSON.stringify(game)).toBe(before);
    });

    test('avec Exploration IV : la lune est permise', () => {
      getPlayer(game, P1).technologies.push(exploration4);
      expect(new LandAction(P1, 'p1', moonId).validate(game).valid).toBe(true);
      expect(AIBehavior.listMainActions(game, getPlayer(game, P1)).some(a => a.action === ActionType.LAND && (a.data as { planetId: string }).planetId === moonId)).toBe(true);
    });

    test('atterrissage gratuit : refusé sur une lune sans la technologie, permis si la carte lève la limite', () => {
      const refused = InteractionChoices.placeBonusProbe(game, P1, { type: 'LANDING_PROBE', count: 1 }, moonId);
      expect(refused.error).toBe('Nécessite la technologie Exploration IV');
      expect(refused.updatedGame).toBe(game);
      const allowed = InteractionChoices.placeBonusProbe(game, P1, { type: 'LANDING_PROBE', count: 1, ignoreSatelliteLimit: true }, moonId);
      expect(allowed.error).toBeUndefined();
      expect(getPlayer(allowed.updatedGame, P1).probes[0].state).toBe(ProbeState.LANDED);
    });
  });

  describe("emplacements d'atterrissage et d'orbite (règles appliquées par le moteur, pas seulement l'interface)", () => {
    const exploration4 = { id: 'exploration-4-x', name: 'Exploration IV', type: 'Exploration', effects: [], bonus: {}, description: '', shorttext: '' } as unknown as Technology;
    const landed = (id: string, planetId: string, slot: number): Probe => ({ ...probeAt(id, 'C', 5, 1), ownerId: 'player_1', state: ProbeState.LANDED, planetId, isLander: true, planetSlotIndex: slot });
    let jupiter: ReturnType<typeof game.board.planets.find> & {};
    let moonId: string;

    beforeEach(() => {
      jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
      moonId = jupiter.satellites![0].id;
      getPlayer(game, P1).probes = [probeAt('p1', 'C', 5, 1)];
      game.board.solarSystem.probes = structuredClone(getPlayer(game, P1).probes);
      getPlayer(game, P1).energy = 10;
      getPlayer(game, P1).technologies.push(exploration4);
      game.currentPlayerIndex = 0;
    });

    test("une lune n'accueille qu'un atterrisseur, sauf Dragonfly (non-régression)", () => {
      jupiter.satellites![0].landers.push(landed('x', moonId, 0));
      const before = JSON.stringify(game);
      expect(new LandAction(P1, 'p1', moonId).validate(game).errors[0]?.message).toBe('Cette lune a déjà un atterrisseur');
      expect(AIBehavior.listMainActions(game, getPlayer(game, P1)).some(a => a.action === ActionType.LAND && (a.data as { planetId: string }).planetId === moonId)).toBe(false);
      expect(InteractionChoices.placeBonusProbe(game, P1, { type: 'LANDING_PROBE', count: 1 }, moonId).error).toBe('Cette lune a déjà un atterrisseur');
      const dragonfly = InteractionChoices.placeBonusProbe(game, P1, { type: 'LANDING_PROBE', count: 1, source: '16' }, moonId);
      expect(dragonfly.error).toBeUndefined();
      expect(dragonfly.updatedGame.board.planets.find(p => p.id === 'jupiter')!.satellites![0].landers).toHaveLength(2);
      expect(JSON.stringify(game)).toBe(before);
    });

    test("l'emplacement choisi doit être le suivant ; une case occupée seulement avec Dragonfly (non-régression)", () => {
      jupiter.landers.push(landed('a', 'jupiter', 0));
      expect(new LandAction(P1, 'p1', 'jupiter', 0).validate(game).errors[0]?.message).toBe("Cet emplacement d'atterrissage n'est pas disponible");
      expect(new LandAction(P1, 'p1', 'jupiter', 2).validate(game).valid).toBe(false);
      expect(new LandAction(P1, 'p1', 'jupiter', 1).validate(game).valid).toBe(true);
      expect(new LandAction(P1, 'p1', 'jupiter').validate(game).valid).toBe(true);
      expect(InteractionChoices.placeBonusProbe(game, P1, { type: 'LANDING_PROBE', count: 1 }, 'jupiter', 0).error).toBe("Cet emplacement d'atterrissage n'est pas disponible");
      const dragonfly = InteractionChoices.placeBonusProbe(game, P1, { type: 'LANDING_PROBE', count: 1, source: '16' }, 'jupiter', 0);
      expect(dragonfly.error).toBeUndefined();
      expect(getPlayer(dragonfly.updatedGame, P1).probes[0].planetSlotIndex).toBe(0);
      expect(ProbeSystem.landingSlotForClick(game, 'jupiter', 1)).toBe(1);
      expect(ProbeSystem.landingSlotForClick(game, 'jupiter', 0)).toBeNull();
      expect(ProbeSystem.landingSlotForClick(game, 'jupiter', 0, true)).toBe(0);
      expect(ProbeSystem.landingSlotForClick(game, 'jupiter', 2)).toBeNull();
      // Lune : pas de case à choisir ; corps inconnu : rien à vérifier
      expect(ProbeSystem.landingSlotForClick(game, moonId, 0)).toBeNull();
      expect(ProbeSystem.canLandOnSlot(game, 'inconnu', 3).canLand).toBe(true);
    });

    test("pas de limite d'atterrisseurs : au-delà des cases imprimées, le bonus des suivants (non-régression)", () => {
      jupiter.landSlots.forEach((_, i) => jupiter.landers.push(landed(`l${i}`, 'jupiter', i)));
      const last = jupiter.landSlots.length - 1;
      expect(ProbeSystem.landingSlotForClick(game, 'jupiter', last)).toBe(jupiter.landSlots.length);
      expect(new LandAction(P1, 'p1', 'jupiter', jupiter.landSlots.length).validate(game).valid).toBe(true);
      const score = getPlayer(game, P1).score;
      const res = ProbeSystem.landProbe(game, P1, 'p1', 'jupiter', true, jupiter.landSlots.length, undefined, 'seq');
      expect(getPlayer(res.updatedGame, P1).probes[0].planetSlotIndex).toBe(jupiter.landSlots.length);
      expect(getPlayer(res.updatedGame, P1).score).toBe(score + (jupiter.landSlots[last].pv ?? 0));
      expect(jupiter.landSlots[last].pv ?? 0).toBeGreaterThan(0);
    });

    test("pas de limite d'orbiteurs : au-delà des cases imprimées, le bonus des suivants (non-régression)", () => {
      Object.assign(getPlayer(game, P1), { credits: 5, energy: 5, data: 0 });
      const orbiter = (i: number): Probe => ({ ...landed(`o${i}`, 'jupiter', i), state: ProbeState.IN_ORBIT, isLander: false, isOrbiter: true });
      // Dernière case imprimée encore libre : même gain qu'au-delà des cases
      jupiter.orbiters = jupiter.orbitSlots.slice(1).map((_, i) => orbiter(i));
      const onLastSlot = getPlayer(ProbeSystem.orbitProbe(game, P1, 'p1', 'jupiter', 'seq').updatedGame, P1).data;
      jupiter.orbiters = jupiter.orbitSlots.map((_, i) => orbiter(i));
      const beyond = getPlayer(ProbeSystem.orbitProbe(game, P1, 'p1', 'jupiter', 'seq').updatedGame, P1).data;
      expect(onLastSlot).toBeGreaterThan(0);
      expect(beyond).toBe(onLastSlot);
    });
  });
});
