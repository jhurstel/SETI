import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebSocket } from 'ws';
import { GameServer } from '../server/GameServer';
import { ClientMessage, ServerMessage } from '../src/session/protocol';
import { GamePhase } from '../src/core/types';
import { GAME_VERSION } from '../src/core/version';
import { TEST_SEED } from './helpers/gameFixture';
import { computeStep, localRobotComputer, RobotComputer } from '../src/ai/robotCompute';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/** Client de test : envoie des messages et attend ceux du serveur */
class TestClient {
  private readonly received: ServerMessage[] = [];
  private waiters: (() => void)[] = [];
  private constructor(readonly socket: WebSocket) {
    socket.on('message', data => {
      this.received.push(JSON.parse(data.toString()) as ServerMessage);
      this.waiters.forEach(wake => wake());
    });
  }

  static async connect(port: number): Promise<TestClient> {
    const socket = new WebSocket(`ws://localhost:${port}`);
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    return new TestClient(socket);
  }

  send(message: ClientMessage | Record<string, unknown>) {
    this.socket.send(JSON.stringify(message));
  }

  /** Attend (et retire) le premier message reçu qui correspond */
  async next<T extends ServerMessage['type']>(type: T, match: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const index = this.received.findIndex(m => m.type === type && match(m as Extract<ServerMessage, { type: T }>));
      if (index !== -1) return this.received.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>;
      if (Date.now() > deadline) throw new Error(`Pas de message ${type}`);
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 200);
        this.waiters.push(() => { clearTimeout(timer); resolve(); });
      });
      this.waiters = [];
    }
  }

  /** Dernier état reçu (les précédents sont oubliés) */
  async latestState(match: (m: Extract<ServerMessage, { type: 'state' }>) => boolean = () => true) {
    let state = await this.next('state', match);
    for (let more = this.received.findIndex(m => m.type === 'state' && match(m)); more !== -1; more = this.received.findIndex(m => m.type === 'state' && match(m))) {
      state = this.received.splice(more, 1)[0] as Extract<ServerMessage, { type: 'state' }>;
    }
    return state;
  }

  close() {
    this.socket.close();
  }
}

describe('serveur du jeu à distance', () => {
  let dataDir: string;
  let server: GameServer;
  let port: number;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seti-server-'));
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0, seed: TEST_SEED });
    port = await server.listen(0);
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    logSpy.mockRestore();
  });

  test('créer, rejoindre, jouer chacun son tour, se reconnecter, reprendre après un redémarrage', async () => {
    const alice = await TestClient.connect(port);
    alice.send({ type: 'create', version: GAME_VERSION, name: 'Alice', seats: [{ type: 'human' }, { type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }] });
    const welcome = await alice.next('welcome');
    expect(welcome.playerId).toBe('player_0');
    expect(welcome.code).toMatch(/^[A-Z]{5}$/);
    const lobby = await alice.next('state');
    expect(lobby.room.status).toBe('lobby');
    expect(lobby.game).toBeUndefined();

    const bob = await TestClient.connect(port);
    bob.send({ type: 'join', version: GAME_VERSION, code: welcome.code.toLowerCase(), name: 'Bob' });
    const bobWelcome = await bob.next('welcome');
    expect(bobWelcome.playerId).toBe('player_1');

    // Salle pleine : la partie démarre ; chacun reçoit sa vue (la main de l'autre est cachée)
    const bobState = await bob.latestState(s => s.room.status === 'playing');
    expect(bobState.you).toBe('player_1');
    expect(bobState.game!.players[0].cards.every(c => c.id.startsWith('hidden-'))).toBe(true);
    expect(bobState.room.seats.map(s => [s.name, s.connected])).toEqual([['Alice', true], ['Bob', true], [expect.any(String), true]]);
    expect(bobState.entries.length).toBeGreaterThan(0);

    // Mise en place : chacun réserve une carte à son tour (le robot joue seul sur le serveur)
    const room = server.rooms.get(welcome.code)!;
    const clients = { player_0: alice, player_1: bob } as Record<string, TestClient>;
    for (let i = 0; i < 20 && room.game!.phase === GamePhase.SETUP; i++) {
      const current = room.game!.players[room.game!.currentPlayerIndex];
      if (current.type === 'robot') { await new Promise(r => setTimeout(r, 20)); continue; }
      const other = clients[current.id === 'player_0' ? 'player_1' : 'player_0'];
      other.send({ type: 'command', requestId: 100 + i, command: { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [current.cards[0].id] } } });
      expect((await other.next('ack', ack => ack.requestId === 100 + i)).error).toBeDefined();
      clients[current.id].send({ type: 'command', requestId: i, command: { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [current.cards[0].id] } } });
      expect((await clients[current.id].next('ack', ack => ack.requestId === i)).error).toBeUndefined();
      await clients[current.id].latestState(s => s.game!.players.find(p => p.id === current.id)!.reservedCards.length === 1);
    }
    for (let i = 0; i < 100 && room.robotToPlay; i++) await new Promise(r => setTimeout(r, 20));
    expect(room.game!.phase).toBe(GamePhase.PLAYING);

    // Bob perd la connexion puis reprend sa place avec son jeton
    bob.close();
    const aliceSees = await alice.latestState(s => !s.room.seats[1].connected);
    expect(aliceSees.room.seats[1].connected).toBe(false);
    const bobAgain = await TestClient.connect(port);
    bobAgain.send({ type: 'resume', version: GAME_VERSION, code: welcome.code, token: bobWelcome.token });
    expect((await bobAgain.next('welcome')).playerId).toBe('player_1');
    expect((await bobAgain.latestState()).game!.phase).toBe(GamePhase.PLAYING);

    // Redémarrage : la salle est relue sur disque, les jetons restent valables
    const savedLog = room.log.length;
    for (let i = 0; i < 50 && !fs.existsSync(path.join(dataDir, `${welcome.code}.json`)); i++) await new Promise(r => setTimeout(r, 20));
    await new Promise(r => setTimeout(r, 100));
    alice.close();
    bobAgain.close();
    await server.close();
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0 });
    port = await server.listen(0);
    expect(server.rooms.get(welcome.code)!.log).toHaveLength(savedLog);
    const aliceBack = await TestClient.connect(port);
    aliceBack.send({ type: 'resume', version: GAME_VERSION, code: welcome.code, token: welcome.token });
    expect((await aliceBack.next('welcome')).playerId).toBe('player_0');
    expect((await aliceBack.latestState()).room.status).toBe('playing');
    aliceBack.close();
  }, 30_000);

  test('refus : version incompatible, message mal formé, salle inconnue, jeton inconnu, commande hors salle', async () => {
    const client = await TestClient.connect(port);
    client.send({ type: 'create', version: '0.9.0', name: 'Alice', seats: [{ type: 'human' }, { type: 'robot' }] });
    expect((await client.next('error')).message).toContain('Version du jeu incompatible');
    client.send({ type: 'n importe quoi' });
    expect((await client.next('error')).message).toBe('Message invalide');
    client.send({ type: 'join', version: GAME_VERSION, code: 'ZZZZZ', name: 'Bob' });
    expect((await client.next('error')).message).toBe('Salle introuvable');
    client.send({ type: 'resume', version: GAME_VERSION, code: 'ZZZZZ', token: 'x' });
    expect((await client.next('error')).message).toBe('Place introuvable');
    client.send({ type: 'command', command: { type: 'END_TURN' } });
    expect((await client.next('ack')).error).toContain('Rejoignez');
    client.send({ type: 'create', version: GAME_VERSION, name: 'Alice', seats: [{ type: 'human' }] });
    expect((await client.next('error')).message).toContain('de 2 à 4 joueurs');
    client.close();
  });

  test('une partie contre un robot démarre aussitôt et le robot joue sur le serveur', async () => {
    const client = await TestClient.connect(port);
    client.send({ type: 'create', version: GAME_VERSION, name: 'Alice', seats: [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }] });
    const welcome = await client.next('welcome');
    const state = await client.latestState(s => s.room.status === 'playing');
    expect(state.game!.players.map(p => p.type)).toEqual(['human', 'robot']);
    const room = server.rooms.get(welcome.code)!;
    for (let i = 0; i < 100 && room.robotToPlay; i++) await new Promise(r => setTimeout(r, 20));
    expect(room.robotToPlay).toBe(false);
    expect(room.game!.players[room.game!.currentPlayerIndex].type).toBe('human');
    client.close();
  });
  test('robots calculés ailleurs : un calcul à la fois par salle, recalcul si la partie change, panne sans arrêt du serveur', async () => {
    await server.close();
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    const robots: RobotComputer = {
      playStep: async game => {
        calls++;
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 5));
        active--;
        // 1er calcul : la partie de la salle change pendant le calcul (commande d'un joueur) ; 2e : panne
        if (calls === 1) {
          const room = [...server.rooms.values()].find(r => r.game === game)!;
          room.game = { ...room.game! };
        }
        if (calls === 2) throw new Error('panne du calcul');
        return computeStep(game);
      },
      endTurn: localRobotComputer.endTurn,
    };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0, seed: TEST_SEED, robots });
    port = await server.listen(0);
    try {
      const client = await TestClient.connect(port);
      // Le robot commence (premier joueur : place 2) : il réserve sa carte de mise en place
      client.send({ type: 'create', version: GAME_VERSION, name: 'Alice', seats: [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }], firstPlayer: 1 });
      await client.next('welcome');
      for (let i = 0; i < 100 && calls < 2; i++) await new Promise(r => setTimeout(r, 20));
      for (let i = 0; i < 100 && !errorSpy.mock.calls.length; i++) await new Promise(r => setTimeout(r, 20));
      // Partie changée : l'étape abandonnée est recalculée ; la panne est notée, le serveur répond toujours
      expect(calls).toBe(2);
      expect(maxActive).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('étape de robot impossible'), expect.any(Error));
      expect((await fetch(`http://localhost:${port}/health`)).ok).toBe(true);
      client.close();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
