import React, { useState, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react';
import { Game, Probe, DiskName, SectorNumber } from '../core/types';
import { 
  createRotationState, 
  calculateReachableCellsWithEnergy,
  getObjectPosition
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
}

const DISK_NAMES = ['A', 'B', 'C', 'D', 'E'];

export const SolarSystemBoard = forwardRef<SolarSystemBoardRef, SolarSystemBoardProps>(({ game, initialSector1 = 1, initialSector2 = 1, initialSector3 = 1 }, ref) => {
  // État pour gérer l'affichage des tooltips au survol
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);
  
  // État pour gérer la sonde sélectionnée et les cases accessibles
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [reachableCells, setReachableCells] = useState<Map<string, { movements: number; path: string[] }>>(new Map());

  // Calculer l'angle initial basé sur le secteur (1-8)
  // Secteurs numérotés dans le sens trigonométrique (anti-horaire) : 1, 2, 3, 4, 5, 6, 7, 8
  // Secteur 1 = 0° (en haut), secteur 2 = 45°, secteur 3 = 90°, etc.
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
  const gameAngle1 = game.board.solarSystem.rotationAngleLevel1 ?? initialAngle1;
  const gameAngle2 = game.board.solarSystem.rotationAngleLevel2 ?? initialAngle2;
  const gameAngle3 = game.board.solarSystem.rotationAngleLevel3 ?? initialAngle3;
  
  // État pour gérer l'angle de rotation du plateau niveau 1
  const [rotationAngle1, setRotationAngle1] = useState<number>(gameAngle1);
  
  // État pour gérer l'angle de rotation du plateau niveau 2
  const [rotationAngle2, setRotationAngle2] = useState<number>(gameAngle2);
  
  // État pour gérer l'angle de rotation du plateau niveau 3
  const [rotationAngle3, setRotationAngle3] = useState<number>(gameAngle3);

  // Synchroniser les angles avec le jeu quand ils changent
  useEffect(() => {
    setRotationAngle1(gameAngle1);
  }, [gameAngle1]);

  useEffect(() => {
    setRotationAngle2(gameAngle2);
  }, [gameAngle2]);

  useEffect(() => {
    setRotationAngle3(gameAngle3);
  }, [gameAngle3]);

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

  // Exposer les fonctions via ref
  useImperativeHandle(ref, () => ({
    resetRotation1,
    rotateCounterClockwise1,
    resetRotation2,
    rotateCounterClockwise2,
    resetRotation3,
    rotateCounterClockwise3,
  }));
  return (
    <div className="seti-panel seti-solar-system-container">
      <div className="seti-panel-title">Système solaire</div>
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
        overflow: 'hidden', // Garder hidden pour le carré parfait
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
        }}>
          {/* Soleil au centre */}
          <div className="seti-sun" style={{ top: '50%' }}></div>

          {/* Plateau rotatif niveau 1 avec 3 disques (A, B, C) - se superpose au plateau fixe */}
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
              zIndex: 25, // Au-dessus du soleil, des objets fixes et des comètes/astéroïdes
              overflow: 'hidden',
              aspectRatio: '1', // Force un cercle parfait
              border: '3px solid #ffd700', // Bordure jaune pour mettre en surbrillance le contour
              boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)', // Ombre jaune pour plus de visibilité
            }}
          >
            {/* Disque C (extérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 1 (rotation inverse)
              const relativeSector = absoluteToRelativeSector(absoluteSector, -rotationAngle1);
              // Zones creuses en C : C2, C3, C7, C8 (secteurs relatifs au plateau)
              const isHollow = [2, 3, 7, 8].includes(relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              const diskIndex = 2; // C
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth); // 20%
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 28%
              
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              
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
              const largeArcFlag = (sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;
              
              if (isHollow) return null;
              
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
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerEndX} ${innerEndY} L ${outerEndX} ${outerEndY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerStartX} ${outerStartY} Z`}
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
              // Zones creuses en B : B2, B5, B7 (secteurs relatifs au plateau)
              const isHollow = [2, 5, 7].includes(relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              const diskIndex = 1; // B
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth); // 12%
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 20%
              
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              
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
              
              const largeArcFlag = (sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;
              
              if (isHollow) return null;
              
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
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerEndX} ${innerEndY} L ${outerEndX} ${outerEndY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerStartX} ${outerStartY} Z`}
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
              // Zones creuses en A : A4, A5 (secteurs relatifs au plateau)
              const isHollow = [4, 5].includes(relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              const diskIndex = 0; // A
              const diskWidth = 8;
              const sunRadius = 4;
              // Le disque A commence au bord du soleil (4%) pour que le centre corresponde au soleil
              const innerRadius = sunRadius; // 4% (bord du soleil)
              const outerRadius = sunRadius + diskWidth; // 12%
              
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              
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
              
              const largeArcFlag = (sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;
              
              if (isHollow) return null;
              
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
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerEndX} ${innerEndY} L ${outerEndX} ${outerEndY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerStartX} ${outerStartY} Z`}
                    fill="rgba(60, 80, 120, 0.8)" // Plus clair pour la surbrillance
                    stroke="rgba(255, 215, 0, 0.8)" // Bordure jaune pour correspondre au contour
                    strokeWidth="1.5" // Bordure plus épaisse
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 215, 0, 0.5))' }} // Effet de glow jaune
                  />
                </svg>
              );
            })}


            {/* Objets célestes sur le plateau rotatif */}
            {/* Saturne avec anneaux en C3 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 2; // C
              const sectorNumber = 3;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  key="saturn-rotating"
                  className="seti-planet"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '36px',
                    height: '36px',
                    zIndex: 35,
                    cursor: 'pointer',
                  }}
                  title="Saturne"
                  onMouseEnter={() => setHoveredPlanet('saturn')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                >
                  {/* Planète Saturne */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #fad5a5, #d4a574)',
                      border: '2px solid #e8c99a',
                      boxShadow: '0 0 8px rgba(250, 213, 165, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Anneaux de Saturne */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(15deg)',
                      width: '40px',
                      height: '12px',
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
                      width: '36px',
                      height: '10px',
                      borderRadius: '50%',
                      border: '1px solid rgba(180, 160, 130, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}

            {/* Jupiter avec bandes en C7 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 2; // C
              const sectorNumber = 7;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  key="jupiter-rotating"
                  className="seti-planet"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '40px',
                    height: '40px',
                    zIndex: 35,
                    cursor: 'pointer',
                  }}
                  title="Jupiter"
                  onMouseEnter={() => setHoveredPlanet('jupiter')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                >
                  {/* Planète Jupiter avec bandes */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #d8ca9d, #b89d6a)',
                      border: '2px solid #c4b082',
                      boxShadow: '0 0 8px rgba(216, 202, 157, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Bandes horizontales de Jupiter */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '30%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '32px',
                      height: '3px',
                      background: 'rgba(150, 120, 80, 0.8)',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '45%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '28px',
                      height: '2px',
                      background: 'rgba(140, 110, 70, 0.7)',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '60%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '30px',
                      height: '3px',
                      background: 'rgba(150, 120, 80, 0.8)',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '75%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '26px',
                      height: '2px',
                      background: 'rgba(140, 110, 70, 0.7)',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}

            {/* Comète en B2 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 1; // B
              const sectorNumber = 2;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              // Angle de la queue dans le sens horaire : tangente au cercle pointant vers la droite (sens horaire)
              // Le noyau est à la tête (vers le centre), la queue part vers l'extérieur dans le sens horaire
              const tailAngle = sectorCenterAngle + 180;
              const tailLength = 50;
              const nucleusOffset = 25;

              return (
                <div
                  key="comet-b2-rotating"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '20px',
                    height: '20px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {/* Queue de la comète - part du noyau vers l'extérieur dans le sens horaire */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                      width: `${tailLength}px`,
                      height: '10px',
                      background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Noyau de la comète - en tête de queue (vers le centre) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-${nucleusOffset}px)`,
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
            })()}

            {/* Comète en A1 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 1;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              // Angle de la queue dans le sens horaire : tangente au cercle pointant vers la droite (sens horaire)
              // Le noyau est à la tête (vers le centre), la queue part vers l'extérieur dans le sens horaire
              const tailAngle = sectorCenterAngle + 180;
              const tailLength = 30;
              const nucleusOffset = 15;

              return (
                <div
                  key="comet-a1-rotating"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '20px',
                    height: '20px',
                    zIndex: 30,
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
                      background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                      borderRadius: '2px',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-${nucleusOffset}px)`,
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
            })()}

            {/* Nuage d'astéroïdes en B3 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 1; // B
              const sectorNumber = 3;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 12;
              const baseDistance = 12;

              return (
                <div
                  key="asteroid-b3-rotating"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '32px',
                    height: '32px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 7) * (120 / 7) - 60;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * (4 / 3) - 2;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 4 + (i % 5) * (8 / 5);

                    return (
                      <div
                        key={`particle-b3-rotating-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

            {/* Nuage d'astéroïdes en B6 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 1; // B
              const sectorNumber = 6;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 12;
              const baseDistance = 12;

              return (
                <div
                  key="asteroid-b6-rotating"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '32px',
                    height: '32px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 7) * (120 / 7) - 60;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * (4 / 3) - 2;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 4 + (i % 5) * (8 / 5);

                    return (
                      <div
                        key={`particle-b6-rotating-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

            {/* Nuage d'astéroïdes en A3 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 3;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 8;
              const baseDistance = 8;

              return (
                <div
                  key="asteroid-a3-rotating"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '24px',
                    height: '24px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 5) * 15 - 30;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * 1.5 - 1.5;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 3 + (i % 3);

                    return (
                      <div
                        key={`particle-a3-rotating-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 2px rgba(170, 170, 170, 0.5)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

            {/* Nuage d'astéroïdes en A4 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 4;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 8;
              const baseDistance = 8;

              return (
                <div
                  key="asteroid-a4-rotating"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '24px',
                    height: '24px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 5) * 15 - 30;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * 1.5 - 1.5;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 3 + (i % 3);

                    return (
                      <div
                        key={`particle-a4-rotating-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 2px rgba(170, 170, 170, 0.5)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

            {/* Nuage d'astéroïdes en A8 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 8;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 8;
              const baseDistance = 8;

              return (
                <div
                  key="asteroid-a8-rotating"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '24px',
                    height: '24px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 5) * 15 - 30;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * 1.5 - 1.5;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 3 + (i % 3);

                    return (
                      <div
                        key={`particle-a8-rotating-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 2px rgba(170, 170, 170, 0.5)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

          </div>

          {/* Plateau rotatif niveau 2 avec 2 disques (A, B) - se superpose au plateau fixe et niveau 1 */}
          <div
            className="seti-rotating-overlay seti-rotating-level-2"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${rotationAngle2}deg)`, // Rotation dynamique
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              zIndex: 26, // Au-dessus du niveau 1 (z-index 25)
              overflow: 'hidden',
              aspectRatio: '1', // Force un cercle parfait
              pointerEvents: 'none', // Ne pas intercepter les événements, sauf sur les objets célestes
              border: '3px solid #ff6b6b', // Bordure visible pour mettre en surbrillance le contour
              boxShadow: '0 0 10px rgba(255, 107, 107, 0.6)', // Ombre pour plus de visibilité
            }}
          >
            {/* Disque B (extérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 2 (rotation inverse)
              // Rotation totale niveau 2 = level1Angle + level2Angle
              const totalRotation2 = rotationAngle1 + rotationAngle2;
              const relativeSector = absoluteToRelativeSector(absoluteSector, -totalRotation2);
              // Zones creuses en B : B2, B3, B4, B7, B8 (secteurs relatifs au plateau)
              const isHollow = [2, 3, 4, 7, 8].includes(relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              const diskIndex = 1; // B
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth); // 12%
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 20%
              
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              
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
              
              const largeArcFlag = (sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;
              
              if (isHollow) return null;
              
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
                    d={`M ${innerStartX} ${innerStartY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerEndX} ${innerEndY} L ${outerEndX} ${outerEndY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerStartX} ${outerStartY} Z`}
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
              const relativeSector = absoluteToRelativeSector(absoluteSector, -totalRotation2);
              // Zones creuses en A : A2, A3, A4 (secteurs relatifs au plateau)
              const isHollow = [2, 3, 4].includes(relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              const diskIndex = 0; // A
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius; // 4% (bord du soleil)
              const outerRadius = sunRadius + diskWidth; // 12%
              
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              
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
              
              const largeArcFlag = (sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;
              
              if (isHollow) return null;
              
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
                    zIndex: 27, // Sous Mars (z-index 35) mais au-dessus du conteneur (z-index 26)
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerEndX} ${innerEndY} L ${outerEndX} ${outerEndY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerStartX} ${outerStartY} Z`}
                    fill="rgba(40, 60, 100, 0.8)" // Plus clair pour la surbrillance
                    stroke="rgba(255, 107, 107, 0.8)" // Bordure rouge pour correspondre au contour
                    strokeWidth="1.5" // Bordure plus épaisse
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 107, 107, 0.5))' }} // Effet de glow
                  />
                </svg>
              );
            })}


            {/* Mars en B3 (décalé de 6 crans anti-horaire depuis B1) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 1; // B
              const sectorNumber = 3; // Décalé de 6 crans anti-horaire depuis 1
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  key="mars-level2"
                  className="seti-planet"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '30px',
                    height: '30px',
                    zIndex: 35,
                    cursor: 'pointer',
                    pointerEvents: 'auto', // Permettre les événements malgré le parent avec pointerEvents: 'none'
                  }}
                  title="Mars"
                  onMouseEnter={() => setHoveredPlanet('mars')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #cd5c5c, #8b3a3a)',
                      border: '2px solid #d87070',
                      boxShadow: '0 0 8px rgba(205, 92, 92, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}

            {/* Nuage d'astéroïdes en B7 (décalé de 6 crans anti-horaire depuis B5) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 1; // B
              const sectorNumber = 7; // Décalé de 6 crans anti-horaire depuis 5
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 12;
              const baseDistance = 12;

              return (
                <div
                  key="asteroid-b5-level2"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '32px',
                    height: '32px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 7) * (120 / 7) - 60;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * (4 / 3) - 2;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 4 + (i % 5) * (8 / 5);

                    return (
                      <div
                        key={`particle-b5-level2-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

            {/* Nuage d'astéroïdes en A8 (décalé de 6 crans anti-horaire depuis A6) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 8; // Décalé de 6 crans anti-horaire depuis 6
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 8;
              const baseDistance = 8;

              return (
                <div
                  key="asteroid-a6-level2"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '24px',
                    height: '24px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 5) * 15 - 30;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * 1.5 - 1.5;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 3 + (i % 3);

                    return (
                      <div
                        key={`particle-a6-level2-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 2px rgba(170, 170, 170, 0.5)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

            {/* Nuage d'astéroïdes en A2 (décalé de 6 crans anti-horaire depuis A8) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 2; // Décalé de 6 crans anti-horaire depuis 8
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const objectRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * objectRadius;
              const y = Math.sin(radian) * objectRadius;
              const particleCount = 8;
              const baseDistance = 8;

              return (
                <div
                  key="asteroid-a8-level2"
                  className="seti-celestial-object"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '24px',
                    height: '24px',
                    zIndex: 30,
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: particleCount }).map((_, i) => {
                    const baseAngle = (360 / particleCount) * i;
                    const angleVariation = (i % 5) * 15 - 30;
                    const angle = baseAngle + angleVariation;
                    const distanceVariation = (i % 3) * 1.5 - 1.5;
                    const distance = baseDistance + distanceVariation;
                    const rad = angle * (Math.PI / 180);
                    const px = Math.cos(rad) * distance;
                    const py = Math.sin(rad) * distance;
                    const size = 3 + (i % 3);

                    return (
                      <div
                        key={`particle-a8-level2-${i}`}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                          width: `${size}px`,
                          height: `${size}px`,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #aaa, #666)',
                          boxShadow: '0 0 2px rgba(170, 170, 170, 0.5)',
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}

          </div>

          {/* Plateau rotatif niveau 3 avec 1 disque (A) - se superpose au niveau 2 */}
          <div
            className="seti-rotating-overlay seti-rotating-level-3"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              // Rotation totale : niveau 3 tourne avec les niveaux 1 et 2
              transform: `translate(-50%, -50%) rotate(${rotationAngle1 + rotationAngle2 + rotationAngle3}deg)`, // Rotation dynamique
              width: '100%', // Couvre uniquement le disque A (jusqu'à 12% du rayon = 24% du diamètre)
              height: '100%',
              borderRadius: '50%',
              zIndex: 27, // Au-dessus du niveau 2 (z-index 26)
              overflow: 'hidden',
              aspectRatio: '1', // Force un cercle parfait
              pointerEvents: 'none', // Ne pas intercepter les événements, sauf sur les objets célestes
              border: '3px solid #4a9eff', // Bordure bleue pour mettre en surbrillance le contour
              boxShadow: '0 0 10px rgba(74, 158, 255, 0.6)', // Ombre bleue pour plus de visibilité
            }}
          >
            {/* Disque A (intérieur) - 8 secteurs */}
            {Array.from({ length: 8 }).map((_, sectorIndex) => {
              // Conversion index → secteur absolu
              const absoluteSector = indexToSector[sectorIndex];
              // Convertir en secteur relatif au plateau niveau 3 (rotation inverse)
              // Rotation totale niveau 3 = level1Angle + level2Angle + level3Angle
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const relativeSector = absoluteToRelativeSector(absoluteSector, -totalRotation3);
              // Zones creuses en A : A2, A6, A7 (secteurs relatifs au plateau)
              const isHollow = [2, 6, 7].includes(relativeSector);
              const sectorNumber = absoluteSector; // Pour la clé et le debug
              
              const diskIndex = 0; // A
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius; // 4% (bord du soleil)
              const outerRadius = sunRadius + diskWidth; // 12%
              
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              
              // Le conteneur fait 100% de la taille totale, comme les autres plateaux
              // Le disque A va de 4% à 12% du rayon total
              const innerRadiusPx = (innerRadius / 100) * 200; // 4/100 * 200 = 8
              const outerRadiusPx = (outerRadius / 100) * 200; // 12/100 * 200 = 24
              
              const innerStartX = 100 + Math.cos(sectorStartAngle * Math.PI / 180) * innerRadiusPx;
              const innerStartY = 100 + Math.sin(sectorStartAngle * Math.PI / 180) * innerRadiusPx;
              const innerEndX = 100 + Math.cos(sectorEndAngle * Math.PI / 180) * innerRadiusPx;
              const innerEndY = 100 + Math.sin(sectorEndAngle * Math.PI / 180) * innerRadiusPx;
              const outerStartX = 100 + Math.cos(sectorStartAngle * Math.PI / 180) * outerRadiusPx;
              const outerStartY = 100 + Math.sin(sectorStartAngle * Math.PI / 180) * outerRadiusPx;
              const outerEndX = 100 + Math.cos(sectorEndAngle * Math.PI / 180) * outerRadiusPx;
              const outerEndY = 100 + Math.sin(sectorEndAngle * Math.PI / 180) * outerRadiusPx;
              
              const largeArcFlag = (sectorEndAngle - sectorStartAngle) > 180 ? 1 : 0;
              
              if (isHollow) return null;
              
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
                    zIndex: 28, // Sous les objets célestes mais au-dessus du conteneur
                  }}
                  viewBox="0 0 200 200"
                >
                  <path
                    d={`M ${innerStartX} ${innerStartY} A ${innerRadiusPx} ${innerRadiusPx} 0 ${largeArcFlag} 1 ${innerEndX} ${innerEndY} L ${outerEndX} ${outerEndY} A ${outerRadiusPx} ${outerRadiusPx} 0 ${largeArcFlag} 0 ${outerStartX} ${outerStartY} Z`}
                    fill="rgba(60, 100, 160, 0.8)" // Plus clair pour la surbrillance
                    stroke="rgba(74, 158, 255, 0.8)" // Bordure bleue pour correspondre au contour
                    strokeWidth="1.5" // Bordure plus épaisse
                    style={{ filter: 'drop-shadow(0 0 3px rgba(74, 158, 255, 0.5))' }} // Effet de glow bleu
                  />
                </svg>
              );
            })}

            {/* Terre en A1 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 1;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  key="earth-level3"
                  className="seti-planet"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '32px',
                    height: '32px',
                    zIndex: 36, // Au-dessus du plateau niveau 3
                    cursor: 'pointer',
                    pointerEvents: 'auto', // Permettre les événements malgré le parent avec pointerEvents: 'none'
                  }}
                  title="Terre"
                  onMouseEnter={() => setHoveredPlanet('earth')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #4a90e2, #2e5c8a)',
                      border: '2px solid #5ba3f5',
                      boxShadow: '0 0 8px rgba(74, 144, 226, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}

            {/* Vénus en A3 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 3;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  key="venus-level3"
                  className="seti-planet"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '30px',
                    height: '30px',
                    zIndex: 36, // Au-dessus du plateau niveau 3
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                  title="Vénus"
                  onMouseEnter={() => setHoveredPlanet('venus')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #ffc649, #ff8c00)',
                      border: '2px solid #ffd700',
                      boxShadow: '0 0 8px rgba(255, 198, 73, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}

            {/* Mercure en A5 */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 0; // A
              const sectorNumber = 5;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
              const x = Math.cos(radian) * planetRadius;
              const y = Math.sin(radian) * planetRadius;

              return (
                <div
                  key="mercury-level3"
                  className="seti-planet"
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}%)`,
                    left: `calc(50% + ${x}%)`,
                    transform: 'translate(-50%, -50%)',
                    width: '26px',
                    height: '26px',
                    zIndex: 36, // Au-dessus du plateau niveau 3
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                  title="Mercure"
                  onMouseEnter={() => setHoveredPlanet('mercury')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #8c7853, #5a4a35)',
                      border: '2px solid #a09070',
                      boxShadow: '0 0 8px rgba(140, 120, 83, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}

          </div>

          {/* Conteneur fixe pour les tooltips des planètes rotatives */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100 }}>
            {/* Tooltip Saturne (niveau 1) */}
            {(() => {
              const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
              const diskIndex = 2; // C
              const sectorNumber = 3;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation du plateau niveau 1
              const rotatedAngle = sectorCenterAngle + rotationAngle1;
              const radian = (rotatedAngle + 90) * (Math.PI / 180);
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
              const sectorNumber = 7;
              const sectorIndex = sectorToIndex[sectorNumber];
              const diskWidth = 8;
              const sunRadius = 4;
              const innerRadius = sunRadius + (diskIndex * diskWidth);
              const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
              const planetRadius = (innerRadius + outerRadius) / 2;
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation du plateau niveau 1
              const rotatedAngle = sectorCenterAngle + rotationAngle1;
              const radian = (rotatedAngle + 90) * (Math.PI / 180);
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
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation du plateau niveau 2
              const rotatedAngle = sectorCenterAngle + rotationAngle2;
              const radian = (rotatedAngle + 90) * (Math.PI / 180);
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
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation totale du plateau niveau 3 (tourne avec niveaux 1 et 2)
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const rotatedAngle = sectorCenterAngle + totalRotation3;
              const radian = (rotatedAngle + 90) * (Math.PI / 180);
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
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation totale du plateau niveau 3 (tourne avec niveaux 1 et 2)
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const rotatedAngle = sectorCenterAngle + totalRotation3;
              const radian = (rotatedAngle + 90) * (Math.PI / 180);
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
              const sectorStartAngle = (360 / 8) * sectorIndex - 90;
              const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
              const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
              // Appliquer la rotation totale du plateau niveau 3 (tourne avec niveaux 1 et 2)
              const totalRotation3 = rotationAngle1 + rotationAngle2 + rotationAngle3;
              const rotatedAngle = sectorCenterAngle + totalRotation3;
              const radian = (rotatedAngle + 90) * (Math.PI / 180);
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
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
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
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
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
            const sectorAngle = (360 / 8) * sectorIndex - 90; // -90 pour commencer en haut
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

          {/* Labels des secteurs (1-8) en sens anti-horaire */}
          {Array.from({ length: 8 }).map((_, sectorIndex) => {
            // Angle au centre du secteur (entre début et fin)
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const labelRadius = 47; // Position à 47% du centre (juste après le cercle E)
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * labelRadius;
            const y = Math.sin(radian) * labelRadius;
            // Numéro en sens antihoraire
            const sectorNumber = ((8 - sectorIndex) % 8) + 1;
            
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

          {/* Planètes et objets célestes */}
          {/* Fonction helper pour créer un nuage de météorites */}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const baseAngle = (360 / 12) * i;
                  const angleVariation = (i % 7) * 20 - 60;
                  const angle = baseAngle + angleVariation;
                  const baseDistance = 12;
                  const distanceVariation = (i % 3) * 2 - 2;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 4 + (i % 5) * 2;
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('C', 2, 2)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const baseAngle = (360 / 12) * i;
                  const angleVariation = (i % 7) * 20 - 60;
                  const angle = baseAngle + angleVariation;
                  const baseDistance = 12;
                  const distanceVariation = (i % 3) * 2 - 2;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 4 + (i % 5) * 2;
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('C', 2, 5)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const baseAngle = (360 / 12) * i;
                  const angleVariation = (i % 7) * 20 - 60;
                  const angle = baseAngle + angleVariation;
                  const baseDistance = 12;
                  const distanceVariation = (i % 3) * 2 - 2;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 4 + (i % 5) * 2;
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('C', 2, 6)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const baseAngle = (360 / 12) * i;
                  const angleVariation = (i % 7) * 20 - 60;
                  const angle = baseAngle + angleVariation;
                  const baseDistance = 12;
                  const distanceVariation = (i % 3) * 2 - 2;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 4 + (i % 5) * 2;
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('C', 2, 8)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const baseAngle = (360 / 12) * i;
                  const angleVariation = (i % 7) * 20 - 60;
                  const angle = baseAngle + angleVariation;
                  const baseDistance = 12;
                  const distanceVariation = (i % 3) * 2 - 2;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 4 + (i % 5) * 2;
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('B', 1, 7)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const baseAngle = (360 / 12) * i;
                  const angleVariation = (i % 7) * 20 - 60;
                  const angle = baseAngle + angleVariation;
                  const baseDistance = 12;
                  const distanceVariation = (i % 3) * 2 - 2;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 4 + (i % 5) * 2;
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('B', 1, 3)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            // Nuages plus petits sur disque A
            const particleCount = 8;
            const baseDistance = 8;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '24px',
                  height: '24px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: particleCount }).map((_, i) => {
                  const baseAngle = (360 / particleCount) * i;
                  const angleVariation = (i % 5) * 15 - 30;
                  const angle = baseAngle + angleVariation;
                  const distanceVariation = (i % 3) * 1.5 - 1.5;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 3 + (i % 3);
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 2px rgba(170, 170, 170, 0.5)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('A', 0, 1)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            // Nuages plus petits sur disque A
            const particleCount = 8;
            const baseDistance = 8;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '24px',
                  height: '24px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: particleCount }).map((_, i) => {
                  const baseAngle = (360 / particleCount) * i;
                  const angleVariation = (i % 5) * 15 - 30;
                  const angle = baseAngle + angleVariation;
                  const distanceVariation = (i % 3) * 1.5 - 1.5;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 3 + (i % 3);
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('A', 0, 5)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            // Nuages plus petits sur disque A
            const particleCount = 8;
            const baseDistance = 8;
            
            return (
              <div
                key={`asteroid-cloud-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '24px',
                  height: '24px',
                  zIndex: 19,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: particleCount }).map((_, i) => {
                  const baseAngle = (360 / particleCount) * i;
                  const angleVariation = (i % 5) * 15 - 30;
                  const angle = baseAngle + angleVariation;
                  const distanceVariation = (i % 3) * 1.5 - 1.5;
                  const distance = baseDistance + distanceVariation;
                  const rad = angle * (Math.PI / 180);
                  const px = Math.cos(rad) * distance;
                  const py = Math.sin(rad) * distance;
                  const size = 3 + (i % 3);
                  
                  return (
                    <div
                      key={`particle-${diskName}${sectorNumber}-${i}`}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                        width: `${size}px`,
                        height: `${size}px`,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #aaa, #666)',
                        boxShadow: '0 0 3px rgba(170, 170, 170, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })('A', 0, 6)}

          {/* Fonction helper pour créer une comète */}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            // Conversion secteur → index selon numérotation anti-horaire (1,8,7,6,5,4,3,2)
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '60px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-30px)`,
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
          })('D', 3, 2)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            // Conversion secteur → index selon numérotation anti-horaire (1,8,7,6,5,4,3,2)
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '60px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-30px)`,
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
          })('D', 3, 4)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            // Conversion secteur → index selon numérotation anti-horaire (1,8,7,6,5,4,3,2)
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '60px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-30px)`,
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
          })('C', 2, 7)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '50px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-25px)`,
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
          })('B', 1, 8)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '50px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-25px)`,
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
          })('B', 1, 5)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '30px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-15px)`,
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
          })('A', 0, 2)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '30px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-15px)`,
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
          })('A', 0, 3)}
          {((diskName: string, diskIndex: number, sectorNumber: number) => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[sectorNumber];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth);
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
            const objectRadius = (innerRadius + outerRadius) / 2;
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * objectRadius;
            const y = Math.sin(radian) * objectRadius;
            const tailAngle = sectorCenterAngle + 180;
            
            return (
              <div
                key={`comet-${diskName}${sectorNumber}`}
                className="seti-celestial-object"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  zIndex: 20,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg)`,
                    width: '30px',
                    height: '10px',
                    background: 'linear-gradient(to right, rgba(200, 220, 255, 0.9), rgba(200, 220, 255, 0.6), rgba(200, 220, 255, 0.3), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${tailAngle}deg) translateX(-15px)`,
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
          })('A', 0, 8)}

          {/* Uranus en D1 */}
          {(() => {
            const diskIndex = 3; // D (A=0, B=1, C=2, D=3, E=4)
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[1];
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth); // 28%
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 36%
            const planetRadius = (innerRadius + outerRadius) / 2; // 32% - milieu du disque D
            // Angle au centre du secteur 1
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * planetRadius;
            const y = Math.sin(radian) * planetRadius;
            
            return (
              <div
                key="uranus"
                className="seti-planet"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #4fd0e7, #1e88a8)',
                  border: '2px solid #7dd3fc',
                  boxShadow: '0 0 8px rgba(79, 208, 231, 0.6)',
                  zIndex: 30,
                  cursor: 'pointer',
                }}
                title="Uranus"
              >
                <div 
                  className="seti-planet-tooltip"
                  style={{
                    transform: 'translateX(-50%)', // Translation pour centrer le tooltip
                    transformOrigin: 'center bottom', // Point d'ancrage (bas du tooltip)
                  }}
                >
                  Uranus
                </div>
              </div>
            );
          })()}

          {/* Neptune en D6 */}
          {(() => {
            const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
            const sectorIndex = sectorToIndex[6];
            const diskIndex = 3; // D (A=0, B=1, C=2, D=3, E=4)
            const diskWidth = 8;
            const sunRadius = 4;
            const innerRadius = sunRadius + (diskIndex * diskWidth); // 28%
            const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth); // 36%
            const planetRadius = (innerRadius + outerRadius) / 2; // 32% - milieu du disque D
            // Angle au centre du secteur 6
            const sectorStartAngle = (360 / 8) * sectorIndex - 90;
            const sectorEndAngle = (360 / 8) * (sectorIndex + 1) - 90;
            const sectorCenterAngle = (sectorStartAngle + sectorEndAngle) / 2;
            const radian = (sectorCenterAngle + 90) * (Math.PI / 180);
            const x = Math.cos(radian) * planetRadius;
            const y = Math.sin(radian) * planetRadius;
            
            return (
              <div
                key="neptune"
                className="seti-planet"
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `calc(50% + ${x}%)`,
                  transform: 'translate(-50%, -50%)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #4166f5, #1e3a8a)',
                  border: '2px solid #60a5fa',
                  boxShadow: '0 0 8px rgba(65, 102, 245, 0.6)',
                  zIndex: 30,
                  cursor: 'pointer',
                }}
                title="Neptune"
              >
                <div 
                  className="seti-planet-tooltip"
                  style={{
                    transform: 'translateX(-50%)', // Translation pour centrer le tooltip
                    transformOrigin: 'center bottom', // Point d'ancrage (bas du tooltip)
                  }}
                >
                  Neptune
                </div>
              </div>
            );
          })()}

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
                {/* Label du disque */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: `calc(50% + ${(innerRadius + outerRadius) / 2}%)`,
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
    </div>
  );
});

SolarSystemBoard.displayName = 'SolarSystemBoard';
