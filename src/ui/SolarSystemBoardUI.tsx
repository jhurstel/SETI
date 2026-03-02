import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Game, Probe, DiskName, SectorNumber, DISK_NAMES, RotationDisk, ProbeState, GAME_CONSTANTS, SectorType, InteractionState, AlienBoardType, CelestialObject, GamePhase, LifeTraceType } from '../core/types';
import { createRotationState, calculateReachableCellsWithEnergy, calculateAbsolutePosition, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, getObjectPosition, getAbsoluteSectorForProbe, polarToCartesian, describeArc, sectorToIndex, calculateObjectPosition, SolarSystemCell } from '../core/SolarSystemPosition';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { Tooltip } from './Tooltip';
import { PLANET_STYLES, PLANET_SIZES } from './styles/celestialStyles';
import { PlanetIcon } from './components/PlanetIcon';
import { RotationDiskSector } from './components/RotationDiskSector';
import { SectorDetails } from './components/SectorDetails';
import { SvgBonus } from './components/SvgBonus';
import './SolarSystemBoardUI.css'

interface SolarSystemBoardUIProps {
  game: Game;
  interactionState: InteractionState;
  onProbeMove: (probeId: string, path: string[]) => void;
  onPlanetClick: (planetId: string) => void;
  onOrbit: (planetId: string, slotIndex?: number) => void;
  onLand: (planetId: string, slotIndex?: number) => void;
  onBackgroundClick: () => void;
  onSectorClick: (sectorId: string) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null) => void;
  onMascamiteClick: (planetId: string, tokenIndex: number) => void;
}

export const SolarSystemBoardUI: React.FC<SolarSystemBoardUIProps> = ({ game, interactionState, onProbeMove, onPlanetClick, onOrbit, onLand, onBackgroundClick, onSectorClick, setActiveTooltip, onMascamiteClick }) => {

  // État pour gérer la sonde sélectionnée et les cases accessibles
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [reachableCells, setReachableCells] = useState<Map<string, { movements: number; path: string[]; media: number }>>(new Map());
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const planetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [hoveredSlot, setHoveredSlot] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number, rect: DOMRect } | null>(null);

  // État pour gérer l'animation de retrait
  const [removingItem, setRemovingItem] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number } | null>(null);
  const processingRef = useRef(false);

  // Helper pour récupérer les données d'une planète (y compris Oumuamua)
  const getPlanetData = (planetId: string) => {
    let planet = game.board.planets.find(p => p.id === planetId);
    if (!planet && planetId === 'oumuamua') {
      const species = game.species.find(s => s.name === AlienBoardType.OUMUAMUA);
      if (species) planet = species.planet;
    }
    return planet;
  };

  // Helper pour gérer le clic sur un slot (orbite ou atterrissage) avec animation de retrait si nécessaire
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

  // Fonction pour calculer le contenu du tooltip d'un slot (Orbite/Atterrissage)
  // Cette fonction est appelée au niveau racine pour éviter les problèmes de rendu dans le SVG
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

  // Calcul des secteurs à mettre en surbrillance (flash vert)
  const getHighlightedSectors = () => {
    const currentPlayer = game.players[game.currentPlayerIndex];
    let sectors: string[] = [];

    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      if (interactionState.onlyProbes) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const sectorsWithProbes = new Set<string>();

        currentPlayer.probes.forEach(p => {
          if (p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition) {
            const absoluteSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
            sectorsWithProbes.add(`sector_${absoluteSector}`);
          }
        });
        sectors = Array.from(sectorsWithProbes);
      } else if (interactionState.adjacents) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, game.board.solarSystem.extraCelestialObjects);
        if (earthPos) {
          sectors = game.board.sectors.filter(s => Math.abs(parseInt(s.id.split('_')[1]) - earthPos.absoluteSector) <= 1 || Math.abs(parseInt(s.id.split('_')[1]) - earthPos.absoluteSector) === 7).map(s => s.id);
        }
      } else if (interactionState.color === SectorType.ANY) {
        sectors = game.board.sectors.map(s => s.id);
      } else if (interactionState.color === SectorType.OUMUAMUA) {
        sectors.push('oumuamua');
        const oumuamua = (game.board.solarSystem.extraCelestialObjects || []).find(o => o.id === 'oumuamua');
        if (oumuamua) {
          const rotationState = createRotationState(
            game.board.solarSystem.rotationAngleLevel1 || 0,
            game.board.solarSystem.rotationAngleLevel2 || 0,
            game.board.solarSystem.rotationAngleLevel3 || 0
          );
          const absPos = calculateAbsolutePosition(oumuamua, rotationState, game.board.solarSystem.extraCelestialObjects);
          sectors.push(`sector_${absPos.absoluteSector}`);
        }
      } else {
        sectors = game.board.sectors.filter(s => s.color === interactionState.color).map(s => s.id);
      }
    } else if (interactionState.type === 'IDLE' && !currentPlayer.hasPerformedMainAction && game.phase !== GamePhase.SETUP) {
      // Earth sector
      const earthPos = getObjectPosition('earth', game.board.solarSystem.rotationAngleLevel1 || 0, game.board.solarSystem.rotationAngleLevel2 || 0, game.board.solarSystem.rotationAngleLevel3 || 0, game.board.solarSystem.extraCelestialObjects);
      if (earthPos) {
        sectors = [`sector_${earthPos.absoluteSector}`];

        const currentPlayer = game.players[game.currentPlayerIndex];
        const hasObs1 = currentPlayer.technologies.some(t => t.id.startsWith('observation-1'));

        if (hasObs1) {
          const prev = earthPos.absoluteSector === 1 ? 8 : earthPos.absoluteSector - 1;
          const next = earthPos.absoluteSector === 8 ? 1 : earthPos.absoluteSector + 1;
          sectors.push(`sector_${prev}`);
          sectors.push(`sector_${next}`);
        }
      }
    }

    // Check Oumuamua
    if (sectors.length > 0) {
      const oumuamua = (game.board.solarSystem.extraCelestialObjects || []).find(o => o.id === 'oumuamua');
      if (oumuamua) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const absPos = calculateAbsolutePosition(oumuamua, rotationState, game.board.solarSystem.extraCelestialObjects);
        if (sectors.includes(`sector_${absPos.absoluteSector}`)) {
          sectors.push('oumuamua');
        }
      }
    }

    return sectors;
  };

  const highlightPlayerProbes = interactionState.type === 'MOVING_PROBE';
  const freeMovementCount = interactionState.type === 'MOVING_PROBE' ? interactionState.count : 0;
  const autoSelectProbeId = interactionState.type === 'MOVING_PROBE' ? interactionState.autoSelectProbeId : undefined;

  // Utiliser les angles de rotation depuis le jeu, ou les angles initiaux si non définis
  const initialAngle1 = (sectorToIndex[game.board.solarSystem.initialSectorLevel1] || 0) * 45;
  const initialAngle2 = (sectorToIndex[game.board.solarSystem.initialSectorLevel2] || 0) * 45;
  const initialAngle3 = (sectorToIndex[game.board.solarSystem.initialSectorLevel3] || 0) * 45;
  const gameAngle1 = useMemo(() => game.board.solarSystem.rotationAngleLevel1 ?? initialAngle1, [game.board.solarSystem.rotationAngleLevel1, initialAngle1]);
  const gameAngle2 = useMemo(() => game.board.solarSystem.rotationAngleLevel2 ?? initialAngle2, [game.board.solarSystem.rotationAngleLevel2, initialAngle2]);
  const gameAngle3 = useMemo(() => game.board.solarSystem.rotationAngleLevel3 ?? initialAngle3, [game.board.solarSystem.rotationAngleLevel3, initialAngle3]);

  // État pour gérer l'angle de rotation des plateaux
  const [rotationAngle1, setRotationAngle1] = useState<number>(() => gameAngle1);
  const [rotationAngle2, setRotationAngle2] = useState<number>(() => gameAngle2);
  const [rotationAngle3, setRotationAngle3] = useState<number>(() => gameAngle3);

  // Effet pour sélectionner automatiquement la sonde demandée
  useEffect(() => {
    if (autoSelectProbeId) {
      setSelectedProbeId(autoSelectProbeId);
    }
  }, [autoSelectProbeId]);

  // Effet pour réinitialiser la sélection à la fin du tour
  useEffect(() => {
    setSelectedProbeId(null);
    setReachableCells(new Map());
    setHighlightedPath([]);
  }, [game.currentPlayerIndex]);

  // Effet pour calculer les cases accessibles quand une sonde est sélectionnée
  useEffect(() => {
    if (selectedProbeId) {
      const probe = game.board.solarSystem.probes.find(p => p.id === selectedProbeId);
      if (probe && probe.solarPosition) {
        const currentPlayer = game.players[game.currentPlayerIndex];
        const rotationState = createRotationState(rotationAngle1, rotationAngle2, rotationAngle3);

        // Calculer la position absolue de la sonde pour le pathfinding
        const tempObj: CelestialObject = {
          id: 'temp',
          type: 'empty',
          name: 'temp',
          position: {
            disk: probe.solarPosition.disk,
            sector: probe.solarPosition.sector,
            x: 0, y: 0
          },
          level: (probe.solarPosition.level || 0) as 0 | 1 | 2 | 3
        };
        const absPos = calculateAbsolutePosition(tempObj, rotationState, game.board.solarSystem.extraCelestialObjects);

        const movementBonus = freeMovementCount;

        const hasAsteroidTech = currentPlayer.technologies.some(t => t.id.startsWith('exploration-2'));
        const hasAsteroidBuff = currentPlayer.activeBuffs.some(b => b.type === 'ASTEROID_EXIT_COST');
        const ignoreAsteroidPenalty = hasAsteroidTech || hasAsteroidBuff;

        const getMediaBonus = (cell: SolarSystemCell) => {
          let bonus = 0;
          if (cell.hasComet) bonus++;
          if (cell.hasPlanet && cell.planetId !== 'earth') bonus++;
          if (cell.hasAsteroid && hasAsteroidTech) bonus++;
          return bonus;
        };

        const reachable = calculateReachableCellsWithEnergy(
          probe.solarPosition.disk,
          absPos.absoluteSector,
          movementBonus,
          currentPlayer.energy,
          rotationState,
          ignoreAsteroidPenalty,
          getMediaBonus,
          game.board.solarSystem.extraCelestialObjects
        );

        // Retirer la case actuelle des cases accessibles
        const currentKey = `${probe.solarPosition.disk}${absPos.absoluteSector}`;
        reachable.delete(currentKey);

        setReachableCells(reachable);
      } else {
        setReachableCells(new Map());
      }
    } else {
      setReachableCells(new Map());
      setHighlightedPath([]);
    }
  }, [selectedProbeId, game, rotationAngle1, rotationAngle2, rotationAngle3, highlightPlayerProbes, freeMovementCount]);

  // Effet pour sélectionner automatiquement la sonde s'il n'y en a qu'une lors d'un mouvement gratuit
  useEffect(() => {
    if (highlightPlayerProbes) {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const playerProbes = game.board.solarSystem.probes.filter(
        p => p.ownerId === currentPlayer.id && p.state === ProbeState.IN_SOLAR_SYSTEM
      );

      if (playerProbes.length === 1) {
        const probe = playerProbes[0];
        if (selectedProbeId !== probe.id) {
          setSelectedProbeId(probe.id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightPlayerProbes, game]);

  // Mémo pour obtenir toutes les sondes dans le système solaire
  const probesInSystem = useMemo(() => {
    return game.board.solarSystem.probes || [];
  }, [game.board.solarSystem.probes]);

  // Ref pour le timeout de fermeture du tooltip
  const hoverTimeoutRef = useRef<any>(null);

  const handleMouseEnterObject = (e: React.MouseEvent<HTMLDivElement>, obj: CelestialObject) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    let content: React.ReactNode;
    let tooltipProps: Partial<Parameters<typeof setActiveTooltip>[0]> = {};

    const currentPlayer = game.players[game.currentPlayerIndex];

    // Special handling for Oumuamua which might be typed as asteroid but behaves like a planet with slots
    const isOumuamua = obj.id === 'oumuamua';
    const effectiveType = isOumuamua ? 'planet' : obj.type;

    switch (effectiveType) {
      case 'planet': {
        const planetData = getPlanetData(obj.id);
        if (planetData) {
          content = (
            <div style={{ minWidth: '350px' }}>
              <div style={{ borderBottom: '1px solid #444', paddingBottom: '8px', marginBottom: '12px', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#78a0ff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  {planetData.name}
                </div>
                <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa', fontStyle: 'italic' }}>
                  Visiter pour gagner 1 media
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', marginTop: '50px', minHeight: '220px', alignItems: 'center' }}>
                <PlanetIcon id={planetData.id} size={planetData.id === 'oumuamua' ? 80 : 220} planetData={planetData} game={game} interactionState={interactionState} onOrbit={onOrbit} onLand={onLand} handleSlotClick={handleSlotClick} removingItem={removingItem} hoverTimeoutRef={hoverTimeoutRef} setHoveredSlot={setHoveredSlot} />
              </div>
            </div>
          );
          tooltipProps = {
            onMouseEnter: () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); },
            onMouseLeave: handleMouseLeaveObject,
            pointerEvents: 'auto'
          };
        } else {
          // Fallback for Earth or other objects without detailed data
          let subContent;
          const isRobot = currentPlayer.type === 'robot';
          if (obj.id === 'earth') {
            const check = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
            let text = `Lancer une sonde (coût: ${GAME_CONSTANTS.PROBE_LAUNCH_COST} Crédits)`;
            let color = '#aaa';
            if (currentPlayer.hasPerformedMainAction || isRobot) {
              text = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
              color = '#ff6b6b';
            } else if (!check.canLaunch) {
              text = check.reason || "Impossible";
              color = '#ff6b6b';
            } else if (check.canLaunch) {
              color = '#4a9eff';
            }
            subContent = <div style={{ fontSize: '0.8em', marginTop: '4px', color: color, fontStyle: 'italic' }}>{text}</div>;
          } else {
            subContent = <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa', fontStyle: 'italic' }}>Visiter pour gagner 1 Média</div>;
          }
          content = <><div style={{ fontWeight: 'bold' }}>{obj.name}</div>{subContent}</>;
        }
        break;
      }
      case 'comet': {
        const subContent = <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa', fontStyle: 'italic' }}>Visiter pour gagner 1 Média</div>;
        content = <><div style={{ fontWeight: 'bold' }}>{obj.name}</div>{subContent}</>;
        break;
      }
      case 'asteroid': {
        const hasTech = currentPlayer.technologies.some(t => t.id.startsWith('exploration-2'));
        const subContent = (
          <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa', fontStyle: 'italic' }}>
            {hasTech ? 'Visiter pour gagner 1 Média' : 'Quitter nécessite 1 déplacement supplémentaire'}
          </div>
        );
        content = <><div style={{ fontWeight: 'bold' }}>{obj.name}</div>{subContent}</>;
        break;
      }
      case 'anomaly': {
        const bonusText = obj.anomalyData ? (ResourceSystem.formatBonus(obj.anomalyData.bonus) || []).join(', ') : 'Inconnu';
        content = (
          <div>
            <div style={{ fontWeight: 'bold', color: obj.anomalyData?.color === LifeTraceType.YELLOW ? '#ffd700' : obj.anomalyData?.color === LifeTraceType.RED ? '#ff6b6b' : '#4a9eff' }}>{obj.name}</div>
            <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus: {bonusText}</div>
          </div>
        );
        break;
      }
      default:
        content = <div style={{ fontWeight: 'bold' }}>{obj.name}</div>;
        break;
    }

    let rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      content,
      rect,
      ...tooltipProps
    });
  };

  const handleMouseLeaveObject = () => {
    hoverTimeoutRef.current = setTimeout(() => setActiveTooltip(null), 300);
  };

  // Gestion du redimensionnement pour maintenir le ratio carré
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<number>(0);

  // Effet pour redimensionner pour maintenir le ratio carré
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setBoardSize(Math.min(width, height));
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Synchroniser les angles avec le jeu seulement lors du montage initial ou si le jeu change de manière significative
  // Utiliser une ref pour suivre les valeurs précédentes
  const prevGameAnglesRef = React.useRef({ gameAngle1, gameAngle2, gameAngle3 });

  useEffect(() => {
    // Ne synchroniser que si la différence est significative ET que ce n'est pas juste un re-render
    const prev = prevGameAnglesRef.current;
    if (Math.abs(gameAngle1 - prev.gameAngle1) > 1 && Math.abs(gameAngle1 - rotationAngle1) > 1) {
      setRotationAngle1(gameAngle1);
      prevGameAnglesRef.current.gameAngle1 = gameAngle1;
    }
  }, [gameAngle1, rotationAngle1]);

  useEffect(() => {
    const prev = prevGameAnglesRef.current;
    if (Math.abs(gameAngle2 - prev.gameAngle2) > 1 && Math.abs(gameAngle2 - rotationAngle2) > 1) {
      setRotationAngle2(gameAngle2);
      prevGameAnglesRef.current.gameAngle2 = gameAngle2;
    }
  }, [gameAngle2, rotationAngle2]);

  useEffect(() => {
    const prev = prevGameAnglesRef.current;
    if (Math.abs(gameAngle3 - prev.gameAngle3) > 1 && Math.abs(gameAngle3 - rotationAngle3) > 1) {
      setRotationAngle3(gameAngle3);
      prevGameAnglesRef.current.gameAngle3 = gameAngle3;
    }
  }, [gameAngle3, rotationAngle3]);

  // Fonction helper pour rendre l'indicateur de rotation (signe >) adossé à la tuile
  const renderRotationIndicator = (planetId: string, level: number, sectorOffset: number = 0, keySuffix: string = '') => {
    let obj: CelestialObject | undefined;
    if (planetId === 'saturn') {
      obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(o => o.id === 'saturn');
    } else if (planetId === 'jupiter') {
      obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(o => o.id === 'jupiter');
    } else if (planetId === 'mars') {
      obj = INITIAL_ROTATING_LEVEL2_OBJECTS.find(o => o.id === 'mars');
    } else if (planetId === 'earth') {
      obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'earth');
    } else if (planetId === 'mercury') {
      obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'mercury');
    }

    if (!obj) return null;

    const originalSector = obj.position.sector;
    const newSector = (((originalSector - 1) + sectorOffset) % 8) + 1 as SectorNumber;

    const { sectorCenterAngle, diskIndex } = calculateObjectPosition(obj.position.disk, newSector);

    // Positionner sur le bord extérieur du disque
    const diskWidth = 8;
    const sunRadius = 4;
    const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
    const indicatorRadius = outerRadius - 1.7;

    // Décalage angulaire pour ne pas être centré (vers le bord du secteur)
    const angleOffset = diskIndex === 0 ? 30 : diskIndex === 1 ? 27 : 25;
    const indicatorAngle = sectorCenterAngle - angleOffset;

    const { x, y } = polarToCartesian(0, 0, indicatorRadius, indicatorAngle);

    return (
      <div
        key={`indicator-${planetId}${keySuffix}`}
        className={`seti-rotation-indicator level-${level}`}
        style={{
          left: `calc(50% + ${x}%)`,
          top: `calc(50% + ${y}%)`,
          transform: `translate(-50%, -50%) rotate(${indicatorAngle + 270}deg)`,
        }}
      >
        &gt;
      </div>
    );
  };

  // Fonction helper pour rendre les signaux d'Oumuamua
  const renderOumuamuaSignals = () => {
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

    const highlightedSectorSlots = getHighlightedSectors();
    const shouldFlashSlot = highlightedSectorSlots.includes('oumuamua');

    const coveredByPlayers = (sector.coveredBy || []).map((pid: string) => game.players.find(p => p.id === pid)).filter(p => !!p);
    const mediaBonusText = "1 Token pour chaque joueur présent";
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
        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc', marginBottom: '4px', color: '#fff' }}>{sector.name.toUpperCase()}</div>
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

    return (
      <g key="oumuamua-signals" style={{ pointerEvents: 'auto' }}>
        <path className="oumuamua-corridor" d={corridorPath} fill="none" stroke="#ffffff" opacity="0.15" strokeLinecap="round" style={{ pointerEvents: 'auto', cursor: 'default', strokeWidth: 7 }} />
        <defs><path id={textPathId} d={textArcPath} /></defs>
        <text fill="#ffffff" fontSize="2" fontWeight="bold" letterSpacing="0.5" opacity="0.9" style={{ pointerEvents: 'auto', cursor: 'help' }}
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

          const baseGain = ["1 Donnée"];
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
          } else if (isClickable && !canAffordScan && interactionState.type === 'IDLE') {
            stateText = "Ressources insuffisantes";
            stateColor = "#ff6b6b";
            actionText = `Nécessite ${GAME_CONSTANTS.SCAN_COST_CREDITS} crédit et ${GAME_CONSTANTS.SCAN_COST_ENERGY} énergies`;
          } else {
            actionText = "Cliquez pour marquer le signal";
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

          return (
            <g key={signal.id} transform={`translate(${pos.x}, ${pos.y})`} style={{ opacity, cursor: isClickable ? 'pointer' : 'help' }}
              onClick={(e) => { if (isClickable) { e.stopPropagation(); onSectorClick(sector.id); } }}
              onMouseEnter={(e) => setActiveTooltip({ content: slotTooltipContent, rect: e.currentTarget.getBoundingClientRect() })}
              onMouseLeave={() => setActiveTooltip(null)}
            >
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
              <circle r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="0.5" />
              {!player && signal.bonus && (
                <g transform={`scale(0.2) rotate(${-rotationAngle1})`}>
                  <SvgBonus bonus={signal.bonus} />
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // Fonction helper pour rendre une anomalie
  const renderAnomaly = (obj: CelestialObject, zIndex: number = 30) => {
    let { x, y, sectorCenterAngle } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    // Décaler l'anomalie selon l'angle du secteur
    const anomalyOffset = 7; // décalage de 9% vers l'extérieur (à adapter selon le design)
    x += anomalyOffset * Math.cos((sectorCenterAngle - 90) * Math.PI / 180);
    y += anomalyOffset * Math.sin((sectorCenterAngle - 90) * Math.PI / 180);

    const colorMap: Record<LifeTraceType, string> = {
      [LifeTraceType.RED]: '#ff6b6b',
      [LifeTraceType.BLUE]: '#4a9eff',
      [LifeTraceType.YELLOW]: '#ffd700',
      [LifeTraceType.ANY]: '#fff'
    };

    if (!obj.anomalyData) return null;

    return (
      <div
        key={obj.id}
        className="seti-anomaly"
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: '24px',
          height: '16px',
          backgroundColor: colorMap[obj.anomalyData.color] || '#fff',
          borderRadius: '50%',
          zIndex,
          position: 'absolute',
          transform: 'translate(-50%, -50%) scale(1.5)',
          boxShadow: `0 0 5px ${colorMap[obj.anomalyData.color] || '#fff'}`,
          border: '1px solid white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'help',
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
      >
        <div style={{ transform: 'scale(0.5)' }}>
          <SvgBonus bonus={obj.anomalyData.bonus} />
        </div>
      </div>
    );
  };

  // Fonction helper pour rendre une planète
  const renderPlanet = (obj: CelestialObject, zIndex: number = 30) => {
    let { x, y, sectorCenterAngle } = calculateObjectPosition(obj.position.disk, obj.position.sector);

    const style = PLANET_STYLES[obj.id] || {
      background: 'radial-gradient(circle, #888, #555)',
      border: '2px solid #aaa',
      boxShadow: '0 0 3px rgba(136, 136, 136, 0.8)',
    };
    const size = PLANET_SIZES[obj.id] || 24;

    // Check if planet has orbiters on it (dashed circle)
    const planetData = getPlanetData(obj.id);
    const hasOrbiters = planetData && planetData.orbiters && planetData.orbiters.length > 0;

    // Check if user can interact with a planet where he has a probe (glow effect)
    const currentPlayer = game.players[game.currentPlayerIndex];
    const isRobot = currentPlayer.type === 'robot';
    const playerProbe = currentPlayer.probes.find(p =>
      p.ownerId === currentPlayer.id &&
      p.state === ProbeState.IN_SOLAR_SYSTEM &&
      p.solarPosition.disk === obj.position.disk &&
      p.solarPosition.sector === obj.position.sector &&
      p.solarPosition.level === obj.level
    );
    let canInteract = false;

    if (interactionState.type === 'REMOVING_ORBITER') {
      const planetData = getPlanetData(obj.id);
      if (planetData && planetData.orbiters.some(p => p.ownerId === currentPlayer.id)) {
        canInteract = true;
      }
    } else if (!currentPlayer.hasPerformedMainAction && !isRobot && game.phase !== GamePhase.SETUP) {
      if (obj.id === 'earth') {
        canInteract = ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch;
      } else if (playerProbe) {
        const canOrbit = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id).canOrbit;
        const canLand = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id).canLand;
        canInteract = canOrbit || canLand;
      }
    }

    // Handle transform separation for Oumuamua to avoid scaling slots
    let containerTransform = style.transform;
    let bodyTransform = undefined;
    if (obj.id === 'oumuamua') {
      const pos = polarToCartesian(0, 0, 24, sectorCenterAngle + 14);
      x = pos.x;
      y = pos.y;
      containerTransform = 'translate(-50%, -50%) rotate(60deg)';
      bodyTransform = 'translate(-50%, -50%) scale(2.8, 0.6)';
    }

    return (
      <div
        key={obj.id}
        className="seti-planet"
        ref={(el) => {
          if (el) planetRefs.current.set(obj.id, el);
          else planetRefs.current.delete(obj.id);
        }}
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: `${size}px`,
          height: `${size}px`,
          zIndex,
          pointerEvents: selectedProbeId ? 'none' : 'auto',
          filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.4))',
          transform: containerTransform,
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
        onClick={() => onPlanetClick && onPlanetClick(obj.id)}
      >
        {hasOrbiters && (
          <div className="seti-planet-orbit-ring"
            style={{
              width: `${size + 15}px`,
              height: `${size + 15}px`,
            }}
          />
        )}
        {canInteract && (
          <>
            <div className="seti-planet-interaction-base"
              style={{
                width: `${size + 12}px`,
                height: `${size + 12}px`,
              }}
            />
            <div className="seti-planet-interaction-glow"
              style={{
                width: `${size + 12}px`,
                height: `${size + 12}px`,
              }}
            />
          </>
        )}
        <div className="seti-planet-body"
          style={{
            width: `${size - 4}px`,
            height: `${size - 4}px`,
            background: style.background,
            border: style.border,
            boxShadow: style.boxShadow,
            borderRadius: style.borderRadius || '50%',
            transform: bodyTransform,
          }}
        >
          {style.hasBands && (
            <>
              {[30, 45, 60, 75].map((top, i) => (
                <div
                  key={i}
                  className="seti-planet-band"
                  style={{
                    top: `${top}%`,
                    height: i % 2 === 0 ? '3px' : '2px',
                    background: `rgba(${150 - i * 5}, ${120 - i * 5}, ${80 - i * 5}, ${0.8 - i * 0.1})`,
                  }}
                />
              ))}
            </>
          )}
          {style.hasContinents && (
            <div className="seti-planet-continents" />
          )}
        </div>
        {style.hasRings && (
          <>
            <div className="seti-planet-ring-outer"
              style={{
                width: `${size + 12}px`,
                height: `${size / 2}px`,
              }}
            />
            <div className="seti-planet-ring-inner"
              style={{
                width: `${size + 8}px`,
                height: `${(size - 2) / 2}px`,
              }}
            />
          </>
        )}

        {/* Mascamite Tokens */}
        {planetData && planetData.mascamiteTokens && planetData.mascamiteTokens.map((_token, i) => {
          const count = planetData.mascamiteTokens!.length;
          const dist = count === 1 ? 0 : size * 0.35;
          const angle = (360 / count) * i - 90;
          const { x: tx, y: ty } = polarToCartesian(0, 0, dist, angle);
          const isClickable = interactionState.type === 'COLLECTING_SPECIMEN' && interactionState.planetId === planetData.id;

          return (
            <div
              key={`masc-${i}`}
              style={{
                position: 'absolute',
                top: `calc(50% + ${ty}px)`,
                left: `calc(50% + ${tx}px)`,
                width: '12px',
                height: '12px',
                backgroundColor: '#4a148c',
                border: '1px solid #ea80fc',
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 40,
                cursor: isClickable ? 'pointer' : 'help',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                pointerEvents: 'auto',
                boxShadow: isClickable ? '0 0 5px #00ff00' : 'none'
              }}
              onClick={(e) => {
                if (isClickable) { e.stopPropagation(); onMascamiteClick(planetData.id, i); }
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveTooltip({
                  content: (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: '#ea80fc', marginBottom: '4px' }}>Spécimen Mascamite</div>
                      <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus : Inconnu</div>
                    </div>
                  ),
                  rect
                });
              }}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <span style={{ fontSize: '5px', color: '#fff', fontWeight: 'bold' }}>M</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Fonction helper pour rendre une comète
  const renderComet = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y, sectorCenterAngle } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    // Direction tangentielle dans le sens horaire (croissant 1→8) : angle - 90°
    const tailAngle = sectorCenterAngle - 90;
    const tailLength = obj.position.disk === 'A' ? 30 : obj.position.disk === 'B' ? 50 : 70;
    const nucleusOffset = obj.position.disk === 'A' ? 15 : obj.position.disk === 'B' ? 25 : 35;

    return (
      <div
        key={obj.id}
        className="seti-celestial-object"
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: '20px',
          height: '20px',
          zIndex,
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
      >
        <div
          className="seti-comet-tail"
          style={{
            transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
            width: `${tailLength}px`,
          }}
        />
        <div
          className="seti-comet-nucleus"
          style={{
            transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(${nucleusOffset}px)`
          }}
        />
      </div>
    );
  };

  // Fonction helper pour générer un nombre pseudo-aléatoire basé sur une seed pour astéroïdes et sondes
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Fonction helper pour rendre un nuage d'astéroïdes
  const renderAsteroid = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    const asteroidCount = obj.position.disk === 'A' ? 4 : obj.position.disk === 'B' ? 5 : 6;
    const spread = obj.position.disk === 'A' ? 10 : obj.position.disk === 'B' ? 15 : 20;
    // Utiliser l'ID comme seed pour avoir un pattern cohérent
    const seed = obj.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return (
      <div
        key={obj.id}
        className="seti-celestial-object"
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: `${spread * 3}px`,
          height: `${spread * 2}px`,
          zIndex,
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
      >
        {Array.from({ length: asteroidCount }).map((_, i) => {
          const angle = (360 / asteroidCount) * i;
          const random1 = seededRandom(seed + i + 10);
          const random2 = seededRandom(seed + i + 100);
          const distance = 5 + spread * (random1 * 0.8);
          const { x: asteroidX, y: asteroidY } = polarToCartesian(0, 0, distance, angle);
          const size = 4 + random2 * 5;

          return (
            <div
              key={i}
              className="seti-asteroid-particle"
              style={{
                transform: `translate(calc(-50% + ${asteroidX}px), calc(-50% + ${asteroidY}px))`,
                width: `${size}px`,
                height: `${size}px`,
                boxShadow: '0 0 2px rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            />
          );
        })}
      </div>
    );
  };

  // Fonction helper pour rendre une sonde
  const renderProbe = (probe: Probe, zIndex: number = 150) => {
    if (!probe.solarPosition) return null;

    const player = game.players.find(p => p.id === probe.ownerId);
    const playerName = player?.name || 'Joueur inconnu';
    const playerColor = player?.color || '#8888ff';
    const isSelected = selectedProbeId === probe.id;
    const { x, y } = calculateObjectPosition(probe.solarPosition.disk, probe.solarPosition.sector);

    // Calculer un décalage aléatoire stable basé sur l'ID de la sonde pour éviter la superposition
    const seed = probe.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetX = (seededRandom(seed) - 0.5) * 4;       // +/- 2%
    const offsetY = (seededRandom(seed + 42) - 0.5) * 4;  // +/- 2%

    const isOwner = probe.ownerId === game.players[game.currentPlayerIndex].id;
    const shouldHighlight = highlightPlayerProbes && isOwner;
    const isRobot = player?.type === 'robot';

    return (
      <div
        key={probe.id}
        onClick={(e) => {
          e.stopPropagation();
          if (!isRobot) {
            handleProbeClick(probe);
          }
        }}
        onMouseEnter={(e) => {
          const content = (
            <>
              <div style={{ fontWeight: 'bold' }}>{playerName}</div>
              <div style={{ fontSize: '0.8em', color: '#ccc', marginTop: '2px' }}>Déplacer la sonde</div>
            </>
          );
          setActiveTooltip({ content, rect: e.currentTarget.getBoundingClientRect() });
        }}
        onMouseLeave={() => setActiveTooltip(null)}
        className="seti-probe"
        style={{
          top: `calc(50% + ${y + offsetY}%)`,
          left: `calc(50% + ${x + offsetX}%)`,
          zIndex,
          cursor: isRobot ? 'default' : 'pointer',
        }}
      >
        {/* Effet de surbrillance (pour action gratuite mouvement) */}
        {shouldHighlight && (
          <div className="seti-probe-highlight" />
        )}

        {/* Ombre portée au sol */}
        <div className="seti-probe-shadow" />

        {/* Structure de la sonde (Type Cassini/Voyager) */}
        <div className="seti-probe-body"
          style={{
            filter: isSelected ? 'drop-shadow(0 0 3px #00ff00)' : 'none',
          }}
        >
          {/* Antenne parabolique (Dish) - Partie supérieure */}
          <div className="seti-probe-dish">
            <div className="seti-probe-dish-center" />
          </div>

          {/* Corps principal (Couleur du joueur) */}
          <div className="seti-probe-core"
            style={{
              backgroundColor: playerColor,
            }}>
            <div className="seti-probe-gold" />
          </div>

          {/* Bras / Instruments (Booms) */}
          <div className="seti-probe-arm-left" />
          <div className="seti-probe-arm-right" />
          <div className="seti-probe-antenna-bottom" />
        </div>
      </div>
    );
  };

  // Fonction helper pour rendre les cases accessibles
  const renderReachableCells = () => {
    if (!selectedProbeId) return null;

    return Array.from(reachableCells.entries()).map(([cellKey, data]) => {
      const [disk, sector] = [cellKey[0] as DiskName, parseInt(cellKey.substring(1)) as SectorNumber];
      const { x, y, diskIndex } = calculateObjectPosition(disk, sector, 0);
      const diskWidth = 8;
      const sunRadius = 4;
      const innerRadius = sunRadius + (diskIndex * diskWidth);
      const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);

      const isPathStep = highlightedPath.includes(cellKey);
      const isTarget = highlightedPath.length > 0 && highlightedPath[highlightedPath.length - 1] === cellKey;

      return (
        <div
          key={`reachable-${cellKey}`}
          className="seti-reachable-cell"
          onClick={(e) => {
            e.stopPropagation();
            if (onProbeMove && selectedProbeId) {
              onProbeMove(selectedProbeId, data.path);
              setSelectedProbeId(null);
              setReachableCells(new Map());
              setHighlightedPath([]);
            }
          }}
          onMouseEnter={() => setHighlightedPath(data.path)}
          onMouseLeave={() => setHighlightedPath([])}
          style={{
            top: `calc(50% + ${y}%)`,
            left: `calc(50% + ${x}%)`,
            width: `${(outerRadius - innerRadius) * 0.8}%`,
            height: `${(outerRadius - innerRadius) * 0.8}%`,
            border: isTarget ? '2px solid #ffeb3b' : (isPathStep ? '2px solid #ffeb3b' : '2px solid #00ff00'),
            backgroundColor: isTarget ? 'rgba(255, 235, 59, 0.5)' : (isPathStep ? 'rgba(255, 235, 59, 0.3)' : 'rgba(0, 255, 0, 0.2)'),
            zIndex: isTarget ? 2002 : (isPathStep ? 2001 : 2000),
          }}
          title={`Accessible en ${data.movements} déplacement(s)${data.media > 0 ? ` (+${data.media} Média)` : ''}`}
        >
          {isPathStep && (
            <span className="seti-reachable-cell-text">
              {highlightedPath.indexOf(cellKey)}
            </span>
          )}
        </div>
      );
    });
  };

  // Fonction pour gérer le clic sur une sonde
  const handleProbeClick = (probe: Probe) => {
    setActiveTooltip(null);
    if (selectedProbeId === probe.id) {
      // Désélectionner si déjà sélectionnée
      setSelectedProbeId(null);
    } else {
      // Sélectionner la sonde
      setSelectedProbeId(probe.id);
    }
  };

  return (
    <>
      <div className="seti-panel seti-solar-system-container">
        <div className="seti-panel-title">Système solaire</div>

        {/* Conteneur pour positionner les éléments directement dans le panel */}
        <div
          ref={containerRef}
          className="seti-board-container"
        >
          {/* Conteneur interne pour positionner les éléments */}
          <div
            className="seti-board-inner"
            style={{
              width: boardSize ? `${boardSize}px` : '0px',
              height: boardSize ? `${boardSize}px` : '0px',
              opacity: boardSize ? 1 : 0,
              pointerEvents: removingItem ? 'none' : 'auto',
            }}>
            {/* Zone de clic arrière-plan pour annuler l'interaction (z-index 0, sous les planètes) */}
            <div
              className="seti-background-click-area"
              onClick={() => { if (onBackgroundClick && !selectedProbeId) onBackgroundClick(); }}
            />

            {/* Plateau fixe */}
            <div className="seti-fixed-plateau">
              {/* Soleil au centre */}
              <div className="seti-sun"></div>

              {/* Traits de délimitation et labels des 8 secteurs radiaux */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                // Calculs pour le trait de séparation
                const sectorAngle = -(360 / 8) * sectorIndex - 90; // 0° = midi (12h), sens horaire, -90° pour CSS

                return (
                  <React.Fragment key={`sector-group-${sectorIndex}`}>
                    {/* Trait de séparation */}
                    <div
                      className="seti-sector-separator"
                      style={{
                        transform: `translate(-50%, 0%) rotate(${sectorAngle}deg)`,
                      }}
                    />
                  </React.Fragment>
                );
              })}

              {/* Traits de délimitation et labels des 5 cercles concentriques (A à E) */}
              {Object.keys(DISK_NAMES).map((disk, index) => {
                // Le soleil a un rayon d'environ 4% (8% de diamètre / 2)
                // Chaque anneau a une largeur de 8%
                // A commence juste après le soleil à 4% et va jusqu'à 12%
                // B: 12% à 20%, C: 20% à 28%, D: 28% à 36%, E: 36% à 44%
                const diskWidth = 8; // Largeur de chaque anneau (augmentée)
                const sunRadius = 4; // Rayon du soleil
                const innerRadius = sunRadius + (index * diskWidth);
                const outerRadius = sunRadius + ((index + 1) * diskWidth);

                return (
                  <React.Fragment key={disk}>
                    {/* Cercle extérieur de l'anneau */}
                    <div
                      className={`seti-solar-disk disk-${disk}`}
                      style={{
                        width: `${outerRadius * 2}%`,
                        height: `${outerRadius * 2}%`,
                        zIndex: 2 + index,
                      }}
                    />
                    {/* Cercle intérieur pour créer l'anneau (masquer l'intérieur) */}
                    <div
                      className={`seti-solar-disk-inner disk-${disk}`}
                      style={{
                        width: `${innerRadius * 2}%`,
                        height: `${innerRadius * 2}%`,
                        zIndex: 2 + index + 0.5,
                      }}
                    />
                  </React.Fragment>
                );
              })}

              {/* Objets fixes */}
              {[...FIXED_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 0)].map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 10);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 10);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 10);
                } else if (obj.type === 'anomaly') {
                  return renderAnomaly(obj, 10);
                }
                return null;
              })}

              {/* Affichage des sondes fixes (disque D) */}
              {probesInSystem.filter(probe => {
                if (!probe.solarPosition) return false;
                const level = probe.solarPosition.level;
                return level === 0;
              }).map((probe) => renderProbe(probe, 150)
              )}
            </div>

            {/* Plateau rotatif niveau 1 avec 3 disques (A, B, C) - se superpose au plateau fixe */}
            <div
              className="seti-rotating-overlay seti-rotating-level-1"
              style={{
                transform: `translate(-50%, -50%) rotate(${rotationAngle1}deg)`, // Rotation dynamique
              }}
            >
              {/* Disque C (extérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk1C-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'C',
                  level: 1,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Disque B (moyen) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk1B-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'B',
                  level: 1,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Disque A (intérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk1A-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'A',
                  level: 1,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Signaux d'Oumuamua (attachés au plateau niveau 1) */}
              <svg className="seti-rotating-sector-svg" style={{ zIndex: 20, overflow: 'visible' }} viewBox="0 0 200 200">{renderOumuamuaSignals()}</svg>

              {/* Sondes sur les disques A, B, C (niveau 1) */}
              {probesInSystem
                .filter(probe => {
                  if (!probe.solarPosition) return false;
                  const level = probe.solarPosition.level;
                  return level === 1;
                })
                .map((probe) => renderProbe(probe, 150))}

              {/* Objets célestes sur le plateau rotatif niveau 1 - basés sur INITIAL_ROTATING_LEVEL1_OBJECTS */}
              {[...INITIAL_ROTATING_LEVEL1_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 1)].filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 3);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 2);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 2);
                }
                return null;
              })}

              {/* Indicateur de rotation pour Saturne */}
              {game.board.solarSystem.nextRingLevel === 1 && renderRotationIndicator('saturn', 1)}
              {game.board.solarSystem.nextRingLevel === 1 && renderRotationIndicator('jupiter', 1, 1, '-offset1')}
            </div>

            {/* Plateau rotatif niveau 2 avec 2 disques (A, B) - se superpose au niveau 3 */}
            <div
              className="seti-rotating-overlay seti-rotating-level-2"
              style={{
                transform: `translate(-50%, -50%) rotate(${rotationAngle2}deg)`,
              }}
            >
              {/* Disque B (extérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk2B-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'B',
                  level: 2,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Disque A (intérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk2A-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'A',
                  level: 2,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Sondes sur les disques A, B (niveau 2) */}
              {probesInSystem
                .filter(probe => {
                  if (!probe.solarPosition) return false;
                  const level = probe.solarPosition.level;
                  return level === 2;
                })
                .map((probe) => renderProbe(probe, 150))}

              {/* Objets célestes sur le plateau rotatif niveau 2 - basés sur INITIAL_ROTATING_LEVEL2_OBJECTS */}
              {[...INITIAL_ROTATING_LEVEL2_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 2)].filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 3);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 2);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 2);
                }
                return null;
              })}

              {/* Indicateur de rotation pour Mars */}
              {game.board.solarSystem.nextRingLevel === 2 && renderRotationIndicator('mars', 2)}
              {game.board.solarSystem.nextRingLevel === 2 && renderRotationIndicator('mars', 2, 5, '-offset5')}
            </div>

            {/* Plateau rotatif niveau 3 avec 1 disque (A) - se superpose au niveau 2 */}
            <div
              className="seti-rotating-overlay seti-rotating-level-3"
              style={{
                transform: `translate(-50%, -50%) rotate(${rotationAngle3}deg)`, // Rotation dynamique
              }}
            >
              {/* Disque A (intérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk3A-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'A',
                  level: 3,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Sondes sur le disque A (niveau 3) */}
              {probesInSystem.filter(probe => {
                if (!probe.solarPosition) return false;
                const level = probe.solarPosition.level;
                return level === 3;
              }).map((probe) => renderProbe(probe, 150)
              )}

              {/* Objets célestes sur le plateau rotatif niveau 3 - basés sur INITIAL_ROTATING_LEVEL3_OBJECTS */}
              {[...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 3)].filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 3);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 2);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 2);
                }
                return null;
              })}

              {/* Indicateur de rotation pour Terre */}
              {game.board.solarSystem.nextRingLevel === 3 && renderRotationIndicator('earth', 3)}
              {game.board.solarSystem.nextRingLevel === 3 && renderRotationIndicator('mercury', 3)}
            </div>

            {/* Backdrop pour désélectionner si on clique à côté (quand une sonde est sélectionnée) */}
            {selectedProbeId && (
              <div
                className="seti-probe-selection-backdrop"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProbeId(null);
                  setReachableCells(new Map());
                  setHighlightedPath([]);
                }}
              />
            )}

            {/* Surbrillance des cases accessibles */}
            {renderReachableCells()}
          </div>

          {/* Détails des secteurs sur le disque E (Noms + Slots) */}
          <SectorDetails game={game} interactionState={interactionState} highlightedSectorSlots={getHighlightedSectors()} onSectorClick={onSectorClick} setActiveTooltip={setActiveTooltip} />

          {/* Tooltips persistants pour l'atterrissage (Dragonfly / Landing Interaction) */}
          {interactionState.type === 'LANDING_PROBE' && (() => {
            const currentPlayer = game.players[game.currentPlayerIndex];
            // Trouver toutes les planètes où le joueur a une sonde
            const planetsWithProbes = new Set<string>();
            const allObjects = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])];

            game.board.solarSystem.probes.forEach(p => {
              if (p.ownerId === currentPlayer.id && p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition) {
                const planet = allObjects.find(o =>
                  o.type === 'planet' &&
                  o.position.disk === p.solarPosition!.disk &&
                  o.position.sector === p.solarPosition!.sector &&
                  (o.level || 0) === (p.solarPosition!.level || 0)
                );
                if (planet) planetsWithProbes.add(planet.id);
              }
            });

            return Array.from(planetsWithProbes).map(planetId => {
              const el = planetRefs.current.get(planetId);
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              const planetData = getPlanetData(planetId);
              if (!planetData) return null;

              const content = (
                <div style={{ minWidth: '350px' }}>
                  <div style={{ borderBottom: '1px solid #444', paddingBottom: '8px', marginBottom: '12px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#78a0ff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                      {planetData.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', marginTop: '50px', minHeight: '220px', alignItems: 'center' }}>
                    <PlanetIcon id={planetData.id} size={planetData.id === 'oumuamua' ? 80 : 220} planetData={planetData} game={game} interactionState={interactionState} onOrbit={onOrbit} onLand={onLand} handleSlotClick={handleSlotClick} removingItem={removingItem} hoverTimeoutRef={hoverTimeoutRef} setHoveredSlot={setHoveredSlot} />
                  </div>
                </div>
              );
              return <Tooltip key={`landing-tooltip-${planetId}`} content={content} targetRect={rect} pointerEvents="auto" />;
            });
          })()}
        </div>
      </div>

      {/* Tooltip pour les slots (recalculé dynamiquement) */}
      {hoveredSlot && !removingItem && (
        <Tooltip
          content={getSlotTooltipContent()}
          targetRect={hoveredSlot.rect}
          pointerEvents="auto"
          disableCollision={true}
        />
      )}
    </>
  );
};

SolarSystemBoardUI.displayName = 'SolarSystemBoardUI';
