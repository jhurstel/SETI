import React, { useState, useRef } from 'react';
import { tutorialAllows, useTutorialFocus, useTutorialPanel } from './tutorialFocus';
import { useCloseOnOutsideClick } from './hooks/useCloseOnOutsideClick';
import { SlotTooltipContent } from './solar/slotTooltip';
import { findPlanet } from './solar/planets';
import { ActionType, Game, InteractionState, Planet, ProbeState } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { PlanetIcon } from './components/PlanetIcon';
import { Tooltip } from './Tooltip';
import { OrbiterOrLanderIcon, OrbiterIcon, LanderIcon } from './components/ObjectiveSymbol';
import './PlanetBoardUI.css';
import { useCloseTooltipOnClick } from './hooks/useCloseTooltipOnClick';

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
const PlanetBoardUIView: React.FC<PlanetBoardUIProps> = ({ game, interactionState, onOrbit, onLand, setActiveTooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Ouvert par un clic sur le bandeau titre : il reste ouvert quand la souris sort du panneau (un clic ailleurs le referme)
    const [isPinned, setIsPinned] = useState(false);
    // Lu par les infobulles des planètes (fermetures créées au survol) : toujours la valeur à jour
    const pinnedRef = useRef(false);
    pinnedRef.current = isPinned;
    const panelRef = useRef<HTMLDivElement>(null);
    const tutorialFocus = useTutorialFocus();
    const tutorialPinned = useTutorialPanel('planets', setIsOpen);
    useCloseOnOutsideClick(panelRef, isOpen, () => { setIsOpen(false); setIsPinned(false); });
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [removingItem, setRemovingItem] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number } | null>(null);
    const processingRef = useRef(false);
    const [hoveredSlot, setHoveredSlot] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number, rect: DOMRect } | null>(null);
    useCloseTooltipOnClick(() => setHoveredSlot(null));


    // Planètes du plateau, puis Oumuamua une fois découvert (posé sur le plateau du système solaire)
    const oumuamuaOnBoard = (game.board.solarSystem.extraCelestialObjects || []).some(o => o.id === 'oumuamua');
    const planets = [...PLANET_IDS, ...(oumuamuaOnBoard ? ['oumuamua'] : [])].map(id => findPlanet(game, id)).filter(p => p) as Planet[];

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
            // La fenêtre de la planète se ferme avant que la souris ne quitte l'emplacement : son infobulle aussi
            setHoveredSlot(null);
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
        if (pinnedRef.current || tutorialPinned) return;
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
                <div className="planet-window">
                    <div className="planet-window-header">
                        <div className="planet-window-title">
                            {planet.name}
                        </div>
                    </div>
                    <div className="planet-window-body">
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

    // Orbiteurs et atterrisseurs (lunes comprises) : une ligne chacun, une pastille de la couleur du joueur par sonde, dans l'ordre d'arrivée ;
    // les atterrisseurs restent sur la 2e ligne, même sans orbiteur (ligne vide gardée)
    const renderProbeOwners = (planet: Planet) => {
        const landers = [...planet.landers, ...(planet.satellites || []).flatMap(s => s.landers || [])];
        const rows = [
            { kind: 'orbit' as const, label: 'Orbiteurs', probes: planet.orbiters },
            { kind: 'land' as const, label: 'Atterrisseurs', probes: landers },
        ];
        if (rows.every(row => row.probes.length === 0)) return null;
        return (
            <div className="planet-probe-owners">
                {rows.map(row => row.probes.length === 0 ? <div key={row.kind} className="planet-probe-row empty" aria-hidden="true" /> : (
                    <div key={row.kind} className="planet-probe-row" aria-label={`${row.label} : ${row.probes.map(p => game.players.find(pl => pl.id === p.ownerId)?.name).join(', ')}`}>
                        {row.kind === 'orbit' ? <OrbiterIcon size={13} /> : <LanderIcon size={13} />}
                        {row.probes.map(probe => (
                            <span key={probe.id} className="planet-probe-dot" style={{ background: game.players.find(p => p.id === probe.ownerId)?.color ?? '#888' }} />
                        ))}
                    </div>
                ))}
            </div>
        );
    };

    // Une sonde du joueur humain peut se mettre en orbite ou se poser : le panneau clignote
    const actingPlayer = game.players[game.currentPlayerIndex];
    const canOrbitOrLand = actingPlayer.type === 'human' && !actingPlayer.hasPerformedMainAction && interactionState.type === 'IDLE'
        && actingPlayer.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM
            && ((ProbeSystem.canOrbit(game, actingPlayer.id, p.id).canOrbit && tutorialAllows(tutorialFocus, ActionType.ORBIT))
                || (ProbeSystem.canLand(game, actingPlayer.id, p.id).canLand && tutorialAllows(tutorialFocus, ActionType.LAND))));
    // Planète concernée (celle où se trouve la sonde), mise en surbrillance dans le panneau
    const actionPlanetId = canOrbitOrLand ? ProbeSystem.probeOnPlanetInfo(game, actingPlayer.id).planetId : null;

    return (
        <div
            ref={panelRef}
            data-tutorial="planets"
            className={`seti-foldable-container seti-icon-panel seti-planet-board ${isOpen ? 'open' : 'collapsed'} ${canOrbitOrLand && !isOpen ? 'seti-flash-green' : ''} pointer-auto`}
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
           
        >
            <div className="seti-foldable-header" onClick={() => { const pin = !isPinned; setIsPinned(pin); setIsOpen(pin); }}>
                <span className={`panel-icon ${canOrbitOrLand ? 'seti-flash-green-icon' : ''}`}><OrbiterOrLanderIcon size={24} /></span>
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
                            <div className="planet-main">
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
                            {renderProbeOwners(planet)}
                        </div>
                    ))}
                </div>
            </div>
            {hoveredSlot && !removingItem && (
                <Tooltip
                    // Même infobulle que sur le plateau du système solaire (état, coût et bonus sur une ligne, action ou raison)
                    content={<SlotTooltipContent game={game} interactionState={interactionState} slot={hoveredSlot} actions={{ orbit: !!onOrbit, land: !!onLand }} />}
                    targetRect={hoveredSlot.rect}
                    pointerEvents="auto"
                    disableCollision={true}
                />
            )}
        </div>
    );
};

/** Mémoïsé : redessiné seulement quand ses props changent (partie, interaction…), pas à chaque rendu de BoardUI */
export const PlanetBoardUI = React.memo(PlanetBoardUIView);
