import { cloneGame } from '../core/cloneGame';
import { uniqueId } from '../core/ids';
import { calculateAbsolutePosition, createRotationState, getObjectPosition } from '../core/SolarSystemPosition';
import { AlienBoardType, Game, InteractionState, LifeTraceLocation } from '../core/types';
import { ProbeSystem } from './ProbeSystem';
import { ResourceSystem } from './ResourceSystem';

/*
 * Rotation du système solaire : une règle du jeu (sondes entraînées ou poussées, anomalies activées), séparée de la
 * géométrie (core/SolarSystemPosition), qui reste un module de calcul sans dépendance vers les règles.
 */

/**
 * Fait tourner l'anneau suivant du système solaire. Si la Terre arrive devant une anomalie (Anomalies découvertes),
 * le joueur dont le marqueur est le plus haut sur la piste de sa couleur gagne sa récompense ; `interactions` contient
 * les choix qu'elle ouvre (carte au choix…), pour ce joueur. `pushes` : une entrée par sonde poussée, au nom de son
 * propriétaire, à inscrire après le message de la rotation.
 */
export function performRotation(game: Game): { updatedGame: Game, logs: string[], pushes: { playerId: string; message: string }[], interactions: InteractionState[] } {
  let updatedGame = cloneGame(game);
  const currentLevel = updatedGame.board.solarSystem.nextRingLevel;
  const oldRotationState = createRotationState(
    updatedGame.board.solarSystem.rotationAngleLevel1,
    updatedGame.board.solarSystem.rotationAngleLevel2,
    updatedGame.board.solarSystem.rotationAngleLevel3
  );

  if (currentLevel === 1) { // Bleu
    updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1) - 45;
    updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2) - 45;
    updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3) - 45;
  } else if (currentLevel === 2) { // Rouge
    updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2) - 45;
    updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3) - 45;
  } else { // Jaune (anneau 3)
    updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3) - 45;
  }

  updatedGame.board.solarSystem.nextRingLevel = currentLevel === 1 ? 3 : currentLevel - 1;

  const newRotationState = createRotationState(
    updatedGame.board.solarSystem.rotationAngleLevel1,
    updatedGame.board.solarSystem.rotationAngleLevel2,
    updatedGame.board.solarSystem.rotationAngleLevel3
  );
  const rotationResult = ProbeSystem.updateProbesAfterRotation(updatedGame, oldRotationState, newRotationState, updatedGame.board.solarSystem.extraCelestialObjects || []);
  updatedGame = rotationResult.game;

  const diskLevel: Record<number, string> = { 1: 'Bleu', 2: 'Rouge', 3: 'Jaune' };
  const log = `fait tourner le Système Solaire (${diskLevel[currentLevel]})`;

  // Vérification des anomalies après rotation
  const earthPos = getObjectPosition('earth', newRotationState.level1Angle, newRotationState.level2Angle, newRotationState.level3Angle, updatedGame.board.solarSystem.extraCelestialObjects);
  const anomalies = (updatedGame.board.solarSystem.extraCelestialObjects || []).filter(o => o.type === 'anomaly');
  const anomalyBoard = updatedGame.board.alienBoards.find(b => b.speciesId === AlienBoardType.ANOMALIES);
  const anomalyLogs: string[] = [];
  const interactions: InteractionState[] = [];

  if (earthPos && anomalyBoard && anomalyBoard.isDiscovered) {
    for (const anomaly of anomalies) {
      const anomalyPos = calculateAbsolutePosition(anomaly, newRotationState, updatedGame.board.solarSystem.extraCelestialObjects);
      if (anomalyPos.absoluteSector === earthPos.absoluteSector) {
        const color = anomaly.anomalyData?.color;
        const bonus = anomaly.anomalyData?.bonus;
        if (color && bonus) {
          const traceType = color;
          // Ne prendre en compte que les slots 'species' (pas 'triangle')
          const trackTraces = anomalyBoard.lifeTraces.filter(t => t.type === traceType && t.location === LifeTraceLocation.SPECIES);
          // Trier par index décroissant pour trouver le plus haut
          trackTraces.sort((a, b) => (b.slotIndex || 0) - (a.slotIndex || 0));

          const highestPlayerId = trackTraces[0]?.playerId;
          const player = highestPlayerId && highestPlayerId !== 'neutral' ? updatedGame.players.find(p => p.id === highestPlayerId) : undefined;
          if (player) {
            const res = ResourceSystem.processBonuses(bonus, updatedGame, player.id, 'anomaly', `anomaly-${uniqueId()}`);
            updatedGame = res.updatedGame;
            // Les journaux de processBonuses commencent déjà par leur verbe (« gagne 1 Crédit », « pioche carte… »)
            const gains = res.logs.length > 0 ? res.logs.join(', ') : `gagne ${ResourceSystem.formatBonus(bonus).join(', ') || 'sa récompense'}`;
            anomalyLogs.push(`Anomalie ${color} activée : ${player.name} ${gains}`);
            interactions.push(...res.newPendingInteractions.map(i => ({ ...i, playerId: player.id })));
          } else {
            anomalyLogs.push(`Anomalie ${color} activée : aucun marqueur sur la piste ${color} des Anomalies, personne ne gagne sa récompense`);
          }
        }
      }
    }
  }

  return { updatedGame, logs: [log, ...anomalyLogs], pushes: rotationResult.pushes, interactions };
}
