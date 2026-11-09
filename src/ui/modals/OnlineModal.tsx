import React, { useEffect, useState } from 'react';
import { RoomSummary, SeatRequest, roomsUrl } from '../../session/protocol';
import { SERVER_URL } from '../serverUrl';
import { OnlineSession } from '../hooks/useOnlineSession';
import { readPlayerName, writePlayerName } from '../playerName';
import { PlayerNameField, SeatChoice, SeatColor, SeatKind, SeatList } from './SetupFields';
import './SettingsModal.css';
import './NewGameModal.css';
import './OnlineModal.css';

interface OnlineModalProps {
  visible: boolean;
  online: OnlineSession;
  /** Retour au menu principal */
  onBack: () => void;
}

/** Cadre commun des écrans en ligne : verre sur le ciel de l'accueil, titre et sous-titre ; clic à l'extérieur : `onDismiss` */
const Frame: React.FC<{ title: string; subtitle?: React.ReactNode; onDismiss?: () => void; children: React.ReactNode }> = ({ title, subtitle, onDismiss, children }) => (
  <div className="seti-modal-overlay seti-modal-overlay--online" onClick={onDismiss}>
    <div className="seti-modal-content seti-newgame-modal seti-online-modal" role="dialog" aria-modal="true" aria-labelledby="seti-online-title" onClick={e => e.stopPropagation()}>
      <header className="seti-newgame-header">
        <h2 id="seti-online-title">{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </div>
  </div>
);

/** Liste des salles du serveur, relue toutes les 5 s tant qu'elle est affichée (null : pas encore lue ou serveur injoignable) */
function useRoomList(active: boolean): { rooms: RoomSummary[] | null; failed: boolean } {
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(roomsUrl(SERVER_URL));
        const list = (await response.json()) as RoomSummary[];
        if (!stopped) { setRooms(list); setFailed(false); }
      } catch {
        if (!stopped) setFailed(true);
      }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { stopped = true; clearInterval(timer); };
  }, [active]);
  return { rooms, failed };
}

/** Une salle de la liste : code, places à leurs couleurs, places libres ; un salon se rejoint d'un clic */
const RoomRow: React.FC<{ room: RoomSummary; busy: boolean; onJoin?: () => void }> = ({ room, busy, onJoin }) => {
  const free = room.seats.filter(seat => !seat.claimed).length;
  const host = room.seats.find(seat => seat.type === 'human' && seat.claimed)?.name;
  return (
    <li className={`seti-room-row ${room.status}`}>
      <span className="seti-room-code">{room.code}</span>
      <span className="seti-room-info">
        <span className="seti-room-seats">
          {room.seats.map((seat, index) => (
            <span key={index} className={`seti-room-seat ${seat.claimed ? '' : 'free'}`}>
              <SeatColor index={index} filled={seat.claimed} />
              <SeatKind robot={seat.type === 'robot' ? seat.aiDifficulty ?? 'MEDIUM' : undefined} />
            </span>
          ))}
        </span>
        <span className="seti-room-detail">
          {room.status === 'lobby'
            ? `${host ? `Salle de ${host} · ` : ''}${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`
            : `${room.seats.filter(s => s.type === 'human').map(s => s.name).join(', ')} · manche ${room.round}`}
        </span>
      </span>
      {onJoin && <button type="button" className="seti-newgame-btn secondary seti-room-join" disabled={busy} onClick={onJoin}>Rejoindre</button>}
    </li>
  );
};

/** Partie en ligne : créer une salle ou la rejoindre avec son code, puis attendre les autres joueurs (salon) */
export const OnlineModal: React.FC<OnlineModalProps> = ({ visible, online, onBack }) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(readPlayerName);
  const [code, setCode] = useState('');
  // Places 2 à 4 (la première est celle du créateur)
  const [others, setOthers] = useState<SeatChoice[]>(['human']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const { state } = online;
  const room = state.room;
  const inForm = visible && !room && state.status !== 'connecting';
  const roomList = useRoomList(inForm && tab === 'join');
  // À chaque ouverture : le dernier nom saisi (il a pu changer dans la fenêtre Nouvelle partie)
  useEffect(() => { if (visible) setName(readPlayerName()); }, [visible]);

  const submit = async (joinCode = code) => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Indiquez votre nom');
    writePlayerName(trimmed);
    setError('');
    setBusy(true);
    try {
      if (tab === 'create') {
        const seats: SeatRequest[] = [{ type: 'human' }, ...others.map(choice => (choice === 'human' ? { type: 'human' as const } : { type: 'robot' as const, aiDifficulty: choice }))];
        // Premier joueur tiré au hasard par le serveur au lancement
        await online.create(trimmed, seats);
      } else {
        if (!joinCode.trim()) return setError('Indiquez le code de la salle');
        await online.join(joinCode.trim().toUpperCase(), trimmed);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Formulaire : Entrée valide, Échap revient à l'accueil
  useEffect(() => {
    if (!inForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      else if (e.key === 'Enter' && !busy && !(e.target instanceof HTMLButtonElement)) submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!visible) return null;

  const leave = () => {
    online.leave(true);
    onBack();
  };

  // Connexion en cours (un serveur gratuit endormi met environ une minute à se réveiller)
  if (state.status === 'connecting' && !room) {
    return (
      <Frame title="Partie en ligne" subtitle="Connexion au serveur…">
        <div className="seti-online-connecting">
          <span className="seti-online-spinner" aria-hidden="true" />
          <p>Le serveur peut mettre jusqu'à une minute à se réveiller.</p>
        </div>
        <div className="seti-newgame-actions">
          <button type="button" className="seti-newgame-btn secondary" onClick={leave}>Annuler</button>
        </div>
      </Frame>
    );
  }

  // Salon : la salle attend ses joueurs
  if (room && room.status === 'lobby') {
    const claimed = room.seats.filter(seat => seat.claimed).length;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(room.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Presse-papiers indisponible : le code reste sélectionnable
      }
    };
    return (
      <Frame title="Salon" subtitle="Donnez ce code aux autres joueurs">
        <div className="seti-online-code-box">
          <span className="seti-online-code">{room.code}</span>
          <button type="button" className="seti-newgame-btn secondary" onClick={copy}>{copied ? 'Copié !' : 'Copier'}</button>
        </div>

        <section className="seti-newgame-section">
          <h3>Places · {claimed} / {room.seats.length}</h3>
          <div className="seti-online-progress" aria-hidden="true">
            <span style={{ width: `${(claimed / room.seats.length) * 100}%` }} />
          </div>
          <ul className="seti-online-seats">
            {room.seats.map((seat, index) => (
              <li key={seat.playerId} className={seat.claimed ? 'claimed' : ''}>
                <SeatColor index={index} filled={seat.playerId === online.me} />
                <SeatKind robot={seat.type === 'robot' ? seat.aiDifficulty ?? 'MEDIUM' : undefined} />
                <span className="seti-online-seat-name">{seat.claimed ? seat.name : 'Place libre'}</span>
                <span className={`seti-online-status ${seat.playerId === online.me ? 'you' : seat.claimed ? 'ready' : 'waiting'}`}>
                  {seat.playerId === online.me ? 'Vous' : seat.claimed ? 'Prêt' : 'En attente…'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="seti-newgame-summary">
          {state.status === 'connecting' ? 'Reconnexion…' : 'La partie commence dès que toutes les places sont prises.'}
        </p>
        <div className="seti-newgame-actions">
          <button type="button" className="seti-newgame-btn secondary" onClick={leave}>Quitter la salle</button>
        </div>
      </Frame>
    );
  }

  const switchTab = (next: 'create' | 'join') => { setTab(next); setError(''); };

  return (
    <Frame title="Partie en ligne" subtitle="Jouez avec vos amis, chacun sur son écran" onDismiss={onBack}>
      <div className="seti-online-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'create'} className={tab === 'create' ? 'selected' : ''} onClick={() => switchTab('create')}>Créer une salle</button>
        <button type="button" role="tab" aria-selected={tab === 'join'} className={tab === 'join' ? 'selected' : ''} onClick={() => switchTab('join')}>Rejoindre</button>
      </div>

      <PlayerNameField id="seti-online-name" value={name} onChange={setName} autoFocus />

      {tab === 'create' ? (
        <>
          <section className="seti-newgame-section">
            <h3>Places · {others.length + 1} joueurs</h3>
            <SeatList hostName={name.trim() || 'Vous'} seats={others} onChange={setOthers} allowHuman />
          </section>
        </>
      ) : (
        <section className="seti-newgame-section">
          <h3><label htmlFor="seti-online-code">Code de la salle</label></h3>
          <input id="seti-online-code" className="seti-newgame-input code" value={code} maxLength={10} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCDE" />
        </section>
      )}

      {/* Salles du serveur : les salons à rejoindre, puis les parties en cours */}
      {tab === 'join' && (() => {
        const lobbies = roomList.rooms?.filter(r => r.status === 'lobby') ?? [];
        const playing = roomList.rooms?.filter(r => r.status === 'playing') ?? [];
        return (
          <>
            <section className="seti-newgame-section">
              <h3>Salles qui attendent des joueurs</h3>
              {roomList.rooms === null
                ? <p className="seti-room-empty">{roomList.failed ? 'Serveur injoignable pour le moment (il peut mettre une minute à se réveiller).' : 'Chargement…'}</p>
                : lobbies.length === 0
                  ? <p className="seti-room-empty">Aucune salle ouverte : créez-en une, ou entrez un code.</p>
                  : <ul className="seti-room-list">{lobbies.map(r => <RoomRow key={r.code} room={r} busy={busy} onJoin={() => { setCode(r.code); submit(r.code); }} />)}</ul>}
            </section>
            {playing.length > 0 && (
              <section className="seti-newgame-section">
                <h3>Parties en cours</h3>
                <ul className="seti-room-list">{playing.map(r => <RoomRow key={r.code} room={r} busy={busy} />)}</ul>
              </section>
            )}
          </>
        );
      })()}

      {error && <p className="seti-online-error" role="alert">{error}</p>}

      <div className="seti-newgame-actions">
        <button type="button" className="seti-newgame-btn secondary" onClick={onBack}>Annuler</button>
        <button type="button" className="seti-newgame-btn primary" disabled={busy} onClick={() => submit()}>
          {busy ? 'Connexion…' : tab === 'create' ? 'Créer la salle' : 'Rejoindre la salle'}
        </button>
      </div>
    </Frame>
  );
};
