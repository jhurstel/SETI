/**
 * Système de gestion des données et analyse
 * 
 * Gère :
 * - Ordinateur de données (ligne supérieure et inférieure)
 * - Analyse de données
 * - Traces de vie
 * - Découverte d'espèces (déclenchement)
 */

import {
  Game,
  Player,
  DataComputer,
  DataToken,
  LifeTrace,
  LifeTraceType,
  Species,
  GAME_CONSTANTS
} from '../core/types';

export class DataSystem {
  /**
   * Vérifie si un joueur peut analyser des données
   */
  static canAnalyzeData(game: Game, playerId: string): {
    canAnalyze: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canAnalyze: false, reason: 'Joueur introuvable' };
    }

    // Vérifier l'énergie
    if (player.energy < GAME_CONSTANTS.ANALYZE_COST_ENERGY) {
      return { 
        canAnalyze: false, 
        reason: `Énergie insuffisante (nécessite ${GAME_CONSTANTS.ANALYZE_COST_ENERGY})` 
      };
    }

    // Vérifier que la ligne supérieure est remplie
    if (!this.isTopRowFull(player.dataComputer)) {
      return { 
        canAnalyze: false, 
        reason: 'La ligne supérieure de l\'ordinateur doit être remplie' 
      };
    }

    return { canAnalyze: true };
  }

  /**
   * Vérifie si la ligne supérieure est remplie
   */
  private static isTopRowFull(computer: DataComputer): boolean {
    // TODO: Implémenter selon la taille exacte de la ligne supérieure
    // Pour l'instant, on suppose qu'il faut un certain nombre de données
    const maxSize = this.getTopRowMaxSize();
    return computer.topRow.length >= maxSize && 
           computer.topRow.every(token => token !== null && token !== undefined);
  }

  /**
   * Analyse les données
   */
  static analyzeData(
    game: Game,
    playerId: string
  ): {
    updatedGame: Game;
    lifeTrace?: LifeTrace;
    speciesDiscovered?: Species;
  } {
    const validation = this.canAnalyzeData(game, playerId);
    if (!validation.canAnalyze) {
      throw new Error(validation.reason || 'Analyse impossible');
    }

    const updatedGame = { ...game };
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];

    // Débiter l'énergie
    const updatedPlayer = {
      ...player,
      energy: player.energy - GAME_CONSTANTS.ANALYZE_COST_ENERGY
    };

    // Défausser toutes les données de la ligne supérieure
    updatedPlayer.dataComputer = {
      ...updatedPlayer.dataComputer,
      topRow: [],
      canAnalyze: false
    };

    // Placer un marqueur de découverte (trace de vie)
    const lifeTrace = this.createLifeTrace(updatedPlayer);
    updatedPlayer.lifeTraces.push(lifeTrace);

    // Vérifier si une espèce est découverte (3 traces complétées)
    const speciesDiscovered = this.checkSpeciesDiscovery(
      updatedGame,
      playerId,
      updatedPlayer.lifeTraces
    );

    if (speciesDiscovered) {
      // Ajouter l'espèce aux espèces découvertes
      updatedGame.discoveredSpecies.push(speciesDiscovered);
      
      // TODO: Appliquer les effets de l'espèce découverte
      // - Révéler les règles spécifiques
      // - Ajouter les cartes extraterrestres
      // - Modifier le scoring
    }

    updatedGame.players[playerIndex] = updatedPlayer;

    return {
      updatedGame,
      lifeTrace,
      speciesDiscovered
    };
  }

  /**
   * Crée une trace de vie
   */
  private static createLifeTrace(player: Player): LifeTrace {
    // TODO: Déterminer le type selon les règles exactes
    // Pour l'instant, type aléatoire (à remplacer par la logique réelle)
    const types: LifeTraceType[] = [
      LifeTraceType.TYPE_A,
      LifeTraceType.TYPE_B,
      LifeTraceType.TYPE_C
    ];
    
    const type = types[Math.floor(Math.random() * types.length)];

    return {
      id: `lifetrace_${Date.now()}_${player.id}`,
      type,
      discoveredAt: Date.now() // TODO: Utiliser le round actuel
    };
  }

  /**
   * Vérifie si une espèce est découverte (3 traces complétées)
   */
  private static checkSpeciesDiscovery(
    game: Game,
    playerId: string,
    lifeTraces: LifeTrace[]
  ): Species | null {
    // Compter les traces par type
    const tracesByType = new Map<LifeTraceType, number>();
    lifeTraces.forEach(trace => {
      const count = tracesByType.get(trace.type) || 0;
      tracesByType.set(trace.type, count + 1);
    });

    // Vérifier si on a 3 types différents (ou 3 traces du même type selon les règles)
    const types = Array.from(tracesByType.keys());
    
    // TODO: Implémenter selon les règles exactes
    // Pour l'instant, on vérifie si on a au moins 3 traces de types différents
    if (types.length >= 3) {
      // Trouver l'espèce correspondante
      const matchingSpecies = game.species.find(species => {
        // Vérifier si les types de traces correspondent
        return species.lifeTraceTypes.every(type => tracesByType.has(type));
      });

      if (matchingSpecies && !matchingSpecies.discovered) {
        return {
          ...matchingSpecies,
          discovered: true,
          discoveredAt: Date.now()
        };
      }
    }

    return null;
  }

  /**
   * Ajoute des données à l'ordinateur d'un joueur
   */
  static addDataToComputer(
    player: Player,
    dataTokens: DataToken[]
  ): Player {
    const updatedPlayer = { ...player };
    const computer = updatedPlayer.dataComputer;

    // Ajouter aux lignes (priorité à la ligne supérieure)
    dataTokens.forEach(token => {
      if (computer.topRow.length < this.getTopRowMaxSize()) {
        computer.topRow.push(token);
      } else if (computer.bottomRow.length < this.getBottomRowMaxSize()) {
        computer.bottomRow.push(token);
      }
      // Si les deux lignes sont pleines, les données sont perdues
    });

    // Vérifier si on peut analyser
    computer.canAnalyze = this.isTopRowFull(computer);

    updatedPlayer.dataComputer = computer;
    return updatedPlayer;
  }

  /**
   * Obtient la taille maximale de la ligne supérieure
   */
  private static getTopRowMaxSize(): number {
    // TODO: Implémenter selon les règles exactes
    return 5; // Exemple
  }

  /**
   * Obtient la taille maximale de la ligne inférieure
   */
  private static getBottomRowMaxSize(): number {
    // TODO: Implémenter selon les règles exactes
    return 5; // Exemple
  }
}

