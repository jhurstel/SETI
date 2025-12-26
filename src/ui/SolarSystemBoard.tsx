import React, { useState, useImperativeHandle, forwardRef, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Game, Probe, DiskName, SectorNumber } from '../core/types';
import { 
  createRotationState, 
  calculateReachableCellsWithEnergy,
  getObjectPosition,
  FIXED_OBJECTS,
  INITIAL_ROTATING_LEVEL1_OBJECTS,
  INITIAL_ROTATING_LEVEL2_OBJECTS,
  INITIAL_ROTATING_LEVEL3_OBJECTS,
  CelestialObject
} from '../core/SolarSystemPosition';

interface SolarSystemBoardProps {
  game: Game;
  initialSector1?: number; // Secteur initial (1-8) pour positionner le plateau niveau 1
  initialSector2?: number; // Secteur initial (1-8) pour positionner le plateau niveau 2
  initialSector3?: number; // Secteur initial (1-8) pour positionner le plateau niveau 3
}

export interface SolarSystemBoardRef {
  resetRotation1: () => void;
  rotateCounterClockwise1: () => void;
  resetRotation2: () => void;
  rotateCounterClockwise2: () => void;
  resetRotation3: () => void;
  rotateCounterClockwise3: () => void;
  openFullscreen: () => void;
}

const DISK_NAMES = ['A', 'B', 'C', 'D', 'E'];

export const SolarSystemBoard = forwardRef<SolarSystemBoardRef, SolarSystemBoardProps>(({ game, initialSector1 = 1, initialSector2 = 1, initialSector3 = 1 }, ref) => {
  // État pour gérer l'affichage des tooltips au survol
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);
  
  // État pour gérer la sonde sélectionnée et les cases accessibles
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [reachableCells, setReachableCells] = useState<Map<string, { movements: number; path: string[] }>>(new Map());

  // État pour gérer la position de la case survolée
  const [hoveredCell, setHoveredCell] = useState<{ disk: DiskName; sector: SectorNumber } | null>(null);

  // État pour contrôler la visibilité des plateaux rotatifs
  const [showLevel1, setShowLevel1] = useState<boolean>(true);
  const [showLevel2, setShowLevel2] = useState<boolean>(true);
  const [showLevel3, setShowLevel3] = useState<boolean>(true);

  // État pour gérer l'affichage en plein écran
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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
    // Rotation inverse : on additionne au lieu de soustraire
    const relativeIndex = (absoluteIndex + sectorsRotated + 8) % 8;
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
  const calculateObjectPosition = (disk: DiskName, sector: SectorNumber) => {
    const diskIndex = DISK_NAMES.indexOf(disk);
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
    const radian = sectorCenterAngle * (Math.PI / 180);
    const x = Math.cos(radian) * objectRadius;
    const y = Math.sin(radian) * objectRadius;
    return { x, y, sectorCenterAngle, diskIndex };
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
        }}
        title={obj.name}
        onMouseEnter={() => setHoveredPlanet(obj.id)}
        onMouseLeave={() => setHoveredPlanet(null)}
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
        <div
          className="seti-planet-tooltip"
          style={{
            transform: 'translateX(-50%)',
            transformOrigin: 'center bottom',
          }}
        >
          {obj.name}
        </div>
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
        }}
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
          pointerEvents: 'none',
        }}
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

  // Fonction pour gérer le clic sur une sonde
  const handleProbeClick = (probe: Probe) => {
    if (selectedProbeId === probe.id) {
      // Désélectionner si déjà sélectionnée
      setSelectedProbeId(null);
      setReachableCells(new Map());
      return;
    }

    // Sélectionner la sonde
    setSelectedProbeId(probe.id);

    // Calculer les cases accessibles
    if (probe.solarPosition) {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const rotationState = createRotationState(rotationAngle1, rotationAngle2, rotationAngle3);
      const reachable = calculateReachableCellsWithEnergy(
        probe.solarPosition.disk,
        probe.solarPosition.sector,
        0, // Pas de déplacements de base (sera géré par l'énergie)
        currentPlayer.energy, // Utiliser toute l'énergie disponible
        rotationState
      );
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


  // Fonction pour ouvrir le plateau en plein écran (exposée via ref pour être appelée depuis le parent)
  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  // Fonction pour fermer le plein écran
  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Exposer la fonction openFullscreen via ref
  useImperativeHandle(ref, () => ({
    resetRotation1,
    rotateCounterClockwise1,
    resetRotation2,
    rotateCounterClockwise2,
    resetRotation3,
    rotateCounterClockwise3,
    openFullscreen,
  }));

  return (
    <>
      <div className="seti-panel seti-solar-system-container">
        <div className="seti-panel-title">Système solaire</div>
        
        {/* Boutons pour toggle l'affichage des plateaux */}
        <div style={{
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
      </div>

      {/* Positions des planètes */}
      <div style={{
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
      </div>
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
              zIndex: 24, // Au-dessus du soleil, des objets fixes et des comètes/astéroïdes
              overflow: 'hidden',
              aspectRatio: '1', // Force un cercle parfait
              transition: 'transform 0.3s ease-in-out', // Transition fluide pour la rotation
              willChange: 'transform', // Optimisation pour la performance de la rotation
            }}
          >
            {/* Disque C (extérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 1 (rotation inverse)
              const relativeSector = absoluteToRelativeSector(absoluteSector, -rotationAngle1);
              // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL1_OBJECTS
              const sectorType = getSectorType(1, 'C', relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              // Utiliser l'index du secteur relatif pour calculer la position visuelle
              const relativeSectorIndex = sectorToIndex[relativeSector];
              
              const diskIndex = 2; // C
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth); // 20%
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 28%
              
              const sectorStartAngle = -(360 / 8) * relativeSectorIndex - 90; // 0° = midi (12h), sens horaire (de droite à gauche)
              const sectorEndAngle = -(360 / 8) * (relativeSectorIndex + 1) - 90;
              
              // Calcul des points pour le secteur (tranche de tarte en forme d'anneau)
              // Conversion en coordonnées SVG (viewBox 0 0 200 200, centre à 100,100)
              // Les rayons sont en pourcentage, donc on les convertit : 20% de 200 = 40, 28% de 200 = 56
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
              
              // Flag pour déterminer si l'arc est grand (plus de 180°)
              const largeArcFlag = Math.abs(sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;
              
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
                    zIndex: 24, // Sous les objets célestes mais au-dessus du conteneur
                    transformOrigin: 'center center', // Assurer que la rotation se fait autour du centre
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStartX} ${innerStartY} Z`}
                    fill="rgba(60, 80, 120, 0.8)" // Plus clair pour la surbrillance
                    stroke="rgba(255, 215, 0, 0.8)" // Bordure jaune pour correspondre au contour
                    strokeWidth="1.5" // Bordure plus épaisse
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 215, 0, 0.5))' }} // Effet de glow jaune
                  />
                </svg>
              );
            })}

            {/* Disque B (moyen) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 1 (rotation inverse)
              const relativeSector = absoluteToRelativeSector(absoluteSector, -rotationAngle1);
              // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL1_OBJECTS
              const sectorType = getSectorType(1, 'B', relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              // Utiliser l'index du secteur relatif pour calculer la position visuelle
              const relativeSectorIndex = sectorToIndex[relativeSector];
              
              const diskIndex = 1; // B
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth); // 12%
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 20%
              
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
              
              // Ne pas afficher les secteurs hollow
              if (sectorType === 'hollow') return null;
              
              return (
                <svg
                  key={`rotating-sector-b-${sectorNumber}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 24, // Sous les objets célestes mais au-dessus du conteneur
                    transformOrigin: 'center center', // Assurer que la rotation se fait autour du centre
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStartX} ${innerStartY} Z`}
                    fill="rgba(60, 80, 120, 0.8)" // Plus clair pour la surbrillance
                    stroke="rgba(255, 215, 0, 0.8)" // Bordure jaune pour correspondre au contour
                    strokeWidth="1.5" // Bordure plus épaisse
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 215, 0, 0.5))' }} // Effet de glow jaune
                  />
                </svg>
              );
            })}

            {/* Disque A (intérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 1 (rotation inverse)
              const relativeSector = absoluteToRelativeSector(absoluteSector, -rotationAngle1);
              // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL1_OBJECTS
              const sectorType = getSectorType(1, 'A', relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              // Utiliser l'index du secteur relatif pour calculer la position visuelle
              const relativeSectorIndex = sectorToIndex[relativeSector];
              
              const diskIndex = 0; // A
              const diskWidth = 8;
              const sunRadius = 4;
              // Le disque A commence au bord du soleil (4%) pour que le centre corresponde au soleil
              const innerRadius = sunRadius; // 4% (bord du soleil)
              const outerRadius = sunRadius + diskWidth; // 12%
              
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
              
              // Ne pas afficher les secteurs hollow
              if (sectorType === 'hollow') return null;
              
              return (
                <svg
                  key={`rotating-sector-a-${sectorNumber}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 24, // Sous les objets célestes mais au-dessus du conteneur
                    transformOrigin: 'center center', // Assurer que la rotation se fait autour du centre
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStartX} ${innerStartY} Z`}
                    fill="rgba(60, 80, 120, 0.8)" // Plus clair pour la surbrillance
                    stroke="rgba(255, 215, 0, 0.8)" // Bordure jaune pour correspondre au contour
                    strokeWidth="1.5" // Bordure plus épaisse
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 215, 0, 0.5))' }} // Effet de glow jaune
                  />
                </svg>
              );
            })}


            {/* Objets célestes sur le plateau rotatif niveau 1 - basés sur INITIAL_ROTATING_LEVEL1_OBJECTS */}
            {INITIAL_ROTATING_LEVEL1_OBJECTS.filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
              if (obj.type === 'planet') {
                return renderPlanet(obj, 35);
              } else if (obj.type === 'comet') {
                return renderComet(obj, 25);
              } else if (obj.type === 'asteroid') {
                return renderAsteroid(obj, 25);
              }
              return null;
            })}

          </div>
          )}

          {/* Plateau rotatif niveau 2 avec 2 disques (A, B) - se superpose au plateau fixe et niveau 1 */}
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
              zIndex: 26,
              overflow: 'hidden',
              aspectRatio: '1',
              pointerEvents: 'none',
              transition: 'transform 0.3s ease-in-out', // Transition fluide pour la rotation
              willChange: 'transform', // Optimisation pour la performance de la rotation
            }}
          >
            {/* Objets célestes sur le plateau rotatif niveau 2 - basés sur INITIAL_ROTATING_LEVEL2_OBJECTS */}
            {INITIAL_ROTATING_LEVEL2_OBJECTS.filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
              if (obj.type === 'planet') {
                return renderPlanet(obj, 35);
              } else if (obj.type === 'comet') {
                return renderComet(obj, 28);
              } else if (obj.type === 'asteroid') {
                return renderAsteroid(obj, 28);
              }
              return null;
            })}

            {/* Disque B (extérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 2 (rotation inverse)
              // Rotation totale niveau 2 = level1Angle + level2Angle
              const totalRotation2 = rotationAngle1 + rotationAngle2;
              const relativeSector = absoluteToRelativeSector(absoluteSector, -rotationAngle2);
              // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL1_OBJECTS
              const sectorType = getSectorType(2, 'B', relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              // Utiliser l'index du secteur relatif pour calculer la position visuelle
              const relativeSectorIndex = sectorToIndex[relativeSector];
              
              const diskIndex = 1; // B
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth); // 12%
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 20%
              
              const sectorStartAngle = -(360 / 8) * relativeSectorIndex - 90; // 0° = midi (12h), sens horaire (de droite à gauche)
              const sectorEndAngle = -(360 / 8) * (relativeSectorIndex + 1) - 90;
              
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
              
              if (sectorType === 'hollow') return null;
              
              return (
                <svg
                  key={`rotating-level2-sector-b-${sectorNumber}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 27, // Sous Mars (z-index 35) mais au-dessus du conteneur (z-index 26)
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStartX} ${innerStartY} Z`}
                    fill="rgba(40, 60, 100, 0.8)" // Plus clair pour la surbrillance
                    stroke="rgba(255, 107, 107, 0.8)" // Bordure rouge pour correspondre au contour
                    strokeWidth="1.5" // Bordure plus épaisse
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 107, 107, 0.5))' }} // Effet de glow
                  />
                </svg>
              );
            })}

            {/* Disque A (intérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 2 (rotation inverse)
              // Rotation totale niveau 2 = level1Angle + level2Angle
              const totalRotation2 = rotationAngle1 + rotationAngle2;
              const relativeSector = absoluteToRelativeSector(absoluteSector, -rotationAngle2);
              // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL2_OBJECTS
              const sectorType = getSectorType(2, 'A', relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              // Utiliser l'index du secteur relatif pour calculer la position visuelle
              const relativeSectorIndex = sectorToIndex[relativeSector];
              
              const diskIndex = 0; // A
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius; // 4% (bord du soleil)
              const outerRadius = sunRadius + diskWidth; // 12%
              
              const sectorStartAngle = -(360 / 8) * relativeSectorIndex - 90; // 0° = midi (12h), sens horaire (de droite à gauche)
              const sectorEndAngle = -(360 / 8) * (relativeSectorIndex + 1) - 90;
              
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
              
              if (sectorType === 'hollow') return null;
              
              return (
                <svg
                  key={`rotating-level2-sector-a-${sectorNumber}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 27,
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStartX} ${innerStartY} Z`}
                    fill="rgba(40, 60, 100, 0.8)"
                    stroke="rgba(255, 107, 107, 0.8)"
                    strokeWidth="1.5"
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 107, 107, 0.5))' }}
                  />
                </svg>
              );
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
              zIndex: 28, // Au-dessus du niveau 2 (z-index 26)
              overflow: 'hidden',
              aspectRatio: '1', // Force un cercle parfait
              pointerEvents: 'none', // Ne pas intercepter les événements, sauf sur les objets célestes
              transition: 'transform 0.3s ease-in-out', // Transition fluide pour la rotation
              willChange: 'transform', // Optimisation pour la performance de la rotation
            }}
          >
            {/* Objets célestes sur le plateau rotatif niveau 3 - basés sur INITIAL_ROTATING_LEVEL3_OBJECTS */}
            {INITIAL_ROTATING_LEVEL3_OBJECTS.filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
              if (obj.type === 'planet') {
                return renderPlanet(obj, 35);
              } else if (obj.type === 'comet') {
                return renderComet(obj, 29);
              } else if (obj.type === 'asteroid') {
                return renderAsteroid(obj, 29);
              }
              return null;
            })}

            {/* Disque A (intérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 3 (rotation inverse)
              // Rotation totale niveau 3 = level1Angle + level2Angle + level3Angle
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const relativeSector = absoluteToRelativeSector(absoluteSector, -rotationAngle3);
              // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL3_OBJECTS
              const sectorType = getSectorType(3, 'A', relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              // Utiliser l'index du secteur relatif pour calculer la position visuelle
              const relativeSectorIndex = sectorToIndex[relativeSector];
              
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius; // 4% (bord du soleil)
              const outerRadius = sunRadius + diskWidth; // 12%
              
              const sectorStartAngle = -(360 / 8) * relativeSectorIndex - 90; // 0° = midi (12h), sens horaire (de droite à gauche)
              const sectorEndAngle = -(360 / 8) * (relativeSectorIndex + 1) - 90;
              
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
              
              if (sectorType === 'hollow') return null;
              
              return (
                <svg
                  key={`rotating-level3-sector-a-${sectorNumber}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 29,
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} L ${outerStartX} ${outerStartY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerStartX} ${innerStartY} Z`}
                    fill="rgba(40, 60, 100, 0.8)"
                    stroke="rgba(74, 158, 255, 0.8)"
                    strokeWidth="1.5"
                    style={{ filter: 'drop-shadow(0 0 3px rgba(74, 158, 255, 0.5))' }}
                  />
                </svg>
              );
            })}

          </div>
          )}

          {/* Objets fixes (niveau 0) - basés sur FIXED_OBJECTS */}
          {FIXED_OBJECTS.map((obj) => {
            if (obj.type === 'planet') {
              return renderPlanet(obj, 35);
            } else if (obj.type === 'comet') {
              return renderComet(obj, 20);
            } else if (obj.type === 'asteroid') {
              return renderAsteroid(obj, 20);
            }
            return null;
          })}

          {/* Zones invisibles pour détecter le survol des cases */}
          {DISK_NAMES.map((disk, diskIndex) => {
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
          })}

          {/* Tooltip pour afficher la position de la case survolée */}
          {hoveredCell && (() => {
            const diskIndex = DISK_NAMES.indexOf(hoveredCell.disk);
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
          })()}

          {/* Conteneur fixe pour les tooltips des planètes rotatives */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }}>
            {/* Tooltip Saturne (niveau 1) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 2; // C
              const sectorNumber = 1; // Saturne est en C1 selon INITIAL_ROTATING_LEVEL1_OBJECTS
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              // Utiliser le même calcul que pour le rendu des secteurs (avec -90° offset)
              const sectorStartAngle = -(360 / 8) * sectorIndex - 90;
              const sectorEndAngle = -(360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation du plateau niveau 1
              const rotatedAngle = sectorCenterAngle + rotationAngle1;
              const radian = rotatedAngle * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: `calc(50% - ${y}% + 18px)`, // Position au-dessus de la planète (18px = demi-taille de la planète + marge)
                    left: `calc(50% + ${x}%)`,
                    transform: 'translateX(-50%)',
                    opacity: hoveredPlanet === 'saturn' ? 1 : 0,
                  }}
                >
                  Saturne
                </div>
              );
            })()}

            {/* Tooltip Jupiter (niveau 1) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 2; // C
              const sectorNumber = 5; // Jupiter est en C5 selon INITIAL_ROTATING_LEVEL1_OBJECTS
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              // Utiliser le même calcul que pour le rendu des secteurs (avec -90° offset)
              const sectorStartAngle = -(360 / 8) * sectorIndex - 90;
              const sectorEndAngle = -(360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation du plateau niveau 1
              const rotatedAngle = sectorCenterAngle + rotationAngle1;
              const radian = rotatedAngle * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: `calc(50% - ${y}% + 20px)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translateX(-50%)',
                    opacity: hoveredPlanet === 'jupiter' ? 1 : 0,
                  }}
                >
                  Jupiter
                </div>
              );
            })()}

            {/* Tooltip Mars (niveau 2) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 1; // B
              const sectorNumber = 3;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              // Utiliser le même calcul que pour le rendu des secteurs (avec -90° offset)
              const sectorStartAngle = -(360 / 8) * sectorIndex - 90;
              const sectorEndAngle = -(360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation totale du plateau niveau 2 (tourne avec niveau 1)
              const totalRotation2 = rotationAngle1 + rotationAngle2;
              const rotatedAngle = sectorCenterAngle + totalRotation2;
              const radian = rotatedAngle * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: `calc(50% - ${y}% + 14px)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translateX(-50%)',
                    opacity: hoveredPlanet === 'mars' ? 1 : 0,
                  }}
                >
                  Mars
                </div>
              );
            })()}

            {/* Tooltip Terre (niveau 3) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 1; // Terre en A1
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              // Utiliser le même calcul que pour le rendu des secteurs (avec -90° offset)
              const sectorStartAngle = -(360 / 8) * sectorIndex - 90;
              const sectorEndAngle = -(360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation totale du plateau niveau 3 (tourne avec niveaux 1 et 2)
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const rotatedAngle = sectorCenterAngle + totalRotation3;
              const radian = rotatedAngle * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: `calc(50% - ${y}% + 16px)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translateX(-50%)',
                    opacity: hoveredPlanet === 'earth' ? 1 : 0,
                  }}
                >
                  Terre
                </div>
              );
            })()}

            {/* Tooltip Vénus (niveau 3) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 3; // Vénus en A3
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              // Utiliser le même calcul que pour le rendu des secteurs (avec -90° offset)
              const sectorStartAngle = -(360 / 8) * sectorIndex - 90;
              const sectorEndAngle = -(360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation totale du plateau niveau 3 (tourne avec niveaux 1 et 2)
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const rotatedAngle = sectorCenterAngle + totalRotation3;
              const radian = rotatedAngle * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: `calc(50% - ${y}% + 15px)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translateX(-50%)',
                    opacity: hoveredPlanet === 'venus' ? 1 : 0,
                  }}
                >
                  Vénus
                </div>
              );
            })()}

            {/* Tooltip Mercure (niveau 3) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 5; // Mercure en A5
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              // Utiliser le même calcul que pour le rendu des secteurs (avec -90° offset)
              const sectorStartAngle = -(360 / 8) * sectorIndex - 90;
              const sectorEndAngle = -(360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation totale du plateau niveau 3 (tourne avec niveaux 1 et 2)
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const rotatedAngle = sectorCenterAngle + totalRotation3;
              const radian = rotatedAngle * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: `calc(50% - ${y}% + 13px)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translateX(-50%)',
                    opacity: hoveredPlanet === 'mercury' ? 1 : 0,
                  }}
                >
                  Mercure
                </div>
              );
            })()}
          </div>

          {/* Surbrillance des cases accessibles */}
          {selectedProbeId && Array.from(reachableCells.entries()).map(([cellKey, data]) => {
            const [disk, sector] = [cellKey[0] as DiskName, parseInt(cellKey[1]) as SectorNumber];
            const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
            const diskIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(disk);
            const sectorIndex = sectorToIndex[sector];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const cellRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = -(360 / 8) * sectorIndex; // 0° = midi (12h), sens horaire (de droite à gauche)
            const sectorEndAngle = -(360 / 8) * (sectorIndex + 1);
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle - 90) * (Math.PI / 180); // -90° pour avoir 0° = midi en CSS
            const x = Math.cos(radian) * cellRadius;
            const y = Math.sin(radian) * cellRadius;

            return (
              <div
                key={`reachable-${cellKey}`}
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: `${(outerRadius - innerRadius) * 0.8}%`,
                  height: `${(outerRadius - innerRadius) * 0.8}%`,
                  borderRadius: '50%',
                  border: '2px solid #00ff00',
                  backgroundColor: 'rgba(0, 255, 0, 0.2)',
                  pointerEvents: 'none',
                  zIndex: 40,
                }}
                title={`Accessible en ${data.movements} déplacement(s)`}
              />
            );
          })}

          {/* Affichage des sondes */}
          {probesInSystem.map((probe) => {
            if (!probe.solarPosition) return null;

            const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
            const diskIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(probe.solarPosition.disk);
            const sectorIndex = sectorToIndex[probe.solarPosition.sector];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const probeRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = -(360 / 8) * sectorIndex; // 0° = midi (12h), sens horaire (de droite à gauche)
            const sectorEndAngle = -(360 / 8) * (sectorIndex + 1);
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle - 90) * (Math.PI / 180); // -90° pour avoir 0° = midi en CSS
            const x = Math.cos(radian) * probeRadius;
            const y = Math.sin(radian) * probeRadius;

            const player = game.players.find(p => p.id === probe.ownerId);
            const playerName = player?.name || 'Joueur inconnu';
            const isSelected = selectedProbeId === probe.id;

            return (
              <div
                key={probe.id}
                onClick={() => handleProbeClick(probe)}
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: isSelected 
                    ? 'radial-gradient(circle, #00ff00, #00cc00)' 
                    : 'radial-gradient(circle, #8888ff, #5555aa)',
                  border: isSelected ? '3px solid #00ff00' : '2px solid #6666cc',
                  boxShadow: isSelected 
                    ? '0 0 12px rgba(0, 255, 0, 0.8)' 
                    : '0 0 6px rgba(136, 136, 255, 0.6)',
                  cursor: 'pointer',
                  zIndex: 50,
                  transition: 'all 0.2s ease',
                }}
                title={playerName}
              >
                <div
                  className="seti-planet-tooltip"
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    opacity: 1,
                  }}
                >
                  {playerName}
                </div>
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
                  fontSize: '0.9rem',
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
          {DISK_NAMES.map((disk, index) => {
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
                    fontSize: '1rem',
                    color: '#78a0ff',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #78a0ff',
                    whiteSpace: 'nowrap',
                    zIndex: 30,
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

      {/* Modal plein écran */}
      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
          }}
          onClick={(e) => {
            // Fermer si on clique sur le fond (pas sur le plateau)
            if (e.target === e.currentTarget) {
              closeFullscreen();
            }
          }}
        >
          <button
            onClick={closeFullscreen}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: '#ff4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
              zIndex: 10001,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget;
              target.style.backgroundColor = '#ff6666';
              target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget;
              target.style.backgroundColor = '#ff4444';
              target.style.transform = 'scale(1)';
            }}
          >
            ✕ Fermer
          </button>
          <div
            style={{
              width: '90vw',
              height: '90vh',
              maxWidth: '90vh',
              maxHeight: '90vw',
              position: 'relative',
              margin: 'auto',
              backgroundColor: '#1a1a2e',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Afficher le contenu du plateau en grand - réutiliser le même contenu */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              aspectRatio: '1',
              overflow: 'visible',
            }}>
              {/* Le contenu du plateau sera rendu ici - pour l'instant, on affiche un message */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
                fontSize: '1.2rem',
                textAlign: 'center',
              }}>
                <p>Le plateau du système solaire en grand</p>
                <p style={{ fontSize: '0.9rem', color: '#aaa', marginTop: '10px' }}>
                  (Le contenu complet sera affiché ici)
                </p>
              </div>
            </div>
          </div>
        </div>,
        typeof document !== 'undefined' ? document.body : null
      )}
      </div>
    </>
  );
});

SolarSystemBoard.displayName = 'SolarSystemBoard';
