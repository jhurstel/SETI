import React, { useEffect, useState } from 'react';
import './SettingsModal.css';
import './NewGameModal.css';

interface NewGameModalProps {
  visible: boolean;
  onConfirm: (playerCount: number, difficulty: string, isFirstPlayer: boolean) => void;
  onCancel: () => void;
}

type Difficulty = 'EASY' | 'MEDIUM' | 'EXPERT';

const PLAYER_COUNTS = [2, 3, 4];

const LEVELS: { id: Difficulty; name: string; text: string; strength: number }[] = [
  { id: 'EASY', name: 'Débutant', text: 'Choisit au hasard parmi ses bonnes actions.', strength: 1 },
  { id: 'MEDIUM', name: 'Intermédiaire', text: 'Joue la meilleure action de son tour.', strength: 2 },
  { id: 'EXPERT', name: 'Expert', text: 'Vise aussi les points du décompte final.', strength: 3 },
];

/** Joueurs de la partie : vous (plein) et les robots (contour) */
const Seats: React.FC<{ count: number }> = ({ count }) => (
  <span className="seti-newgame-seats" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => <span key={i} className={i === 0 ? 'you' : 'robot'} />)}
  </span>
);

/** Force du niveau : 1 à 3 barres */
const Strength: React.FC<{ value: number }> = ({ value }) => (
  <span className="seti-newgame-strength" aria-hidden="true">
    {[1, 2, 3].map(i => <span key={i} className={i <= value ? 'on' : ''} style={{ height: 4 + i * 4 }} />)}
  </span>
);

export const NewGameModal: React.FC<NewGameModalProps> = ({ visible, onConfirm, onCancel }) => {
  const [playerCount, setPlayerCount] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>('EXPERT');
  const [isFirstPlayer, setIsFirstPlayer] = useState(true);

  const start = () => onConfirm(playerCount, difficulty, isFirstPlayer);

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

  const robots = playerCount - 1;
  const level = LEVELS.find(l => l.id === difficulty)!;

  return (
    <div className="seti-modal-overlay" style={{ zIndex: 2001 }} onClick={onCancel}>
      <div className="seti-modal-content seti-newgame-modal" role="dialog" aria-modal="true" aria-labelledby="seti-newgame-title" onClick={e => e.stopPropagation()}>
        <header className="seti-newgame-header">
          <h2 id="seti-newgame-title">Nouvelle partie</h2>
          <p>Vous contre 1 à 3 robots</p>
        </header>

        <section className="seti-newgame-section">
          <h3>Joueurs</h3>
          <div className="seti-newgame-options count" role="radiogroup" aria-label="Nombre de joueurs">
            {PLAYER_COUNTS.map(count => (
              <label key={count} className={`seti-newgame-option ${playerCount === count ? 'selected' : ''}`}>
                <input type="radio" name="seti-player-count" checked={playerCount === count} onChange={() => setPlayerCount(count)} />
                <span className="seti-newgame-option-main">{count} joueurs</span>
                <Seats count={count} />
                <span className="seti-newgame-option-sub">{count - 1} robot{count > 2 ? 's' : ''}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="seti-newgame-section">
          <h3>Niveau des robots</h3>
          <div className="seti-newgame-options level" role="radiogroup" aria-label="Niveau des robots">
            {LEVELS.map(l => (
              <label key={l.id} className={`seti-newgame-option ${difficulty === l.id ? 'selected' : ''}`}>
                <input type="radio" name="seti-difficulty" checked={difficulty === l.id} onChange={() => setDifficulty(l.id)} />
                <Strength value={l.strength} />
                <span className="seti-newgame-option-text">
                  <span className="seti-newgame-option-main">{l.name}</span>
                  <span className="seti-newgame-option-sub">{l.text}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <label className="seti-newgame-switch">
          <input type="checkbox" checked={isFirstPlayer} onChange={e => setIsFirstPlayer(e.target.checked)} />
          <span className="seti-newgame-switch-track" aria-hidden="true" />
          <span className="seti-newgame-switch-text">
            <span className="seti-newgame-option-main">Je commence</span>
            <span className="seti-newgame-option-sub">{isFirstPlayer ? 'Vous jouez le premier tour.' : 'Un robot ouvre la partie.'}</span>
          </span>
        </label>

        <p className="seti-newgame-summary">
          Vous et {robots} robot{robots > 1 ? 's' : ''} {level.name}{robots > 1 ? 's' : ''} · {isFirstPlayer ? 'vous commencez' : 'un robot commence'}
        </p>

        <div className="seti-newgame-actions">
          <button type="button" onClick={onCancel} className="seti-newgame-btn secondary">Annuler</button>
          <button type="button" onClick={start} className="seti-newgame-btn primary" autoFocus>Commencer</button>
        </div>
      </div>
    </div>
  );
};
