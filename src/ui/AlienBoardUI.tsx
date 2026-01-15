import React from 'react';
import { Game, LifeTraceSlot, LifeTraceTrack } from '../core/types';

interface AlienBoardUIProps {
  game: Game;
  onTrackClick?: (color: string) => void;
  highlightColor?: string;
}

export const AlienBoardUI: React.FC<AlienBoardUIProps> = ({ game, onTrackClick, highlightColor }) => {
  // On suppose que game.discoveredSpecies existe (basé sur la logique de DataSystem)
  const discoveredSpecies = (game as any).discoveredSpecies || [];
  const alienBoard = game.board.alienBoard;

  const renderSlot = (slot: LifeTraceSlot, label: string) => {
    const isFilled = !!slot.playerId;
    return (
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        border: '1px solid #777',
        backgroundColor: isFilled ? '#fff' : 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7em', color: isFilled ? '#000' : '#aaa',
        position: 'relative',
        flexDirection: 'column',
        lineHeight: '1',
        margin: '5px 0'
      }} title={label}>
        {isFilled ? '👤' : (
          <>
            <div style={{ fontWeight: 'bold', color: '#fff' }}>{slot.bonus.pv}</div>
            {slot.bonus.media && <div style={{ fontSize: '0.8em', color: '#ff6b6b' }}>+{slot.bonus.media}M</div>}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="seti-panel">
      <div className="seti-panel-title">Alien</div>
      
      {/* Traces de vie - Style identique au plateau Technologie */}
      <div className="seti-tech-categories">
        
        {/* Observation (Red) */}
        <div 
          className="seti-tech-category" 
          onClick={() => onTrackClick && onTrackClick('red')}
          style={{ 
            cursor: onTrackClick && highlightColor === 'red' ? 'pointer' : 'default',
            border: highlightColor === 'red' ? '2px solid #ff6b6b' : '1px solid transparent',
            boxShadow: highlightColor === 'red' ? '0 0 10px rgba(255, 107, 107, 0.3)' : 'none'
          }}
        >
          <div className="seti-tech-category-title" style={{ color: '#ff6b6b' }}>
            Observation
          </div>
          <div className="seti-tech-slots" style={{ flexDirection: 'column', height: 'auto', padding: '10px 0', gap: '5px' }}>
             {alienBoard && renderSlot(alienBoard.red.slot1, '1er: 5 PV + 1 Media')}
             {alienBoard && renderSlot(alienBoard.red.slot2, '2ème: 3 PV + 1 Media')}
             <div style={{ fontSize: '0.7em', color: '#888', marginTop: '5px' }}>&gt; 3 PV</div>
          </div>
        </div>

        {/* Exploration (Yellow) */}
        <div 
          className="seti-tech-category"
          onClick={() => onTrackClick && onTrackClick('yellow')}
          style={{ 
            cursor: onTrackClick && highlightColor === 'yellow' ? 'pointer' : 'default',
            border: highlightColor === 'yellow' ? '2px solid #ffeb3b' : '1px solid transparent',
            boxShadow: highlightColor === 'yellow' ? '0 0 10px rgba(255, 235, 59, 0.3)' : 'none'
          }}
        >
          <div className="seti-tech-category-title" style={{ color: '#ffeb3b' }}>
            Exploration
          </div>
          <div className="seti-tech-slots" style={{ flexDirection: 'column', height: 'auto', padding: '10px 0', gap: '5px' }}>
             {alienBoard && renderSlot(alienBoard.yellow.slot1, '1er: 5 PV + 1 Media')}
             {alienBoard && renderSlot(alienBoard.yellow.slot2, '2ème: 3 PV + 1 Media')}
             <div style={{ fontSize: '0.7em', color: '#888', marginTop: '5px' }}>&gt; 3 PV</div>
          </div>
        </div>

        {/* Ordinateur (Blue) */}
        <div 
          className="seti-tech-category"
          onClick={() => onTrackClick && onTrackClick('blue')}
          style={{ 
            cursor: onTrackClick && highlightColor === 'blue' ? 'pointer' : 'default',
            border: highlightColor === 'blue' ? '2px solid #4a9eff' : '1px solid transparent',
            boxShadow: highlightColor === 'blue' ? '0 0 10px rgba(74, 158, 255, 0.3)' : 'none'
          }}
        >
          <div className="seti-tech-category-title" style={{ color: '#4a9eff' }}>
            Ordinateur
          </div>
          <div className="seti-tech-slots" style={{ flexDirection: 'column', height: 'auto', padding: '10px 0', gap: '5px' }}>
             {alienBoard && renderSlot(alienBoard.blue.slot1, '1er: 5 PV + 1 Media')}
             {alienBoard && renderSlot(alienBoard.blue.slot2, '2ème: 3 PV + 1 Media')}
             <div style={{ fontSize: '0.7em', color: '#888', marginTop: '5px' }}>&gt; 3 PV</div>
          </div>
        </div>

      </div>

      <div style={{ padding: '10px', borderTop: '1px solid #444', marginTop: '5px' }}>
        <div style={{ fontSize: '0.9em', marginBottom: '10px', color: '#ddd', textTransform: 'uppercase', letterSpacing: '1px' }}>Espèces découvertes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '50px' }}>
        {discoveredSpecies.length > 0 ? (
          discoveredSpecies.map((species: any) => (
            <div key={species.id} style={{ 
              padding: '8px', 
              backgroundColor: 'rgba(0, 255, 128, 0.1)', 
              border: '1px solid rgba(0, 255, 128, 0.3)', 
              borderRadius: '4px' 
            }}>
              <div style={{ fontWeight: 'bold', color: '#8affc0' }}>{species.name}</div>
              {species.discoveredAt && <div style={{ fontSize: '0.8em', color: '#aaa' }}>Découvert !</div>}
            </div>
          ))
        ) : (
          <div style={{ 
            color: '#666', 
            textAlign: 'center', 
            fontStyle: 'italic', 
            fontSize: '0.9em',
          }}>
            Aucune espèce découverte
          </div>
        )}
      </div>
    </div>
    </div>
  );
};