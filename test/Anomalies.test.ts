import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { performRotation, createRotationState, getObjectPosition, calculateAbsolutePosition } from '../src/core/SolarSystemPosition';
import { AlienBoardType, CelestialObject, Game, LifeTraceLocation, LifeTraceType, SectorNumber } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Plateau Alien des Anomalies (le premier plateau de la partie, révélé comme Anomalies) */
function anomalyBoard(game: Game) {
  const board = game.board.alienBoards[0];
  board.speciesId = AlienBoardType.ANOMALIES;
  return board;
}

const anomalyAt = (sector: number, bonus: { credits?: number; energy?: number; anycard?: number }): CelestialObject => ({
  id: `anomaly-${sector}`, type: 'anomaly', name: 'Anomalie', level: 0,
  position: { disk: 'D', sector: sector as SectorNumber, x: 0, y: 0 },
  anomalyData: { color: LifeTraceType.RED, side: 'head', bonus },
});

describe('Anomalies', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('découverte : trois anomalies apparaissent, sur le secteur de la Terre et à 3 secteurs de part et d\'autre', () => {
    anomalyBoard(game);
    let g = game;
    for (const color of [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE]) {
      g = SpeciesSystem.placeLifeTrace(g, 0, color, P1, 's', LifeTraceLocation.TRIANGLE).updatedGame;
    }

    expect(g.board.alienBoards[0].isDiscovered).toBe(true);
    const anomalies = (g.board.solarSystem.extraCelestialObjects || []).filter(o => o.type === 'anomaly');
    expect(anomalies).toHaveLength(3);
    expect(anomalies.every(a => a.position.disk === 'D' && a.level === 0 && a.anomalyData?.bonus)).toBe(true);

    const solar = g.board.solarSystem;
    const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
    const earth = getObjectPosition('earth', rotation.level1Angle, rotation.level2Angle, rotation.level3Angle, solar.extraCelestialObjects)!.absoluteSector;
    const expected = [earth, ((earth - 1 - 3 + 8) % 8) + 1, ((earth - 1 + 3) % 8) + 1].sort();
    expect(anomalies.map(a => a.position.sector).sort()).toEqual(expected);
    expect(game.board.solarSystem.extraCelestialObjects?.some(o => o.type === 'anomaly') ?? false).toBe(false);
  });

  describe('rotation : l\'anomalie du secteur de la Terre récompense le plus avancé sur la piste de sa couleur', () => {
    const prepare = (discovered: boolean, leader: string) => {
      const board = anomalyBoard(game);
      board.isDiscovered = discovered;
      board.lifeTraces = [
        { id: 't1', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.SPECIES, slotIndex: 1 },
        { id: 't2', type: LifeTraceType.RED, playerId: leader, location: LifeTraceLocation.SPECIES, slotIndex: 2 },
      ];
      // Une anomalie dans chaque secteur : quelle que soit la rotation, la Terre en a une
      game.board.solarSystem.extraCelestialObjects = Array.from({ length: 8 }, (_, i) => anomalyAt(i + 1, { credits: 3 }));
    };

    test('le joueur le plus avancé gagne la récompense', () => {
      prepare(true, P1);
      const credits = getPlayer(game, P1).credits;
      const before = JSON.stringify(game);

      const res = performRotation(game);

      expect(getPlayer(res.updatedGame, P1).credits).toBe(credits + 3);
      expect(res.logs.some(l => l.startsWith('Anomalie') && l.includes('activée'))).toBe(true);
      expect(JSON.stringify(game)).toBe(before);
    });

    test('régression : le message ne répète pas « gagne »', () => {
      prepare(true, P1);
      const name = getPlayer(game, P1).name;
      const log = performRotation(game).logs.find(l => l.startsWith('Anomalie'))!;
      expect(log).toBe(`Anomalie Rouge activée : ${name} gagne 3 Crédits`);
    });

    test('espèce non découverte : rien, pas de message', () => {
      prepare(false, P1);
      const credits = getPlayer(game, P1).credits;
      const res = performRotation(game);
      expect(getPlayer(res.updatedGame, P1).credits).toBe(credits);
      expect(res.logs.some(l => l.startsWith('Anomalie'))).toBe(false);
    });

    test('personne sur la piste de la couleur (ou trace neutre) : personne ne gagne, et l\'historique le dit', () => {
      prepare(true, 'neutral');
      const res = performRotation(game);
      expect(res.updatedGame.players.map(p => p.credits)).toEqual(game.players.map(p => p.credits));
      expect(res.logs).toContain('Anomalie Rouge activée : aucun marqueur sur la piste Rouge des Anomalies, personne ne gagne sa récompense');

      anomalyBoard(game).lifeTraces = [];
      expect(performRotation(game).logs).toContain('Anomalie Rouge activée : aucun marqueur sur la piste Rouge des Anomalies, personne ne gagne sa récompense');
    });

    test('récompense « 1 carte au choix » : le choix est transmis au gagnant', () => {
      prepare(true, P2);
      game.board.solarSystem.extraCelestialObjects = Array.from({ length: 8 }, (_, i) => anomalyAt(i + 1, { anycard: 1 }));
      const res = performRotation(game);
      expect(res.interactions).toEqual([expect.objectContaining({ type: 'ACQUIRING_CARD', playerId: P2 })]);
    });
  });

  test('les anomalies restent fixes pendant la rotation (niveau 0)', () => {
    anomalyBoard(game).isDiscovered = true;
    game.board.solarSystem.extraCelestialObjects = [anomalyAt(5, {})];
    const res = performRotation(game);
    const solar = res.updatedGame.board.solarSystem;
    const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
    expect(calculateAbsolutePosition(solar.extraCelestialObjects![0], rotation, solar.extraCelestialObjects).absoluteSector).toBe(5);
  });
});
