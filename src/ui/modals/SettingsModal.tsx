import React from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
  visible: boolean;
  onNewGame: () => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onContinue?: () => void;
  hasAutosave?: boolean;
  onClose: () => void;
  canClose: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onNewGame, onSaveGame, onLoadGame, onContinue, hasAutosave, onClose, canClose }) => {
  if (!visible) return null;

  return (
    <div className="seti-modal-overlay" style={{ zIndex: 2000 }}>
      <div className="seti-modal-content seti-settings-modal">
        <h2 className="seti-modal-title">Menu Principal</h2>
        <div className="seti-modal-buttons-vertical">
          {hasAutosave && onContinue && <button onClick={onContinue} className="seti-modal-btn primary">Continuer la partie</button>}
          <button onClick={onNewGame} className={`seti-modal-btn ${!hasAutosave ? 'primary' : ''}`}>Nouvelle Partie</button>
          <button onClick={onSaveGame} className="seti-modal-btn">Sauvegarder Partie</button>
          <button onClick={onLoadGame} className="seti-modal-btn">Restaurer Partie</button>
          {canClose && <button onClick={onClose} className="seti-modal-btn secondary">Fermer</button>}
        </div>
      </div>
    </div>
  );
};
