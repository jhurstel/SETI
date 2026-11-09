import React from 'react';
import { Game, DISK_NAMES, GAME_CONSTANTS, InteractionState, AlienBoardType } from '../../core/types';
import { FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, sectorToIndex } from '../../core/SolarSystemPosition';
import { polarToCartesian, describeArc } from '../solarGeometry';
import { BonusIcons } from '../components/BonusIcons';
import { SectorTooltip } from '../components/SectorDetails';
import { SvgBonus } from '../components/SvgBonus';
import { ResourceIcon } from '../components/GameIcons';
import { SlotTooltip } from '../components/SlotTooltip';
import { SLOT_COLORS } from '../styles/slotColors';
import { highlightedSectors } from './highlightedSectors';

/**
 * Secteur d'Oumuamua (espèce Oumuamua découverte) : couloir, nom du secteur et ses signaux le long du disque C,
 * à côté de l'objet (anneau 1, d'où `rotationAngle1` pour garder les symboles droits)
 */
export const OumuamuaSignals: React.FC<{
  game: Game;
  interactionState: InteractionState;
  rotationAngle1: number;
  onSectorClick: (sectorId: string) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}> = ({ game, interactionState, rotationAngle1, onSectorClick, setActiveTooltip }) => {
    const oumuamua = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])].find(o => o.id === 'oumuamua');
    if (!oumuamua) return null;

    const species = game.species.find(s => s.name === AlienBoardType.OUMUAMUA);
    if (!species || !species.sector) return null;
    const sector = species.sector;

    // Oumuamua est sur le disque C (index 2)
    // On veut dessiner les signaux le long de la courbure du disque C
    const diskIndex = DISK_NAMES['C'];
    const diskWidth = 8;
    const sunRadius = 4;
    const innerRadius = sunRadius + (diskIndex * diskWidth);
    const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
    const radius = (innerRadius + outerRadius) / 2;
    const radiusPx = (radius / 100) * 200 + 2;

    // Position relative d'Oumuamua dans le secteur (pour centrer les signaux)
    // Oumuamua est au centre de son secteur.
    // On veut 3 signaux.
    const signalSpacing = 7; // degrés
    const totalWidth = (sector.signals.length - 1) * signalSpacing;

    // Calculer l'angle de départ basé sur la position d'Oumuamua
    // Oumuamua est sur le plateau rotatif niveau 1.
    // Sa position est définie par son secteur relatif.
    const relativeSectorIndex = sectorToIndex[oumuamua.position.sector];
    const centerAngle = -(360 / 8) * relativeSectorIndex - 118;

    const corridorPadding = 2;
    const startAngle = centerAngle - totalWidth / 2 - corridorPadding - 1;
    const endAngle = centerAngle + totalWidth / 2 + corridorPadding - 1;
    const corridorPath = describeArc(100, 100, radiusPx, endAngle, startAngle, false);

    const textRadius = radiusPx - 7;
    const textPathId = `oumuamua-text-path-${oumuamua.id}`;
    const textArcPath = describeArc(100, 100, textRadius, endAngle + 20, startAngle - 20, false);

    const highlightedSectorSlots = highlightedSectors(game, interactionState);
    const shouldFlashSlot = highlightedSectorSlots.includes('oumuamua');

    const coveredByPlayers = (sector.coveredBy || []).map((pid: string) => game.players.find(p => p.id === pid)).filter(p => !!p);
    // Même infobulle que les autres secteurs ; la présence rapporte un token Oumuamua
    const sectorTooltipContent = <SectorTooltip sector={sector} color="#ffffff" coveredBy={coveredByPlayers} presenceGain={<BonusIcons bonus={{ token: 1 }} />} />;

    return (
      <g key="oumuamua-signals" className="solar-oumuamua-signals">
        <path className="oumuamua-corridor solar-oumuamua-corridor" d={corridorPath} fill="none" stroke="#ffffff" opacity="0.15" strokeLinecap="round" />
        <defs><path id={textPathId} d={textArcPath} /></defs>
        <text fill="#ffffff" fontSize="2" fontWeight="bold" letterSpacing="0.5" opacity="0.9" className="solar-oumuamua-label"
          onMouseEnter={(e) => { setActiveTooltip({ content: sectorTooltipContent, rect: e.currentTarget.getBoundingClientRect() }); }}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <textPath href={`#${textPathId}`} startOffset="50%" textAnchor="middle">{sector.name.toUpperCase()}</textPath>
        </text>
        {sector.signals.map((signal, idx) => {
          // Centrer le groupe de 3 signaux autour de la position d'Oumuamua
          const angle = centerAngle - totalWidth / 2 + (idx * signalSpacing);
          const pos = polarToCartesian(100, 100, radiusPx, angle);

          const player = signal.markedBy ? game.players.find(p => p.id === signal.markedBy) : null;
          const strokeColor = '#ffffff'; // Oumuamua signals are white/special
          const fillColor = player ? player.color : 'rgba(0,0,0,0.5)';

          const isNextAvailable = !signal.marked && (idx === 0 || sector.signals[idx - 1].marked);
          const isDisabled = !signal.marked && !isNextAvailable;
          const opacity = isDisabled ? 0.2 : 1;
          const isClickable = !isDisabled && shouldFlashSlot;

          const isFlashing = shouldFlashSlot && isNextAvailable && !signal.marked;

          const currentPlayer = game.players[game.currentPlayerIndex];
          const canAffordScan = currentPlayer.credits >= GAME_CONSTANTS.SCAN_COST_CREDITS && currentPlayer.energy >= GAME_CONSTANTS.SCAN_COST_ENERGY;

          // 1 Donnée par signal, plus le bonus imprimé sur l'emplacement
          const gains = <BonusIcons bonus={{ ...signal.bonus, data: (signal.bonus?.data || 0) + 1 }} />;

          let stateText = "Disponible";
          let stateColor = SLOT_COLORS.available;
          let actionText = null;

          if (signal.marked) {
            const markerPlayer = game.players.find(p => p.id === signal.markedBy);
            stateText = `Marqué par ${markerPlayer?.name || 'Inconnu'}`;
            stateColor = markerPlayer?.color || "#ccc";
          } else if (isDisabled) {
            stateText = "Indisponible";
            stateColor = SLOT_COLORS.unavailable;
            actionText = "Nécessite le signal précédent";
          } else if (isClickable && !canAffordScan && interactionState.type === 'IDLE') {
            stateText = "Ressources insuffisantes";
            stateColor = SLOT_COLORS.unavailable;
            actionText = `Nécessite ${GAME_CONSTANTS.SCAN_COST_CREDITS} crédit et ${GAME_CONSTANTS.SCAN_COST_ENERGY} énergies`;
          } else {
            actionText = "Cliquez pour marquer le signal";
          }

          const slotTooltipContent = <SlotTooltip status={stateText} statusColor={stateColor} value={gains} note={actionText} />;

          return (
            <g key={signal.id} transform={`translate(${pos.x}, ${pos.y})`} style={{ opacity, cursor: isClickable ? 'pointer' : 'help' }}
              onClick={(e) => { if (isClickable) { e.stopPropagation(); onSectorClick(sector.id); } }}
              onMouseEnter={(e) => setActiveTooltip({ content: slotTooltipContent, rect: e.currentTarget.getBoundingClientRect() })}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              {isFlashing && (
                ((canAffordScan && interactionState.type === 'IDLE') || interactionState.type === 'SELECTING_SCAN_SECTOR') && (
                  <>
                    <circle r="3.8" fill="none" stroke="#4caf50" strokeWidth="0.5" />
                    <circle className="seti-pulse-green-svg" r="3.8" fill="none" stroke="#4caf50" strokeWidth="0.5" />
                  </>
                )
              )}
              <circle r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="0.5" />
              {/* 1 Donnée par signal, dans la case (comme les secteurs) */}
              {!player && (
                <g transform={`rotate(${-rotationAngle1}) translate(-1.7 -1.7)`} className="no-pointer">
                  <ResourceIcon kind="data" size={3.4} />
                </g>
              )}
              {/* Bonus imprimé : posé contre la case à 135°, comme sur le cercle des secteurs */}
              {!player && signal.bonus && (() => {
                const offset = polarToCartesian(0, 0, 3.6, angle + 135);
                return (
                  <g transform={`translate(${offset.x} ${offset.y}) scale(0.19) rotate(${-rotationAngle1})`} className="no-pointer">
                    <SvgBonus bonus={signal.bonus} />
                  </g>
                );
              })()}
            </g>
          );
        })}
      </g>
    );
};
