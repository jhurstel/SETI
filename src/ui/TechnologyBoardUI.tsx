import React from 'react';
import { Game, TechnologyCategory } from '../core/types';

interface TechnologyBoardUIProps {
  game: Game;
}

export const TechnologyBoardUI: React.FC<TechnologyBoardUIProps> = ({ game }) => {
  const techBoard = game.board.technologyBoard;
  const categorySlots = techBoard.categorySlots || [];

  const categoryNames: Record<TechnologyCategory, string> = {
    [TechnologyCategory.EXPLORATION]: 'Exploration',
    [TechnologyCategory.OBSERVATION]: 'Observation',
    [TechnologyCategory.COMPUTING]: 'Informatique',
  };

  return (
    <div className="seti-panel">
      <div className="seti-panel-title">Technologie</div>

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


