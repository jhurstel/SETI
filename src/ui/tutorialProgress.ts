/**
 * Progression du tutoriel dans le navigateur (localStorage['seti_tutorial']) : chapitres terminés, proposition du
 * premier lancement refusée, aides au contexte déjà vues et réglage de ces aides. Lecture et écriture protégées :
 * sans stockage (navigation privée, données bloquées), le tutoriel reste jouable sans rien retenir.
 */
export const TUTORIAL_KEY = 'seti_tutorial';

export interface TutorialProgress {
  done: string[];
  dismissed: boolean;
  hintsShown: string[];
  /** Aide au contexte en partie (activée par « Première vraie partie », désactivable dans les paramètres) */
  contextHelp: boolean;
}

const EMPTY: TutorialProgress = { done: [], dismissed: false, hintsShown: [], contextHelp: false };

/** Progression enregistrée, ou null s'il n'y en a pas (ou si le stockage est inaccessible) */
export function readTutorialProgress(): TutorialProgress | null {
  try {
    const raw = localStorage.getItem(TUTORIAL_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<TutorialProgress>;
    return {
      done: Array.isArray(saved.done) ? saved.done : [],
      dismissed: !!saved.dismissed,
      hintsShown: Array.isArray(saved.hintsShown) ? saved.hintsShown : [],
      contextHelp: !!saved.contextHelp,
    };
  } catch {
    return null;
  }
}

export function tutorialProgress(): TutorialProgress {
  return readTutorialProgress() ?? EMPTY;
}

/** Modifie la progression ; renvoie la nouvelle (même si elle n'a pas pu être enregistrée) */
export function updateTutorialProgress(change: (progress: TutorialProgress) => TutorialProgress): TutorialProgress {
  const next = change(tutorialProgress());
  try {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : la progression n'est pas retenue
  }
  return next;
}

export const markChapterDone = (chapterId: string) =>
  updateTutorialProgress(p => (p.done.includes(chapterId) ? p : { ...p, done: [...p.done, chapterId] }));
export const dismissTutorial = () => updateTutorialProgress(p => ({ ...p, dismissed: true }));
export const markHintShown = (hintId: string) =>
  updateTutorialProgress(p => (p.hintsShown.includes(hintId) ? p : { ...p, hintsShown: [...p.hintsShown, hintId] }));
export const setContextHelp = (enabled: boolean) => updateTutorialProgress(p => ({ ...p, contextHelp: enabled }));

/** Le tutoriel est proposé au lancement : ni partie sauvegardée, ni progression, ni refus */
export function shouldProposeTutorial(hasAutosave: boolean): boolean {
  return !hasAutosave && readTutorialProgress() === null;
}
