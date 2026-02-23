import React from 'react';
import { Game, RotationDisk, DISK_NAMES } from '../../core/types';
import { indexToSector, getSectorType, polarToCartesian } from '../../core/SolarSystemPosition';

interface RotationDiskSectorProps {
  obj: RotationDisk;
  zIndex: number;
  game: Game;
  selectedProbeId: string | null;
}

export const RotationDiskSector: React.FC<RotationDiskSectorProps> = ({ obj, zIndex, game, selectedProbeId }) => {
  // Le secteur est déjà relatif au plateau car on est dans un conteneur rotatif
  const relativeSector = indexToSector[obj.sectorIndex];

  // Vérifier si un objet supplémentaire (comme Oumuamua) occupe cet emplacement
  // Si oui, on considère le secteur comme normal (plein) même s'il était défini comme creux
  const hasExtraObject = (game.board.solarSystem.extraCelestialObjects || []).some(extra =>
    extra.level === obj.level &&
    extra.position.disk === obj.diskName &&
    extra.position.sector === relativeSector
  );

  // Déterminer le type de secteur à partir de INITIAL_ROTATING_LEVEL1_OBJECTS
  const sectorType = hasExtraObject ? 'normal' : getSectorType(obj.level, obj.diskName, relativeSector);
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
