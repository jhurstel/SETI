import React from 'react';
import { ComputerSlot } from '../../core/types';
import { SlotTooltip } from './SlotTooltip';
import { ReservationIcon } from './ObjectiveSymbol';
import { ResourceIcon } from './GameIcons';
import { SLOT_COLORS } from '../styles/slotColors';

export const PlayerComputerSlot = ({ 
    slot, 
    currentPlayerColor, 
    onClick, 
    canFill,
    hasData,
    onHover,
    onLeave,
    isPreviousFilled
  }: { 
    slot: ComputerSlot, 
    currentPlayerColor: string, 
    onClick: () => void, 
    canFill: boolean,
    hasData: boolean,
    onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
    onLeave: () => void,
    isPreviousFilled?: boolean
  }) => {
    const isFilled = slot.filled;
    
    let bonusText = '';
    const mediaAmount = slot.technologyId && slot.technologyId.startsWith('computing-4') ? 2 : 1;
    if (slot.bonus === 'media') {
      bonusText = `${mediaAmount} Média${mediaAmount > 1 ? 's' : ''}`;
    }
    else if (slot.bonus === 'reservation') bonusText = '1 Réservation';
    else if (slot.bonus === '2pv') bonusText = '2 PV';
    else if (slot.bonus === 'credit') bonusText = '1 Crédit';
    else if (slot.bonus === 'energy') bonusText = '1 Énergie';
    else if (slot.bonus === 'card') bonusText = '1 Carte';
  
    let state: 'occupied' | 'clickable' | 'unavailable' = 'unavailable';
    if (isFilled) state = 'occupied';
    else if (canFill) state = 'clickable';
  
    let tooltipContent: React.ReactNode;
    if (state === 'occupied') {
      tooltipContent = <SlotTooltip status="Donnée stockée" statusColor={SLOT_COLORS.neutral} value={bonusText} />;
    } else if (state === 'clickable') {
      tooltipContent = <SlotTooltip status="Disponible" statusColor={SLOT_COLORS.available} value={bonusText} note="Cliquez pour transférer une donnée" />;
    } else {
      let reason = "Nécessite l'emplacement précédent";
      if (isPreviousFilled && slot.type !== 'top' && !slot.bonus) reason = 'Nécessite une technologie informatique';
      else if (!hasData) reason = 'Nécessite 1 donnée';
      tooltipContent = <SlotTooltip status="Indisponible" statusColor={SLOT_COLORS.unavailable} value={bonusText} note={reason} />;
    }
  
    return (
      <div
        onClick={canFill && !isFilled ? onClick : undefined}
        className={`computer-slot ${slot.type === 'top' ? '' : 'bottom'} ${isFilled ? 'filled' : ''} ${canFill && !isFilled ? 'can-fill' : ''}`}
        onMouseEnter={(e) => onHover(e, tooltipContent)}
        onMouseLeave={onLeave}
        style={{
          cursor: canFill && !isFilled ? 'pointer' : 'help',
          boxShadow: canFill && !isFilled ? `0 0 8px ${currentPlayerColor}, 0 0 12px #fff` : 'none'
        }}
      >
        {isFilled && <div className="computer-slot-dot" />}
        {!isFilled && slot.bonus === 'media' && <span className="computer-slot-bonus media"><ResourceIcon kind="media" size={20} amount={mediaAmount > 1 ? mediaAmount : undefined} /></span>}
        {!isFilled && slot.bonus === 'reservation' && <span className="computer-slot-bonus reservation"><ReservationIcon size={20} /></span>}
        {!isFilled && slot.bonus === '2pv' && <span className="computer-slot-bonus pv">2🏆</span>}
        {!isFilled && slot.bonus === 'credit' && <span className="computer-slot-bonus credit"><ResourceIcon kind="credit" size={20} /></span>}
        {!isFilled && slot.bonus === 'energy' && <span className="computer-slot-bonus energy"><ResourceIcon kind="energy" size={20} /></span>}
        {!isFilled && slot.bonus === 'card' && <span className="computer-slot-bonus card">🃏</span>}
      </div>
    );
  };
  