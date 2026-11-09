import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from '../../core/types';
import { Command } from '../../session/commands';
import { FirstPlayerChoice, SeatRequest } from '../../session/protocol';
import { RemoteClient, RemoteState, Seat, SocketLike } from '../../session/RemoteClient';
import { SERVER_URL } from '../serverUrl';

const SEAT_KEY = 'seti_online';

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

  // Retour du réseau ou de la page (veille, onglet en arrière-plan) : reprise immédiate, sans attendre le délai
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === 'visible') clientRef.current?.reconnectNow();
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, []);

  const create = useCallback((name: string, seats: SeatRequest[], firstPlayer?: FirstPlayerChoice) => client().create(name, seats, firstPlayer), [client]);
  const join = useCallback((code: string, name: string) => client().join(code, name), [client]);
  const resume = useCallback(() => {
    const seat = readSeat();
    return seat ? client().resume(seat) : Promise.reject(new Error('Aucune partie en ligne à reprendre'));
  }, [client]);
  /** Commande du joueur : se termine quand le serveur l'a traitée (partie reçue à jour) ou refusée */
  const send = useCallback((command: Command) => client().send(command), [client]);
  /** Annulation de ses propres actions (possible selon `state.undo`) */
  const undo = useCallback((scope: 'last' | 'turn') => client().undo(scope), [client]);

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
    undo,
    leave,
  };
}

export type OnlineSession = ReturnType<typeof useOnlineSession>;
