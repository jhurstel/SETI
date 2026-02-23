// src/ui/components/PlanetIcon.tsx
import React from 'react';
import { Game, Planet, ProbeState, InteractionState } from '../../core/types';
import { ProbeSystem } from '../../systems/ProbeSystem';
import { polarToCartesian, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS } from '../../core/SolarSystemPosition';
import { ResourceSystem } from '../../systems/ResourceSystem';
import { PLANET_STYLES, SATELLITE_STYLES } from '../styles/celestialStyles';
import { SvgBonus } from './SvgBonus';

interface PlanetIconProps {
  id: string;
  size: number;
  planetData?: Planet;
  game: Game;
  interactionState: InteractionState;
  onOrbit: (planetId: string, slotIndex?: number) => void;
  onLand: (planetId: string, slotIndex?: number) => void;
  setSlotTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
  handleSlotClick: (e: React.MouseEvent, isClickable: boolean, actionFn: ((planetId: string, index: number) => void) | undefined, planetId: string, index: number, removalType?: 'orbiter' | 'lander') => void;
  removingItem: { type: 'orbiter' | 'lander', planetId: string, index: number } | null;
  hoverTimeoutRef: React.MutableRefObject<any>;
  setHoveredSlot: (slot: { type: 'orbiter' | 'lander', planetId: string, index: number, rect: DOMRect } | null) => void;
}

export const PlanetIcon: React.FC<PlanetIconProps> = ({ id, size, planetData, game, interactionState, onOrbit, onLand, setSlotTooltip, handleSlotClick, removingItem, hoverTimeoutRef, setHoveredSlot }) => {
  const style = PLANET_STYLES[id] || {
    background: 'radial-gradient(circle, #888, #555)',
    border: '2px solid #aaa',
    boxShadow: '0 0 3px rgba(136, 136, 136, 0.8)',
  };

  const scale = size / 30;

  // Custom transform for Oumuamua in tooltip
  let customTransform = style.transform;
  if (id === 'oumuamua') {
    customTransform = 'translate(-40px, -40px) rotate(-30deg) scale(3.5, 0.8)';
  }

  // Logique d'interaction (Orbite / Atterrissage)
  const currentPlayer = game.players[game.currentPlayerIndex];
  const isRobot = currentPlayer.type === 'robot';

  // Trouver l'objet céleste correspondant à l'ID de la planète pour vérifier la position
  const targetObj = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])].find(o => o.id === id);

  // Vérifier si le joueur a une sonde sur cette planète
  const playerProbe = targetObj && game.board.solarSystem.probes.find(p =>
    p.ownerId === currentPlayer.id &&
    p.state === ProbeState.IN_SOLAR_SYSTEM &&
    p.solarPosition.disk === targetObj.position.disk &&
    p.solarPosition.sector === targetObj.position.sector &&
    p.solarPosition.level === targetObj.level
  );

  let canOrbit = false;
  if (playerProbe) {
    if (currentPlayer.hasPerformedMainAction || isRobot) {
    } else {
      const check = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id);
      canOrbit = check.canOrbit;
    }
  }

  let canLand = false;
  let landReason = "Nécessite une sonde sur la planète";
  if (playerProbe) {
    if ((currentPlayer.hasPerformedMainAction && !(interactionState.type === 'LANDING_PROBE')) || isRobot) {
      landReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
    } else {
      const check = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id, !(interactionState.type === 'LANDING_PROBE'));
      canLand = check.canLand;
      landReason = check.canLand ? `Cliquez pour atterrir (Coût: ${check.energyCost} Énergie)` : (check.reason || "Impossible");
    }
  }

  const hasExploration4 = currentPlayer.technologies.some(t => t.id.startsWith('exploration-4'));

  const renderRings = (isFront: boolean) => (
    <>
      <div
        className="seti-planet-icon-ring-outer"
        style={{
          width: `${size * 1.4}px`,
          height: `${size * 0.5}px`,
          clipPath: isFront ? 'inset(50% 0 0 0)' : undefined,
        }}
      />
      <div
        className="seti-planet-icon-ring-inner"
        style={{
          width: `${size * 1.25}px`,
          height: `${size * 0.4}px`,
          clipPath: isFront ? 'inset(50% 0 0 0)' : undefined,
        }}
      />
    </>
  );

  const renderSatellites = () => {
    if (!planetData || !planetData.satellites || planetData.satellites.length === 0) return null;

    const count = planetData.satellites.length;
    // Centre à 5h (environ 60 degrés, car 3h=0°, 6h=90°)
    const centerAngle = 50;
    const step = 40;
    const startAngle = centerAngle - ((count - 1) * step / 2);

    return planetData.satellites.map((satellite, index) => {
      const satSize = size * 0.25;
      const angleDeg = startAngle + (index * step);

      // Distance du centre: rayon planète + un peu moins pour chevaucher
      const dist = (size / 2) * 0.85;
      const { x, y } = polarToCartesian(0, 0, dist, angleDeg);

      // Conversion en top/left par rapport au coin haut-gauche (0,0) du conteneur
      const top = (size / 2) + y - (satSize / 2);
      const left = (size / 2) + x - (satSize / 2);

      const bonus = satellite.landBonus;
      const probe = satellite.landers && satellite.landers.length > 0 ? satellite.landers[satellite.landers.length - 1] : undefined;
      const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;

      const bonusText = (ResourceSystem.formatBonus(bonus) || []).join(', ') || 'Aucun';

      const isOccupied = !!player;
      const allowOccupiedLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '16';
      let satReason = landReason;
      let isSatClickable = (!isOccupied || allowOccupiedLanding) && canLand && !!onLand;

      const allowSatelliteLanding = interactionState.type === 'LANDING_PROBE' && (interactionState.source === '12' || interactionState.ignoreSatelliteLimit);
      if (!hasExploration4 && !allowSatelliteLanding) {
        satReason = "Nécessite la technologie Exploration IV";
        isSatClickable = false;
      }

      const tooltipContent = isOccupied ? (
        <div>Atterrisseur de <span style={{ fontWeight: 'bold', color: player?.color }}>{player?.name}</span> sur {satellite.name}</div>
      ) : (
        <>
          <div style={{ marginBottom: '4px', color: isSatClickable ? '#4a9eff' : '#ff6b6b', fontWeight: isSatClickable ? 'bold' : 'normal' }}>
            {satReason}
          </div>
          <div style={{ fontSize: '0.9em', color: '#ccc' }}>
            Récompenses: <span style={{ color: '#ffd700' }}>{bonusText}</span>
          </div>
        </>
      );

      return (
        <div
          key={`sat-${index}`}
          style={{
            position: 'absolute',
            top: `${top}px`,
            left: `${left}px`,
            width: `${satSize}px`,
            height: `${satSize}px`,
            borderRadius: '50%',
            background: SATELLITE_STYLES[satellite.id] || 'radial-gradient(circle at 30% 30%, #d0d0d0, #808080)',
            border: '1px solid #666',
            boxShadow: '2px 2px 6px rgba(0,0,0,0.6)',
            zIndex: 10 + index,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div style={{
            position: 'absolute',
            top: '-16px',
            width: '120px',
            textAlign: 'center',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 'bold',
            textShadow: '0 0 3px #000',
            pointerEvents: 'none'
          }}>
            {satellite.name}
          </div>

          <svg width="100%" height="100%" viewBox="0 0 40 40" style={{ overflow: 'visible' }}>
            <g transform="translate(20, 20)" style={{ cursor: isSatClickable ? 'pointer' : 'help', pointerEvents: 'auto' }} onClick={(e) => {
              if (isSatClickable && onLand) { e.stopPropagation(); onLand(satellite.id, 0); }
            }}
              onMouseEnter={(e) => {
                setSlotTooltip({ content: tooltipContent, rect: e.currentTarget.getBoundingClientRect() });
              }}
              onMouseLeave={() => setSlotTooltip(null)}
            >
              {isSatClickable && <circle r="13" fill="none" stroke="#00ff00" strokeWidth="3" opacity="0.8" />}
              <circle r="10" fill={player?.color || 'rgba(0,0,0,0.5)'} stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
              {!player && (
                <g transform="scale(0.8)">
                  <SvgBonus bonus={bonus} />
                </g>
              )}
            </g>
          </svg>
        </div>
      );
    });
  };

  const svgMultiplier = id === 'oumuamua' ? 4 : 3;
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, position: 'relative' }}>
      {style.hasRings && renderRings(false)}
      <div
        className="seti-planet-icon-body"
        style={{
          width: `${size - 4}px`,
          height: `${size - 4}px`,
          background: style.background,
          border: style.border,
          boxShadow: style.boxShadow,
          borderRadius: style.borderRadius || '50%',
          transform: customTransform,
        }}
      >
        {style.hasBands && (
          <>
            {[30, 45, 60, 75].map((top, i) => (
              <div
                key={i}
                className="seti-planet-icon-band"
                style={{
                  top: `${top}%`,
                  height: i % 2 === 0 ? `${3 * scale}px` : `${2 * scale}px`,
                  background: `rgba(${150 - i * 5}, ${120 - i * 5}, ${80 - i * 5}, ${0.8 - i * 0.1})`,
                }}
              />
            ))}
          </>
        )}
        {style.hasContinents && (
          <div className="seti-planet-icon-continents" />
        )}
      </div>
      {style.hasRings && (
        <div className="seti-planet-icon-rings-front">
          {renderRings(true)}
        </div>
      )}

      {/* Marqueurs d'orbite et d'atterrissage (Overlay) */}
      {planetData && (
        <svg
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${size * svgMultiplier}px`,
            height: `${size * svgMultiplier}px`,
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 3,
          }}
          viewBox={`-${size * (svgMultiplier / 2)} -${size * (svgMultiplier / 2)} ${size * svgMultiplier} ${size * svgMultiplier}`}
        >
          {/* Définition des slots */}
          {(() => {
            const orbitSlots = planetData.orbitSlots || [];
            const landSlots = planetData.landSlots || [];

            const isOumuamua = planetData.id === 'oumuamua';
            const orbiterCircleRadius = 15;
            const orbitRadius = size / 2 + (isOumuamua ? 80 : 25);
            const landerCircleRadius = 15;
            const landRadius = isOumuamua ? size * 0.7 : size * 0.3;

            // Calcul des positions des orbiteurs (Arc supérieur)
            const orbitPositions = orbitSlots.map((_, i) => {
              const count = orbitSlots.length;

              // Calculer l'angle pour que les cercles soient collés (ou très proches)
              // step = 2 * asin((r + padding) / R)
              const stepRad = 2 * Math.asin((orbiterCircleRadius + 1) / orbitRadius);
              const stepDeg = stepRad * (180 / Math.PI);

              const centerAngle = 255;
              const totalArcAngle = (count - 1) * stepDeg;
              const startAngle = centerAngle - (totalArcAngle / 2);
              const angleDeg = startAngle + (i * stepDeg);
              const { x, y } = polarToCartesian(0, 0, orbitRadius, angleDeg);

              return {
                x, y,
                angle: angleDeg
              };
            });

            // Calcul des positions des atterrisseurs (Sur la planète)
            const landPositions = landSlots.map((_, i) => {
              const count = landSlots.length;

              const startAngle = 180;
              const endAngle = 300;
              const angleDeg = count > 1
                ? startAngle + (i) * ((endAngle - startAngle) / (count - 1))
                : 240;

              const { x, y } = polarToCartesian(0, 0, landRadius, angleDeg);
              return {
                x, y,
                angle: angleDeg
              };
            });

            return (
              <>
                {/* Dégradé pour le couloir Orbiteurs */}
                {orbitPositions.length > 1 && (
                  <defs>
                    <linearGradient id={`corridor-grad-${planetData.id}`} gradientUnits="userSpaceOnUse" x1={orbitPositions[0].x} y1={orbitPositions[0].y} x2={orbitPositions[orbitPositions.length - 1].x} y2={orbitPositions[orbitPositions.length - 1].y}>
                      <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                )}

                {/* Dégradé pour le couloir Atterrisseurs */}
                {landPositions.length > 1 && (
                  <defs>
                    <linearGradient id={`land-corridor-grad-${planetData.id}`} gradientUnits="userSpaceOnUse" x1={landPositions[0].x} y1={landPositions[0].y} x2={landPositions[landPositions.length - 1].x} y2={landPositions[landPositions.length - 1].y}>
                      <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                )}

                {/* Couloir reliant les orbiteurs */}
                {orbitPositions.length > 1 && (() => {
                  const startAngle = orbitPositions[0].angle;
                  const endAngle = orbitPositions[orbitPositions.length - 1].angle;
                  const innerR = orbitRadius - orbiterCircleRadius;
                  const outerR = orbitRadius + orbiterCircleRadius;
                  const innerStart = polarToCartesian(0, 0, innerR, startAngle);
                  const innerEnd = polarToCartesian(0, 0, innerR, endAngle);
                  const outerStart = polarToCartesian(0, 0, outerR, startAngle);
                  const outerEnd = polarToCartesian(0, 0, outerR, endAngle);

                  return (
                    <>
                      <path d={`M ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 0 1 ${innerEnd.x} ${innerEnd.y}`} fill="none" stroke={`url(#corridor-grad-${planetData.id})`} strokeWidth="2" />
                      <path d={`M ${outerStart.x} ${outerStart.y} A ${outerR} ${outerR} 0 0 1 ${outerEnd.x} ${outerEnd.y}`} fill="none" stroke={`url(#corridor-grad-${planetData.id})`} strokeWidth="2" />
                    </>
                  );
                })()}

                {/* Couloir reliant les atterrisseurs */}
                {landPositions.length > 1 && (() => {
                  const startAngle = landPositions[0].angle;
                  const endAngle = landPositions[landPositions.length - 1].angle;
                  const innerR = landRadius - landerCircleRadius;
                  const outerR = landRadius + landerCircleRadius;
                  const innerStart = polarToCartesian(0, 0, innerR, startAngle);
                  const innerEnd = polarToCartesian(0, 0, innerR, endAngle);
                  const outerStart = polarToCartesian(0, 0, outerR, startAngle);
                  const outerEnd = polarToCartesian(0, 0, outerR, endAngle);

                  return (
                    <>
                      <path d={`M ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 0 1 ${innerEnd.x} ${innerEnd.y}`} fill="none" stroke={`url(#land-corridor-grad-${planetData.id})`} strokeWidth="2" />
                      <path d={`M ${outerStart.x} ${outerStart.y} A ${outerR} ${outerR} 0 0 1 ${outerEnd.x} ${outerEnd.y}`} fill="none" stroke={`url(#land-corridor-grad-${planetData.id})`} strokeWidth="2" />
                    </>
                  );
                })()}

                {/* Slots Orbiteurs */}
                {orbitSlots.map((bonus, i) => {
                  const pos = orbitPositions[i];
                  const probe = planetData.orbiters[i];
                  const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;

                  const isRemoving = removingItem?.type === 'orbiter' && removingItem?.planetId === planetData.id && removingItem?.index === i;
                  const isOccupied = !!player;
                  const isNextAvailable = i === planetData.orbiters.length;

                  let isClickable = false;
                  if (interactionState.type === 'REMOVING_ORBITER') {
                    isClickable = !removingItem && isOccupied && player?.id === currentPlayer.id && !!onOrbit;
                  } else {
                    isClickable = !removingItem && isNextAvailable && canOrbit && !!onOrbit;
                  }

                  const isFirst = i === 0;
                  const showFullToken = isFirst || !!player;

                  return (
                    <g key={`orb-slot-${i}`} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: isClickable ? 'pointer' : 'help', pointerEvents: 'auto' }}
                      onClick={(e) => handleSlotClick(e, isClickable, onOrbit, planetData.id, i, interactionState.type === 'REMOVING_ORBITER' ? 'orbiter' : undefined)}
                      onMouseEnter={(e) => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); // Garde le tooltip principal ouvert
                        setHoveredSlot({ type: 'orbiter', planetId: planetData.id, index: i, rect: e.currentTarget.getBoundingClientRect() });
                      }}
                      onMouseLeave={() => setHoveredSlot(null)}
                    >
                      {isClickable && !removingItem && <circle r={orbiterCircleRadius + 6} fill="none" stroke="#00ff00" strokeWidth="3" opacity="0.6" />}
                      {showFullToken ? (
                        <>
                          <circle
                            r={orbiterCircleRadius}
                            fill={player?.color || '#222'}
                            stroke="#fff"
                            strokeWidth="1.5"
                            style={{
                              transition: 'all 0.5s ease',
                              opacity: isRemoving ? 0 : 1,
                              transform: isRemoving ? 'scale(0)' : 'scale(1)',
                              transformBox: 'fill-box',
                              transformOrigin: 'center'
                            }}
                          />
                          {!player && <SvgBonus bonus={bonus} />}
                        </>
                      ) : (
                        <circle
                          r={4}
                          fill={`url(#corridor-grad-${planetData.id})`}
                          style={{
                            transition: 'all 0.5s ease',
                            opacity: isRemoving ? 0 : 1,
                            transform: isRemoving ? 'scale(0)' : 'scale(1)',
                            transformBox: 'fill-box',
                            transformOrigin: 'center'
                          }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Slots Atterrisseurs */}
                {landSlots.map((bonus, i) => {
                  const pos = landPositions[i];

                  const probesOnSlot = planetData.landers.filter(p => p.planetSlotIndex === i);
                  const probe = probesOnSlot.length > 0 ? probesOnSlot[probesOnSlot.length - 1] : undefined;
                  const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
                  const isRemoving = removingItem?.type === 'lander' && removingItem?.planetId === planetData.id && removingItem?.index === i;

                  const isOccupied = !!player;
                  const isPrevSlotOccupied = i === 0 || planetData.landers.some(p => p.planetSlotIndex === i - 1);
                  const isNextAvailable = !isOccupied && isPrevSlotOccupied;
                  const allowOccupiedLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '16';
                  const isClickable = !removingItem && (isNextAvailable || (allowOccupiedLanding && isOccupied)) && (canLand || interactionState.type === 'LANDING_PROBE') && !!onLand;

                  const isFullSlot = i === 0 || (planetData.id === 'mars' && i === 1) || (planetData.id === 'oumuamua' && i === 1) || (planetData.id === 'oumuamua' && i === 2);
                  const showFullToken = isFullSlot || !!player;

                  return (
                    <g key={`land-slot-${i}`} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: isClickable ? 'pointer' : 'help', pointerEvents: 'auto' }}
                      onClick={(e) => handleSlotClick(e, isClickable, onLand, planetData.id, i, interactionState.type === 'REMOVING_LANDER' ? 'lander' : undefined)}
                      onMouseEnter={(e) => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); // Garde le tooltip principal ouvert
                        setHoveredSlot({ type: 'lander', planetId: planetData.id, index: i, rect: e.currentTarget.getBoundingClientRect() });
                      }}
                      onMouseLeave={() => setHoveredSlot(null)}
                    >
                      {isClickable && !removingItem && <circle r={landerCircleRadius + 6} fill="none" stroke="#00ff00" strokeWidth="3" opacity="0.6" />}
                      {showFullToken ? (
                        <>
                          <circle
                            r={landerCircleRadius}
                            fill={player?.color || 'rgba(0,0,0,0.6)'}
                            stroke="rgba(255,255,255,0.8)"
                            strokeWidth="1.5"
                            style={{
                              transition: 'all 0.5s ease',
                              opacity: isRemoving ? 0 : 1,
                              transform: isRemoving ? 'scale(0)' : 'scale(1)',
                              transformBox: 'fill-box',
                              transformOrigin: 'center'
                            }}
                          />
                          {!player && <SvgBonus bonus={bonus} />}
                        </>
                      ) : (
                        <circle r={4} fill={`url(#land-corridor-grad-${planetData.id})`}
                          style={{
                            transition: 'all 0.5s ease',
                            opacity: isRemoving ? 0 : 1,
                            transform: isRemoving ? 'scale(0)' : 'scale(1)',
                            transformBox: 'fill-box',
                            transformOrigin: 'center'
                          }}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Mascamite Tokens */}
                {planetData.mascamiteTokens && planetData.mascamiteTokens.map((token, i) => {
                  const count = planetData.mascamiteTokens!.length;
                  // Positionner en triangle ou cercle autour du centre
                  // Si 1 seul, au centre. Si plusieurs, autour.
                  const dist = count === 1 ? 0 : Math.max(size * 0.15, 6);
                  const angle = (360 / count) * i - 90;
                  const { x, y } = polarToCartesian(0, 0, dist, angle);

                  return (
                    <g key={`mascamite-${i}`} transform={`translate(${x}, ${y})`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const content = (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#ea80fc', marginBottom: '4px' }}>Spécimen Mascamite</div>
                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus : <span style={{ color: '#ffd700' }}>{(ResourceSystem.formatBonus(token.bonus) || []).join(', ')}</span></div>
                          </div>
                        );
                        setSlotTooltip({ content, rect });
                      }}
                      onMouseLeave={() => setSlotTooltip(null)}
                      style={{ pointerEvents: 'auto', cursor: 'help' }}
                    >
                      <circle r="3.5" fill="#4a148c" stroke="#ea80fc" strokeWidth="1" />
                      <text y="1" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="4" fontWeight="bold">M</text>
                    </g>
                  );
                })}
              </>
            );
          })()}
        </svg>
      )}

      {/* Satellites */}
      {planetData && renderSatellites()}
    </div>
  );
};
