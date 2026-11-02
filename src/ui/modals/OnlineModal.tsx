import React, { useState } from 'react';
import { AIDifficulty } from '../../core/types';
import { SeatRequest } from '../../session/protocol';
import { OnlineSession, readPlayerName, writePlayerName } from '../hooks/useOnlineSession';
import './SettingsModal.css';

type SeatChoice = 'human' | AIDifficulty;

const SEAT_LABELS: Record<SeatChoice, string> = {
  human: 'Joueur humain',
  EASY: 'Robot Débutant',
  MEDIUM: 'Robot Intermédiaire',
  EXPERT: 'Robot Expert',
  PASS: 'Robot passif',
};
const SEAT_CHOICES: SeatChoice[] = ['human', 'EASY', 'MEDIUM', 'EXPERT'];

interface OnlineModalProps {
  visible: boolean;
  online: OnlineSession;
  /** Retour au menu principal */
  onBack: () => void;
}

/** Partie en ligne : créer une salle ou la rejoindre avec son code, puis attendre les autres joueurs (salon) */
export const OnlineModal: React.FC<OnlineModalProps> = ({ visible, online, onBack }) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(readPlayerName);
  const [code, setCode] = useState('');
  // Places 2 à 4 (la première est celle du créateur)
  const [others, setOthers] = useState<SeatChoice[]>(['human']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const { state } = online;
  const room = state.room;

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

  const leave = () => {
    online.leave(true);
    onBack();
  };

  // Connexion en cours (un serveur gratuit endormi met environ une minute à se réveiller)
  if (state.status === 'connecting' && !room) {
    return (
      <div className="seti-modal-overlay" style={{ zIndex: 2000 }}>
        <div className="seti-modal-content seti-settings-modal seti-online-modal">
          <h2 className="seti-modal-title">Partie en ligne</h2>
          <p>Connexion au serveur…</p>
          <p className="seti-online-hint">Le serveur peut mettre jusqu'à une minute à se réveiller.</p>
          <button className="seti-modal-btn secondary" onClick={leave}>Annuler</button>
        </div>
      </div>
    );
  }

  // Salon : la salle attend ses joueurs
  if (room && room.status === 'lobby') {
    return (
      <div className="seti-modal-overlay" style={{ zIndex: 2000 }}>
        <div className="seti-modal-content seti-settings-modal seti-online-modal">
          <h2 className="seti-modal-title">Salle {room.code}</h2>
          <p>Donnez ce code aux autres joueurs :</p>
          <div className="seti-online-code">{room.code}</div>
          <ul className="seti-online-seats">
            {room.seats.map(seat => (
              <li key={seat.playerId} className={seat.claimed ? 'claimed' : ''}>
                <span>{seat.type === 'robot' ? '🤖' : '👤'} {seat.claimed ? seat.name : 'Place libre'}</span>
                <span>{seat.playerId === online.me ? '(vous)' : seat.claimed ? '✓' : 'en attente…'}</span>
              </li>
            ))}
          </ul>
          <p className="seti-online-hint">La partie commence dès que toutes les places sont prises.</p>
          {state.status === 'connecting' && <p className="seti-online-hint">Reconnexion…</p>}
          <button className="seti-modal-btn secondary" onClick={leave}>Quitter la salle</button>
        </div>
      </div>
    );
  }

  return (
    <div className="seti-modal-overlay" style={{ zIndex: 2000 }}>
      <div className="seti-modal-content seti-settings-modal seti-online-modal">
        <h2 className="seti-modal-title">Partie en ligne</h2>
        <div className="seti-online-tabs">
          <button className={`seti-modal-btn ${tab === 'create' ? 'primary' : ''}`} onClick={() => { setTab('create'); setError(''); }}>Créer une salle</button>
          <button className={`seti-modal-btn ${tab === 'join' ? 'primary' : ''}`} onClick={() => { setTab('join'); setError(''); }}>Rejoindre</button>
        </div>
        <label className="seti-online-field">
          Votre nom
          <input value={name} maxLength={40} onChange={e => setName(e.target.value)} />
        </label>
        {tab === 'create' ? (
          <div className="seti-online-field">
            Autres joueurs
            {others.map((choice, index) => (
              <div key={index} className="seti-online-seat-row">
                <select value={choice} onChange={e => setOthers(others.map((c, i) => (i === index ? e.target.value as SeatChoice : c)))}>
                  {SEAT_CHOICES.map(option => <option key={option} value={option}>{SEAT_LABELS[option]}</option>)}
                </select>
                {others.length > 1 && <button className="seti-online-remove" onClick={() => setOthers(others.filter((_, i) => i !== index))}>✕</button>}
              </div>
            ))}
            {others.length < 3 && <button className="seti-modal-btn" onClick={() => setOthers([...others, 'human'])}>+ Ajouter une place</button>}
          </div>
        ) : (
          <label className="seti-online-field">
            Code de la salle
            <input value={code} maxLength={10} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCDE" />
          </label>
        )}
        {error && <p className="seti-online-error">{error}</p>}
        <div className="seti-modal-buttons-vertical">
          <button className="seti-modal-btn primary" disabled={busy} onClick={submit}>{tab === 'create' ? 'Créer la salle' : 'Rejoindre la salle'}</button>
          <button className="seti-modal-btn secondary" onClick={onBack}>Retour</button>
        </div>
      </div>
    </div>
  );
};
