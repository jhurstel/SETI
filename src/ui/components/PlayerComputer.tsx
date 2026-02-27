import React from 'react';
import { Player, GAME_CONSTANTS, ComputerSlot } from '../../core/types';
import { ComputerSystem } from '../../systems/ComputerSystem';
import { PlayerComputerSlot } from './PlayerComputerSlot';
import './PlayerComputer.css';

export const PlayerComputer = ({ 
  player, onSlotClick, isSelecting, onColumnSelect, isAnalyzing, disabled, onHover, onLeave, onAnalyzeClick
}: { 
  player: Player, onSlotClick: (slotId: string) => void, isSelecting?: boolean, onColumnSelect?: (col: number) => void, isAnalyzing?: boolean, disabled?: boolean,
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
  onLeave: () => void,
  onAnalyzeClick?: () => void
}) => {
  const slots = player.dataComputer.slots;
  const columns = [1, 2, 3, 4, 5, 6];
  const hasData = (player.data || 0) > 0;

  return (
    <div className={`player-computer-container ${isAnalyzing ? 'analyzing-container' : ''}`} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-start', width: '100%' }}>
      {/* Animation de scan */}
      {isAnalyzing && (
        <style>
          {`
            @keyframes scanComputer {
              from { left: 0%; }
              to { left: 100%; }
            }
            .scan-line {
              position: absolute;
              top: 0;
              bottom: 0;
              width: 4px;
              background: #00ffff;
              box-shadow: 0 0 15px #00ffff;
              animation: scanComputer 0.8s ease-in-out infinite alternate;
              z-index: 20;
              pointer-events: none;
            }
          `}
        </style>
      )}
      {isAnalyzing && <div className="scan-line" />}

      {columns.map((col, index) => {
        const colSlots = Object.values(slots).filter((s) => s.col === col).sort((a, _b) => a.type === 'top' ? -1 : 1);
        const hasBottom = colSlots.length > 1;
        
        const topSlot = colSlots.find((s) => s.type === 'top');
        const hasTech = topSlot && topSlot.bonus === '2pv';
        const isSelectableColumn = isSelecting && hasBottom && !hasTech; // Only columns with 2 slots (1, 3, 5, 6) are selectable for computing tech

        // Calculate margins for separator to touch circles
        let separatorLeftMargin = 0;
        let separatorRightMargin = 0;
        
        if (index < columns.length - 1) {
            const currentPadding = hasBottom ? 12 : 4;
            const nextCol = columns[index + 1];
            const nextColSlots = Object.values(slots).filter((s) => s.col === nextCol);
            const nextHasBottom = nextColSlots.length > 1;
            const nextPadding = nextHasBottom ? 12 : 4;
            
            separatorLeftMargin = -currentPadding;
            separatorRightMargin = -nextPadding;
        }

        return (
          <React.Fragment key={col}>
            <div 
              onClick={() => isSelectableColumn && onColumnSelect && onColumnSelect(col)}
              className={`computer-column ${hasBottom ? 'has-bottom' : ''} ${isSelectableColumn ? 'selectable' : ''}`}
            >
              {/* Ligne verticale reliant haut et bas */}
              {hasBottom && (
                <div className="computer-column-connector" />
              )}
              {colSlots.map((slot: ComputerSlot, slotIndex: number) => (
                <PlayerComputerSlot
                  key={slot.id} 
                  slot={slot} 
                  currentPlayerColor={player.color} 
                  onClick={() => onSlotClick(slot.id)} 
                  canFill={!disabled && ComputerSystem.canFillSlot(player, slot.id)} 
                  hasData={hasData}
                  onHover={onHover}
                  onLeave={onLeave}
                  isPreviousFilled={slotIndex > 0 ? colSlots[slotIndex - 1].filled : true}
                />
              ))}
            </div>
            {index < columns.length - 1 && (
              <div style={{ flex: 1, position: 'relative', alignSelf: 'flex-start' }}>
                <div 
                  className="computer-separator"
                  style={{
                    position: 'absolute',
                    left: separatorLeftMargin,
                    right: separatorRightMargin,
                    top: 0
                  }} 
                />
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* 7th Slot (Analysis) */}
      {(() => {
          const col6Slots = Object.values(slots).filter((s) => s.col === 6);
          const col6HasBottom = col6Slots.length > 1;
          const leftMargin = -(col6HasBottom ? 12 : 4);
          const rightMargin = -4;
          
          const slot6a = col6Slots.find(s => s.type === 'top');
          const is6aFilled = slot6a ? slot6a.filled : false;
          const hasEnergy = player.energy >= GAME_CONSTANTS.ANALYZE_COST_ENERGY;
          const isAvailable = is6aFilled && hasEnergy;
          const isClickable = isAvailable && !disabled;

          return (
            <>
              <div style={{ flex: 1, position: 'relative', alignSelf: 'flex-start' }}>
                <div 
                  className="computer-separator"
                  style={{
                    position: 'absolute',
                    left: leftMargin,
                    right: rightMargin,
                    top: 0
                  }} 
                />
              </div>
              <div className="computer-column">
                <div
                  className={`computer-slot ${isAvailable ? 'can-fill' : ''} ${isClickable ? 'flash-green' : ''}`}
                  style={{ 
                      cursor: isClickable ? 'pointer' : 'help',
                      borderColor: isClickable ? undefined : (isAvailable ? '#00ffff' : '#444'),
                      color: isClickable ? undefined : (isAvailable ? '#00ffff' : '#444'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2em'
                  }}
                  onClick={() => { if (isClickable && onAnalyzeClick) onAnalyzeClick(); }}
                  onMouseEnter={(e) => {
                      let statusText = "Indisponible";
                      let statusColor = "#ff6b6b";
                      let actionText = "Nécessite de remplir la ligne précédente";

                      if (is6aFilled) {
                          if (hasEnergy) {
                              statusText = "Analyse disponible";
                              statusColor = "#4a9eff";
                              actionText = `Cliquez pour lancer l'analyse des données (Coût: ${GAME_CONSTANTS.ANALYZE_COST_ENERGY} Énergie)`;
                          } else {
                              statusText = "Énergie insuffisante";
                              actionText = `Nécessite ${GAME_CONSTANTS.ANALYZE_COST_ENERGY} Énergie`;
                          }
                      }

                      const content = (
                          <div className="computer-tooltip-container">
                              <div className={`computer-tooltip-title`} style={{ color: statusColor }}>
                                  {statusText}
                              </div>
                              <div className="computer-tooltip-bonus">
                                  <>Bonus : <span style={{ color: '#8affc0', fontWeight: 'normal' }}>1 Trace de Vie Bleu</span></>
                              </div>
                              <div className="computer-tooltip-action normal">
                                  {actionText}
                              </div>
                          </div>
                      );
                      onHover(e, content);
                  }}
                  onMouseLeave={onLeave}
                >
                  👁️
                </div>
              </div>
            </>
          );
      })()}
    </div>
  );
};