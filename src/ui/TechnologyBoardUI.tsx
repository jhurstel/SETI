import React, { useState, useEffect } from 'react';
import { Game, Technology, TechnologyCategory, Bonus, InteractionState, GAME_CONSTANTS } from '../core/types';
import { TECHNOLOGY_STYLES } from './styles/celestialStyles';
import './TechnologyBoardUI.css';

interface TechnologyBoardUIProps {
  game: Game;
  interactionState: InteractionState;
  onTechClick: (tech: Technology) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export const TechnologyBoardUI: React.FC<TechnologyBoardUIProps> = ({ game, interactionState, onTechClick, setActiveTooltip }) => {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const techBoard = game.board.technologyBoard;

  const isAcquiringTech = interactionState.type === 'ACQUIRING_TECH';
  const [isOpen, setIsOpen] = useState(isAcquiringTech);

  const canResearch = !currentPlayer.hasPerformedMainAction && interactionState.type === 'IDLE' && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;
  const researchCategories = isAcquiringTech ? interactionState.categories : undefined;
  const sharedTechOnly = isAcquiringTech ? interactionState.sharedOnly : false;

  useEffect(() => {
    setIsOpen(isAcquiringTech);
  }, [isAcquiringTech]);

  // Calculer les technologies partagées si nécessaire
  const sharedBaseIds = React.useMemo(() => {
    if (!sharedTechOnly) return new Set<string>();
    const ids = new Set<string>();
    game.players.forEach(p => {
      if (p.id === currentPlayer.id) return;
      p.technologies.forEach(t => {
        const baseId = t.id.substring(0, t.id.lastIndexOf('-'));
        ids.add(baseId);
      });
    });
    return ids;
  }, [game.players, currentPlayer.id, sharedTechOnly]);

  // Fonction pour regrouper les technologies par pile (même ID de base)
  const getStacks = (technologies: Technology[]) => {
    const stacks = new Map<string, Technology[]>();
    technologies.forEach(tech => {
      // L'ID est sous la forme "baseId-index" (ex: "exploration-1-1")
      // On veut regrouper par "exploration-1"
      const lastDashIndex = tech.id.lastIndexOf('-');
      const baseId = tech.id.substring(0, lastDashIndex);
      
      if (!stacks.has(baseId)) {
        stacks.set(baseId, []);
      }
      stacks.get(baseId)!.push(tech);
    });
    return Array.from(stacks.values());
  };

  const getCategoryIcon = (category: TechnologyCategory) => {
    if (category === TechnologyCategory.EXPLORATION) return '🚀';
    if (category === TechnologyCategory.OBSERVATION) return '🔭';
    if (category === TechnologyCategory.COMPUTING) return '💻';
    return '⚙️';
  };

  const renderBonus = (bonus: Bonus, excludeExtraPv: boolean) => {
    const elements = [];
    let pv = bonus.pv || 0;
    if (excludeExtraPv) pv -= 2;

    if (pv > 0) elements.push(<span key="pv" style={{ color: '#8affc0', fontWeight: 'bold' }}>{pv} PV</span>);
    if (bonus.media) elements.push(<span key="media" style={{ color: '#ff6b6b' }}>{bonus.media} Média</span>);
    if (bonus.energy) elements.push(<span key="energy" style={{ color: '#4caf50' }}>{bonus.energy} Énergie</span>);
    if (bonus.card) elements.push(<span key="card" style={{ color: '#fff' }}>{bonus.card} Carte</span>);
    if (bonus.probe) elements.push(<span key="probe" style={{ color: '#fff', border: '1px solid #fff', padding: '0 2px', borderRadius: '2px' }}>{bonus.probe} Sonde</span>);
    if (bonus.data) elements.push(<span key="data" style={{ color: '#fff', border: '1px solid #aaa', padding: '0 2px', borderRadius: '2px', backgroundColor: '#333' }}>{bonus.data} Data</span>);
    
    return <div className="seti-tech-bonus-container">{elements}</div>;
  };

  return (
    <div className={`seti-foldable-container seti-icon-panel ${isOpen ? 'open' : 'collapsed'} ${canResearch && !isOpen ? 'container-flash' : ''}`}
      style={{
        pointerEvents: 'auto',
        ...(isAcquiringTech ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
      }}
    >
      <div className="seti-foldable-header" onClick={() => setIsOpen(!isOpen)}>
        <span className={`panel-icon ${canResearch ? 'icon-flash' : ''}`}>🔬</span>
        <span className="panel-title">Technologies</span>
      </div>
      <div className="seti-foldable-content">
      <div className="seti-tech-categories">
        {techBoard.categorySlots && techBoard.categorySlots.map((slot) => {
          const stacks = getStacks(slot.technologies);
          const techStyle = TECHNOLOGY_STYLES[slot.category] || TECHNOLOGY_STYLES.DEFAULT;

          return (
            <div key={slot.category} className="seti-tech-category">
              <div className="seti-tech-category-title" style={{ color: techStyle.color, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2em' }}>{getCategoryIcon(slot.category)}</span>
                {slot.category}
              </div>
              <div className="seti-tech-slots">
                {stacks.map(stack => {
                  if (stack.length === 0) return null;
                  const topCard = stack[0];
                  const count = stack.length;
                  
                  const lastDashIndex = topCard.id.lastIndexOf('-');
                  const baseId = topCard.id.substring(0, lastDashIndex);
                  
                  const hasTech = currentPlayer.technologies.some(t => {
                    const tLastDash = t.id.lastIndexOf('-');
                    return t.id.substring(0, tLastDash) === baseId;
                  });

                  const isClickable = (isAcquiringTech || canResearch) 
                    && (!researchCategories || researchCategories.includes(slot.category))
                    && (!sharedTechOnly || sharedBaseIds.has(baseId))
                    && !hasTech;

                  // Détection du bonus supplémentaire de 2 PV (logique basée sur les valeurs initiales)
                  const hasExtraPv = (topCard.bonus.pv === 5) || (topCard.bonus.pv === 2 && !!(topCard.bonus.media || topCard.bonus.card || topCard.bonus.energy));
                  
                  // Construction des classes CSS
                  let cardClass = 'seti-tech-card';
                  if (hasTech) {
                    cardClass += ' acquired';
                  } else if (isClickable) {
                    cardClass += ' clickable';
                  } else {
                    cardClass += ' default';
                  }
                  if (count > 1 && !isClickable) {
                    cardClass += ' stacked';
                  }

                  return (
                    <div 
                      key={topCard.id} 
                      className={cardClass}
                      onClick={() => isClickable && onTechClick && onTechClick(topCard)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: (
                        <div className="seti-tech-tooltip-content">
                          <div className="seti-tech-tooltip-header">
                            <span className="seti-tech-tooltip-name">{topCard.name}</span>
                            <span className="seti-tech-tooltip-category" style={{ color: techStyle.color, borderColor: techStyle.borderColor }}>{slot.category}</span>
                          </div>
                          {hasTech && <div className="seti-tech-tooltip-acquired">Déjà acquis</div>}
                          <div className="seti-tech-tooltip-desc">{topCard.description || topCard.shorttext}</div>
                          <div className="seti-tech-tooltip-bonus">
                            <div style={{ fontSize: '0.7em', color: '#aaa', marginBottom: '2px' }}>Gains immédiats :</div>
                            {renderBonus(topCard.bonus, false)}
                          </div>
                          <div className="seti-tech-tooltip-count">
                            {count} exemplaire{count > 1 ? 's' : ''} restant{count > 1 ? 's' : ''}
                          </div>
                        </div>
                        ), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                      style={{
                        border: (!hasTech && !isClickable)
                          ? (isAcquiringTech ? '1px solid #555' : techStyle.border)
                          : undefined
                      }}
                    >
                      {hasExtraPv && (
                        <div className="seti-tech-card-extra-pv">
                            +2
                        </div>
                      )}
                      
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9em' }}>
                            {topCard.name}
                          </span>
                          <span style={{ 
                            fontSize: '0.6em', 
                            backgroundColor: '#444', 
                            padding: '1px 5px', 
                            borderRadius: '10px',
                            color: '#aaa'
                          }}>
                            x{count}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '0.7em', color: '#ccc', lineHeight: '1.2', flex: 1 }}>
                          {topCard.shorttext}
                        </div>
  
                        <div style={{ marginTop: 'auto', borderTop: '1px solid #555', paddingTop: '4px' }}>
                          {renderBonus(topCard.bonus, hasExtraPv)}
                        </div>
                      </>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};
