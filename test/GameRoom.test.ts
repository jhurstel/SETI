import { GameRoom } from '../src/session/GameRoom';
import { GameSession } from '../src/session/GameSession';
import { GameSetup } from '../src/session/GameSetup';
import { isCompatibleVersion, parseClientMessage } from '../src/session/protocol';
import { Command } from '../src/session/commands';
import { CardSystem } from '../src/systems/CardSystem';
import { GamePhase } from '../src/core/types';
import { GAME_VERSION } from '../src/core/version';
import { mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

const SEATS = [{ type: 'human' as const }, { type: 'human' as const }, { type: 'robot' as const, aiDifficulty: 'EASY' as const }];

/** Salle de 2 humains (Alice, Bob) et un robot, partie lancée */
async function startedRoom(seed = TEST_SEED): Promise<GameRoom> {
  const room = GameRoom.create('ABCDE', 'Alice', 'tok-alice', SEATS, ['HAL']);
  room.claim('Bob', 'tok-bob');
  const fetchSpy = mockFetchFromPublic();
  try {
    await room.start(seed);
  } finally {
    fetchSpy.mockRestore();
  }
  return room;
}

const tokenOf = (room: GameRoom, playerId: string) => room.seats.find(s => s.playerId === playerId)!.token!;
const current = (room: GameRoom) => room.game!.players[room.game!.currentPlayerIndex];

/** Les robots jouent tant qu'ils le peuvent (comme le serveur, sans attente) */
function playRobots(room: GameRoom) {
  for (let i = 0; i < 300 && room.robotToPlay; i++) {
    if (!room.robotStep().played) break;
  }
}

/** Mise en place : chaque humain réserve sa première carte, les robots la leur */
function finishSetup(room: GameRoom) {
  for (let i = 0; i < 10 && room.game!.phase === GamePhase.SETUP; i++) {
    playRobots(room);
    if (room.game!.phase !== GamePhase.SETUP) break;
    const player = current(room);
    expect(room.command(tokenOf(room, player.id), { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [player.cards[0].id] } }).error).toBeUndefined();
  }
  playRobots(room);
}

describe('GameRoom : salle de partie à distance', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  test('salon : le créateur prend la première place humaine, les autres arrivent jusqu\'à ce que la salle soit pleine', () => {
    const room = GameRoom.create('ABCDE', ' Alice ', 'tok-alice', SEATS, ['HAL']);
    expect(room.seats.map(s => [s.name, s.type])).toEqual([['Alice', 'human'], ['Place 2', 'human'], ['HAL', 'robot']]);
    expect(room.seatOf('tok-alice')!.playerId).toBe('player_0');
    expect(room.isReady).toBe(false);

    expect(room.claim('Alice', 'tok-2')).toEqual({ error: 'Ce nom est déjà pris dans la salle' });
    expect(room.claim('  ', 'tok-2')).toEqual({ error: 'Nom de joueur manquant' });
    expect(room.claim('Bob', 'tok-bob')).toEqual({ playerId: 'player_1' });
    expect(room.isReady).toBe(true);
    expect(room.claim('Carol', 'tok-carol')).toEqual({ error: 'La salle est complète' });
    expect(room.info().seats.map(s => s.claimed)).toEqual([true, true, true]);
  });

  test('création refusée : nombre de places, aucune place humaine, nom vide', () => {
    expect(() => GameRoom.create('X', 'Alice', 't', [{ type: 'human' }])).toThrow('de 2 à 4 joueurs');
    expect(() => GameRoom.create('X', 'Alice', 't', [{ type: 'robot' }, { type: 'robot' }])).toThrow('place humaine');
    expect(() => GameRoom.create('X', ' ', 't', SEATS)).toThrow('Nom de joueur manquant');
  });

  test('la partie ne démarre que salle pleine ; elle reprend les noms et les types des places', async () => {
    const lobby = GameRoom.create('ABCDE', 'Alice', 'tok-alice', SEATS, ['HAL']);
    await expect(lobby.start()).rejects.toThrow('Toutes les places');

    const room = await startedRoom();
    expect(room.status).toBe('playing');
    expect(room.game!.players.map(p => [p.name, p.type, p.aiDifficulty])).toEqual([['Alice', 'human', undefined], ['Bob', 'human', undefined], ['HAL', 'robot', 'EASY']]);
    expect(room.log.length).toBeGreaterThan(0);
    expect(room.claim('Carol', 'tok-carol')).toEqual({ error: 'La partie a déjà commencé' });
  });

  test('même graine, même partie (premier joueur et mise en place)', async () => {
    const a = await startedRoom(42);
    const b = await startedRoom(42);
    expect(b.game!.firstPlayerIndex).toBe(a.game!.firstPlayerIndex);
    expect(b.game!.players.map(p => p.cards.map(c => c.id))).toEqual(a.game!.players.map(p => p.cards.map(c => c.id)));
    expect(b.game!.decks.cardRow.map(c => c.id)).toEqual(a.game!.decks.cardRow.map(c => c.id));
  });

  test('chaque joueur agit par son jeton, seulement quand c\'est à lui ; une commande invalide est refusée', async () => {
    const room = await startedRoom();
    finishSetup(room);
    expect(room.game!.phase).toBe(GamePhase.PLAYING);

    const active = current(room);
    expect(active.type).toBe('human');
    const other = room.game!.players.find(p => p.type === 'human' && p.id !== active.id)!;
    expect(room.command(tokenOf(room, other.id), { type: 'LAUNCH_PROBE' }).error).toBeDefined();
    expect(room.command('inconnu', { type: 'LAUNCH_PROBE' }).error).toBe('Place inconnue');
    expect(room.command(tokenOf(room, active.id), { type: 'NIMPORTE' } as unknown as Command).error).toBeDefined();
    expect(room.command(tokenOf(room, active.id), { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
    expect(room.game!.players.find(p => p.id === active.id)!.probes).toHaveLength(1);
  });

  test('vues : la main et les cartes piochées d\'un adversaire sont cachées, l\'historique reste lisible', async () => {
    const room = await startedRoom();
    finishSetup(room);
    const bob = room.viewFor('tok-bob')!;
    const alice = room.game!.players[0];
    expect(bob.you).toBe('player_1');
    expect(bob.game!.players[0].cards.every(c => c.id.startsWith('hidden-'))).toBe(true);
    expect(bob.game!.players[1].cards).toEqual(room.game!.players[1].cards);
    expect(bob.game!.seed).toBeUndefined();
    expect(bob.entries).toHaveLength(room.log.length);
    expect(bob.entries.some(e => /⟦|⟧/.test(e.message))).toBe(false);
    expect(bob.entries.some(e => e.previousState)).toBe(false);
    CardSystem.getHandCards(alice).forEach(card => {
      if (!card.isRevealed) expect(JSON.stringify(bob.game)).not.toContain(`"${card.description}"`);
    });
    expect(room.viewFor('pas-un-jeton')).toBeNull();
  });

  test('le robot joue son tour par étapes jusqu\'au joueur humain suivant', async () => {
    const room = await startedRoom();
    finishSetup(room);
    // Les humains passent jusqu'à ce que le robot ait joué au moins un tour
    let robotEntries = 0;
    for (let turn = 0; turn < 6 && room.status === 'playing' && robotEntries === 0; turn++) {
      const player = current(room);
      if (player.type === 'human') {
        const keep = CardSystem.getHandCards(player).slice(0, 4).map(c => c.id);
        const round = room.game!.currentRound;
        expect(room.command(tokenOf(room, player.id), { type: 'PASS', cardsToKeep: keep }).error).toBeUndefined();
        const roundCardId = room.game!.decks.roundDecks[round]?.[0]?.id;
        if (room.game!.interaction?.type === 'CHOOSING_ROUND_CARD') {
          expect(room.command(tokenOf(room, player.id), { type: 'CHOOSE', choice: { kind: 'CARD', cardId: roundCardId } }).error).toBeUndefined();
        }
      }
      const before = room.log.length;
      playRobots(room);
      robotEntries += room.log.slice(before).filter(e => e.playerId === 'player_2').length;
    }
    expect(robotEntries).toBeGreaterThan(0);
    expect(room.robotToPlay).toBe(false);
  });

  test('sauvegarde et reprise : même partie, mêmes jetons, même historique', async () => {
    const room = await startedRoom();
    finishSetup(room);
    const restored = GameRoom.fromSaved(JSON.parse(JSON.stringify(room.toSaved())));
    expect(restored.status).toBe('playing');
    expect(restored.seatOf('tok-bob')!.playerId).toBe('player_1');
    expect(restored.log.map(e => e.message)).toEqual(room.log.map(e => e.message));
    expect(restored.game!.players.map(p => p.cards.map(c => c.id))).toEqual(room.game!.players.map(p => p.cards.map(c => c.id)));
    expect(restored.game!.rngState).toBe(room.game!.rngState);
    const token = tokenOf(restored, current(restored).id);
    expect(restored.command(token, { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
  });

  test('commande qui fait planter le moteur : refusée, la partie de la salle est inchangée', async () => {
    const room = await startedRoom();
    finishSetup(room);
    const before = room.game;
    const crash = jest.spyOn(GameSession, 'dispatch').mockImplementation(() => { throw new Error('boum'); });
    try {
      expect(room.command(tokenOf(room, current(room).id), { type: 'LAUNCH_PROBE' })).toEqual({ error: 'Commande invalide', notifications: [] });
    } finally {
      crash.mockRestore();
    }
    expect(room.game).toBe(before);
  });

  test('étape de robot refusée par la session : rien n\'est joué, la partie est inchangée', async () => {
    const room = await startedRoom();
    finishSetup(room);
    const robot = room.game!.players.find(p => p.type === 'robot')!;
    room.game = { ...room.game!, currentPlayerIndex: room.game!.players.indexOf(robot) };
    expect(room.robotToPlay).toBe(true);
    const before = room.game;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const refuse = jest.spyOn(GameSession, 'applyRobotStep').mockReturnValue({ game: before, entries: [], notifications: [], error: 'refus' });
    try {
      expect(room.robotStep()).toEqual({ played: false, notifications: [] });
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('étape de robot refusée'), 'refus');
    } finally {
      refuse.mockRestore();
      errorSpy.mockRestore();
    }
    expect(room.game).toBe(before);
  });
});

describe('GameRoom : cas limites', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  test('commande avant le lancement, deuxième lancement : refusés', async () => {
    const lobby = GameRoom.create('ABCDE', 'Alice', 'tok-alice', SEATS, ['HAL']);
    expect(lobby.command('tok-alice', { type: 'LAUNCH_PROBE' }).error).toBe("La partie n'a pas commencé");
    expect(lobby.robotStep()).toEqual({ played: false, notifications: [] });

    const room = await startedRoom();
    await expect(room.start()).rejects.toThrow('La partie a déjà commencé');
  });

  test('une création de partie ratée ne bloque pas les suivantes', async () => {
    const failing = GameRoom.create('FAIL1', 'Alice', 'tok-a', SEATS, ['HAL']);
    failing.claim('Bob', 'tok-b');
    const fail = jest.spyOn(GameSetup, 'newGame').mockRejectedValueOnce(new Error('création impossible'));
    try {
      await expect(failing.start()).rejects.toThrow('création impossible');
    } finally {
      fail.mockRestore();
    }
    expect(failing.status).toBe('lobby');

    const room = await startedRoom();
    expect(room.status).toBe('playing');
  });

  test("robot sans carte à réserver pendant la mise en place : il attend, rien n'est joué", async () => {
    const room = await startedRoom();
    const robot = room.game!.players.find(p => p.type === 'robot')!;
    robot.cards = [];
    room.game = { ...room.game!, currentPlayerIndex: room.game!.players.indexOf(robot), interaction: undefined, pendingInteractions: [] };
    expect(room.game.phase).toBe(GamePhase.SETUP);
    expect(room.robotToPlay).toBe(true);
    const before = room.game;
    expect(room.robotStep()).toEqual({ played: false, notifications: [] });
    expect(room.game).toBe(before);
  });

  test('la dernière passe de la dernière manche termine la salle', async () => {
    const room = await startedRoom();
    finishSetup(room);
    const active = current(room);
    room.game = { ...room.game!, currentRound: room.game!.maxRounds };
    room.game.players.forEach(p => { if (p.id !== active.id) p.hasPassed = true; });
    const keep = CardSystem.getHandCards(active).slice(0, 4).map(c => c.id);
    const res = room.command(tokenOf(room, active.id), { type: 'PASS', cardsToKeep: keep });
    expect(res.error).toBeUndefined();
    expect(room.game!.phase).toBe(GamePhase.FINAL_SCORING);
    expect(room.status).toBe('finished');
  });
});

describe('protocole', () => {
  test('versions compatibles : mêmes deux premiers numéros', () => {
    expect(isCompatibleVersion(GAME_VERSION, GAME_VERSION)).toBe(true);
    expect(isCompatibleVersion('1.1.9', '1.1.0')).toBe(true);
    expect(isCompatibleVersion('1.2.0', '1.1.0')).toBe(false);
    expect(isCompatibleVersion('abc', '1.1.0')).toBe(false);
  });

  test('messages reçus : bien formés ou refusés', () => {
    expect(parseClientMessage('{"type":"join","version":"1.1.0","code":"abcde","name":" Bob "}'))
      .toEqual({ type: 'join', version: '1.1.0', code: 'ABCDE', name: 'Bob' });
    expect(parseClientMessage(JSON.stringify({ type: 'create', version: '1.1.0', name: 'Alice', seats: [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EXPERT' }] })))
      .toMatchObject({ type: 'create', seats: [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EXPERT' }] });
    expect(parseClientMessage(JSON.stringify({ type: 'command', command: { type: 'END_TURN' } }))).toEqual({ type: 'command', command: { type: 'END_TURN' } });
    [
      'pas du json',
      '42',
      '{"type":"inconnu"}',
      '{"type":"join","version":"1.1.0","code":"ABCDE"}',
      JSON.stringify({ type: 'create', version: '1.1.0', name: 'A', seats: [{ type: 'robot', aiDifficulty: 'PASS' }] }),
      JSON.stringify({ type: 'create', version: '1.1.0', name: 'x'.repeat(41), seats: [] }),
      JSON.stringify({ type: 'command', command: 'END_TURN' }),
    ].forEach(raw => expect(parseClientMessage(raw)).toBeNull());
  });
});
