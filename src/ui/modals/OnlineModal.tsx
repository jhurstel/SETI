import React, { useEffect, useState } from 'react';
import { AIDifficulty } from '../../core/types';
import { SeatRequest } from '../../session/protocol';
import { OnlineSession, readPlayerName, writePlayerName } from '../hooks/useOnlineSession';
import './SettingsModal.css';
import './NewGameModal.css';
import './OnlineModal.css';

type SeatChoice = 'human' | AIDifficulty;

const SEAT_CHOICES: { id: SeatChoice; label: string }[] = [
  { id: 'human', label: 'Humain' },
  { id: 'EASY', label: 'Débutant' },
  { id: 'MEDIUM', label: 'Intermédiaire' },
  { id: 'EXPERT', label: 'Expert' },
];

interface OnlineModalProps {
  visible: boolean;
  online: OnlineSession;
  /** Retour au menu principal */
  onBack: () => void;
}

/** Cadre commun des écrans en ligne : verre sur le ciel de l'accueil, titre et sous-titre ; clic à l'extérieur : `onDismiss` */
const Frame: React.FC<{ title: string; subtitle?: React.ReactNode; onDismiss?: () => void; children: React.ReactNode }> = ({ title, subtitle, onDismiss, children }) => (
  <div className="seti-modal-overlay" style={{ zIndex: 2000 }} onClick={onDismiss}>
    <div className="seti-modal-content seti-newgame-modal seti-online-modal" role="dialog" aria-modal="true" aria-labelledby="seti-online-title" onClick={e => e.stopPropagation()}>
      <header className="seti-newgame-header">
        <h2 id="seti-online-title">{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </div>
  </div>
);

/** Silhouette d'une place : humain ou robot */
const SeatAvatar: React.FC<{ robot: boolean; claimed: boolean }> = ({ robot, claimed }) => (
  <span className={`seti-online-avatar ${robot ? 'robot' : 'human'} ${claimed ? 'claimed' : ''}`} aria-hidden="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {robot
        ? <path d="M12 3v3M6 8h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM9 13h.01M15 13h.01M9.5 16.5h5" />
        : <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />}
    </svg>
  </span>
);

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

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Indiquez votre nom');
    writePlayerName(trimmed);
    setError('');
    setBusy(true);
    try {
      if (tab === 'create') {
        const seats: SeatRequest[] = [{ type: 'human' }, ...others.map(choice => (choice === 'human' ? { type: 'human' as const } : { type: 'robot' as const, aiDifficulty: choice }))];
        await online.create(trimmed, seats);
      } else {
        if (!code.trim()) return setError('Indiquez le code de la salle');
        await online.join(code.trim().toUpperCase(), trimmed);
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
            {room.seats.map(seat => (
              <li key={seat.playerId} className={seat.claimed ? 'claimed' : ''}>
                <SeatAvatar robot={seat.type === 'robot'} claimed={seat.claimed} />
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

      <section className="seti-newgame-section">
        <h3><label htmlFor="seti-online-name">Votre nom</label></h3>
        <input id="seti-online-name" className="seti-online-input" value={name} maxLength={40} autoFocus onChange={e => setName(e.target.value)} placeholder="Votre nom" />
      </section>

      {tab === 'create' ? (
        <section className="seti-newgame-section">
          <h3>Autres places</h3>
          <div className="seti-online-seat-list">
            {others.map((choice, index) => (
              <div key={index} className="seti-online-seat-row">
                <span className="seti-online-seat-label">
                  <SeatAvatar robot={choice !== 'human'} claimed />
                  Place {index + 2}
                </span>
                <div className="seti-online-chips" role="radiogroup" aria-label={`Place ${index + 2}`}>
                  {SEAT_CHOICES.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={choice === option.id}
                      className={choice === option.id ? 'selected' : ''}
                      onClick={() => setOthers(others.map((c, i) => (i === index ? option.id : c)))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {others.length > 1 && (
                  <button type="button" className="seti-online-remove" aria-label={`Retirer la place ${index + 2}`} onClick={() => setOthers(others.filter((_, i) => i !== index))}>✕</button>
                )}
              </div>
            ))}
            {others.length < 3 && (
              <button type="button" className="seti-online-add" onClick={() => setOthers([...others, 'human'])}>+ Ajouter une place</button>
            )}
          </div>
        </section>
      ) : (
        <section className="seti-newgame-section">
          <h3><label htmlFor="seti-online-code">Code de la salle</label></h3>
          <input id="seti-online-code" className="seti-online-input code" value={code} maxLength={10} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCDE" />
        </section>
      )}

      {error && <p className="seti-online-error" role="alert">{error}</p>}

      <div className="seti-newgame-actions">
        <button type="button" className="seti-newgame-btn secondary" onClick={onBack}>Annuler</button>
        <button type="button" className="seti-newgame-btn primary" disabled={busy} onClick={submit}>
          {busy ? 'Connexion…' : tab === 'create' ? 'Créer la salle' : 'Rejoindre la salle'}
        </button>
      </div>
    </Frame>
  );
};
