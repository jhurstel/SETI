import { CardValue } from '../src/ai/CardValue';
import { AIEvaluator, DEFAULT_WEIGHTS } from '../src/ai/AIEvaluator';
import { Game, CardType, CostType, FreeActionType } from '../src/core/types';
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
});
