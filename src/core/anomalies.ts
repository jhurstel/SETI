import { CelestialObject, Game } from './types';
import { calculateAbsolutePosition, createRotationState, getObjectPosition, RotationState } from './SolarSystemPosition';

/**
 * Anomalies du système solaire (espèce Anomalies) : jetons posés sur le disque D, qui tournent avec leur anneau.
 * Fonctions pures, sans règle : utilisées par les effets des cartes Anomalies, le scan et l'affichage.
 */

const rotationOf = (game: Game): RotationState => {
  const solarSystem = game.board.solarSystem;
  return createRotationState(solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3);
};

/** Jetons Anomalie en jeu (aucun tant que l'espèce n'est pas découverte) */
export function anomaliesOf(game: Game): CelestialObject[] {
  return (game.board.solarSystem.extraCelestialObjects || []).filter(o => o.type === 'anomaly');
}

/** Numéro (1 à 8) du secteur où se trouve une anomalie */
export function anomalySector(game: Game, anomaly: CelestialObject): number {
  return calculateAbsolutePosition(anomaly, rotationOf(game), game.board.solarSystem.extraCelestialObjects).absoluteSector;
}

/** Numéros des secteurs qui contiennent une anomalie (la couleur du secteur ne compte pas) */
export function anomalySectors(game: Game): Set<number> {
  return new Set(anomaliesOf(game).map(anomaly => anomalySector(game, anomaly)));
}

/**
 * Prochaine anomalie qui sera déclenchée : la première dans le sens des secteurs à partir de la Terre (une anomalie
 * sur le secteur de la Terre, déjà déclenchée, compte comme la plus lointaine) ; aucune sans anomalie en jeu.
 */
export function nextAnomaly(game: Game): CelestialObject | undefined {
  const rotation = rotationOf(game);
  const earth = getObjectPosition('earth', rotation.level1Angle, rotation.level2Angle, rotation.level3Angle, game.board.solarSystem.extraCelestialObjects);
  const anomalies = anomaliesOf(game);
  if (!earth || anomalies.length === 0) return undefined;
  return anomalies
    .map(anomaly => {
      const dist = (anomalySector(game, anomaly) - earth.absoluteSector + 8) % 8;
      return { anomaly, dist: dist === 0 ? 8 : dist };
    })
    .sort((a, b) => a.dist - b.dist)[0].anomaly;
}
