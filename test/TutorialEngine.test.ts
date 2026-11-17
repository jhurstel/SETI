import { ActionType, Game, GamePhase, LifeTraceType, ProbeState } from '../src/core/types';
import { TutorialRunner } from '../src/tutorial/TutorialRunner';
import { commandAction, tutorialBlockReason, tutorialCommandBlockReason, tutorialFinishedReason, TUTORIAL_BLOCK_REASON, TUTORIAL_FINISHED_REASON, TUTORIAL_READ_REASON } from '../src/tutorial/guidance';
import { applyTutorialCommand, playRobots, prepareChapter, resolveCommand } from '../src/tutorial/prepare';
import { parseTutorialText } from '../src/tutorial/tutorialText';
import { TutorialChapter } from '../src/tutorial/types';
import { SessionJournal } from '../src/session/SessionJournal';
import { mockFetchFromPublic } from './helpers/gameFixture';

const hasProbe = (game: Game, humanId: string) =>
  game.players.find(p => p.id === humanId)!.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);

/** Chapitre d'essai : une explication, puis lancer une sonde, puis finir le tour */
const chapter: TutorialChapter = {
  id: 'essai',
  seed: 4242,
  adjust: (game, humanId) => {
    game.players.find(p => p.id === humanId)!.credits = 9;
    return game;
  },
  prepare: [],
  steps: [
    { id: 'intro', target: 'board' },
    { id: 'lancer', target: 'actions', done: ({ game, humanId }) => hasProbe(game, humanId), allowedActions: [ActionType.LAUNCH_PROBE] },
    // Tour suivant : la sonde est là et le joueur n'a pas encore joué d'action principale
    { id: 'fin', done: ({ game, humanId }) => hasProbe(game, humanId) && !game.players.find(p => p.id === humanId)!.hasPerformedMainAction, allowedActions: ['END_TURN'] },
  ],
  solution: [{ type: 'LAUNCH_PROBE' }, { type: 'END_TURN' }],
};

async function prepare(c: TutorialChapter = chapter) {
  const fetchSpy = mockFetchFromPublic();
  try {
    return await prepareChapter(c, 'Alice');
  } finally {
    fetchSpy.mockRestore();
  }
}

describe('préparation d\'un chapitre', () => {
  test('même position à chaque préparation, mise en place faite, ajustements appliqués', async () => {
    const a = await prepare();
    const b = await prepare();
    expect(a.game.phase).toBe(GamePhase.PLAYING);
    expect(JSON.stringify(a.game.players)).toBe(JSON.stringify(b.game.players));
    expect(a.game.board).toEqual(b.game.board);
    expect(a.game.decks.cardRow.map(c => c.id)).toEqual(b.game.decks.cardRow.map(c => c.id));
    const human = a.game.players.find(p => p.id === a.humanId)!;
    expect(human.type).toBe('human');
    expect(human.credits).toBe(9);
    expect(human.reservedCards).toHaveLength(1);
    const robot = a.game.players.find(p => p.id !== a.humanId)!;
    expect(robot.aiDifficulty).toBe('IDLE');
    expect(a.game.players[a.game.currentPlayerIndex].id).toBe(a.humanId);
  });

  test("l'historique de la préparation ne permet pas de revenir avant le chapitre", async () => {
    const { entries } = await prepare();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.previousState === undefined)).toBe(true);
    // Chaque entrée a son identifiant (clé de l'historique affiché)
    expect(new Set(entries.map(e => e.id)).size).toBe(entries.length);
    expect(SessionJournal.undoLast(entries)).toBeNull();
  });

  test('commandes de préparation : jouées par la session, les tours de l\'adversaire passif suivent', async () => {
    const withCommands = await prepare({ ...chapter, prepare: [{ type: 'LAUNCH_PROBE' }, { type: 'END_TURN' }] });
    const robot = withCommands.game.players.find(p => p.id !== withCommands.humanId)!;
    expect(robot.hasPassed).toBe(true);
    expect(withCommands.game.players[withCommands.game.currentPlayerIndex].id).toBe(withCommands.humanId);
    expect(hasProbe(withCommands.game, withCommands.humanId)).toBe(true);
  });

  test('une commande refusée ou un chapitre sans position est une erreur du chapitre', async () => {
    await expect(prepare({ ...chapter, prepare: [{ type: 'ANALYZE' }] })).rejects.toThrow('commande ANALYZE refusée');
    await expect(prepare({ ...chapter, seed: undefined })).rejects.toThrow("n'a pas de position préparée");
  });

  test('applyTutorialCommand ne modifie pas la partie reçue ; une commande peut se calculer sur la partie', async () => {
    const { game, humanId } = await prepare();
    const snapshot = JSON.stringify(game);
    const result = applyTutorialCommand(game, humanId, () => ({ type: 'LAUNCH_PROBE' }));
    expect(JSON.stringify(game)).toBe(snapshot);
    expect(hasProbe(result.game, humanId)).toBe(true);
    expect(resolveCommand({ type: 'END_TURN' }, game, humanId)).toEqual({ type: 'END_TURN' });
    // Sans robot à faire jouer, rien ne change
    expect(playRobots(game).game).toBe(game);
  });
});

describe('déroulement des étapes', () => {
  test('explication validée par « Suivant », action validée par son prédicat, fin du chapitre', async () => {
    const { game, humanId } = await prepare();
    let state = TutorialRunner.start(chapter);
    expect(TutorialRunner.currentStep(chapter, state, { game, humanId, start: game })?.id).toBe('intro');
    state = TutorialRunner.next(chapter, state, { game, humanId, start: game });
    expect(TutorialRunner.currentStep(chapter, state, { game, humanId, start: game })?.id).toBe('lancer');
    // « Suivant » n'avance pas une étape qui attend une action
    expect(TutorialRunner.next(chapter, state, { game, humanId, start: game })).toBe(state);
    const launched = applyTutorialCommand(game, humanId, { type: 'LAUNCH_PROBE' }).game;
    expect(TutorialRunner.currentStep(chapter, state, { game: launched, humanId, start: game })?.id).toBe('fin');
    const ended = applyTutorialCommand(launched, humanId, { type: 'END_TURN' }).game;
    expect(TutorialRunner.isFinished(chapter, state, { game: ended, humanId, start: game })).toBe(true);
    expect(TutorialRunner.currentStep(chapter, state, { game: ended, humanId, start: game })).toBeNull();
    // Une fois fini, « Suivant » ne change rien
    expect(TutorialRunner.next(chapter, state, { game: ended, humanId, start: game })).toBe(state);
  });

  test("après une annulation, l'étape revient à celle qui correspond à la partie", async () => {
    const { game, humanId } = await prepare();
    const state = TutorialRunner.next(chapter, TutorialRunner.start(chapter), { game, humanId, start: game });
    const launched = applyTutorialCommand(game, humanId, { type: 'LAUNCH_PROBE' }).game;
    expect(TutorialRunner.currentIndex(chapter, state, { game: launched, humanId, start: game })).toBe(2);
    // Partie d'avant la commande (annulation) : retour à l'étape « lancer », l'explication reste validée
    expect(TutorialRunner.currentIndex(chapter, state, { game, humanId, start: game })).toBe(1);
  });

  test("pendant un choix en cours, l'étape affichée ne revient jamais en arrière", async () => {
    const { game, humanId } = await prepare();
    const state = TutorialRunner.next(chapter, TutorialRunner.start(chapter), { game, humanId, start: game });
    const launched = applyTutorialCommand(game, humanId, { type: 'LAUNCH_PROBE' }).game;
    // Choix en cours alors que la partie ne remplit plus l'étape atteinte (ici, sonde pas encore lancée)
    const choosing = { ...game, interaction: { type: 'SELECTING_SCAN_CARD' as const } };
    expect(TutorialRunner.displayIndex(chapter, state, { game: choosing, humanId, start: game }, 2)).toBe(2);
    // Le choix peut faire avancer l'étape (étape à lire pendant le choix)
    const advanced = { ...launched, interaction: { type: 'SELECTING_SCAN_CARD' as const } };
    expect(TutorialRunner.displayIndex(chapter, state, { game: advanced, humanId, start: game }, 1)).toBe(2);
    // Sans étape précédente connue, ou une fois le choix fait : l'étape courante
    expect(TutorialRunner.displayIndex(chapter, state, { game: choosing, humanId, start: game }, null)).toBe(1);
    expect(TutorialRunner.displayIndex(chapter, state, { game, humanId, start: game }, 2)).toBe(1);
  });

  test("une étape reste affichée pendant le seul type de choix qu'elle annonce", async () => {
    const { game } = await prepare();
    const step = { id: 'poser', duringChoice: 'PLACING_LIFE_TRACE' as const };
    expect(TutorialRunner.shownDuringChoice(step, { ...game, interaction: { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED } })).toBe(true);
    expect(TutorialRunner.shownDuringChoice(step, { ...game, interaction: { type: 'SELECTING_SCAN_CARD' } })).toBe(false);
    expect(TutorialRunner.shownDuringChoice(step, game)).toBe(false);
    expect(TutorialRunner.shownDuringChoice({ id: 'x' }, { ...game, interaction: { type: 'SELECTING_SCAN_CARD' } })).toBe(false);
  });

  test("l'état reçu n'est pas modifié", async () => {
    const { game, humanId } = await prepare();
    const state = TutorialRunner.start(chapter);
    const next = TutorialRunner.next(chapter, state, { game, humanId, start: game });
    expect(state.explained).toEqual([]);
    expect(next.explained).toEqual(['intro']);
  });
});

describe('guidage souple', () => {
  const action = chapter.steps[1];
  const explanation = chapter.steps[0];

  test('action hors sujet refusée avec sa raison, action permise acceptée', () => {
    expect(tutorialBlockReason(action, ActionType.SCAN_SECTOR)).toBe(TUTORIAL_BLOCK_REASON);
    expect(tutorialBlockReason(action, 'END_TURN')).toBe(TUTORIAL_BLOCK_REASON);
    expect(tutorialBlockReason(action, ActionType.LAUNCH_PROBE)).toBeNull();
    expect(tutorialCommandBlockReason(action, { type: 'SCAN' })).toBe(TUTORIAL_BLOCK_REASON);
    expect(tutorialCommandBlockReason(action, { type: 'LAUNCH_PROBE' })).toBeNull();
  });

  test('étape d\'explication : toute action principale attend « Suivant »', () => {
    expect(tutorialBlockReason(explanation, ActionType.LAUNCH_PROBE)).toBe(TUTORIAL_READ_REASON);
  });

  test('actions gratuites, choix et annulation jamais filtrés ; sans étape, tout est permis', () => {
    expect(tutorialCommandBlockReason(action, { type: 'MOVE_PROBE', probeId: 'p', disk: 'A', sector: 1 })).toBeNull();
    expect(tutorialCommandBlockReason(explanation, { type: 'TRADE', spend: 'credit', gain: 'energy' })).toBeNull();
    expect(tutorialCommandBlockReason(action, { type: 'CHOOSE', choice: { kind: 'ACCEPT', accepted: true } })).toBeNull();
    expect(tutorialCommandBlockReason(action, { type: 'SKIP' })).toBeNull();
    expect(tutorialBlockReason(null, ActionType.PASS)).toBeNull();
  });

  test('chapitre préparé terminé : plus aucune commande ; « Première vraie partie » continue', () => {
    expect(tutorialFinishedReason(chapter, true)).toBe(TUTORIAL_FINISHED_REASON);
    expect(tutorialFinishedReason(chapter, false)).toBeNull();
    expect(tutorialFinishedReason({ ...chapter, seed: undefined }, true)).toBeNull();
  });

  test('chaque action principale est reconnue dans sa commande', () => {
    expect(commandAction({ type: 'LAUNCH_PROBE' })).toBe(ActionType.LAUNCH_PROBE);
    expect(commandAction({ type: 'SCAN' })).toBe(ActionType.SCAN_SECTOR);
    expect(commandAction({ type: 'ANALYZE' })).toBe(ActionType.ANALYZE_DATA);
    expect(commandAction({ type: 'RESEARCH_TECH' })).toBe(ActionType.RESEARCH_TECH);
    expect(commandAction({ type: 'ORBIT', planetId: 'mars' })).toBe(ActionType.ORBIT);
    expect(commandAction({ type: 'LAND', planetId: 'mars' })).toBe(ActionType.LAND);
    expect(commandAction({ type: 'PLAY_CARD', cardId: 'c' })).toBe(ActionType.PLAY_CARD);
    expect(commandAction({ type: 'PASS', cardsToKeep: [] })).toBe(ActionType.PASS);
    expect(commandAction({ type: 'END_TURN' })).toBe('END_TURN');
    expect(commandAction({ type: 'BUY_CARD' })).toBeNull();
  });
});

describe('textes du tutoriel', () => {
  const source = [
    'Commentaire d\'en-tête ignoré',
    '## Étape orpheline {#orpheline}',
    'ignorée',
    '# Sondes {#sondes}',
    'Présentation du chapitre.',
    '',
    '## Lancer une sonde {#lancer}',
    'Cliquez sur **Lancer une sonde**.',
    'Deuxième ligne.',
    '',
    '## Fin {#fin}',
    '# Scanner {#scanner}',
    '## Premier signal {#signal}',
    'Texte.',
  ].join('\r\n');

  test('chapitres, présentations et étapes, avec titres et identifiants', () => {
    const text = parseTutorialText(source);
    expect(Object.keys(text)).toEqual(['sondes', 'scanner']);
    expect(text.sondes.title).toBe('Sondes');
    expect(text.sondes.summary).toBe('Présentation du chapitre.');
    expect(Object.keys(text.sondes.steps)).toEqual(['lancer', 'fin']);
    expect(text.sondes.steps.lancer).toEqual({ title: 'Lancer une sonde', body: 'Cliquez sur **Lancer une sonde**.\nDeuxième ligne.' });
    expect(text.sondes.steps.fin.body).toBe('');
    expect(text.scanner.summary).toBe('');
    expect(text.scanner.steps.signal.body).toBe('Texte.');
  });

  test('une section manquante se voit : l\'étape est absente du texte', () => {
    const text = parseTutorialText(source);
    expect(text.sondes.steps.analyser).toBeUndefined();
    expect(parseTutorialText('')).toEqual({});
  });
});
