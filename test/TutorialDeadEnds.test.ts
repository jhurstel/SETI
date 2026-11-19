import { Game, LifeTraceType } from '../src/core/types';
import { chapterById, TUTORIAL_CHAPTERS } from '../src/tutorial/chapters';
import { candidateCommands, describeCommand, exploreDeadEnds } from '../src/tutorial/explore';
import { applyTutorialCommand, prepareChapter } from '../src/tutorial/prepare';
import { answerAll, readExplanationsAndAdvance } from '../src/tutorial/solve';
import { TutorialRunner } from '../src/tutorial/TutorialRunner';
import { TUTORIAL_CARD_REASON, tutorialCommandBlockReason } from '../src/tutorial/guidance';
import { SPECIES_CHAPTERS } from '../src/tutorial/speciesChapters';
import { blueTraceElsewhere, cardGone, humanOf, interactionAnswers, landCost, movesBetween, movesTo, neighbourCells } from '../src/tutorial/scenario';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import type { Command } from '../src/session/commands';
import type { TutorialChapter } from '../src/tutorial/types';
import { mockFetchFromPublic } from './helpers/gameFixture';

/** Position d'un chapitre après les `count` premières commandes de sa solution (explications lues, ellipses jouées) */
async function playTo(chapterId: string, count: number) {
  const chapter = chapterById(chapterId)!;
  const prepared = await prepareChapter(chapter, 'Alice');
  const { humanId } = prepared;
  const start = prepared.game;
  let game = start;
  let state = TutorialRunner.start(chapter);
  for (const command of chapter.solution.slice(0, count)) {
    ({ state, game } = readExplanationsAndAdvance(chapter, state, game, humanId, start));
    game = answerAll(applyTutorialCommand(game, humanId, command).game, humanId, chapter);
  }
  ({ state, game } = readExplanationsAndAdvance(chapter, state, game, humanId, start));
  const deadEndOf = (g: Game) => TutorialRunner.deadEnd(chapter, state, { game: g, humanId, start })?.id ?? null;
  const play = (g: Game, command: Command) => applyTutorialCommand(g, humanId, command).game;
  return { chapter, game, humanId, start, state, deadEndOf, play };
}

/** Échange de 2 unités d'une ressource contre 1 de l'autre, répété tant que la condition tient */
function tradeWhile(game: Game, humanId: string, spend: 'credit' | 'energy', keep: (g: Game) => boolean): Game {
  let current = game;
  for (let i = 0; i < 20 && keep(current); i++) {
    current = applyTutorialCommand(current, humanId, { type: 'TRADE', spend, gain: spend === 'credit' ? 'energy' : 'credit' }).game;
  }
  return current;
}

/** Achat d'une carte avec 3 médias (première carte de la rangée) */
const buyCard = (game: Game, humanId: string) => answerAll(applyTutorialCommand(game, humanId, { type: 'BUY_CARD' }).game, humanId);

describe('impasses des chapitres (mode annulation)', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());

  test('écran : crédits du lancement échangés', async () => {
    const { game, humanId, deadEndOf } = await playTo('ecran', 0);
    expect(deadEndOf(game)).toBeNull();
    const poor = tradeWhile(game, humanId, 'credit', g => humanOf(g, humanId).credits >= 2);
    expect(deadEndOf(poor)).toBe('annuler-credits');
    // La partie reçue n'est pas modifiée : l'annulation y ramène
    expect(deadEndOf(game)).toBeNull();
  });

  test('sondes : énergie échangée avant le lancement, crédits échangés après', async () => {
    const { game, humanId, deadEndOf, play } = await playTo('sondes', 0);
    const drained = tradeWhile(game, humanId, 'energy', g => humanOf(g, humanId).energy >= movesBetween(g, 'earth', 'mars') + 1);
    expect(deadEndOf(drained)).toBe('annuler-energie');
    const launched = play(game, { type: 'LAUNCH_PROBE' });
    expect(deadEndOf(launched)).toBeNull();
    expect(deadEndOf(tradeWhile(launched, humanId, 'credit', g => humanOf(g, humanId).credits >= 1))).toBe('annuler-credits');
  });

  test('atterrir : plus assez d\'énergie pour revenir sur Mars et atterrir', async () => {
    const { game, humanId, deadEndOf } = await playTo('atterrir', 0);
    expect(landCost(game, 'mars')).toBe(2);
    expect(movesTo(game, humanId, 'mars')).toBe(0);
    expect(deadEndOf(game)).toBeNull();
    expect(deadEndOf(tradeWhile(game, humanId, 'energy', g => humanOf(g, humanId).energy >= 2))).toBe('annuler-energie');
  });

  test('scanner : énergie du scan échangée (les crédits ne descendent pas sous 1)', async () => {
    const { game, humanId, deadEndOf } = await playTo('scanner', 0);
    expect(deadEndOf(tradeWhile(game, humanId, 'energy', g => humanOf(g, humanId).energy >= 2))).toBe('annuler-energie');
    expect(humanOf(tradeWhile(game, humanId, 'credit', g => humanOf(g, humanId).credits >= 2), humanId).credits).toBe(1);
  });

  test('cartes : carte du chapitre défaussée, médias de Lovell dépensés, crédits échangés, autre carte refusée', async () => {
    const { chapter, game, humanId, deadEndOf, play } = await playTo('cartes', 0);
    expect(deadEndOf(game)).toBeNull();
    // Lovell échangée avec une autre carte de la main (sa défausse demande une sonde)
    const other = humanOf(game, humanId).cards.find(c => !['79', '51', '14'].includes(c.id))!.id;
    const discarded = answerAll(play(game, { type: 'TRADE', spend: 'card', gain: 'credit', cardIds: ['51', other] }), humanId);
    expect(cardGone(discarded, humanId, '51')).toBe(true);
    expect(deadEndOf(discarded)).toBe('annuler-carte');
    expect(deadEndOf(buyCard(game, humanId))).toBe('annuler-medias');
    expect(deadEndOf(tradeWhile(game, humanId, 'credit', g => humanOf(g, humanId).credits >= 9))).toBe('annuler-credits');
    // Jouer une autre carte que celle de l'étape : refusé par le guidage
    const step = TutorialRunner.currentStep(chapter, TutorialRunner.next(chapter, TutorialRunner.start(chapter), { game, humanId, start: game }), { game, humanId, start: game })!;
    expect(step.id).toBe('jouer');
    expect(tutorialCommandBlockReason(step, { type: 'PLAY_CARD', cardId: '51' })).toBe(TUTORIAL_CARD_REASON);
    expect(tutorialCommandBlockReason(step, { type: 'PLAY_CARD', cardId: '79' })).toBeNull();
    // Cartes jouées dans l'ordre : aucune n'est « perdue »
    expect(cardGone(play(game, { type: 'PLAY_CARD', cardId: '79' }), humanId, '79')).toBe(false);
  });

  test.each(['ordinateur', 'especes'])("%s : énergie de l'analyse échangée", async (id: string) => {
    const { game, humanId, deadEndOf, play } = await playTo(id, 0);
    expect(deadEndOf(game)).toBeNull();
    // Un crédit changé en énergie, puis toute l'énergie changée en crédits
    const drained = tradeWhile(play(game, { type: 'TRADE', spend: 'credit', gain: 'energy' }), humanId, 'energy', g => humanOf(g, humanId).energy >= 2);
    expect(humanOf(drained, humanId).energy).toBe(0);
    expect(deadEndOf(drained)).toBe('annuler-energie');
  });

  test("atterrir : cartes achetées puis échangées, plus de médias pour l'étape « Achetez une carte »", async () => {
    const { game, humanId, deadEndOf, play } = await playTo('atterrir', 0);
    const startHand = humanOf(game, humanId).cards.map(c => c.id);
    let current = buyCard(game, humanId);
    expect(deadEndOf(current)).toBeNull();
    current = buyCard(current, humanId);
    const bought = humanOf(current, humanId).cards.filter(c => !startHand.includes(c.id)).map(c => c.id);
    expect(bought).toHaveLength(2);
    current = play(current, { type: 'TRADE', spend: 'card', gain: 'credit', cardIds: bought });
    expect(humanOf(current, humanId).mediaCoverage).toBeLessThan(3);
    expect(deadEndOf(current)).toBe('annuler-medias');
  });

  test('technologies : médias de la recherche dépensés', async () => {
    const { game, humanId, deadEndOf } = await playTo('technologies', 0);
    expect(deadEndOf(buyCard(game, humanId))).toBe('annuler-medias');
  });

  test.each(SPECIES_CHAPTERS.map(c => [c.id, c] as const))('%s : trace bleue posée sur l\'autre plateau Alien', async (id: string, _chapter: TutorialChapter) => {
    const { game, humanId, deadEndOf, play } = await playTo(id, 0);
    const analyzing = play(game, { type: 'ANALYZE' });
    expect(analyzing.interaction?.type).toBe('PLACING_LIFE_TRACE');
    const option = SpeciesSystem.lifeTraceOptions(analyzing, LifeTraceType.BLUE).find(o => o.boardIndex === 1)!;
    const elsewhere = answerAll(play(analyzing, {
      type: 'CHOOSE', choice: { kind: 'LIFE_TRACE', boardIndex: 1, color: option.color, slotType: option.location, slotIndex: option.slotIndex },
    }), humanId);
    expect(blueTraceElsewhere(elsewhere, humanId)).toBe(true);
    expect(deadEndOf(elsewhere)).toBe('annuler-trace-bleue');
  });

  test('mascamites : énergie de la sonde, Premier Contact défaussée ou crédits échangés', async () => {
    const { game, humanId, deadEndOf, play } = await playTo('mascamites', 2);
    expect(deadEndOf(game)).toBeNull();
    expect(deadEndOf(tradeWhile(game, humanId, 'energy', g => humanOf(g, humanId).energy >= 2))).toBe('annuler-sonde');
    expect(deadEndOf(answerAll(play(game, { type: 'DISCARD_FOR_FREE_ACTION', cardId: 'ET.1' }), humanId))).toBe('annuler-carte');
    const cost = humanOf(game, humanId).cards.find(c => c.id === 'ET.1')!.cost;
    expect(deadEndOf(tradeWhile(game, humanId, 'credit', g => humanOf(g, humanId).credits >= cost))).toBe('annuler-credits');
  });

  test('anomalies : médias de la recherche dépensés après l\'ellipse', async () => {
    const { game, humanId, deadEndOf } = await playTo('anomalies', 2);
    expect(deadEndOf(game)).toBeNull();
    expect(deadEndOf(buyCard(game, humanId))).toBe('annuler-medias');
  });

  test('oumuamua : énergie ou crédits du scan échangés', async () => {
    const { game, humanId, deadEndOf } = await playTo('oumuamua', 2);
    expect(deadEndOf(game)).toBeNull();
    expect(deadEndOf(tradeWhile(game, humanId, 'energy', g => humanOf(g, humanId).energy >= 2))).toBe('annuler-energie');
    expect(deadEndOf(tradeWhile(game, humanId, 'credit', g => humanOf(g, humanId).credits >= 1))).toBe('annuler-credits');
  });

  test('centauriens : données placées dans l\'ordinateur, trace rouge hors de l\'emplacement à 15 PV', async () => {
    const { game, humanId, deadEndOf, play } = await playTo('centauriens', 2);
    expect(deadEndOf(game)).toBeNull();
    expect(deadEndOf(play(game, { type: 'TRANSFER_DATA', slotId: '1a' }))).toBe('annuler-donnees');
    // Scan : la trace rouge du secteur couvert va au premier emplacement proposé (pas celui à 15 PV)
    const scanned = answerAll(play(game, { type: 'SCAN' }), humanId);
    expect(deadEndOf(scanned)).toBe('annuler-trace-rouge');
  });
});

describe('explorateur des écarts', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());

  test.each(TUTORIAL_CHAPTERS.filter(c => c.seed !== undefined).map(c => [c.id, c] as const))(
    "%s : tout écart d'un coup laisse le chapitre terminable ou passe en mode annulation",
    async (_id: string, chapter: TutorialChapter) => {
      expect(exploreDeadEnds(chapter, await prepareChapter(chapter, 'Alice'))).toEqual([]);
    },
  );

  test('une impasse retirée est signalée avec son étape et son écart ; une exception déclarée la fait taire', async () => {
    const chapter = chapterById('technologies')!;
    const prepared = await prepareChapter(chapter, 'Alice');
    const findings = exploreDeadEnds({ ...chapter, deadEnds: [] }, prepared);
    expect(findings).toContainEqual({ chapterId: 'technologies', stepId: 'rechercher', deviation: expect.arrayContaining(['BUY_CARD']) });
    const allowed = { ...chapter, deadEnds: [], explorerAllows: [{ deviation: /^BUY_CARD$/, reason: 'essai' }] };
    expect(exploreDeadEnds(allowed, prepared)).toEqual([]);
    // Exception limitée à une autre étape : sans effet
    expect(exploreDeadEnds({ ...allowed, explorerAllows: [{ deviation: /^BUY_CARD$/, stepId: 'autre', reason: 'essai' }] }, prepared)).not.toEqual([]);
  });

  test("écarts proposés : ceux que le guidage permet à l'étape", async () => {
    const { chapter, game, humanId, state } = await playTo('sondes', 0);
    const step = TutorialRunner.currentStep(chapter, state, { game, humanId, start: game })!;
    expect(step.id).toBe('lancer');
    const types = new Set(candidateCommands(game, humanId, step).map(c => c.type));
    expect(types.has('LAUNCH_PROBE')).toBe(true);
    expect(types.has('SCAN')).toBe(false);
    expect(types.has('TRADE')).toBe(true);
    expect(types.has('BUY_CARD')).toBe(true);
  });

  test('réponses possibles à un choix, renoncement compris ; aucune sans choix en cours', async () => {
    const { game, humanId, play } = await playTo('especes', 2);
    expect(interactionAnswers(game, humanId)).toEqual([]);
    const analyzing = play(game, { type: 'ANALYZE' });
    const answers = interactionAnswers(analyzing, humanId);
    expect(answers.filter(a => a.type === 'CHOOSE')).toHaveLength(SpeciesSystem.lifeTraceOptions(analyzing, LifeTraceType.BLUE).length);
    expect(answers[answers.length - 1]).toEqual({ type: 'SKIP' });
    const buying = play(game, { type: 'BUY_CARD' });
    expect(interactionAnswers(buying, humanId).filter(a => a.type === 'CHOOSE')).toHaveLength(buying.decks.cardRow.length);
  });

  test("voisins d'une case : un pas, même pour sortir d'un champ d'astéroïdes", async () => {
    const { game } = await playTo('sondes', 0);
    expect(neighbourCells(game, 'A1').length).toBeGreaterThan(0);
    expect(neighbourCells(game, 'A2').length).toBeGreaterThan(0);
  });

  test('commandes lisibles', () => {
    expect(describeCommand({ type: 'END_TURN' })).toBe('END_TURN');
    expect(describeCommand({ type: 'PLAY_CARD', cardId: '79' })).toBe('PLAY_CARD {"cardId":"79"}');
    expect(describeCommand({ type: 'CHOOSE', choice: { kind: 'SECTOR', sectorId: 's1' } })).toBe('CHOOSE {"kind":"SECTOR","sectorId":"s1"}');
  });
});
