/**
 * Système de rotation du système solaire
 * 
 * ⚠️ SYSTÈME COMPLEXE - Module isolé
 * 
 * La rotation se produit :
 * - À chaque recherche technologique
 * - Au premier Pass de la manche
 * 
 * Effets :
 * - Rotation cyclique des disques
 * - Déplacements gratuits possibles
 * - Peut générer couverture médiatique
 */

import {
  SolarSystem,
  SystemTile,
  Probe,
  Position,
  RotationDisk,
  EventType
} from '../core/types';

export class SolarSystemRotation {
  /**
   * Effectue une rotation du système solaire
   */
  static rotate(solarSystem: SolarSystem): {
    rotatedSystem: SolarSystem;
    events: Array<{ type: EventType; data: any }>;
  } {
    const events: Array<{ type: EventType; data: any }> = [];
    const rotatedSystem = { ...solarSystem };

    // Rotation cyclique des disques
    rotatedSystem.rotationDisks = rotatedSystem.rotationDisks.map(disk => {
      const newPosition = (disk.currentPosition + 1) % disk.positions.length;
      return {
        ...disk,
        currentPosition: newPosition
      };
    });

    // Mettre à jour la position de rotation globale
    rotatedSystem.currentRotation = 
      (rotatedSystem.currentRotation + 1) % 360;

    // Recalculer les positions des cases après rotation
    rotatedSystem.tiles = this.recalculateTilePositions(
      rotatedSystem.tiles,
      rotatedSystem.rotationDisks
    );

    // Déplacer les sondes selon la rotation
    const probeMovements = this.calculateProbeMovements(
      rotatedSystem.probes,
      rotatedSystem.tiles
    );

    rotatedSystem.probes = probeMovements.probes;
    
    if (probeMovements.movedProbes.length > 0) {
      events.push({
        type: EventType.SYSTEM_ROTATED,
        data: {
          probesMoved: probeMovements.movedProbes,
          newRotation: rotatedSystem.currentRotation
        }
      });
    }

    return {
      rotatedSystem,
      events
    };
  }

  /**
   * Recalcule les positions des cases après rotation
   */
  private static recalculateTilePositions(
    tiles: SystemTile[][],
    disks: RotationDisk[]
  ): SystemTile[][] {
    // TODO: Implémenter le calcul de rotation des cases
    // Basé sur la position des disques rotatifs
    // C'est ici que la complexité réside
    
    // Pour l'instant, retourner les tiles inchangées
    // Cette fonction nécessitera une implémentation détaillée
    // basée sur la géométrie exacte du plateau
    return tiles.map(row => 
      row.map(tile => ({ ...tile }))
    );
  }

  /**
   * Calcule les déplacements gratuits des sondes
   */
  private static calculateProbeMovements(
    probes: Probe[],
    tiles: SystemTile[][]
  ): {
    probes: Probe[];
    movedProbes: Probe[];
  } {
    const movedProbes: Probe[] = [];
    const updatedProbes = probes.map(probe => {
      // Vérifier si la sonde doit être déplacée gratuitement
      const newPosition = this.getNewProbePosition(probe, tiles);
      
      if (newPosition && 
          (newPosition.x !== probe.position.x || 
           newPosition.y !== probe.position.y)) {
        movedProbes.push(probe);
        return {
          ...probe,
          position: newPosition
        };
      }
      
      return probe;
    });

    return {
      probes: updatedProbes,
      movedProbes
    };
  }

  /**
   * Détermine la nouvelle position d'une sonde après rotation
   */
  private static getNewProbePosition(
    probe: Probe,
    tiles: SystemTile[][]
  ): Position | null {
    // TODO: Implémenter la logique de déplacement gratuit
    // Basé sur les règles spécifiques de rotation
    // Certaines cases peuvent déplacer les sondes automatiquement
    
    // Pour l'instant, retourner null (pas de déplacement)
    return null;
  }

  /**
   * Vérifie si une rotation peut générer de la couverture médiatique
   */
  static checkMediaCoverageBonus(
    solarSystem: SolarSystem,
    rotationEvents: Array<{ type: EventType; data: any }>
  ): number {
    // TODO: Implémenter le calcul des bonus de couverture médiatique
    // Basé sur les cases traversées, les sondes déplacées, etc.
    return 0;
  }

  /**
   * Valide qu'une rotation est possible
   */
  static canRotate(solarSystem: SolarSystem): boolean {
    // La rotation est toujours possible
    // Mais on peut ajouter des validations si nécessaire
    return true;
  }
}


