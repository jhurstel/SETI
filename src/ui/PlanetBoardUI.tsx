import React, { useState, useRef } from 'react';
import { Game, InteractionState, Planet, ProbeState, AlienBoardType } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { PlanetIcon } from './components/PlanetIcon';
import { Tooltip } from './Tooltip';
import { ResourceSystem } from '../systems/ResourceSystem';
import { FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS } from '../core/SolarSystemPosition';
import './PlanetBoardUI.css';

interface PlanetBoardUIProps {
    game: Game;
    interactionState: InteractionState;
    onOrbit: (planetId: string, slotIndex?: number) => void;
    onLand: (planetId: string, slotIndex?: number) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null) => void;
}

// List of planets to display in the panel
const PLANET_IDS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

// Main component for the planet panel
export const PlanetBoardUI: React.FC<PlanetBoardUIProps> = ({ game, interactionState, onOrbit, onLand, setActiveTooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hoverTimeoutRef = useRef<any>(null);
    const panelHoverTimeoutRef = useRef<any>(null);
    const [removingItem, setRemovingItem] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number } | null>(null);
    const processingRef = useRef(false);
    const [hoveredSlot, setHoveredSlot] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number, rect: DOMRect } | null>(null);

    const planets = PLANET_IDS.map(id => game.board.planets.find(p => p.id === id)).filter(p => p) as Planet[];

    // Helper pour récupérer les données d'une planète (y compris Oumuamua)
    const getPlanetData = (planetId: string) => {
        let planet = game.board.planets.find(p => p.id === planetId);
        if (!planet && planetId === 'oumuamua') {
            const species = game.species.find(s => s.name === AlienBoardType.OUMUAMUA);
            if (species) planet = species.planet;
        }
        return planet;
    };

    const renderTooltipContent = (isOccupied: boolean, isClickable: boolean, player: any, bonusText: string, reason: string, actionTextSuccess: string, isRemovingMode: boolean) => {
        let statusText = isOccupied ? `Occupé par ${player?.name}` : (isClickable ? "Disponible" : "Indisponible");
        let statusColor = isOccupied ? (player?.color || "#ccc") : (isClickable ? "#4a9eff" : "#ff6b6b");
        let actionText: string | null = isClickable ? actionTextSuccess : reason;

        if (isOccupied && isClickable && isRemovingMode) {
            statusText = "Cliquez pour retirer";
            statusColor = "#ff6b6b";
            actionText = null;
        }

        return (
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px', color: statusColor }}>{statusText}</div>
                <div style={{ fontSize: '0.9em', color: '#ccc' }}>{isRemovingMode && isClickable ? <>Gain retrait : <span style={{ color: '#ffd700' }}>3 PV, 1 Donnée, 1 Carte</span></> : <>Bonus : <span style={{ color: '#ffd700' }}>{bonusText}</span></>}</div>
                {actionText && <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>{actionText}</div>}
            </div>
        );
    };

    const getSlotTooltipContent = () => {
        if (!hoveredSlot || removingItem) return null;
        const { type, planetId, index } = hoveredSlot;

        let planetData = getPlanetData(planetId);
        let satelliteData: any = null;

        if (!planetData) {
            for (const p of game.board.planets) {
                if (p.satellites) {
                    const sat = p.satellites.find(s => s.id === planetId);
                    if (sat) {
                        satelliteData = sat;
                        planetData = p;
                        break;
                    }
                }
            }
        }

        if (!planetData && !satelliteData) return null;

        const currentPlayer = game.players[game.currentPlayerIndex];
        const isRobot = currentPlayer.type === 'robot';

        // Trouver l'objet céleste pour vérifier la position de la sonde du joueur
        const targetObjId = satelliteData ? planetData!.id : planetId;
        const targetObj = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])].find(o => o.id === targetObjId);
        const playerProbe = targetObj && game.board.solarSystem.probes.find(p =>
            p.ownerId === currentPlayer.id &&
            p.state === ProbeState.IN_SOLAR_SYSTEM &&
            p.solarPosition.disk === targetObj.position.disk &&
            p.solarPosition.sector === targetObj.position.sector &&
            p.solarPosition.level === targetObj.level
        );

        if (type === 'orbiter') {
            if (satelliteData) return null;
            const orbitSlots = planetData!.orbitSlots || [];
            if (index >= orbitSlots.length) return null;
            const bonus = orbitSlots[index];
            const probe = planetData!.orbiters[index];
            const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
            const bonusText = (ResourceSystem.formatBonus(bonus) || []).join(', ') || 'Aucun';

            const isOccupied = !!player;
            const isNextAvailable = index === planetData!.orbiters.length;

            let canOrbit = false;
            let orbitReason = "";
            if (playerProbe) {
                if (currentPlayer.hasPerformedMainAction || isRobot) {
                    orbitReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
                } else {
                    const check = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id);
                    canOrbit = check.canOrbit;
                    orbitReason = check.reason || "Impossible";
                }
            } else {
                orbitReason = "Nécessite une sonde sur la planète";
            }

            let isClickable = false;
            if (interactionState.type === 'REMOVING_ORBITER') {
                isClickable = isOccupied && player?.id === currentPlayer.id && !!onOrbit;
            } else {
                isClickable = isNextAvailable && canOrbit && !!onOrbit;
            }

            return renderTooltipContent(isOccupied, isClickable, player, bonusText, orbitReason, "Cliquez pour mettre en orbite (Coût: 1 Crédit, 1 Énergie)", interactionState.type === 'REMOVING_ORBITER');
        }

        if (type === 'lander') {
            let landSlots: any[] = [];
            let landers: any[] = [];

            if (satelliteData) {
                landSlots = [satelliteData.landBonus];
                landers = satelliteData.landers || [];
            } else {
                landSlots = planetData!.landSlots || [];
                landers = planetData!.landers || [];
            }

            if (index >= landSlots.length) return null;
            const bonus = landSlots[index];

            const probesOnSlot = landers.filter((p: any) => p.planetSlotIndex === index);
            const probe = probesOnSlot.length > 0 ? probesOnSlot[probesOnSlot.length - 1] : undefined;
            const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
            const bonusText = (ResourceSystem.formatBonus(bonus) || []).join(', ') || 'Aucun';

            const isOccupied = !!player;
            const isPrevSlotOccupied = index === 0 || landers.some((p: any) => p.planetSlotIndex === index - 1);
            const isNextAvailable = !isOccupied && isPrevSlotOccupied;
            const allowOccupiedLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '16';

            let canLand = false;
            let landReason = "";
            let landEnergyCost = 0;

            if (playerProbe) {
                if ((currentPlayer.hasPerformedMainAction && !(interactionState.type === 'LANDING_PROBE')) || isRobot) {
                    landReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
                } else {
                    const check = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id, !(interactionState.type === 'LANDING_PROBE'));
                    canLand = check.canLand;
                    landEnergyCost = check.energyCost || 0;
                    landReason = check.reason || "Impossible";
                }
            } else {
                landReason = "Nécessite une sonde sur la planète";
            }

            if (satelliteData) {
                const hasExploration4 = currentPlayer.technologies.some(t => t.id.startsWith('exploration-4'));
                const allowSatelliteLanding = interactionState.type === 'LANDING_PROBE' && (interactionState.source === '12' || interactionState.ignoreSatelliteLimit);
                if (!hasExploration4 && !allowSatelliteLanding) {
                    canLand = false;
                    landReason = "Nécessite la technologie Exploration IV";
                }
            }

            const isClickable = (isNextAvailable || (allowOccupiedLanding && isOccupied)) && (canLand || interactionState.type === 'LANDING_PROBE') && !!onLand;

            const actionTextSuccess = interactionState.type === 'LANDING_PROBE'
                ? "Cliquez pour atterrir (Bonus)"
                : `Cliquez pour atterrir (Coût: ${landEnergyCost} Énergie)`;

            return renderTooltipContent(isOccupied, isClickable, player, bonusText, landReason, actionTextSuccess, interactionState.type === 'REMOVING_LANDER');
        }
        return null;
    };

    const handleSlotClick = (
        e: React.MouseEvent,
        isClickable: boolean,
        actionFn: ((planetId: string, index: number) => void) | undefined,
        planetId: string,
        index: number,
        removalType?: 'orbiter' | 'lander'
    ) => {
        if (processingRef.current) return;

        if (isClickable && actionFn) {
            e.stopPropagation();
            if (removalType) {
                processingRef.current = true;
                setRemovingItem({ type: removalType, planetId, index });
                setTimeout(() => {
                    actionFn(planetId, index);
                    setRemovingItem(null);
                    processingRef.current = false;
                }, 500);
            } else {
                actionFn(planetId, index);
            }
        }
    };

    const handlePanelMouseEnter = () => {
        if (panelHoverTimeoutRef.current) {
            clearTimeout(panelHoverTimeoutRef.current);
            panelHoverTimeoutRef.current = null;
        }
        setIsOpen(true);
    };

    const handlePanelMouseLeave = () => {
        panelHoverTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 300);
    };

    const handleMouseEnter = (e: React.MouseEvent, planet: Planet) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        handlePanelMouseEnter();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setActiveTooltip({
            rect,
            content: (
                <div style={{ minWidth: '350px' }}>
                    <div style={{ borderBottom: '1px solid #444', paddingBottom: '8px', marginBottom: '12px', textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#78a0ff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                            {planet.name}
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', marginTop: '50px', minHeight: '220px', alignItems: 'center' }}>
                        <PlanetIcon id={planet.id} size={planet.id === 'oumuamua' ? 80 : 220} planetData={planet} game={game} interactionState={interactionState} onOrbit={onOrbit} onLand={onLand} handleSlotClick={handleSlotClick} removingItem={removingItem} hoverTimeoutRef={hoverTimeoutRef} setHoveredSlot={setHoveredSlot} />
                    </div>
                </div>
            ),
            pointerEvents: 'auto',
            onMouseEnter: () => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                handlePanelMouseEnter();
            },
            onMouseLeave: () => {
                handleMouseLeave();
                handlePanelMouseLeave();
            }
        });
    };

    const handleMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => setActiveTooltip(null), 300);
    };

    return (
        <div 
            className={`seti-foldable-container seti-icon-panel seti-planet-board ${isOpen ? 'open' : 'collapsed'}`}
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
            style={{ pointerEvents: 'auto' }}
        >
            <div className="seti-foldable-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="panel-icon">🪐</span>
                <span className="panel-title">Planètes</span>
            </div>
            <div className="seti-foldable-content">
                <div className="planet-grid">
                    {planets.map(planet => (
                        <div 
                            key={planet.id} 
                            className="planet-icon-wrapper"
                            onMouseEnter={(e) => handleMouseEnter(e, planet)}
                            onMouseLeave={handleMouseLeave}
                        >
                            <PlanetIcon 
                                id={planet.id} 
                                size={32} 
                                planetData={planet}
                                game={game} 
                                interactionState={interactionState}
                                onOrbit={() => {}}
                                onLand={() => {}}
                                handleSlotClick={() => {}}
                                removingItem={null}
                                hoverTimeoutRef={hoverTimeoutRef}
                                setHoveredSlot={() => {}}
                                isInteractive={false}
                            />
                            <span className="planet-name">{planet.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            {hoveredSlot && !removingItem && (
                <Tooltip
                    content={getSlotTooltipContent()}
                    targetRect={hoveredSlot.rect}
                    pointerEvents="auto"
                    disableCollision={true}
                />
            )}
        </div>
    );
};