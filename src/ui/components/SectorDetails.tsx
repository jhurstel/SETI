import React from 'react';
import { signalSlotState } from './signalSlotState';
import { tutorialAllows, useTutorialFocus } from '../tutorialFocus';
import { SlotTooltip } from './SlotTooltip';
import { ActionType, Game, InteractionState, SignalType, GAME_CONSTANTS, Sector, Player } from '../../core/types';
import { describeArc, polarToCartesian } from '../solarGeometry';
import { BonusIcons } from './BonusIcons';
import { SvgBonus } from './SvgBonus';
import { ResourceIcon } from './GameIcons';
import { HoverTooltip } from './HoverTooltip';
import { HumanIcon } from './PlayerKindIcon';
import { SECTOR_STYLES } from '../styles/celestialStyles';

interface SectorDetailsProps {
  game: Game;
  interactionState: InteractionState;
  highlightedSectorSlots: string[];
  onSectorClick: (sectorId: string) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

/**
 * Infobulle d'un secteur, au format de celle des traces de vie (classes alien-tooltip-*) : nom à la couleur du secteur,
 * joueurs qui l'ont couvert, puis bonus (présence, 1re couverture, couvertures suivantes).
 */
export const SectorTooltip: React.FC<{ sector: Sector, color: string, coveredBy: Player[], presenceGain: React.ReactNode }> = ({ sector, color, coveredBy, presenceGain }) => {
  return (
    <div className="alien-tooltip-container">
      <div className="alien-tooltip-header" style={{ color }}>{sector.name}</div>
      {coveredBy.length > 0 ? (
        <div className="alien-tooltip-players">
          <div className="tooltip-caption">Couvert par :</div>
          {coveredBy.map((p, i) => <div key={`${p.id}-${i}`} className="alien-tooltip-player-row" style={{ color: p.color }}>{p.name}</div>)}
        </div>
      ) : (
        <div className="alien-tooltip-empty">Pas encore couvert</div>
      )}
      <div className="alien-tooltip-bonuses">
        <div className="alien-tooltip-bonus-row mb">
          <span>Bonus présence :</span>
          <span className="alien-tooltip-bonus-value sector-presence-gain">{presenceGain} / <HoverTooltip content="Par joueur présent" nested><HumanIcon size={14} /></HoverTooltip></span>
        </div>
        <div className="alien-tooltip-bonus-row mb">
          <span>Bonus couverture :</span>
          <span className="alien-tooltip-bonus-value"><BonusIcons bonus={sector.firstBonus} /></span>
        </div>
        <div className="alien-tooltip-bonus-row">
          <span>Bonus suivants :</span>
          <span className="alien-tooltip-bonus-value"><BonusIcons bonus={sector.nextBonus} /></span>
        </div>
      </div>
    </div>
  );
};

export const SectorDetails: React.FC<SectorDetailsProps> = ({ game, interactionState, highlightedSectorSlots, onSectorClick, setActiveTooltip }) => {
  // Tutoriel : la case du secteur de la Terre ne clignote que si l'étape en cours demande un scan
  const tutorialFocus = useTutorialFocus();
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
        // Hauteur des capitales du nom de secteur (police de 2,5)
        const SECTOR_NAME_CAP_HEIGHT = 1.8;
        const slotRadius = 83;

        // Déterminer si le texte doit être inversé (pour les secteurs du bas : 3, 4, 5, 6)
        const isBottom = i >= 2 && i <= 5;

        const textPathId = `sector-text-path-${i}`;

        // Vérifier si ce secteur doit avoir son slot en surbrillance
        const shouldFlashSlot = highlightedSectorSlots.includes(sector.id);
        const isSectorClickable = !!onSectorClick && shouldFlashSlot;

        // Inverser la direction du chemin pour le bas pour que le texte soit lisible. Les lettres partent
        // alors de l'arc vers le centre (et non vers l'extérieur) : on éloigne l'arc d'une hauteur de capitale
        // pour que le texte occupe la même couronne qu'en haut.
        const textArc = describeArc(100, 100, isBottom ? textRadius + SECTOR_NAME_CAP_HEIGHT : textRadius, startAngle, endAngle, isBottom);

        const color = SECTOR_STYLES[sector.color]?.color || '#fff';

        const coveredByPlayers = (sector.coveredBy || []).map((pid: string) => game.players.find(p => p.id === pid)).filter(p => !!p);

        const sectorTooltipContent = <SectorTooltip sector={sector} color={color} coveredBy={coveredByPlayers} presenceGain={<BonusIcons bonus={{ media: 1 }} />} />;

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
          // 1 Donnée par signal (sauf emplacement blanc), plus le bonus imprimé sur l'emplacement
          const gains = <BonusIcons bonus={{ ...signal.bonus, data: (signal.bonus?.data || 0) + (isWhiteSlot ? 0 : 1) }} />;

          // Case qu'un scan marquerait maintenant (celle qui pulse hors choix d'un secteur)
          const scannable = isFlashing && canAffordScan && interactionState.type === 'IDLE' && tutorialAllows(tutorialFocus, ActionType.SCAN_SECTOR);
          // Case à cliquer : scan permis (tour du joueur, étape du tutoriel) ou choix d'un secteur en cours
          const highlighted = scannable || (isFlashing && interactionState.type === 'SELECTING_SCAN_SECTOR');
          const state = signalSlotState(game, interactionState, signal, isDisabled, isSectorClickable, scannable);
          const slotTooltipContent = <SlotTooltip status={state.status} statusColor={state.color} value={gains} note={state.note}
            cost={state.cost ? <BonusIcons bonus={state.cost} /> : undefined} />;

          const cursorStyle = isSectorClickable && !isDisabled ? 'pointer' : 'help';

          return (
            <g key={signal.id} transform={`translate(${pos.x}, ${pos.y})`}
              className={highlighted ? 'seti-slot-highlight' : undefined}
              style={{ opacity, cursor: cursorStyle, pointerEvents: 'auto', '--slot-glow': strokeColor } as React.CSSProperties}
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
              <circle r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="0.5" strokeDasharray={isLastSlot ? "1 1" : undefined} />
              {/* 1 Donnée par signal (sauf emplacement blanc), dans la case */}
              {!player && !isWhiteSlot && (
                <g transform="translate(-1.7 -1.7)" className="no-pointer">
                  <ResourceIcon kind="data" size={3.4} />
                </g>
              )}
              {/* Bonus imprimé (2 PV) : posé contre la case à 135°, comme les gains supplémentaires des cases d'orbiteurs
                  et d'atterrisseurs, l'angle étant compté depuis l'extérieur de l'anneau (et non depuis le haut de l'écran) :
                  il reste dans la piste, entre la case et la suivante, sans toucher le nom du secteur */}
              {!player && signal.bonus && (() => {
                const offset = polarToCartesian(0, 0, 3.6, angle + 135);
                return (
                  <g transform={`translate(${offset.x} ${offset.y}) scale(0.19)`}>
                    <SvgBonus bonus={signal.bonus} />
                  </g>
                );
              })()}
            </g>
          );
        });

        const showSectorTooltip = (e: React.MouseEvent<SVGElement>) => setActiveTooltip({ content: sectorTooltipContent, rect: e.currentTarget.getBoundingClientRect() });

        return (
          <g key={sector.id}
            className="no-pointer">
            {/* Zone de survol : toute la couronne du secteur (nom et couloir), les slots gardent leur infobulle */}
            <path d={describeArc(100, 100, (textRadius - 1.5 + slotRadius + 3.5) / 2, startAngle, endAngle, false)} fill="none" stroke="transparent"
              strokeWidth={slotRadius + 3.5 - (textRadius - 1.5)} className="sector-arc-hit"
              onMouseEnter={showSectorTooltip} onMouseLeave={() => setActiveTooltip(null)} />
            <defs>
              <path id={textPathId} d={textArc} />
            </defs>
            <text fill={color} fontSize="2.5" fontWeight="bold" letterSpacing="0.5" opacity="0.9" className="no-pointer">
              <textPath href={`#${textPathId}`} startOffset="50%" textAnchor="middle">
                {sector.name.toUpperCase()}
                {coveredByPlayers.map((p, playerIndex) => (
                  <tspan key={playerIndex} fill={p.color} dx={playerIndex === 0 ? "2" : "0.1"} dy={playerIndex === 0 ? "0.9" : "0"} className="sector-marker-dot">●</tspan>
                ))}
              </textPath>
            </text>

            {/* Fond du couloir */}
            {/* Fond presque opaque de la piste : les slots passent devant l'étoile du secteur, qui ne dépasse qu'autour
                et transparaît à peine */}
            <path d={corridorPath} fill="none" stroke="#0a0e1a" strokeWidth="7" strokeLinecap="round" opacity="0.8" />
            <path d={corridorPath} fill="none" stroke={color} strokeWidth="7" opacity="0.15" strokeLinecap="round" />

            {/* Slots */}
            {slots}
          </g>
        );
      })}
    </svg>
  );
};
