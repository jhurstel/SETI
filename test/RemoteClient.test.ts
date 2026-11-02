import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebSocket } from 'ws';
import { GameServer } from '../server/GameServer';
import { RemoteClient, RemoteState, Seat, SocketLike } from '../src/session/RemoteClient';
import { GamePhase } from '../src/core/types';
import { TEST_SEED } from './helpers/gameFixture';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const factory = (url: string) => new WebSocket(url) as unknown as SocketLike;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Client de test : garde le dernier état, les erreurs et la place mémorisée */
function makeClient(port: number, options: { maxRetryTime?: number } = {}) {
  const log = { state: { status: 'disconnected', entries: [] } as RemoteState, errors: [] as string[], seat: undefined as Seat | undefined };
  const client = new RemoteClient(`ws://localhost:${port}`, factory, {
    onState: state => { log.state = state; },
    onError: message => log.errors.push(message),
    onSeat: seat => { log.seat = seat; },
    retryDelays: [50, 100],
    maxRetryTime: options.maxRetryTime ?? 5000,
    timeout: 5000,
  });
  return { client, log };
}

async function until(condition: () => boolean, label: string) {
  for (let i = 0; i < 250 && !condition(); i++) await wait(20);
  if (!condition()) throw new Error(`Attente trop longue : ${label}`);
}

describe('RemoteClient (client du jeu à distance)', () => {
  let dataDir: string;
  let server: GameServer;
  let port: number;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seti-client-'));
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0, seed: TEST_SEED });
    port = await server.listen(0);
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    logSpy.mockRestore();
  });

  test('créer, rejoindre, jouer : une commande terminée, la partie reçue est déjà à jour', async () => {
    const alice = makeClient(port);
    const bob = makeClient(port);
    const aliceSeat = await alice.client.create('Alice', [{ type: 'human' }, { type: 'human' }]);
    expect(aliceSeat.playerId).toBe('player_0');
    expect(alice.log.seat).toEqual(aliceSeat);
    await until(() => alice.log.state.room?.status === 'lobby', 'salon');

    await bob.client.join(aliceSeat.code, 'Bob');
    await until(() => !!alice.log.state.game && !!bob.log.state.game, 'partie lancée');

    // Mise en place : chacun réserve à son tour ; celui dont ce n'est pas le tour est refusé
    for (let i = 0; i < 4 && bob.log.state.game!.phase === GamePhase.SETUP; i++) {
      const game = alice.log.state.game!;
      const currentId = game.players[game.currentPlayerIndex].id;
      const [active, other] = currentId === 'player_0' ? [alice, bob] : [bob, alice];
      const myCards = active.log.state.game!.players.find(p => p.id === currentId)!.cards;
      expect((await other.client.send({ type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [myCards[0].id] } })).error).toBeDefined();
      expect(await active.client.send({ type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [myCards[0].id] } })).toEqual({});
      expect(active.log.state.game!.players.find(p => p.id === currentId)!.reservedCards).toHaveLength(1);
    }
    await until(() => alice.log.state.game?.phase === GamePhase.PLAYING, 'partie commencée');
    expect(bob.log.state.entries.length).toBeGreaterThan(0);
    alice.client.close();
    bob.client.close();
    expect(alice.log.state.status).toBe('disconnected');
  });

  test('après un redémarrage du serveur, le client reprend sa place tout seul', async () => {
    const alice = makeClient(port);
    const seat = await alice.client.create('Alice', [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }]);
    await until(() => !!alice.log.state.game, 'partie lancée');
    await wait(100);

    await server.close();
    await until(() => alice.log.state.status === 'connecting', 'coupure vue');
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0 });
    await server.listen(port);

    await until(() => alice.log.state.status === 'connected', 'reconnecté');
    expect(alice.log.state.seat).toEqual(seat);
    expect((await alice.client.send({ type: 'END_TURN' })).error).toBeDefined(); // réponse du serveur : connexion active
    alice.client.close();
  });

  test('salle perdue (serveur redémarré sans ses fichiers) : place oubliée, erreur annoncée', async () => {
    const alice = makeClient(port);
    await alice.client.create('Alice', [{ type: 'human' }, { type: 'robot' }]);
    await until(() => !!alice.log.state.game, 'partie lancée');

    await server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0 });
    await server.listen(port);

    await until(() => alice.log.state.status === 'disconnected', 'refus vu');
    expect(alice.log.seat).toBeUndefined();
    expect(alice.log.state.game).toBeUndefined();
    expect(alice.log.errors).toContain('Place introuvable');
  });

  test('demandes refusées : salle inconnue, serveur injoignable, commande sans connexion', async () => {
    const client = makeClient(port);
    await expect(client.client.join('ZZZZZ', 'Bob')).rejects.toThrow('Salle introuvable');
    expect(client.log.state.status).toBe('disconnected');
    expect(await client.client.send({ type: 'END_TURN' })).toEqual({ error: 'Pas de connexion au serveur' });

    await server.close();
    const lost = makeClient(port, { maxRetryTime: 300 });
    await expect(lost.client.create('Alice', [{ type: 'human' }, { type: 'robot' }])).rejects.toThrow('Serveur injoignable');
    server = new GameServer({ publicDir: PUBLIC_DIR, robotDelay: 0 });
    port = await server.listen(0);
  });
});
