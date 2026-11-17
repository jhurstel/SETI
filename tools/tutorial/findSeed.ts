// Recherche d'une graine pour un chapitre du tutoriel (npm run tutorial:seed -- <chapitre> [première graine] [essais]).
// Essaie les graines une à une : préparation du chapitre, puis sa solution (src/tutorial/solve.ts, comme le test
// test/TutorialChapters.test.ts). Affiche la première graine qui convient, à écrire dans src/tutorial/chapters.ts.
// Sans chapitre : vérifie la graine actuelle de chaque chapitre préparé.
import * as fs from 'fs';
import * as path from 'path';
import { TUTORIAL_CHAPTERS, chapterById } from '../../src/tutorial/chapters';
import { prepareChapter } from '../../src/tutorial/prepare';
import { checkSolution } from '../../src/tutorial/solve';
import { TutorialChapter } from '../../src/tutorial/types';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
(globalThis as { fetch: unknown }).fetch = async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
};
const log = console.log.bind(console);
console.log = () => {};
console.warn = () => {};

async function check(chapter: TutorialChapter): Promise<string | null> {
  try {
    return checkSolution(chapter, await prepareChapter(chapter, 'Tutoriel'));
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

(async () => {
  const [id, firstArg, triesArg] = process.argv.slice(2);
  if (!id) {
    let failures = 0;
    for (const chapter of TUTORIAL_CHAPTERS.filter(c => c.seed !== undefined)) {
      const error = await check(chapter);
      if (error) failures++;
      log(`${chapter.id} (graine ${chapter.seed}) : ${error ?? 'ok'}`);
    }
    process.exit(failures ? 1 : 0);
  }
  const chapter = chapterById(id);
  if (!chapter) {
    log(`Chapitre inconnu : ${id} (${TUTORIAL_CHAPTERS.map(c => c.id).join(', ')})`);
    process.exit(1);
  }
  const first = Number(firstArg ?? 1);
  const tries = Number(triesArg ?? 200);
  for (let seed = first; seed < first + tries; seed++) {
    const error = await check({ ...chapter, seed });
    if (!error) {
      log(`Graine trouvée pour ${id} : ${seed}`);
      return;
    }
  }
  log(`Aucune graine entre ${first} et ${first + tries - 1} pour ${id}`);
  process.exit(1);
})();
