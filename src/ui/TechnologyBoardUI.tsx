import React from 'react';
import { Game, TechnologyCategory } from '../core/types';

interface TechnologyBoardUIProps {
  game: Game;
}

export const TechnologyBoardUI: React.FC<TechnologyBoardUIProps> = ({ game }) => {
  const techBoard = game.board.technologyBoard;
  const mediaMax = techBoard.mediaTrackMax || 10;
  const rotationToken = techBoard.rotationTokenPosition ?? 0;
  const nextRing = techBoard.nextRingLevel ?? 1;
  const categorySlots = techBoard.categorySlots || [];

  const categoryNames: Record<TechnologyCategory, string> = {
    [TechnologyCategory.EXPLORATION]: 'Exploration',
    [TechnologyCategory.OBSERVATION]: 'Observation',
    [TechnologyCategory.COMPUTING]: 'Informatique',
  };

  return (
    <div className="seti-panel">
      <div className="seti-panel-title">Technologies & Couverture médiatique</div>
      
      {/* Piste de couverture médiatique */}
      <div className="seti-media-track">
        <div className="seti-media-track-label">Couverture médiatique</div>
        <div className="seti-media-track-bar">
          {Array.from({ length: mediaMax + 1 }).map((_, i) => (
            <div key={i} className="seti-media-track-mark">
              {i}
            </div>
          ))}
        </div>
      </div>

      {/* Jeton de rotation */}
      <div className="seti-rotation-token">
        <div className="seti-rotation-token-label">Rotation système</div>
        <div className="seti-rotation-token-info">
          Cadran: {rotationToken + 1} / Anneau: {nextRing}
        </div>
      </div>

      {/* Tuiles technologie par catégorie */}
      <div className="seti-tech-categories">
        {categorySlots.map((slot) => (
          <div key={slot.category} className="seti-tech-category">
            <div className="seti-tech-category-title">
              {categoryNames[slot.category]}
            </div>
            <div className="seti-tech-slots">
              {Array.from({ length: 4 }).map((_, i) => {
                const tech = slot.technologies[i];
                const tooltip = tech 
                  ? `${tech.name}${tech.description ? '\n\n' + tech.description : ''}`
                  : 'Emplacement vide';
                return (
                  <div 
                    key={i} 
                    className="seti-tech-slot"
                    title={tooltip}
                    style={{
                      cursor: tech ? 'help' : 'default',
                    }}
                  >
                    {tech ? tech.name : '—'}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


