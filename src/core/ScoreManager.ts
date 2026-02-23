/**
 * Gestionnaire de scoring pour SETI
 * 
 * Calcule tous les points de victoire selon les règles du jeu.
 * 
 * Catégories de scoring :
 * - Tuiles Score dorées
 * - Séries de technologies
 * - Missions accomplies
 * - Revenus réservés
 * - Traces de vie (sets de 3 types)
 * - Paires : secteurs couverts / sondes
 * - Paires : missions / cartes fin de partie
 * - Effets spécifiques d'espèces
 */

import {
  Game,
  Player,
  ScoreCategories,
  LifeTraceType,
  Species,
  Card,
  CardType,
  ObjectiveCategory,
  TechnologyCategory,
  GAME_CONSTANTS,
  ProbeState,
  SectorType
} from '../core/types';
import { createRotationState, getAbsoluteSectorForProbe, getCell } from './SolarSystemPosition';

export class ScoreManager {
  /**
   * Calcule le score final d'un joueur
   */
  static calculateFinalScore(game: Game, playerId: string): ScoreCategories {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const scores: ScoreCategories = {
      missionEndGame: 0,
      objectiveTiles: 0,
      speciesBonuses: 0,
      total: 0
    };

    scores.missionEndGame = this.calculateMissionEndGame(player, game);

    scores.speciesBonuses = this.calculateSpeciesBonuses(player, game.discoveredSpecies);

    scores.objectiveTiles = this.calculateObjectiveTiles(player, game.board);

    // Total
    scores.total = Object.values(scores).reduce((sum, val) =>
      typeof val === 'number' ? sum + val : sum, 0
    );

    return scores;
  }

  /**
   * Calcule les points des paires missions/cartes fin de partie
   */
  private static calculateMissionEndGame(player: Player, game: Game): number {
    let bonus = 0;
    const endGameCards: Card[] = (player.playedCards || []).filter(c => c.type === CardType.END_GAME);

    endGameCards.forEach(card => {
      // Traitement des règles de scoring définies dans passiveEffects
      if (card.passiveEffects) {
        card.passiveEffects.forEach(effect => {
          if (effect.type === 'SCORE_PER_ORBITER_LANDER') {
            const planetId = effect.target;
            if (planetId) {
              const planet = game.board.planets.find(p => p.id === planetId);
              if (planet) {
                let count = 0;
                // Orbiteurs sur la planète
                count += planet.orbiters.filter(p => p.ownerId === player.id).length;
                // Atterrisseurs sur la planète
                count += planet.landers.filter(p => p.ownerId === player.id).length;
                // Satellites
                if (planet.satellites) {
                  planet.satellites.forEach(sat => {
                    count += sat.landers.filter(p => p.ownerId === player.id).length;
                  });
                }
                bonus += count * effect.value;
              }
            }
          } else if (effect.type === 'SCORE_PER_COVERED_SECTOR') {
            const colorStr = effect.target;
            let color: SectorType | undefined;
            if (colorStr === 'red') color = SectorType.RED;
            else if (colorStr === 'blue') color = SectorType.BLUE;
            else if (colorStr === 'yellow') color = SectorType.YELLOW;
            else if (colorStr === 'black') color = SectorType.BLACK;

            if (color) {
              let count = 0;
              game.board.sectors.forEach(s => {
                if (s.color === color) {
                  count += s.coveredBy.filter(id => id === player.id).length;
                }
              });
              bonus += count * effect.value;
            }
          } else if (effect.type === 'SCORE_PER_LIFETRACE') {
            const colorStr = effect.target;
            let type: LifeTraceType | undefined;
            if (colorStr === 'red') type = LifeTraceType.RED;
            else if (colorStr === 'blue') type = LifeTraceType.BLUE;
            else if (colorStr === 'yellow') type = LifeTraceType.YELLOW;

            if (type) {
              const count = player.lifeTraces.filter(t => t.type === type).length;
              bonus += count * effect.value;
            }
          } else if (effect.type === 'SCORE_PER_SIGNAL') {
            const count = game.board.sectors.filter(s => s.signals.some(sig => sig.markedBy === player.id)).length;
            bonus += count * effect.value;
          } else if (effect.type === 'SCORE_PER_TECH_CATEGORY') {
            const catStr = effect.target;
            let category: TechnologyCategory | undefined;
            if (catStr === 'computing') category = TechnologyCategory.COMPUTING;
            else if (catStr === 'exploration') category = TechnologyCategory.EXPLORATION;
            else if (catStr === 'observation') category = TechnologyCategory.OBSERVATION;

            if (category) {
              const count = player.technologies.filter(t => t.type === category).length;
              bonus += count * effect.value;
            }
          } else if (effect.type === 'SCORE_IF_PROBE_ON_ASTEROID') {
            const rotationState = createRotationState(
              game.board.solarSystem.rotationAngleLevel1 || 0,
              game.board.solarSystem.rotationAngleLevel2 || 0,
              game.board.solarSystem.rotationAngleLevel3 || 0
            );
            const hasProbe = player.probes.some(p => {
              if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
              const absSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
              const cell = getCell(p.solarPosition.disk, absSector, rotationState, game.board.solarSystem.extraCelestialObjects);
              return cell?.hasAsteroid;
            });
            if (hasProbe) {
              bonus += effect.value;
            }
          } else if (effect.type === 'SCORE_SOLVAY') {
            // Trouver le gain maximum parmi les récompenses "others" des tuiles non validées par le joueur
            let maxPoints = 0;
            if (game.board.objectiveTiles) {
              game.board.objectiveTiles.forEach(tile => {
                if (!tile.markers.includes(player.id)) {
                  if (tile.rewards.others > maxPoints) maxPoints = tile.rewards.others;
                }
              });
            }
            bonus += maxPoints;
          }
        });
      }
    });

    return bonus;
  }

  /**
   * Calcule les points des tuiles objectifs du plateau
   */
  private static calculateObjectiveTiles(player: Player, board: Game['board']): number {
    let total = 0;
    if (!board.objectiveTiles) return 0;

    board.objectiveTiles.forEach(tile => {
      const index = tile.markers.indexOf(player.id);
      if (index !== -1) {
        let rewardValue = 0;
        if (index === 0) rewardValue = tile.rewards.first;
        else if (index === 1) rewardValue = tile.rewards.second;
        else rewardValue = tile.rewards.others;

        let count = 0;

        switch (tile.category) {
          case ObjectiveCategory.TECHNOLOGY:
            if (tile.side === 'A') {
              // Série de 3 types de technologies
              const typeCounts = new Map<TechnologyCategory, number>();
              player.technologies.forEach(t => {
                typeCounts.set(t.type, (typeCounts.get(t.type) || 0) + 1);
              });

              const counts = Array.from(typeCounts.values()).sort((a, b) => b - a);
              while (counts.length < 3) counts.push(0);
              // Greedy algorithm for sets of 3 distinct types (assuming max 4 types)
              while (counts.length < 4) counts.push(0);

              let sets = 0;
              while (counts[2] > 0) {
                sets++;
                counts[0]--;
                counts[1]--;
                counts[2]--;
                counts.sort((a, b) => b - a);
              }
              count = sets;
            } else {
              // Paire de technologies
              count = Math.floor(player.technologies.length / 2);
            }
            break;

          case ObjectiveCategory.MISSION:
            if (tile.side === 'A') {
              // Mission accomplie
              count = player.missions.filter(m => m.completed).length;
            } else {
              // Paire Mission / Fin de partie
              const completedMissions = player.missions.filter(m => m.completed).length;
              const endGameCards = (player.playedCards || []).filter(c => c.type === CardType.END_GAME).length;
              count = Math.floor((completedMissions + endGameCards) / 2);
            }
            break;

          case ObjectiveCategory.REVENUE:
            // Revenus réservés (au-delà du départ)
            const reservedCredits = Math.max(0, player.revenueCredits - GAME_CONSTANTS.INITIAL_REVENUE_CREDITS);
            const reservedEnergy = Math.max(0, player.revenueEnergy - GAME_CONSTANTS.INITIAL_REVENUE_ENERGY);
            const reservedCards = Math.max(0, player.revenueCards - GAME_CONSTANTS.INITIAL_REVENUE_CARDS);

            if (tile.side === 'A') {
              // Série de 3 types
              count = Math.min(reservedCredits, reservedEnergy, reservedCards);
            } else {
              // Type le plus réservé
              count = Math.max(reservedCredits, reservedEnergy, reservedCards);
            }
            break;

          case ObjectiveCategory.OTHER:
            if (tile.side === 'A') {
              // Série de 3 types de traces de vie
              const tCounts = new Map<LifeTraceType, number>();
              player.lifeTraces.forEach(t => tCounts.set(t.type, (tCounts.get(t.type) || 0) + 1));
              const cBlue = tCounts.get(LifeTraceType.BLUE) || 0;
              const cRed = tCounts.get(LifeTraceType.RED) || 0;
              const cYellow = tCounts.get(LifeTraceType.YELLOW) || 0;
              count = Math.min(cBlue, cRed, cYellow);
            } else {
              // Paire secteur couvert / sonde (orbiteur ou atterrisseur)
              let coveredSectors = 0;
              board.sectors.forEach(s => {
                coveredSectors += s.coveredBy.filter(id => id === player.id).length;
              });
              const probes = player.probes.filter(p => p.state === ProbeState.IN_ORBIT || p.state === ProbeState.LANDED).length;
              count = Math.min(coveredSectors, probes);
            }
            break;
        }

        total += count * rewardValue;
      }
    });
    return total;
  }

  /**
   * Calcule les bonus spécifiques des espèces découvertes
   */
  private static calculateSpeciesBonuses(
    player: Player,
    _discoveredSpecies: Species[]
  ): number {
    // TODO: Implémenter les bonus selon les règles de chaque espèce
    // Chaque espèce peut avoir des modificateurs de scoring différents
    let bonus = 0;
    player;

    return bonus;
  }

  /**
   * Calcule le score de tous les joueurs et détermine le gagnant
   */
  static calculateAllScores(game: Game): Array<{
    playerId: string;
    scores: ScoreCategories;
  }> {
    return game.players.map(player => ({
      playerId: player.id,
      scores: this.calculateFinalScore(game, player.id)
    }));
  }

  /**
   * Détermine le(s) gagnant(s) en cas d'égalité
   */
  static determineWinner(
    scores: Array<{ playerId: string; scores: ScoreCategories }>
  ): string[] {
    // Trier par score total décroissant
    const sorted = [...scores].sort((a, b) =>
      b.scores.total - a.scores.total
    );

    const winners: string[] = [];
    const highestScore = sorted[0].scores.total;

    // En cas d'égalité, le dernier marqueur posé gagne
    // Pour l'instant, on retourne tous les joueurs avec le score le plus élevé
    sorted.forEach(result => {
      if (result.scores.total === highestScore) {
        winners.push(result.playerId);
      }
    });

    return winners;
  }
}
