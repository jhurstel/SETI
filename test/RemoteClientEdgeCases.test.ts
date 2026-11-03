import { RemoteClient, RemoteState, Seat, SocketLike } from '../src/session/RemoteClient';
import { GAME_VERSION } from '../src/core/version';

/** WebSocket simulée : le test joue le rôle du serveur */
class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code?: number }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.({}); }
  receive(message: unknown) { this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) }); }
  drop(code = 1006) { this.readyState = 3; this.onclose?.({ code }); }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const welcome = { type: 'welcome', code: 'ABCD', token: 'tok', playerId: 'player_0' };

function makeClient(options: { timeout?: number; maxRetryTime?: number; factory?: (url: string) => SocketLike } = {}) {
  const sockets: FakeSocket[] = [];
  const log = { state: { status: 'disconnected', entries: [] } as RemoteState, errors: [] as string[], notifications: [] as string[][], seats: [] as (Seat | undefined)[] };
  const client = new RemoteClient('ws://test', options.factory ?? (() => { const s = new FakeSocket(); sockets.push(s); return s; }), {
    onState: state => { log.state = state; },
    onError: message => log.errors.push(message),
    onNotifications: messages => log.notifications.push(messages),
    onSeat: seat => log.seats.push(seat),
    retryDelays: [5],
    maxRetryTime: options.maxRetryTime ?? 1000,
    timeout: options.timeout ?? 1000,
  });
  return { client, sockets, log };
}

/** Client connecté avec une place */
async function connected(options: { timeout?: number } = {}) {
  const made = makeClient(options);
  const seat = made.client.resume({ code: 'ABCD', token: 'tok' });
  made.sockets[0].open();
  made.sockets[0].receive(welcome);
  await seat;
  return made;
}

describe('RemoteClient : cas limites (serveur simulé)', () => {
  test('reprise d\'une place : demande « resume » avec code et jeton, puis connecté', async () => {
    const { client, sockets, log } = makeClient();
    const seat = client.resume({ code: 'ABCD', token: 'tok' });
    expect(client.current.status).toBe('connecting');
    sockets[0].open();
    expect(sockets[0].sent[0]).toEqual({ type: 'resume', version: GAME_VERSION, code: 'ABCD', token: 'tok' });
    sockets[0].receive(welcome);
    await expect(seat).resolves.toEqual({ url: 'ws://test', code: 'ABCD', token: 'tok', playerId: 'player_0' });
    expect(client.current.status).toBe('connected');
    expect(log.seats).toHaveLength(1);
  });

  test('commande sans réponse : « Le serveur ne répond pas » après le délai', async () => {
    const { client, sockets } = await connected({ timeout: 10 });
    const result = await client.send({ type: 'END_TURN' });
    expect(result).toEqual({ error: 'Le serveur ne répond pas' });
    expect(sockets[0].sent[1]).toMatchObject({ type: 'command', command: { type: 'END_TURN' }, requestId: 1 });
  });

  test('accusé de réception : refus rendu à la commande ; refus sans commande connue, annoncé', async () => {
    const { client, sockets, log } = await connected();
    const pending = client.send({ type: 'END_TURN' });
    sockets[0].receive({ type: 'ack', requestId: 1, error: 'Refusé' });
    await expect(pending).resolves.toEqual({ error: 'Refusé' });

    sockets[0].receive({ type: 'ack', requestId: 99, error: 'Inattendu' });
    sockets[0].receive({ type: 'ack', requestId: 98 });
    expect(log.errors).toEqual(['Inattendu']);
  });

  test('annonces transmises ; message illisible ignoré ; erreur hors demande annoncée', async () => {
    const { sockets, log, client } = await connected();
    sockets[0].receive({ type: 'notification', messages: ['Découverte'] });
    expect(log.notifications).toEqual([['Découverte']]);

    const before = client.current;
    sockets[0].receive('{pas du json');
    expect(client.current).toBe(before);

    sockets[0].receive({ type: 'error', message: 'Oups' });
    expect(log.errors).toEqual(['Oups']);
    expect(client.current.status).toBe('connected');
  });

  test('place reprise depuis une autre fenêtre (code 4000) : déconnecté, sans reprise automatique', async () => {
    const { sockets, log, client } = await connected();
    sockets[0].drop(4000);
    expect(client.current.status).toBe('disconnected');
    expect(log.errors).toEqual(['Votre place a été reprise depuis une autre fenêtre.']);
    await wait(20);
    expect(sockets).toHaveLength(1);
  });

  test('commande en attente quand la connexion tombe : « Connexion perdue », puis reprise ; fermeture : « Déconnecté »', async () => {
    const { client, sockets } = await connected();
    const lost = client.send({ type: 'END_TURN' });
    sockets[0].drop();
    await expect(lost).resolves.toEqual({ error: 'Connexion perdue' });
    await wait(20);
    expect(sockets).toHaveLength(2);

    sockets[1].open();
    sockets[1].receive(welcome);
    const closed = client.send({ type: 'END_TURN' });
    client.close();
    await expect(closed).resolves.toEqual({ error: 'Déconnecté' });
    expect(client.current.status).toBe('disconnected');
  });

  test('coupure puis place perdue sur le serveur : reprise tentée, place oubliée, erreur annoncée', async () => {
    const { sockets, log, client } = await connected();
    sockets[0].drop();
    await wait(20);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(sockets[1].sent[0]).toMatchObject({ type: 'resume', code: 'ABCD', token: 'tok' });
    sockets[1].receive({ type: 'error', message: 'Place introuvable' });
    expect(client.current.status).toBe('disconnected');
    expect(log.seats[log.seats.length - 1]).toBeUndefined();
    expect(log.errors).toEqual(['Place introuvable']);
  });

  test('WebSocket impossible à créer : la demande échoue une fois le délai de reprise dépassé', async () => {
    const { client } = makeClient({ maxRetryTime: 0, factory: () => { throw new Error('adresse invalide'); } });
    await expect(client.join('ABCD', 'Alice')).rejects.toThrow('Connexion impossible : adresse invalide');
    expect(client.current.status).toBe('disconnected');
  });
});
