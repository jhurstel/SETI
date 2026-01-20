/**
 * Système de gestion des espèces extraterrestres
 * 
 * Gère :
 * - Découverte d'espèces (3 traces complétées)
 * - Règles spécifiques par espèce
 * - Cartes extraterrestres
 * - Modifications de scoring
 */

import {
  Game,
  Species,
  LifeTrace,
  LifeTraceType
} from '../core/types';

export class SpeciesSystem {
  /**
   * Vérifie si une espèce peut être découverte
   */
  static canDiscoverSpecies(
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

    // Chercher une espèce correspondante
    for (const species of game.species) {
      if (species.discovered) {
        continue; // Déjà découverte
      }

      // Vérifier si les types de traces correspondent
      const hasAllTypes = species.lifeTraceTypes.every(type => 
        tracesByType.has(type) && (tracesByType.get(type) || 0) > 0
      );

      if (hasAllTypes) {
        // Vérifier si on a assez de traces (3 traces complétées)
        const totalTraces = species.lifeTraceTypes.reduce(
          (sum, type) => sum + (tracesByType.get(type) || 0),
          0
        );

        // TODO: Ajuster selon les règles exactes
        // Pour l'instant, on suppose qu'il faut au moins 3 traces
        if (totalTraces >= 3) {
          return species;
        }
      }
    }

    return null;
  }

  /**
   * Découvre une espèce
   */
  static discoverSpecies(
    game: Game,
    playerId: string,
    species: Species
  ): {
    updatedGame: Game;
    species: Species;
  } {
    const updatedGame = { ...game };
    updatedGame.discoveredSpecies = [...game.discoveredSpecies];
    updatedGame.species = [...game.species];

    // Marquer l'espèce comme découverte
    const discoveredSpecies: Species = {
      ...species,
      discovered: true,
    };

    // Ajouter aux espèces découvertes
    updatedGame.discoveredSpecies.push(discoveredSpecies);

    // Mettre à jour dans la liste des espèces
    const speciesIndex = updatedGame.species.findIndex(s => s.id === species.id);
    if (speciesIndex >= 0) {
      updatedGame.species[speciesIndex] = discoveredSpecies;
    }

    // Appliquer les règles spécifiques
    updatedGame = this.applySpeciesRules(updatedGame, discoveredSpecies);

    // Ajouter les cartes extraterrestres aux decks
    if (discoveredSpecies.cards.length > 0) {
      // TODO: Implémenter selon le système de pioche exact
      // updatedGame.decks.speciesCards.push(...discoveredSpecies.cards);
    }

    return {
      updatedGame,
      species: discoveredSpecies
    };
  }

  /**
   * Applique les règles spécifiques d'une espèce
   */
  private static applySpeciesRules(
    game: Game,
    species: Species
  ): Game {
    const updatedGame = { ...game };

    // Appliquer les modifications de règles
    species.rules.modifications.forEach(modification => {
      // TODO: Implémenter selon le type de modification
      // Les modifications peuvent affecter :
      // - Les coûts d'actions
      // - Les limites
      // - Les règles de déplacement
      // - Les règles de scoring
      // etc.
    });

    return updatedGame;
  }

  /**
   * Obtient les espèces découvertes
   */
  static getDiscoveredSpecies(game: Game): Species[] {
    return game.discoveredSpecies;
  }

  /**
   * Obtient les espèces non découvertes
   */
  static getUndiscoveredSpecies(game: Game): Species[] {
    return game.species.filter(s => !s.discovered);
  }

  /**
   * Calcule les bonus de scoring d'une espèce pour un joueur
   */
  static calculateSpeciesScoringBonus(
    game: Game,
    playerId: string,
    species: Species
  ): number {
    let bonus = 0;

    // Appliquer les modificateurs de scoring
    species.scoringModifiers.forEach(modifier => {
      // TODO: Implémenter selon les règles exactes
      // Les modificateurs peuvent être :
      // - Bonus fixes
      // - Multiplicateurs
      // - Conditions spécifiques
      bonus += modifier.value;
    });

    return bonus;
  }
}
