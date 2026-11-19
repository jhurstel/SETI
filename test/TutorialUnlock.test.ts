import { AlienBoardType } from '../src/core/types';
import { discoveredSpecies, isChapterUnlocked, maskText, NO_SPECIES_MASK, speciesMask } from '../src/tutorial/unlock';
import { chapterById } from '../src/tutorial/chapters';
import { applyTutorialCommand, prepareChapter } from '../src/tutorial/prepare';
import { TutorialRunner } from '../src/tutorial/TutorialRunner';
import { cloneGame } from '../src/core/cloneGame';
import { answerAll, checkSolution, readExplanationsAndAdvance } from '../src/tutorial/solve';
import { TutorialChapter } from '../src/tutorial/types';
import { createTestGame, mockFetchFromPublic } from './helpers/gameFixture';

describe('déblocage des chapitres d\'espèce', () => {
  const common: TutorialChapter = { id: 'sondes', seed: 1, prepare: [], steps: [], solution: [] };
  const mascamites: TutorialChapter = { ...common, id: 'mascamites', species: AlienBoardType.MASCAMITES };

  test('un chapitre commun est toujours jouable, un chapitre d\'espèce seulement une fois l\'espèce débloquée', () => {
    expect(isChapterUnlocked(common, [])).toBe(true);
    expect(isChapterUnlocked(mascamites, [])).toBe(false);
    expect(isChapterUnlocked(mascamites, [AlienBoardType.ANOMALIES])).toBe(false);
    expect(isChapterUnlocked(mascamites, [AlienBoardType.MASCAMITES])).toBe(true);
  });

  test('espèces découvertes d\'une partie : les plateaux révélés seulement', async () => {
    const fetchSpy = mockFetchFromPublic();
    try {
      const game = await createTestGame();
      expect(discoveredSpecies(game)).toEqual([]);
      game.board.alienBoards[1].isDiscovered = true;
      expect(discoveredSpecies(game)).toEqual([game.board.alienBoards[1].speciesId]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('chapitre « Traces de vie et espèces » : espèce masquée', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());

  test('aucune espèce débloquée : les Anomalies, masquées (nom et cartes) ; la solution termine le chapitre', async () => {
    const chapter = chapterById('especes')!;
    const prepared = await prepareChapter(chapter, 'Alice');
    expect(prepared.game.board.alienBoards[0].speciesId).toBe(AlienBoardType.ANOMALIES);
    expect(checkSolution(chapter, prepared)).toBeNull();
    const mask = speciesMask(chapter, prepared.game, []);
    expect(mask.species).toEqual([AlienBoardType.ANOMALIES]);
    expect(mask.cardIds.length).toBeGreaterThan(0);
    expect(mask.cardNames).toHaveLength(mask.cardIds.length);
  });

  test('espèce déjà débloquée : le chapitre la prend, affichée normalement', async () => {
    const chapter = chapterById('especes')!;
    const prepared = await prepareChapter(chapter, 'Alice', { unlockedSpecies: [AlienBoardType.MASCAMITES] });
    expect(prepared.game.board.alienBoards[0].speciesId).toBe(AlienBoardType.MASCAMITES);
    expect(checkSolution(chapter, prepared)).toBeNull();
    expect(speciesMask(chapter, prepared.game, [AlienBoardType.MASCAMITES])).toBe(NO_SPECIES_MASK);
    // Un chapitre qui ne masque rien
    expect(speciesMask(chapterById('sondes')!, prepared.game, [])).toBe(NO_SPECIES_MASK);
  });

  test('historique masqué : cartes anonymes, message qui nomme l\'espèce remplacé, sans masque inchangé', () => {
    const mask = { species: [AlienBoardType.ANOMALIES], cardIds: ['a1', 'a2'], cardNames: ['Vie Quotidienne', 'Ecoute Attentive'] };
    expect(maskText('pioche 2 cartes Alien "Vie Quotidienne", "Ecoute Attentive" (Découverte)', mask))
      .toBe('pioche 2 cartes Alien une carte Alien, une carte Alien (Découverte)');
    expect(maskText('Des anomalies apparaissent en périphérie du système solaire !', mask)).toBe('Une espèce Alien inconnue se manifeste.');
    expect(maskText('découvre une nouvelle espèce Alien !', mask)).toBe('découvre une nouvelle espèce Alien !');
    expect(maskText('Des anomalies apparaissent', NO_SPECIES_MASK)).toBe('Des anomalies apparaissent');
  });
});

describe('chapitre Mascamites : la capsule ramenée sur Terre', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());

  test("capsule arrivée : l'étape « Ramenez-la » est passée ; trop loin sans énergie : l'étape « Annulez » s'affiche", async () => {
    const chapter = chapterById('mascamites')!;
    const { game: start, humanId } = await prepareChapter(chapter, 'Alice');
    let game = start;
    // Découverte, fin du tour, prélèvement : la capsule est sur Jupiter
    for (const command of chapter.solution.slice(0, 3)) game = answerAll(applyTutorialCommand(game, humanId, command).game, humanId, chapter);
    const stepAt = (g: typeof game) => {
      const { state, game: current } = readExplanationsAndAdvance(chapter, TutorialRunner.start(chapter), g, humanId, start);
      return TutorialRunner.currentStep(chapter, state, { game: current, humanId, start })?.id;
    };
    expect(stepAt(game)).toBe('ramener');
    const stranded = cloneGame(game);
    stranded.players.find(p => p.id === humanId)!.energy = 0;
    expect(stepAt(stranded)).toBe('annuler-capsule');
    for (const command of chapter.solution.slice(3, 5)) game = answerAll(applyTutorialCommand(game, humanId, command).game, humanId, chapter);
    expect(stepAt(game)).toBe('mission');
  });
});
