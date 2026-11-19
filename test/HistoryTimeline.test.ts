import { historyTimeline } from '../src/core/historyTimeline';
import { GameSession } from '../src/session/GameSession';
import { serializeGame, deserializeGame } from '../src/core/GamePersistence';
import { ActionType, GamePhase, HistoryEntry } from '../src/core/types';
import { AITurn, AIStep } from '../src/ai/AITurn';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const entry = (message: string, playerId = '', mainAction?: boolean, mainActionType?: ActionType): HistoryEntry =>
  ({ message, playerId, ...(mainAction ? { mainAction } : {}), ...(mainActionType ? { mainActionType } : {}) });

describe('historyTimeline : manches et tours de l\'historique', () => {
  test("manches, tours, seule l'action principale marquée (avec son type), manche terminée", () => {
    const log = [
      entry('--- DÉBUT DE LA PARTIE ---'),
      entry('réserve "X"', 'a'),
      entry('--- Manche 1 / 5 ---'),
      entry('--- Tour de A ---', 'a'),
      entry('transfère 1 donnée', 'a'),
      entry('lance une sonde', 'a', true, ActionType.LAUNCH_PROBE),
      entry('gagne 1 Média', 'b'),
      entry('--- Tour de B ---', 'b'),
      entry('gagne 1 crédit', 'b'),
      entry('--- FIN DE LA MANCHE 1 ---'),
      entry('--- Manche 2 / 5 ---'),
      entry('gain de revenus', 'a'),
      entry('--- Tour de A ---', 'a'),
    ];
    expect(historyTimeline(log)).toEqual([
      { round: 1, entryIndex: 2, complete: true, turns: [
        { playerId: 'a', entryIndex: 3, action: 'lance une sonde', actionType: ActionType.LAUNCH_PROBE },
        { playerId: 'b', entryIndex: 7 },
      ] },
      { round: 2, entryIndex: 10, complete: false, turns: [{ playerId: 'a', entryIndex: 12 }] },
    ]);
  });

  test("cible de l'action principale : planète, carte, premier secteur scanné, technologie acquise", () => {
    const step = (message: string, playerId: string, sequenceId: string, type?: ActionType): HistoryEntry =>
      ({ ...entry(message, playerId, !!type, type), sequenceId });
    const turns = historyTimeline([
      entry('--- Manche 1 / 5 ---'),
      entry('--- Tour de A ---', 'a'),
      step('paye 1 Crédit et 1 Énergie pour <strong>Mettre en orbite</strong> une sonde autour de Vénus', 'a', 's1', ActionType.ORBIT),
      entry('--- Tour de B ---', 'b'),
      step('paye 2 Énergies pour <strong>Poser une sonde</strong> sur Mars (Exploration III)', 'b', 's2', ActionType.LAND),
      entry('--- Tour de A ---', 'a'),
      step('paye 2 Crédits pour jouer "Mission Voyager 2"', 'a', 's3', ActionType.PLAY_CARD),
      entry('--- Tour de B ---', 'b'),
      step('paye 1 Crédit et 2 Énergies pour <strong>Scanner un secteur</strong>', 'b', 's4', ActionType.SCAN_SECTOR),
      step('gagne 1 Média', 'b', 'autre'),
      step('marque un signal Rouge dans le secteur Proxima Centauri, gagne 1 Donnée', 'b', 's4'),
      step('marque un signal Jaune dans le secteur Kepler 22', 'b', 's4'),
      entry('--- Tour de A ---', 'a'),
      step('paye 6 Médias pour <strong>Rechercher une technologie</strong>', 'a', 's5', ActionType.RESEARCH_TECH),
      step('fait tourner le Système Solaire (Jaune)', 'a', 's5'),
      step('acquiert technologie "Observation IV" et gagne 2 PV', 'a', 's5'),
      entry('--- Tour de B ---', 'b'),
      step('paye 2 Crédits pour <strong>Lancer une sonde</strong> depuis la Terre', 'b', 's6', ActionType.LAUNCH_PROBE),
      entry('--- Tour de A ---', 'a'),
      step('joue une carte sans nom', 'a', 's7', ActionType.PLAY_CARD),
      entry('--- Tour de B ---', 'b'),
      step('paye 6 Médias pour <strong>Rechercher une technologie</strong>', 'b', 's8', ActionType.RESEARCH_TECH),
      entry('--- Tour de A ---', 'a'),
      step('acquiert technologie "Exploration I"', 'a', 's8'),
    ])[0].turns;
    expect(turns.map(t => [t.actionType, t.target])).toEqual([
      [ActionType.ORBIT, 'Vénus'],
      [ActionType.LAND, 'Mars'],
      [ActionType.PLAY_CARD, 'Mission Voyager 2'],
      [ActionType.SCAN_SECTOR, 'Proxima Centauri'],
      [ActionType.RESEARCH_TECH, 'Observation IV'],
      [ActionType.LAUNCH_PROBE, undefined],
      [ActionType.PLAY_CARD, undefined],
      // Technologie jamais acquise pendant le tour : pas de cible
      [ActionType.RESEARCH_TECH, undefined],
      [undefined, undefined],
    ]);
  });

  test('sans en-tête de la première manche : le premier tour ouvre la manche 1', () => {
    const rounds = historyTimeline([entry('--- Tour de A ---', 'a'), entry('passe', 'a', true), entry('--- FIN DE LA MANCHE 1 ---'), entry('--- Manche 2 / 5 ---')]);
    expect(rounds.map(r => [r.round, r.entryIndex, r.turns.length, r.complete])).toEqual([[1, 0, 1, true], [2, 3, 0, false]]);
  });

  test('historique vide ou sans manche : aucune manche', () => {
    expect(historyTimeline([])).toEqual([]);
    expect(historyTimeline([entry('--- PHASE DE RÉSERVATION ---'), entry('réserve "X"', 'a')])).toEqual([]);
  });

  test('la session marque l\'action principale du joueur et celle du robot ; la sauvegarde garde la marque', async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    getPlayer(game, 'player_0').credits = 10;
    const launched = GameSession.dispatch(game, 'player_0', { type: 'LAUNCH_PROBE' });
    expect(launched.error).toBeUndefined();
    expect(launched.entries.filter(e => e.mainAction)).toHaveLength(1);
    expect(launched.entries.find(e => e.mainAction)!.message).toContain('sonde');
    expect(launched.entries.find(e => e.mainAction)!.mainActionType).toBe(ActionType.LAUNCH_PROBE);

    const transfer = GameSession.dispatch(launched.game, 'player_0', { type: 'END_TURN' });
    expect(transfer.entries.some(e => e.mainAction)).toBe(false);

    const { historyLog } = deserializeGame(JSON.stringify(serializeGame(game, launched.entries)));
    expect(historyLog.filter(e => e.mainAction)).toHaveLength(1);
    expect(historyLog.find(e => e.mainAction)!.mainActionType).toBe(ActionType.LAUNCH_PROBE);
  });

  test("robot : seule l'étape de son action principale est marquée", async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const robot = getPlayer(game, 'player_0');
    robot.type = 'robot';
    robot.credits = 10;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    type Step = Omit<Extract<AIStep, { kind: 'UPDATED' }>, 'kind'>;
    const step = (AITurn as unknown as { playMainAction(g: unknown, p: unknown, d: unknown): Step }).playMainAction(game, robot, { action: ActionType.LAUNCH_PROBE });
    const played = GameSession.applyRobotStep(game, { kind: 'UPDATED', ...step });
    logSpy.mockRestore();
    expect(played.entries.filter(e => e.mainAction)).toHaveLength(1);
    expect(played.entries[0].mainAction).toBe(true);
    expect(played.entries[0].mainActionType).toBe(ActionType.LAUNCH_PROBE);

    // Étape sans action principale (rien de neuf) : pas de marque
    const idle = GameSession.applyRobotStep(played.game, { kind: 'UPDATED', updatedGame: played.game, historyEntries: [entry('transfère 1 donnée', 'player_0')] });
    expect(idle.entries.some(e => e.mainAction)).toBe(false);
  });
});
