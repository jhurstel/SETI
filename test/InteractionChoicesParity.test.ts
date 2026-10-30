import { InteractionChoices } from '../src/core/InteractionChoices';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { createRotationState, getAbsoluteSectorForProbe, getCell } from '../src/core/SolarSystemPosition';
import { AlienBoardType, DiskName, Game, InteractionState, Probe, ProbeState, SectorNumber, SectorType, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const probeAt = (id: string, disk: DiskName, sector: SectorNumber, level: number): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false,
});

describe('InteractionChoices : choix communs au joueur humain et aux robots', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  describe('TechnologySystem.acquirableTechs', () => {
    test('le dessus de chaque pile, sans les piles déjà prises', () => {
      const all = TechnologySystem.acquirableTechs(game, P1);
      expect(all.map(t => TechnologySystem.stackId(t)).sort()).toHaveLength(12);

      getPlayer(game, P1).technologies.push(all[0]);
      const after = TechnologySystem.acquirableTechs(game, P1).map(t => TechnologySystem.stackId(t));
      expect(after).toHaveLength(11);
      expect(after).not.toContain(TechnologySystem.stackId(all[0]));
    });

    test('catégories autorisées et technologies partagées seulement', () => {
      const observation = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.OBSERVATION] });
      expect(observation.every(t => t.type === TechnologyCategory.OBSERVATION)).toBe(true);

      expect(TechnologySystem.acquirableTechs(game, P1, { sharedOnly: true })).toEqual([]);
      getPlayer(game, P2).technologies.push(observation[1]);
      expect(TechnologySystem.acquirableTechs(game, P1, { sharedOnly: true }).map(t => t.id)).toEqual([observation[1].id]);
    });
  });

  describe('acquireTech', () => {
    const computingWithPoints = (g: Game) => TechnologySystem.acquirableTechs(g, P1, { categories: [TechnologyCategory.COMPUTING] }).find(t => (t.bonus.pv ?? 0) > 0)!;

    test('Informatique : le choix de la colonne garde le renoncement au bonus de tuile (régression : bonus donné)', () => {
      const tech = computingWithPoints(game);
      const scoreBefore = getPlayer(game, P1).score;
      const gain: InteractionState = { type: 'ACQUIRING_TECH', isBonus: true, noTileBonus: true, sequenceId: 's' };

      const step = InteractionChoices.acquireTech(game, P1, gain as Extract<InteractionState, { type: 'ACQUIRING_TECH' }>, tech);
      expect(step.updatedGame).toBe(game);
      expect(step.newPendingInteractions).toEqual([{ type: 'SELECTING_COMPUTER_SLOT', tech, noTileBonus: true, sequenceId: 's' }]);

      const slot = step.newPendingInteractions[0] as Extract<InteractionState, { type: 'SELECTING_COMPUTER_SLOT' }>;
      const res = InteractionChoices.acquireTech(game, P1, slot, tech, 1);
      expect(res.error).toBeUndefined();
      expect(getPlayer(res.updatedGame, P1).technologies.map(t => t.id)).toContain(tech.id);
      expect(getPlayer(res.updatedGame, P1).score).toBe(scoreBefore);

      const withBonus = InteractionChoices.acquireTech(game, P1, { ...slot, noTileBonus: undefined }, tech, 1);
      expect(getPlayer(withBonus.updatedGame, P1).score).toBe(scoreBefore + tech.bonus.pv!);
    });

    test('refuse une technologie hors des catégories du gain, ou d\'une pile déjà prise', () => {
      const exploration = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.EXPLORATION] })[0];
      const gain = { type: 'ACQUIRING_TECH' as const, categories: [TechnologyCategory.OBSERVATION] };
      expect(InteractionChoices.acquireTech(game, P1, gain, exploration).error).toBeDefined();

      getPlayer(game, P1).technologies.push(exploration);
      expect(InteractionChoices.acquireTech(game, P1, { type: 'ACQUIRING_TECH' }, exploration).error).toBeDefined();
    });

    test('colonne d\'ordinateur indisponible refusée', () => {
      const tech = computingWithPoints(game);
      const slot = { type: 'SELECTING_COMPUTER_SLOT' as const, tech };
      expect(InteractionChoices.acquireTech(game, P1, slot, tech, 2).error).toBeDefined();
    });
  });

  test('récompense Centaurienne : résout le palier qui l\'a déclenchée (régression : le premier atteint)', () => {
    const species = game.species.find(s => s.name === AlienBoardType.CENTAURIENS)!;
    species.message = species.message ?? [];
    expect(species.message.length).toBeGreaterThan(0);
    species.message.forEach(t => { t.isAvailable = true; });
    const player = getPlayer(game, P1);
    SpeciesSystem.addCentaurienMarker(player);
    SpeciesSystem.addCentaurienMarker(player);
    player.score += 40;
    const [first, second] = player.centaurienMilestones;

    const res = InteractionChoices.claimCentaurienReward(game, P1, { type: 'CHOOSING_CENTAURIEN_REWARD', markerId: second.id }, 0);

    const markers = getPlayer(res.updatedGame, P1).centaurienMilestones;
    expect(markers.find(m => m.id === second.id)!.resolved).toBeDefined();
    expect(markers.find(m => m.id === first.id)!.resolved).toBeUndefined();
  });

  describe('chooseBonusAction', () => {
    const menu = (states: InteractionState[]): Extract<InteractionState, { type: 'CHOOSING_BONUS_ACTION' }> => ({
      type: 'CHOOSING_BONUS_ACTION', bonusesSummary: '', sequenceId: 's',
      choices: states.map((state, i) => ({ id: `c${i}`, label: '', state, done: false })),
    });

    test('l\'action choisie devient active et le menu revient tant qu\'il reste des actions', () => {
      const m = menu([{ type: 'ACQUIRING_CARD', count: 1 }, { type: 'MOVING_PROBE', count: 1 }]);

      const first = InteractionChoices.chooseBonusAction(m, 1)!;
      expect(first.next).toEqual({ type: 'MOVING_PROBE', count: 1 });
      expect(first.menu).toEqual(expect.objectContaining({ choices: [expect.objectContaining({ done: false }), expect.objectContaining({ done: true })] }));

      const last = InteractionChoices.chooseBonusAction(first.menu as typeof m, 0)!;
      expect(last.menu).toBeUndefined();
      expect(InteractionChoices.chooseBonusAction(first.menu as typeof m, 1)).toBeNull();
    });

    test('une mission ne ramène pas le menu', () => {
      const m = menu([{ type: 'CLAIMING_MISSION_REQUIREMENT', missionId: 'm', requirementId: 'r' } as InteractionState, { type: 'MOVING_PROBE', count: 1 }]);
      expect(InteractionChoices.chooseBonusAction(m, 0)!.menu).toBeUndefined();
    });
  });

  test('orbite bonus ×2 : un orbiteur, puis la même interaction pour le suivant', () => {
    getPlayer(game, P1).probes = [probeAt('p1', 'B', 1, 2)];
    game.board.solarSystem.probes = [...getPlayer(game, P1).probes];

    const res = InteractionChoices.placeBonusProbe(game, P1, { type: 'ORBITING_PROBE', count: 2, sequenceId: 's' }, 'mars');

    expect(res.updatedGame.board.planets.find(p => p.id === 'mars')!.orbiters).toHaveLength(1);
    expect(res.nextInteraction).toEqual({ type: 'ORBITING_PROBE', count: 1, sequenceId: 's' });
    expect(InteractionChoices.placeBonusProbe(res.updatedGame, P1, res.nextInteraction as Extract<InteractionState, { type: 'ORBITING_PROBE' }>, 'mars').error).toBeDefined();
  });

  test('markProbeUsed : seulement les scans de la même séquence', () => {
    const scan = (sequenceId: string) => ({ type: 'SELECTING_SCAN_SECTOR' as const, color: SectorType.PROBE, onlyProbes: true, sequenceId });
    const queue: InteractionState[] = [scan('s'), scan('autre'), { type: 'MOVING_PROBE', count: 1, sequenceId: 's' }];

    const marked = InteractionChoices.markProbeUsed(queue, { ...scan('s'), usedProbeIds: ['p0'] }, 'p1');

    expect(marked[0]).toEqual({ ...scan('s'), usedProbeIds: ['p0', 'p1'] });
    expect(marked[1]).toEqual(scan('autre'));
    expect(marked[2]).toBe(queue[2]);
  });

  test('ProbeSystem.freeMovementsUsed : sortir d\'un champ d\'astéroïdes coûte 2 déplacements', () => {
    const solar = game.board.solarSystem;
    const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
    let asteroid: Probe | undefined;
    let plain: Probe | undefined;
    for (const disk of ['A', 'B', 'C', 'D', 'E'] as DiskName[]) {
      for (let sector = 1; sector <= 8; sector++) {
        const probe = probeAt(`p-${disk}${sector}`, disk, sector as SectorNumber, 0);
        const cell = getCell(disk, getAbsoluteSectorForProbe(probe.solarPosition, rotation), rotation, solar.extraCelestialObjects);
        if (cell?.hasAsteroid) asteroid ??= probe; else plain ??= probe;
      }
    }
    getPlayer(game, P1).probes = [asteroid!, plain!];

    expect(ProbeSystem.freeMovementsUsed(game, P1, asteroid!.id, 3)).toBe(2);
    expect(ProbeSystem.freeMovementsUsed(game, P1, asteroid!.id, 1)).toBe(1);
    expect(ProbeSystem.freeMovementsUsed(game, P1, plain!.id, 3)).toBe(1);
    expect(ProbeSystem.freeMovementsUsed(game, P1, plain!.id, 0)).toBe(0);
  });
});
