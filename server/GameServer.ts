import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { randomInt, randomUUID } from 'crypto';
import { promises as fs, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { AddressInfo } from 'net';
import * as path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { DataLoader } from '../src/core/DataLoader';
import { GAME_VERSION } from '../src/core/version';
import { GameRoom, SavedRoom } from '../src/session/GameRoom';
import { ClientMessage, RoomSummary, ServerMessage, isCompatibleVersion, parseClientMessage } from '../src/session/protocol';

export interface GameServerOptions {
  /** Dossier des données du jeu (public/ : cartes) */
  publicDir: string;
  /** Dossier où chaque salle est enregistrée (un fichier JSON par salle) ; absent : rien n'est écrit */
  dataDir?: string;
  /** Délai entre deux étapes d'un robot (ms), 1,5 s comme dans le jeu local */
  robotDelay?: number;
  /** Graine des parties (tests) ; absente : tirée au hasard */
  seed?: number;
  /** Origines des pages autorisées à se connecter (ex. https://seti.netlify.app) ; vide : toutes */
  allowedOrigins?: string[];
}

/** Lettres des codes de salle (sans I, O ni chiffres, faciles à dicter) */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROBOT_NAMES = ['R2-D2', 'C-3PO', 'HAL 9000', 'Wall-E', 'T-800', 'Data', 'Bender', 'Marvin', 'Bishop', 'GLaDOS', 'Auto', 'EVE'];
const MAX_MESSAGE = 64 * 1024;
/** Liste des salles : un salon resté sans joueurs plus d'un jour n'y figure plus */
const LOBBY_LISTED_FOR = 24 * 60 * 60 * 1000;
const MAX_LISTED_ROOMS = 30;

/** Une connexion : la salle et la place qu'elle occupe, une fois arrivée */
interface Client {
  socket: WebSocket;
  code?: string;
  token?: string;
  alive: boolean;
}

/**
 * Serveur du jeu à distance : salles avec un code, places par jeton (reconnexion), robots joués sur le serveur,
 * salles enregistrées sur disque. Toute la règle passe par GameRoom (donc par GameSession).
 */
export class GameServer {
  readonly rooms = new Map<string, GameRoom>();
  private readonly clients = new Set<Client>();
  private readonly robotTimers = new Map<string, NodeJS.Timeout>();
  private readonly http: Server;
  private readonly wss: WebSocketServer;
  private heartbeat?: NodeJS.Timeout;
  private readonly saving = new Set<string>();
  private readonly pendingSaves = new Set<string>();

  constructor(private readonly options: GameServerOptions) {
    DataLoader.setReader(file => fs.readFile(path.join(options.publicDir, file), 'utf-8'));
    this.http = createServer((req, res) => this.onHttp(req, res));
    this.wss = new WebSocketServer({
      server: this.http,
      maxPayload: MAX_MESSAGE,
      // Seules les pages du jeu (origines autorisées) peuvent se connecter ; sans liste, toutes
      verifyClient: ({ origin }: { origin: string }) => !options.allowedOrigins?.length || options.allowedOrigins.includes(origin),
    });
    this.wss.on('connection', socket => this.onConnection(socket));
    this.loadRooms();
  }

  /** Démarre l'écoute (port 0 : un port libre) et renvoie le port */
  listen(port: number): Promise<number> {
    return new Promise(resolve => {
      this.http.listen(port, () => {
        // Connexions mortes (réseau coupé sans fermeture) : détectées par un ping toutes les 30 s
        this.heartbeat = setInterval(() => this.clients.forEach(client => {
          if (!client.alive) client.socket.terminate();
          client.alive = false;
          client.socket.ping();
        }), 30_000);
        resolve((this.http.address() as AddressInfo).port);
      });
    });
  }

  async close(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.robotTimers.forEach(timer => clearTimeout(timer));
    this.robotTimers.clear();
    this.clients.forEach(client => client.socket.terminate());
    await new Promise<void>(resolve => this.wss.close(() => resolve()));
    await new Promise<void>(resolve => this.http.close(() => resolve()));
    await this.flushSaves();
  }

  /**
   * Salles listées (`GET /rooms`) : les salons qui attendent des joueurs (plus récents d'abord), puis les parties
   * en cours ; ni les parties terminées, ni les salons de plus d'un jour
   */
  listRooms(now = Date.now()): RoomSummary[] {
    const summaries = [...this.rooms.values()]
      .map(room => room.summary())
      .filter((summary): summary is RoomSummary => !!summary && (summary.status === 'playing' || now - summary.createdAt < LOBBY_LISTED_FOR));
    const order = (summary: RoomSummary) => (summary.status === 'lobby' ? 0 : 1);
    return summaries.sort((a, b) => order(a) - order(b) || b.createdAt - a.createdAt).slice(0, MAX_LISTED_ROOMS);
  }

  private onHttp(req: IncomingMessage, res: ServerResponse) {
    if (req.url === '/rooms') {
      // Lue par les pages du jeu (autre origine) : autorisée pour les origines permises, toutes sans liste
      const origin = req.headers.origin;
      const allowed = !this.options.allowedOrigins?.length ? '*' : origin && this.options.allowedOrigins.includes(origin) ? origin : undefined;
      res.writeHead(200, { 'Content-Type': 'application/json', ...(allowed ? { 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' } : {}) });
      res.end(JSON.stringify(this.listRooms()));
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: GAME_VERSION, rooms: this.rooms.size, clients: this.clients.size }));
      return;
    }
    res.writeHead(404);
    res.end();
  }

  private onConnection(socket: WebSocket) {
    const client: Client = { socket, alive: true };
    this.clients.add(client);
    socket.on('pong', () => { client.alive = true; });
    socket.on('message', data => {
      const message = parseClientMessage(data.toString());
      if (!message) return this.send(client, { type: 'error', message: 'Message invalide' });
      this.onMessage(client, message).catch(error => {
        console.error('[Serveur]', error);
        this.send(client, { type: 'error', message: 'Erreur du serveur' });
      });
    });
    socket.on('close', () => {
      this.clients.delete(client);
      if (client.code) this.broadcast(client.code);
    });
  }

  private async onMessage(client: Client, message: ClientMessage) {
    if (message.type === 'ping') return this.send(client, { type: 'pong' });
    if (message.type !== 'command' && message.type !== 'undo' && !isCompatibleVersion(message.version, GAME_VERSION)) {
      return this.send(client, { type: 'error', message: `Version du jeu incompatible (serveur ${GAME_VERSION}, client ${message.version})` });
    }
    switch (message.type) {
      case 'create': {
        const token = randomUUID();
        const robots = message.seats.filter(seat => seat.type === 'robot').length;
        const names = [...ROBOT_NAMES].sort(() => Math.random() - 0.5).slice(0, robots);
        let room: GameRoom;
        try {
          room = GameRoom.create(this.newCode(), message.name, token, message.seats, names, message.firstPlayer);
        } catch (error) {
          return this.send(client, { type: 'error', message: (error as Error).message });
        }
        this.rooms.set(room.code, room);
        return this.enter(client, room, token);
      }
      case 'join': {
        const room = this.rooms.get(message.code);
        if (!room) return this.send(client, { type: 'error', message: 'Salle introuvable' });
        const token = randomUUID();
        const claimed = room.claim(message.name, token);
        if ('error' in claimed) return this.send(client, { type: 'error', message: claimed.error });
        return this.enter(client, room, token);
      }
      case 'resume': {
        const room = this.rooms.get(message.code);
        if (!room?.seatOf(message.token)) return this.send(client, { type: 'error', message: 'Place introuvable' });
        // Une seule connexion par place : l'ancienne (autre onglet, connexion perdue) est fermée
        this.clients.forEach(other => {
          if (other !== client && other.code === room.code && other.token === message.token) {
            other.code = undefined;
            other.socket.close(4000, 'Place reprise ailleurs');
          }
        });
        return this.enter(client, room, message.token);
      }
      case 'command': {
        const { requestId } = message;
        const room = client.code ? this.rooms.get(client.code) : undefined;
        if (!room || !client.token) return this.send(client, { type: 'ack', requestId, error: 'Rejoignez d\'abord une salle' });
        const result = room.command(client.token, message.command);
        if (result.error) return this.send(client, { type: 'ack', requestId, error: result.error });
        // L'état part avant l'accusé de réception : à sa réception, le client a déjà la partie à jour
        this.changed(room, result.notifications);
        this.send(client, { type: 'ack', requestId });
        return;
      }
      case 'undo': {
        const { requestId } = message;
        const room = client.code ? this.rooms.get(client.code) : undefined;
        if (!room || !client.token) return this.send(client, { type: 'ack', requestId, error: "Rejoignez d'abord une salle" });
        const result = room.undo(client.token, message.scope);
        if (result.error) return this.send(client, { type: 'ack', requestId, error: result.error });        this.changed(room, []);
        this.send(client, { type: 'ack', requestId });
      }
    }
  }

  /** Le client occupe sa place : il reçoit son jeton, puis l'état ; la partie démarre quand la salle est pleine */
  private async enter(client: Client, room: GameRoom, token: string) {
    client.code = room.code;
    client.token = token;
    this.send(client, { type: 'welcome', version: GAME_VERSION, code: room.code, token, playerId: room.seatOf(token)!.playerId });
    if (room.status === 'lobby' && room.isReady) {
      await room.start(this.options.seed);
    }
    this.changed(room, []);
  }

  /** Après un changement : chacun reçoit sa vue, la salle est enregistrée, les robots reprennent */
  private changed(room: GameRoom, notifications: string[]) {
    this.broadcast(room.code, notifications);
    this.save(room);
    this.scheduleRobot(room);
  }

  private scheduleRobot(room: GameRoom) {
    if (this.robotTimers.has(room.code) || !room.robotToPlay) return;
    this.robotTimers.set(room.code, setTimeout(() => {
      this.robotTimers.delete(room.code);
      const step = room.robotStep();
      if (step.played) this.changed(room, step.notifications);
    }, this.options.robotDelay ?? 1500));
  }

  private broadcast(code: string, notifications: string[] = []) {
    const room = this.rooms.get(code);
    if (!room) return;
    const connected = (playerId: string) => [...this.clients].some(c => c.code === code && c.token && room.seatOf(c.token)?.playerId === playerId);
    this.clients.forEach(client => {
      if (client.code !== code || !client.token) return;
      const view = room.viewFor(client.token, connected);
      if (!view) return;
      this.send(client, { type: 'state', ...view });
      if (notifications.length > 0) this.send(client, { type: 'notification', messages: notifications });
    });
  }

  private send(client: Client, message: ServerMessage) {
    if (client.socket.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(message));
  }

  private newCode(): string {
    for (;;) {
      const code = Array.from({ length: 5 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('');
      if (!this.rooms.has(code)) return code;
    }
  }

  // --- Enregistrement des salles ---

  /**
   * Enregistre la salle. Une écriture à la fois par salle : un changement pendant une écriture en relance
   * une seule à la fin, avec l'état le plus récent.
   */
  private save(room: GameRoom) {
    const { dataDir } = this.options;
    if (!dataDir) return;
    if (this.saving.has(room.code)) {
      this.pendingSaves.add(room.code);
      return;
    }
    this.saving.add(room.code);
    const file = path.join(dataDir, `${room.code}.json`);
    // Écriture dans un fichier temporaire puis renommage : jamais de fichier à moitié écrit
    const tmp = `${file}.tmp`;
    fs.writeFile(tmp, JSON.stringify(room.toSaved()))
      .then(() => fs.rename(tmp, file))
      .catch(error => console.error(`[Serveur] enregistrement de la salle ${room.code} impossible :`, error))
      .finally(() => {
        this.saving.delete(room.code);
        if (this.pendingSaves.delete(room.code)) this.save(room);
      });
  }

  /** Attend la fin des écritures en cours (arrêt du serveur) */
  private async flushSaves(): Promise<void> {
    for (let i = 0; i < 200 && this.saving.size > 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
  }

  private loadRooms() {
    const { dataDir } = this.options;
    if (!dataDir) return;
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    for (const file of readdirSync(dataDir).filter(name => name.endsWith('.json'))) {
      try {
        const room = GameRoom.fromSaved(JSON.parse(readFileSync(path.join(dataDir, file), 'utf-8')) as SavedRoom);
        this.rooms.set(room.code, room);
        this.scheduleRobot(room);
      } catch (error) {
        console.error(`[Serveur] salle ${file} illisible :`, error);
      }
    }
  }
}
