import React, { useState, useEffect } from 'react';
import { AIDifficulty, Game, HistoryEntry } from '../../core/types';
import { NewGameModal } from './NewGameModal';
import { serializeGame, deserializeGame, SaveVersionError } from '../../core/GamePersistence';
import { readAutosave } from '../hooks/useAutosave';
import './SettingsModal.css';
import { versionLabel } from '../version';
import { SpaceBackdrop } from '../components/SpaceBackdrop';
import { GameSetup, SeatConfig } from '../../session/GameSetup';
import { historyTimeline } from '../../core/historyTimeline';
import { HistoryProgressBar } from '../components/HistoryProgressBar';

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
  /** Ouvre la documentation du jeu */
  onDocumentation?: () => void;
}

/** Résumé de la partie sauvegardée pour la carte « Continuer » : barre de progression des manches et des tours */
function autosaveSummary(json: string | null): React.ReactNode {
  if (!json) return null;
  try {
    const save = JSON.parse(json) as { maxRounds?: number; players?: { id: string; name: string; color: string }[]; gameLog?: HistoryEntry[] };
    const rounds = historyTimeline(save.gameLog ?? []);
    if (rounds.length === 0) return null;
    return <HistoryProgressBar rounds={rounds} maxRounds={save.maxRounds ?? 5} players={save.players ?? []} compact />;
  } catch {
    return null;
  }
}

/** Icônes des cartes de l'accueil (traits, couleur du texte) */
const Icon: React.FC<{ path: string }> = ({ path }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);
const ICONS = {
  play: 'M8 5.5v13l10.5-6.5z',
  rocket: 'M12 2.5c3.5 2.2 5 5.8 5 9.5l-2 3H9l-2-3c0-3.7 1.5-7.3 5-9.5zM12 9.5a1.6 1.6 0 1 0 0 .01M9 15l-2.5 4 3-1M15 15l2.5 4-3-1M12 17v4',
  online: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z',
  resume: 'M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5M12 8v4l3 2',
  leave: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  back: 'M10 6l-6 6 6 6M4 12h16',
};

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
  onDocumentation,
}) => {
  const [newGameModalVisible, setNewGameModalVisible] = useState(false);
  const [hasAutosave, setHasAutosave] = useState(false);
  const [savedSummary, setSavedSummary] = useState<React.ReactNode>(null);

  // Vérifier s'il y a une sauvegarde automatique au démarrage ou à l'ouverture
  useEffect(() => {
    const autosave = readAutosave();
    setHasAutosave(!!autosave);
    setSavedSummary(autosaveSummary(autosave));
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

  const canGoBack = !!(game || canClose);
  const card = (key: string, icon: keyof typeof ICONS, title: string, subtitle: React.ReactNode, onClick: () => void, primary = false) => (
    <button key={key} className={`seti-home-card ${primary ? 'primary' : ''}`} onClick={onClick}>
      <span className="seti-home-card-icon"><Icon path={ICONS[icon]} /></span>
      <span className="seti-home-card-text">
        <span className="seti-home-card-title">{title}</span>
        <span className="seti-home-card-subtitle">{subtitle}</span>
      </span>
    </button>
  );

  return (
    <>
      {(visible || newGameModalVisible) && !canGoBack && <SpaceBackdrop />}
      {visible && (
        <div className="seti-home" role="dialog" aria-label="Accueil">
          <SpaceBackdrop />
          {canGoBack && (
            <button className="seti-home-link seti-home-close" onClick={() => setVisible(false)}>
              <Icon path={ICONS.back} /> Retour au jeu
            </button>
          )}
          <div className="seti-home-content">
            <div className="seti-home-hero">
              <img className="seti-home-logo" src="logo-seti.png" alt="SETI" />
              <div className="seti-home-wave" aria-hidden="true">
                {Array.from({ length: 27 }, (_, i) => <span key={i} style={{ animationDelay: `${-(i * 0.13) % 1.6}s`, height: `${30 + ((i * 37) % 70)}%` }} />)}
              </div>
              <p className="seti-home-tagline">À la recherche d'une vie extraterrestre</p>
            </div>

            <div className="seti-home-actions">
              {hasAutosave && card('continue', 'play', 'Continuer la partie', savedSummary || 'Reprendre la partie sauvegardée', handleContinue, true)}
              {card('new', 'rocket', 'Nouvelle partie', 'Jouer en solo contre des bots', handleNewGameRequest, !hasAutosave)}
              {onResumeOnline && card('resume-online', 'resume', 'Reprendre en ligne', 'Retrouver votre place dans la salle', () => { setVisible(false); onResumeOnline(); })}
              {onOnline && card('online', 'online', 'Partie en ligne', 'Créer une salle et jouer avec des amis', () => { setVisible(false); onOnline(); })}
              {onLeaveOnline && card('leave-online', 'leave', 'Quitter la partie en ligne', 'Votre place reste reprenable', onLeaveOnline)}
            </div>

            <div className="seti-home-footer">
              <button className="seti-home-link" onClick={handleLoadGame}>Restaurer une sauvegarde</button>
              {game && <button className="seti-home-link" onClick={handleSaveGame}>Sauvegarder la partie</button>}
              {onDocumentation && <button className="seti-home-link" onClick={onDocumentation}>Documentation</button>}
              <a className="seti-home-link" href="docs/seti-rules-fr.pdf" target="_blank" rel="noopener noreferrer">Règles (PDF)</a>
              <a className="seti-home-link" href="docs/SETI-FAQ-FR.pdf" target="_blank" rel="noopener noreferrer">FAQ (PDF)</a>
              <label className="seti-home-option">
                <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} />
                Outils de débogage
              </label>
              <span className="seti-home-version">{versionLabel()}</span>
            </div>
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
