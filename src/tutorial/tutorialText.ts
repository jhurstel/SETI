/**
 * Textes du tutoriel (public/docs/tutoriel.md), découpés en chapitres et étapes :
 *
 *   # Titre du chapitre {#identifiant-du-chapitre}
 *   Présentation du chapitre (affichée dans le menu).
 *
 *   ## Titre de l'étape {#identifiant-de-l-etape}
 *   Texte Markdown de l'étape…
 *
 * Les lignes avant le premier chapitre (commentaire d'en-tête) sont ignorées.
 */

export interface TutorialStepText {
  title: string;
  body: string;
}

export interface TutorialChapterText {
  title: string;
  summary: string;
  steps: Record<string, TutorialStepText>;
}

const HEADING = /^(#{1,2})\s+(.*?)\s*\{#([a-z0-9-]+)\}\s*$/;

export function parseTutorialText(source: string): Record<string, TutorialChapterText> {
  const chapters: Record<string, TutorialChapterText> = {};
  let chapter: TutorialChapterText | null = null;
  let lines: string[] = [];
  let flush: (text: string) => void = () => {};

  const close = () => {
    flush(lines.join('\n').trim());
    lines = [];
  };

  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    const heading = HEADING.exec(line);
    if (!heading) {
      lines.push(line);
      continue;
    }
    close();
    const [, hashes, title, id] = heading;
    if (hashes === '#') {
      const current: TutorialChapterText = { title, summary: '', steps: {} };
      chapters[id] = current;
      chapter = current;
      flush = text => { current.summary = text; };
    } else if (chapter) {
      const step: TutorialStepText = { title, body: '' };
      chapter.steps[id] = step;
      flush = text => { step.body = text; };
    } else {
      flush = () => {};
    }
  }
  close();
  return chapters;
}
