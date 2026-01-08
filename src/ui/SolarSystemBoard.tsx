import React, { useState, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react';
import { Game, Probe, DiskName, SectorNumber, DISK_NAMES, RotationDisk, GAME_CONSTANTS } from '../core/types';
import { 
  createRotationState, 
  calculateReachableCellsWithEnergy,
  getObjectPosition,
  calculateAbsolutePosition,
  FIXED_OBJECTS,
  INITIAL_ROTATING_LEVEL1_OBJECTS,
  INITIAL_ROTATING_LEVEL2_OBJECTS,
  INITIAL_ROTATING_LEVEL3_OBJECTS,
  CelestialObject
} from '../core/SolarSystemPosition';

interface SolarSystemBoardProps {
  game: Game;
  onProbeMove?: (probeId: string, targetDisk: DiskName, targetSector: SectorNumber, cost: number, path: string[]) => void;
  onPlanetClick?: (planetId: string) => void;
  initialSector1?: number; // Secteur initial (1-8) pour positionner le plateau niveau 1
  initialSector2?: number; // Secteur initial (1-8) pour positionner le plateau niveau 2
  initialSector3?: number; // Secteur initial (1-8) pour positionner le plateau niveau 3
  highlightPlayerProbes?: boolean; // Mettre en surbrillance les sondes du joueur courant
}

export interface SolarSystemBoardRef {
  resetRotation1: () => void;
  rotateCounterClockwise1: () => void;
  resetRotation2: () => void;
  rotateCounterClockwise2: () => void;
  resetRotation3: () => void;
  rotateCounterClockwise3: () => void;
}

export const SolarSystemBoard = forwardRef<SolarSystemBoardRef, SolarSystemBoardProps>(({ game, onProbeMove, onPlanetClick, initialSector1 = 1, initialSector2 = 1, initialSector3 = 1, highlightPlayerProbes = false }, ref) => {
  // État pour gérer l'affichage des tooltips au survol
  const [hoveredObject, setHoveredObject] = useState<CelestialObject | null>(null);
  const [hoveredProbe, setHoveredProbe] = useState<string | null>(null);
  
  // État pour gérer la sonde sélectionnée et les cases accessibles
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [reachableCells, setReachableCells] = useState<Map<string, { movements: number; path: string[] }>>(new Map());
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);

  // État pour gérer la position de la case survolée
  const [hoveredCell, setHoveredCell] = useState<{ disk: DiskName; sector: SectorNumber } | null>(null);

  // État pour contrôler la visibilité des plateaux rotatifs
  const [showLevel1, setShowLevel1] = useState<boolean>(true);
  const [showLevel2, setShowLevel2] = useState<boolean>(true);
  const [showLevel3, setShowLevel3] = useState<boolean>(true);


  // Calculer l'angle initial basé sur le secteur (1-8)
  // Secteurs numérotés de droite à gauche (sens horaire) en partant de 12h : 1, 2, 3, 4, 5, 6, 7, 8
  // Secteur 1 = 0° (12h), secteur 2 = -45° (sens horaire), secteur 3 = -90°, etc.
  const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
  const indexToSector: { [key: number]: SectorNumber } = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 };

  // Fonction helper pour convertir un secteur absolu en secteur relatif au plateau
  // en appliquant la rotation inverse
  const absoluteToRelativeSector = (absoluteSector: SectorNumber, rotationAngle: number): SectorNumber => {
    const absoluteIndex = sectorToIndex[absoluteSector];
    const sectorsRotated = Math.round(rotationAngle / 45);
    const relativeIndex = (absoluteIndex - sectorsRotated + 8) % 8;
    return indexToSector[relativeIndex];
  };

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
  
  // Calcul pour le niveau 1
  const sectorIndex1 = sectorToIndex[initialSector1] || 0;
  const initialAngle1 = sectorIndex1 * 45; // Chaque secteur = 45°
  
  // Calcul pour le niveau 2
  const sectorIndex2 = sectorToIndex[initialSector2] || 0;
  const initialAngle2 = sectorIndex2 * 45;

  // Calcul pour le niveau 3
  const sectorIndex3 = sectorToIndex[initialSector3] || 0;
  const initialAngle3 = sectorIndex3 * 45;

  // Utiliser les angles de rotation depuis le jeu, ou les angles initiaux si non définis
  // Utiliser useMemo pour éviter les recalculs inutiles
  const gameAngle1 = useMemo(() => game.board.solarSystem.rotationAngleLevel1 ?? initialAngle1, [game.board.solarSystem.rotationAngleLevel1, initialAngle1]);
  const gameAngle2 = useMemo(() => game.board.solarSystem.rotationAngleLevel2 ?? initialAngle2, [game.board.solarSystem.rotationAngleLevel2, initialAngle2]);
  const gameAngle3 = useMemo(() => game.board.solarSystem.rotationAngleLevel3 ?? initialAngle3, [game.board.solarSystem.rotationAngleLevel3, initialAngle3]);
  
  // État pour gérer l'angle de rotation du plateau niveau 1
  // Initialiser avec la valeur du jeu, mais ne pas se synchroniser automatiquement
  const [rotationAngle1, setRotationAngle1] = useState<number>(() => gameAngle1);
  
  // État pour gérer l'angle de rotation du plateau niveau 2
  const [rotationAngle2, setRotationAngle2] = useState<number>(() => gameAngle2);
  
  // État pour gérer l'angle de rotation du plateau niveau 3
  const [rotationAngle3, setRotationAngle3] = useState<number>(() => gameAngle3);

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
  // Fait aussi tourner les niveaux 2 et 3
  const rotateCounterClockwise1 = () => {
    setRotationAngle1((prevAngle) => prevAngle - 45);
    setRotationAngle2((prevAngle) => prevAngle - 45); // Niveau 2 tourne aussi
    setRotationAngle3((prevAngle) => prevAngle - 45); // Niveau 3 tourne aussi
  };

  // Fonction pour réinitialiser la rotation à la position initiale (niveau 2)
  const resetRotation2 = () => {
    setRotationAngle2(initialAngle2);
  };

  // Fonction pour tourner d'un secteur (45°) dans le sens anti-horaire (niveau 2)
  // Fait aussi tourner le niveau 3
  const rotateCounterClockwise2 = () => {
    setRotationAngle2((prevAngle) => prevAngle - 45);
    setRotationAngle3((prevAngle) => prevAngle - 45); // Niveau 3 tourne aussi
  };

  // Fonction pour réinitialiser la rotation à la position initiale (niveau 3)
  const resetRotation3 = () => {
    setRotationAngle3(initialAngle3);
  };

  // Fonction pour tourner d'un secteur (45°) dans le sens anti-horaire (niveau 3)
  const rotateCounterClockwise3 = () => {
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
    const radian = rotatedAngle * (Math.PI / 180);
    const x = Math.cos(radian) * objectRadius;
    const y = Math.sin(radian) * objectRadius;
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
    
    const innerStartX = 100 + Math.cos(sectorStartAngle * Math.PI / 180) * innerRadiusPx;
    const innerStartY = 100 + Math.sin(sectorStartAngle * Math.PI / 180) * innerRadiusPx;
    const innerEndX = 100 + Math.cos(sectorEndAngle * Math.PI / 180) * innerRadiusPx;
    const innerEndY = 100 + Math.sin(sectorEndAngle * Math.PI / 180) * innerRadiusPx;
    const outerStartX = 100 + Math.cos(sectorStartAngle * Math.PI / 180) * outerRadiusPx;
    const outerStartY = 100 + Math.sin(sectorStartAngle * Math.PI / 180) * outerRadiusPx;
    const outerEndX = 100 + Math.cos(sectorEndAngle * Math.PI / 180) * outerRadiusPx;
    const outerEndY = 100 + Math.sin(sectorEndAngle * Math.PI / 180) * outerRadiusPx;
    
    const largeArcFlag = Math.abs(sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;

    let colorFill: string = "";
    let colorStroke: string = "";
    let colorShadow: string = "";

    if (obj.level === 1) {
      colorFill="rgba(60, 80, 120, 1)"
      colorStroke="rgba(255, 215, 0, 0.8)"
      colorShadow="rgba(255, 215, 0, 0.5)"
    } else if (obj.level === 2) {
      colorFill="rgba(40, 60, 100, 1)"
      colorStroke="rgba(255, 107, 107, 0.8)"
      colorShadow="rgba(255, 107, 107, 0.5)"
    } else if (obj.level === 3) {
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
          d={`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStartX} ${innerStartY} Z`}
          fill={colorFill} // Plus clair pour la surbrillance
          stroke={colorStroke}
          strokeWidth="1.5" // Bordure plus épaisse
          style={{ filter: `drop-shadow(0 0 2px ${colorShadow})`, pointerEvents: 'auto' }} // Effet de glow + bloque les événements
        />
      </svg>
    );
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

    return (
      <div
        key={obj.id}
        className="seti-planet"
        style={{
          position: 'absolute',
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          transform: 'translate(-50%, -50%)',
          width: `${style.size}px`,
          height: `${style.size}px`,
          zIndex,
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
        title={obj.name}
        onMouseEnter={() => setHoveredObject(obj)}
        onMouseLeave={() => setHoveredObject(null)}
        onClick={() => onPlanetClick && onPlanetClick(obj.id)}
      >
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
          }}
        />
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
        {style.hasBands && (
          <>
            {[30, 45, 60, 75].map((top, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: `${style.size - 4 - i * 2}px`,
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
              width: `${(style.size - 4) * 0.6}px`,
              height: `${(style.size - 4) * 0.5}px`,
              background: 'rgba(34, 139, 34, 0.7)',
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              pointerEvents: 'none',
              clipPath: 'ellipse(60% 50% at 50% 50%)',
            }}
          />
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
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
        onMouseEnter={() => setHoveredObject(obj)}
        onMouseLeave={() => setHoveredObject(null)}
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
          pointerEvents: 'auto',
          cursor: 'help',
        }}
        onMouseEnter={() => setHoveredObject(obj)}
        onMouseLeave={() => setHoveredObject(null)}
      >
        {Array.from({ length: asteroidCount }).map((_, i) => {
          const angle = (360 / asteroidCount) * i;
          const random1 = seededRandom(seed + i);
          const random2 = seededRandom(seed + i + 100);
          const distance = spread * (0.5 + random1 * 0.5);
          const asteroidX = Math.cos(angle * Math.PI / 180) * distance;
          const asteroidY = Math.sin(angle * Math.PI / 180) * distance;
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
  const renderProbe = (probe: Probe, zIndex: number = 50) => {
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
        onClick={() => handleProbeClick(probe, shouldHighlight ? 1 : 0)}
        onMouseEnter={() => setHoveredProbe(probe.id)}
        onMouseLeave={() => setHoveredProbe(null)}
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

  // Fonction helper pour rendre un tooltip de sonde
  const renderProbeTooltip = (probe: Probe, playerName: string, rotationAngle: number = 0) => {
    const { x, y } = calculateObjectPosition(probe.solarPosition.disk, probe.solarPosition.sector, rotationAngle);
    return (
      <div
        key={`probe-tooltip-${probe.id}`}
        className="seti-planet-tooltip"
        style={{
          position: 'absolute',
          bottom: `calc(50% - ${y}% + 12px)`,
          left: `calc(50% + ${x}%)`,
          transform: 'translateX(-50%)',
          opacity: hoveredProbe === probe.id ? 1 : 0,
          visibility: hoveredProbe === probe.id ? 'visible' : 'hidden',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ fontWeight: 'bold' }}>{playerName}</div>
        <div style={{ fontSize: '0.8em', color: '#ccc', marginTop: '2px' }}>Déplacer la sonde</div>
      </div>
    );
  };

  // Fonction pour gérer le clic sur une sonde
  const handleProbeClick = (probe: Probe, movementBonus: number = 0) => {
    if (selectedProbeId === probe.id) {
      // Désélectionner si déjà sélectionnée
      setSelectedProbeId(null);
      setReachableCells(new Map());
      setHighlightedPath([]);
      return;
    }

    // Sélectionner la sonde
    setSelectedProbeId(probe.id);

    // Calculer les cases accessibles
    if (probe.solarPosition) {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const rotationState = createRotationState(rotationAngle1, rotationAngle2, rotationAngle3);
      
      // Calculer la position absolue de la sonde pour le pathfinding
      // Les sondes sur les plateaux rotatifs ont une position relative, mais le pathfinding travaille en absolu
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

      const reachable = calculateReachableCellsWithEnergy(
        probe.solarPosition.disk,
        absPos.absoluteSector,
        movementBonus,
        currentPlayer.energy, // Utiliser toute l'énergie disponible
        rotationState
      );

      // Retirer la case actuelle des cases accessibles
      const currentKey = `${probe.solarPosition.disk}${absPos.absoluteSector}`;
      reachable.delete(currentKey);
      
      setReachableCells(reachable);
    }
  };

  // Obtenir toutes les sondes dans le système solaire
  const probesInSystem = useMemo(() => {
    return game.board.solarSystem.probes || [];
  }, [game.board.solarSystem.probes]);

  // Calculer la position actuelle de toutes les planètes
  const planetPositions = useMemo(() => {
    const rotationState = createRotationState(rotationAngle1, rotationAngle2, rotationAngle3);
    const planets = [
      { id: 'earth', name: 'Terre' },
      { id: 'venus', name: 'Vénus' },
      { id: 'mercury', name: 'Mercure' },
      { id: 'mars', name: 'Mars' },
      { id: 'jupiter', name: 'Jupiter' },
      { id: 'saturn', name: 'Saturne' },
      { id: 'uranus', name: 'Uranus' },
      { id: 'neptune', name: 'Neptune' },
    ];
    
    return planets.map(planet => {
      const pos = getObjectPosition(planet.id, rotationState);
      if (pos) {
        return {
          name: planet.name,
          position: `${pos.disk}${pos.absoluteSector}`,
        };
      }
      return {
        name: planet.name,
        position: '?',
      };
    });
  }, [rotationAngle1, rotationAngle2, rotationAngle3]);

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
      <div className="seti-panel seti-solar-system-container">
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
            backgroundColor: showLevel1 ? '#ffd700' : '#666',
            color: showLevel1 ? '#000' : '#fff',
            border: `2px solid ${showLevel1 ? '#ffed4e' : '#888'}`,
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
            backgroundColor: showLevel3 ? '#4a9eff' : '#666',
            color: showLevel3 ? '#fff' : '#ccc',
            border: `2px solid ${showLevel3 ? '#6bb3ff' : '#888'}`,
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

      {/* Positions des planètes */}
      {/*<div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '6px 10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        fontSize: '0.75rem',
        borderRadius: '4px',
        border: '1px solid rgba(100, 150, 255, 0.5)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        maxHeight: '200px',
        overflowY: 'auto',
      }}>
        {planetPositions.map((planet, index) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontWeight: 'bold' }}>{planet.name}:</span>
            <span>{planet.position}</span>
          </div>
        ))}
      </div>*/}
      
      {/* Conteneur pour positionner les éléments directement dans le panel */}
      <div style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          margin: '0 auto',
          /* Forcer un carré parfait en utilisant padding-bottom */
          height: 0,
          paddingBottom: '100%',
        }}>
        {/* Conteneur interne pour positionner les éléments */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          minHeight: '100%', // S'assurer que le contenu prend au moins 100% de la hauteur
          overflow: 'visible', // Permettre au contenu de dépasser
        }}>
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
            }).map((probe) => renderProbe(probe, 50)
          )}

          {/* Plateau rotatif niveau 1 avec 3 disques (A, B, C) - se superpose au plateau fixe */}
          {showLevel1 && (
          <div
            className="seti-rotating-overlay seti-rotating-level-1"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotationAngle1}deg)`, // Rotation dynamique
              width: '100%', // Taille ajustée
              height: '100%',
              borderRadius: '50%',
              zIndex: 20, // Au-dessus du niveau 0 (10-18)
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
              .map((probe) => renderProbe(probe, 50))}

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

          </div>
          )}

          {/* Plateau rotatif niveau 2 avec 2 disques (A, B) - se superpose au niveau 1 */}
          {showLevel2 && (
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
              .map((probe) => renderProbe(probe, 50))}

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

          </div>
          )}

          {/* Plateau rotatif niveau 3 avec 1 disque (A) - se superpose au niveau 2 */}
          {showLevel3 && (
          <div
            className="seti-rotating-overlay seti-rotating-level-3"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotationAngle3}deg)`, // Rotation dynamique
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
              }).map((probe) => renderProbe(probe, 50)
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

          </div>
          )}

          {/* Zones invisibles pour détecter le survol des cases */}
          {/*Object.keys(DISK_NAMES).map((disk, diskIndex) => {
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            
            return Array.from({ length: 8 }).map((_, sectorIndex) => {
              const sectorNumber = indexToSector[sectorIndex];
              const sectorStartAngle = -(360 / 8) * sectorIndex;
              const sectorEndAngle = -(360 / 8) * (sectorIndex + 1);
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const cellRadius = (innerRadius + outerRadius) / 2;
              const radian = (sectorCenterAngle - 90) * (Math.PI / 180);
              const x = Math.cos(radian) * cellRadius;
              const y = Math.sin(radian) * cellRadius;
              
              return (
                <div
                  key={`cell-${disk}-${sectorNumber}`}
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: `${(outerRadius - innerRadius) * 0.9}%`,
                    height: `${(outerRadius - innerRadius) * 0.9}%`,
                    borderRadius: '50%',
                    pointerEvents: 'auto',
                    zIndex: 20,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredCell({ disk: disk as DiskName, sector: sectorNumber })}
                  onMouseLeave={() => setHoveredCell(null)}
                />
              );
            });
          })}*/}

          {/* Tooltip pour afficher la position de la case survolée */}
          {/*hoveredCell && (() => {
            const diskIndex = DISK_NAMES[hoveredCell.disk];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const sectorIndex = sectorToIndex[hoveredCell.sector];
            const sectorStartAngle = -(360 / 8) * sectorIndex;
            const sectorEndAngle = -(360 / 8) * (sectorIndex + 1);
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const cellRadius = (innerRadius + outerRadius) / 2;
            const radian = (sectorCenterAngle - 90) * (Math.PI / 180);
            // Positionner le tooltip légèrement au-dessus de la case
            const tooltipOffset = 3; // 3% vers l'extérieur
            const tooltipRadius = cellRadius + tooltipOffset;
            const tooltipX = Math.cos(radian) * tooltipRadius;
            const tooltipY = Math.sin(radian) * tooltipRadius;
            
            return (
              <div
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${tooltipY}%)`,
                  left: `calc(50% + ${tooltipX}%)`,
                  transform: 'translate(-50%, -50%)',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  border: '2px solid #78a0ff',
                  zIndex: 20,
                  pointerEvents: 'none',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                {hoveredCell.disk}{hoveredCell.sector}
              </div>
            );
          })()*/}

          {/* Conteneur fixe pour les tooltips des planètes rotatives */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }}>
            {/* Tooltip dynamique pour l'objet survolé (Planète, Comète, Astéroïde) */}
            {hoveredObject && (() => {
              const { disk, sector } = hoveredObject.position;
              let rotationAngle = 0;
              if (hoveredObject.level === 1) rotationAngle = rotationAngle1;
              else if (hoveredObject.level === 2) rotationAngle = rotationAngle2;
              else if (hoveredObject.level === 3) rotationAngle = rotationAngle3;
              else rotationAngle = 0;
              
              const { x, y } = calculateObjectPosition(disk, sector, rotationAngle);
              
              let content = <div style={{ fontWeight: 'bold' }}>{hoveredObject.name}</div>;
              let subContent = null;

              if (hoveredObject.type === 'comet') {
                subContent = <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa' }}>Vous gagnez 1 media</div>;
              } else if (hoveredObject.type === 'asteroid') {
                const currentPlayer = game.players[game.currentPlayerIndex];
                // Utilisation de exploration-2 qui correspond au bonus d'astéroïdes dans Board.ts
                const hasTech = currentPlayer.technologies.some(t => t.id.startsWith('exploration-2'));
                subContent = (
                  <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa' }}>
                    {hasTech ? 'Vous gagnez 1 media' : 'Nécessite 1 déplacement supplémentaire pour quitter'}
                  </div>
                );
              } else if (hoveredObject.type === 'planet' && hoveredObject.id !== 'earth') {
                subContent = <div style={{ fontSize: '0.8em', marginTop: '4px', color: '#aaa' }}>Vous gagnez 1 media</div>;
              } else {
                const currentPlayer = game.players[game.currentPlayerIndex];
                const canLaunch = currentPlayer.credits >= GAME_CONSTANTS.PROBE_LAUNCH_COST;
                subContent = (
                  <div style={{ 
                    fontSize: '0.75em', 
                    marginTop: '6px', 
                    color: '#666', 
                    backgroundColor: 'rgba(74, 158, 255, 0.2)', //canLaunch ? 'rgba(100, 200, 100, 0.2)' : 'rgba(60, 60, 60, 0.3)', 
                    border: '1px solid #4a9eff', //canLaunch ? '1px solid rgba(100, 200, 100, 0.4)' : '1px solid rgba(100, 100, 100, 0.2)',
                    borderRadius: '4px', 
                    padding: '3px 8px',
                    display: 'inline-block'
                  }}>
                    Lancer une sonde
                  </div>
                );
              }

              return (
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: `calc(50% - ${y}% + 18px)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translateX(-50%)',
                    opacity: 1,
                    visibility: 'visible',
                    zIndex: 101,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #78a0ff',
                    color: '#fff',
                    textAlign: 'center',
                    minWidth: '120px',
                    pointerEvents: 'none',
                  }}
                >
                  {content}
                  {subContent}
                </div>
              );
            })()}

            {/* Tooltips des sondes */}
            {probesInSystem.map((probe) => {
              if (!probe.solarPosition) return null;
              const player = game.players.find(p => p.id === probe.ownerId);
              const playerName = player?.name || 'Joueur inconnu';
              
              const level = probe.solarPosition.level;
              if (level === 1) {
                return renderProbeTooltip(probe, playerName, rotationAngle1);
              } else if (level === 2) {
                return renderProbeTooltip(probe, playerName, rotationAngle2);
              } else if (level === 3) {
                return renderProbeTooltip(probe, playerName, rotationAngle3);
              } else {
                return renderProbeTooltip(probe, playerName);
              }
            })}
          </div>

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
                    onProbeMove(selectedProbeId, disk, sector, data.movements, data.path);
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
                  zIndex: isTarget ? 52 : (isPathStep ? 51 : 50),
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
            // En CSS, 0° = droite (3h), donc on soustrait 90° pour avoir 0° = haut (12h)
            const radian = (sectorCenterAngle - 90) * (Math.PI / 180);
            const x = Math.cos(radian) * labelRadius;
            const y = Math.sin(radian) * labelRadius;
            
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
                  zIndex: 10,
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
      </div>
      </div>
    </>
  );
});

SolarSystemBoard.displayName = 'SolarSystemBoard';
