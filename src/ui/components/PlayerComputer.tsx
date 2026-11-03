import React from 'react';
import { Player, ComputerSlot, Bonus } from '../../core/types';
import { ComputerSystem } from '../../systems/ComputerSystem';
import { PlayerComputerSlot } from './PlayerComputerSlot';
import { TechSpot } from './TechSpot';
import { TechTooltip, ResourceSymbols } from './BoardTooltips';
import './PlayerComputer.css';

/** Gain de la ligne du bas apporté par chaque technologie Informatique (ComputerSystem.assignTechnology) */
const COMPUTING_BOTTOM: { roman: string; bonus: Bonus }[] = [
  { roman: 'I', bonus: { credits: 1 } },
  { roman: 'II', bonus: { card: 1 } },
  { roman: 'III', bonus: { energy: 1 } },
  { roman: 'IV', bonus: { media: 2 } },
];

/** Infobulle d'un emplacement de technologie de l'ordinateur : technologie posée (Informatique I à IV) ou emplacement libre */
const computingTooltip = (topSlot: ComputerSlot | undefined): React.ReactNode => {
  const level = topSlot?.technologyId?.match(/^computing-(\d)/)?.[1];
  const tech = level ? COMPUTING_BOTTOM[Number(level) - 1] : undefined;
  const benefit = (bottom: React.ReactNode) => <>Haut : <ResourceSymbols bonus={{ pv: 2 }} />, Bas : {bottom}</>;
  return tech
    ? <TechTooltip name={`Informatique ${tech.roman}`} acquired base={null} benefit={benefit(<ResourceSymbols bonus={tech.bonus} />)} />
    : <TechTooltip name="Informatique" acquired={false} base="Ligne du bas fermée"
        benefit={benefit(<>{COMPUTING_BOTTOM.map((t, i) => <React.Fragment key={t.roman}>{i > 0 && ' / '}<ResourceSymbols bonus={t.bonus} /></React.Fragment>)}</>)} />;
};

export const PlayerComputer = ({ 
  player, onSlotClick, isSelecting, onColumnSelect, isAnalyzing, disabled, onHover, onLeave
}: { 
  player: Player,
  onSlotClick: (slotId: string) => void,
  isSelecting?: boolean,
  onColumnSelect?: (col: number) => void,
  isAnalyzing?: boolean,
  disabled?: boolean,
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
  onLeave: () => void
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
        // (cadre de technologie : marge --computer-tech-inset, plus étroite sur mobile ; colonne simple : 4px)
        let separatorLeftMargin = '0px';
        let separatorRightMargin = '0px';
        
        if (index < columns.length - 1) {
            const inset = (twoSlots: boolean) => twoSlots ? 'calc(-1 * var(--computer-tech-inset))' : '-4px';
            const nextCol = columns[index + 1];
            const nextColSlots = Object.values(slots).filter((s) => s.col === nextCol);
            const nextHasBottom = nextColSlots.length > 1;
            
            separatorLeftMargin = inset(hasBottom);
            separatorRightMargin = inset(nextHasBottom);
        }

        return (
          <React.Fragment key={col}>
            {(() => {
              const columnContent = <>
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
              </>;
              // Colonne à deux emplacements : emplacement d'une technologie informatique
              return hasBottom ? (
                <TechSpot className="computer-column" acquired={hasTech} selectable={isSelectableColumn}
                  tile="computing"
                  onMouseOver={e => { if (!(e.target as Element).closest('.computer-slot')) onHover(e, computingTooltip(topSlot)); }}
                  onMouseLeave={onLeave}
                  onClick={() => isSelectableColumn && onColumnSelect && onColumnSelect(col)}>
                  {columnContent}
                </TechSpot>
              ) : (
                <div className="computer-column">{columnContent}</div>
              );
            })()}
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

    </div>
  );
};