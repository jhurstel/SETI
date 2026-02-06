import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Game, Probe, DiskName, SectorNumber, DISK_NAMES, RotationDisk, Planet, ProbeState, Bonus, GAME_CONSTANTS, SectorType, SignalType, InteractionState } from '../core/types';
import { createRotationState, calculateReachableCellsWithEnergy, calculateAbsolutePosition, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, CelestialObject, getObjectPosition, getAbsoluteSectorForProbe, polarToCartesian, describeArc, sectorToIndex, indexToSector, calculateObjectPosition, getSectorType } from '../core/SolarSystemPosition';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { Tooltip } from './Tooltip';
import './SolarSystemBoardUI.css'

interface SolarSystemBoardUIProps {
  game: Game;
  interactionState: InteractionState;
  onProbeMove: (probeId: string, path: string[]) => void;
  onPlanetClick: (planetId: string) => void;
  onOrbit: (planetId: string, slotIndex?: number) => void;
  onLand: (planetId: string, slotIndex?: number) => void;
  onBackgroundClick: () => void;
  onSectorClick: (sectorNumber: number) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null) => void;
}

const PLANET_STYLES: { [key: string]: any } = {
  'neptune': {
    background: 'radial-gradient(circle, #4166f5, #1e3a8a)',
    border: '2px solid #60a5fa',
    boxShadow: '0 0 3px rgba(65, 102, 245, 0.8)',
  },
  'uranus': {
    background: 'radial-gradient(circle, #4fd0e7, #1e88a8)',
    border: '2px solid #7dd3fc',
    boxShadow: '0 0 3px rgba(79, 208, 231, 0.8)',
  },
  'saturn': {
    background: 'radial-gradient(circle, #fad5a5, #d4a574)',
    border: '2px solid #e8c99a',
    boxShadow: '0 0 3px rgba(250, 213, 165, 0.8)',
    hasRings: true,
  },
  'jupiter': {
    background: 'radial-gradient(circle, #d8ca9d, #b89d6a)',
    border: '2px solid #c4b082',
    boxShadow: '0 0 3px rgba(216, 202, 157, 0.8)',
    hasBands: true,
  },
  'mars': {
    background: 'radial-gradient(circle, #cd5c5c, #8b3a3a)',
    border: '2px solid #dc7878',
    boxShadow: '0 0 3px rgba(205, 92, 92, 0.8)',
  },
  'earth': {
    background: 'radial-gradient(circle, #4a90e2, #2c5282)',
    border: '2px solid #63b3ed',
    boxShadow: '0 0 3px rgba(74, 144, 226, 0.8)',
    hasContinents: true,
  },
  'venus': {
    background: 'radial-gradient(circle, #ffd700, #b8860b)',
    border: '2px solid #ffed4e',
    boxShadow: '0 0 3px rgba(255, 215, 0, 0.8)',
  },
  'mercury': {
    background: 'radial-gradient(circle, #8c7853, #5a4a35)',
    border: '2px solid #a08d6b',
    boxShadow: '0 0 3px rgba(140, 120, 83, 0.8)',
  },
};

const PLANET_SIZES: { [key: string]: number } = {
  'neptune': 32,
  'uranus': 32,
  'saturn': 28,
  'jupiter': 36,
  'mars': 24,
  'earth': 26,
  'venus': 24,
  'mercury': 20,
};

const SATELLITE_STYLES: { [key: string]: string } = {
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

export const SolarSystemBoardUI: React.FC<SolarSystemBoardUIProps> = ({ game, interactionState, onProbeMove, onPlanetClick, onOrbit, onLand, onBackgroundClick, onSectorClick, setActiveTooltip }) => {

  // État pour gérer la sonde sélectionnée et les cases accessibles
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [reachableCells, setReachableCells] = useState<Map<string, { movements: number; path: string[] }>>(new Map());
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const planetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // État pour le tooltip des slots (orbite/atterrissage) pour qu'il s'affiche par-dessus celui de la planète
  const [slotTooltip, setSlotTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);

  // Calcul des secteurs à mettre en surbrillance (flash vert)
  const getHighlightedSectors = () => {
    const currentPlayer = game.players[game.currentPlayerIndex];

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
      if (interactionState.color === SectorType.ANY) {
        return game.board.sectors.map(s => s.id);
      }
      return game.board.sectors.filter(s => s.color === interactionState.color).map(s => s.id);
    }
    if (interactionState.type === 'IDLE' && !currentPlayer.hasPerformedMainAction) {
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

    switch (obj.type) {
      case 'planet': {
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
      default:
        content = <div style={{ fontWeight: 'bold' }}>{obj.name}</div>;
        break;
    }

    setActiveTooltip({
      content,
      rect: e.currentTarget.getBoundingClientRect(),
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

    // Ne pas afficher les secteurs hollow
    if (sectorType === 'hollow') return null;

    const levelClass = `level-${obj.level}`;

    return (
      <svg
        key={`rotating-sector-${obj.diskName}-${sectorNumber}`}
        className={`seti-rotating-sector-svg ${levelClass}`}
        style={{ zIndex }}
        viewBox="0 0 200 200"
      >
        <path
          d={`M ${innerStart.x} ${innerStart.y} L ${outerStart.x} ${outerStart.y} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y} Z`}
          style={{ pointerEvents: selectedProbeId ? 'none' : 'auto' }}
        />
      </svg>
    );
  };

  // Fonction helper pour rendre l'indicateur de rotation (signe >) adossé à la tuile
  const renderRotationIndicator = (planetId: string, level: number, sectorOffset: number = 0, keySuffix: string = '') => {
    let obj: CelestialObject | undefined;
    if (planetId === 'saturn') { obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(o => o.id === 'saturn');
    } else if (planetId === 'jupiter') { obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(o => o.id === 'jupiter');
    } else if (planetId === 'mars') { obj = INITIAL_ROTATING_LEVEL2_OBJECTS.find(o => o.id === 'mars');
    } else if (planetId === 'earth') { obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'earth');
    } else if (planetId === 'mercury') { obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'mercury');
    }

    if (!obj) return null;

    const originalSector = obj.position.sector;
    const newSector = ( ( (originalSector - 1) + sectorOffset) % 8 ) + 1 as SectorNumber;

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

  // Helper pour rendre le contenu du bonus dans le cercle (SVG)
  const renderBonusContent = (bonus: Bonus) => {
    if (!bonus) return null;

    const hasPv = !!bonus.pv;
    const hasOther =
      bonus.media ||
      bonus.credits ||
      bonus.energy ||
      bonus.card ||
      bonus.data ||
      bonus.signals ||
      bonus.revenue ||
      bonus.anycard ||
      bonus.technologies ||
      bonus.lifetraces ||
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
          else if (bonus.signals && bonus.signals.length > 0) { label = 'S'; color = '#fff'; }
          else if (bonus.revenue) { label = 'R'; color = '#fff'; }
          else if (bonus.anycard) { label = '🃏'; color = '#fff'; }
          else if (bonus.technologies && bonus.technologies.length > 0) { label = 'T'; color = '#fff'; }
          else if (bonus.lifetraces && bonus.lifetraces.length > 0) { label = 'Tr'; color = '#fff'; }
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
    const style = PLANET_STYLES[id] || {
      background: 'radial-gradient(circle, #888, #555)',
      border: '2px solid #aaa',
      boxShadow: '0 0 3px rgba(136, 136, 136, 0.8)',
    };

    const scale = size / 30;

    // Logique d'interaction (Orbite / Atterrissage)
    const currentPlayer = game.players[game.currentPlayerIndex];
    const isRobot = currentPlayer.type === 'robot';

    // Trouver l'objet céleste correspondant à l'ID de la planète pour vérifier la position
    const targetObj = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS].find(o => o.id === id);

    // Vérifier si le joueur a une sonde sur cette planète
    const playerProbe = targetObj && game.board.solarSystem.probes.find(p =>
      p.ownerId === currentPlayer.id &&
      p.state === ProbeState.IN_SOLAR_SYSTEM &&
      p.solarPosition.disk === targetObj.position.disk &&
      p.solarPosition.sector === targetObj.position.sector &&
      p.solarPosition.level === targetObj.level
    );

    let canOrbit = false;
    let orbitReason = "Nécessite une sonde sur la planète";
    if (playerProbe) {
      if (currentPlayer.hasPerformedMainAction || isRobot) {
        orbitReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
      } else {
        const check = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id);
        canOrbit = check.canOrbit;
        orbitReason = check.canOrbit ? "Cliquez pour mettre en orbite (Coût: 1 Crédit, 1 Énergie)" : (check.reason || "Impossible");
      }
    }

    let landEnergyCost: number | undefined;
    let canLand = false;
    let landReason = "Nécessite une sonde sur la planète";
    if (playerProbe) {
      if ((currentPlayer.hasPerformedMainAction && !(interactionState.type === 'LANDING_PROBE')) || isRobot) {
        landReason = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
      } else {
        const check = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id, !(interactionState.type === 'LANDING_PROBE'));
        canLand = check.canLand;
        landEnergyCost = check.energyCost;
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
        const probe = satellite.landers && satellite.landers[0];
        const player = probe ? game.players.find(p => p.id === probe.ownerId) : null;

        const bonusText = (ResourceSystem.formatBonus(bonus) || []).join(', ') || 'Aucun';

        const isOccupied = !!player;
        const allowOccupiedLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '16';
        let satReason = landReason;
        let isSatClickable = (!isOccupied || allowOccupiedLanding) && canLand && !!onLand;

        const allowSatelliteLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '12';
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
          className="seti-planet-icon-body"
          style={{
            width: `${size - 4}px`,
            height: `${size - 4}px`,
            background: style.background,
            border: style.border,
            boxShadow: style.boxShadow,
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
                    const bonusText = (ResourceSystem.formatBonus(bonus) || []).join(', ') || 'Aucun';

                    const isOccupied = !!player;
                    const isNextAvailable = i === planetData.orbiters.length;

                    let isClickable = false;
                    if (interactionState.type === 'REMOVING_ORBITER') {
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
                    const bonusText = (ResourceSystem.formatBonus(bonus) || []).join(', ') || 'Aucun';

                    const isOccupied = !!player;
                    const isNextAvailable = i === planetData.landers.length;
                    const allowOccupiedLanding = interactionState.type === 'LANDING_PROBE' && interactionState.source === '16';
                    const isClickable = (isNextAvailable || (allowOccupiedLanding && isOccupied)) && (canLand || interactionState.type === 'LANDING_PROBE') && !!onLand;

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

  // Fonction helper pour rendre une planète
  const renderPlanet = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    const style = PLANET_STYLES[obj.id] || {
      background: 'radial-gradient(circle, #888, #555)',
      border: '2px solid #aaa',
      boxShadow: '0 0 3px rgba(136, 136, 136, 0.8)',
    };
    const size = PLANET_SIZES[obj.id] || 24;

    // Check if planet has orbiters on it (dashed circle)
    const planetData = game.board.planets.find(p => p.id === obj.id);
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
    if (!currentPlayer.hasPerformedMainAction && !isRobot) {
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
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: `${size}px`,
          height: `${size}px`,
          zIndex,
          pointerEvents: selectedProbeId ? 'none' : 'auto',
          filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.4))',
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
            <div className="seti-planet-continents"/>
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
      </div>
    );
  };

  // Fonction helper pour rendre une comète
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

  // Fonction help pour rendre les secteurs
  const renderSectorDetails = () => {
    if (!game.board.sectors) return null;
    const currentPlayer = game.players[game.currentPlayerIndex];
    const highlightedSectorSlots = getHighlightedSectors();

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
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #ccc', marginBottom: '4px', color: color }}>{sector.name.toUpperCase()}</div>
              <div style={{ fontSize: '0.9em', marginBottom: '4px' }}>Gains à la couverture :</div>
              <div style={{ fontSize: '0.9em', color: '#ff6b6b' }}>• {mediaBonusText}</div>
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
          title={`Accessible en ${data.movements} déplacement(s)`}
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

                // Calculs pour le label
                const sectorNumber = sectorIndex + 1;
                const sectorStartAngle = -(360 / 8) * sectorIndex;
                const sectorEndAngle = -(360 / 8) * (sectorIndex + 1);
                const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
                const labelRadius = 47;
                const { x, y } = polarToCartesian(0, 0, labelRadius, sectorCenterAngle - 90);

                return (
                  <React.Fragment key={`sector-group-${sectorIndex}`}>
                    {/* Trait de séparation */}
                    <div
                      className="seti-sector-separator"
                      style={{
                        transform: `translate(-50%, 0%) rotate(${sectorAngle}deg)`,
                      }}
                    />
                    {/* Label */}
                    <div
                      className="seti-sector-label"
                      style={{
                        top: `calc(50% + ${y}%)`,
                        left: `calc(50% + ${x}%)`,
                      }}
                    >
                      {sectorNumber}
                    </div>
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
                  id: 'disk1C',
                  sectorIndex: sectorIndex,
                  diskName: 'C',
                  level: 1,
                }
                return renderRotationDisk(obj, 1);
              })}

              {/* Disque B (moyen) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: 'disk1B',
                  sectorIndex: sectorIndex,
                  diskName: 'B',
                  level: 1,
                }
                return renderRotationDisk(obj, 1);
              })}

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

              {/* Sondes sur les disques A, B, C (niveau 1) */}
              {probesInSystem
                .filter(probe => {
                  if (!probe.solarPosition) return false;
                  const level = probe.solarPosition.level;
                  return level === 1;
                })
                .map((probe) => renderProbe(probe, 150))}

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
                  id: 'disk3A',
                  sectorIndex: sectorIndex,
                  diskName: 'A',
                  level: 3,
                }
                return renderRotationDisk(obj, 1);
              })}

              {/* Sondes sur le disque A (niveau 3) */}
              {probesInSystem.filter(probe => {
                if (!probe.solarPosition) return false;
                const level = probe.solarPosition.level;
                return level === 3;
              }).map((probe) => renderProbe(probe, 150)
              )}

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

              {/* Indicateur de rotation pour Terre */}
              {game.board.solarSystem.nextRingLevel === 3 && renderRotationIndicator('earth', 3)}
              {game.board.solarSystem.nextRingLevel === 3 && renderRotationIndicator('mercury', 3)}
            </div>

            {/* Labels des disques (A à D) - Positionnés au-dessus des plateaux rotatifs */}
            {Object.keys(DISK_NAMES).map((disk, index) => {
              if (disk === 'E') return null;
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (index * diskWidth);
              const outerRadius = sunRadius + ((index + 1) * diskWidth);

              return (
                <div
                  key={`label-${disk}`}
                  className="seti-disk-label"
                  style={{
                    top: `calc(50% - ${(innerRadius + outerRadius) / 2}%)`,
                    zIndex: 60,
                  }}
                >
                  {disk}
                </div>
              );
            })}

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
          {renderSectorDetails()}

          {/* Tooltips persistants pour l'atterrissage (Dragonfly / Landing Interaction) */}
          {interactionState.type === 'LANDING_PROBE' && (() => {
            const currentPlayer = game.players[game.currentPlayerIndex];
            // Trouver toutes les planètes où le joueur a une sonde
            const planetsWithProbes = new Set<string>();
            const allObjects = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS];

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
};

SolarSystemBoardUI.displayName = 'SolarSystemBoardUI';
