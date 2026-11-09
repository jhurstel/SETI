import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GameServer } from '../server/GameServer';
import { GameRoom } from '../src/session/GameRoom';
import { RoomSummary, roomsUrl } from '../src/session/protocol';
import { RemoteClient, RemoteState, SocketLike } from '../src/session/RemoteClient';
import { WebSocket } from 'ws';
import { mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('liste des salles', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  test('adresse HTTP de la liste à partir de celle du serveur', () => {
    expect(roomsUrl('wss://seti.example.com')).toBe('https://seti.example.com/rooms');
    expect(roomsUrl('ws://localhost:8787/')).toBe('http://localhost:8787/rooms');
  });

  test("résumé d'une salle : places (libres sans nom), manche une fois lancée, rien une fois finie", async () => {
    const room = GameRoom.create('ABCDE', 'Alice', 'tok-alice', [{ type: 'human' }, { type: 'human' }, { type: 'robot', aiDifficulty: 'EXPERT' }], ['HAL']);
    expect(room.summary()).toEqual({
      code: 'ABCDE',
      status: 'lobby',
      createdAt: room.createdAt,
      seats: [
        { name: 'Alice', type: 'human', aiDifficulty: undefined, claimed: true },
        { name: '', type: 'human', aiDifficulty: undefined, claimed: false },
        { name: 'HAL', type: 'robot', aiDifficulty: 'EXPERT', claimed: true },
      ],
    });
    // Aucun jeton dans le résumé
    expect(JSON.stringify(room.summary())).not.toContain('tok-');

    room.claim('Bob', 'tok-bob');
    const fetchSpy = mockFetchFromPublic();
    try {
      await room.start(TEST_SEED);
    } finally {
      fetchSpy.mockRestore();
    }
    expect(room.summary()).toMatchObject({ status: 'playing', round: 1 });
    room.status = 'finished';
    expect(room.summary()).toBeNull();
  });

  describe('serveur', () => {
    let dataDir: string;
    let server: GameServer;
    let port: number;

    beforeEach(async () => {
      dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seti-rooms-'));
      server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0, seed: TEST_SEED, allowedOrigins: ['https://seti.example.com'] });
      port = await server.listen(0);
    });

    afterEach(async () => {
      await server.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    });

    function makeClient() {
      const log = { state: { status: 'disconnected', entries: [] } as RemoteState };
      const client = new RemoteClient(`ws://localhost:${port}`, url => new WebSocket(url, { origin: 'https://seti.example.com' }) as unknown as SocketLike, {
        onState: state => { log.state = state; },
        heartbeat: 0,
      });
      return { client, log };
    }

    test('GET /rooms : salons ouverts puis parties en cours, lisible par les pages du jeu', async () => {
      const lobby = makeClient();
      await lobby.client.create('Alice', [{ type: 'human' }, { type: 'human' }]);
      await wait(20);
      const playing = makeClient();
      await playing.client.create('Carol', [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }]);
      for (let i = 0; i < 100 && !playing.log.state.game; i++) await wait(20);

      const response = await fetch(`http://localhost:${port}/rooms`, { headers: { Origin: 'https://seti.example.com' } });
      expect(response.headers.get('access-control-allow-origin')).toBe('https://seti.example.com');
      const rooms = (await response.json()) as RoomSummary[];
      expect(rooms.map(r => r.status)).toEqual(['lobby', 'playing']);
      expect(rooms[0].seats.map(s => [s.name, s.claimed])).toEqual([['Alice', true], ['', false]]);
      expect(rooms[1].round).toBe(1);

      // Autre origine : réponse sans autorisation de lecture
      const other = await fetch(`http://localhost:${port}/rooms`, { headers: { Origin: 'https://ailleurs.example.com' } });
      expect(other.headers.get('access-control-allow-origin')).toBeNull();
      await other.text();

      lobby.client.close();
      playing.client.close();
    });

    test("un salon de plus d'un jour n'est plus listé, une partie en cours si", async () => {
      const lobby = makeClient();
      await lobby.client.create('Alice', [{ type: 'human' }, { type: 'human' }]);
      const later = Date.now() + 25 * 60 * 60 * 1000;
      expect(server.listRooms()).toHaveLength(1);
      expect(server.listRooms(later)).toHaveLength(0);
      lobby.client.close();
    });
  });

  test('sans liste d\'origines, la liste est lisible par toutes les pages', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seti-rooms-'));
    const server = new GameServer({ publicDir: PUBLIC_DIR, dataDir });
    const port = await server.listen(0);
    try {
      const response = await fetch(`http://localhost:${port}/rooms`);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(await response.json()).toEqual([]);
    } finally {
      await server.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
