import { Game, GamePhase, HistoryEntry } from '../core/types';
import { setRandomState } from '../core/random';
import { uniqueId } from '../core/ids';
import { SavedGame, deserializeGame, serializeGame } from '../core/GamePersistence';
import { AITurn } from '../ai/AITurn';
import { GameSession } from './GameSession';
import { GameSetup, SeatConfig } from './GameSetup';
import { Command } from './commands';
import { viewEntries, viewFor } from './PlayerView';
import { RoomInfo, RoomStatus, SeatRequest } from './protocol';

/** Une place de la salle : sa configuration et, pour une place humaine, le jeton de celui qui l'occupe */
export interface RoomSeat extends SeatConfig {
  playerId: string;
  /** Jeton secret du joueur qui occupe la place (places humaines) */
  token?: string;
}

/** Salle sauvegardée (fichier du serveur) : places et jetons, partie et historique complets */
export interface SavedRoom {
  code: string;
  status: RoomStatus;
  seats: RoomSeat[];
  createdAt: number;
  game?: SavedGame;
}

/** Ce qu'un joueur reçoit : la salle, sa place, sa vue de la partie et l'historique qu'il peut lire */
export interface RoomView {
  room: RoomInfo;
  you: string;
  game?: Game;
  entries: HistoryEntry[];
}

const MAX_NAME = 40;

/**
 * Salle d'une partie à distance : places (humains, robots), jetons, partie et historique complet.
 * Pure : le serveur (server/) s'occupe du réseau, du rythme des robots et de l'écriture sur disque.
 * Toute modification de la partie passe par GameSession, comme dans le jeu local.
 * Pas d'annulation en ligne : elle reviendrait aussi sur les actions des autres joueurs.
 */
export class GameRoom {
  game?: Game;
  /** Historique complet (passages privés compris, sans états d'annulation) */
  log: HistoryEntry[] = [];
  /** Création des parties une à la fois : la mise en place utilise le générateur global entre deux attentes */
  private static creating: Promise<unknown> = Promise.resolve();

  private constructor(readonly code: string, readonly seats: RoomSeat[], readonly createdAt: number, public status: RoomStatus = 'lobby') {}

  /**
   * Crée une salle : le créateur prend la première place humaine. `robotNames` nomme les robots dans l'ordre
   * des places (le serveur les choisit).
   */
  static create(code: string, hostName: string, hostToken: string, requests: SeatRequest[], robotNames: string[] = []): GameRoom {
    const name = hostName.trim().slice(0, MAX_NAME);
    if (!name) throw new Error('Nom de joueur manquant');
    if (requests.length < 2 || requests.length > 4) throw new Error('Une partie se joue de 2 à 4 joueurs');
    const hostIndex = requests.findIndex(seat => seat.type === 'human');
    if (hostIndex === -1) throw new Error('Il faut au moins une place humaine');

    let robot = 0;
    const seats: RoomSeat[] = requests.map((request, index) => {
      const playerId = `player_${index}`;
      if (request.type === 'robot') {
        return { playerId, type: 'robot', aiDifficulty: request.aiDifficulty ?? 'MEDIUM', name: robotNames[robot++] ?? `Robot ${index + 1}` };
      }
      return index === hostIndex
        ? { playerId, type: 'human', name, token: hostToken }
        : { playerId, type: 'human', name: `Place ${index + 1}` };
    });
    return new GameRoom(code, seats, Date.now());
  }

  /** Arrivée d'un joueur dans le salon : il prend la première place humaine libre */
  claim(name: string, token: string): { playerId: string } | { error: string } {
    const trimmed = name.trim().slice(0, MAX_NAME);
    if (!trimmed) return { error: 'Nom de joueur manquant' };
    if (this.status !== 'lobby') return { error: 'La partie a déjà commencé' };
    if (this.seats.some(seat => seat.token && seat.name === trimmed)) return { error: 'Ce nom est déjà pris dans la salle' };
    const seat = this.seats.find(s => s.type === 'human' && !s.token);
    if (!seat) return { error: 'La salle est complète' };
    seat.name = trimmed;
    seat.token = token;
    return { playerId: seat.playerId };
  }

  /** Toutes les places humaines sont occupées */
  get isReady(): boolean {
    return this.seats.every(seat => seat.type === 'robot' || !!seat.token);
  }

  seatOf(token: string): RoomSeat | undefined {
    return token ? this.seats.find(seat => seat.token === token) : undefined;
  }

  /** Lance la partie (premier joueur tiré au hasard) quand toutes les places sont prises */
  async start(seed?: number): Promise<void> {
    if (this.status !== 'lobby') throw new Error('La partie a déjà commencé');
    if (!this.isReady) throw new Error('Toutes les places ne sont pas prises');
    const created = GameRoom.creating.then(() => GameSetup.newGame(this.seats, { seed, firstPlayer: 'random' }));
    GameRoom.creating = created.catch(() => undefined);
    const { game, entries } = await created;
    const started = GameSession.start(game);
    this.game = started.game;
    this.status = 'playing';
    this.append([...entries, ...started.entries]);
  }

  /** Commande d'un joueur (identifié par son jeton) : appliquée par la session, ou refusée */
  command(token: string, command: Command): { error?: string; notifications: string[] } {
    const seat = this.seatOf(token);
    if (!seat) return { error: 'Place inconnue', notifications: [] };
    if (!this.game || this.status !== 'playing') return { error: 'La partie n\'a pas commencé', notifications: [] };
    let result;
    try {
      result = GameSession.dispatch(this.game, seat.playerId, command);
    } catch {
      return { error: 'Commande invalide', notifications: [] };
    }
    if (result.error) return { error: result.error, notifications: [] };
    this.apply(result.game, result.entries);
    return { notifications: result.notifications };
  }

  /** Un robot doit jouer : c'est son tour et aucune interaction n'attend un joueur humain */
  get robotToPlay(): boolean {
    return this.status === 'playing' && !!this.game && GameSession.robotCanPlay(this.game);
  }

  /**
   * Une étape du robot dont c'est le tour (comme useAITurn dans le jeu local). Renvoie false s'il n'a rien
   * à faire ; le serveur rappelle cette méthode au rythme voulu tant qu'elle renvoie true.
   */
  robotStep(): { played: boolean; notifications: string[] } {
    if (!this.robotToPlay || !this.game) return { played: false, notifications: [] };
    const game = this.game;
    if (game.rngState !== undefined) setRandomState(game.rngState);
    const step = AITurn.playStep(game);
    if (step.kind === 'WAIT') return { played: false, notifications: [] };
    let result;
    if (step.kind === 'END_TURN') {
      if (game.rngState !== undefined) setRandomState(game.rngState);
      result = GameSession.applyRobotStep(game, { kind: 'END_TURN_DONE', end: AITurn.endTurn(game) });
    } else {
      result = GameSession.applyRobotStep(game, step);
    }
    if (result.error) {
      console.error(`[Salle ${this.code}] étape de robot refusée :`, result.error);
      return { played: false, notifications: [] };
    }
    this.apply(result.game, result.entries);
    return { played: result.game !== game, notifications: result.notifications };
  }

  /** Vue du joueur qui détient ce jeton (null si le jeton n'est pas de la salle) */
  viewFor(token: string, connected: (playerId: string) => boolean = () => false): RoomView | null {
    const seat = this.seatOf(token);
    if (!seat) return null;
    return {
      room: this.info(connected),
      you: seat.playerId,
      game: this.game ? viewFor(this.game, seat.playerId) : undefined,
      entries: viewEntries(this.log, seat.playerId),
    };
  }

  info(connected: (playerId: string) => boolean = () => false): RoomInfo {
    return {
      code: this.code,
      status: this.status,
      seats: this.seats.map(seat => ({
        playerId: seat.playerId,
        name: seat.name,
        type: seat.type,
        aiDifficulty: seat.aiDifficulty,
        claimed: seat.type === 'robot' || !!seat.token,
        connected: seat.type === 'robot' || connected(seat.playerId),
      })),
    };
  }

  toSaved(): SavedRoom {
    return {
      code: this.code,
      status: this.status,
      seats: this.seats.map(seat => ({ ...seat })),
      createdAt: this.createdAt,
      game: this.game ? serializeGame(this.game, this.log) : undefined,
    };
  }

  static fromSaved(saved: SavedRoom): GameRoom {
    const room = new GameRoom(saved.code, saved.seats.map(seat => ({ ...seat })), saved.createdAt, saved.status);
    if (saved.game) {
      const { game, historyLog } = deserializeGame(JSON.stringify(saved.game));
      room.game = game;
      room.log = historyLog;
    }
    return room;
  }

  private apply(game: Game, entries: HistoryEntry[]) {
    this.game = game;
    this.append(entries);
    if (game.phase === GamePhase.FINAL_SCORING) this.status = 'finished';
  }

  private append(entries: HistoryEntry[]) {
    const now = Date.now();
    this.log.push(...entries.map(({ previousState: _state, ...entry }) => ({ ...entry, id: entry.id ?? uniqueId(), timestamp: entry.timestamp ?? now })));
  }
}
