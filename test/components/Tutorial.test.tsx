/** @jest-environment jsdom */
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DataLoader } from '../../src/core/DataLoader';
import { ActionType, AlienBoardType, Game, GamePhase } from '../../src/core/types';
import { GameFactory } from '../../src/engine/GameFactory';
import { TUTORIAL_CHAPTERS } from '../../src/tutorial/chapters';
import { tutorialBlockReason, TUTORIAL_BLOCK_REASON } from '../../src/tutorial/guidance';
import { PlayerActions } from '../../src/ui/player/PlayerActions';
import { TutorialOverlay } from '../../src/ui/components/TutorialOverlay';
import { TutorialMenu } from '../../src/ui/components/TutorialMenu';
import { DocumentationModal } from '../../src/ui/modals/DocumentationModal';
import { setTutorialFocus, tutorialAllows, useTutorialFocus, useTutorialPanel } from '../../src/ui/tutorialFocus';
import { SettingsModal } from '../../src/ui/modals/SettingsModal';
import {
  dismissTutorial, markChapterDone, markHintShown, readTutorialProgress, setContextHelp, shouldProposeTutorial, tutorialProgress, TUTORIAL_KEY, unlockSpecies,
} from '../../src/ui/tutorialProgress';

const ROOT = path.resolve(__dirname, '../..');
beforeEach(() => localStorage.clear());

/** Vraie partie (cartes lues sur disque : pas de fetch sous jsdom), phase de jeu */
async function realGame(): Promise<Game> {
  DataLoader.setReader(file => fs.promises.readFile(path.join(ROOT, 'public', file), 'utf-8'));
  const game = GameFactory.initializeGame(await GameFactory.createGame(['Alice', 'Bob'], true, 4242));
  return { ...game, phase: GamePhase.PLAYING };
}

describe('cibles du tutoriel', () => {
  test('chaque cible déclarée par les chapitres porte un attribut data-tutorial dans l\'interface', () => {
    const files: string[] = [];
    const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name)) files.push(fs.readFileSync(full, 'utf-8'));
    });
    walk(path.join(ROOT, 'src/ui'));
    const source = files.join('\n');
    const targets = [...new Set(TUTORIAL_CHAPTERS.flatMap(c => c.steps.map(s => s.target)).filter((t): t is string => !!t))];
    const missing = targets.filter(t => !source.includes(`data-tutorial="${t}"`) && !source.includes(`'${t}'`));
    expect(missing).toEqual([]);
  });
});

describe('progression du tutoriel (stockage du navigateur)', () => {
  test('rien d\'enregistré : progression vide, tutoriel proposé sans sauvegarde seulement', () => {
    expect(readTutorialProgress()).toBeNull();
    expect(tutorialProgress()).toEqual({ done: [], dismissed: false, hintsShown: [], contextHelp: false, species: [] });
    expect(shouldProposeTutorial(false)).toBe(true);
    expect(shouldProposeTutorial(true)).toBe(false);
  });

  test('chapitres terminés, refus, aides vues et réglage relus', () => {
    markChapterDone('ecran');
    markChapterDone('ecran');
    markHintShown('analyse');
    setContextHelp(true);
    dismissTutorial();
    expect(readTutorialProgress()).toEqual({ done: ['ecran'], dismissed: true, hintsShown: ['analyse'], contextHelp: true, species: [] });
    expect(shouldProposeTutorial(false)).toBe(false);
  });

  test('espèces débloquées : seules les nouvelles sont renvoyées ; progression ancienne sans espèces', () => {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ done: ['ecran'], dismissed: true, hintsShown: [], contextHelp: false }));
    expect(tutorialProgress().species).toEqual([]);
    expect(unlockSpecies(['Mascamites', 'Anomalies', 'Mascamites'])).toEqual(['Mascamites', 'Anomalies']);
    expect(unlockSpecies(['Anomalies', 'Exertiens'])).toEqual(['Exertiens']);
    expect(unlockSpecies(['Exertiens'])).toEqual([]);
    expect(tutorialProgress()).toMatchObject({ done: ['ecran'], species: ['Mascamites', 'Anomalies', 'Exertiens'] });
  });

  test('stockage indisponible ou abîmé : aucune erreur, rien de retenu', () => {
    localStorage.setItem(TUTORIAL_KEY, '{abîmé');
    expect(readTutorialProgress()).toBeNull();
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué'); });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqué'); });
    try {
      expect(readTutorialProgress()).toBeNull();
      expect(markChapterDone('sondes').done).toEqual(['sondes']);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe('guidage souple dans les actions du plateau', () => {
  test('action hors sujet désactivée avec la raison du tutoriel, action permise jouable', async () => {
    const game = await realGame();
    const step = { id: 'lancer', done: () => false, allowedActions: [ActionType.LAUNCH_PROBE] };
    const onAction = jest.fn();
    const hover = jest.fn();
    render(<PlayerActions game={game} playerId={game.players[0].id} interactionState={{ type: 'IDLE' }} isInteractiveMode={false}
      onAction={onAction} onNextPlayer={() => {}} handleTooltipHover={hover} handleTooltipLeave={() => {}}
      tutorialBlock={action => tutorialBlockReason(step, action)} />);

    const scan = screen.getByRole('button', { name: ActionType.SCAN_SECTOR });
    expect(scan.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(scan);
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.mouseEnter(scan);
    const { container } = render(<>{hover.mock.calls.at(-1)[1]}</>);
    expect(container.textContent).toContain(TUTORIAL_BLOCK_REASON);

    const launch = screen.getByRole('button', { name: ActionType.LAUNCH_PROBE });
    expect(launch.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(launch);
    expect(onAction).toHaveBeenCalledWith(ActionType.LAUNCH_PROBE);
  });
});

describe('bulle du tutoriel', () => {
  const base = {
    chapterTitle: 'Sondes', stepNumber: 2, stepCount: 6, finished: false, hasDocLink: true,
    onNext: jest.fn(), onDocLink: jest.fn(), onQuit: jest.fn(), onNextChapter: jest.fn(), onMenu: jest.fn(),
  };

  test('explication : texte, « Suivant », « En savoir plus », « Quitter » ; surbrillance de la cible', () => {
    const target = document.createElement('div');
    target.setAttribute('data-tutorial', 'actions');
    target.getBoundingClientRect = () => ({ top: 10, left: 10, width: 100, height: 50, right: 110, bottom: 60, x: 10, y: 10, toJSON: () => ({}) });
    document.body.appendChild(target);
    const props = { ...base, onNext: jest.fn(), onDocLink: jest.fn(), onQuit: jest.fn() };
    const { container } = render(<TutorialOverlay {...props} text={{ title: 'Les actions', body: 'Une **seule** action.' }} target="actions" isExplanation />);
    expect(screen.getByText('Les actions')).toBeTruthy();
    expect(container.querySelector('strong')?.textContent).toBe('seule');
    expect(screen.getByText('2 / 6')).toBeTruthy();
    expect(container.querySelector('.seti-tutorial-highlight')).toBeTruthy();
    fireEvent.click(screen.getByText('Suivant'));
    fireEvent.click(screen.getByText('En savoir plus'));
    fireEvent.click(screen.getByText('Quitter'));
    expect(props.onNext).toHaveBeenCalled();
    expect(props.onDocLink).toHaveBeenCalled();
    expect(props.onQuit).toHaveBeenCalled();
    target.remove();
  });

  test('étape d\'action : pas de « Suivant », « À vous de jouer »', () => {
    render(<TutorialOverlay {...base} text={{ title: 'Lancez', body: 'Cliquez.' }} isExplanation={false} hasDocLink={false} />);
    expect(screen.queryByText('Suivant')).toBeNull();
    expect(screen.queryByText('En savoir plus')).toBeNull();
    expect(screen.getByText('À vous de jouer')).toBeTruthy();
  });

  test('chapitre terminé : chapitre suivant ou menu', () => {
    const props = { ...base, onNextChapter: jest.fn(), onMenu: jest.fn() };
    render(<TutorialOverlay {...props} isExplanation finished nextChapterTitle="Atterrir" />);
    fireEvent.click(screen.getByText('Chapitre suivant : Atterrir'));
    fireEvent.click(screen.getByText('Menu des chapitres'));
    expect(props.onNextChapter).toHaveBeenCalled();
    expect(props.onMenu).toHaveBeenCalled();
  });
});

describe('menu des chapitres', () => {
  test('chapitres terminés cochés, chapitre choisi démarré', () => {
    const onStart = jest.fn();
    render(<TutorialMenu chapters={TUTORIAL_CHAPTERS} done={['sondes']} onStart={onStart} onClose={() => {}}
      text={{ ecran: { title: 'L\'écran', summary: 'Découvrez', steps: {} }, sondes: { title: 'Sondes', summary: 'Mars', steps: {} } }} />);
    expect(screen.getByRole('button', { name: 'Sondes (terminé)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'L\'écran' }));
    expect(onStart).toHaveBeenCalledWith('ecran');
  });

  test("chapitre d'espèce : verrouillé et anonyme tant que l'espèce n'est pas débloquée", () => {
    const onStart = jest.fn();
    const chapters = [{ id: 'mascamites', seed: 1, species: AlienBoardType.MASCAMITES, prepare: [], steps: [], solution: [] }];
    const text = { mascamites: { title: 'Mascamites', summary: 'Spécimens et capsules', steps: {} } };
    const { unmount } = render(<TutorialMenu chapters={chapters} done={[]} onStart={onStart} onClose={() => {}} text={text} />);
    const locked = screen.getByRole('button', { name: 'Espèce inconnue (chapitre verrouillé)' });
    expect(screen.queryByText(/Mascamites|Spécimens/)).toBeNull();
    fireEvent.click(locked);
    expect(onStart).not.toHaveBeenCalled();
    unmount();

    render(<TutorialMenu chapters={chapters} done={[]} unlockedSpecies={[AlienBoardType.MASCAMITES]} onStart={onStart} onClose={() => {}} text={text} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mascamites' }));
    expect(onStart).toHaveBeenCalledWith('mascamites');
  });
});

describe('documentation ouverte sur une section', () => {
  test('« En savoir plus » : la section demandée est affichée', async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id); };
    const fetchMock = jest.fn(async () => ({ ok: true, text: async () => '# Titre\n\n## 2.3 Scanner\n\nTexte.' }));
    (globalThis as { fetch: unknown }).fetch = fetchMock;
    render(<DocumentationModal visible onClose={() => {}} section="2-3-scanner" />);
    await waitFor(() => expect(scrolled).toContain('2-3-scanner'));
  });

  test("espèce pas encore rencontrée : sa section est masquée, un lien vers elle ouvre l'encart", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id); };
    const source = [
      '# Doc', '', '## 3. Les espèces Alien', '',
      '<!-- espece:Mascamites -->', '### 3.2 Mascamites', '', 'Spécimens.', '',
      '<!-- espece:Anomalies -->', '### 3.3 Anomalies', '', 'Jetons.',
    ].join('\n');
    (globalThis as { fetch: unknown }).fetch = jest.fn(async () => ({ ok: true, text: async () => source }));
    unlockSpecies(['Anomalies']);
    render(<DocumentationModal visible onClose={() => {}} section="3-2-mascamites" />);
    await waitFor(() => expect(scrolled).toContain('especes-encore-inconnues'));
    expect(screen.queryByText(/Mascamites|Spécimens/)).toBeNull();
    expect(screen.getAllByText('Jetons.')).toHaveLength(1);
  });
});

describe('accueil : proposition du tutoriel', () => {
  const home = (props: Partial<React.ComponentProps<typeof SettingsModal>> = {}) => render(
    <SettingsModal visible setVisible={() => {}} game={null} historyLog={[]} onLoadGame={() => {}} setToast={() => {}}
      showDebug={false} setShowDebug={() => {}} {...props} />,
  );

  test('nouveau joueur : proposé ; « Commencer » démarre le premier chapitre', () => {
    const onStartTutorial = jest.fn();
    home({ onStartTutorial, onTutorial: () => {} });
    fireEvent.click(screen.getByText('Commencer le tutoriel'));
    expect(onStartTutorial).toHaveBeenCalled();
  });

  test('partie sauvegardée : pas de proposition, mais la carte Tutoriel ouvre le menu', () => {
    localStorage.setItem('seti_autosave', '{}');
    const onTutorial = jest.fn();
    home({ onStartTutorial: () => {}, onTutorial });
    expect(screen.queryByText('Commencer le tutoriel')).toBeNull();
    fireEvent.click(screen.getByText('Tutoriel'));
    expect(onTutorial).toHaveBeenCalled();
  });

  test('réglage « Conseils en partie » : coché selon la progression, modifiable', () => {
    const onContextHelpChange = jest.fn();
    home({ contextHelp: true, onContextHelpChange });
    const box = screen.getByRole('checkbox', { name: 'Conseils en partie' }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onContextHelpChange).toHaveBeenCalledWith(false);
  });

  test('conseil en partie : bulle sans numéro, « Compris » et « Ne plus afficher les conseils »', () => {
    const onNext = jest.fn();
    const onQuit = jest.fn();
    render(<TutorialOverlay chapterTitle="Conseil" text={{ title: 'Analyse possible', body: 'Analysez.' }} stepNumber={1} stepCount={1} hideCount
      isExplanation finished={false} hasDocLink nextLabel="Compris" quitLabel="Ne plus afficher les conseils"
      onNext={onNext} onDocLink={() => {}} onQuit={onQuit} onNextChapter={() => {}} onMenu={() => {}} />);
    expect(screen.queryByText('1 / 1')).toBeNull();
    fireEvent.click(screen.getByText('Compris'));
    fireEvent.click(screen.getByText('Ne plus afficher les conseils'));
    expect(onNext).toHaveBeenCalled();
    expect(onQuit).toHaveBeenCalled();
  });

  test('« Plus tard » : la proposition ne revient plus', () => {
    const first = home({ onStartTutorial: () => {} });
    act(() => { fireEvent.click(screen.getByText('Plus tard')); });
    expect(screen.queryByText('Commencer le tutoriel')).toBeNull();
    first.unmount();
    home({ onStartTutorial: () => {} });
    expect(screen.queryByText('Commencer le tutoriel')).toBeNull();
  });
});

describe('étape vue par les plateaux (tutorialFocus)', () => {
  afterEach(() => act(() => setTutorialFocus({ active: false })));

  /** Panneau d'essai : ouvert ou fermé, et action de lancement permise ou non */
  const Panel = ({ target }: { target: string }) => {
    const [open, setOpen] = React.useState(false);
    const pinned = useTutorialPanel(target, setOpen);
    const launch = tutorialAllows(useTutorialFocus(), ActionType.LAUNCH_PROBE);
    return <div>{`${target}:${open ? 'ouvert' : 'fermé'}:${pinned ? 'épinglé' : 'libre'}:${launch ? 'lancement' : 'bloqué'}`}</div>;
  };

  test("hors tutoriel : rien ne change ; pendant une étape, le panneau décrit s'ouvre et les autres se ferment", () => {
    render(<><Panel target="history" /><Panel target="card-row" /></>);
    expect(screen.getByText('history:fermé:libre:lancement')).toBeTruthy();
    const step = { id: 'lancer', done: () => false, allowedActions: [ActionType.LAUNCH_PROBE] };
    act(() => setTutorialFocus({ active: true, target: 'card-row', block: action => tutorialBlockReason(step, action) }));
    expect(screen.getByText('card-row:ouvert:épinglé:lancement')).toBeTruthy();
    expect(screen.getByText('history:fermé:libre:lancement')).toBeTruthy();
    const explanation = { id: 'intro' };
    act(() => setTutorialFocus({ active: true, target: 'history', block: action => tutorialBlockReason(explanation, action) }));
    expect(screen.getByText('history:ouvert:épinglé:bloqué')).toBeTruthy();
    expect(screen.getByText('card-row:fermé:libre:bloqué')).toBeTruthy();
  });
});
