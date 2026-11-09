import { useCallback, useEffect, useState } from 'react';
import { CelestialObject, Game, InteractionState, ProbeState } from '../../core/types';
import { calculateAbsolutePosition, calculateReachableCellsWithEnergy, createRotationState, SolarSystemCell } from '../../core/SolarSystemPosition';

/** Case accessible depuis la sonde sélectionnée : déplacements nécessaires, chemin, Médias gagnés en route */
export type ReachableCell = { movements: number; path: string[]; media: number };

/**
 * Sonde (ou capsule) sélectionnée sur le plateau du système solaire et cases qu'elle peut atteindre (énergie et
 * déplacements gratuits), chemin survolé. Sélection automatique lors d'un déplacement gratuit (sonde imposée, ou
 * la seule du joueur) ; remise à zéro au changement de joueur.
 */
export function useProbeSelection(game: Game, interactionState: InteractionState, rotationAngle1: number, rotationAngle2: number, rotationAngle3: number) {
  const highlightPlayerProbes = interactionState.type === 'MOVING_PROBE';
  const freeMovementCount = interactionState.type === 'MOVING_PROBE' ? interactionState.count : 0;
  const autoSelectProbeId = interactionState.type === 'MOVING_PROBE' ? interactionState.autoSelectProbeId : undefined;

  // État pour gérer la sonde sélectionnée et les cases accessibles
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const [reachableCells, setReachableCells] = useState<Map<string, ReachableCell>>(new Map());
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);

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
        p => p.ownerId === currentPlayer.id && (p.state === ProbeState.IN_SOLAR_SYSTEM || p.state === ProbeState.CAPSULE)
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

  /** Annule la sélection (et les cases accessibles) */
  const clearSelection = useCallback(() => {
    setSelectedProbeId(null);
    setReachableCells(new Map());
    setHighlightedPath([]);
  }, []);

  return { selectedProbeId, setSelectedProbeId, reachableCells, highlightedPath, setHighlightedPath, clearSelection };
}
