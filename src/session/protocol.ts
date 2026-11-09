import { AIDifficulty, Game, HistoryEntry } from '../core/types';
import { Command } from './commands';

/**
 * Protocole du jeu à distance (messages JSON sur WebSocket), partagé par le serveur (server/) et le futur client.
 * Le client crée une salle ou la rejoint avec un code, reçoit un jeton de place (à garder pour se reconnecter),
 * puis envoie des commandes ; après chaque changement, le serveur envoie à chacun sa vue de la partie.
 */

/** Place demandée à la création d'une salle (la première place humaine est celle du créateur) */
export type SeatRequest = { type: 'human' } | { type: 'robot'; aiDifficulty?: AIDifficulty };

/** Premier joueur demandé à la création : un index de place, n'importe quelle place, ou une autre que celle du créateur */
export type FirstPlayerChoice = number | 'random' | 'randomOther';

/** Annulations possibles pour un joueur en ligne : ses propres actions, tant que personne d'autre n'a joué depuis */
export interface UndoAvailability {
  /** Annuler sa dernière action */
  last: boolean;
  /** Revenir au plus tôt de son tour en cours (plusieurs actions) */
  turn: boolean;
}

export type ClientMessage =
  | { type: 'create'; version: string; name: string; seats: SeatRequest[]; firstPlayer?: FirstPlayerChoice }
  | { type: 'join'; version: string; code: string; name: string }
  | { type: 'resume'; version: string; code: string; token: string }
  /** `requestId` (facultatif) : renvoyé dans l'accusé de réception, après l'état qui suit la commande */
  | { type: 'command'; command: Command; requestId?: number }
  /** Annulation de ses propres actions (voir UndoAvailability) ; accusé de réception comme une commande */
  | { type: 'undo'; scope: 'last' | 'turn'; requestId?: number }
  /** Battement de cœur du client : le serveur répond `pong` (connexion morte détectée, serveur gardé éveillé) */
  | { type: 'ping' };

export type RoomStatus = 'lobby' | 'playing' | 'finished';

/** État public d'une salle : ses places, qui les occupe, qui est connecté */
export interface RoomInfo {
  code: string;
  status: RoomStatus;
  seats: { playerId: string; name: string; type: 'human' | 'robot'; aiDifficulty?: AIDifficulty; claimed: boolean; connected: boolean }[];
}

/**
 * Résumé public d'une salle (liste des salles, `GET /rooms`) : de quoi choisir une salle à rejoindre ou voir les
 * parties en cours, sans jeton ni partie
 */
export interface RoomSummary {
  code: string;
  status: 'lobby' | 'playing';
  createdAt: number;
  /** Manche en cours (partie commencée) */
  round?: number;
  seats: { name: string; type: 'human' | 'robot'; aiDifficulty?: AIDifficulty; claimed: boolean }[];
}

/** Adresse de la liste des salles (HTTP) à partir de l'adresse WebSocket du serveur */
export function roomsUrl(serverUrl: string): string {
  return `${serverUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '')}/rooms`;
}

export type ServerMessage =
  /** Place obtenue (création, arrivée ou reconnexion) : le jeton permet de revenir à cette place */
  | { type: 'welcome'; version: string; code: string; token: string; playerId: string }
  /** Vue de la partie pour ce joueur (viewFor) et historique filtré (viewEntries) ; pas de partie dans le salon */
  | { type: 'state'; room: RoomInfo; you: string; game?: Game; entries: HistoryEntry[]; undo?: UndoAvailability }
  /** Annonces (découverte d'une espèce…) */
  | { type: 'notification'; messages: string[] }
  /** Commande traitée (l'état qui en découle a déjà été envoyé) ou refusée */
  | { type: 'ack'; requestId?: number; error?: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

/** Client et serveur s'entendent si leur version a les mêmes deux premiers numéros (1.1.x) */
export function isCompatibleVersion(client: string, server: string): boolean {
  const minor = (version: string) => version.split('.').slice(0, 2).join('.');
  return /^\d+\.\d+\.\d+$/.test(client) && minor(client) === minor(server);
}

const isString = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const DIFFICULTIES: AIDifficulty[] = ['EASY', 'MEDIUM', 'EXPERT'];

/**
 * Lit un message reçu d'un client : null s'il est mal formé. Le contenu d'une commande n'est vérifié que
 * dans sa forme générale : la session (GameSession.dispatch) refuse ce qui n'est pas permis.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case 'create': {
      if (!isString(message.version, 20) || !isString(message.name, 40) || !Array.isArray(message.seats)) return null;
      const seats = message.seats as unknown[];
      const valid = seats.every(seat => {
        const s = seat as Record<string, unknown> | null;
        return !!s && (s.type === 'human' || (s.type === 'robot' && (s.aiDifficulty === undefined || DIFFICULTIES.includes(s.aiDifficulty as AIDifficulty))));
      });
      const first = message.firstPlayer;
      const validFirst = first === undefined || first === 'random' || first === 'randomOther'
        || (typeof first === 'number' && Number.isInteger(first) && first >= 0 && first < seats.length);
      if (!valid || !validFirst) return null;
      const created: ClientMessage = { type: 'create', version: message.version, name: message.name.trim(), seats: seats as SeatRequest[] };
      return first === undefined ? created : { ...created, firstPlayer: first as FirstPlayerChoice };
    }
    case 'join':
      return isString(message.version, 20) && isString(message.code, 10) && isString(message.name, 40)
        ? { type: 'join', version: message.version, code: message.code.toUpperCase(), name: message.name.trim() }
        : null;
    case 'resume':
      return isString(message.version, 20) && isString(message.code, 10) && isString(message.token, 100)
        ? { type: 'resume', version: message.version, code: message.code.toUpperCase(), token: message.token }
        : null;
    case 'command': {
      const command = message.command as Record<string, unknown> | null;
      if (!command || typeof command !== 'object' || typeof command.type !== 'string') return null;
      const requestId = typeof message.requestId === 'number' ? message.requestId : undefined;
      return requestId === undefined ? { type: 'command', command: command as unknown as Command } : { type: 'command', command: command as unknown as Command, requestId };
    }
    case 'undo': {
      if (message.scope !== 'last' && message.scope !== 'turn') return null;
      const requestId = typeof message.requestId === 'number' ? message.requestId : undefined;
      return requestId === undefined ? { type: 'undo', scope: message.scope } : { type: 'undo', scope: message.scope, requestId };
    }
    case 'ping':
      return { type: 'ping' };
    default:
      return null;
  }
}
