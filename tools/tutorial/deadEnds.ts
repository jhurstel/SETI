// Explorateur des impasses du tutoriel (npm run tutorial:dead-ends -- [chapitre] [profondeur]).
// Depuis chaque étape de chaque chapitre préparé, joue les écarts que le guidage permet (src/tutorial/explore.ts) et
// affiche ceux qui rendent le chapitre impossible à terminer sans passer en mode annulation (impasse non déclarée).
// Profondeur 1 : un écart et ses choix (comme test/TutorialDeadEnds.test.ts) ; 2 ou 3 : écarts enchaînés.
import * as fs from 'fs';
import * as path from 'path';
import { TUTORIAL_CHAPTERS, chapterById } from '../../src/tutorial/chapters';
import { exploreDeadEnds } from '../../src/tutorial/explore';
import { prepareChapter } from '../../src/tutorial/prepare';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
(globalThis as { fetch: unknown }).fetch = async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
};
const log = console.log.bind(console);
console.log = () => {};
console.warn = () => {};

(async () => {
  const [id, depthArg] = process.argv.slice(2);
  const depth = Number(depthArg ?? 1);
  const chapters = id && id !== 'all' ? [chapterById(id)] : TUTORIAL_CHAPTERS.filter(c => c.seed !== undefined);
  if (chapters.some(c => !c || c.seed === undefined)) {
    log(`Chapitre inconnu ou sans position préparée : ${id}`);
    process.exit(2);
  }
  let total = 0;
  for (const chapter of chapters) {
    const started = Date.now();
    const findings = exploreDeadEnds(chapter!, await prepareChapter(chapter!, 'Tutoriel'), { depth });
    total += findings.length;
    log(`${chapter!.id} : ${findings.length ? `${findings.length} écart(s) sans impasse` : 'ok'} (${Date.now() - started} ms)`);
    for (const finding of findings) log(`  [${finding.stepId}] ${finding.deviation.join(' ; ')}`);
  }
  process.exit(total ? 1 : 0);
})();
