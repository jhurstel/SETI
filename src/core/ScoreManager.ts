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
  CardType
} from '../core/types';

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
      goldenTiles: 0,
      technologySeries: 0,
      completedMissions: 0,
      reservedRevenue: 0,
      lifeTraceSets: 0,
      sectorProbePairs: 0,
      missionEndGamePairs: 0,
      speciesBonuses: 0,
      total: 0
    };

    // 1. Tuiles Score dorées
    scores.goldenTiles = this.calculateGoldenTiles(player, game.board);

    // 2. Séries de technologies
    scores.technologySeries = this.calculateTechnologySeries(player);

    // 3. Missions accomplies
    scores.completedMissions = this.calculateCompletedMissions(player);

    // 4. Revenus réservés
    scores.reservedRevenue = this.calculateReservedRevenue(player);

    // 5. Traces de vie (sets de 3 types)
    scores.lifeTraceSets = this.calculateLifeTraceSets(player);

    // 6. Paires : secteurs couverts / sondes
    scores.sectorProbePairs = this.calculateSectorProbePairs(
      player,
      game.board
    );

    // 7. Paires : missions / cartes fin de partie
    scores.missionEndGamePairs = this.calculateMissionEndGamePairs(player);

    // 8. Effets spécifiques d'espèces
    scores.speciesBonuses = this.calculateSpeciesBonuses(
      player,
      game.discoveredSpecies
    );

    // Total
    scores.total = Object.values(scores).reduce((sum, val) => 
      typeof val === 'number' ? sum + val : sum, 0
    );

    return scores;
  }

  /**
   * Calcule les points des tuiles Score dorées
   */
  private static calculateGoldenTiles(
    player: Player,
    board: Game['board']
  ): number {
    // TODO: Implémenter le calcul des tuiles dorées
    // Basé sur les tuiles collectées pendant la partie
    player;
    board;
    return 0;
  }

  /**
   * Calcule les points des séries de technologies
   */
  private static calculateTechnologySeries(player: Player): number {
    // TODO: Implémenter le calcul des séries
    // Grouper les technologies par type et calculer les bonus
    const techCount = player.technologies.length;
    
    // Exemple simplifié : 2 PV par technologie (à ajuster selon règles)
    return techCount * 2;
  }

  /**
   * Calcule les points des missions accomplies
   */
  private static calculateCompletedMissions(player: Player): number {
    const completedMissions = player.missions.filter(m => m.completed);
    // TODO: Implémenter le calcul exact selon les règles
    return completedMissions.length * 5; // Exemple
  }

  /**
   * Calcule les revenus réservés
   */
  private static calculateReservedRevenue(player: Player): number {
    // TODO: Implémenter le calcul des revenus réservés
    // Basé sur les crédits/énergie non dépensés
    player;
    return 0;
  }

  /**
   * Calcule les points des sets de traces de vie
   */
  private static calculateLifeTraceSets(player: Player): number {
    // Compter les traces par type
    const tracesByType = new Map<LifeTraceType, number>();
    
    player.lifeTraces.forEach(trace => {
      const count = tracesByType.get(trace.type) || 0;
      tracesByType.set(trace.type, count + 1);
    });

    // Calculer les sets complets (3 types différents)
    const types = Array.from(tracesByType.keys());
    const minCount = Math.min(...types.map(t => tracesByType.get(t) || 0));
    
    // Chaque set de 3 types différents = X PV (à ajuster selon règles)
    return minCount * 10; // Exemple
  }

  /**
   * Calcule les points des paires secteurs/sondes
   */
  private static calculateSectorProbePairs(
    player: Player,
    board: Game['board']
  ): number {
    // Compter les secteurs couverts par le joueur
    const coveredSectors = board.sectors.filter(
      s => s.coveredBy === player.id
    ).length;

    // Compter les sondes
    const probeCount = player.probes.length;

    // Calculer les paires (minimum entre les deux)
    const pairs = Math.min(coveredSectors, probeCount);
    
    // TODO: Ajuster selon les règles exactes
    return pairs * 3; // Exemple
  }

  /**
   * Calcule les points des paires missions/cartes fin de partie
   */
  private static calculateMissionEndGamePairs(player: Player): number {
    const completedMissions = player.missions.filter(m => m.completed).length;
    const endGameCards = player.cards.filter(c => c.type === CardType.END_GAME).length;

    const pairs = Math.min(completedMissions, endGameCards);
    
    // TODO: Ajuster selon les règles exactes
    return pairs * 4; // Exemple
  }

  /**
   * Calcule les bonus spécifiques des espèces découvertes
   */
  private static calculateSpeciesBonuses(
    player: Player,
    discoveredSpecies: Species[]
  ): number {
    // TODO: Implémenter les bonus selon les règles de chaque espèce
    // Chaque espèce peut avoir des modificateurs de scoring différents
    let bonus = 0;
    player;
    
    discoveredSpecies.forEach(species => {
      species.scoringModifiers.forEach(modifier => {
        // Appliquer les modificateurs selon leur type
        bonus += modifier.value;
      });
    });

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


