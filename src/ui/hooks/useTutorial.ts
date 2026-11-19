import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../../core/types';
import { cloneGame } from '../../core/cloneGame';
import { chapterById, TUTORIAL_CHAPTERS } from '../../tutorial/chapters';
import { tutorialBlockReason, tutorialFinishedReason } from '../../tutorial/guidance';
import { parseTutorialText, TutorialChapterText } from '../../tutorial/tutorialText';
import { deadEndStep, TutorialRunner } from '../../tutorial/TutorialRunner';
import { isChapterUnlocked } from '../../tutorial/unlock';
import type { TutorialAction, TutorialChapter, TutorialState, TutorialStep } from '../../tutorial/types';
import { markChapterDone, tutorialProgress } from '../tutorialProgress';

/** Chapitre en cours : son déroulement, la position de départ et le joueur humain */
export interface ActiveTutorial {
  chapter: TutorialChapter;
  state: TutorialState;
  start: Game;
  humanId: string;
}

/** Textes du tutoriel (public/docs/tutoriel.md), chargés une fois */
let textCache: Promise<Record<string, TutorialChapterText>> | null = null;
function loadTutorialText(): Promise<Record<string, TutorialChapterText>> {
  textCache ??= fetch('docs/tutoriel.md')
    .then(response => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
    .then(parseTutorialText)
    .catch(error => { textCache = null; throw error; });
  return textCache;
}

/**
 * Tutoriel dans l'interface : chapitre en cours, étape courante (déduite de la partie affichée), textes et
 * progression. Les règles du déroulement sont dans src/tutorial (TutorialRunner, guidance).
 */
export function useTutorial(game: Game | null, onEllipsis?: (advanced: Game) => void) {
  const [active, setActive] = useState<ActiveTutorial | null>(null);
  const [text, setText] = useState<Record<string, TutorialChapterText> | null>(null);
  const [done, setDone] = useState<string[]>(() => tutorialProgress().done);
  /** Espèces débloquées : chapitres d'espèce jouables et règles visibles dans la documentation */
  const [unlockedSpecies, setUnlockedSpecies] = useState<string[]>(() => tutorialProgress().species);
  const refreshProgress = useCallback(() => {
    const progress = tutorialProgress();
    setDone(progress.done);
    setUnlockedSpecies(progress.species);
  }, []);

  const ensureText = useCallback(() => {
    loadTutorialText().then(setText).catch(() => setText({}));
  }, []);

  // Étape affichée avant le choix en cours : elle reste affichée tant que le choix n'est pas fait
  const previousIndex = useRef<number | null>(null);

  const begin = useCallback((chapter: TutorialChapter, start: Game, humanId: string) => {
    ensureText();
    previousIndex.current = null;
    setActive({ chapter, state: TutorialRunner.start(chapter), start, humanId });
  }, [ensureText]);

  const end = useCallback(() => setActive(null), []);

  const context = useMemo(() => (active && game ? { game, humanId: active.humanId, start: active.start } : null), [active, game]);
  const stepIndex = active && context ? TutorialRunner.displayIndex(active.chapter, active.state, context, previousIndex.current) : -1;
  useEffect(() => { previousIndex.current = stepIndex >= 0 ? stepIndex : null; }, [stepIndex]);
  /**
   * Un choix est en cours : la bulle s'efface pour laisser cliquer les cartes, secteurs ou bonus proposés, sauf pour une
   * étape faite pour être lue pendant ce choix (duringChoice)
   */
  const choicePendingRaw = !!active && !!game?.interaction;
  /** Impasse : le chapitre ne peut plus se terminer, l'étape d'impasse (mode annulation) remplace l'étape courante */
  const deadEnd = active && context ? TutorialRunner.deadEnd(active.chapter, active.state, context) : null;
  const deadEndShown = useMemo(() => (deadEnd ? deadEndStep(deadEnd) : null), [deadEnd]);
  const step: TutorialStep | null = active ? deadEndShown ?? active.chapter.steps[stepIndex] ?? null : null;
  const duringChoice = !!game && TutorialRunner.shownDuringChoice(step, game);
  const choicePending = choicePendingRaw && !duringChoice;
  const finished = !!active && !!context && stepIndex >= active.chapter.steps.length;

  // Chapitre terminé : retenu dans la progression
  useEffect(() => {
    if (finished && active) setDone(markChapterDone(active.chapter.id).done);
  }, [finished, active]);

  const next = useCallback(() => {
    if (!active || !game) return;
    const current = TutorialRunner.currentStep(active.chapter, active.state, { game, humanId: active.humanId, start: active.start });
    setActive({ ...active, state: TutorialRunner.next(active.chapter, active.state, { game, humanId: active.humanId, start: active.start }) });
    // Ellipse : la partie avance d'un coup (« quelques tours plus tard »)
    if (current?.ellipsis && !current.done) onEllipsis?.(current.ellipsis(cloneGame(game), active.humanId));
  }, [active, game, onEllipsis]);

  /** Chapitre préparé terminé : plus aucune commande, seules les options de la bulle */
  const lockReason = active ? tutorialFinishedReason(active.chapter, finished) : null;

  /** Guidage souple : fonction stable tant que l'étape ne change pas (plateau joueur mémoïsé) */
  const block = useMemo(
    () => (lockReason ? () => lockReason : step ? (action: TutorialAction) => tutorialBlockReason(step, action) : undefined),
    [step, lockReason],
  );

  // Chapitre suivant jouable (les chapitres d'espèce verrouillés sont sautés)
  const nextChapter = active
    ? TUTORIAL_CHAPTERS.slice(TUTORIAL_CHAPTERS.findIndex(c => c.id === active.chapter.id) + 1).find(c => isChapterUnlocked(c, unlockedSpecies))
    : undefined;

  return {
    active, step, stepIndex, finished, text, done, unlockedSpecies, block, nextChapter, choicePending, duringChoice, lockReason,
    begin, end, next, ensureText, refreshProgress,
    chapterById,
  };
}
