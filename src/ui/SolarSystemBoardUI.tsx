import React, { useState, useImperativeHandle, forwardRef, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { Game, Probe, DiskName, SectorNumber, DISK_NAMES, RotationDisk, Planet, Bonus, ProbeState, GAME_CONSTANTS, SectorColor, SignalType, InteractionState } from '../core/types';
import { createRotationState, calculateReachableCellsWithEnergy, calculateAbsolutePosition, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, CelestialObject, getObjectPosition, getAbsoluteSectorForProbe } from '../core/SolarSystemPosition';
import { ProbeSystem } from '../systems/ProbeSystem';
import { Tooltip } from './Tooltip';
import './SolarSystemBoardUI.css'

interface SolarSystemBoardUIProps {
  game: Game;
  interactionState: InteractionState;
  onProbeMove: (probeId: string, path: string[]) => void;
  onPlanetClick: (planetId: string) => void;
  onOrbit: (planetId: string, slotIndex?: number) => void;
  onLand: (planetId: string, slotIndex?: number) => void;
  hasPerformedMainAction: boolean;
  onBackgroundClick: () => void;
  onSectorClick: (sectorNumber: number) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export interface SolarSystemBoardUIRef {
  resetRotation1: () => void;
  rotateCounterClockwise1: () => void;
  resetRotation2: () => void;
  rotateCounterClockwise2: () => void;
  resetRotation3: () => void;
  rotateCounterClockwise3: () => void;
}

export const SolarSystemBoardUI = forwardRef<SolarSystemBoardUIRef, SolarSystemBoardUIProps>(({ game, interactionState, onProbeMove, onPlanetClick, onOrbit, onLand, hasPerformedMainAction = false, onBackgroundClick, onSectorClick, setActiveTooltip }, ref) => {
  
  // État pour gérer la sonde sélectionnée et les cases accessibles
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [reachableCells, setReachableCells] = useState<Map<string, { movements: number; path: string[] }>>(new Map());
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const planetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // État pour le tooltip des slots (orbite/atterrissage) pour qu'il s'affiche par-dessus celui de la planète
  const [slotTooltip, setSlotTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);

  // État pour contrôler la visibilité des plateaux rotatifs
  //const [showLevel1, setShowLevel1] = useState<boolean>(true);
  //const [showLevel2, setShowLevel2] = useState<boolean>(true);
  //const [showLevel3, setShowLevel3] = useState<boolean>(true);


  // Helper pour les arcs SVG
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  // Helper pour les arcs SVG
  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number, reverse: boolean = false) => {
      const start = polarToCartesian(x, y, radius, endAngle);
      const end = polarToCartesian(x, y, radius, startAngle);
      const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
      
      if (reverse) {
          // Sens anti-horaire (Start -> End) pour le texte du bas
          return [ "M", end.x, end.y, "A", radius, radius, 0, largeArcFlag, 0, start.x, start.y ].join(" ");
      }

      // Sens horaire (End -> Start) pour le texte du haut
      return [ "M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y ].join(" ");
  };


  // Calculer l'angle initial basé sur le secteur (1-8)
  // Secteurs numérotés de droite à gauche (sens horaire) en partant de 12h : 1, 2, 3, 4, 5, 6, 7, 8
  // Secteur 1 = 0° (12h), secteur 2 = -45° (sens horaire), secteur 3 = -90°, etc.
  const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
  const indexToSector: { [key: number]: SectorNumber } = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 };

  // Fonction helper pour déterminer le type de secteur (normal, hollow, empty) pour tous les niveaux
  const getSectorType = (level: number, disk: DiskName, relativeSector: SectorNumber): 'normal' | 'hollow' | 'empty' => {
    let obj: CelestialObject | undefined;
    
    // Chercher dans le bon tableau selon le niveau
    if (level === 1) {
      obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(
        o => o.level === level && o.position.disk === disk && o.position.sector === relativeSector
      );
    } else if (level === 2) {
      obj = INITIAL_ROTATING_LEVEL2_OBJECTS.find(
        o => o.level === level && o.position.disk === disk && o.position.sector === relativeSector
      );
    } else if (level === 3) {
      obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(
        o => o.level === level && o.position.disk === disk && o.position.sector === relativeSector
      );
    }
    
    if (obj?.type === 'hollow') return 'hollow';
    if (obj?.type === 'empty') return 'empty';
    return 'normal';
  };
  
  // Calcul des secteurs à mettre en surbrillance (flash vert)
  const getHighlightedSectors = () => {
    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      if (interactionState.onlyProbes) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const currentPlayer = game.players[game.currentPlayerIndex];
        const sectorsWithProbes = new Set<string>();

        currentPlayer.probes.forEach(p => {
          if (p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition) {
            const absoluteSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
            sectorsWithProbes.add(`sector_${absoluteSector}`);
          }
        });
        return Array.from(sectorsWithProbes);
      }
      if (interactionState.adjacents) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
        if (earthPos) {
          return game.board.sectors.filter(s => Math.abs(parseInt(s.id.split('_')[1]) - earthPos.absoluteSector) <= 1 || Math.abs(parseInt(s.id.split('_')[1]) - earthPos.absoluteSector) === 7).map(s => s.id);
        }
      }
      if (interactionState.color === SectorColor.ANY) {
        return game.board.sectors.map(s => s.id);
      }
      return game.board.sectors.filter(s => s.color === interactionState.color).map(s => s.id);
    }
    if (interactionState.type === 'IDLE' && !hasPerformedMainAction) {
      // Earth sector
      const earthPos = getObjectPosition('earth', game.board.solarSystem.rotationAngleLevel1 || 0, game.board.solarSystem.rotationAngleLevel2 || 0, game.board.solarSystem.rotationAngleLevel3 || 0);
      if (earthPos) {
        const sectors = [`sector_${earthPos.absoluteSector}`];

        const currentPlayer = game.players[game.currentPlayerIndex];
        const hasObs1 = currentPlayer.technologies.some(t => t.id.startsWith('observation-1'));

        if (hasObs1) {
          const prev = earthPos.absoluteSector === 1 ? 8 : earthPos.absoluteSector - 1;
          const next = earthPos.absoluteSector === 8 ? 1 : earthPos.absoluteSector + 1;
          sectors.push(`sector_${prev}`);
          sectors.push(`sector_${next}`);
        }
        return sectors;
      }
    }
    return [];
  };

  const highlightPlayerProbes = interactionState.type === 'MOVING_PROBE';
  const highlightedSectorSlots = getHighlightedSectors();
  const animateSectorSlots = interactionState.type === 'IDLE';
  const freeMovementCount = interactionState.type === 'MOVING_PROBE' ? interactionState.count : 0;
  const autoSelectProbeId = interactionState.type === 'MOVING_PROBE' ? interactionState.autoSelectProbeId : undefined;
  const isLandingInteraction = interactionState.type === 'LANDING_PROBE';
  const allowOccupiedLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '16';
  const allowSatelliteLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '12';
  const isRemovingOrbiter = interactionState.type === 'REMOVING_ORBITER';

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

  const nextRingLevel = game.board.solarSystem.nextRingLevel || 3;

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

  // Ref pour le timeout de fermeture du tooltip
  const hoverTimeoutRef = useRef<any>(null);

  const handleMouseEnterObject = (e: React.MouseEvent, obj: CelestialObject) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Le contenu du tooltip est généré dans le JSX, donc on ne peut pas le passer ici directement.
    // On va devoir le reconstruire.
  };

  const handleMouseLeaveObject = () => {
    hoverTimeoutRef.current = setTimeout(() => setActiveTooltip(null), 300);
  };

  // Gestion du redimensionnement pour maintenir le ratio carré
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<number>(0);

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

  // Fonction pour réinitialiser la rotation à la position initiale (niveau 1)
  const resetRotation1 = () => {
    setRotationAngle1(initialAngle1);
  };

  // Fonction pour tourner d'un secteur (45°) dans le sens anti-horaire (niveau 1)
  const rotateCounterClockwise1 = () => {
    setRotationAngle1((prevAngle) => prevAngle - 45);
  };

  // Fonction pour réinitialiser la rotation à la position initiale (niveau 2)
  const resetRotation2 = () => {
    setRotationAngle2(initialAngle2);
  };

  // Fonction pour tourner d'un secteur (45°) dans le sens anti-horaire (niveau 2)
  // Fait aussi tourner le niveau 1
  const rotateCounterClockwise2 = () => {
    setRotationAngle1((prevAngle) => prevAngle - 45);
    setRotationAngle2((prevAngle) => prevAngle - 45);
  };

  // Fonction pour réinitialiser la rotation à la position initiale (niveau 3)
  const resetRotation3 = () => {
    setRotationAngle3(initialAngle3);
  };

  // Fonction pour tourner d'un secteur (45°) dans le sens anti-horaire (niveau 3)
  // Fait aussi tourner les niveaux 1 et 2
  const rotateCounterClockwise3 = () => {
    setRotationAngle1((prevAngle) => prevAngle - 45);
    setRotationAngle2((prevAngle) => prevAngle - 45);
    setRotationAngle3((prevAngle) => prevAngle - 45);
  };

  // Fonction helper pour calculer la position d'un objet céleste
  // Les secteurs sont rendus avec un offset de -90° pour commencer à 12h
  const calculateObjectPosition = (disk: DiskName, sector: SectorNumber, rotationAngle: number = 0) => {
    const diskIndex = DISK_NAMES[disk];
    const sectorIndex = sectorToIndex[sector];
    const diskWidth = 8;
    const sunRadius = 4;
    const innerRadius = sunRadius + (diskIndex * diskWidth);
    const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
    const objectRadius = (innerRadius + outerRadius) / 2;
    // Utiliser le même calcul que pour le rendu des secteurs (avec -90° offset)
    const sectorStartAngle = -(360 / 8) * sectorIndex - 90;
    const sectorEndAngle = -(360 / 8) * (sectorIndex + 1) - 90;
    const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
    // Appliquer la rotation
    const rotatedAngle = sectorCenterAngle + rotationAngle;
    const { x, y } = polarToCartesian(0, 0, objectRadius, rotatedAngle);
    return { x, y, sectorCenterAngle, diskIndex };
  };

  // Fonction helper pour rendre un disque rotatif
  const renderRotationDisk = (obj: RotationDisk, zIndex: number = 30) => {
    // Le secteur est déjà relatif au plateau car on est dans un conteneur rotatif
    const relativeSector = indexToSector[obj.sectorIndex];
    // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL1_OBJECTS
    const sectorType = getSectorType(obj.level, obj.diskName, relativeSector);
    const sectorNumber = relativeSector; // Pour la clé et le debug
    
    // Utiliser l'index du secteur relatif pour calculer la position visuelle
    const relativeSectorIndex = obj.sectorIndex;
    
    const diskIndex = DISK_NAMES[obj.diskName];
    const diskWidth = 8;
    const sunRadius = 4;
    const innerRadius = sunRadius + (diskIndex * diskWidth);; // 4% (bord du soleil)
    const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 12%
    
    const sectorStartAngle = -(360 / 8) * relativeSectorIndex - 90; // 0° = midi (12h), sens horaire (de droite à gauche)
    const sectorEndAngle = -(360 / 8) * (relativeSectorIndex + 1) - 90;
    
    // Conversion en pixels pour le viewBox
    const innerRadiusPx = (innerRadius / 100) * 200;
    const outerRadiusPx = (outerRadius / 100) * 200;
    
    const innerStart = polarToCartesian(100, 100, innerRadiusPx, sectorStartAngle);
    const innerEnd = polarToCartesian(100, 100, innerRadiusPx, sectorEndAngle);
    const outerStart = polarToCartesian(100, 100, outerRadiusPx, sectorStartAngle);
    const outerEnd = polarToCartesian(100, 100, outerRadiusPx, sectorEndAngle);
    
    const largeArcFlag = Math.abs(sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;

    let colorFill: string = "";
    let colorStroke: string = "";
    let colorShadow: string = "";

    if (obj.level === 3) {
      colorFill="rgba(60, 80, 120, 1)"
      colorStroke="rgba(255, 215, 0, 0.8)"
      colorShadow="rgba(255, 215, 0, 0.5)"
    } else if (obj.level === 2) {
      colorFill="rgba(40, 60, 100, 1)"
      colorStroke="rgba(255, 107, 107, 0.8)"
      colorShadow="rgba(255, 107, 107, 0.5)"
    } else if (obj.level === 1) {
      colorFill="rgba(40, 60, 100, 1)"
      colorStroke="rgba(74, 158, 255, 0.8)"
      colorShadow="rgba(74, 158, 255, 0.5)"
    }

    // Ne pas afficher les secteurs hollow
    if (sectorType === 'hollow') return null;
    
    return (
      <svg
        key={`rotating-sector-c-${sectorNumber}`}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex,
          transformOrigin: 'center center', // Assurer que la rotation se fait autour du centre
        }}
        viewBox="0 0 200 200"
      >
        <path
          d={`M ${innerStart.x} ${innerStart.y} L ${outerStart.x} ${outerStart.y} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y} Z`}
          fill={colorFill} // Plus clair pour la surbrillance
          stroke={colorStroke}
          strokeWidth="1.5" // Bordure plus épaisse
          style={{ filter: `drop-shadow(0 0 2px ${colorShadow})`, pointerEvents: selectedProbeId ? 'none' : 'auto' }} // Effet de glow + bloque les événements
        />
      </svg>
    );
  };

  // Fonction helper pour rendre l'indicateur de rotation (signe >) adossé à la tuile
  const renderRotationIndicator = (planetId: string, color: string) => {
    let obj: CelestialObject | undefined;
    if (planetId === 'saturn') obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'saturn');
    else if (planetId === 'jupiter') obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'jupiter');
    else if (planetId === 'mars') obj = INITIAL_ROTATING_LEVEL2_OBJECTS.find(o => o.id === 'mars');
    else if (planetId === 'earth') obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(o => o.id === 'earth');

    if (!obj) return null;

    const { sectorCenterAngle, diskIndex } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    
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
        key={`indicator-${planetId}`}
        style={{
          position: 'absolute',
          left: `calc(50% + ${x}%)`,
          top: `calc(50% + ${y}%)`,
          transform: `translate(-50%, -50%) rotate(${indicatorAngle + 270}deg)`,
          color: color,
          fontSize: '40px',
          fontWeight: '900',
          zIndex: 60,
          pointerEvents: 'none',
          textShadow: `0 0 5px ${color}, 0 0 2px black`,
          lineHeight: 1,
          fontFamily: 'monospace'
        }}
      >
        &gt;
      </div>
    );
  };

  // Helper pour rendre le contenu du bonus dans le cercle (SVG)
  const renderBonusContent = (bonus: any) => {
    if (!bonus) return null;
    
    const hasPv = !!bonus.pv;
    const hasOther =
      bonus.media ||
      bonus.credits ||
      bonus.energy ||
      bonus.card ||
      bonus.data ||
      bonus.planetscan ||
      bonus.redscan ||
      bonus.yellowscan ||
      bonus.bluescan ||
      bonus.blackscan ||
      bonus.revenue ||
      bonus.anycard ||
      bonus.anytechnology ||
      bonus.yellowlifetrace ||
      bonus.redlifetrace ||
      bonus.bluelifetrace ||
      bonus.probe ||
      bonus.landing;
    
    return (
      <>
        {hasPv && (
          <text 
            y={hasOther ? "-5" : "1"} 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="#fff" 
            fontSize="10" 
            fontWeight="bold"
          >
            {bonus.pv}
          </text>
        )}
        {hasOther && (() => {
           let label = '';
           let color = '#fff';
           if (bonus.media) { label = 'M'; color = '#ff6b6b'; }
           else if (bonus.credits) { label = 'C'; color = '#ffd700'; }
           else if (bonus.energy) { label = 'E'; color = '#4caf50'; }
           else if (bonus.card) { label = '🃏'; color = '#aaffaa'; }
           else if (bonus.data) { label = 'D'; color = '#8affc0'; }
           else if (bonus.planetscan) { label = 'S'; color = '#fff'; }
           else if (bonus.redscan) { label = 'S'; color = '#fff'; }
           else if (bonus.yellowscan) { label = 'Y'; color = '#fff'; }
           else if (bonus.bluescan) { label = 'B'; color = '#fff'; }
           else if (bonus.blackscan) { label = 'B'; color = '#fff'; }
           else if (bonus.revenue) { label = 'R'; color = '#fff'; }
           else if (bonus.anycard) { label = '🃏'; color = '#fff'; }
           else if (bonus.anytechnology) { label = 'T'; color = '#fff'; }
           else if (bonus.yellowlifetrace) { label = 'Tr'; color = '#fff'; }
           else if (bonus.redlifetrace) { label = 'Tr'; color = '#fff'; }
           else if (bonus.bluelifetrace) { label = 'Tr'; color = '#fff'; }
           else if (bonus.probe) { label = 'Pr'; color = '#fff'; }
           else if (bonus.landing) { label = 'La'; color = '#fff'; }
           return (
             <text 
               y={hasPv ? "6" : "1"} 
               textAnchor="middle" 
               dominantBaseline="middle" 
               fill={color} 
               fontSize="10" 
               fontWeight="bold"
             >
               {label}
             </text>
           );
        })()}
      </>
    );
  };

  // Fonction helper pour rendre la planète (utilisé dans la hover card)
  const renderPlanetIcon = (id: string, size: number, planetData?: Planet) => {
    const styles: { [key: string]: any } = {
      'neptune': {
        background: 'radial-gradient(circle, #4166f5, #1e3a8a)',
        border: '2px solid #60a5fa',
        boxShadow: '0 0 8px rgba(65, 102, 245, 0.6)',
      },
      'uranus': {
        background: 'radial-gradient(circle, #4fd0e7, #1e88a8)',
        border: '2px solid #7dd3fc',
        boxShadow: '0 0 8px rgba(79, 208, 231, 0.6)',
      },
      'saturn': {
        background: 'radial-gradient(circle, #fad5a5, #d4a574)',
        border: '2px solid #e8c99a',
        boxShadow: '0 0 8px rgba(250, 213, 165, 0.6)',
        hasRings: true,
      },
      'jupiter': {
        background: 'radial-gradient(circle, #d8ca9d, #b89d6a)',
        border: '2px solid #c4b082',
        boxShadow: '0 0 8px rgba(216, 202, 157, 0.6)',
        hasBands: true,
      },
      'mars': {
        background: 'radial-gradient(circle, #cd5c5c, #8b3a3a)',
        border: '2px solid #dc7878',
        boxShadow: '0 0 8px rgba(205, 92, 92, 0.6)',
      },
      'earth': {
        background: 'radial-gradient(circle, #4a90e2, #2c5282)',
        border: '2px solid #63b3ed',
        boxShadow: '0 0 8px rgba(74, 144, 226, 0.6)',
        hasContinents: true,
      },
      'venus': {
        background: 'radial-gradient(circle, #ffd700, #b8860b)',
        border: '2px solid #ffed4e',
        boxShadow: '0 0 8px rgba(255, 215, 0, 0.6)',
      },
      'mercury': {
        background: 'radial-gradient(circle, #8c7853, #5a4a35)',
        border: '2px solid #a08d6b',
        boxShadow: '0 0 8px rgba(140, 120, 83, 0.6)',
      },
    };

    const style = styles[id] || {
      background: 'radial-gradient(circle, #888, #555)',
      border: '2px solid #aaa',
      boxShadow: '0 0 8px rgba(136, 136, 136, 0.6)',
    };

    const scale = size / 30;

    // Logique d'interaction (Orbite / Atterrissage)
    const currentPlayer = game.players[game.currentPlayerIndex];
    const isRobot = currentPlayer.type === 'robot';
    
    // Trouver l'objet céleste correspondant à l'ID de la planète pour vérifier la position
    const targetObj = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS].find(o => o.id === id);

    // Vérifier si le joueur a une sonde sur cette planète
    const playerProbe = targetObj && game.board.solarSystem.probes.find(p => 
        p.ownerId === currentPlayer.id && 
        p.state === ProbeState.IN_SOLAR_SYSTEM &&
        p.solarPosition?.disk === targetObj.position.disk &&
        p.solarPosition?.sector === targetObj.position.sector &&
        (p.solarPosition?.level || 0) === (targetObj.level || 0)
    );

    let canOrbit = false;
    let orbitReason = "Nécessite une sonde sur la planète";
    if (playerProbe) {
        if (hasPerformedMainAction || isRobot) {
            orbitReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
        } else {
            const check = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id);
            canOrbit = check.canOrbit;
            orbitReason = check.canOrbit ? "Cliquez pour mettre en orbite (Coût: 1 Crédit, 1 Énergie)" : (check.reason || "Impossible");
        }
    }

    let landEnergyCost;
    let canLand = false;
    let landReason = "Nécessite une sonde sur la planète";
    if (playerProbe) {
        if ((hasPerformedMainAction && !isLandingInteraction) || isRobot) {
            landReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
        } else {
            const check = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id, !isLandingInteraction);
            canLand = check.canLand;
            landEnergyCost = check.energyCost;
            landReason = check.canLand ? `Cliquez pour atterrir (Coût: ${check.energyCost} Énergie)` : (check.reason || "Impossible");
        }
    }

    const hasExploration4 = currentPlayer.technologies.some(t => t.id.startsWith('exploration-4'));

    const renderRings = (isFront: boolean) => (
      <>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(15deg)',
            width: `${size * 1.4}px`,
            height: `${size * 0.5}px`,
            borderRadius: '50%',
            border: '2px solid rgba(200, 180, 150, 0.8)',
            boxShadow: '0 0 4px rgba(200, 180, 150, 0.4)',
            clipPath: isFront ? 'inset(50% 0 0 0)' : undefined,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(15deg)',
            width: `${size * 1.25}px`,
            height: `${size * 0.4}px`,
            borderRadius: '50%',
            border: '1px solid rgba(180, 160, 130, 0.6)',
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
        const probe = satellite.landers && satellite.landers[0];
        const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
        
        const bonusText = (formatBonus(bonus) || []).join(', ') || 'Aucun';
        
        const isOccupied = !!player;
        let satReason = landReason;
        let isSatClickable = (!isOccupied || allowOccupiedLanding) && canLand && !!onLand;

        if (!hasExploration4 && !allowSatelliteLanding) {
            satReason = "Nécessite la technologie Exploration IV";
            isSatClickable = false;
        }

        const tooltipContent = isOccupied ? (
            <div>Atterrisseur de <span style={{fontWeight: 'bold', color: player?.color}}>{player?.name}</span> sur {satellite.name}</div>
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
            
        const satStyles: { [key: string]: string } = {
            'phobosdeimos': 'radial-gradient(circle at 30% 30%, #8b7355, #4a3c31)', // Brun rocheux sombre
            'io': 'radial-gradient(circle at 30% 30%, #fffacd, #ffd700, #ff8c00)', // Jaune soufre volcanique
            'europa': 'radial-gradient(circle at 30% 30%, #f0f8ff, #b0c4de)', // Blanc glace bleuté
            'ganymede': 'radial-gradient(circle at 30% 30%, #d3d3d3, #8b8b83)', // Gris/Brun cratérisé
            'callisto': 'radial-gradient(circle at 30% 30%, #696969, #2f4f4f)', // Gris sombre ancien
            'titan': 'radial-gradient(circle at 30% 30%, #f4a460, #cd853f)', // Orange atmosphère épaisse
            'enceladus': 'radial-gradient(circle at 30% 30%, #ffffff, #e0ffff)', // Blanc pur glace
            'titania': 'radial-gradient(circle at 30% 30%, #dcdcdc, #708090)', // Gris neutre
            'triton': 'radial-gradient(circle at 30% 30%, #ffe4e1, #bc8f8f)', // Rose pâle glace azote
        };

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
              background: satStyles[satellite.id] || 'radial-gradient(circle at 30% 30%, #d0d0d0, #808080)',
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
                       {renderBonusContent(bonus)}
                     </g>
                  )}
                </g>
             </svg>
          </div>
        );
      });
    };

    return (
      <div style={{ width: `${size}px`, height: `${size}px`, position: 'relative' }}>
        {style.hasRings && renderRings(false)}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${size - 4}px`,
            height: `${size - 4}px`,
            borderRadius: '50%',
            background: style.background,
            border: style.border,
            boxShadow: style.boxShadow,
            overflow: 'hidden',
            zIndex: 1,
          }}
        >
          {style.hasBands && (
            <>
              {[30, 45, 60, 75].map((top, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-20deg)',
                    width: '150%',
                    height: i % 2 === 0 ? `${3 * scale}px` : `${2 * scale}px`,
                    background: `rgba(${150 - i * 5}, ${120 - i * 5}, ${80 - i * 5}, ${0.8 - i * 0.1})`,
                    borderRadius: '2px',
                  }}
                />
              ))}
            </>
          )}
          {style.hasContinents && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                height: '50%',
                background: 'rgba(34, 139, 34, 0.7)',
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                clipPath: 'ellipse(60% 50% at 50% 50%)',
              }}
            />
          )}
        </div>
        {style.hasRings && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
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
              width: `${size * 3}px`,
              height: `${size * 3}px`,
              pointerEvents: 'none',
              overflow: 'visible',
              zIndex: 3,
            }}
            viewBox={`-${size * 1.5} -${size * 1.5} ${size * 3} ${size * 3}`}
          >
            {/* Définition des slots */}
            {(() => {
              const orbitSlots = planetData.orbitSlots || [];
              const landSlots = planetData.landSlots || [];
              
              const orbiterCircleRadius = 15;
              const orbitRadius = size / 2 + 25;
              const landerCircleRadius = 15;
              const landRadius = size * 0.3;
              
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
                    const bonusText = (formatBonus(bonus) || []).join(', ') || 'Aucun';
                    
                    const isOccupied = !!player;
                    const isNextAvailable = i === planetData.orbiters.length;
                    
                    let isClickable = false;
                    if (isRemovingOrbiter) {
                        isClickable = isOccupied && player?.id === currentPlayer.id && !!onOrbit;
                    } else {
                        isClickable = isNextAvailable && canOrbit && !!onOrbit;
                    }
                    
                    let statusText = "";
                    let statusColor = "";
                    let actionText = null;

                    if (isOccupied) {
                        statusText = `Occupé par ${player?.name}`;
                        statusColor = player?.color || "#ccc";
                        if (isClickable) {
                            statusText = "Cliquez pour retirer";
                            statusColor = "#ff6b6b";
                        }
                    } else if (isClickable) {
                        statusText = "Disponible";
                        statusColor = "#4a9eff";
                        actionText = "Cliquez pour mettre en orbite (Coût: 1 Crédit, 1 Énergie)";
                    } else {
                        statusText = "Indisponible";
                        statusColor = "#ff6b6b";
                        actionText = orbitReason;
                    }

                    const tooltipContent = (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: statusColor }}>
                                {statusText}
                            </div>
                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                Bonus : <span style={{ color: '#ffd700' }}>{bonusText}</span>
                            </div>
                            {actionText && <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>{actionText}</div>}
                        </div>
                    );
                    
                    const isFirst = i === 0;

                    return (
                      <g key={`orb-slot-${i}`} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: isClickable ? 'pointer' : 'help', pointerEvents: 'auto' }} 
                        onClick={(e) => {
                        if (isClickable && onOrbit && planetData) { e.stopPropagation(); onOrbit(planetData.id, i); }
                      }}
                        onMouseEnter={(e) => {
                          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); // Garde le tooltip principal ouvert
                          setSlotTooltip({ content: tooltipContent, rect: e.currentTarget.getBoundingClientRect() });
                        }}
                        onMouseLeave={() => setSlotTooltip(null)}
                      >
                        {isClickable && <circle r={orbiterCircleRadius + 6} fill="none" stroke="#00ff00" strokeWidth="3" opacity="0.6" />}
                        {isFirst ? (
                          <>
                            <circle r={orbiterCircleRadius} fill={player?.color || '#222'} stroke="#fff" strokeWidth="1.5" />
                            {!player && renderBonusContent(bonus)}
                          </>
                        ) : (
                          <circle r={4} fill={player?.color || `url(#corridor-grad-${planetData.id})`} />
                        )}
                      </g>
                    );
                  })}

                  {/* Slots Atterrisseurs */}
                  {landSlots.map((bonus, i) => {
                    const pos = landPositions[i];
                    const probe = planetData.landers[i];
                    const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;
                    const bonusText = (formatBonus(bonus) || []).join(', ') || 'Aucun';
                    
                    const isOccupied = !!player;
                    const isNextAvailable = i === planetData.landers.length;
                    const isClickable = (isNextAvailable || (allowOccupiedLanding && isOccupied)) && (canLand || isLandingInteraction) && !!onLand;

                    let statusText = "";
                    let statusColor = "";
                    let actionText = null;

                    if (isOccupied) {
                        statusText = `Occupé par ${player?.name}`;
                        statusColor = player?.color || "#ccc";
                        if (isClickable) {
                            statusText = "Cliquez pour retirer";
                            statusColor = "#ff6b6b";
                        }
                    } else if (isClickable) {
                        statusText = "Disponible";
                        statusColor = "#4a9eff";
                        actionText = `Cliquez pour atterrir (Coût: ${landEnergyCost} Énergie)`;
                    } else {
                        statusText = "Indisponible";
                        statusColor = "#ff6b6b";
                        actionText = landReason;
                    }

                    const tooltipContent = (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: statusColor }}>
                                {statusText}
                            </div>
                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                Bonus : <span style={{ color: '#ffd700' }}>{bonusText}</span>
                            </div>
                            {actionText && <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>{actionText}</div>}
                        </div>
                    );
                    
                    const isFullSlot = i === 0 || (planetData.id === 'mars' && i === 1);

                    return (
                      <g key={`land-slot-${i}`} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: isClickable ? 'pointer' : 'help', pointerEvents: 'auto' }} 
                        onClick={(e) => {
                        if (isClickable && onLand && planetData) { e.stopPropagation(); onLand(planetData.id, i); }
                      }}
                        onMouseEnter={(e) => {
                          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); // Garde le tooltip principal ouvert
                          setSlotTooltip({ content: tooltipContent, rect: e.currentTarget.getBoundingClientRect() });
                        }}
                        onMouseLeave={() => setSlotTooltip(null)}
                      >
                        {isClickable && <circle r={landerCircleRadius + 6} fill="none" stroke="#00ff00" strokeWidth="3" opacity="0.6" />}
                        {isFullSlot ? (
                          <>
                            <circle r={landerCircleRadius} fill={player?.color || 'rgba(0,0,0,0.6)'} stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
                            {!player && renderBonusContent(bonus)}
                          </>
                        ) : (
                          <circle r={4} fill={player?.color || `url(#land-corridor-grad-${planetData.id})`} />
                        )}
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

  // Helper pour formater les bonus
  const formatBonus = (bonus: Bonus) => {
    if (!bonus) return null;
    const items = [];
    if (bonus.pv) items.push(`${bonus.pv} PV`);
    if (bonus.media) items.push(`${bonus.media} Média`);
    if (bonus.credits) items.push(`${bonus.credits} Crédit`);
    if (bonus.energy) items.push(`${bonus.energy} Énergie`);
    if (bonus.card) items.push(`${bonus.card} Pioche`);
    if (bonus.data) items.push(`${bonus.data} Donnée`);
    if (bonus.planetscan) items.push(`${bonus.planetscan} Scan (Planète)`);
    if (bonus.redscan) items.push(`${bonus.redscan} Scan Rouge`);
    if (bonus.yellowscan) items.push(`${bonus.yellowscan} Scan Jaune`);
    if (bonus.bluescan) items.push(`${bonus.bluescan} Scan Bleu`);
    if (bonus.blackscan) items.push(`${bonus.blackscan} Scan Noir`);
    if (bonus.probescan) items.push(`${bonus.probescan} Scan Sonde`);
    if (bonus.earthscan) items.push(`${bonus.earthscan} Scan Terre`);
    if (bonus.rowscan) items.push(`${bonus.rowscan} Scan Rangée`);
    if (bonus.deckscan) items.push(`${bonus.deckscan} Scan Pioche`);
    if (bonus.anyscan) items.push(`${bonus.anyscan} Scan Quelconque`);
    if (bonus.revenue) items.push(`${bonus.revenue} Réservation`);
    if (bonus.anycard) items.push(`${bonus.anycard} Carte`);
    if (bonus.redlifetrace) items.push(`Trace Rouge`);
    if (bonus.yellowlifetrace) items.push(`Trace Jaune`);
    if (bonus.bluelifetrace) items.push(`Trace Bleu`);
    if (bonus.anytechnology) items.push(`${bonus.anytechnology} Tech`);
    if (bonus.probe) items.push(`${bonus.probe} Sonde`);
    if (bonus.landing) items.push(`${bonus.landing} Atterrisseur`);
    return items;
  };

  // Fonction helper pour rendre une planète
  const renderPlanet = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    const planetStyles: { [key: string]: any } = {
      'neptune': {
        background: 'radial-gradient(circle, #4166f5, #1e3a8a)',
        border: '2px solid #60a5fa',
        boxShadow: '0 0 8px rgba(65, 102, 245, 0.6)',
        size: 32,
      },
      'uranus': {
        background: 'radial-gradient(circle, #4fd0e7, #1e88a8)',
        border: '2px solid #7dd3fc',
        boxShadow: '0 0 8px rgba(79, 208, 231, 0.6)',
        size: 32,
      },
      'saturn': {
        background: 'radial-gradient(circle, #fad5a5, #d4a574)',
        border: '2px solid #e8c99a',
        boxShadow: '0 0 8px rgba(250, 213, 165, 0.6)',
        size: 28,
        hasRings: true,
      },
      'jupiter': {
        background: 'radial-gradient(circle, #d8ca9d, #b89d6a)',
        border: '2px solid #c4b082',
        boxShadow: '0 0 8px rgba(216, 202, 157, 0.6)',
        size: 36,
        hasBands: true,
      },
      'mars': {
        background: 'radial-gradient(circle, #cd5c5c, #8b3a3a)',
        border: '2px solid #dc7878',
        boxShadow: '0 0 8px rgba(205, 92, 92, 0.6)',
        size: 24,
      },
      'earth': {
        background: 'radial-gradient(circle, #4a90e2, #2c5282)',
        border: '2px solid #63b3ed',
        boxShadow: '0 0 8px rgba(74, 144, 226, 0.6)',
        size: 26,
        hasContinents: true,
      },
      'venus': {
        background: 'radial-gradient(circle, #ffd700, #b8860b)',
        border: '2px solid #ffed4e',
        boxShadow: '0 0 8px rgba(255, 215, 0, 0.6)',
        size: 24,
      },
      'mercury': {
        background: 'radial-gradient(circle, #8c7853, #5a4a35)',
        border: '2px solid #a08d6b',
        boxShadow: '0 0 8px rgba(140, 120, 83, 0.6)',
        size: 20,
      },
    };
    const style = planetStyles[obj.id] || {
      background: 'radial-gradient(circle, #888, #555)',
      border: '2px solid #aaa',
      boxShadow: '0 0 8px rgba(136, 136, 136, 0.6)',
      size: 24,
    };

    const planetData = game.board.planets.find(p => p.id === obj.id);
    const hasOrbiters = planetData && planetData.orbiters && planetData.orbiters.length > 0;

    const currentPlayer = game.players[game.currentPlayerIndex];
    const isRobot = (currentPlayer as any).type === 'robot';
    const playerProbe = game.board.solarSystem.probes.find(p => 
        p.ownerId === currentPlayer.id && 
        p.state === ProbeState.IN_SOLAR_SYSTEM &&
        p.solarPosition?.disk === obj.position.disk &&
        p.solarPosition?.sector === obj.position.sector &&
        (p.solarPosition?.level || 0) === (obj.level || 0)
    );

    let canInteract = false;
    if (!hasPerformedMainAction && !isRobot) {
        if (obj.id === 'earth') {
             canInteract = ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch;
        } else if (playerProbe) {
             const canOrbit = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id).canOrbit;
             const canLand = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id).canLand;
             canInteract = canOrbit || canLand;
        }
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
          position: 'absolute',
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          transform: 'translate(-50%, -50%)',
          width: `${style.size}px`,
          height: `${style.size}px`,
          zIndex,
          cursor: 'pointer',
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          let content: React.ReactNode;
          const planetData = game.board.planets.find(p => p.id === obj.id);

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
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', marginTop: '50px' }}>
                  {renderPlanetIcon(planetData.id, 220, planetData)}
                </div>
              </div>
            );
          } else {
            // Fallback for Earth or other objects without detailed data
            let subContent;
            const currentPlayer = game.players[game.currentPlayerIndex];
            const isRobot = (currentPlayer as any).type === 'robot';
            if (obj.id === 'earth') {
              const check = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
              let text = `Lancer une sonde (coût: ${GAME_CONSTANTS.PROBE_LAUNCH_COST} Crédits)`;
              let color = '#aaa';
              if (hasPerformedMainAction || isRobot) {
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

          setActiveTooltip({ 
            content, 
            rect: e.currentTarget.getBoundingClientRect(),
            ...(planetData && {
              onMouseEnter: () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); },
              onMouseLeave: handleMouseLeaveObject,
              pointerEvents: 'auto'
            })
          });
        }}
        onMouseLeave={handleMouseLeaveObject}
        onClick={() => onPlanetClick && onPlanetClick(obj.id)}
      >
        {hasOrbiters && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${style.size + 15}px`,
              height: `${style.size + 15}px`,
              borderRadius: '50%',
              border: '1px dashed rgba(255, 255, 255, 0.6)',
              pointerEvents: 'none',
            }}
          />
        )}
        {canInteract && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${style.size + 12}px`,
              height: `${style.size + 12}px`,
              borderRadius: '50%',
              border: '3px solid #4caf50',
              pointerEvents: 'none',
              boxShadow: '0 0 5px #4caf50',
              animation: 'pulse-green 2s infinite',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${style.size - 4}px`,
            height: `${style.size - 4}px`,
            borderRadius: '50%',
            background: style.background,
            border: style.border,
            boxShadow: style.boxShadow,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {style.hasBands && (
            <>
              {[30, 45, 60, 75].map((top, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-20deg)',
                    width: '150%',
                    height: i % 2 === 0 ? '3px' : '2px',
                    background: `rgba(${150 - i * 5}, ${120 - i * 5}, ${80 - i * 5}, ${0.8 - i * 0.1})`,
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
              ))}
            </>
          )}
          {style.hasContinents && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                height: '50%',
                background: 'rgba(34, 139, 34, 0.7)',
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                pointerEvents: 'none',
                clipPath: 'ellipse(60% 50% at 50% 50%)',
              }}
            />
          )}
        </div>
        {style.hasRings && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(15deg)',
                width: `${style.size + 12}px`,
                height: `${style.size / 2}px`,
                borderRadius: '50%',
                border: '2px solid rgba(200, 180, 150, 0.8)',
                boxShadow: '0 0 4px rgba(200, 180, 150, 0.4)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(15deg)',
                width: `${style.size + 8}px`,
                height: `${(style.size - 2) / 2}px`,
                borderRadius: '50%',
                border: '1px solid rgba(180, 160, 130, 0.6)',
                pointerEvents: 'none',
              }}
            />
          </>
        )}
      </div>
    );
  };

  // Fonction helper pour rendre une comète
  // La queue pointe dans le sens croissant (1 vers 8) et est tangente au cercle
  const renderComet = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y, sectorCenterAngle } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    // Direction tangentielle dans le sens horaire (croissant 1→8) : angle - 90°
    const tailAngle = sectorCenterAngle - 90;
    const tailLength = obj.position.disk === 'A' ? 30 : 50;
    const nucleusOffset = obj.position.disk === 'A' ? 15 : 25;

    return (
      <div
        key={obj.id}
        className="seti-celestial-object"
        style={{
          position: 'absolute',
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          transform: 'translate(-50%, -50%)',
          width: '20px',
          height: '20px',
          zIndex,
          cursor: 'help',
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          const subContent = <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa', fontStyle: 'italic' }}>Visiter pour gagner 1 Média</div>;
          const content = <div style={{ fontWeight: 'bold' }}>{obj.name}</div>;
          setActiveTooltip({
            content: <>{content}{subContent}</>,
            rect: e.currentTarget.getBoundingClientRect()
          });
        }}
        onMouseLeave={handleMouseLeaveObject}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
            width: `${tailLength}px`,
            height: '10px',
            background: 'linear-gradient(to left, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
            borderRadius: '2px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(${nucleusOffset}px)`,
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #e0e0e0, #888)',
            border: '1px solid #aaa',
            boxShadow: '0 0 6px rgba(255, 255, 255, 0.4)',
          }}
        />
      </div>
    );
  };

  // Rendu des détails des secteurs (Nom + Slots) sur le disque E
  const renderSectorDetails = () => {
    if (!game.board.sectors) return null;
    const currentPlayer = game.players[game.currentPlayerIndex];
    return (
      <svg
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 50, // Au-dessus de tout pour assurer le clic
          overflow: 'visible'
        }}
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
            [SectorColor.BLUE]: '#4a9eff',
            [SectorColor.RED]: '#ff6b6b',
            [SectorColor.YELLOW]: '#ffd700',
            [SectorColor.BLACK]: '#aaaaaa'
          };
          const color = colorMap[sector.color] || '#fff';

          const coveredByPlayers = (sector.coveredBy || []).map((pid: string) => game.players.find(p => p.id === pid)).filter(p => !!p);

          // Préparation du tooltip Secteur
          const mediaBonusText = "1 Média pour chaque joueur présent";
          const firstBonusStr = (formatBonus(sector.firstBonus) || []).join(', ') || 'Aucun';
          const nextBonusStr = (formatBonus(sector.nextBonus) || []).join(', ') || 'Aucun';
          
          let bonusDisplay;
          if (firstBonusStr === nextBonusStr) {
             bonusDisplay = <div style={{fontSize: '0.9em', color: '#ffd700'}}>Bonus de couverture : {firstBonusStr}</div>;
          } else {
             bonusDisplay = (
               <div style={{fontSize: '0.9em', color: '#ffd700'}}>
                 <div>1ère couverture : {firstBonusStr}</div>
                 <div>Suivantes : {nextBonusStr}</div>
               </div>
             );
          }

          let coverDisplay;
          if (coveredByPlayers.length > 0) {
            coverDisplay = (
              <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #555' }}>
                <div style={{ fontSize: '0.8em', color: '#aaa' }}>Couvert par :</div>
                {coveredByPlayers.map(p => (
                  <div key={p.id} style={{ color: p.color, fontWeight: 'bold', fontSize: '0.9em' }}>{p.name}</div>
                ))}
              </div>
            );
          } else {
            coverDisplay = <div style={{ fontSize: '0.8em', color: '#aaa' }}>Aucune couverture</div>;
          }

          const sectorTooltipContent = (
            <div style={{ textAlign: 'left' }}>
                <div style={{fontWeight: 'bold', borderBottom: '1px solid #ccc', marginBottom: '4px', color: color}}>{sector.name.toUpperCase()}</div>
                <div style={{fontSize: '0.9em', marginBottom: '4px'}}>Gains à la couverture :</div>
                <div style={{fontSize: '0.9em', color: '#ff6b6b'}}>• {mediaBonusText}</div>
                {bonusDisplay}
                {coverDisplay}
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
            const bonusGain = signal.bonus ? formatBonus(signal.bonus) : null;
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

            const cursorStyle = isSectorClickable ? 'pointer' : 'help';

            return (
              <g key={signal.id} transform={`translate(${pos.x}, ${pos.y})`} style={{ opacity, cursor: cursorStyle, pointerEvents: 'auto' }}
                onClick={(e) => {
                  if (isSectorClickable && onSectorClick) {
                    e.stopPropagation();
                    onSectorClick(i + 1);
                  }
                }}
                onMouseEnter={(e) => {
                  setActiveTooltip({ content: slotTooltipContent, rect: e.currentTarget.getBoundingClientRect() });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <circle r="4" fill="transparent" stroke="none" />
                {isFlashing && (
                  animateSectorSlots && canAffordScan ? (
                    <>
                      <circle r="3.5" fill="none" stroke="#4caf50" strokeWidth="1" opacity="0.8" />
                      <circle r="3.5" fill="none" stroke="#4caf50" strokeWidth="1">
                        <animate attributeName="r" values="3.5; 8" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6; 0" dur="2s" repeatCount="indefinite" />
                      </circle>
                    </>
                  ) : (
                    <circle r="4" fill="none" stroke="#00ff00" strokeWidth="1" opacity="0.6" />
                  )
                )}
                <circle r="2.5" fill={fillColor} stroke={strokeColor} strokeWidth="0.5" strokeDasharray={isLastSlot ? "1 1" : undefined} />
                {!player && signal.bonus && (
                  <g transform="scale(0.25)">
                    {renderBonusContent(signal.bonus)}
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

  // Fonction helper pour générer un nombre pseudo-aléatoire basé sur une seed
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Fonction helper pour rendre un nuage d'astéroïdes
  const renderAsteroid = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    const asteroidCount = obj.position.disk === 'A' ? 3 : 5;
    const spread = obj.position.disk === 'A' ? 8 : 12;
    // Utiliser l'ID comme seed pour avoir un pattern cohérent
    const seed = obj.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return (
      <div
        key={obj.id}
        style={{
          position: 'absolute',
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          transform: 'translate(-50%, -50%)',
          width: `${spread * 2}px`,
          height: `${spread * 2}px`,
          zIndex,
          cursor: 'help',
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          const currentPlayer = game.players[game.currentPlayerIndex];
          const hasTech = currentPlayer.technologies.some(t => t.id.startsWith('exploration-2'));
          const subContent = (
            <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa', fontStyle: 'italic' }}>
              {hasTech ? 'Visiter pour gagner 1 Média' : 'Quitter nécessite 1 déplacement supplémentaire'}
            </div>
          );
          const content = <div style={{ fontWeight: 'bold' }}>{obj.name}</div>;
          setActiveTooltip({ content: <>{content}{subContent}</>, rect: e.currentTarget.getBoundingClientRect() });
        }}
        onMouseLeave={handleMouseLeaveObject}
      >
        {Array.from({ length: asteroidCount }).map((_, i) => {
          const angle = (360 / asteroidCount) * i;
          const random1 = seededRandom(seed + i);
          const random2 = seededRandom(seed + i + 100);
          const distance = spread * (0.5 + random1 * 0.5);
          const { x: asteroidX, y: asteroidY } = polarToCartesian(0, 0, distance, angle);
          const size = 4 + random2 * 4;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${asteroidX}px), calc(-50% + ${asteroidY}px))`,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '20%',
                background: 'radial-gradient(circle, #888, #555)',
                border: '1px solid #666',
                boxShadow: '0 0 2px rgba(136, 136, 136, 0.5)',
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
    const offsetX = (seededRandom(seed) - 0.5) * 4; // +/- 2%
    const offsetY = (seededRandom(seed + 42) - 0.5) * 4; // +/- 2%

    const isOwner = probe.ownerId === game.players[game.currentPlayerIndex].id;
    const shouldHighlight = highlightPlayerProbes && isOwner;
    
    return (
      <div
        key={probe.id}
        onClick={(e) => {
          e.stopPropagation();
          handleProbeClick(probe);
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
        style={{
          position: 'absolute',
          top: `calc(50% + ${y + offsetY}%)`,
          left: `calc(50% + ${x + offsetX}%)`,
          transform: 'translate(-50%, -50%)',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
          zIndex,
          transition: 'all 0.2s ease',
          pointerEvents: 'auto',
        }}
        title={playerName}
      >
        {/* Effet de surbrillance (pour action gratuite mouvement) */}
        {shouldHighlight && (
           <div style={{
             position: 'absolute',
             top: '50%',
             left: '50%',
             transform: 'translate(-50%, -50%)',
             width: '40px',
             height: '40px',
             borderRadius: '50%',
             border: '2px solid #ffeb3b',
             backgroundColor: 'rgba(255, 235, 59, 0.3)',
             boxShadow: '0 0 10px #ffeb3b',
             zIndex: -2,
             pointerEvents: 'none',
           }} />
        )}

        {/* Ombre portée au sol */}
        <div style={{
          position: 'absolute',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '30%',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '50%',
          filter: 'blur(2px)',
          zIndex: -1,
        }} />

        {/* Structure de la sonde (Type Cassini/Voyager) */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          filter: isSelected ? 'drop-shadow(0 0 3px #00ff00)' : 'none',
        }}>
           {/* Antenne parabolique (Dish) - Partie supérieure */}
           <div style={{
             width: '22px',
             height: '8px',
             background: 'linear-gradient(to bottom, #e0e0e0, #999)',
             borderRadius: '50% 50% 0 0 / 100% 100% 0 0', // Demi-ellipse
             border: '1px solid #666',
             borderBottom: 'none',
             position: 'relative',
             zIndex: 3,
           }}>
             {/* Centre de l'antenne */}
             <div style={{
               position: 'absolute',
               bottom: '0',
               left: '50%',
               transform: 'translateX(-50%)',
               width: '6px',
               height: '3px',
               backgroundColor: '#444',
               borderRadius: '50% 50% 0 0',
             }} />
           </div>

           {/* Corps principal (Couleur du joueur) */}
           <div style={{
             width: '14px',
             height: '14px',
             backgroundColor: playerColor,
             border: '1px solid rgba(255,255,255,0.4)',
             borderRadius: '2px',
             position: 'relative',
             zIndex: 4,
             boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.5)',
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
           }}>
              {/* Détails dorés (isolation thermique) */}
              <div style={{
                width: '80%',
                height: '60%',
                backgroundColor: 'rgba(255, 215, 0, 0.3)', // Gold tint
                border: '1px solid rgba(255, 215, 0, 0.6)',
                borderRadius: '1px',
              }} />
           </div>

           {/* Bras / Instruments (Booms) */}
           {/* Bras gauche (RTG) */}
           <div style={{
             position: 'absolute',
             top: '60%',
             left: '-4px',
             width: '6px',
             height: '4px',
             backgroundColor: '#333',
             borderRadius: '2px',
             zIndex: 2,
           }} />
           {/* Bras droit (Magnétomètre) */}
           <div style={{
             position: 'absolute',
             top: '60%',
             right: '-8px',
             width: '10px',
             height: '1px',
             backgroundColor: '#888',
             zIndex: 2,
           }} />
           {/* Antenne inférieure */}
           <div style={{
             position: 'absolute',
             bottom: '-2px',
             left: '50%',
             transform: 'translateX(-50%)',
             width: '2px',
             height: '4px',
             backgroundColor: '#666',
             zIndex: 1,
           }} />
        </div>
      </div>
    );
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
        const absPos = calculateAbsolutePosition(tempObj, rotationState);

        const movementBonus = freeMovementCount;
        
        const hasAsteroidTech = currentPlayer.technologies.some(t => t.id.startsWith('exploration-2'));
        const hasAsteroidBuff = currentPlayer.activeBuffs.some(b => b.type === 'ASTEROID_EXIT_COST');
        const ignoreAsteroidPenalty = hasAsteroidTech || hasAsteroidBuff;

        const reachable = calculateReachableCellsWithEnergy(
          probe.solarPosition.disk,
          absPos.absoluteSector,
          movementBonus,
          currentPlayer.energy,
          rotationState,
          ignoreAsteroidPenalty
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

  // Obtenir toutes les sondes dans le système solaire
  const probesInSystem = useMemo(() => {
    return game.board.solarSystem.probes || [];
  }, [game.board.solarSystem.probes]);

  useImperativeHandle(ref, () => ({
    resetRotation1,
    rotateCounterClockwise1,
    resetRotation2,
    rotateCounterClockwise2,
    resetRotation3,
    rotateCounterClockwise3,
  }));

  return (
    <>
      <style>{`
        @keyframes pulse-green {
          0% {
            transform: translate(-50%, -50%) scale(0.95);
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
          }
          70% {
            transform: translate(-50%, -50%) scale(1);
            box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
          }
          100% {
            transform: translate(-50%, -50%) scale(0.95);
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
          }
        }
      `}</style>
      <div className="seti-panel seti-solar-system-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <div className="seti-panel-title">Système solaire</div>
        
        {/* Boutons pour toggle l'affichage des plateaux */}
        {/*<div style={{
          position: 'absolute',
          top: '10px',
          left: '180px', // Décalé à droite des boutons de rotation
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 1000,
        }}>
        <button
          onClick={() => setShowLevel1(!showLevel1)}
          style={{
            backgroundColor: showLevel1 ? '#4a9eff' : '#666',
            color: showLevel1 ? '#fff' : '#ccc',
            border: `2px solid ${showLevel1 ? '#6bb3ff' : '#888'}`,
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.transform = 'scale(1)';
          }}
          title={showLevel1 ? 'Masquer le plateau niveau 1' : 'Afficher le plateau niveau 1'}
        >
          Niveau 1 {showLevel1 ? '✓' : '✗'}
        </button>
        <button
          onClick={() => setShowLevel2(!showLevel2)}
          style={{
            backgroundColor: showLevel2 ? '#ff6b6b' : '#666',
            color: showLevel2 ? '#fff' : '#ccc',
            border: `2px solid ${showLevel2 ? '#ff8e8e' : '#888'}`,
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.transform = 'scale(1)';
          }}
          title={showLevel2 ? 'Masquer le plateau niveau 2' : 'Afficher le plateau niveau 2'}
        >
          Niveau 2 {showLevel2 ? '✓' : '✗'}
        </button>
        <button
          onClick={() => setShowLevel3(!showLevel3)}
          style={{
            backgroundColor: showLevel3 ? '#ffd700' : '#666',
            color: showLevel3 ? '#000' : '#fff',
            border: `2px solid ${showLevel3 ? '#ffed4e' : '#888'}`,
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.transform = 'scale(1)';
          }}
          title={showLevel3 ? 'Masquer le plateau niveau 3' : 'Afficher le plateau niveau 3'}
        >
          Niveau 3 {showLevel3 ? '✓' : '✗'}
        </button>
      </div>*/}
      
      {/* Conteneur pour positionner les éléments directement dans le panel */}
      <div 
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
        {/* Conteneur interne pour positionner les éléments */}
        <div style={{
          position: 'relative',
          width: boardSize ? `${boardSize}px` : '0px',
          height: boardSize ? `${boardSize}px` : '0px',
          opacity: boardSize ? 1 : 0,
          transition: 'opacity 0.2s',
          flexShrink: 0,
        }}>
          {/* Zone de clic arrière-plan pour annuler l'interaction (z-index 0, sous les planètes) */}
          <div 
            style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 0,
                cursor: 'default'
            }}
            onClick={() => { if (onBackgroundClick && !selectedProbeId) onBackgroundClick(); }}
          />

          {/* Soleil au centre */}
          <div className="seti-sun" style={{ top: '50%' }}></div>

          {/* Objets fixes (niveau 0) - basés sur FIXED_OBJECTS */}
          {FIXED_OBJECTS.map((obj) => {
            if (obj.type === 'planet') {
              return renderPlanet(obj, 10);
            } else if (obj.type === 'comet') {
              return renderComet(obj, 10);
            } else if (obj.type === 'asteroid') {
              return renderAsteroid(obj, 10);
            }
            return null;
          })}

          {/* Affichage des sondes fixes (disques D et E) */}
          {probesInSystem.filter(probe => {
              if (!probe.solarPosition) return false;
              const level = probe.solarPosition.level;
              return level === 0 || level === null; // Disques D et E (fixes)
            }).map((probe) => renderProbe(probe, 150)
          )}

          {/* Plateau rotatif niveau 3 avec 3 disques (A, B, C) - se superpose au plateau fixe */}
          {//showLevel3 && (
          <div
            className="seti-rotating-overlay seti-rotating-level-3"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotationAngle3}deg)`, // Rotation dynamique
              width: '100%', // Taille ajustée
              height: '100%',
              borderRadius: '50%',
              zIndex: 20, // Au-dessus du niveau 2 (30-38)
              overflow: 'hidden',
              aspectRatio: '1', // Force un cercle parfait
              pointerEvents: 'none',
              transition: 'transform 0.3s ease-in-out', // Transition fluide pour la rotation
              willChange: 'transform', // Optimisation pour la performance de la rotation
            }}
          >
            {/* Disque C (extérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              const obj: RotationDisk = 
                {
                  id: 'disk3C',
                  sectorIndex: sectorIndex,
                  diskName: 'C',
                  level: 3,
                }
              return renderRotationDisk(obj, 1);
            })}

            {/* Disque B (moyen) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              const obj: RotationDisk = 
              {
                id: 'disk3B',
                sectorIndex: sectorIndex,
                diskName: 'B',
                level: 3,
              }
              return renderRotationDisk(obj, 1);
            })}

            {/* Disque A (intérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              const obj: RotationDisk = 
              {
                id: 'disk3A',
                sectorIndex: sectorIndex,
                diskName: 'A',
                level: 3,
              }
              return renderRotationDisk(obj, 1);
            })}

            {/* Sondes sur les disques A, B, C (niveau 3) */}
            {probesInSystem
              .filter(probe => {
                if (!probe.solarPosition) return false;
                const level = probe.solarPosition.level;
                return level === 3;
              })
              .map((probe) => renderProbe(probe, 150))}

            {/* Objets célestes sur le plateau rotatif niveau 3 - basés sur INITIAL_ROTATING_LEVEL3_OBJECTS */}
            {INITIAL_ROTATING_LEVEL3_OBJECTS.filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
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
            {nextRingLevel === 3 && renderRotationIndicator('saturn', '#ffd700')}
          </div>
          //)}
          }

          {/* Plateau rotatif niveau 2 avec 2 disques (A, B) - se superpose au niveau 1 */}
          {//showLevel2 && (
          <div
            className="seti-rotating-overlay seti-rotating-level-2"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotationAngle2}deg)`,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              zIndex: 30, // Au-dessus du niveau 1 (20)
              overflow: 'hidden',
              aspectRatio: '1',
              pointerEvents: 'none',
              transition: 'transform 0.3s ease-in-out', // Transition fluide pour la rotation
              willChange: 'transform', // Optimisation pour la performance de la rotation
            }}
          >
            {/* Disque B (extérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              const obj: RotationDisk = 
              {
                id: 'disk2B',
                sectorIndex: sectorIndex,
                diskName: 'B',
                level: 2,
              }
              return renderRotationDisk(obj, 1);
            })}

            {/* Disque A (intérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              const obj: RotationDisk = 
              {
                id: 'disk2A',
                sectorIndex: sectorIndex,
                diskName: 'A',
                level: 2,
              }
              return renderRotationDisk(obj, 1);
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
            {INITIAL_ROTATING_LEVEL2_OBJECTS.filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
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
            {nextRingLevel === 2 && renderRotationIndicator('mars', '#ff6b6b')}
          </div>
          //)}
          }

          {/* Plateau rotatif niveau 1 avec 1 disque (A) - se superpose au niveau 2 */}
          {//showLevel1 && (
          <div
            className="seti-rotating-overlay seti-rotating-level-1"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotationAngle1}deg)`, // Rotation dynamique
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              zIndex: 40, // Au-dessus du niveau 2 (30)
              overflow: 'hidden',
              aspectRatio: '1', // Force un cercle parfait
              pointerEvents: 'none', // Ne pas intercepter les événements, sauf sur les objets célestes
              transition: 'transform 0.3s ease-in-out', // Transition fluide pour la rotation
              willChange: 'transform', // Optimisation pour la performance de la rotation
            }}
          >
            {/* Disque A (intérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              const obj: RotationDisk = 
              {
                id: 'disk1A',
                sectorIndex: sectorIndex,
                diskName: 'A',
                level: 1,
              }
              return renderRotationDisk(obj, 1);
            })}

            {/* Sondes sur le disque A (niveau 1) */}
            {probesInSystem.filter(probe => {
                if (!probe.solarPosition) return false;
                const level = probe.solarPosition.level;
                return level === 1;
              }).map((probe) => renderProbe(probe, 150)
            )}

            {/* Objets célestes sur le plateau rotatif niveau 1 - basés sur INITIAL_ROTATING_LEVEL1_OBJECTS */}
            {INITIAL_ROTATING_LEVEL1_OBJECTS.filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
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
            {nextRingLevel === 1 && renderRotationIndicator('earth', '#4a9eff')}
          </div>
          //)}
          }

          {/* Backdrop pour désélectionner si on clique à côté (quand une sonde est sélectionnée) */}
          {selectedProbeId && (
            <div 
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 1999, // Juste en dessous des reachable cells (2000+)
                cursor: 'default',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProbeId(null);
                setReachableCells(new Map());
                setHighlightedPath([]);
              }}
            />
          )}

          {/* Surbrillance des cases accessibles */}
          {selectedProbeId && Array.from(reachableCells.entries()).map(([cellKey, data]) => {
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
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: `${(outerRadius - innerRadius) * 0.8}%`,
                  height: `${(outerRadius - innerRadius) * 0.8}%`,
                  borderRadius: '50%',
                  border: isTarget ? '2px solid #ffeb3b' : (isPathStep ? '2px solid #ffeb3b' : '2px solid #00ff00'),
                  backgroundColor: isTarget ? 'rgba(255, 235, 59, 0.5)' : (isPathStep ? 'rgba(255, 235, 59, 0.3)' : 'rgba(0, 255, 0, 0.2)'),
                  pointerEvents: 'auto',
                  zIndex: isTarget ? 2002 : (isPathStep ? 2001 : 2000),
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
                title={`Accessible en ${data.movements} déplacement(s)`}
              >
                {isPathStep && (
                  <span style={{ 
                    color: '#fff', 
                    fontWeight: 'bold', 
                    textShadow: '0 0 3px #000',
                    pointerEvents: 'none',
                    fontSize: '1.2em'
                  }}>
                    {highlightedPath.indexOf(cellKey)}
                  </span>
                )}
              </div>
            );
          })}

          {/* Traits de délimitation des 8 secteurs radiaux - partent du centre du soleil */}
          {Array.from({ length: 8 }).map((_, sectorIndex) => {
            const sectorAngle = -(360 / 8) * sectorIndex - 90; // 0° = midi (12h), sens horaire, -90° pour CSS
            return (
              <div
                key={`sector-divider-${sectorIndex}`}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '1px',
                  height: '44%', // Jusqu'au bord du cercle E (44% de rayon)
                  transform: `translate(-50%, 0%) rotate(${sectorAngle}deg)`,
                  transformOrigin: 'center top',
                  backgroundColor: 'rgba(255, 255, 255, 0.4)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            );
          })}

          {/* Labels des secteurs (1-8) de droite à gauche (sens horaire) depuis midi (12h) */}
          {Array.from({ length: 8 }).map((_, sectorIndex) => {
            // Secteur 1 commence à 0° (midi/12h), puis sens horaire (de droite à gauche)
            // sectorIndex 0 → secteur 1 (0°), sectorIndex 1 → secteur 2 (-45°), etc.
            const sectorNumber = sectorIndex + 1;
            // Angle au centre du secteur (entre début et fin)
            // Secteur 1 : 0° à -45° (centre à -22.5° ou 337.5°)
            // Secteur 2 : -45° à -90° (centre à -67.5° ou 292.5°)
            // etc. (sens horaire)
            const sectorStartAngle = -(360 / 8) * sectorIndex; // 0°, -45°, -90°, etc. (sens horaire)
            const sectorEndAngle = -(360 / 8) * (sectorIndex + 1); // -45°, -90°, -135°, etc.
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2; // -22.5°, -67.5°, etc.
            const labelRadius = 47; // Position à 47% du centre (juste après le cercle E)
            // Convertir l'angle en radians pour le positionnement
            const { x, y } = polarToCartesian(0, 0, labelRadius, sectorCenterAngle - 90);
            
            return (
              <div
                key={`sector-label-${sectorIndex}`}
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: '0.75rem',
                  color: '#aaa',
                  fontWeight: 'bold',
                  pointerEvents: 'none',
                  zIndex: 40,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                {sectorNumber}
              </div>
            );
          })}

          {/* 5 cercles concentriques (A à E) - Anneaux avec même largeur */}
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
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: `${outerRadius * 2}%`,
                    height: `${outerRadius * 2}%`,
                    borderRadius: '50%',
                    border: `3px solid #78a0ff`,
                    backgroundColor: 'transparent',
                    pointerEvents: 'none',
                    zIndex: 2 + index,
                    boxSizing: 'border-box',
                  }}
                />
                {/* Cercle intérieur pour créer l'anneau (masquer l'intérieur) */}
                <div
                  className={`seti-solar-disk-inner disk-${disk}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: `${innerRadius * 2}%`,
                    height: `${innerRadius * 2}%`,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(10, 14, 26, 1)',
                    pointerEvents: 'none',
                    zIndex: 2 + index + 0.5,
                  }}
                />
                {/* Label du disque - positionné en haut à 12h */}
                <div
                  style={{
                    position: 'absolute',
                    top: `calc(50% - ${(innerRadius + outerRadius) / 2}%)`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '0.75rem',
                    color: '#78a0ff',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #78a0ff',
                    whiteSpace: 'nowrap',
                    zIndex: 40,
                    pointerEvents: 'none',
                  }}
                >
                  {disk}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Détails des secteurs sur le disque E (Noms + Slots) */}
        {renderSectorDetails()}

        {/* Tooltips persistants pour l'atterrissage (Dragonfly / Landing Interaction) */}
        {isLandingInteraction && (() => {
            const currentPlayer = game.players[game.currentPlayerIndex];
            // Trouver toutes les planètes où le joueur a une sonde
            const planetsWithProbes = new Set<string>();
            const allObjects = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS];
            
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
                const planetData = game.board.planets.find(p => p.id === planetId);
                if (!planetData) return null;

                const content = (
                    <div style={{ minWidth: '350px' }}>
                      <div style={{ borderBottom: '1px solid #444', paddingBottom: '8px', marginBottom: '12px', textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#78a0ff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                          {planetData.name}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', marginTop: '50px' }}>
                        {renderPlanetIcon(planetData.id, 220, planetData)}
                      </div>
                    </div>
                );
                return <Tooltip key={`landing-tooltip-${planetId}`} content={content} targetRect={rect} pointerEvents="auto" />;
            });
        })()}
      </div>
      </div>
      
      {/* Tooltip pour les slots, rendu par-dessus le tooltip principal */}
      {slotTooltip && <Tooltip 
        content={slotTooltip.content} 
        targetRect={slotTooltip.rect}
        pointerEvents="auto"
        onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
        onMouseLeave={handleMouseLeaveObject}
        disableCollision={true}
      />}
    </>
  );
});

SolarSystemBoardUI.displayName = 'SolarSystemBoardUI';
