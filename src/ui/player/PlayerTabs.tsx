import React, { useEffect, useRef, useState } from 'react';
import { CardType, Game } from '../../core/types';
import { DocumentationIcon, SettingsIcon } from '../components/GameIcons';
import { PlayerKindIcon } from '../components/PlayerKindIcon';

/**
 * Onglets des joueurs (couleur du joueur affiché, premier joueur, joueur actif ; flash vert quand les ressources d'un
 * autre joueur augmentent), puis les boutons Documentation et Paramètres
 */
export const PlayerTabs: React.FC<{
  game: Game;
  /** Joueur dont le plateau est affiché */
  viewedId: string;
  /** Partie en ligne : joueurs humains d'un autre écran (silhouette humaine) */
  remoteHumanIds: string[];
  onViewPlayer: (playerId: string) => void;
  onDocumentationClick: () => void;
  onSettingsClick: () => void;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}> = ({ game, viewedId, remoteHumanIds, onViewPlayer, onDocumentationClick, onSettingsClick, handleTooltipHover, handleTooltipLeave }) => {
  // Suivi des changements de ressources pour la notification sur les onglets
  const [tabFlashes, setTabFlashes] = useState<Record<string, boolean>>({});
  const prevResourcesRef = useRef<Record<string, { credits: number, energy: number, media: number, data: number, cards: number }>>({});

  useEffect(() => {
    const newFlashes: Record<string, boolean> = {};
    let hasChanges = false;

    game.players.forEach(p => {
      const prev = prevResourcesRef.current[p.id];
      const current = { credits: p.credits, energy: p.energy, media: p.mediaCoverage, data: p.data || 0, cards: p.cards.filter(c => c.type !== CardType.EXERTIEN).length };
      
      if (prev) {
        if (current.credits > prev.credits || current.energy > prev.energy || current.media > prev.media || current.data > prev.data || current.cards > prev.cards) {
           // Si ce joueur n'est pas celui actuellement affiché, faire clignoter l'onglet
           if (p.id !== viewedId) {
             newFlashes[p.id] = true;
             hasChanges = true;
           }
        }
      }
      prevResourcesRef.current[p.id] = current;
    });

    if (hasChanges) {
      setTabFlashes(prev => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setTabFlashes({});
      }, 1000);
      return () => clearTimeout(timer);
    }
    return;
  }, [game, viewedId]);

  return (
  <div className="seti-player-tabs">
    {game.players.map((p, index) => {
       const isViewed = p.id === viewedId;
       const isActive = p.id === game.players[game.currentPlayerIndex].id;
       const isFirstPlayer = index === game.firstPlayerIndex;
       const shouldFlash = tabFlashes[p.id];

       return (
         <div 
           key={p.id}
           className={`seti-player-tab ${isActive ? 'active' : 'inactive'}`}
           onClick={() => onViewPlayer && onViewPlayer(p.id)}
           style={{
             backgroundColor: shouldFlash ? '#4caf50' : (isViewed ? (p.color || '#444') : '#2a2a2a'),
             borderBottom: isViewed ? `1px solid ${p.color || '#444'}` : '1px solid #555',
             opacity: isViewed ? 1 : 0.7,
           }}
         >
           {/* Silhouette pour un humain (en ligne, les autres joueurs humains comptent ici comme robots), force du niveau pour un robot */}
           <PlayerKindIcon player={remoteHumanIds.includes(p.id) ? { type: 'human' } : p} /> {p.name}
           {isFirstPlayer && <span>👑</span>}
           {isActive && <span className="seti-player-tab-indicator"></span>}
         </div>
       );
    })}
    {/* Documentation et paramètres : icônes de même taille, alignées */}
    <button type="button" onClick={onDocumentationClick} className="seti-header-icon-btn" aria-label="Documentation"
        onMouseEnter={(e) => handleTooltipHover(e, <div className="seti-tooltip-content">Documentation</div>)} onMouseLeave={handleTooltipLeave}>
        <DocumentationIcon />
    </button>
    <button type="button" onClick={onSettingsClick} className="seti-header-icon-btn" aria-label="Paramètres"
        onMouseEnter={(e) => handleTooltipHover(e, <div className="seti-tooltip-content">Paramètres</div>)} onMouseLeave={handleTooltipLeave}>
        <SettingsIcon />
    </button>
  </div>
  );
};
