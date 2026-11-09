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

/**
 * Connexions qu'on peut rendre muettes (rien n'est plus reçu ni envoyé, sans fermeture) : une connexion
 * à moitié ouverte, comme après une veille de l'ordinateur ou un changement de réseau
 */
function mutableFactory() {
  const control = { muted: false, opened: 0 };
  const create = (url: string): SocketLike => {
    const ws = new WebSocket(url);
    control.opened++;
    const socket: SocketLike = {
      get readyState() { return ws.readyState; },
      send: data => { if (!control.muted) ws.send(data); },
      close: (code, reason) => ws.close(code, reason),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    ws.onopen = event => socket.onopen?.(event);
    ws.onmessage = event => { if (!control.muted) socket.onmessage?.(event); };
    ws.onclose = event => socket.onclose?.(event);
    ws.onerror = event => socket.onerror?.(event);
    return socket;
  };
  return { control, create };
}

/** Client de test : garde le dernier état, les erreurs et la place mémorisée */
function makeClient(port: number, options: { maxRetryTime?: number; retryDelays?: number[]; heartbeat?: number; createSocket?: (url: string) => SocketLike } = {}) {
  const log = { state: { status: 'disconnected', entries: [] } as RemoteState, errors: [] as string[], seat: undefined as Seat | undefined };
  const client = new RemoteClient(`ws://localhost:${port}`, options.createSocket ?? factory, {
    onState: state => { log.state = state; },
    onError: message => log.errors.push(message),
    onSeat: seat => { log.seat = seat; },
    retryDelays: options.retryDelays ?? [50, 100],
    maxRetryTime: options.maxRetryTime ?? 5000,
    timeout: 5000,
    heartbeat: options.heartbeat ?? 0,
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

  test('premier joueur choisi, puis annulation de sa dernière action par le serveur', async () => {
    const alice = makeClient(port);
    await alice.client.create('Alice', [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }], 0);
    await until(() => !!alice.log.state.game, 'partie lancée');
    expect(alice.log.state.game!.firstPlayerIndex).toBe(0);
    const myCards = () => alice.log.state.game!.players[0].cards;
    expect(await alice.client.send({ type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [myCards()[0].id] } })).toEqual({});
    await until(() => {
      const game = alice.log.state.game!;
      return game.phase === GamePhase.PLAYING && game.currentPlayerIndex === 0;
    }, 'tour d\'Alice');
    expect(alice.log.state.undo).toEqual({ last: false, turn: false });
    expect(await alice.client.undo('last')).toEqual({ error: 'Rien à annuler' });

    expect(await alice.client.send({ type: 'LAUNCH_PROBE' })).toEqual({});
    expect(alice.log.state.game!.players[0].probes).toHaveLength(1);
    expect(alice.log.state.undo).toEqual({ last: true, turn: false });
    const entries = alice.log.state.entries.length;

    expect(await alice.client.undo('last')).toEqual({});
    expect(alice.log.state.game!.players[0].probes).toHaveLength(0);
    expect(alice.log.state.entries.length).toBeLessThan(entries);
    expect(alice.log.state.undo).toEqual({ last: false, turn: false });
    alice.client.close();
    expect(await alice.client.undo('last')).toEqual({ error: 'Pas de connexion au serveur' });
  });

  test('connexion muette (veille, réseau changé) : détectée par le battement de cœur, place reprise', async () => {
    const sockets = mutableFactory();
    const alice = makeClient(port, { heartbeat: 150, createSocket: sockets.create });
    const seat = await alice.client.create('Alice', [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }]);
    await until(() => !!alice.log.state.game, 'partie lancée');
    // Le serveur répond aux pings : la connexion reste ouverte
    await wait(400);
    await until(() => alice.log.state.status === 'connected', 'connexion gardée');
    const opened = sockets.control.opened;

    sockets.control.muted = true;
    await until(() => alice.log.state.status === 'connecting', 'coupure détectée');
    sockets.control.muted = false;
    await until(() => alice.log.state.status === 'connected', 'reconnecté');
    expect(sockets.control.opened).toBeGreaterThan(opened);
    expect(alice.log.state.seat).toEqual(seat);
    expect(alice.log.state.game).toBeDefined();
    alice.client.close();
  });

  test('retour du réseau : reprise immédiate sans attendre le délai de la tentative suivante', async () => {
    const alice = makeClient(port, { retryDelays: [10_000] });
    const creating = alice.client.create('Alice', [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EASY' }]);
    // Connexion en cours d'ouverture, aucune tentative en attente : rien à faire
    alice.client.reconnectNow();
    const seat = await creating;
    await until(() => !!alice.log.state.game, 'partie lancée');
    // Connexion ouverte : simple vérification par un ping
    alice.client.reconnectNow();
    await wait(50);
    expect(alice.log.state.status).toBe('connected');

    await server.close();
    await until(() => alice.log.state.status === 'connecting', 'coupure vue');
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0 });
    await server.listen(port);
    alice.client.reconnectNow();
    await until(() => alice.log.state.status === 'connected', 'reconnecté sans attendre');
    expect(alice.log.state.seat).toEqual(seat);

    // Quitter pendant qu'une reprise attend : elle est abandonnée
    await server.close();
    await until(() => alice.log.state.status === 'connecting', 'nouvelle coupure vue');
    server = new GameServer({ publicDir: PUBLIC_DIR, dataDir, robotDelay: 0 });
    await server.listen(port);
    alice.client.close();
    // Après avoir quitté la salle : rien
    alice.client.reconnectNow();
    await wait(50);
    expect(alice.log.state.status).toBe('disconnected');
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
