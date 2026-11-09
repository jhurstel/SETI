import { Game, GamePhase, HistoryEntry } from '../core/types';
import { setRandomState } from '../core/random';
import { uniqueId } from '../core/ids';
import { SavedGame, deserializeGame, serializeGame } from '../core/GamePersistence';
import { AITurn } from '../ai/AITurn';
import { GameSession } from './GameSession';
import { GameSetup, SeatConfig } from './GameSetup';
import { Command } from './commands';
import { viewEntries, viewFor } from './PlayerView';
import { FirstPlayerChoice, RoomInfo, RoomStatus, RoomSummary, SeatRequest, UndoAvailability } from './protocol';
import { trace } from '../core/trace';

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
  /** Dernière activité (absente des anciennes sauvegardes : la création) */
  updatedAt?: number;
  /** Premier joueur demandé (absent : tiré au hasard) */
  firstPlayer?: FirstPlayerChoice;
  game?: SavedGame;
}

/** Ce qu'un joueur reçoit : la salle, sa place, sa vue de la partie et l'historique qu'il peut lire */
export interface RoomView {
  room: RoomInfo;
  you: string;
  game?: Game;
  entries: HistoryEntry[];
  /** Annulations possibles pour ce joueur */
  undo: UndoAvailability;
}

/** Point d'annulation : état d'avant une commande d'un joueur, longueur de l'historique, séquences produites */
interface UndoPoint {
  playerId: string;
  state: Game;
  logLength: number;
  sequenceIds: string[];
}

const MAX_NAME = 40;

const HOUR = 60 * 60 * 1000;
/**
 * Durée d'inactivité après laquelle une salle est supprimée par le serveur : une partie terminée (le temps de voir
 * l'écran de fin), un salon où personne n'est venu, une partie abandonnée en cours de route
 */
export const ROOM_EXPIRY: Record<RoomStatus, number> = {
  finished: 6 * HOUR,
  lobby: 24 * HOUR,
  playing: 7 * 24 * HOUR,
};

/**
 * Salle d'une partie à distance : places (humains, robots), jetons, partie et historique complet.
 * Pure : le serveur (server/) s'occupe du réseau, du rythme des robots et de l'écriture sur disque.
 * Toute modification de la partie passe par GameSession, comme dans le jeu local.
 * Annulation en ligne : un joueur ne peut revenir que sur ses propres commandes de son tour en cours, tant que
 * personne d'autre n'a joué depuis (commande d'un autre joueur, étape de robot, fin de son tour) ; les points
 * d'annulation ne sont gardés qu'en mémoire (pas dans la sauvegarde de la salle).
 */
export class GameRoom {
  game?: Game;
  /** Historique complet (passages privés compris, sans états d'annulation) */
  log: HistoryEntry[] = [];
  /** Création des parties une à la fois : la mise en place utilise le générateur global entre deux attentes */
  private static creating: Promise<unknown> = Promise.resolve();
  /** Points d'annulation du joueur qui joue en ce moment (toujours d'un seul joueur, dans l'ordre) */
  private undoPoints: UndoPoint[] = [];
  /** Dernière activité (arrivée, commande, étape de robot…), notée par le serveur avec `touch` */
  updatedAt: number;

  private constructor(
    readonly code: string,
    readonly seats: RoomSeat[],
    readonly createdAt: number,
    public status: RoomStatus = 'lobby',
    readonly firstPlayer: FirstPlayerChoice = 'random',
  ) {
    this.updatedAt = createdAt;
  }

  /** Note une activité dans la salle */
  touch(now = Date.now()): void {
    this.updatedAt = now;
  }

  /** La salle est inactive depuis plus longtemps que ROOM_EXPIRY pour son état : le serveur peut la supprimer */
  isExpired(now = Date.now()): boolean {
    return now - this.updatedAt > ROOM_EXPIRY[this.status];
  }

  /**
   * Crée une salle : le créateur prend la première place humaine. `robotNames` nomme les robots dans l'ordre
   * des places (le serveur les choisit).
   */
  static create(code: string, hostName: string, hostToken: string, requests: SeatRequest[], robotNames: string[] = [], firstPlayer: FirstPlayerChoice = 'random'): GameRoom {
    const name = hostName.trim().slice(0, MAX_NAME);
    if (!name) throw new Error('Nom de joueur manquant');
    if (requests.length < 2 || requests.length > 4) throw new Error('Une partie se joue de 2 à 4 joueurs');
    const hostIndex = requests.findIndex(seat => seat.type === 'human');
    if (hostIndex === -1) throw new Error('Il faut au moins une place humaine');
    if (typeof firstPlayer === 'number' && !(Number.isInteger(firstPlayer) && firstPlayer >= 0 && firstPlayer < requests.length)) {
      throw new Error('Premier joueur inconnu');
    }

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
    return new GameRoom(code, seats, Date.now(), 'lobby', firstPlayer);
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

  /** Lance la partie (premier joueur demandé à la création, sinon tiré au hasard) quand toutes les places sont prises */
  async start(seed?: number): Promise<void> {
    if (this.status !== 'lobby') throw new Error('La partie a déjà commencé');
    if (!this.isReady) throw new Error('Toutes les places ne sont pas prises');
    const created = GameRoom.creating.then(() => GameSetup.newGame(this.seats, { seed, firstPlayer: this.firstPlayer }));
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
    const before = this.game;
    const logLength = this.log.length;
    this.apply(result.game, result.entries);
    this.recordUndoPoint(seat.playerId, before, logLength, result.entries);
    return { notifications: result.notifications };
  }

  /** Annulations possibles pour un joueur (ses propres commandes de son tour, personne n'ayant joué depuis) */
  undoFor(playerId: string): UndoAvailability {
    const mine = this.status === 'playing' && this.undoPoints.length > 0 && this.undoPoints[0].playerId === playerId;
    return { last: mine, turn: mine && this.undoPoints.length > 1 };
  }

  /**
   * Annule la dernière action du joueur (toute sa séquence, comme SessionJournal.undoLast) ou revient au plus tôt
   * de son tour : partie et historique reviennent à l'état d'avant.
   */
  undo(token: string, scope: 'last' | 'turn'): { error?: string } {
    const seat = this.seatOf(token);
    if (!seat) return { error: 'Place inconnue' };
    const available = this.undoFor(seat.playerId);
    if (!(scope === 'last' ? available.last : available.turn)) return { error: 'Rien à annuler' };
    let index = 0;
    if (scope === 'last') {
      // Début de la séquence de la dernière entrée (une action en plusieurs commandes s'annule en entier)
      const lastSequence = this.log[this.log.length - 1].sequenceId;
      const first = lastSequence ? this.undoPoints.findIndex(point => point.sequenceIds.includes(lastSequence)) : -1;
      index = first === -1 ? this.undoPoints.length - 1 : first;
    }
    const point = this.undoPoints[index];
    this.undoPoints = this.undoPoints.slice(0, index);
    this.game = point.state;
    this.log = this.log.slice(0, point.logLength);
    return {};
  }

  /**
   * Retient l'état d'avant la commande d'un joueur. Une commande d'un autre joueur efface les points précédents ;
   * la fin de son tour (ou une commande hors de son tour) aussi : on ne revient jamais sur ce qu'un autre a vu jouer.
   */
  private recordUndoPoint(playerId: string, before: Game, logLength: number, entries: HistoryEntry[]) {
    const game = this.game!;
    const stillPlaying = this.status === 'playing' && game.players[game.currentPlayerIndex].id === playerId;
    if (!stillPlaying || this.undoPoints[0]?.playerId !== playerId) this.undoPoints = [];
    if (!stillPlaying) return;
    const sequenceIds = [...new Set(entries.map(entry => entry.sequenceId).filter((id): id is string => !!id))];
    this.undoPoints.push({ playerId, state: before, logLength, sequenceIds });
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
      trace.error(`[Salle ${this.code}] étape de robot refusée :`, result.error);
      return { played: false, notifications: [] };
    }
    // Un robot a joué : plus d'annulation possible pour le joueur précédent
    if (result.game !== game) this.undoPoints = [];
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
      undo: this.undoFor(seat.playerId),
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

  /** Résumé public pour la liste des salles (null pour une partie terminée) */
  summary(): RoomSummary | null {
    if (this.status === 'finished') return null;
    return {
      code: this.code,
      status: this.status,
      createdAt: this.createdAt,
      ...(this.game && this.status === 'playing' ? { round: this.game.currentRound } : {}),
      seats: this.seats.map(seat => ({
        name: seat.type === 'human' && !seat.token ? '' : seat.name,
        type: seat.type,
        aiDifficulty: seat.aiDifficulty,
        claimed: seat.type === 'robot' || !!seat.token,
      })),
    };
  }

  toSaved(): SavedRoom {
    return {
      code: this.code,
      status: this.status,
      seats: this.seats.map(seat => ({ ...seat })),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      firstPlayer: this.firstPlayer,
      game: this.game ? serializeGame(this.game, this.log) : undefined,
    };
  }

  static fromSaved(saved: SavedRoom): GameRoom {
    const room = new GameRoom(saved.code, saved.seats.map(seat => ({ ...seat })), saved.createdAt, saved.status, saved.firstPlayer);
    room.updatedAt = saved.updatedAt ?? saved.createdAt;
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
