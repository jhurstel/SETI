import { GameRoom } from '../src/session/GameRoom';
import { FirstPlayerChoice, parseClientMessage } from '../src/session/protocol';
import { GamePhase } from '../src/core/types';
import { mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

/** Salle de 2 humains (Alice, Bob) et d'un robot */
const SEATS = [{ type: 'human' as const }, { type: 'human' as const }, { type: 'robot' as const, aiDifficulty: 'EASY' as const }];

async function startedRoom(firstPlayer: FirstPlayerChoice = 'random'): Promise<GameRoom> {
  const room = GameRoom.create('ABCDE', 'Alice', 'tok-alice', SEATS, ['HAL'], firstPlayer);
  room.claim('Bob', 'tok-bob');
  const fetchSpy = mockFetchFromPublic();
  try {
    await room.start(TEST_SEED);
  } finally {
    fetchSpy.mockRestore();
  }
  return room;
}

const tokenOf = (room: GameRoom, playerId: string) => room.seats.find(s => s.playerId === playerId)!.token!;
const current = (room: GameRoom) => room.game!.players[room.game!.currentPlayerIndex];
const playerOf = (room: GameRoom, id: string) => room.game!.players.find(p => p.id === id)!;

async function playRobots(room: GameRoom) {
  for (let i = 0; i < 300 && room.robotToPlay; i++) {
    if (!(await room.robotStep()).played) break;
  }
}

/** Mise en place : chaque humain réserve sa première carte, les robots la leur */
async function finishSetup(room: GameRoom) {
  for (let i = 0; i < 10 && room.game!.phase === GamePhase.SETUP; i++) {
    await playRobots(room);
    if (room.game!.phase !== GamePhase.SETUP) break;
    const player = current(room);
    expect(room.command(tokenOf(room, player.id), { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [player.cards[0].id] } }).error).toBeUndefined();
  }
  await playRobots(room);
}

/** Partie lancée par Alice (place 1), mise en place finie : c'est à un humain de jouer */
async function playingRoom(): Promise<GameRoom> {
  const room = await startedRoom(0);
  await finishSetup(room);
  expect(room.game!.phase).toBe(GamePhase.PLAYING);
  expect(current(room).type).toBe('human');
  return room;
}

describe('GameRoom : premier joueur choisi à la création', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  test('la place demandée ouvre la partie ; « randomOther » écarte le créateur', async () => {
    for (const first of [0, 1, 2]) {
      expect((await startedRoom(first)).game!.firstPlayerIndex).toBe(first);
    }
    expect((await startedRoom('randomOther')).game!.firstPlayerIndex).not.toBe(0);
  });

  test('gardé par la sauvegarde de la salle ; une place inconnue est refusée', () => {
    const lobby = GameRoom.create('ABCDE', 'Alice', 'tok-alice', SEATS, ['HAL'], 1);
    expect(GameRoom.fromSaved(JSON.parse(JSON.stringify(lobby.toSaved()))).firstPlayer).toBe(1);
    // Ancienne sauvegarde, sans premier joueur : tiré au hasard
    const { firstPlayer: _first, ...old } = lobby.toSaved();
    expect(GameRoom.fromSaved(old).firstPlayer).toBe('random');
    expect(() => GameRoom.create('X', 'Alice', 't', SEATS, [], 3)).toThrow('Premier joueur inconnu');
    expect(() => GameRoom.create('X', 'Alice', 't', SEATS, [], 1.5)).toThrow('Premier joueur inconnu');
  });
});

describe('GameRoom : annulation en ligne', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  test("dernière action annulée : partie et historique reviennent à l'état d'avant", async () => {
    const room = await playingRoom();
    const active = current(room);
    const other = room.game!.players.find(p => p.type === 'human' && p.id !== active.id)!;
    const token = tokenOf(room, active.id);
    expect(room.undoFor(active.id)).toEqual({ last: false, turn: false });
    expect(room.undo(token, 'last')).toEqual({ error: 'Rien à annuler' });

    const before = room.game!;
    const logLength = room.log.length;
    expect(room.command(token, { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
    expect(room.undoFor(active.id)).toEqual({ last: true, turn: false });
    expect(room.viewFor(token)!.undo).toEqual({ last: true, turn: false });
    // Les autres joueurs ne peuvent pas l'annuler
    expect(room.undoFor(other.id)).toEqual({ last: false, turn: false });
    expect(room.undo(tokenOf(room, other.id), 'last')).toEqual({ error: 'Rien à annuler' });
    expect(room.undo('inconnu', 'last')).toEqual({ error: 'Place inconnue' });

    expect(room.undo(token, 'last')).toEqual({});
    expect(room.game).toBe(before);
    expect(room.log).toHaveLength(logLength);
    expect(room.undoFor(active.id).last).toBe(false);
  });

  test('retour au début du tour : toutes les actions du joueur de ce tour', async () => {
    const room = await playingRoom();
    const active = current(room);
    const token = tokenOf(room, active.id);
    const before = room.game!;
    const logLength = room.log.length;
    expect(room.command(token, { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
    const afterLaunch = room.game!;
    expect(room.command(token, { type: 'TRADE', spend: 'credit', gain: 'energy' }).error).toBeUndefined();
    expect(room.undoFor(active.id)).toEqual({ last: true, turn: true });

    // Dernière action seule : l'échange
    expect(room.undo(token, 'last')).toEqual({});
    expect(room.game).toBe(afterLaunch);
    expect(playerOf(room, active.id).probes).toHaveLength(1);

    expect(room.command(token, { type: 'TRADE', spend: 'credit', gain: 'energy' }).error).toBeUndefined();
    expect(room.undo(token, 'turn')).toEqual({});
    expect(room.game).toBe(before);
    expect(room.log).toHaveLength(logLength);
    expect(room.undo(token, 'turn')).toEqual({ error: 'Rien à annuler' });
  });

  test('tour fini : plus rien à annuler, le joueur suivant annule seulement ses propres actions', async () => {
    const room = await playingRoom();
    const active = current(room);
    const token = tokenOf(room, active.id);
    expect(room.command(token, { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
    expect(room.command(token, { type: 'END_TURN' }).error).toBeUndefined();
    expect(current(room).id).not.toBe(active.id);
    expect(room.undoFor(active.id)).toEqual({ last: false, turn: false });

    await playRobots(room);
    const next = current(room);
    expect(next.type).toBe('human');
    expect(room.command(tokenOf(room, next.id), { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
    expect(room.undoFor(next.id).last).toBe(true);
    expect(room.undoFor(active.id).last).toBe(false);
  });

  test('une étape de robot efface les annulations', async () => {
    const room = await playingRoom();
    for (let i = 0; i < 4 && current(room).type === 'human'; i++) {
      const token = tokenOf(room, current(room).id);
      expect(room.command(token, { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
      expect(room.command(token, { type: 'END_TURN' }).error).toBeUndefined();
    }
    expect(current(room).type).toBe('robot');
    expect((await room.robotStep()).played).toBe(true);
    room.game!.players.forEach(p => expect(room.undoFor(p.id)).toEqual({ last: false, turn: false }));
  });
});

describe('protocole : premier joueur, annulation, battement de cœur', () => {
  const create = (extra: object) => JSON.stringify({ type: 'create', version: '1.2.0', name: 'A', seats: [{ type: 'human' }, { type: 'human' }], ...extra });

  test('messages bien formés', () => {
    expect(parseClientMessage(create({ firstPlayer: 1 }))).toMatchObject({ type: 'create', firstPlayer: 1 });
    expect(parseClientMessage(create({ firstPlayer: 'randomOther' }))).toMatchObject({ firstPlayer: 'randomOther' });
    expect(parseClientMessage(create({}))).not.toHaveProperty('firstPlayer');
    expect(parseClientMessage(JSON.stringify({ type: 'undo', scope: 'turn', requestId: 3 }))).toEqual({ type: 'undo', scope: 'turn', requestId: 3 });
    expect(parseClientMessage(JSON.stringify({ type: 'undo', scope: 'last' }))).toEqual({ type: 'undo', scope: 'last' });
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ type: 'ping' });
  });

  test('messages refusés', () => {
    [create({ firstPlayer: 2 }), create({ firstPlayer: -1 }), create({ firstPlayer: 'premier' }), JSON.stringify({ type: 'undo', scope: 'tout' })]
      .forEach(raw => expect(parseClientMessage(raw)).toBeNull());
  });
});
