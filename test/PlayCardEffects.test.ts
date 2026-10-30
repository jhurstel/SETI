import { CardSystem } from '../src/systems/CardSystem';
import { Bonus, CardEffect, Game, LifeTraceType, SectorNumber } from '../src/core/types';
import { createRotationState, getObjectPosition } from '../src/core/SolarSystemPosition';
import { createTestGame, getPlayer, giveCard, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

/** Donne au joueur la carte du catalogue `id` et assez de ressources pour la jouer. */
function giveCatalogCard(game: Game, id: string) {
  const card = giveCard(game, P1, id);
  getPlayer(game, P1).credits = 10;
  getPlayer(game, P1).energy = 10;
  return card;
}

describe('CardSystem.playCard : effets passifs', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('92 Photo du Jour de la NASA : réservée sous les revenus Pioche, pioche une seule carte (régression : deux)', () => {
    const card = giveCatalogCard(game, '92');
    const player = getPlayer(game, P1);
    const handBefore = player.cards.length;
    const revenueBefore = player.revenueCards;
    const mediaBefore = player.mediaCoverage;

    const { updatedGame } = CardSystem.playCard(game, P1, card.id);
    const after = getPlayer(updatedGame, P1);

    expect(after.revenueCards).toBe(revenueBefore + 1);
    // La carte jouée quitte la main, la réservation fait piocher 1 carte
    expect(after.cards).toHaveLength(handBefore - 1 + 1);
    expect(after.mediaCoverage).toBe(mediaBefore + 2);
  });

  test('91 Réacteur à Fusion : réservée sous les revenus Energie, +1 Energie', () => {
    const card = giveCatalogCard(game, '91');
    const player = getPlayer(game, P1);
    const energyBefore = player.energy;
    const revenueBefore = player.revenueEnergy;

    const { updatedGame } = CardSystem.playCard(game, P1, card.id);
    const after = getPlayer(updatedGame, P1);

    expect(after.revenueEnergy).toBe(revenueBefore + 1);
    expect(after.energy).toBe(energyBefore + 1);
  });
});

describe('CardSystem.playCard : effets passifs conditionnels', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    getPlayer(game, P1).credits = 10;
  });

  const play = (effect: CardEffect) => {
    getPlayer(game, P1).cards.push(makeCard('test', { passiveEffects: [effect] }));
    return getPlayer(CardSystem.playCard(game, P1, 'test').updatedGame, P1);
  };

  /** Anomalies posées à `offsets` secteurs de la Terre (sens des secteurs), chacune avec sa récompense */
  const addAnomalies = (anomalies: { offset: number; bonus: Bonus }[]) => {
    const solar = game.board.solarSystem;
    const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
    const earth = getObjectPosition('earth', rotation.level1Angle, rotation.level2Angle, rotation.level3Angle, solar.extraCelestialObjects)!;
    solar.extraCelestialObjects = anomalies.map(({ offset, bonus }, i) => ({
      id: `anomaly-${i}`, type: 'anomaly' as const, name: 'Anomalie', level: 0 as const,
      position: { disk: 'D' as const, sector: (((earth.absoluteSector - 1 + offset) % 8) + 1) as SectorNumber, x: 0, y: 0 },
      anomalyData: { color: LifeTraceType.RED, side: 'head' as const, bonus },
    }));
    return earth.absoluteSector;
  };

  test('VISIT_BONUS : PV immédiats si la planète est déjà visitée ce tour (régression : comptés deux fois), sinon bonus pour le reste du tour', () => {
    getPlayer(game, P1).visitedPlanetsThisTurn = ['mars'];
    const scoreBefore = getPlayer(game, P1).score;

    const visited = play({ type: 'VISIT_BONUS', target: 'mars', value: 3 });
    expect(visited.score).toBe(scoreBefore + 3);
    expect(visited.activeBuffs.some(b => b.type === 'VISIT_BONUS')).toBe(false);

    getPlayer(game, P1).visitedPlanetsThisTurn = [];
    const notVisited = play({ type: 'VISIT_BONUS', target: 'mars', value: 3 });
    expect(notVisited.activeBuffs.some(b => b.type === 'VISIT_BONUS' && b.target === 'mars')).toBe(true);
  });

  test('GAIN_REWARD_NEXT_ANOMALY : récompense de la prochaine anomalie à partir de la Terre', () => {
    addAnomalies([{ offset: 5, bonus: { energy: 4 } }, { offset: 2, bonus: { media: 2 } }, { offset: 0, bonus: { credits: 7 } }]);
    const before = getPlayer(game, P1);

    const after = play({ type: 'GAIN_REWARD_NEXT_ANOMALY', value: 1 });

    expect(after.mediaCoverage).toBe(Math.min(before.mediaCoverage + 2, 10));
    expect(after.energy).toBe(before.energy);
  });

  test('SCORE_PER_ANOMALY : PV par signal du joueur dans les secteurs des anomalies', () => {
    const earthSector = addAnomalies([{ offset: 0, bonus: {} }]);
    const sector = game.board.sectors.find(s => s.id === `sector_${earthSector}`)!;
    sector.signals[0].markedBy = P1;
    sector.signals[1].markedBy = P1;
    const scoreBefore = getPlayer(game, P1).score;

    const after = play({ type: 'SCORE_PER_ANOMALY', value: 1 });

    expect(after.score).toBe(scoreBefore + 2);
  });
});
