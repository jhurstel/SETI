import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebSocket } from 'ws';
import { GameServer, GameServerOptions } from '../server/GameServer';
import { GameRoom, ROOM_EXPIRY } from '../src/session/GameRoom';
import { RemoteClient, SocketLike } from '../src/session/RemoteClient';
import { TEST_SEED } from './helpers/gameFixture';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SEATS = [{ type: 'human' as const }, { type: 'human' as const }];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('salles : activité et expiration (GameRoom)', () => {
  test('la dernière activité part de la création, puis suit touch', () => {
    const room = GameRoom.create('ABCDE', 'Alice', 'tok', SEATS);
    expect(room.updatedAt).toBe(room.createdAt);
    room.touch(room.createdAt + 1000);
    expect(room.updatedAt).toBe(room.createdAt + 1000);
  });

  test('expiration selon l\'état : terminée 6 h, salon 24 h, partie en cours 7 jours', () => {
    const room = GameRoom.create('ABCDE', 'Alice', 'tok', SEATS);
    const t = room.updatedAt;
    expect(room.isExpired(t + ROOM_EXPIRY.lobby)).toBe(false);
    expect(room.isExpired(t + ROOM_EXPIRY.lobby + 1)).toBe(true);
    room.status = 'playing';
    expect(room.isExpired(t + ROOM_EXPIRY.lobby + 1)).toBe(false);
    expect(room.isExpired(t + ROOM_EXPIRY.playing + 1)).toBe(true);
    room.status = 'finished';
    expect(room.isExpired(t + ROOM_EXPIRY.finished + 1)).toBe(true);
    expect(ROOM_EXPIRY.finished).toBeLessThan(ROOM_EXPIRY.lobby);
  });

  test('la sauvegarde garde la dernière activité ; une ancienne sauvegarde reprend la création', () => {
    const room = GameRoom.create('ABCDE', 'Alice', 'tok', SEATS);
    room.touch(room.createdAt + 5000);
    expect(GameRoom.fromSaved(JSON.parse(JSON.stringify(room.toSaved()))).updatedAt).toBe(room.createdAt + 5000);
    const { updatedAt: _updated, ...old } = room.toSaved();
    expect(GameRoom.fromSaved(old).updatedAt).toBe(room.createdAt);
  });
});

describe('serveur : purge des salles et limites de création', () => {
  let dataDir: string;
  let server: GameServer;
  let port: number;
  let logSpy: jest.SpyInstance;
  const clients: RemoteClient[] = [];

  async function startServer(options: Partial<GameServerOptions> = {}) {
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0, seed: TEST_SEED, ...options });
    port = await server.listen(0);
  }

  function makeClient() {
    const client = new RemoteClient(`ws://localhost:${port}`, url => new WebSocket(url) as unknown as SocketLike, { onState: () => {}, heartbeat: 0 });
    clients.push(client);
    return client;
  }

  /** Attend la fin des écritures sur disque (fichier de la salle présent) */
  async function savedFile(code: string) {
    const file = path.join(dataDir, `${code}.json`);
    for (let i = 0; i < 100 && !fs.existsSync(file); i++) await wait(10);
    await wait(20);
    return file;
  }

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seti-limits-'));
  });

  afterEach(async () => {
    clients.splice(0).forEach(client => client.close());
    await server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    logSpy.mockRestore();
  });

  test('une salle expirée sans joueur connecté est supprimée, en mémoire et sur disque', async () => {
    await startServer();
    const alice = makeClient();
    const seat = await alice.create('Alice', SEATS);
    const file = await savedFile(seat.code);
    const room = server.rooms.get(seat.code)!;
    const later = room.updatedAt + ROOM_EXPIRY.lobby + 1;

    // Alice est encore connectée : la salle reste
    expect(server.purge(later)).toEqual([]);
    expect(server.rooms.has(seat.code)).toBe(true);

    // Alice partie (le serveur voit la fermeture de sa connexion)
    alice.close();
    await wait(50);
    // Pas encore expirée : rien
    expect(server.purge(room.updatedAt + 1000)).toEqual([]);
    expect(server.purge(later)).toEqual([seat.code]);
    expect(server.rooms.has(seat.code)).toBe(false);
    for (let i = 0; i < 50 && fs.existsSync(file); i++) await wait(10);
    expect(fs.existsSync(file)).toBe(false);
  });

  test('au démarrage, une salle sauvegardée expirée est supprimée, une salle récente reprise', async () => {
    const old = GameRoom.create('OLDAA', 'Alice', 'tok-a', SEATS);
    old.touch(Date.now() - ROOM_EXPIRY.lobby - 1000);
    const recent = GameRoom.create('NEWBB', 'Bob', 'tok-b', SEATS);
    fs.writeFileSync(path.join(dataDir, 'OLDAA.json'), JSON.stringify(old.toSaved()));
    fs.writeFileSync(path.join(dataDir, 'NEWBB.json'), JSON.stringify(recent.toSaved()));

    await startServer();
    expect([...server.rooms.keys()]).toEqual(['NEWBB']);
    for (let i = 0; i < 50 && fs.existsSync(path.join(dataDir, 'OLDAA.json')); i++) await wait(10);
    expect(fs.existsSync(path.join(dataDir, 'OLDAA.json'))).toBe(false);
  });

  test('création limitée par adresse : au-delà de la limite, refus jusqu\'à la fin de la fenêtre', async () => {
    await startServer({ createLimit: { count: 2, windowMs: 60_000 } });
    // Trois places : rejoindre plus bas ne remplit pas la salle (la partie ne démarre pas pendant la fin du test)
    await makeClient().create('Alice', [...SEATS, { type: 'human' }]);
    await makeClient().create('Bob', SEATS);
    await expect(makeClient().create('Carol', SEATS)).rejects.toThrow('Trop de salles créées');
    expect(server.rooms.size).toBe(2);
    // Rejoindre reste possible
    const code = [...server.rooms.keys()][0];
    await expect(makeClient().join(code, 'Dan')).resolves.toMatchObject({ code });
  });

  test('serveur plein : refus, sauf si la purge libère une place', async () => {
    await startServer({ maxRooms: 1 });
    const alice = makeClient();
    const first = await alice.create('Alice', SEATS);
    await savedFile(first.code);
    await expect(makeClient().create('Bob', SEATS)).rejects.toThrow('Le serveur est complet');

    // La salle d'Alice, abandonnée et expirée, est purgée pour faire de la place
    alice.close();
    await wait(50);
    server.rooms.get(first.code)!.touch(Date.now() - ROOM_EXPIRY.lobby - 1000);
    const second = await makeClient().create('Bob', SEATS);
    expect([...server.rooms.keys()]).toEqual([second.code]);
  });

  test('la purge périodique tourne toute seule', async () => {
    await startServer({ purgeInterval: 20 });
    const alice = makeClient();
    const seat = await alice.create('Alice', SEATS);
    await savedFile(seat.code);
    alice.close();
    server.rooms.get(seat.code)!.touch(Date.now() - ROOM_EXPIRY.lobby - 1000);
    for (let i = 0; i < 100 && server.rooms.has(seat.code); i++) await wait(10);
    expect(server.rooms.has(seat.code)).toBe(false);
  });
});
