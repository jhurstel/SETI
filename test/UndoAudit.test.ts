import { GameRoom } from '../src/session/GameRoom';
import { GameSession, DispatchResult } from '../src/session/GameSession';
import { SessionJournal } from '../src/session/SessionJournal';
import { Command } from '../src/session/commands';
import { viewFor } from '../src/session/PlayerView';
import { REVELATION_REASON } from '../src/session/Revelation';
import { CardSystem } from '../src/systems/CardSystem';
import { Game, GamePhase, HistoryEntry } from '../src/core/types';
import { computeEndTurn, computeStep } from '../src/ai/robotCompute';
import { deserializeGame, serializeGame } from '../src/core/GamePersistence';
import { findTurnUndoPoint } from '../src/core/TurnUndo';
import { createTestGame, getPlayer, mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

/**
 * Non-régression des écarts relevés par le changement OpenSpec « annulation-fiable » entre ce que l'annulation
 * annonce (infobulles, documentation, spec) et ce qu'elle faisait : barrière d'information en ligne et en annulation
 * stricte, dernière commande (même sans entrée d'historique), pas d'annulation pendant le tour d'un robot.
 */

// --- Jeu en ligne : salle de 2 humains et d'un robot (comme test/OnlineUndo.test.ts) ---

const SEATS = [{ type: 'human' as const }, { type: 'human' as const }, { type: 'robot' as const, aiDifficulty: 'EASY' as const }];
const tokenOf = (room: GameRoom, playerId: string) => room.seats.find(s => s.playerId === playerId)!.token!;
const current = (room: GameRoom) => room.game!.players[room.game!.currentPlayerIndex];

async function playRobots(room: GameRoom) {
  for (let i = 0; i < 300 && room.robotToPlay; i++) {
    if (!(await room.robotStep()).played) break;
  }
}

async function playingRoom(): Promise<GameRoom> {
  const room = GameRoom.create('ABCDE', 'Alice', 'tok-alice', SEATS, ['HAL'], 0);
  room.claim('Bob', 'tok-bob');
  const fetchSpy = mockFetchFromPublic();
  try {
    await room.start(TEST_SEED);
  } finally {
    fetchSpy.mockRestore();
  }
  for (let i = 0; i < 10 && room.game!.phase === GamePhase.SETUP; i++) {
    await playRobots(room);
    if (room.game!.phase !== GamePhase.SETUP) break;
    const player = current(room);
    expect(room.command(tokenOf(room, player.id), { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [player.cards[0].id] } }).error).toBeUndefined();
  }
  await playRobots(room);
  expect(room.game!.phase).toBe(GamePhase.PLAYING);
  expect(current(room).type).toBe('human');
  return room;
}

/** Commande acceptée par la salle */
function play(room: GameRoom, token: string, command: Command) {
  expect(room.command(token, command).error).toBeUndefined();
}

describe('Barrière d\'information en ligne', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  test('carte piochée face cachée (échange contre une carte, pioche) : l\'annulation est refusée', async () => {
    const room = await playingRoom();
    const active = current(room);
    const token = tokenOf(room, active.id);
    room.game!.players.find(p => p.id === active.id)!.credits = 10;
    const topOfDeck = room.game!.decks.cards[0];

    play(room, token, { type: 'TRADE', spend: 'credit', gain: 'card' });
    play(room, token, { type: 'CHOOSE', choice: { kind: 'CARD' } });
    expect(viewFor(room.game!, active.id).players.find(p => p.id === active.id)!.cards.map(c => c.id)).toContain(topOfDeck.id);

    expect(room.undoFor(active.id)).toEqual({ last: false, turn: false, reason: REVELATION_REASON });
    expect(room.undo(token, 'last').error).toBeDefined();
    expect(room.undo(token, 'turn').error).toBeDefined();
    // La carte reste en main : la pioche ne la reprend pas
    expect(room.game!.decks.cards[0].id).not.toBe(topOfDeck.id);
  });

  test('carte de la rangée remplacée (achat) : tous les joueurs ont vu la nouvelle carte, l\'annulation est refusée', async () => {
    const room = await playingRoom();
    const active = current(room);
    const other = room.game!.players.find(p => p.type === 'human' && p.id !== active.id)!;
    const token = tokenOf(room, active.id);
    room.game!.players.find(p => p.id === active.id)!.mediaCoverage = 5;
    const rowBefore = room.game!.decks.cardRow.map(c => c.id);

    play(room, token, { type: 'BUY_CARD' });
    play(room, token, { type: 'CHOOSE', choice: { kind: 'CARD', cardId: rowBefore[0] } });
    const newcomer = room.game!.decks.cardRow.find(c => !rowBefore.includes(c.id))!;
    expect(viewFor(room.game!, other.id).decks.cardRow.map(c => c.id)).toContain(newcomer.id);

    expect(room.undo(token, 'last').error).toBeDefined();
  });

  test('pile de fin de manche découverte après la passe : la passe ne s\'annule plus (documentation, R3)', async () => {
    const room = await playingRoom();
    const active = current(room);
    const token = tokenOf(room, active.id);
    const hand = CardSystem.getHandCards(room.game!.players.find(p => p.id === active.id)!);
    play(room, token, { type: 'PASS', cardsToKeep: hand.slice(0, 4).map(c => c.id) });
    expect(room.game!.interaction).toMatchObject({ type: 'CHOOSING_ROUND_CARD', playerId: active.id });

    expect(room.undoFor(active.id).last).toBe(false);
  });

  test('« Annuler » après l\'ouverture d\'un achat annule seulement l\'achat', async () => {
    const room = await playingRoom();
    const active = current(room);
    const token = tokenOf(room, active.id);
    room.game!.players.find(p => p.id === active.id)!.mediaCoverage = 5;
    play(room, token, { type: 'LAUNCH_PROBE' });
    const afterLaunch = room.game;
    play(room, token, { type: 'BUY_CARD' });
    expect(room.undo(token, 'last')).toEqual({});
    expect(room.game).toBe(afterLaunch);
  });
});

// --- Jeu local : session + journal, comme useGameSession ---

const H = 'player_0';
const R = 'player_1';

class Table {
  log: HistoryEntry[] = [];
  constructor(public game: Game) {}

  private commit(before: Game, result: DispatchResult, playerId: string, robot = false) {
    expect(result.error).toBeUndefined();
    this.game = result.game;
    this.log = SessionJournal.append(this.log, result.entries, before, [H], { after: result.game, playerId, robot });
  }

  play(command: Command, playerId = H, robot = playerId !== H) {
    this.commit(this.game, GameSession.dispatch(this.game, playerId, command), playerId, robot);
  }

  /** Une étape du robot dont c'est le tour, calculée comme useAITurn (à partir de l'état du hasard de la partie) */
  robotStep() {
    const before = this.game;
    const { step, rngState } = computeStep(before);
    if (step.kind === 'END_TURN') {
      const end = computeEndTurn(before);
      this.commit(before, GameSession.applyRobotStep(before, { kind: 'END_TURN_DONE', end: end.end }, end.rngState), R, true);
    } else {
      this.commit(before, GameSession.applyRobotStep(before, step as Parameters<typeof GameSession.applyRobotStep>[1], rngState), R, true);
    }
  }

  undo(): boolean {
    const undone = SessionJournal.undoLast(this.log);
    if (!undone) return false;
    this.game = undone.game;
    this.log = undone.log;
    return true;
  }
}

async function soloTable(strictUndo = false): Promise<Table> {
  const game = await createTestGame();
  game.currentPlayerIndex = 0;
  game.players[1].type = 'robot';
  game.players[1].aiDifficulty = 'EASY';
  getPlayer(game, H).credits = 20;
  getPlayer(game, H).mediaCoverage = 6;
  if (strictUndo) game.strictUndo = true;
  const table = new Table(GameSession.start(game).game);
  table.log = [{ message: `--- Tour de ${game.players[0].name} ---`, playerId: H }];
  return table;
}

describe('Annulation en jeu local', () => {
  test('« Annuler la dernière action » après l\'ouverture d\'un achat : seul l\'achat est annulé', async () => {
    const table = await soloTable();
    table.play({ type: 'LAUNCH_PROBE' });
    const afterLaunch = table.game;
    // Achat ouvert (fenêtre de choix), sans entrée d'historique : une entrée technique en fait un point d'annulation
    table.play({ type: 'BUY_CARD' });
    expect(table.game.interaction?.type).toBe('ACQUIRING_CARD');
    expect(table.log[table.log.length - 1]).toMatchObject({ silent: true, message: '' });

    expect(table.undo()).toBe(true);
    expect(table.game).toBe(afterLaunch);
    expect(getPlayer(table.game, H).probes).toHaveLength(1);
  });

  test('un achat ouvert puis fait s\'annule en entier (une seule séquence)', async () => {
    const table = await soloTable();
    const before = table.game;
    table.play({ type: 'BUY_CARD' });
    table.play({ type: 'CHOOSE', choice: { kind: 'CARD', cardId: table.game.decks.cardRow[0].id } });
    expect(table.undo()).toBe(true);
    expect(table.game).toBe(before);
  });

  test('carte piochée puis annulée : rejouée, la même carte revient (pioche dans l\'état, hasard rejoué à l\'identique)', async () => {
    const table = await soloTable();
    const topOfDeck = table.game.decks.cards[0];
    table.play({ type: 'TRADE', spend: 'credit', gain: 'card' });
    table.play({ type: 'CHOOSE', choice: { kind: 'CARD' } });
    expect(getPlayer(table.game, H).cards.map(c => c.id)).toContain(topOfDeck.id);
    expect(table.undo()).toBe(true);
    expect(table.game.decks.cards[0].id).toBe(topOfDeck.id);
    table.play({ type: 'TRADE', spend: 'credit', gain: 'card' });
    table.play({ type: 'CHOOSE', choice: { kind: 'CARD' } });
    expect(getPlayer(table.game, H).cards.map(c => c.id)).toContain(topOfDeck.id);
  });

  test('sans annulation stricte, la passe s\'annule encore après la découverte de la pile de fin de manche', async () => {
    const table = await soloTable();
    const hand = CardSystem.getHandCards(getPlayer(table.game, H));
    const before = table.game;
    table.play({ type: 'PASS', cardsToKeep: hand.slice(0, 4).map(c => c.id) });
    expect(table.game.interaction).toMatchObject({ type: 'CHOOSING_ROUND_CARD', playerId: H });
    expect(table.undo()).toBe(true);
    expect(table.game).toBe(before);
  });

  test('pendant le tour du robot, ↩ n\'est pas proposé (son étape serait rejouée à l\'identique)', async () => {
    const table = await soloTable();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      table.play({ type: 'LAUNCH_PROBE' });
      expect(SessionJournal.canUndoLast(table.log, table.game)).toBe(true);
      table.play({ type: 'END_TURN' });
      expect(GameSession.robotCanPlay(table.game)).toBe(true);
      table.robotStep();
      expect(GameSession.robotCanPlay(table.game)).toBe(true);
      expect(SessionJournal.canUndoLast(table.log, table.game)).toBe(false);
      // Le retour au début du tour reste possible
      expect(SessionJournal.undoTurn(table.log, H)).not.toBeNull();

      // Preuve : l'étape annulée serait rejouée à l'identique
      const afterRobot = table.game;
      expect(table.undo()).toBe(true);
      table.robotStep();
      expect(JSON.stringify(table.game.players)).toBe(JSON.stringify(afterRobot.players));
    } finally {
      logSpy.mockRestore();
    }
  });

  test('après un rechargement, la dernière action et le début du tour s\'annulent encore, entrée technique comprise', async () => {
    const table = await soloTable();
    const start = table.game;
    table.play({ type: 'LAUNCH_PROBE' });
    table.play({ type: 'TRADE', spend: 'credit', gain: 'energy' });
    table.play({ type: 'BUY_CARD' });
    const { game, historyLog } = deserializeGame(JSON.stringify(serializeGame(table.game, table.log)));
    table.game = game;
    table.log = historyLog;
    expect(table.log[table.log.length - 1].silent).toBe(true);
    expect(findTurnUndoPoint(table.log, H)!.state.players[0].probes).toHaveLength(start.players[0].probes.length);
    expect(table.undo()).toBe(true);
    expect(table.game.interaction?.type ?? 'IDLE').toBe('IDLE');
    expect(table.undo()).toBe(true);
    expect(getPlayer(table.game, H).probes).toHaveLength(1);
  });
});

describe('Annulation stricte en jeu local', () => {
  test('une pioche ne s\'annule plus, ni ce qui la précède ; la raison est donnée', async () => {
    const table = await soloTable(true);
    table.play({ type: 'LAUNCH_PROBE' });
    table.play({ type: 'TRADE', spend: 'credit', gain: 'card' });
    table.play({ type: 'CHOOSE', choice: { kind: 'CARD' } });
    expect(table.log.some(entry => entry.barrier)).toBe(true);

    expect(SessionJournal.undoLast(table.log)).toBeNull();
    expect(SessionJournal.undoTurn(table.log, H)).toBeNull();
    expect(SessionJournal.canUndoLast(table.log, table.game)).toBe(false);
    expect(SessionJournal.undoBlockedReason(table.log, table.game)).toBe(REVELATION_REASON);

    // Les commandes suivantes s'annulent, jusqu'à la barrière
    const afterDraw = table.game;
    table.play({ type: 'TRADE', spend: 'credit', gain: 'energy' });
    expect(SessionJournal.undoBlockedReason(table.log, table.game)).toBeUndefined();
    expect(SessionJournal.undoTurn(table.log, H)!.game).toBe(afterDraw);
    expect(table.undo()).toBe(true);
    expect(table.game).toBe(afterDraw);
    expect(table.undo()).toBe(false);
  });

  test('la passe ne s\'annule plus une fois la pile de fin de manche découverte', async () => {
    const table = await soloTable(true);
    const hand = CardSystem.getHandCards(getPlayer(table.game, H));
    table.play({ type: 'PASS', cardsToKeep: hand.slice(0, 4).map(c => c.id) });
    expect(table.undo()).toBe(false);
  });

  test('une carte de la rangée montrée par un robot empêche de revenir avant elle', async () => {
    const table = await soloTable(true);
    table.play({ type: 'LAUNCH_PROBE' });
    table.play({ type: 'END_TURN' });
    // Le robot achète une carte de la rangée : la carte qui la remplace est montrée au joueur
    getPlayer(table.game, R).mediaCoverage = 5;
    const rowBefore = table.game.decks.cardRow.map(c => c.id);
    // Le choix d'un robot est résolu par la session (AIController) dans la même commande
    table.play({ type: 'BUY_CARD' }, R);
    expect(table.game.decks.cardRow.map(c => c.id)).not.toEqual(rowBefore);
    expect(table.log.some(entry => entry.barrier && entry.playerId === R)).toBe(true);
    expect(SessionJournal.undoTurn(table.log, H)).toBeNull();
  });

  test('un tour de robot sans révélation laisse revenir au début du tour qu\'on vient de finir', async () => {
    const table = await soloTable(true);
    const start = table.game;
    table.play({ type: 'LAUNCH_PROBE' });
    table.play({ type: 'END_TURN' });
    // Le robot lance une sonde et finit son tour (le hasard qu'il tirerait pour décider ne compte pas)
    table.play({ type: 'LAUNCH_PROBE' }, R);
    table.play({ type: 'END_TURN' }, R);
    expect(table.game.players[table.game.currentPlayerIndex].id).toBe(H);
    expect(table.log.some(entry => entry.barrier)).toBe(false);
    expect(SessionJournal.undoTurn(table.log, H)!.game).toBe(start);
  });

  test('la barrière est gardée par la sauvegarde, avec le réglage', async () => {
    const table = await soloTable(true);
    table.play({ type: 'TRADE', spend: 'credit', gain: 'card' });
    table.play({ type: 'CHOOSE', choice: { kind: 'CARD' } });
    const { game, historyLog } = deserializeGame(JSON.stringify(serializeGame(table.game, table.log)));
    expect(game.strictUndo).toBe(true);
    expect(historyLog.some(entry => entry.barrier)).toBe(true);
    // Aucun état d'avant la barrière n'est enregistré
    const barrier = historyLog.findIndex(entry => entry.barrier);
    expect(historyLog.slice(0, barrier + 1).some(entry => entry.previousState)).toBe(false);
    expect(SessionJournal.undoLast(historyLog)).toBeNull();
  });
});
