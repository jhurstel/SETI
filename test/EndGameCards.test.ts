import { ScoreManager } from '../src/core/ScoreManager';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { createRotationState, getAbsoluteSectorForProbe, getCell } from '../src/core/SolarSystemPosition';
import { CardType, DiskName, GAME_CONSTANTS, Game, LifeTraceType, Mission, ObjectiveCategory, ProbeState, SectorNumber, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, giveCard, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

/** Pose la carte Fin de partie `id` du catalogue parmi les cartes jouées du joueur. */
function playEndGameCard(game: Game, id: string): void {
  const card = giveCard(game, P1, id);
  const player = getPlayer(game, P1);
  player.cards = player.cards.filter(c => c.id !== id);
  player.playedCards.push(card);
}

const missionEndGame = (game: Game) => ScoreManager.calculateFinalScore(game, P1).missionEndGame;

describe('Décompte final : cartes Fin de partie', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  test('86 Télescope Géant Magellan : 1 PV par secteur où le joueur a un signal', () => {
    playEndGameCard(game, '86');
    expect(missionEndGame(game)).toBe(0);

    game.board.sectors[0].signals[0].markedBy = P1;
    game.board.sectors[0].signals[1].markedBy = P1;
    game.board.sectors[3].signals[0].markedBy = P1;

    expect(missionEndGame(game)).toBe(2);
  });

  test('126 Télescope Spatial Euclide : 2 PV par technologie Informatique', () => {
    playEndGameCard(game, '126');
    const techs = game.board.technologyBoard.available;
    const computing = techs.filter(t => t.type === TechnologyCategory.COMPUTING).slice(0, 2);
    const other = techs.find(t => t.type !== TechnologyCategory.COMPUTING)!;
    getPlayer(game, P1).technologies.push(...computing, other);

    expect(missionEndGame(game)).toBe(4);
  });

  test('127 NEAR Shoemaker : 13 PV avec une sonde sur un champ d\'astéroïdes', () => {
    playEndGameCard(game, '127');
    const launched = ProbeSystem.launchProbe(game, P1, true);
    const probe = getPlayer(launched.updatedGame, P1).probes[0];
    expect(missionEndGame(launched.updatedGame)).toBe(0);

    // Case d'astéroïdes, quelle que soit la rotation actuelle des disques
    const solar = launched.updatedGame.board.solarSystem;
    const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
    let asteroid: { disk: DiskName; sector: SectorNumber; level: number } | undefined;
    for (const disk of ['A', 'B', 'C', 'D', 'E'] as DiskName[]) {
      for (let sector = 1; sector <= 8 && !asteroid; sector++) {
        for (let level = 0; level <= 3 && !asteroid; level++) {
          const position = { disk, sector: sector as SectorNumber, level };
          const abs = getAbsoluteSectorForProbe(position, rotation);
          if (getCell(disk, abs, rotation, solar.extraCelestialObjects)?.hasAsteroid) asteroid = position;
        }
      }
    }
    expect(asteroid).toBeDefined();
    probe.solarPosition = asteroid!;
    probe.state = ProbeState.IN_SOLAR_SYSTEM;

    expect(missionEndGame(launched.updatedGame)).toBe(13);
  });
});

describe('Décompte final : tuile objectif Technologie', () => {
  test('face A : une série par lot de 3 types de technologies différents', async () => {
    const game = await createTestGame();
    const tile = { ...game.board.objectiveTiles.find(t => t.category === ObjectiveCategory.TECHNOLOGY)!, side: 'A' as const };
    const byType = (type: TechnologyCategory) => game.board.technologyBoard.available.filter(t => t.type === type);
    const player = getPlayer(game, P1);

    player.technologies.push(...byType(TechnologyCategory.COMPUTING).slice(0, 2), ...byType(TechnologyCategory.EXPLORATION).slice(0, 2));
    expect(ScoreManager.objectiveTileSeries(player, game.board, tile)).toBe(0);

    player.technologies.push(byType(TechnologyCategory.OBSERVATION)[0]);
    expect(ScoreManager.objectiveTileSeries(player, game.board, tile)).toBe(1);

    player.technologies.push(byType(TechnologyCategory.OBSERVATION)[1]);
    expect(ScoreManager.objectiveTileSeries(player, game.board, tile)).toBe(2);
  });

  test('face B : une série par paire de technologies', async () => {
    const game = await createTestGame();
    const tile = { ...game.board.objectiveTiles.find(t => t.category === ObjectiveCategory.TECHNOLOGY)!, side: 'B' as const };
    const player = getPlayer(game, P1);
    player.technologies.push(...game.board.technologyBoard.available.slice(0, 5));

    expect(ScoreManager.objectiveTileSeries(player, game.board, tile)).toBe(2);
  });
});

describe('Décompte final : tuiles objectif Missions, Revenus et Autres (faces A et B)', () => {
  /** Tuile de la catégorie, sur la face demandée (la mise en place tire une face au hasard) */
  const tileOf = (game: Game, category: ObjectiveCategory, side: 'A' | 'B') =>
    ({ ...game.board.objectiveTiles.find(t => t.category === category)!, side });
  const mission = (id: string, completed: boolean): Mission =>
    ({ id, cardId: id, name: id, description: '', ownerId: P1, requirements: [], completedRequirementIds: [], fulfillableRequirementIds: [], completed });

  test('Missions A : une série par mission accomplie ; B : une par paire mission accomplie / carte Fin de partie', async () => {
    const game = await createTestGame();
    const player = getPlayer(game, P1);
    player.missions = [mission('m1', true), mission('m2', true), mission('m3', false)];
    expect(ScoreManager.objectiveTileSeries(player, game.board, tileOf(game, ObjectiveCategory.MISSION, 'A'))).toBe(2);

    const sideB = tileOf(game, ObjectiveCategory.MISSION, 'B');
    expect(ScoreManager.objectiveTileSeries(player, game.board, sideB)).toBe(1);
    player.playedCards = [...player.playedCards, makeCard('fin-1', { type: CardType.END_GAME }), makeCard('fin-2', { type: CardType.END_GAME })];
    expect(ScoreManager.objectiveTileSeries(player, game.board, sideB)).toBe(2);
  });

  test('Revenus A : une série par lot crédit + énergie + carte réservés ; B : le type le plus réservé', async () => {
    const game = await createTestGame();
    const player = getPlayer(game, P1);
    player.revenueCredits = GAME_CONSTANTS.INITIAL_REVENUE_CREDITS + 2;
    player.revenueEnergy = GAME_CONSTANTS.INITIAL_REVENUE_ENERGY + 1;
    player.revenueCards = GAME_CONSTANTS.INITIAL_REVENUE_CARDS + 3;
    expect(ScoreManager.objectiveTileSeries(player, game.board, tileOf(game, ObjectiveCategory.REVENUE, 'A'))).toBe(1);
    expect(ScoreManager.objectiveTileSeries(player, game.board, tileOf(game, ObjectiveCategory.REVENUE, 'B'))).toBe(3);
  });

  test('Autres A : une série par lot de 3 couleurs de traces de vie ; B : une par paire secteur couvert / orbiteur ou atterrisseur', async () => {
    const game = await createTestGame();
    const player = getPlayer(game, P1);
    const trace = (type: LifeTraceType, i: number) => ({ id: `t${i}`, type, playerId: P1 });
    player.lifeTraces = [trace(LifeTraceType.RED, 1), trace(LifeTraceType.YELLOW, 2), trace(LifeTraceType.BLUE, 3), trace(LifeTraceType.RED, 4)];
    expect(ScoreManager.objectiveTileSeries(player, game.board, tileOf(game, ObjectiveCategory.OTHER, 'A'))).toBe(1);

    const sideB = tileOf(game, ObjectiveCategory.OTHER, 'B');
    game.board.sectors[0].coveredBy = [P1, 'player_1'];
    game.board.sectors[1].coveredBy = [P1];
    game.board.sectors[2].coveredBy = [P1];
    // Trois secteurs couverts, mais une seule sonde en orbite ou posée (une sonde en vol ne compte pas)
    player.probes = [
      { id: 'o1', ownerId: P1, state: ProbeState.IN_ORBIT },
      { id: 'v1', ownerId: P1, state: ProbeState.IN_SOLAR_SYSTEM },
    ] as typeof player.probes;
    expect(ScoreManager.objectiveTileSeries(player, game.board, sideB)).toBe(1);
    player.probes = [...player.probes, { id: 'l1', ownerId: P1, state: ProbeState.LANDED }] as typeof player.probes;
    expect(ScoreManager.objectiveTileSeries(player, game.board, sideB)).toBe(2);
  });
});
