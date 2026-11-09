import React, { useEffect, useState } from 'react';
import { AIDifficulty } from '../../core/types';
import { readPlayerName, writePlayerName } from '../playerName';
import { PlayerNameField, ROBOT_LEVELS, SeatChoice, SeatList } from './SetupFields';
import './SettingsModal.css';
import './NewGameModal.css';

interface NewGameModalProps {
  visible: boolean;
  /** Nom du joueur, niveau de chaque robot (dans l'ordre des places) ; le premier joueur est tiré au hasard */
  onConfirm: (playerName: string, robots: AIDifficulty[]) => void;
  onCancel: () => void;
}

/** Nom du joueur s'il n'en saisit pas */
const DEFAULT_NAME = 'Joueur';

/** Nouvelle partie solo : votre nom et les robots (même liste de places que Partie en ligne › Créer une salle) */
export const NewGameModal: React.FC<NewGameModalProps> = ({ visible, onConfirm, onCancel }) => {
  const [name, setName] = useState(readPlayerName);
  // Places des robots (sans choix « Humain ») : un Expert par défaut
  const [robots, setRobots] = useState<SeatChoice[]>(['EXPERT']);
  // À chaque ouverture : le dernier nom saisi (il a pu changer dans la fenêtre Partie en ligne)
  useEffect(() => { if (visible) setName(readPlayerName()); }, [visible]);

  // Le nom saisi est gardé pour la prochaine partie (locale ou en ligne)
  const start = () => {
    const trimmed = name.trim();
    if (trimmed) writePlayerName(trimmed);
    onConfirm(trimmed || DEFAULT_NAME, robots.filter((r): r is AIDifficulty => r !== 'human'));
  };

  // Échap annule, Entrée lance la partie
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!visible) return null;

  // Résumé : « Jerome et 2 robots (Expert, Débutant) »
  const levels = robots.map(r => ROBOT_LEVELS.find(l => l.id === r)?.name).join(', ');

  return (
    <div className="seti-modal-overlay" style={{ zIndex: 2001 }} onClick={onCancel}>
      <div className="seti-modal-content seti-newgame-modal" role="dialog" aria-modal="true" aria-labelledby="seti-newgame-title" onClick={e => e.stopPropagation()}>
        <header className="seti-newgame-header">
          <h2 id="seti-newgame-title">Nouvelle partie</h2>
          <p>Vous contre 1 à 3 robots</p>
        </header>

        <PlayerNameField id="seti-newgame-name" value={name} onChange={setName} />

        <section className="seti-newgame-section">
          <h3>Places · {robots.length + 1} joueurs</h3>
          <SeatList hostName={name.trim() || DEFAULT_NAME} seats={robots} onChange={setRobots} />
        </section>

        <p className="seti-newgame-summary">
          {name.trim() || DEFAULT_NAME} et {robots.length} robot{robots.length > 1 ? 's' : ''} ({levels}) · premier joueur tiré au hasard
        </p>

        <div className="seti-newgame-actions">
          <button type="button" onClick={onCancel} className="seti-newgame-btn secondary">Annuler</button>
          <button type="button" onClick={start} className="seti-newgame-btn primary" autoFocus>Commencer</button>
        </div>
      </div>
    </div>
  );
};
