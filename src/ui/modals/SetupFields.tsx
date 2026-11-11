import React from 'react';
import { AIDifficulty } from '../../core/types';
import { PLAYER_COLORS } from '../../engine/GameFactory';
import { HumanIcon, LevelStrength } from '../components/PlayerKindIcon';

/**
 * Éléments communs aux fenêtres de création de partie (Nouvelle partie, Partie en ligne › Créer une salle) :
 * même champ de nom, mêmes niveaux de robot, mêmes places à leurs couleurs.
 */

export const ROBOT_LEVELS: { id: AIDifficulty; name: string; text: string; strength: number }[] = [
  { id: 'EASY', name: 'Débutant', text: 'Hésite beaucoup entre ses bonnes actions.', strength: 1 },
  { id: 'MEDIUM', name: 'Avancé', text: 'Joue le plus souvent sa meilleure action.', strength: 2 },
  { id: 'EXPERT', name: 'Expert', text: 'Joue toujours sa meilleure action.', strength: 3 },
];

/** Couleur de la place `index` (ordre des places, comme dans la partie) */
export const seatColor = (index: number) => PLAYER_COLORS[index % PLAYER_COLORS.length];

/** Pastille de couleur d'une place ; `filled` : la vôtre (pleine), sinon contour */
export const SeatColor: React.FC<{ index: number; filled?: boolean }> = ({ index, filled = true }) => (
  <span
    className={`seti-seat-color ${filled ? 'filled' : ''}`}
    style={{ '--seat-color': seatColor(index) } as React.CSSProperties}
    aria-hidden="true"
  />
);

/** Icône d'une place : silhouette pour un humain, barres de force pour un robot */
export const SeatKind: React.FC<{ robot?: AIDifficulty }> = ({ robot }) => (
  <span className={`seti-seat-kind ${robot ? 'robot' : 'human'}`} aria-hidden="true">
    {robot ? <LevelStrength value={ROBOT_LEVELS.find(l => l.id === robot)?.strength ?? 1} /> : <HumanIcon size={16} />}
  </span>
);

/** Choix d'une place : un humain (partie en ligne : il rejoindra avec le code) ou un robot d'un niveau */
export type SeatChoice = 'human' | AIDifficulty;

/**
 * Places de la partie : la vôtre, puis les autres (2 à 4 joueurs en tout), chacune à sa couleur, avec ses choix
 * en cellules de même taille sur une ligne ; ajout et retrait de places. `allowHuman` : choix « Humain » (en ligne).
 */
export const SeatList: React.FC<{ hostName: string; seats: SeatChoice[]; onChange: (seats: SeatChoice[]) => void; allowHuman?: boolean }> = ({ hostName, seats, onChange, allowHuman = false }) => {
  const choices: { id: SeatChoice; label: string; icon: React.ReactNode }[] = [
    ...(allowHuman ? [{ id: 'human' as const, label: 'Humain', icon: <HumanIcon size={13} /> }] : []),
    ...ROBOT_LEVELS.map(level => ({ id: level.id, label: level.name, icon: <LevelStrength value={level.strength} /> })),
  ];
  const added: SeatChoice = allowHuman ? 'human' : 'EXPERT';
  return (
    <div className="seti-seat-list">
      {/* Place 1 : la vôtre */}
      <div className="seti-seat-row">
        <span className="seti-seat-label host">
          <SeatColor index={0} />
          <SeatKind />
          <span className="seti-seat-label-text">{hostName}</span>
        </span>
        <span className="seti-seat-you">Vous</span>
      </div>
      {seats.map((choice, index) => (
        <div key={index} className="seti-seat-row">
          <span className="seti-seat-label">
            <SeatColor index={index + 1} filled={false} />
            <SeatKind robot={choice === 'human' ? undefined : choice} />
            <span className="seti-seat-label-text">Place {index + 2}</span>
          </span>
          <div className="seti-seat-chips" role="radiogroup" aria-label={`Place ${index + 2}`}>
            {choices.map(option => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={choice === option.id}
                className={choice === option.id ? 'selected' : ''}
                onClick={() => onChange(seats.map((c, i) => (i === index ? option.id : c)))}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          {seats.length > 1
            ? <button type="button" className="seti-seat-remove" aria-label={`Retirer la place ${index + 2}`} onClick={() => onChange(seats.filter((_, i) => i !== index))}>✕</button>
            : <span className="seti-seat-remove" aria-hidden="true" />}
        </div>
      ))}
      {seats.length < 3 && (
        <button type="button" className="seti-seat-add" onClick={() => onChange([...seats, added])}>+ Ajouter {allowHuman ? 'une place' : 'un robot'}</button>
      )}
    </div>
  );
};

/** Champ « Votre nom » (le nom saisi est gardé par l'appelant, voir playerName.ts) */
export const PlayerNameField: React.FC<{ id: string; value: string; onChange: (name: string) => void; autoFocus?: boolean }> = ({ id, value, onChange, autoFocus }) => (
  <section className="seti-newgame-section">
    <h3><label htmlFor={id}>Votre nom</label></h3>
    <input id={id} className="seti-newgame-input" value={value} maxLength={40} autoFocus={autoFocus} onChange={e => onChange(e.target.value)} placeholder="Votre nom" autoComplete="nickname" />
  </section>
);
