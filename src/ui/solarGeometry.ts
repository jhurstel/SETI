import { CelestialObject, DiskName, DISK_NAMES, SectorNumber } from '../core/types';
import { INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, sectorToIndex } from '../core/SolarSystemPosition';

/**
 * Géométrie du dessin du système solaire (coordonnées SVG, arcs, aspect des secteurs des anneaux).
 * Sert seulement à l'affichage : les règles (positions, rotations, déplacements) sont dans core/SolarSystemPosition.
 */

// Fonction helper pour calculer la position d'un objet céleste
// Les secteurs sont rendus avec un offset de -90° pour commencer à 12h
export function calculateObjectPosition(disk: DiskName, sector: SectorNumber, rotationAngle: number = 0) {
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
  return { x, y, sectorCenterAngle, diskIndex }
}

export function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  }
}

export function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number, reverse: boolean = false) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";

  if (reverse) {
    // Sens anti-horaire (Start -> End) pour le texte du bas
    return ["M", end.x, end.y, "A", radius, radius, 0, largeArcFlag, 0, start.x, start.y].join(" ");
  }

  // Sens horaire (End -> Start) pour le texte du haut
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y].join(" ");
}

// Fonction helper pour déterminer le type de secteur (normal, hollow, empty) pour tous les niveaux
export function getSectorType(level: number, disk: DiskName, relativeSector: SectorNumber): 'normal' | 'hollow' | 'empty' {
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
}
