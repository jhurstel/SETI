import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Game, Technology, TechnologyCategory, Bonus, GAME_CONSTANTS } from '../core/types';
import './TechnologyBoardUI.css';

interface TechnologyBoardUIProps {
  game: Game;
  isResearching?: boolean;
  researchCategory?: TechnologyCategory;
  onTechClick?: (tech: Technology) => void;
  hasPerformedMainAction?: boolean;
  sharedTechOnly?: boolean;
}

const Tooltip = ({ content, targetRect }: { content: React.ReactNode, targetRect: DOMRect }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const tooltipId = useRef(Math.random().toString(36).substr(2, 9));

  useLayoutEffect(() => {
    if (tooltipRef.current && targetRect) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;
      const padding = 10;

      let left = targetRect.left + (targetRect.width / 2) - (rect.width / 2);

      if (left < padding) left = padding;
      if (left + rect.width > viewportWidth - padding) {
        left = viewportWidth - rect.width - padding;
      }

      let top = targetRect.top - rect.height - margin;

      if (top < padding) {
        const bottomPosition = targetRect.bottom + margin;
        if (bottomPosition + rect.height <= viewportHeight - padding) {
            top = bottomPosition;
        } else {
            if (targetRect.top > (viewportHeight - targetRect.bottom)) {
                top = padding;
            } else {
                top = viewportHeight - rect.height - padding;
            }
        }
      }

      // Gestion des superpositions
      const width = rect.width;
      const height = rect.height;
      let finalTop = top;
      let finalLeft = left;
      
      const others = ((window as any).__SETI_TOOLTIPS__ || []).filter((t: any) => t.id !== tooltipId.current);
      let collision = true;
      let iterations = 0;

      while (collision && iterations < 10) {
          collision = false;
          const myRect = { left: finalLeft, top: finalTop, right: finalLeft + width, bottom: finalTop + height };
          
          for (const other of others) {
              const otherRect = other.rect;
              if (myRect.left < otherRect.right &&
                  myRect.right > otherRect.left &&
                  myRect.top < otherRect.bottom &&
                  myRect.bottom > otherRect.top) {
                  
                  finalTop = otherRect.bottom + 5;
                  collision = true;
                  if (finalTop + height > viewportHeight - 10) {
                      finalTop = top;
                      finalLeft = otherRect.right + 5;
                  }
                  break;
              }
          }
          iterations++;
      }

      const registry = (window as any).__SETI_TOOLTIPS__ || [];
      (window as any).__SETI_TOOLTIPS__ = [...registry.filter((t: any) => t.id !== tooltipId.current), { id: tooltipId.current, rect: { left: finalLeft, top: finalTop, right: finalLeft + width, bottom: finalTop + height } }];

      setStyle({
        top: finalTop,
        left: finalLeft,
        opacity: 1
      });
      return () => {
          const reg = (window as any).__SETI_TOOLTIPS__ || [];
          (window as any).__SETI_TOOLTIPS__ = reg.filter((t: any) => t.id !== tooltipId.current);
      };
    }
    return;
  }, [targetRect, content]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="seti-tech-tooltip"
      style={style}
    >
      {content}
    </div>
  , document.body);
};

export const TechnologyBoardUI: React.FC<TechnologyBoardUIProps> = ({ game, isResearching, researchCategory, onTechClick, hasPerformedMainAction, sharedTechOnly }) => {
  const techBoard = game.board.technologyBoard;
  const categories = techBoard.categorySlots || [];
  const currentPlayer = game.players[game.currentPlayerIndex];
  const canAffordResearch = !hasPerformedMainAction && currentPlayer.mediaCoverage >= (GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA || 6);
  const [customTooltip, setCustomTooltip] = useState<{ content: React.ReactNode, targetRect: DOMRect } | null>(null);

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

  const handleTooltipHover = (e: React.MouseEvent, content: React.ReactNode) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCustomTooltip({
      content,
      targetRect: rect
    });
  };

  const handleTooltipLeave = () => {
    setCustomTooltip(null);
  };

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

  // Fonction pour obtenir le chemin de l'image SVG d'une technologie
  // À utiliser une fois les fichiers extraits et placés dans le dossier public/assets/technologies/
  const getTechImage = (baseId: string): string | undefined => {
    // Exemple : return `/assets/technologies/${baseId}.svg`;
    baseId;
    return undefined;
  };

  return (
    <div className="seti-panel">
      <div className="seti-panel-title">Technologies</div>
      <div className="seti-tech-categories">
        {categories.map((slot) => {
          const stacks = getStacks(slot.technologies);
          
          let categoryColor = '#fff';
          if (slot.category === TechnologyCategory.EXPLORATION) categoryColor = '#ffeb3b';
          if (slot.category === TechnologyCategory.OBSERVATION) categoryColor = '#ff6b6b';
          if (slot.category === TechnologyCategory.COMPUTING) categoryColor = '#4a9eff';

          return (
            <div key={slot.category} className="seti-tech-category">
              <div className="seti-tech-category-title" style={{ color: categoryColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  const techImage = getTechImage(baseId);
                  
                  const hasTech = currentPlayer.technologies.some(t => {
                    const tLastDash = t.id.lastIndexOf('-');
                    return t.id.substring(0, tLastDash) === baseId;
                  });

                  const isClickable = (isResearching || canAffordResearch) 
                    && (!researchCategory || slot.category === researchCategory)
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

                  // Style dynamique pour la bordure (dépend de la catégorie et de l'état)
                  const cardStyle: React.CSSProperties = {};
                  if (!hasTech && !isClickable) {
                     // Bordure par défaut (couleur catégorie) si pas acquis et pas en cours de recherche active
                     // Si isResearching est true mais pas clickable (ex: pas assez de ressources ou mauvaise catégorie), on met une bordure grise
                     if (isResearching) {
                        cardStyle.border = '1px solid #555';
                     } else {
                        cardStyle.border = `1px solid ${categoryColor}`;
                     }
                  }

                  return (
                    <div 
                      key={topCard.id} 
                      className={cardClass}
                      onClick={() => isClickable && onTechClick && onTechClick(topCard)}
                      onMouseEnter={(e) => handleTooltipHover(e, (
                        <div className="seti-tech-tooltip-content">
                          <div className="seti-tech-tooltip-header">
                            <span className="seti-tech-tooltip-name">{topCard.name}</span>
                            <span className="seti-tech-tooltip-category" style={{ color: categoryColor, borderColor: categoryColor }}>{slot.category}</span>
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
                      ))}
                      onMouseLeave={handleTooltipLeave}
                      style={cardStyle}
                    >
                      {hasExtraPv && (
                        <div className="seti-tech-card-extra-pv">
                            +2
                        </div>
                      )}
                      
                      {techImage ? (
                        <div className="seti-tech-card-image" style={{ 
                          backgroundImage: `url(${techImage})`, 
                        }}>
                           <div className="seti-tech-card-count-badge">
                             x{count}
                           </div>
                        </div>
                      ) : (
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {customTooltip && (
        <Tooltip content={customTooltip.content} targetRect={customTooltip.targetRect} />
      )}
    </div>
  );
};
