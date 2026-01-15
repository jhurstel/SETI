import React from 'react';
import { Game, Technology, TechnologyCategory, TechnologyBonus, GAME_CONSTANTS } from '../core/types';

interface TechnologyBoardUIProps {
  game: Game;
  isResearching?: boolean;
  onTechClick?: (tech: Technology) => void;
  hasPerformedMainAction?: boolean;
}

export const TechnologyBoardUI: React.FC<TechnologyBoardUIProps> = ({ game, isResearching, onTechClick, hasPerformedMainAction }) => {
  const techBoard = game.board.technologyBoard;
  const categories = techBoard.categorySlots || [];
  const currentPlayer = game.players[game.currentPlayerIndex];
  const canAffordResearch = !hasPerformedMainAction && currentPlayer.mediaCoverage >= (GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA || 6);

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

  const renderBonus = (bonus: TechnologyBonus, excludeExtraPv: boolean) => {
    const elements = [];
    let pv = bonus.pv || 0;
    if (excludeExtraPv) pv -= 2;

    if (pv > 0) elements.push(<span key="pv" style={{ color: '#8affc0', fontWeight: 'bold' }}>{pv} PV</span>);
    if (bonus.media) elements.push(<span key="media" style={{ color: '#ff6b6b' }}>{bonus.media} Média</span>);
    if (bonus.energy) elements.push(<span key="energy" style={{ color: '#4caf50' }}>{bonus.energy} Énergie</span>);
    if (bonus.card) elements.push(<span key="card" style={{ color: '#fff' }}>{bonus.card} Carte</span>);
    if (bonus.probe) elements.push(<span key="probe" style={{ color: '#fff', border: '1px solid #fff', padding: '0 2px', borderRadius: '2px' }}>{bonus.probe} Sonde</span>);
    if (bonus.data) elements.push(<span key="data" style={{ color: '#fff', border: '1px solid #aaa', padding: '0 2px', borderRadius: '2px', backgroundColor: '#333' }}>{bonus.data} Data</span>);
    
    return <div style={{ fontSize: '0.7em', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>{elements}</div>;
  };

  // Fonction pour obtenir le chemin de l'image SVG d'une technologie
  // À utiliser une fois les fichiers extraits et placés dans le dossier public/assets/technologies/
  const getTechImage = (baseId: string): string | undefined => {
    // Exemple : return `/assets/technologies/${baseId}.svg`;
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
                {stacks.map((stack, index) => {
                  if (stack.length === 0) return null;
                  const topCard = stack[0];
                  const count = stack.length;
                  
                  const lastDashIndex = topCard.id.lastIndexOf('-');
                  const baseId = topCard.id.substring(0, lastDashIndex);
                  const techImage = getTechImage(baseId);
                  
                  const isClickable = isResearching || canAffordResearch;

                  // Détection du bonus supplémentaire de 2 PV (logique basée sur les valeurs initiales)
                  const hasExtraPv = (topCard.bonus.pv === 5) || (topCard.bonus.pv === 2 && (topCard.bonus.media || topCard.bonus.card || topCard.bonus.energy));
                  
                  return (
                    <div 
                      key={topCard.id} 
                      className="seti-tech-card"
                      onClick={() => isClickable && onTechClick && onTechClick(topCard)}
                      title={`${topCard.name}: ${topCard.description} (${count} restants)`}
                      style={{
                        border: isResearching ? '2px solid #00ff00' : `1px solid ${categoryColor}`,
                        backgroundColor: 'rgba(30, 30, 40, 0.8)',
                        padding: '8px',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        position: 'relative',
                        cursor: isClickable ? 'pointer' : 'default',
                        opacity: isClickable ? 1 : 0.7,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        minHeight: '80px',
                        boxShadow: isResearching 
                          ? '0 0 10px rgba(0, 255, 0, 0.3)' 
                          : (count > 1 ? '2px 2px 0px rgba(255,255,255,0.1)' : 'none'),
                        transition: 'all 0.2s ease',
                        overflow: 'hidden'
                      }}
                    >
                      {hasExtraPv && (
                        <div style={{
                            position: 'absolute',
                            top: '7px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: '#8affc0',
                            color: '#000',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7em',
                            fontWeight: 'bold',
                            zIndex: 10,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            border: '1px solid #fff'
                        }}>
                            +2
                        </div>
                      )}
                      
                      {techImage ? (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          backgroundImage: `url(${techImage})`, 
                          backgroundSize: 'contain', 
                          backgroundRepeat: 'no-repeat', 
                          backgroundPosition: 'center',
                          minHeight: '80px'
                        }}>
                           <div style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 6px', fontSize: '0.7em', borderRadius: '0 0 0 4px' }}>
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
    </div>
  );
};
