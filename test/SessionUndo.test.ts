import { GameSession, DispatchResult } from '../src/session/GameSession';
import { SessionJournal } from '../src/session/SessionJournal';
import { Command } from '../src/session/commands';
import { AITurn } from '../src/ai/AITurn';
import { Game, GamePhase, HistoryEntry } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const H = 'player_0';

/** Partie tenue comme dans l'interface (useGameSession) : session + journal */
class Table {
  log: HistoryEntry[] = [];
  constructor(public game: Game) {}

  private commit(before: Game, result: DispatchResult) {
    expect(result.error).toBeUndefined();
    this.game = result.game;
    this.log = SessionJournal.append(this.log, result.entries, before, [H]);
  }

  play(command: Command) {
    this.commit(this.game, GameSession.dispatch(this.game, H, command));
  }

  /** Le robot joue jusqu'à rendre la main */
  robotTurn() {
    for (let i = 0; i < 200 && GameSession.robotCanPlay(this.game); i++) {
      const step = AITurn.playStep(this.game);
      const before = this.game;
      this.commit(before, step.kind === 'END_TURN'
        ? GameSession.applyRobotStep(before, { kind: 'END_TURN_DONE', end: AITurn.endTurn(before) })
        : GameSession.applyRobotStep(before, step));
    }
  }
}

describe('Annulation avec la session (comme dans l\'interface)', () => {
  let table: Table;

  beforeEach(async () => {
    const game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.players[1].type = 'robot';
    game.players[1].aiDifficulty = 'EASY';
    getPlayer(game, H).credits = 20;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    table = new Table(GameSession.start(game).game);
    // Comme après la mise en place : le premier tour du joueur humain est annoncé dans l'historique
    table.log = [{ message: `--- Tour de ${game.players[0].name} ---`, playerId: H }];
    // Tour 1 du joueur humain, puis le robot, puis le tour 2 commence
    table.play({ type: 'LAUNCH_PROBE' });
    table.play({ type: 'END_TURN' });
    table.robotTurn();
    logSpy.mockRestore();
    expect(table.game.currentPlayerIndex).toBe(0);
    expect(table.game.phase).toBe(GamePhase.PLAYING);
  });

  test('« revenir au début du dernier tour » rétablit l\'état d\'avant la 1re action du tour', () => {
    const startOfTurn = table.game;
    const logAtStart = table.log.length;
    table.play({ type: 'TRADE', spend: 'credit', gain: 'energy' });
    table.play({ type: 'SCAN' });

    const undone = SessionJournal.undoTurn(table.log, H)!;

    expect(undone.game).toBe(startOfTurn);
    expect(undone.log).toHaveLength(logAtStart);
  });

  test('après une autre fin de tour (robot compris), le retour annule aussi le tour du robot', () => {
    const startOfTurn = table.game;
    table.play({ type: 'TRADE', spend: 'credit', gain: 'energy' });
    table.play({ type: 'END_TURN' });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    table.robotTurn();
    logSpy.mockRestore();

    // Nouveau tour humain sans action : le retour vise encore le tour précédent, qui a une action
    const undone = SessionJournal.undoTurn(table.log, H)!;
    expect(undone.game).toBe(startOfTurn);
  });

  test('au début du tour suivant, avant de rejouer : retour au début du tour qu\'on vient de finir', () => {
    // Tour 2 en cours, aucune action encore : le retour vise le tour 1 (sonde lancée, robot ensuite)
    const undone = SessionJournal.undoTurn(table.log, H)!;
    expect(undone.game.players[0].probes).toHaveLength(0);
    expect(undone.log.some(e => e.message.includes('Lancer une sonde'))).toBe(false);
  });

  test('deux tours plus tard, le tour 1 n\'est plus annulable (mémoire bornée)', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    table.play({ type: 'TRADE', spend: 'credit', gain: 'energy' });
    table.play({ type: 'END_TURN' });
    table.robotTurn();
    logSpy.mockRestore();
    const turn1Action = table.log.find(e => e.message.includes('Lancer une sonde'))!;
    expect(turn1Action.previousState).toBeUndefined();
  });
});
