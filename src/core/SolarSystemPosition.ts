/**
 * Module de gestion des positions et de la visibilité dans le système solaire
 * Gère le calcul des positions absolues, la visibilité des objets, et le calcul de trajectoires
 */

import { DiskName, SectorNumber } from './types';

/**
 * Position d'un objet céleste
 */
export interface CelestialPosition {
  disk: DiskName; // A, B, C, D, ou E
  sector: SectorNumber; // 1 à 8
  x: number; // Position X en pourcentage (0-100)
  y: number; // Position Y en pourcentage (0-100)
}

/**
 * Position absolue d'un objet après toutes les rotations
 */
export interface AbsolutePosition {
  disk: DiskName;
  sector: SectorNumber;
  absoluteSector: SectorNumber; // Secteur absolu après rotation
  x: number;
  y: number;
  isVisible: boolean; // Si l'objet est visible (pas recouvert par un plateau opaque)
}

/**
 * Configuration des rotations des plateaux
 */
export interface RotationState {
  level1Angle: number; // Angle de rotation du plateau niveau 1 (en degrés)
  level2Angle: number; // Angle de rotation du plateau niveau 2 (en degrés)
  level3Angle: number; // Angle de rotation du plateau niveau 3 (en degrés)
}

/**
 * Type d'objet céleste
 */
export type CelestialObjectType = 'planet' | 'comet' | 'asteroid' | 'hollow' | 'empty';

/**
 * Objet céleste avec sa position relative
 */
export interface CelestialObject {
  id: string;
  type: CelestialObjectType;
  name: string;
  position: CelestialPosition;
  level?: 0 | 1 | 2 | 3; // Niveau du plateau (0 = fixe, 1-3 = rotatif)
}

/**
 * Case du système solaire
 */
export interface SolarSystemCell {
  disk: DiskName;
  sector: SectorNumber;
  hasAsteroid: boolean; // Contient un champ d'astéroïdes
  hasComet: boolean; // Contient une comète
  hasPlanet: boolean; // Contient une planète
  planetName?: string; // Nom de la planète si présente
  isVisible: boolean; // Si la case est visible (pas recouverte)
}

/**
 * Configuration des creux (zones transparentes) des plateaux rotatifs
 */
const HOLLOW_ZONES = {
  level1: {
    A: [4, 5], // Secteurs creux pour le disque A du niveau 1
    B: [2, 5, 7], // Secteurs creux pour le disque B du niveau 1
    C: [2, 3, 7, 8], // Secteurs creux pour le disque C du niveau 1
  },
  level2: {
    A: [2, 3, 4], // Secteurs creux pour le disque A du niveau 2
    B: [2, 3, 4, 7, 8], // Secteurs creux pour le disque B du niveau 2
  },
  level3: {
    A: [3, 7, 8], // Secteurs creux pour le disque A du niveau 3
  },
};

/**
 * Configuration des objets célestes fixes (niveau 0)
 */
export const FIXED_OBJECTS: CelestialObject[] = [
  { id: 'neptune', type: 'planet', name: 'Neptune', position: { disk: 'D', sector: 3, x: 0, y: 0 }, level: 0 },
  { id: 'uranus', type: 'planet', name: 'Uranus', position: { disk: 'D', sector: 6, x: 0, y: 0 }, level: 0 },
  // Comètes fixes
  { id: 'comet-d1', type: 'comet', name: 'Comète', position: { disk: 'D', sector: 1, x: 0, y: 0 }, level: 0 },
  { id: 'comet-d7', type: 'comet', name: 'Comète', position: { disk: 'D', sector: 7, x: 0, y: 0 }, level: 0 },
  { id: 'comet-c4', type: 'comet', name: 'Comète', position: { disk: 'C', sector: 4, x: 0, y: 0 }, level: 0 },
  { id: 'comet-b2', type: 'comet', name: 'Comète', position: { disk: 'B', sector: 2, x: 0, y: 0 }, level: 0 },
  { id: 'comet-b5', type: 'comet', name: 'Comète', position: { disk: 'B', sector: 5, x: 0, y: 0 }, level: 0 },
  { id: 'comet-a5', type: 'comet', name: 'Comète', position: { disk: 'A', sector: 5, x: 0, y: 0 }, level: 0 },
  { id: 'comet-a7', type: 'comet', name: 'Comète', position: { disk: 'A', sector: 7, x: 0, y: 0 }, level: 0 },
  { id: 'comet-a8', type: 'comet', name: 'Comète', position: { disk: 'A', sector: 8, x: 0, y: 0 }, level: 0 },
  // Nuages d'astéroïdes fixes
  { id: 'asteroid-c2', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'C', sector: 2, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-c3', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'C', sector: 3, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-c5', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'C', sector: 5, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-c7', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'C', sector: 7, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-b4', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'B', sector: 4, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-b8', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'B', sector: 8, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-a2', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 2, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-a3', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 3, x: 0, y: 0 }, level: 0 },
  { id: 'asteroid-a6', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 6, x: 0, y: 0 }, level: 0 },
];

/**
 * Configuration initiale des objets célestes rotatifs (niveau 1)
 */
export const INITIAL_ROTATING_LEVEL1_OBJECTS: CelestialObject[] = [
  { id: 'saturn', type: 'planet', name: 'Saturne', position: { disk: 'C', sector: 1, x: 0, y: 0 }, level: 1 },
  { id: 'jupiter', type: 'planet', name: 'Jupiter', position: { disk: 'C', sector: 5, x: 0, y: 0 }, level: 1 },
  { id: 'comet-b8-l1', type: 'comet', name: 'Comète', position: { disk: 'B', sector: 8, x: 0, y: 0 }, level: 1 },
  { id: 'comet-a7-l1', type: 'comet', name: 'Comète', position: { disk: 'A', sector: 7, x: 0, y: 0 }, level: 1 },
  { id: 'asteroid-b1-l1', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'B', sector: 1, x: 0, y: 0 }, level: 1 },
  { id: 'asteroid-b4-l1', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'B', sector: 4, x: 0, y: 0 }, level: 1 },
  { id: 'asteroid-a1-l1', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 1, x: 0, y: 0 }, level: 1 },
  { id: 'asteroid-a2-l1', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 2, x: 0, y: 0 }, level: 1 },
  { id: 'asteroid-a6-l1', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 6, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-c2-l1', type: 'hollow', name: 'Creux C2', position: { disk: 'C', sector: 2, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-c3-l1', type: 'hollow', name: 'Creux C3', position: { disk: 'C', sector: 3, x: 0, y: 0 }, level: 1 },
  { id: 'empty-c4-l1', type: 'empty', name: 'Vide C5', position: { disk: 'C', sector: 5, x: 0, y: 0 }, level: 1 },
  { id: 'empty-c6-l1', type: 'empty', name: 'Vide C6', position: { disk: 'C', sector: 6, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-c7-l1', type: 'hollow', name: 'Creux C7', position: { disk: 'C', sector: 7, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-c8-l1', type: 'hollow', name: 'Creux C8', position: { disk: 'C', sector: 8, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-b2-l1', type: 'hollow', name: 'Creux B2', position: { disk: 'B', sector: 2, x: 0, y: 0 }, level: 1 },
  { id: 'empty-b3-l1', type: 'empty', name: 'Vide B3', position: { disk: 'B', sector: 3, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-b5-l1', type: 'hollow', name: 'Creux B5', position: { disk: 'B', sector: 5, x: 0, y: 0 }, level: 1 },
  { id: 'empty-b6-l1', type: 'empty', name: 'Vide B6', position: { disk: 'B', sector: 6, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-b7-l1', type: 'hollow', name: 'Creux B7', position: { disk: 'B', sector: 7, x: 0, y: 0 }, level: 1 },
  { id: 'empty-a3-l1', type: 'empty', name: 'Vide A3', position: { disk: 'A', sector: 3, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-a4-l1', type: 'hollow', name: 'Creux A4', position: { disk: 'A', sector: 4, x: 0, y: 0 }, level: 1 },
  { id: 'hollow-a5-l1', type: 'hollow', name: 'Creux A5', position: { disk: 'A', sector: 5, x: 0, y: 0 }, level: 1 },
  { id: 'empty-a8-l1', type: 'empty', name: 'Vide A8', position: { disk: 'A', sector: 8, x: 0, y: 0 }, level: 1 },
];

/**
 * Configuration initiale des objets célestes rotatifs (niveau 2)
 */
export const INITIAL_ROTATING_LEVEL2_OBJECTS: CelestialObject[] = [
  { id: 'mars', type: 'planet', name: 'Mars', position: { disk: 'B', sector: 1, x: 0, y: 0 }, level: 2 },
  { id: 'asteroid-b5-l2', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'B', sector: 5, x: 0, y: 0 }, level: 2 },
  { id: 'asteroid-a6-l2', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 6, x: 0, y: 0 }, level: 2 },
  { id: 'asteroid-a8-l2', type: 'asteroid', name: 'Astéroïdes', position: { disk: 'A', sector: 8, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-b2-l2', type: 'hollow', name: 'Creux B2', position: { disk: 'B', sector: 2, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-b3-l2', type: 'hollow', name: 'Creux B3', position: { disk: 'B', sector: 3, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-b4-l2', type: 'hollow', name: 'Creux B4', position: { disk: 'B', sector: 4, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-b7-l2', type: 'hollow', name: 'Creux B7', position: { disk: 'B', sector: 7, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-b8-l2', type: 'hollow', name: 'Creux B8', position: { disk: 'B', sector: 8, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-a2-l2', type: 'hollow', name: 'Creux A2', position: { disk: 'A', sector: 2, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-a3-l2', type: 'hollow', name: 'Creux A3', position: { disk: 'A', sector: 3, x: 0, y: 0 }, level: 2 },
  { id: 'hollow-a4-l2', type: 'hollow', name: 'Creux A4', position: { disk: 'A', sector: 4, x: 0, y: 0 }, level: 2 },
  { id: 'empty-b6-l2', type: 'empty', name: 'Vide B6', position: { disk: 'B', sector: 6, x: 0, y: 0 }, level: 2 },
  { id: 'empty-a1-l2', type: 'empty', name: 'Vide A1', position: { disk: 'A', sector: 1, x: 0, y: 0 }, level: 2 },
  { id: 'empty-a5-l2', type: 'empty', name: 'Vide A5', position: { disk: 'A', sector: 5, x: 0, y: 0 }, level: 2 },
  { id: 'empty-a7-l2', type: 'empty', name: 'Vide A7', position: { disk: 'A', sector: 7, x: 0, y: 0 }, level: 2 },
];

/**
 * Configuration initiale des objets célestes rotatifs (niveau 3)
 */
export const INITIAL_ROTATING_LEVEL3_OBJECTS: CelestialObject[] = [
  { id: 'empty-a1-l3', type: 'empty', name: 'Vide A1', position: { disk: 'A', sector: 1, x: 0, y: 0 }, level: 3 },
  { id: 'earth', type: 'planet', name: 'Terre', position: { disk: 'A', sector: 2, x: 0, y: 0 }, level: 3 },
  { id: 'hollow-a3-l3', type: 'hollow', name: 'Creux A3', position: { disk: 'A', sector: 3, x: 0, y: 0 }, level: 3 },
  { id: 'venus', type: 'planet', name: 'Vénus', position: { disk: 'A', sector: 4, x: 0, y: 0 }, level: 3 },
  { id: 'empty-a5-l3', type: 'empty', name: 'Vide A5', position: { disk: 'A', sector: 5, x: 0, y: 0 }, level: 3 },
  { id: 'mercury', type: 'planet', name: 'Mercure', position: { disk: 'A', sector: 6, x: 0, y: 0 }, level: 3 },
  { id: 'hollow-a7-l3', type: 'hollow', name: 'Creux A7', position: { disk: 'A', sector: 7, x: 0, y: 0 }, level: 3 },
  { id: 'hollow-a8-l3', type: 'hollow', name: 'Creux A8', position: { disk: 'A', sector: 8, x: 0, y: 0 }, level: 3 },
];

/**
 * Crée un RotationState à partir des angles de rotation du composant React
 */
export function createRotationState(
  level1Angle: number,
  level2Angle: number,
  level3Angle: number
): RotationState {
  return {
    level1Angle,
    level2Angle,
    level3Angle,
  };
}

/**
 * Obtient tous les objets célestes (fixes et rotatifs)
 */
export function getAllCelestialObjects(): CelestialObject[] {
  return [
    ...FIXED_OBJECTS,
    ...INITIAL_ROTATING_LEVEL1_OBJECTS,
    ...INITIAL_ROTATING_LEVEL2_OBJECTS,
    ...INITIAL_ROTATING_LEVEL3_OBJECTS,
  ];
}

/**
 * Convertit un secteur relatif en secteur absolu après rotation
 * @param relativeSector Secteur relatif (1-8)
 * @param rotationAngle Angle de rotation en degrés (négatif = anti-horaire)
 * @returns Secteur absolu (1-8)
 */
function rotateSector(relativeSector: SectorNumber, rotationAngle: number): SectorNumber {
  // Conversion secteur -> index (sens trigonométrique/anti-horaire: 1=0, 2=1, 3=2, 4=3, 5=4, 6=5, 7=6, 8=7)
  // Secteur 1 = 0° (en haut), secteur 2 = 45°, secteur 3 = 90°, etc. dans le sens anti-horaire
  const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
  const indexToSector: { [key: number]: SectorNumber } = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 };
  
  const sectorIndex = sectorToIndex[relativeSector];
  // Convertir l'angle en nombre de secteurs (45° par secteur, rotation anti-horaire = négative)
  // L'angle est en degrés, négatif pour rotation anti-horaire
  const sectorsRotated = Math.round(rotationAngle / 45);
  // Calculer le nouvel index en tenant compte de la rotation
  // On soustrait car rotation anti-horaire décrémente l'index
  const newIndex = (sectorIndex - sectorsRotated + 8) % 8;
  return indexToSector[newIndex];
}

/**
 * Calcule la position absolue d'un objet céleste après toutes les rotations
 */
export function calculateAbsolutePosition(
  object: CelestialObject,
  rotationState: RotationState
): AbsolutePosition {
  let absoluteSector = object.position.sector;
  
  // Appliquer les rotations selon le niveau
  if (object.level === 1) {
    absoluteSector = rotateSector(absoluteSector, rotationState.level1Angle);
  } else if (object.level === 2) {
    // Le niveau 2 tourne avec le niveau 1
    absoluteSector = rotateSector(absoluteSector, rotationState.level2Angle);
  } else if (object.level === 3) {
    // Le niveau 3 tourne avec le niveau 1 et le niveau 2
    absoluteSector = rotateSector(absoluteSector, rotationState.level3Angle);
  }
  // Niveau 0 (fixe) : pas de rotation
  
  // Calculer les coordonnées X et Y (sera calculé plus tard si nécessaire)
  const x = 0; // TODO: Calculer en fonction du disque et du secteur
  const y = 0; // TODO: Calculer en fonction du disque et du secteur
  
  // Vérifier la visibilité
  const isVisible = checkVisibility(object.position.disk, absoluteSector, rotationState);
  
  return {
    disk: object.position.disk,
    sector: object.position.sector,
    absoluteSector,
    x,
    y,
    isVisible,
  };
}

/**
 * Vérifie si une case est visible (pas recouverte par un plateau opaque)
 */
function checkVisibility(
  disk: DiskName,
  absoluteSector: SectorNumber,
  rotationState: RotationState
): boolean {
  // Les disques D et E sont toujours visibles (pas de plateau rotatif au-dessus)
  if (disk === 'D' || disk === 'E') {
    return true;
  }
  
  // Pour les disques A, B, C, vérifier les plateaux rotatifs
  // Un disque est visible si au moins un plateau rotatif a un creux à cet emplacement
  
  // Niveau 3 (disque A uniquement)
  if (disk === 'A') {
    const level3Sector = rotateSector(absoluteSector, -(rotationState.level1Angle + rotationState.level2Angle + rotationState.level3Angle));
    if (!HOLLOW_ZONES.level3.A.includes(level3Sector)) {
      return false; // Recouvert par le niveau 3
    }
  }
  
  // Niveau 2 (disques A et B)
  if (disk === 'A' || disk === 'B') {
    const level2Sector = rotateSector(absoluteSector, -(rotationState.level1Angle + rotationState.level2Angle));
    const hollowZones = HOLLOW_ZONES.level2[disk];
    if (hollowZones && !hollowZones.includes(level2Sector)) {
      return false; // Recouvert par le niveau 2
    }
  }
  
  // Niveau 1 (disques A, B, C)
  if (disk === 'A' || disk === 'B' || disk === 'C') {
    const level1Sector = rotateSector(absoluteSector, -rotationState.level1Angle);
    const hollowZones = HOLLOW_ZONES.level1[disk];
    if (hollowZones && !hollowZones.includes(level1Sector)) {
      return false; // Recouvert par le niveau 1
    }
  }
  
  return true;
}

/**
 * Obtient toutes les positions absolues de tous les objets célestes
 */
export function getAllAbsolutePositions(rotationState: RotationState): Map<string, AbsolutePosition> {
  const positions = new Map<string, AbsolutePosition>();
  
  // Objets fixes
  FIXED_OBJECTS.forEach(obj => {
    positions.set(obj.id, calculateAbsolutePosition(obj, rotationState));
  });
  
  // Objets rotatifs niveau 1
  INITIAL_ROTATING_LEVEL1_OBJECTS.forEach(obj => {
    positions.set(obj.id, calculateAbsolutePosition(obj, rotationState));
  });
  
  // Objets rotatifs niveau 2
  INITIAL_ROTATING_LEVEL2_OBJECTS.forEach(obj => {
    positions.set(obj.id, calculateAbsolutePosition(obj, rotationState));
  });
  
  // Objets rotatifs niveau 3
  INITIAL_ROTATING_LEVEL3_OBJECTS.forEach(obj => {
    positions.set(obj.id, calculateAbsolutePosition(obj, rotationState));
  });
  
  return positions;
}

/**
 * Obtient toutes les cases du système solaire avec leur état
 */
export function getAllCells(rotationState: RotationState): Map<string, SolarSystemCell> {
  const cells = new Map<string, SolarSystemCell>();
  const positions = getAllAbsolutePositions(rotationState);
  
  // Parcourir tous les disques et secteurs
  const disks: DiskName[] = ['A', 'B', 'C', 'D', 'E'];
  const sectors: SectorNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];
  
  disks.forEach(disk => {
    sectors.forEach(sector => {
      const cellKey = `${disk}${sector}`;
      const cell: SolarSystemCell = {
        disk,
        sector,
        hasAsteroid: false,
        hasComet: false,
        hasPlanet: false,
        isVisible: checkVisibility(disk, sector, rotationState),
      };
      
      // Vérifier quels objets sont sur cette case
      positions.forEach((pos, objId) => {
        if (pos.disk === disk && pos.absoluteSector === sector && pos.isVisible) {
          const obj = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS]
            .find(o => o.id === objId);
          
          if (obj) {
            if (obj.type === 'planet') {
              cell.hasPlanet = true;
              cell.planetName = obj.name;
            } else if (obj.type === 'comet') {
              cell.hasComet = true;
            } else if (obj.type === 'asteroid') {
              cell.hasAsteroid = true;
            }
          }
        }
      });
      
      cells.set(cellKey, cell);
    });
  });
  
  return cells;
}

/**
 * Convertit l'énergie en déplacements (1 énergie = 1 déplacement)
 */
export function energyToMovements(energy: number): number {
  return energy;
}

/**
 * Calcule toutes les cases accessibles avec les déplacements et l'énergie disponibles
 * @param startDisk Disque de départ
 * @param startSector Secteur de départ
 * @param movements Nombre de déplacements disponibles
 * @param energy Énergie disponible (sera convertie en déplacements)
 * @param rotationState État actuel des rotations des plateaux
 * @returns Map des cases accessibles avec le nombre de déplacements nécessaires et le chemin
 */
export function calculateReachableCellsWithEnergy(
  startDisk: DiskName,
  startSector: SectorNumber,
  movements: number,
  energy: number,
  rotationState: RotationState
): Map<string, { movements: number; path: string[] }> {
  const totalMovements = movements + energyToMovements(energy);
  return calculateReachableCells(startDisk, startSector, totalMovements, rotationState);
}

/**
 * Calcule toutes les cases accessibles à partir d'une case initiale avec un nombre de déplacements
 * @param startDisk Disque de départ
 * @param startSector Secteur de départ
 * @param maxMovements Nombre maximum de déplacements disponibles (peut inclure l'énergie convertie)
 * @param rotationState État actuel des rotations des plateaux
 * @returns Map des cases accessibles avec le nombre de déplacements nécessaires et le chemin
 */
export function calculateReachableCells(
  startDisk: DiskName,
  startSector: SectorNumber,
  maxMovements: number,
  rotationState: RotationState
): Map<string, { movements: number; path: string[] }> {
  const reachable = new Map<string, { movements: number; path: string[] }>();
  const cells = getAllCells(rotationState);
  
  // File d'attente pour le parcours en largeur (BFS)
  const queue: Array<{ disk: DiskName; sector: SectorNumber; movements: number; path: string[] }> = [];
  queue.push({ disk: startDisk, sector: startSector, movements: 0, path: [`${startDisk}${startSector}`] });
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.disk}${current.sector}`;
    
    // Si on a déjà visité cette case avec moins de déplacements, on ignore
    const existing = reachable.get(currentKey);
    if (existing && existing.movements <= current.movements) {
      continue;
    }
    
    // Enregistrer cette case
    reachable.set(currentKey, { movements: current.movements, path: [...current.path] });
    
    // Si on a atteint le maximum de déplacements, on ne continue pas
    if (current.movements >= maxMovements) {
      continue;
    }
    
    // Obtenir la case actuelle
    const currentCell = cells.get(currentKey);
    if (!currentCell) {
      continue;
    }
    
    // Trouver les cases adjacentes (même disque, secteurs adjacents, ou disques adjacents)
    const adjacentCells = getAdjacentCells(current.disk, current.sector, cells);
    
    adjacentCells.forEach(adj => {
      const adjKey = `${adj.disk}${adj.sector}`;
      const adjCell = cells.get(adjKey);
      
      if (!adjCell) {
        return;
      }
      
      // Calculer le coût pour atteindre cette case
      let cost = 1; // Coût de base pour une case adjacente
      
      // Si on sort d'un champ d'astéroïdes, coût supplémentaire
      if (currentCell.hasAsteroid) {
        cost += 1; // Total = 2 pour sortir d'un champ d'astéroïdes
      }
      
      const newMovements = current.movements + cost;
      
      if (newMovements <= maxMovements) {
        // Vérifier si on n'a pas déjà visité avec moins de déplacements
        const existing = reachable.get(adjKey);
        if (!existing || existing.movements > newMovements) {
          queue.push({
            disk: adj.disk,
            sector: adj.sector,
            movements: newMovements,
            path: [...current.path, adjKey],
          });
        }
      }
    });
  }
  
  return reachable;
}

/**
 * Obtient les cases adjacentes à une case donnée
 */
function getAdjacentCells(
  disk: DiskName,
  sector: SectorNumber,
  cells: Map<string, SolarSystemCell>
): Array<{ disk: DiskName; sector: SectorNumber }> {
  const adjacent: Array<{ disk: DiskName; sector: SectorNumber }> = [];
  
  // Secteurs adjacents (même disque)
  const sectors: SectorNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];
  const sectorIndex = sectors.indexOf(sector);
  const prevSector = sectors[(sectorIndex - 1 + 8) % 8];
  const nextSector = sectors[(sectorIndex + 1) % 8];
  
  adjacent.push({ disk, sector: prevSector });
  adjacent.push({ disk, sector: nextSector });
  
  // Disques adjacents (même secteur)
  const disks: DiskName[] = ['A', 'B', 'C', 'D', 'E'];
  const diskIndex = disks.indexOf(disk);
  
  if (diskIndex > 0) {
    adjacent.push({ disk: disks[diskIndex - 1], sector });
  }
  if (diskIndex < disks.length - 1) {
    adjacent.push({ disk: disks[diskIndex + 1], sector });
  }
  
  return adjacent;
}

/**
 * Obtient la position absolue d'un objet céleste spécifique
 */
export function getObjectPosition(
  objectId: string,
  rotationState: RotationState
): AbsolutePosition | null {
  const allObjects = getAllCelestialObjects();
  const object = allObjects.find(obj => obj.id === objectId);
  
  if (!object) {
    return null;
  }
  
  return calculateAbsolutePosition(object, rotationState);
}

/**
 * Obtient tous les objets visibles sur une case spécifique
 */
export function getObjectsOnCell(
  disk: DiskName,
  sector: SectorNumber,
  rotationState: RotationState
): CelestialObject[] {
  const allObjects = getAllCelestialObjects();
  const positions = getAllAbsolutePositions(rotationState);
  const objectsOnCell: CelestialObject[] = [];
  
  positions.forEach((pos, objId) => {
    if (pos.disk === disk && pos.absoluteSector === sector && pos.isVisible) {
      const obj = allObjects.find(o => o.id === objId);
      if (obj) {
        objectsOnCell.push(obj);
      }
    }
  });
  
  return objectsOnCell;
}

/**
 * Obtient l'état d'une case spécifique
 */
export function getCell(
  disk: DiskName,
  sector: SectorNumber,
  rotationState: RotationState
): SolarSystemCell | null {
  const cells = getAllCells(rotationState);
  return cells.get(`${disk}${sector}`) || null;
}
