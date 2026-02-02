import React, { useState } from 'react';
import './SettingsModal.css';

interface NewGameModalProps {
  visible: boolean;
  onConfirm: (playerCount: number, difficulty: string, isFirstPlayer: boolean) => void;
  onCancel: () => void;
}

export const NewGameModal: React.FC<NewGameModalProps> = ({ visible, onConfirm, onCancel }) => {
  const [playerCount, setPlayerCount] = useState(2);
  const [difficulty, setDifficulty] = useState('EASY');
  const [isFirstPlayer, setIsFirstPlayer] = useState(true);

  if (!visible) return null;

  return (
    <div className="seti-modal-overlay" style={{ zIndex: 2001 }}>
      <div className="seti-modal-content seti-newgame-modal">
        <h2 className="seti-modal-title">Nouvelle Partie</h2>
        
        <div className="seti-form-group">
          <label className="seti-form-label">Nombre de joueurs :</label>
          <div className="seti-radio-group">
            <label className={`seti-radio-label ${playerCount === 2 ? 'selected' : ''}`}>
                <input type="radio" checked={playerCount === 2} onChange={() => setPlayerCount(2)} /> 
                2 Joueurs
            </label>
            <label className={`seti-radio-label ${playerCount === 3 ? 'selected' : ''}`}>
                <input type="radio" checked={playerCount === 3} onChange={() => setPlayerCount(3)} /> 
                3 Joueurs
            </label>
            <label className={`seti-radio-label ${playerCount === 4 ? 'selected' : ''}`}>
                <input type="radio" checked={playerCount === 4} onChange={() => setPlayerCount(4)} /> 
                4 Joueurs
            </label>
          </div>
        </div>

        <div className="seti-form-group">
          <label className="seti-form-label">Niveau du Robot :</label>
          <div className="seti-radio-group">
            <label className={`seti-radio-label ${difficulty === 'EASY' ? 'selected' : ''}`}>
                <input type="radio" checked={difficulty === 'EASY'} onChange={() => setDifficulty('EASY')} /> 
                Débutant
            </label>
            <label className="seti-radio-label disabled">
                <input type="radio" checked={difficulty === 'MEDIUM'} disabled /> 
                Intermédiaire (Bientôt)
            </label>
            <label className="seti-radio-label disabled">
                <input type="radio" checked={difficulty === 'EXPERT'} disabled /> 
                Expert (Bientôt)
            </label>
          </div>
        </div>

        <div className="seti-form-group">
          <label className="seti-form-label">Premier Joueur :</label>
          <div className="seti-radio-group">
            <label className={`seti-radio-label ${isFirstPlayer ? 'selected' : ''}`}>
                <input type="radio" checked={isFirstPlayer} onChange={() => setIsFirstPlayer(true)} /> 
                Moi (Humain)
            </label>
            <label className={`seti-radio-label ${!isFirstPlayer ? 'selected' : ''}`}>
                <input type="radio" checked={!isFirstPlayer} onChange={() => setIsFirstPlayer(false)} /> 
                Adversaire (Robot)
            </label>
          </div>
        </div>

        <div className="seti-modal-actions">
          <button onClick={onCancel} className="seti-modal-btn secondary">Annuler</button>
          <button onClick={() => onConfirm(playerCount, difficulty, isFirstPlayer)} className="seti-modal-btn primary">Commencer</button>
        </div>
      </div>
    </div>
  );
};
