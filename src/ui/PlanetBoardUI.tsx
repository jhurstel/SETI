import React, { useState, useRef } from 'react';
import { useCloseOnOutsideClick } from './hooks/useCloseOnOutsideClick';
import { SlotTooltip } from './components/SlotTooltip';
import { SLOT_COLORS } from './styles/slotColors';
import { Game, InteractionState, Planet, ProbeState, AlienBoardType, Player, Satellite, Bonus, Probe, LifeTraceType } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { PlanetIcon } from './components/PlanetIcon';
import { Tooltip } from './Tooltip';
import { BonusIcons } from './components/BonusIcons';
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
    const panelRef = useRef<HTMLDivElement>(null);
    useCloseOnOutsideClick(panelRef, isOpen, () => setIsOpen(false));
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const renderTooltipContent = (isOccupied: boolean, isClickable: boolean, player: Player | null, bonusText: React.ReactNode, reason: string, actionTextSuccess: string, isRemovingMode: boolean, removalType?: 'orbiter' | 'lander') => {
        let statusText = isOccupied && player ? `Occupé par ${player.name}` : (isClickable ? "Disponible" : "Indisponible");
        let statusColor = isOccupied && player ? (player.color || "#ccc") : (isClickable ? SLOT_COLORS.available : SLOT_COLORS.unavailable);
        let actionText: string | null = isClickable ? actionTextSuccess : reason;

        if (isOccupied && isClickable && isRemovingMode) {
            statusText = "Cliquez pour retirer";
            statusColor = SLOT_COLORS.unavailable;
            actionText = null;
        }

        let removalBonusText: React.ReactNode = '';
        if (isRemovingMode && isClickable) {
            if (removalType === 'orbiter') {
                removalBonusText = <BonusIcons bonus={{ pv: 3, data: 1, anycard: 1 }} />;
            } else if (removalType === 'lander') {
                removalBonusText = <BonusIcons bonus={{ lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] }} />;
            }
        }

        return (
            <SlotTooltip
              status={statusText}
              statusColor={statusColor}
              label={isRemovingMode && isClickable ? 'Bonus du retrait' : 'Bonus'}
              value={isRemovingMode && isClickable ? removalBonusText : bonusText}
              note={actionText}
              noteColor={isClickable ? SLOT_COLORS.available : SLOT_COLORS.unavailable}
            />
        );
    };

    const getSlotTooltipContent = () => {
        if (!hoveredSlot || removingItem) return null;
        const { type, planetId, index } = hoveredSlot;

        let planetData = getPlanetData(planetId);
        let satelliteData: Satellite | null = null;

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
            const bonusText = <BonusIcons bonus={bonus} />;

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
                isClickable = isOccupied && !!player && player.id === currentPlayer.id && !!onOrbit;
            } else {
                isClickable = isNextAvailable && canOrbit && !!onOrbit;
            }

            return renderTooltipContent(isOccupied, isClickable, player!, bonusText, orbitReason, "Cliquez pour mettre en orbite (Coût: 1 Crédit, 1 Énergie)", interactionState.type === 'REMOVING_ORBITER', 'orbiter');
        }

        if (type === 'lander') {
            let landSlots: Bonus[] = [];
            let landers: Probe[] = [];

            if (satelliteData) {
                landSlots = [satelliteData.landBonus];
                landers = satelliteData.landers || [];
            } else {
                landSlots = planetData!.landSlots || [];
                landers = planetData!.landers || [];
            }

            if (index >= landSlots.length) return null;
            const bonus = landSlots[index];

            const probesOnSlot = landers.filter(p => p.planetSlotIndex === index);
            const probe = probesOnSlot.length > 0 ? probesOnSlot[probesOnSlot.length - 1] : undefined;
            const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
            const bonusText = <BonusIcons bonus={bonus} />;

            const isOccupied = !!player;
            const isPrevSlotOccupied = index === 0 || landers.some(p => p.planetSlotIndex === index - 1);
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

            let isClickable = false;
            if (interactionState.type === 'REMOVING_LANDER') {
                isClickable = isOccupied && !!player && player.id === currentPlayer.id && !!onLand;
            } else {
                isClickable = (isNextAvailable || (allowOccupiedLanding && isOccupied)) && (canLand || interactionState.type === 'LANDING_PROBE') && !!onLand;
            }

            const actionTextSuccess = interactionState.type === 'LANDING_PROBE'
                ? "Cliquez pour atterrir (Bonus)"
                : `Cliquez pour atterrir (Coût: ${landEnergyCost} Énergie)`;

            return renderTooltipContent(isOccupied, isClickable, player!, bonusText, landReason, actionTextSuccess, interactionState.type === 'REMOVING_LANDER', 'lander');
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

    // Une sonde du joueur humain peut se mettre en orbite ou se poser : le panneau clignote
    const actingPlayer = game.players[game.currentPlayerIndex];
    const canOrbitOrLand = actingPlayer.type === 'human' && !actingPlayer.hasPerformedMainAction && interactionState.type === 'IDLE'
        && actingPlayer.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM
            && (ProbeSystem.canOrbit(game, actingPlayer.id, p.id).canOrbit || ProbeSystem.canLand(game, actingPlayer.id, p.id).canLand));
    // Planète concernée (celle où se trouve la sonde), mise en surbrillance dans le panneau
    const actionPlanetId = canOrbitOrLand ? ProbeSystem.probeOnPlanetInfo(game, actingPlayer.id).planetId : null;

    return (
        <div 
            ref={panelRef}
            className={`seti-foldable-container seti-icon-panel seti-planet-board ${isOpen ? 'open' : 'collapsed'} ${canOrbitOrLand && !isOpen ? 'seti-flash-green' : ''}`}
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
            style={{ pointerEvents: 'auto' }}
        >
            <div className="seti-foldable-header" onClick={() => setIsOpen(!isOpen)}>
                <span className={`panel-icon ${canOrbitOrLand ? 'seti-flash-green-icon' : ''}`}>🪐</span>
                <span className="panel-title">Planètes</span>
            </div>
            <div className="seti-foldable-content">
                <div className="planet-grid">
                    {planets.map(planet => (
                        <div 
                            key={planet.id} 
                            className={`planet-icon-wrapper ${planet.id === actionPlanetId ? 'seti-flash-green' : ''}`}
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