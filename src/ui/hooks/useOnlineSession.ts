import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '../../core/types';
import { Command } from '../../session/commands';
import { SeatRequest } from '../../session/protocol';
import { RemoteClient, RemoteState, Seat, SocketLike } from '../../session/RemoteClient';
import { SERVER_URL } from '../serverUrl';

const SEAT_KEY = 'seti_online';
const NAME_KEY = 'seti_player_name';

function readSeat(): Seat | undefined {
  try {
    const seat = JSON.parse(localStorage.getItem(SEAT_KEY) || 'null') as Seat | null;
    return seat && seat.url === SERVER_URL ? seat : undefined;
  } catch {
    return undefined;
  }
}

function writeSeat(seat: Seat | undefined) {
  try {
    if (seat) localStorage.setItem(SEAT_KEY, JSON.stringify(seat));
    else localStorage.removeItem(SEAT_KEY);
  } catch {
    // Stockage indisponible : la place ne pourra pas être reprise après rechargement
  }
}

/** Dernier nom de joueur utilisé en ligne */
export function readPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function writePlayerName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // sans importance
  }
}

/**
 * Partie en ligne côté interface : le client réseau (RemoteClient) et son état pour React. La place obtenue
 * est gardée dans le navigateur (`seti_online`) pour être reprise après un rechargement de la page.
 */
export function useOnlineSession(handlers: { onNotifications: (messages: string[]) => void; onError: (message: string) => void }) {
  const [state, setState] = useState<RemoteState>({ status: 'disconnected', entries: [] });
  const [storedSeat, setStoredSeat] = useState<Seat | undefined>(readSeat);
  const gameRef = useRef<Game | null>(null);
  const clientRef = useRef<RemoteClient | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const client = useCallback((): RemoteClient => {
    if (!clientRef.current) {
      clientRef.current = new RemoteClient(SERVER_URL, url => new WebSocket(url) as unknown as SocketLike, {
        onState: next => {
          gameRef.current = next.game ?? null;
          setState(next);
        },
        onNotifications: messages => handlersRef.current.onNotifications(messages),
        onError: message => handlersRef.current.onError(message),
        onSeat: seat => {
          writeSeat(seat);
          setStoredSeat(seat);
        },
      });
    }
    return clientRef.current;
  }, []);

  useEffect(() => () => clientRef.current?.close(), []);

  const create = useCallback((name: string, seats: SeatRequest[]) => client().create(name, seats), [client]);
  const join = useCallback((code: string, name: string) => client().join(code, name), [client]);
  const resume = useCallback(() => {
    const seat = readSeat();
    return seat ? client().resume(seat) : Promise.reject(new Error('Aucune partie en ligne à reprendre'));
  }, [client]);
  /** Commande du joueur : se termine quand le serveur l'a traitée (partie reçue à jour) ou refusée */
  const send = useCallback((command: Command) => client().send(command), [client]);

  /** Quitte la partie en ligne ; `forget` oublie aussi la place (sinon elle reste reprenable) */
  const leave = useCallback((forget = false) => {
    clientRef.current?.close();
    gameRef.current = null;
    if (forget) {
      writeSeat(undefined);
      setStoredSeat(undefined);
    }
  }, []);

  return {
    /** Le jeu en ligne est possible (serveur configuré) */
    available: !!SERVER_URL,
    /** Une salle est ouverte (connexion en cours ou établie) */
    active: state.status !== 'disconnected',
    state,
    game: state.game ?? null,
    gameRef,
    me: state.seat?.playerId,
    storedSeat,
    create,
    join,
    resume,
    send,
    leave,
  };
}

export type OnlineSession = ReturnType<typeof useOnlineSession>;
