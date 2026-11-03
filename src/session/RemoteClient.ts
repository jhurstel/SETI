import { Game, HistoryEntry } from '../core/types';
import { GAME_VERSION } from '../core/version';
import { Command } from './commands';
import { ClientMessage, RoomInfo, SeatRequest, ServerMessage } from './protocol';

/** Ce dont le client a besoin d'une WebSocket (celle du navigateur, ou `ws` dans les tests) */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type SocketFactory = (url: string) => SocketLike;

/** Place occupée dans une salle : de quoi la reprendre (rechargement de la page, coupure) */
export interface Seat {
  url: string;
  code: string;
  token: string;
  playerId: string;
}

export interface RemoteState {
  /** connecting : (re)connexion en cours ; connected : à jour ; disconnected : coupé, sans reprise automatique */
  status: 'connecting' | 'connected' | 'disconnected';
  seat?: Seat;
  room?: RoomInfo;
  /** Vue de la partie pour ce joueur (absente dans le salon) */
  game?: Game;
  entries: HistoryEntry[];
}

export interface RemoteClientOptions {
  /** Appelé à chaque changement d'état (connexion, salle, partie) */
  onState: (state: RemoteState) => void;
  /** Annonces de la partie (découverte d'une espèce…) */
  onNotifications?: (messages: string[]) => void;
  /** Erreur qui ne répond à aucune demande (ex. place reprise ailleurs) */
  onError?: (message: string) => void;
  /** Nouvelle place obtenue : à mémoriser pour la reprendre */
  onSeat?: (seat: Seat | undefined) => void;
  /** Délais entre deux tentatives de reconnexion (ms) ; le dernier se répète jusqu'à `maxRetryTime` */
  retryDelays?: number[];
  /** Durée maximale des tentatives de reconnexion (ms) ; un serveur Render endormi met environ une minute à répondre */
  maxRetryTime?: number;
  /** Délai d'attente d'une réponse du serveur (ms) */
  timeout?: number;
}

type Hello = { resolve: (seat: Seat) => void; reject: (error: Error) => void };

/**
 * Client du jeu à distance (sans React) : connexion au serveur, création ou arrivée dans une salle,
 * reprise de sa place après une coupure, envoi des commandes. Chaque commande attend l'accusé de réception
 * du serveur, envoyé après l'état qui en découle : quand `send` se termine, la partie reçue est à jour.
 */
export class RemoteClient {
  private socket?: SocketLike;
  private state: RemoteState = { status: 'disconnected', entries: [] };
  private hello?: Hello;
  /** Demande d'une place envoyée (création, arrivée, reprise), en attente du message `welcome` */
  private awaitingWelcome = false;
  private readonly pending = new Map<number, (result: { error?: string }) => void>();
  private nextRequestId = 1;
  private closedByUser = false;
  private retryStart = 0;
  private retryCount = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly url: string, private readonly createSocket: SocketFactory, private readonly options: RemoteClientOptions) {}

  get current(): RemoteState {
    return this.state;
  }

  /** Crée une salle (`seats` : places dans l'ordre, la première humaine est celle du créateur) */
  create(name: string, seats: SeatRequest[]): Promise<Seat> {
    return this.open({ type: 'create', version: GAME_VERSION, name, seats });
  }

  /** Rejoint une salle avec son code */
  join(code: string, name: string): Promise<Seat> {
    return this.open({ type: 'join', version: GAME_VERSION, code, name });
  }

  /** Reprend une place (jeton gardé de la connexion précédente) */
  resume(seat: Pick<Seat, 'code' | 'token'>): Promise<Seat> {
    return this.open({ type: 'resume', version: GAME_VERSION, code: seat.code, token: seat.token });
  }

  /** Envoie une commande ; se termine quand le serveur l'a traitée (état à jour) ou refusée */
  send(command: Command): Promise<{ error?: string }> {
    const socket = this.socket;
    if (!socket || socket.readyState !== 1 || this.state.status !== 'connected') {
      return Promise.resolve({ error: 'Pas de connexion au serveur' });
    }
    const requestId = this.nextRequestId++;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ error: 'Le serveur ne répond pas' });
      }, this.options.timeout ?? 15_000);
      this.pending.set(requestId, result => { clearTimeout(timer); resolve(result); });
      this.write({ type: 'command', command, requestId });
    });
  }

  /** Quitte la salle (la place reste réservée sur le serveur, reprenable avec son jeton) */
  close(): void {
    this.closedByUser = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.socket?.close();
    this.socket = undefined;
    this.failPending('Déconnecté');
    this.update({ status: 'disconnected', seat: undefined, room: undefined, game: undefined, entries: [] });
  }

  private open(message: Extract<ClientMessage, { type: 'create' | 'join' | 'resume' }>): Promise<Seat> {
    this.closedByUser = false;
    this.retryStart = Date.now();
    this.retryCount = 0;
    return new Promise<Seat>((resolve, reject) => {
      this.hello?.reject(new Error('Demande remplacée'));
      this.hello = { resolve, reject };
      this.connect(message);
    });
  }

  private connect(message: Extract<ClientMessage, { type: 'create' | 'join' | 'resume' }>) {
    this.socket?.close();
    this.update({ status: 'connecting' });
    let socket: SocketLike;
    try {
      socket = this.createSocket(this.url);
    } catch (error) {
      this.retryOrFail(message, `Connexion impossible : ${(error as Error).message}`);
      return;
    }
    this.socket = socket;
    let opened = false;
    socket.onopen = () => {
      opened = true;
      this.awaitingWelcome = true;
      this.write(message);
    };
    socket.onmessage = event => this.receive(String(event.data));
    socket.onerror = () => { /* suivi de onclose */ };
    socket.onclose = event => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.awaitingWelcome = false;
      this.failPending('Connexion perdue');
      if (event.code === 4000) {
        // Place reprise depuis un autre onglet ou appareil : pas de reprise automatique
        this.update({ status: 'disconnected' });
        this.options.onError?.('Votre place a été reprise depuis une autre fenêtre.');
        return;
      }
      const seat = this.state.seat;
      // Une place déjà obtenue se reprend avec son jeton ; sinon on retente la demande d'origine
      const retry = seat ? { type: 'resume' as const, version: GAME_VERSION, code: seat.code, token: seat.token } : message;
      this.retryOrFail(retry, opened ? 'Connexion perdue' : 'Serveur injoignable');
    };
  }

  private retryOrFail(message: Extract<ClientMessage, { type: 'create' | 'join' | 'resume' }>, reason: string) {
    const delays = this.options.retryDelays ?? [1000, 2000, 5000];
    const elapsed = Date.now() - this.retryStart;
    if (this.closedByUser || elapsed > (this.options.maxRetryTime ?? 120_000)) {
      this.update({ status: 'disconnected' });
      this.hello?.reject(new Error(reason));
      this.hello = undefined;
      return;
    }
    // Une nouvelle coupure après une connexion réussie repart de zéro
    if (this.state.seat && !this.hello) this.retryStart = Date.now();
    const delay = delays[Math.min(this.retryCount++, delays.length - 1)];
    this.update({ status: 'connecting' });
    this.retryTimer = setTimeout(() => this.connect(message), delay);
  }

  private receive(raw: string) {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case 'welcome': {
        const seat: Seat = { url: this.url, code: message.code, token: message.token, playerId: message.playerId };
        this.retryCount = 0;
        this.awaitingWelcome = false;
        this.update({ status: 'connected', seat });
        this.options.onSeat?.(seat);
        this.hello?.resolve(seat);
        this.hello = undefined;
        break;
      }
      case 'state':
        this.update({ room: message.room, game: message.game, entries: message.entries });
        break;
      case 'notification':
        this.options.onNotifications?.(message.messages);
        break;
      case 'ack': {
        const resolve = message.requestId !== undefined ? this.pending.get(message.requestId) : undefined;
        if (resolve) {
          this.pending.delete(message.requestId!);
          resolve(message.error ? { error: message.error } : {});
        } else if (message.error) {
          this.options.onError?.(message.error);
        }
        break;
      }
      case 'error':
        if (this.awaitingWelcome) {
          // Demande refusée (salle introuvable, serveur redémarré, version…) : pas de reprise automatique
          const hello = this.hello;
          this.hello = undefined;
          this.awaitingWelcome = false;
          this.closedByUser = true;
          this.socket?.close();
          this.socket = undefined;
          if (message.message === 'Place introuvable') this.options.onSeat?.(undefined);
          this.update({ status: 'disconnected', seat: undefined, room: undefined, game: undefined, entries: [] });
          if (hello) hello.reject(new Error(message.message));
          else this.options.onError?.(message.message);
        } else {
          this.options.onError?.(message.message);
        }
        break;
    }
  }

  private write(message: ClientMessage) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message));
  }

  private failPending(error: string) {
    this.pending.forEach(resolve => resolve({ error }));
    this.pending.clear();
  }

  private update(change: Partial<RemoteState>) {
    this.state = { ...this.state, ...change };
    this.options.onState(this.state);
  }
}
