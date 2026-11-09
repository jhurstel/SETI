import { performRotation } from '../src/systems/RotationSystem';
import {
  rotateSector,
  getAdjacentCells,
  getVisibleLevel,
  getObjectPosition,
  getCell,
  calculateReachableCells,
  createRotationState,
  getAbsoluteSectorForProbe,
  RotationState,
} from '../src/core/SolarSystemPosition';
import { DiskName, Game, GamePhase, Probe, ProbeState, SectorNumber } from '../src/core/types';
import { PassAction } from '../src/actions/PassAction';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const NO_ROTATION = createRotationState(0, 0, 0);

describe('rotateSector', () => {
  test('sans rotation, le secteur est inchangé', () => {
    for (let s = 1; s <= 8; s++) {
      expect(rotateSector(s as SectorNumber, 0)).toBe(s);
    }
  });

  test('une rotation de -45° avance d\'un secteur, avec bouclage 8 → 1', () => {
    expect(rotateSector(1, -45)).toBe(2);
    expect(rotateSector(7, -45)).toBe(8);
    expect(rotateSector(8, -45)).toBe(1);
  });

  test('une rotation de +45° recule d\'un secteur', () => {
    expect(rotateSector(2, 45)).toBe(1);
    expect(rotateSector(1, 45)).toBe(8);
  });

  test('un tour complet revient au secteur de départ', () => {
    expect(rotateSector(3, -360)).toBe(3);
    expect(rotateSector(3, 720)).toBe(3);
  });

  test('reste valide pour des angles cumulés au-delà d\'un tour (régression)', () => {
    // Avant correction : (index - n + 8) % 8 devenait négatif → undefined
    expect(rotateSector(1, 405)).toBe(8);
    expect(rotateSector(1, -405)).toBe(2);
    for (let angle = -1440; angle <= 1440; angle += 45) {
      expect(rotateSector(5, angle)).toBeGreaterThanOrEqual(1);
      expect(rotateSector(5, angle)).toBeLessThanOrEqual(8);
    }
  });
});

describe('getAdjacentCells', () => {
  const keys = (cells: { disk: string; sector: number }[]) => cells.map(c => `${c.disk}${c.sector}`).sort();

  test('disque A : voisins sur l\'anneau et vers l\'extérieur uniquement', () => {
    expect(keys(getAdjacentCells('A', 1))).toEqual(['A2', 'A8', 'B1']);
  });

  test('disque intermédiaire : 4 voisins', () => {
    expect(keys(getAdjacentCells('C', 5))).toEqual(['B5', 'C4', 'C6', 'D5']);
  });

  test('disque E : pas de voisin au-delà', () => {
    expect(keys(getAdjacentCells('E', 3))).toEqual(['D3', 'E2', 'E4']);
  });
});

describe('getVisibleLevel (plateaux superposés et creux)', () => {
  test('un secteur plein du niveau 3 est visible au niveau 3', () => {
    expect(getVisibleLevel('A', 1, NO_ROTATION)).toBe(3);
  });

  test('un creux du niveau 3 laisse voir le niveau 2', () => {
    expect(getVisibleLevel('A', 7, NO_ROTATION)).toBe(2);
  });

  test('des creux superposés aux niveaux 3 et 2 laissent voir le niveau 1', () => {
    expect(getVisibleLevel('A', 3, NO_ROTATION)).toBe(1);
  });

  test('un creux du niveau 1 sur le disque C laisse voir le plateau fixe', () => {
    expect(getVisibleLevel('C', 2, NO_ROTATION)).toBe(0);
  });

  test('les disques D et E sont toujours au niveau 0', () => {
    expect(getVisibleLevel('D', 4, NO_ROTATION)).toBe(0);
    expect(getVisibleLevel('E', 4, NO_ROTATION)).toBe(0);
  });

  test('tourner le niveau 3 déplace ses creux', () => {
    // Le creux A7 du niveau 3 se retrouve en A8 après -45°
    const rotated = createRotationState(0, 0, -45);
    expect(getVisibleLevel('A', 7, rotated)).toBe(3);
  });
});

describe('getObjectPosition', () => {
  test('la Terre démarre en A2 et suit la rotation du niveau 3', () => {
    expect(getObjectPosition('earth', 0, 0, 0)).toMatchObject({ disk: 'A', absoluteSector: 2, isVisible: true });
    expect(getObjectPosition('earth', 0, 0, -45)).toMatchObject({ disk: 'A', absoluteSector: 3 });
  });

  test('Jupiter (niveau 1) ne bouge qu\'avec le niveau 1', () => {
    expect(getObjectPosition('jupiter', 0, -45, -45)?.absoluteSector).toBe(5);
    expect(getObjectPosition('jupiter', -90, 0, 0)?.absoluteSector).toBe(7);
  });

  test('Neptune (plateau fixe) ne bouge jamais', () => {
    expect(getObjectPosition('neptune', -135, -90, -45)).toMatchObject({ disk: 'D', absoluteSector: 3 });
  });

  test('objet inconnu → null', () => {
    expect(getObjectPosition('pluton', 0, 0, 0)).toBeNull();
  });
});

describe('getCell', () => {
  test('la case de la Terre contient une planète', () => {
    expect(getCell('A', 2, NO_ROTATION)).toMatchObject({ hasPlanet: true, planetId: 'earth' });
  });

  test('un objet recouvert par un plateau supérieur n\'est pas visible', () => {
    // Astéroïdes du niveau 1 en A1, recouverts par le niveau 3 (plein en A1)
    expect(getCell('A', 1, NO_ROTATION)?.hasAsteroid).toBe(false);
  });

  test('un objet sous un creux est visible', () => {
    // Astéroïdes du niveau 2 en A8, visibles à travers le creux A8 du niveau 3
    expect(getCell('A', 8, NO_ROTATION)?.hasAsteroid).toBe(true);
  });
});

describe('calculateReachableCells', () => {
  test('0 déplacement : seule la case de départ', () => {
    const reachable = calculateReachableCells('A', 1, 0, NO_ROTATION);
    expect([...reachable.keys()]).toEqual(['A1']);
  });

  test('1 déplacement : les cases adjacentes', () => {
    const reachable = calculateReachableCells('A', 1, 1, NO_ROTATION);
    expect([...reachable.keys()].sort()).toEqual(['A1', 'A2', 'A8', 'B1']);
    expect(reachable.get('B1')).toMatchObject({ movements: 1, path: ['A1', 'B1'] });
  });

  test('sortir d\'un champ d\'astéroïdes coûte 2 déplacements', () => {
    expect([...calculateReachableCells('A', 8, 1, NO_ROTATION).keys()]).toEqual(['A8']);
    expect(calculateReachableCells('A', 8, 2, NO_ROTATION).get('A7')?.movements).toBe(2);
  });

  test('la pénalité d\'astéroïdes peut être ignorée', () => {
    const reachable = calculateReachableCells('A', 8, 1, NO_ROTATION, true);
    expect(reachable.get('A7')?.movements).toBe(1);
  });

  test('le disque E n\'est jamais atteignable', () => {
    const reachable = calculateReachableCells('D', 1, 3, NO_ROTATION);
    expect([...reachable.keys()].some(k => k.startsWith('E'))).toBe(false);
  });

  test('le bonus média est cumulé le long du chemin', () => {
    const mediaOnPlanets = (cell: { hasPlanet: boolean }) => (cell.hasPlanet ? 1 : 0);
    const reachable = calculateReachableCells('A', 1, 1, NO_ROTATION, false, mediaOnPlanets);
    expect(reachable.get('A2')?.media).toBe(1); // Terre
    expect(reachable.get('A8')?.media).toBe(0);
  });
});

describe('getAbsoluteSectorForProbe', () => {
  test('utilise l\'angle du niveau de la sonde', () => {
    const state = createRotationState(-90, -45, 0);
    expect(getAbsoluteSectorForProbe({ disk: 'C', sector: 1, level: 1 }, state)).toBe(3);
    expect(getAbsoluteSectorForProbe({ disk: 'B', sector: 1, level: 2 }, state)).toBe(2);
    expect(getAbsoluteSectorForProbe({ disk: 'D', sector: 1, level: 0 }, state)).toBe(1);
  });
});

describe('performRotation', () => {
  let game: Game;
  const angles = (g: Game) => {
    const s = g.board.solarSystem;
    return [s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3];
  };

  beforeEach(async () => {
    game = await createTestGame();
    const s = game.board.solarSystem;
    s.rotationAngleLevel1 = 0;
    s.rotationAngleLevel2 = 0;
    s.rotationAngleLevel3 = 0;
    s.nextRingLevel = 3;
  });

  test('cycle Jaune → Rouge → Bleu, chaque anneau entraînant ceux du dessus', () => {
    const r1 = performRotation(game).updatedGame;
    expect(angles(r1)).toEqual([0, 0, -45]);
    expect(r1.board.solarSystem.nextRingLevel).toBe(2);

    const r2 = performRotation(r1).updatedGame;
    expect(angles(r2)).toEqual([0, -45, -90]);
    expect(r2.board.solarSystem.nextRingLevel).toBe(1);

    const r3 = performRotation(r2).updatedGame;
    expect(angles(r3)).toEqual([-45, -90, -135]);
    expect(r3.board.solarSystem.nextRingLevel).toBe(3);
  });

  test('produit un log et ne modifie pas la partie d\'origine', () => {
    const { logs } = performRotation(game);
    expect(logs[0]).toContain('fait tourner le Système Solaire (Jaune)');
    expect(angles(game)).toEqual([0, 0, 0]);
    expect(game.board.solarSystem.nextRingLevel).toBe(3);
  });
});

describe('poussée des sondes recouvertes par un anneau', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    const s = game.board.solarSystem;
    s.rotationAngleLevel1 = 0;
    s.rotationAngleLevel2 = 0;
    s.rotationAngleLevel3 = 0;
    s.nextRingLevel = 3;
  });

  /** Sonde de P1 sur une case (anneau fixe ou bleu/rouge, immobile) que l'anneau jaune recouvre après la rotation `after` */
  function coveredProbe(after: RotationState): Probe {
    const extra = game.board.solarSystem.extraCelestialObjects || [];
    for (const disk of ['A', 'B', 'C', 'D', 'E'] as DiskName[]) {
      for (let s = 1; s <= 8; s++) {
        const sector = s as SectorNumber;
        const level = getVisibleLevel(disk, sector, NO_ROTATION, extra);
        if (level < 3 && getVisibleLevel(disk, sector, after, extra) > level) {
          const probe: Probe = { id: 'pp', ownerId: 'player_0', position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false };
          getPlayer(game, 'player_0').probes = [probe];
          game.board.solarSystem.probes = [probe];
          return probe;
        }
      }
    }
    throw new Error('aucune case recouverte');
  }

  test.each([
    ['sens du jeu (-45°) : poussée au secteur suivant', -45, 1],
    ['sens inverse (+45°) : poussée au secteur précédent', 45, -1],
  ])('%s', (_label, angle, step) => {
    const after = createRotationState(0, 0, angle);
    const probe = coveredProbe(after);
    const from = probe.solarPosition!;

    const res = ProbeSystem.updateProbesAfterRotation(game, NO_ROTATION, after, game.board.solarSystem.extraCelestialObjects || []);
    const moved = getPlayer(res.game, 'player_0').probes[0];
    const expected = ((from.sector - 1 + step + 8) % 8) + 1;
    expect(moved.solarPosition!.disk).toBe(from.disk);
    expect(getAbsoluteSectorForProbe(moved.solarPosition!, after)).toBe(expected);
    expect(res.pushes).toEqual([{ playerId: 'player_0', message: 'voit sa sonde poussée par la rotation' }]);
    expect(res.game.board.solarSystem.probes[0].solarPosition).toEqual(moved.solarPosition);
    expect(probe.solarPosition).toEqual(from);
  });

  test.each([
    ['une planète', 'hasPlanet', undefined],
    ['une comète', 'hasComet', 'Visite de Comète'],
    ["un champ d'astéroïdes (avec Exploration II)", 'hasAsteroid', "Visite d'Astéroïdes"],
  ] as const)('poussée sur %s : 1 Média', (_label, feature, objectName) => {
    const extra = game.board.solarSystem.extraCelestialObjects || [];
    // Une sonde du disque fixe recouverte par une rotation d'un cran, et poussée sur une case de ce genre
    let found: { after: RotationState; disk: DiskName; sector: SectorNumber; name?: string } | undefined;
    for (const [a1, a2, a3] of [[-45, 0, 0], [45, 0, 0], [0, -45, 0], [0, 45, 0], [0, 0, -45], [0, 0, 45]]) {
      const after = createRotationState(a1, a2, a3);
      const step = a1 + a2 + a3 < 0 ? 1 : -1;
      for (const disk of ['A', 'B', 'C', 'D'] as DiskName[]) {
        for (let s = 1; s <= 8 && !found; s++) {
          const sector = s as SectorNumber;
          const target = getCell(disk, (((s - 1 + step + 8) % 8) + 1) as SectorNumber, after, extra);
          if (getVisibleLevel(disk, sector, NO_ROTATION, extra) === 0 && getVisibleLevel(disk, sector, after, extra) > 0
            && target?.[feature] && (feature === 'hasPlanet' ? target.planetId !== 'earth' : !target.hasPlanet)) found = { after, disk, sector, name: target.planetName };
        }
      }
      if (found) break;
    }
    const { after, disk, sector, name } = found!;
    const probe: Probe = { id: 'pp', ownerId: 'player_0', position: { x: 0, y: 0 }, solarPosition: { disk, sector, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false };
    const player = getPlayer(game, 'player_0');
    player.probes = [probe];
    player.technologies.push(game.board.technologyBoard.available.find(t => t.id.startsWith('exploration-2'))!);
    player.mediaCoverage = 0;

    const res = ProbeSystem.updateProbesAfterRotation(game, NO_ROTATION, after, extra);

    expect(res.pushes).toEqual([{ playerId: 'player_0', message: `voit sa sonde poussée par la rotation (${objectName ?? `Visite de ${name}`}) et gagne 1 Média` }]);
    expect(getPlayer(res.game, 'player_0').mediaCoverage).toBe(1);
  });

  test("passe : la rotation a son message, chaque sonde poussée a sa propre entrée au nom de son propriétaire, sans case", () => {
    Object.assign(game.board.solarSystem, { rotationAngleLevel1: 0, rotationAngleLevel2: 0, rotationAngleLevel3: 0, nextRingLevel: 3 });
    coveredProbe(createRotationState(0, 0, -45));
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 1;
    getPlayer(game, 'player_0').hasPassed = false;
    const action = new PassAction('player_1', getPlayer(game, 'player_1').cards.slice(0, 4).map(c => c.id));

    action.execute(game);

    const messages = action.historyEntries.map(e => [e.playerId, e.message]);
    expect(messages).toContainEqual(['player_1', 'fait tourner le Système Solaire (Jaune)']);
    const push = action.historyEntries.find(e => e.message.startsWith('voit sa sonde poussée'))!;
    expect(push.playerId).toBe('player_0');
    expect(push.sequenceId).toBe(action.historyEntries[0].sequenceId);
    expect(push.message).not.toMatch(/[A-E][1-8]/);
  });

  test("sans changement d'angle : aucune poussée", () => {
    coveredProbe(createRotationState(0, 0, -45));
    const res = ProbeSystem.updateProbesAfterRotation(game, NO_ROTATION, NO_ROTATION, []);
    expect(res.pushes).toEqual([]);
  });
});
