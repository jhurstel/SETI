import { TUTORIAL_CHAPTERS, chapterById } from '../src/tutorial/chapters';
import * as prepareModule from '../src/tutorial/prepare';
import { cloneGame } from '../src/core/cloneGame';
import { applyTutorialCommand, prepareChapter } from '../src/tutorial/prepare';
import { answerAll, checkSolution, readExplanations } from '../src/tutorial/solve';
import { TutorialRunner } from '../src/tutorial/TutorialRunner';
import { tutorialBlockReason } from '../src/tutorial/guidance';
import { TutorialChapter, TutorialContext } from '../src/tutorial/types';
import { answerInteraction, cannotReachOrbit, giveCardToHand, giveSpeciesCardToHand, humanOf, planetCell, stepTowards } from '../src/tutorial/scenario';
import { ActionType, LifeTraceType } from '../src/core/types';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
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
    expect(() => giveSpeciesCardToHand(cloneGame(game), humanId, 'pas-une-carte')).toThrow("carte d'espèce pas-une-carte introuvable");
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

describe('étapes de secours et scénarios', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());

  test('sondes : sans assez d\'énergie pour rejoindre Mars et s\'y mettre en orbite, l\'étape « annuler » s\'affiche', async () => {
    const chapter = chapterById('sondes')!;
    const { game: start, humanId } = await prepareChapter(chapter, 'Alice');
    const launched = applyTutorialCommand(start, humanId, { type: 'LAUNCH_PROBE' }).game;
    const stepAt = (game: typeof start) => {
      const context = { game, humanId, start };
      return TutorialRunner.currentStep(chapter, readExplanations(chapter, TutorialRunner.start(chapter), context), context)?.id;
    };
    // Mars à 2 cases : 2 énergies pour y aller, 1 pour l'orbite
    expect(stepAt(launched)).toBe('deplacer');
    const short = cloneGame(launched);
    humanOf(short, humanId).energy = 2;
    expect(stepAt(short)).toBe('annuler-energie');
    const context = { game: short, humanId, start };
    expect(tutorialBlockReason(TutorialRunner.currentStep(chapter, TutorialRunner.start(chapter), context), ActionType.ORBIT)).not.toBeNull();
    // Avant le lancement (pas de sonde), l'étape n'a pas lieu d'être
    const noProbe = cloneGame(start);
    humanOf(noProbe, humanId).energy = 0;
    expect(cannotReachOrbit(noProbe, humanId, 'mars')).toBe(false);
  });

  test('scanner : chaque joueur présent gagne 1 média, l\'adversaire second garde un marqueur sur la première case', async () => {
    const chapter = chapterById('scanner')!;
    const { game: start, humanId } = await prepareChapter(chapter, 'Alice');
    const opponentId = start.players.find(p => p.id !== humanId)!.id;
    const earthSector = (game: typeof start) => game.board.sectors.find(s => s.signals.some(signal => signal.markedBy === opponentId))!;
    const sectorId = earthSector(start).id;
    expect(earthSector(start).signals[0].markedBy).toBe(opponentId);
    const after = answerAll(applyTutorialCommand(start, humanId, { type: 'SCAN' }).game, humanId);
    expect(humanOf(after, opponentId).mediaCoverage).toBe(humanOf(start, opponentId).mediaCoverage + 1);
    expect(humanOf(after, humanId).mediaCoverage).toBeGreaterThan(humanOf(start, humanId).mediaCoverage);
    const sector = after.board.sectors.find(s => s.id === sectorId)!;
    expect(sector.isCovered).toBe(true);
    expect(sector.signals[0].markedBy).toBe(opponentId);
    expect(sector.signals.filter(s => s.marked)).toHaveLength(1);
  });
});

test('espèces : trace bleue posée sur le second plateau Alien, l\'étape « annuler » s\'affiche', async () => {
  const fetchSpy = mockFetchFromPublic();
  try {
    const chapter = chapterById('especes')!;
    const { game: start, humanId } = await prepareChapter(chapter, 'Alice');
    let game = start;
    // Solution jusqu'à l'analyse (sa fin de tour révèle l'espèce : sans objet ici)
    for (const command of chapter.solution.filter(c => typeof c === 'function' || c.type !== 'END_TURN')) game = applyTutorialCommand(game, humanId, command).game;
    expect(game.interaction?.type).toBe('PLACING_LIFE_TRACE');
    const option = SpeciesSystem.lifeTraceOptions(game, LifeTraceType.BLUE).find(o => o.boardIndex === 1)!;
    game = answerAll(applyTutorialCommand(game, humanId, {
      type: 'CHOOSE', choice: { kind: 'LIFE_TRACE', boardIndex: 1, color: option.color, slotType: option.location, slotIndex: option.slotIndex },
    }).game, humanId);
    const context = { game, humanId, start };
    expect(TutorialRunner.currentStep(chapter, readExplanations(chapter, TutorialRunner.start(chapter), context), context)?.id).toBe('annuler-trace-bleue');
  } finally {
    fetchSpy.mockRestore();
  }
});

test('oumuamua : rangée de 3 cartes ; une autre carte que la première prise au scan, l\'étape « annuler » s\'affiche', async () => {
  const fetchSpy = mockFetchFromPublic();
  try {
    const chapter = chapterById('oumuamua')!;
    const { game: start, humanId } = await prepareChapter(chapter, 'Alice');
    expect(start.decks.cardRow).toHaveLength(3);
    const rightCardId = start.decks.cardRow[0].id;
    let game = start;
    for (const command of chapter.solution.slice(0, -1)) game = answerAll(applyTutorialCommand(game, humanId, command).game, humanId, chapter);
    game = applyTutorialCommand(game, humanId, { type: 'SCAN' }).game;
    // Signal de la Terre, puis la deuxième carte de la rangée au lieu de la première
    for (let i = 0; i < 10 && game.interaction?.type !== 'SELECTING_SCAN_CARD'; i++) game = applyTutorialCommand(game, humanId, answerInteraction(game, humanId)).game;
    expect(game.interaction?.type).toBe('SELECTING_SCAN_CARD');
    const wrongCardId = game.decks.cardRow.find(c => c.id !== rightCardId)!.id;
    const before = game;
    game = answerAll(applyTutorialCommand(game, humanId, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: wrongCardId } }).game, humanId);
    expect(before.decks.cardRow.some(c => c.id === wrongCardId)).toBe(true);
    const stepAt = (g: typeof start) => {
      const context = { game: g, humanId, start };
      return TutorialRunner.currentStep(chapter, readExplanations(chapter, TutorialRunner.start(chapter), context), context)?.id;
    };
    expect(stepAt(game)).toBe('annuler-scan');
    // Avec la bonne carte, pas d'étape de secours pendant le choix du secteur
    const right = applyTutorialCommand(before, humanId, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: rightCardId } }).game;
    expect(stepAt(right)).toBe('scanner');
  } finally {
    fetchSpy.mockRestore();
  }
});

test('exertiens : renoncer à jouer une carte à la découverte, l\'étape « annuler » s\'affiche', async () => {
  const fetchSpy = mockFetchFromPublic();
  try {
    const chapter = chapterById('exertiens')!;
    const { game: start, humanId } = await prepareChapter(chapter, 'Alice');
    let game = start;
    for (const command of chapter.solution) {
      game = applyTutorialCommand(game, humanId, command).game;
      if (game.interaction?.type !== 'CHOOSING_EXERTIEN_CARD') game = answerAll(game, humanId, chapter);
    }
    expect(game.interaction?.type).toBe('CHOOSING_EXERTIEN_CARD');
    const stepAt = (g: typeof start) => {
      const context = { game: g, humanId, start };
      return TutorialRunner.currentStep(chapter, readExplanations(chapter, TutorialRunner.start(chapter), context), context)?.id;
    };
    expect(stepAt(game)).toBe('jouer');
    const refused = applyTutorialCommand(game, humanId, { type: 'CHOOSE', choice: { kind: 'EXERTIEN', cardId: undefined } }).game;
    expect(refused.interaction?.type).not.toBe('CHOOSING_EXERTIEN_CARD');
    expect(stepAt(refused)).toBe('annuler-refus');
  } finally {
    fetchSpy.mockRestore();
  }
});
