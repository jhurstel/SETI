import React from 'react';
import { Player, ComputerSlot } from '../core/types';
import { ComputerSystem } from '../systems/ComputerSystem';
import './PlayerComputerUI.css';

const ComputerSlotUI = ({ 
  slot, 
  onClick, 
  canFill,
  hasData,
  onHover,
  onLeave,
  isPreviousFilled
}: { 
  slot: ComputerSlot, 
  onClick: () => void, 
  canFill: boolean,
  hasData: boolean,
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
  onLeave: () => void,
  isPreviousFilled?: boolean
}) => {
  const isFilled = slot.filled;
  
  let bonusText = '';
  let bonusColor = '#fff';
  let mediaAmount = 1;
  
  if (slot.bonus === 'media') { 
    if (slot.technologyId && slot.technologyId.startsWith('computing-4')) mediaAmount = 2;
    bonusText = `${mediaAmount} Média${mediaAmount > 1 ? 's' : ''}`; 
    bonusColor = '#ff6b6b'; 
  }
  else if (slot.bonus === 'reservation') { bonusText = '1 Réservation'; bonusColor = '#fff'; }
  else if (slot.bonus === '2pv') { bonusText = '2 PV'; bonusColor = '#8affc0'; }
  else if (slot.bonus === 'credit') { bonusText = '1 Crédit'; bonusColor = '#ffd700'; }
  else if (slot.bonus === 'energy') { bonusText = '1 Énergie'; bonusColor = '#4caf50'; }
  else if (slot.bonus === 'card') { bonusText = '1 Carte'; bonusColor = '#aaffaa'; }

  let state: 'occupied' | 'clickable' | 'unavailable' = 'unavailable';
  if (isFilled) state = 'occupied';
  else if (canFill) state = 'clickable';

  let titleLine = null;
  let actionLine = null;

  const bonusLine = (
    <div className="computer-tooltip-bonus">
      {bonusText ? (
        <>Bonus : <span style={{ color: bonusColor, fontWeight: 'normal' }}>{bonusText}</span></>
      ) : (
        'Aucun bonus'
      )}
    </div>
  );

  if (state === 'occupied') {
    titleLine = <div className="computer-tooltip-title occupied">Donnée stockée</div>
  } else if (state === 'clickable') {
    titleLine = <div className="computer-tooltip-title available">Disponible</div>
    actionLine = <div className="computer-tooltip-action normal">Cliquez pour transférer une donnée</div>;
  } else {
    titleLine = <div className="computer-tooltip-title unavailable">Indisponible</div>
    if (isPreviousFilled && slot.type !== 'top' && !slot.bonus) {
      actionLine = <div className="computer-tooltip-action normal">Nécessite une technologie informatique</div>;
    } else if (!hasData) {
      actionLine = <div className="computer-tooltip-action error">Nécessite 1 donnée</div>;
    } else {
      actionLine = <div className="computer-tooltip-action normal">Nécessite le slot précédent</div>;
    }
  }
  
  const tooltipContent = (
      <div className="computer-tooltip-container">
          {titleLine}
          {bonusLine}
          {actionLine}
      </div>
  );

  return (
    <div
      onClick={canFill && !isFilled ? onClick : undefined}
      className={`computer-slot ${isFilled ? 'filled' : ''} ${canFill && !isFilled ? 'can-fill' : ''}`}
      onMouseEnter={(e) => onHover(e, tooltipContent)}
      onMouseLeave={onLeave}
      style={{ cursor: canFill && !isFilled ? 'pointer' : 'help' }}
    >
      {isFilled && <div className="computer-slot-dot" />}
      {!isFilled && slot.bonus === 'media' && <span className="computer-slot-bonus media">{mediaAmount > 1 ? '2' : ''}🎤</span>}
      {!isFilled && slot.bonus === 'reservation' && <span className="computer-slot-bonus reservation">📥</span>}
      {!isFilled && slot.bonus === '2pv' && <span className="computer-slot-bonus pv">2🏆</span>}
      {!isFilled && slot.bonus === 'credit' && <span className="computer-slot-bonus credit">₢</span>}
      {!isFilled && slot.bonus === 'energy' && <span className="computer-slot-bonus energy">⚡</span>}
      {!isFilled && slot.bonus === 'card' && <span className="computer-slot-bonus card">🃏</span>}
    </div>
  );
};

export const PlayerComputerUI = ({ 
  player, onSlotClick, isSelecting, onColumnSelect, isAnalyzing, disabled, onHover, onLeave 
}: { 
  player: Player, onSlotClick: (slotId: string) => void, isSelecting?: boolean, onColumnSelect?: (col: number) => void, isAnalyzing?: boolean, disabled?: boolean,
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
  onLeave: () => void
}) => {
  const slots = player.dataComputer.slots;
  const columns = [1, 2, 3, 4, 5, 6];
  const hasData = (player.data || 0) > 0;

  return (
    <div className={`player-computer-container ${isAnalyzing ? 'analyzing-container' : ''}`}>
      {/* Animation de scan */}
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
              {colSlots.map((slot: any, slotIndex: number) => (
                <ComputerSlotUI 
                  key={slot.id} 
                  slot={slot} 
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
              <div 
                className="computer-separator"
                style={{
                  marginLeft: separatorLeftMargin,
                  marginRight: separatorRightMargin,
                }} 
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};