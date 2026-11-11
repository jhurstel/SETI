import { CardValue } from '../src/ai/CardValue';
import { AIEvaluator, DEFAULT_WEIGHTS } from '../src/ai/AIEvaluator';
import { Game, CardType, CostType, FreeActionType, LifeTraceType, SectorType, TechnologyCategory } from '../src/core/types';
import { CardSystem } from '../src/systems/CardSystem';
import { createTestGame, getPlayer, giveCard, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const w = { ...DEFAULT_WEIGHTS, cardQuality: 0.5 };

describe('CardValue', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  test('cardQuality = 0 : toutes les cartes valent card, la main au plus maxUsefulCards cartes', () => {
    const flat = { ...DEFAULT_WEIGHTS, cardQuality: 0, maxUsefulCards: 2.5 };
    const cards = [makeCard('a'), makeCard('b', { cost: 9 }), makeCard('c'), makeCard('d')];
    cards.forEach(card => expect(CardValue.of(card, flat)).toBeCloseTo(flat.card));
    expect(CardValue.handValue(cards, flat)).toBeCloseTo(2.5 * flat.card);
  });

  test('vraie carte : gains convertis avec les poids, moins le coût (Sonde Venera : sonde + Média + mission, 3 crédits)', () => {
    const venera = giveCard(game, P1, '5');
    const probe = w.probeInSystem + (w.probeOnPlanet - w.probeInSystem) / 2;
    expect(CardValue.netPlayValue(venera, w)).toBeCloseTo(probe + w.media + w.openMission - 3 * w.credit);
    expect(CardValue.of(venera, w)).toBeCloseTo(w.card + w.cardQuality * CardValue.netPlayValue(venera, w));
  });

  test('chaque cercle de mission compte une fois (Mission Pioneer 11 : 2 visites, gratuite)', () => {
    const pioneer = giveCard(game, P1, '1');
    expect(CardValue.playGain(pioneer, w)).toBeCloseTo(2 * w.openMission);
  });

  test("une carte trop chère vaut au moins son action gratuite, coût en énergie compris", () => {
    const expensive = makeCard('x', { cost: 4, costType: CostType.ENERGY, freeAction: FreeActionType.TWO_MEDIA });
    expect(CardValue.netPlayValue(expensive, w)).toBeCloseTo(-4 * w.energy);
    expect(CardValue.of(expensive, w)).toBeCloseTo(w.card + w.cardQuality * 2 * w.media);
  });

  test('chaque type de gain immédiat et chaque action gratuite a sa valeur', () => {
    const gain = (target: string, value: unknown) => CardValue.playGain(makeCard(target, { immediateEffects: [{ type: 'GAIN', target, value } as never] }), w);
    const probe = w.probeInSystem + (w.probeOnPlanet - w.probeInSystem) / 2;
    expect(gain('MEDIA', 2)).toBeCloseTo(2 * w.media);
    expect(gain('CREDIT', 2)).toBeCloseTo(2 * w.credit);
    expect(gain('ENERGY', 2)).toBeCloseTo(2 * w.energy);
    expect(gain('DATA', 2)).toBeCloseTo(2 * w.data);
    expect(gain('TOKEN', 1)).toBeCloseTo(w.media);
    expect(gain('PROBE', 1)).toBeCloseTo(probe);
    expect(gain('CARD', 2)).toBeCloseTo(2 * w.card);
    expect(gain('ANYCARD', 1)).toBeCloseTo(w.card);
    expect(gain('MOVEMENT', 3)).toBeCloseTo(3 * w.probeStep);
    expect(gain('SIGNAL', { amount: 2, scope: 'Jaune' })).toBeCloseTo(2 * (w.signal + w.data));
    expect(gain('SCAN', 1)).toBeCloseTo(2 * (w.signal + w.data));
    expect(gain('LAND', 1)).toBeCloseTo(w.lander - w.probeOnPlanet);
    expect(gain('TECH', { amount: 1, scope: 'any' })).toBeCloseTo(w.technology);
    expect(gain('LIFETRACE', { amount: 2, scope: 'any' })).toBeCloseTo(2 * w.lifeTrace);
    expect(gain('ROTATION', 1)).toBe(0);

    const free = (freeAction: FreeActionType) => CardValue.freeActionValue(makeCard('f', { freeAction }), w);
    expect(free(FreeActionType.MOVEMENT)).toBeCloseTo(w.probeStep);
    expect(free(FreeActionType.DATA)).toBeCloseTo(w.data);
    expect(free(FreeActionType.MEDIA)).toBeCloseTo(w.media);
    expect(free(FreeActionType.PV_MOVEMENT)).toBeCloseTo(1 + w.probeStep);
    expect(free(FreeActionType.PV_DATA)).toBeCloseTo(1 + w.data);
    expect(free(FreeActionType.TWO_MEDIA)).toBeCloseTo(2 * w.media);
    expect(free(FreeActionType.UNDEFINED)).toBe(0);
  });

  test('une carte Fin de partie compte comme une mission', () => {
    expect(CardValue.playGain(makeCard('end', { type: CardType.END_GAME }), w)).toBeCloseTo(w.openMission);
  });

  test('la main garde ses meilleures cartes en premier', () => {
    const capped = { ...w, maxUsefulCards: 1 };
    const weak = makeCard('weak', { cost: 5, freeAction: FreeActionType.UNDEFINED });
    const strong = makeCard('strong', { cost: 0, freeAction: FreeActionType.TWO_MEDIA });
    expect(CardValue.handValue([weak, strong], capped)).toBeCloseTo(CardValue.of(strong, capped));
  });

  test("l'évaluation compte la valeur propre des cartes en main, sans modifier la partie", () => {
    AIEvaluator.weightOverrides.set(P1, w);
    try {
      const player = getPlayer(game, P1);
      player.cards = [makeCard('weak', { cost: 5, freeAction: FreeActionType.UNDEFINED })];
      const withWeak = AIEvaluator.evaluate(game, P1);
      player.cards = [makeCard('strong', { cost: 0, freeAction: FreeActionType.TWO_MEDIA })];
      const snapshot = JSON.stringify(game);
      expect(AIEvaluator.evaluate(game, P1)).toBeGreaterThan(withWeak);
      expect(JSON.stringify(game)).toBe(snapshot);
    } finally {
      AIEvaluator.weightOverrides.clear();
    }
  });

  describe('valeur des missions (missionChance)', () => {
    const chance = { ...w, missionChance: 0.5 };

    test("récompense d'un cercle convertie avec les poids, cible comprise", () => {
      expect(CardValue.missionRewardValue('GAIN_IF_8_MEDIA:pv:3:anycard:1', w)).toBeCloseTo(3 + w.card);
      expect(CardValue.missionRewardValue('GAIN_ON_VISIT:jupiter:data:1', w)).toBeCloseTo(w.data);
      expect(CardValue.missionRewardValue('', w)).toBe(0);
      expect(CardValue.bonusValue({
        credits: 1, energy: 1, media: 1, token: 1, data: 1, card: 1, anycard: 1, speciesCard: 1, probe: 1, movements: 1,
        signals: [{ amount: 2, scope: SectorType.ANY }], scan: 1, lifetraces: [{ amount: 1, scope: LifeTraceType.RED }],
        technologies: [{ amount: 1, scope: TechnologyCategory.ANY }], landing: 1, revenue: 1,
      }, w)).toBeCloseTo(w.credit + w.energy + 2 * w.media + w.data + 2 * w.card + w.alienCard
        + w.probeInSystem + (w.probeOnPlanet - w.probeInSystem) / 2 + w.probeStep + 4 * (w.signal + w.data)
        + w.lifeTrace + w.technology + (w.lander - w.probeOnPlanet) + 2 * w.incomePerRound);
    });

    test('une carte de mission en main compte ses récompenses × missionChance (Pioneer 11 : 1 donnée, 4 PV)', () => {
      const pioneer = giveCard(game, P1, '1');
      expect(CardValue.playGain(pioneer, chance)).toBeCloseTo(2 * w.openMission + 0.5 * (w.data + 4));
    });

    test("l'évaluation : récompense pleine si le cercle est réalisable, sinon × missionChance × manches restantes", () => {
      const lovell = giveCard(game, P1, '51');
      game.currentPlayerIndex = 0;
      getPlayer(game, P1).credits = 20;
      game = CardSystem.playCard(game, P1, '51').updatedGame;
      const player = getPlayer(game, P1);
      player.mediaCoverage = 0;
      game.currentRound = 2;
      const reward = 3 + w.card;
      // Cartes en main toutes égales (cardQuality 0) : seule la mission jouée compte
      const chance = { ...w, cardQuality: 0, missionChance: 0.5 };
      const evaluate = (weights: typeof w) => {
        AIEvaluator.weightOverrides.set(P1, weights);
        try { return AIEvaluator.evaluate(game, P1); } finally { AIEvaluator.weightOverrides.clear(); }
      };
      // Pas encore 8 Médias : chance × part des manches restantes (manches 2 à 5 sur 5)
      const roundsLeft = (game.maxRounds - 1) / game.maxRounds;
      const notYet = evaluate(chance) - evaluate({ ...chance, missionChance: 0 });
      expect(notYet).toBeCloseTo(0.5 * roundsLeft * reward * w.boardRound2);
      // 8 Médias : le carré peut être recouvert, récompense pleine
      player.mediaCoverage = 8;
      const ready = evaluate(chance) - evaluate({ ...chance, missionChance: 0 });
      expect(ready).toBeCloseTo(reward * w.boardRound2);
      expect(lovell.id).toBe('51');
    });

    test("l'évaluation ignore les missions terminées, les cercles recouverts et ceux sans récompense", () => {
      const player = getPlayer(game, P1);
      const requirement = (id: string, value: string) => ({ id, type: 'GAIN_IF_8_MEDIA', value });
      player.missions = [
        { id: 'done', cardId: 'c1', name: 'Terminée', description: '', ownerId: P1, requirements: [requirement('a', 'GAIN_IF_8_MEDIA:pv:3')],
          completedRequirementIds: [], fulfillableRequirementIds: [], completed: true },
        { id: 'open', cardId: 'c2', name: 'Ouverte', description: '', ownerId: P1,
          requirements: [requirement('b', 'GAIN_IF_8_MEDIA:pv:3'), requirement('c', '')],
          completedRequirementIds: ['b'], fulfillableRequirementIds: [], completed: false },
      ];
      const evaluate = (weights: typeof w) => {
        AIEvaluator.weightOverrides.set(P1, weights);
        try { return AIEvaluator.evaluate(game, P1); } finally { AIEvaluator.weightOverrides.clear(); }
      };
      // Cartes en main toutes égales (cardQuality 0) : seules les missions jouées comptent
      expect(evaluate({ ...w, cardQuality: 0, missionChance: 0.5 })).toBeCloseTo(evaluate({ ...w, cardQuality: 0, missionChance: 0 }));
    });
  });
});
