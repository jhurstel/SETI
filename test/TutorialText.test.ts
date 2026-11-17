import * as fs from 'fs';
import * as path from 'path';
import { TUTORIAL_CHAPTERS } from '../src/tutorial/chapters';
import { parseTutorialText } from '../src/tutorial/tutorialText';
import { slugify } from '../src/ui/components/markdown';
import { CONTEXT_HINTS, CONTEXT_HINTS_TEXT_ID } from '../src/tutorial/contextHints';

const DOCS = path.resolve(__dirname, '../public/docs');
const text = parseTutorialText(fs.readFileSync(path.join(DOCS, 'tutoriel.md'), 'utf-8'));
/** Identifiants des titres de la documentation, calculés comme le rendu (renderMarkdown) */
const docIds = new Set(
  fs.readFileSync(path.join(DOCS, 'documentation.md'), 'utf-8').split(/\r?\n/)
    .map(line => /^#{1,4}\s+(.*)$/.exec(line)?.[1])
    .filter((title): title is string => !!title)
    .map(slugify),
);

describe('textes du tutoriel (public/docs/tutoriel.md)', () => {
  test('chaque chapitre a son texte, et chaque texte de chapitre un chapitre', () => {
    expect(Object.keys(text).sort()).toEqual([...TUTORIAL_CHAPTERS.map(c => c.id), CONTEXT_HINTS_TEXT_ID].sort());
    TUTORIAL_CHAPTERS.forEach(c => expect([c.id, text[c.id].summary.length > 0]).toEqual([c.id, true]));
  });

  test.each(TUTORIAL_CHAPTERS.map(c => [c.id, c] as const))('%s : chaque étape a sa section non vide, et inversement', (_id, chapter) => {
    const sections = text[chapter.id].steps;
    expect(Object.keys(sections).sort()).toEqual(chapter.steps.map(s => s.id).sort());
    chapter.steps.forEach(step => expect([step.id, sections[step.id].body.length > 0]).toEqual([step.id, true]));
  });

  test('chaque aide au contexte a sa section non vide, et inversement', () => {
    const sections = text[CONTEXT_HINTS_TEXT_ID].steps;
    expect(Object.keys(sections).sort()).toEqual(CONTEXT_HINTS.map(h => h.id).sort());
    CONTEXT_HINTS.forEach(hint => expect([hint.id, sections[hint.id].body.length > 0]).toEqual([hint.id, true]));
  });

  test('chaque lien « En savoir plus » pointe vers un titre de la documentation', () => {
    const links = [
      ...TUTORIAL_CHAPTERS.flatMap(c => c.steps.filter(s => s.docLink).map(s => `${c.id}/${s.id} -> ${s.docLink}`)),
      ...CONTEXT_HINTS.filter(h => h.docLink).map(h => `aide/${h.id} -> ${h.docLink}`),
    ];
    expect(links.length).toBeGreaterThan(0);
    const broken = links.filter(link => !docIds.has(link.split(' -> ')[1]));
    expect(broken).toEqual([]);
  });
});
