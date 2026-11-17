import { TUTORIAL_CHAPTERS, chapterById } from '../src/tutorial/chapters';
import * as prepareModule from '../src/tutorial/prepare';
import { cloneGame } from '../src/core/cloneGame';
import { prepareChapter } from '../src/tutorial/prepare';
import { answerAll, checkSolution } from '../src/tutorial/solve';
import { TutorialChapter, TutorialContext } from '../src/tutorial/types';
import { answerInteraction, giveCardToHand, humanOf, planetCell, stepTowards } from '../src/tutorial/scenario';
import { ActionType } from '../src/core/types';
import { mockFetchFromPublic } from './helpers/gameFixture';
import { GameSession } from '../src/session/GameSession';

const prepared = TUTORIAL_CHAPTERS.filter(c => c.seed !== undefined);

describe('chapitres du tutoriel', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());

  test('identifiants uniques, étapes uniques dans chaque chapitre', () => {
    const ids = TUTORIAL_CHAPTERS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    TUTORIAL_CHAPTERS.forEach(c => expect(new Set(c.steps.map(s => s.id)).size).toBe(c.steps.length));
  });

  test.each(prepared.map(c => [c.id, c] as const))('%s : préparation, puis la solution termine chaque étape dans l\'ordre', async (_id, chapter) => {
    const result = checkSolution(chapter, await prepareChapter(chapter, 'Alice'));
    expect(result).toBeNull();
  });

  describe('vérification d\'une solution', () => {
    const base = TUTORIAL_CHAPTERS.find(c => c.id === 'sondes')!;
    const check = async (chapter: TutorialChapter) => checkSolution(chapter, await prepareChapter(base, 'Alice'));

    test('une commande que l\'étape ne permet pas est signalée', async () => {
      expect(await check({ ...base, solution: [{ type: 'SCAN' }] })).toMatch(/commande SCAN refusée à l'étape lancer/);
    });

    test('une solution incomplète est signalée', async () => {
      expect(await check({ ...base, solution: [{ type: 'LAUNCH_PROBE' }] })).toMatch(/l'étape deplacer n'est pas terminée/);
    });

    test('une étape déjà faite au départ, ou un moteur qui refuse, est signalé', async () => {
      expect(await check({ ...base, steps: [{ id: 'x', done: () => true }] })).toMatch(/déjà faite/);
      expect(await check({ ...base, steps: [{ id: 'x', done: () => false, allowedActions: [ActionType.ANALYZE_DATA] }], solution: [{ type: 'ANALYZE' }] })).toMatch(/refusée/);
    });

    test('une étape qui redevient à faire est signalée', async () => {
      // « Sonde lancée sans dépenser d'énergie » : faux dès que la sonde se déplace
      const fragile = {
        id: 'fragile', allowedActions: [ActionType.LAUNCH_PROBE],
        done: ({ game, humanId, start }: TutorialContext) => humanOf(game, humanId).probes.length > 0 && humanOf(game, humanId).energy === humanOf(start, humanId).energy,
      };
      const steps = [fragile, { id: 'suite', done: () => false }];
      expect(await check({ ...base, steps, solution: [{ type: 'LAUNCH_PROBE' }, stepTowards('mars')] })).toMatch(/l'étape fragile redevient à faire après MOVE_PROBE/);
    });

    test('le joueur doit avoir la main au départ', async () => {
      const start = await prepareChapter(base, 'Alice');
      const robotTurn = { ...start, game: { ...start.game, currentPlayerIndex: 1 } };
      expect(checkSolution(base, robotTurn)).toMatch(/n'a pas la main/);
    });

    test('answerAll laisse une partie sans interaction intacte', async () => {
      const { game, humanId } = await prepareChapter(base, 'Alice');
      expect(answerAll(game, humanId)).toBe(game);
    });
  });
});

describe('aides des chapitres', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());
  const sondes = () => prepareChapter(TUTORIAL_CHAPTERS.find(c => c.id === 'sondes')!, 'Alice');

  test('chapitre retrouvé par son identifiant', () => {
    expect(chapterById('scanner')?.id).toBe('scanner');
    expect(chapterById('inconnu')).toBeUndefined();
  });

  test('carte ou planète introuvable : erreur du chapitre, ou rien', async () => {
    const { game, humanId } = await sondes();
    expect(() => giveCardToHand(cloneGame(game), humanId, 'pas-une-carte')).toThrow('carte pas-une-carte introuvable');
    expect(planetCell(game, 'pluton')).toBeUndefined();
    expect(() => stepTowards('mars')(game, humanId)).toThrow('pas de sonde');
  });

  test('réponse par défaut : renoncement pour une interaction sans choix prévu, erreur sans interaction', async () => {
    const { game, humanId } = await sondes();
    expect(() => answerInteraction(game, humanId)).toThrow('aucune interaction');
    expect(answerInteraction({ ...game, interaction: { type: 'CHOOSING_MEDIA_OR_MOVE' } }, humanId)).toEqual({ type: 'SKIP' });
  });

  test('étape de robot refusée : erreur du chapitre', async () => {
    const chapter = TUTORIAL_CHAPTERS.find(c => c.id === 'manche')!;
    const spy = jest.spyOn(GameSession, 'applyRobotStep').mockImplementation(game => ({ game, entries: [], notifications: [], error: 'refus simulé' }));
    try {
      await expect(prepareChapter(chapter, 'Alice')).rejects.toThrow('étape de robot refusée (refus simulé)');
    } finally {
      spy.mockRestore();
    }
  });

  test('choix sans fin : signalé après le garde-fou', async () => {
    const { game, humanId } = await sondes();
    const stuck = { ...game, interaction: { type: 'CHOOSING_MEDIA_OR_MOVE' as const } };
    const spy = jest.spyOn(prepareModule, 'applyTutorialCommand').mockImplementation(current => ({ game: current, entries: [] }));
    try {
      expect(() => answerAll(stuck, humanId)).toThrow('CHOOSING_MEDIA_OR_MOVE sans fin');
    } finally {
      spy.mockRestore();
    }
  });
});
