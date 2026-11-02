import React, { useState, useEffect } from 'react';
import { AIDifficulty, Game, HistoryEntry } from '../../core/types';
import { NewGameModal } from './NewGameModal';
import { serializeGame, deserializeGame, SaveVersionError } from '../../core/GamePersistence';
import { readAutosave } from '../hooks/useAutosave';
import './SettingsModal.css';
import { versionLabel } from '../version';
import { GameSetup, SeatConfig } from '../../session/GameSetup';

/** API File System Access (Chrome, Edge) : absente des types DOM standards */
type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }> }>;
};

interface SettingsModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  game: Game | null;
  historyLog: HistoryEntry[];
  /** Nouvelle partie ou partie chargée, avec son journal (la session la démarre) */
  onLoadGame: (game: Game, historyLog?: HistoryEntry[]) => void;
  setToast: (toast: { message: string; visible: boolean } | null) => void;
  /** Réglage « Outils de débogage » */
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  /** Partie en ligne : ouvre la fenêtre de création / arrivée dans une salle (absent : serveur non configuré) */
  onOnline?: () => void;
  /** Reprend la partie en ligne gardée dans le navigateur (absent : aucune) */
  onResumeOnline?: () => void;
  /** Quitte la partie en ligne en cours (absent : pas de partie en ligne) */
  onLeaveOnline?: () => void;
  /** Une partie (locale ou en ligne) est affichée : le menu peut se refermer */
  canClose?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  visible, 
  setVisible, 
  game, 
  historyLog,
  onLoadGame,
  setToast,
  showDebug,
  setShowDebug,
  onOnline,
  onResumeOnline,
  onLeaveOnline,
  canClose,
}) => {
  const [newGameModalVisible, setNewGameModalVisible] = useState(false);
  const [hasAutosave, setHasAutosave] = useState(false);

  // Vérifier s'il y a une sauvegarde automatique au démarrage ou à l'ouverture
  useEffect(() => {
    setHasAutosave(!!readAutosave());
  }, [visible]);

  // Restaure une partie sauvegardée (fichier ou sauvegarde automatique)
  const applySavedGame = (json: string) => {
      const { game: loadedGame, historyLog: loadedLog } = deserializeGame(json);
      onLoadGame(loadedGame, loadedLog);
      setVisible(false);
  };

  const handleNewGameRequest = () => {
      setNewGameModalVisible(true);
      setVisible(false);
  };

  const handleNewGameConfirm = (playerCount: number, difficulty: string, isFirstPlayer: boolean) => {
      try {
          const robotNamesPool = ['R2-D2', 'C-3PO', 'HAL 9000', 'Wall-E', 'T-800', 'Data', 'Bender', 'Marvin', 'Bishop', 'GLaDOS', 'Auto', 'EVE'];
          const shuffledRobots = [...robotNamesPool].sort(() => 0.5 - Math.random());

          const playerNames = ['Thierry'];
          for (let i = 1; i < playerCount; i++) {
              playerNames.push(shuffledRobots[i-1]);
          }

          const seats: SeatConfig[] = playerNames.map((name, index) => (
            index === 0 ? { name, type: 'human' } : { name, type: 'robot', aiDifficulty: difficulty as AIDifficulty }
          ));
          GameSetup.newGame(seats, { firstPlayer: isFirstPlayer ? 0 : 'randomOther' }).then(({ game: newGame, entries }) => {
          // Journal de départ : les entrées de mise en place écrites par la partie
          onLoadGame(newGame, entries);

          setNewGameModalVisible(false);
          setToast({ message: "Nouvelle partie commencée !", visible: true });
        });
      } catch (e) {
          console.error(e);
          setToast({ message: "Erreur lors de la création de la partie", visible: true });
      }
  };

  const handleSaveGame = async () => {
      if (!game) return;
      try {
          const gameState = JSON.stringify(serializeGame(game, historyLog), null, 2);

          // Utiliser l'API File System Access si disponible pour ouvrir une boîte de dialogue "Enregistrer sous"
          const { showSaveFilePicker } = window as WindowWithSavePicker;
          if (showSaveFilePicker) {
              try {
                  const handle = await showSaveFilePicker({
                      suggestedName: `seti_save_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
                      types: [{
                          description: 'Sauvegarde SETI',
                          accept: { 'application/json': ['.json'] },
                      }],
                  });
                  const writable = await handle.createWritable();
                  await writable.write(gameState);
                  await writable.close();
                  setVisible(false);
                  return;
              } catch (err) {
                  if (err instanceof Error && err.name === 'AbortError') return; // Annulation utilisateur
                  // Sinon continuer vers le fallback
              }
          }

          const blob = new Blob([gameState], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `seti_save_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          setVisible(false);
      } catch (e) {
          setToast({ message: "Erreur lors de la sauvegarde: " + e, visible: true });
      }
  };

  const handleLoadGame = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            document.body.removeChild(input);
            return;
          }

          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const savedState = event.target?.result as string;
                  if (savedState) {
                      applySavedGame(savedState);
                  }
              } catch (e) {
                  console.error(e);
                  setToast({ message: e instanceof SaveVersionError ? e.message : "Erreur lors du chargement.", visible: true });
              }
              document.body.removeChild(input);
          };
          reader.readAsText(file);
      };
      input.click();
  };

  const handleContinue = () => {
      try {
          const savedState = readAutosave();
          if (savedState) {
              applySavedGame(savedState);
          }
      } catch (e) {
          console.error(e);
          setToast({ message: e instanceof SaveVersionError ? e.message : "Erreur lors de la restauration.", visible: true });
      }
  };

  return (
    <>
      {visible && (
        <div className="seti-modal-overlay" style={{ zIndex: 2000 }}>
          <div className="seti-modal-content seti-settings-modal">
            <h2 className="seti-modal-title">Menu Principal</h2>
            <div className="seti-modal-buttons-vertical">
              {hasAutosave && <button onClick={handleContinue} className="seti-modal-btn primary">Continuer la partie</button>}
              <button onClick={handleNewGameRequest} className={`seti-modal-btn ${!hasAutosave ? 'primary' : ''}`}>Nouvelle Partie</button>
              <button onClick={handleSaveGame} className="seti-modal-btn">Sauvegarder Partie</button>
              <button onClick={handleLoadGame} className="seti-modal-btn">Restaurer Partie</button>
              {onResumeOnline && <button onClick={() => { setVisible(false); onResumeOnline(); }} className="seti-modal-btn">Reprendre la partie en ligne</button>}
              {onLeaveOnline && <button onClick={onLeaveOnline} className="seti-modal-btn">Quitter la partie en ligne</button>}
              {onOnline && <button onClick={() => { setVisible(false); onOnline(); }} className="seti-modal-btn">Partie en ligne</button>}
              {(game || canClose) && <button onClick={() => setVisible(false)} className="seti-modal-btn secondary">Fermer</button>}
            </div>
            <label className="seti-settings-option">
              <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} />
              Outils de débogage
            </label>
            <div className="seti-settings-version">{versionLabel()}</div>
          </div>
        </div>
      )}
      <NewGameModal
        visible={newGameModalVisible}
        onConfirm={handleNewGameConfirm}
        onCancel={() => { setNewGameModalVisible(false); setVisible(true); }}
      />
    </>
  );
};
