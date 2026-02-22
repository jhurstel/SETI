// src/ui/components/SectorDetailsUI.tsx
import React from 'react';
import { Game, InteractionState, SectorType, SignalType, GAME_CONSTANTS } from '../../core/types';
import { describeArc, polarToCartesian } from '../../core/SolarSystemPosition';
import { ResourceSystem } from '../../systems/ResourceSystem';
import { SvgBonus } from './SvgBonus';

interface SectorDetailsUIProps {
    game: Game;
    interactionState: InteractionState;
    highlightedSectorSlots: string[];
    onSectorClick: (sectorId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export const SectorDetailsUI: React.FC<SectorDetailsUIProps> = ({ game, interactionState, highlightedSectorSlots, onSectorClick, setActiveTooltip }) => {
    if (!game.board.sectors) return null;
    const currentPlayer = game.players[game.currentPlayerIndex];

    return (
      <svg
        className="seti-sector-details-svg"
        viewBox="0 0 200 200"
      >
        {game.board.sectors.map((sector, i) => {
          // Angles pour le secteur i+1 (ex: Secteur 1 = -90 à -135)
          const startAngle = -(360 / 8) * i - 90;
          const endAngle = -(360 / 8) * (i + 1) - 90;

          // Rayons pour le disque E (36% à 44% -> 72px à 88px)
          const textRadius = 75;
          const slotRadius = 83;

          // Déterminer si le texte doit être inversé (pour les secteurs du bas : 3, 4, 5, 6)
          const isBottom = i >= 2 && i <= 5;

          const textPathId = `sector-text-path-${i}`;

          // Vérifier si ce secteur doit avoir son slot en surbrillance
          const shouldFlashSlot = highlightedSectorSlots.includes(sector.id);
          const isSectorClickable = !!onSectorClick && shouldFlashSlot;

          // Inverser la direction du chemin pour le bas pour que le texte soit lisible
          const textArc = describeArc(100, 100, textRadius, startAngle, endAngle, isBottom);

          const colorMap: Record<string, string> = {
            [SectorType.BLUE]: '#4a9eff',
            [SectorType.RED]: '#ff6b6b',
            [SectorType.YELLOW]: '#ffd700',
            [SectorType.BLACK]: '#aaaaaa'
          };
          const color = colorMap[sector.color] || '#fff';

          const coveredByPlayers = (sector.coveredBy || []).map((pid: string) => game.players.find(p => p.id === pid)).filter(p => !!p);

          // Préparation du tooltip Secteur
          const mediaBonusText = "1 Média pour chaque joueur présent";
          const firstBonusStr = (ResourceSystem.formatBonus(sector.firstBonus) || []).join(', ') || 'Aucun';
          const nextBonusStr = (ResourceSystem.formatBonus(sector.nextBonus) || []).join(', ') || 'Aucun';

          let bonusDisplay;
          if (firstBonusStr === nextBonusStr) {
            bonusDisplay = <div style={{ fontSize: '0.9em', color: '#ffd700' }}>Bonus de couverture : {firstBonusStr}</div>;
          } else {
            bonusDisplay = (
              <div style={{ fontSize: '0.9em', color: '#ffd700' }}>
                <div>1ère couverture : {firstBonusStr}</div>
                <div>Suivantes : {nextBonusStr}</div>
              </div>
            );
          }

          const sectorTooltipContent = (
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc', marginBottom: '4px', color: color }}>{sector.name.toUpperCase()}</div>
              <div style={{ fontSize: '0.9em', marginBottom: '4px' }}>Gains à la couverture :</div>
              <div style={{ fontSize: '0.9em', color: '#ff6b6b' }}>• {mediaBonusText}</div>
              {bonusDisplay}
              {coveredByPlayers.length > 0 && (
                <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #555' }}>
                  <div style={{ fontSize: '0.8em', color: '#aaa' }}>Couvert par :</div>
                  {coveredByPlayers.map(p => (
                    <div key={p.id} style={{ color: p.color, fontWeight: 'bold', fontSize: '0.9em' }}>{p.name}</div>
                  ))}
                </div>
              )}
            </div>
          );

          // Couloir des slots (toujours sens horaire pour le dessin)
          const slotCount = sector.signals.length;
          const slotSpacing = 5; // degrés entre les slots
          const groupWidth = (slotCount - 1) * slotSpacing;
          const centerAngle = (startAngle + endAngle) / 2;
          const firstSlotAngle = centerAngle - groupWidth / 2;
          const corridorPadding = 3.5;

          const corridorPath = describeArc(100, 100, slotRadius, centerAngle + groupWidth / 2 + corridorPadding, centerAngle - groupWidth / 2 - corridorPadding, false);

          const slots = sector.signals.map((signal, idx) => {
            const angle = firstSlotAngle + (idx * slotSpacing);
            const pos = polarToCartesian(100, 100, slotRadius, angle);

            const player = signal.markedBy ? game.players.find(p => p.id === signal.markedBy) : null;

            const isWhiteSlot = signal.type === SignalType.OTHER;
            const strokeColor = isWhiteSlot ? '#ffffff' : color;
            const fillColor = player ? player.color : (isWhiteSlot ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0,0,0,0.3)');

            // Les slots se remplissent dans l'ordre : un slot est disponible si le précédent est marqué (ou si c'est le premier)
            const isNextAvailable = !signal.marked && (idx === 0 || sector.signals[idx - 1].marked);
            const isDisabled = !signal.marked && !isNextAvailable;
            const opacity = isDisabled ? 0.2 : 1;

            // Flash seulement le premier slot disponible si le secteur est sélectionné
            const isFlashing = shouldFlashSlot && isNextAvailable && !signal.marked;

            const canAffordScan = currentPlayer.credits >= GAME_CONSTANTS.SCAN_COST_CREDITS && currentPlayer.energy >= GAME_CONSTANTS.SCAN_COST_ENERGY;

            const isLastSlot = idx === sector.signals.length - 1;

            // Préparation du tooltip Slot
            const baseGain = isWhiteSlot ? [] : ["1 Donnée"];
            const bonusGain = signal.bonus ? ResourceSystem.formatBonus(signal.bonus) : null;
            const gains = [...baseGain, ...(bonusGain || [])];

            let stateText = "Disponible";
            let stateColor = "#4a9eff";
            let actionText = null;

            if (signal.marked) {
              const markerPlayer = game.players.find(p => p.id === signal.markedBy);
              stateText = `Marqué par ${markerPlayer?.name || 'Inconnu'}`;
              stateColor = markerPlayer?.color || "#ccc";
            } else if (isDisabled) {
              stateText = "Indisponible";
              stateColor = "#ff6b6b";
              actionText = "Nécessite le signal précédent";
            } else if (isSectorClickable && !canAffordScan) {
              stateText = "Ressources insuffisantes";
              stateColor = "#ff6b6b";
              actionText = `Nécessite ${GAME_CONSTANTS.SCAN_COST_CREDITS} crédit et ${GAME_CONSTANTS.SCAN_COST_ENERGY} énergies (vous avez ${currentPlayer.credits} crédit(s) et ${currentPlayer.energy} énergie(s))`;
            } else {
              actionText = "Scannez pour récupérer le bonus (coût: 1 Crédit et 2 Energie)";
            }

            const slotTooltipContent = (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', color: stateColor, marginBottom: '4px' }}>{stateText}</div>
                {gains.length > 0 ? (
                  <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus : <span style={{ color: '#ffd700' }}>{gains.join(', ')}</span></div>
                ) : (
                  <div style={{ fontSize: '0.9em', color: '#ccc' }}>Aucun bonus</div>
                )}
                {actionText && <div style={{ fontSize: '0.8em', color: stateColor, marginTop: '4px', fontStyle: 'italic' }}>{actionText}</div>}
              </div>
            );

            const cursorStyle = isSectorClickable && !isDisabled ? 'pointer' : 'help';

            return (
              <g key={signal.id} transform={`translate(${pos.x}, ${pos.y})`} style={{ opacity, cursor: cursorStyle, pointerEvents: 'auto' }}
                onClick={(e) => {
                  if (isSectorClickable && onSectorClick && !isDisabled) {
                    e.stopPropagation();
                    onSectorClick(sector.id);
                  }
                }}
                onMouseEnter={(e) => {
                  setActiveTooltip({ content: slotTooltipContent, rect: e.currentTarget.getBoundingClientRect() });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <circle r="4" fill="transparent" stroke="none" />
                {isFlashing && (
                  canAffordScan && interactionState.type === 'IDLE' ? (
                    <>
                      <circle r="3.8" fill="none" stroke="#4caf50" strokeWidth="0.5" opacity="1" />
                      <circle className="seti-pulse-green-svg" r="3.8" fill="none" stroke="#4caf50" strokeWidth="0.5" />
                    </>
                  ) : interactionState.type === 'SELECTING_SCAN_SECTOR' && (
                    <circle r="4" fill="none" stroke="#4caf50" strokeWidth="0.5" opacity="1" />
                  )
                )}
                <circle r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="0.5" strokeDasharray={isLastSlot ? "1 1" : undefined} />
                {!player && signal.bonus && (
                  <g transform="scale(0.25)">
                    <SvgBonus bonus={signal.bonus} />
                  </g>
                )}
              </g>
            );
          });

          return (
            <g key={sector.id}
              style={{ pointerEvents: 'none' }}>
              <defs>
                <path id={textPathId} d={textArc} />
              </defs>
              <text fill={color} fontSize="2.5" fontWeight="bold" letterSpacing="0.5" opacity="0.9" style={{ cursor: 'help', pointerEvents: 'auto' }}
                onMouseEnter={(e) => {
                  setActiveTooltip({ content: sectorTooltipContent, rect: e.currentTarget.getBoundingClientRect() });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <textPath href={`#${textPathId}`} startOffset="50%" textAnchor="middle">
                  {sector.name.toUpperCase()}
                  {coveredByPlayers.map((p, playerIndex) => (
                    <tspan key={playerIndex} fill={p.color} dx={playerIndex === 0 ? "2" : "0.1"} dy={playerIndex === 0 ? "0.9" : "0"} style={{textShadow: '0 0 1px black', fontSize: '2em'}}>●</tspan>
                  ))}
                </textPath>
              </text>

              {/* Fond du couloir */}
              <path d={corridorPath} fill="none" stroke={color} strokeWidth="7" opacity="0.15" strokeLinecap="round" style={{ pointerEvents: 'auto', cursor: 'default' }} />

              {/* Slots */}
              {slots}
            </g>
          );
        })}
      </svg>
    );
};
