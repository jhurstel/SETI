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
  GAME_CONSTANTS,
  Technology
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
    if (!player.dataComputer.canAnalyze) {
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
    updatedGame.players = [...game.players];
    updatedGame.discoveredSpecies = [...game.discoveredSpecies];
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

  // --- Méthodes fusionnées depuis ComputerSystem ---

  static initializeComputer(player: any) {
    if (!player.computer) {
      player.computer = {
        slots: {
          '1a': { id: '1a', filled: false, type: 'top', col: 1 },
          '1b': { id: '1b', filled: false, type: 'bottom', parentId: '1a', col: 1 },
          '2':  { id: '2', filled: false, type: 'top', bonus: 'media', col: 2 },
          '3a': { id: '3a', filled: false, type: 'top', col: 3 },
          '3b': { id: '3b', filled: false, type: 'bottom', parentId: '3a', col: 3 },
          '4':  { id: '4', filled: false, type: 'top', bonus: 'reservation', col: 4 },
          '5a': { id: '5a', filled: false, type: 'top', col: 5 },
          '5b': { id: '5b', filled: false, type: 'bottom', parentId: '5a', col: 5 },
          '6a': { id: '6a', filled: false, type: 'top', col: 6 },
          '6b': { id: '6b', filled: false, type: 'bottom', parentId: '6a', col: 6 },
        }
      };
    }
    return player.computer;
  }

  static canFillSlot(player: any, slotId: string): boolean {
    if (!player.computer || !player.computer.slots) return false;
    const slots = player.computer.slots;
    const slot = slots[slotId];
    
    if (!slot) return false;
    if (slot.filled) return false;
    if ((player.data || 0) < 1) return false;

    if (slot.type === 'bottom' && slot.parentId) {
      // La rangée du bas n'est accessible que s'il y a une technologie (bonus présent)
      if (!slot.bonus) return false;
      return slots[slot.parentId].filled;
    }

    // Contrainte horizontale : remplissage de gauche à droite sur la ligne du haut
    if (slot.type === 'top' && slot.col > 1) {
      const prevCol = slot.col - 1;
      const prevTopSlot = Object.values(slots).find((s: any) => s.col === prevCol && s.type === 'top') as any;
      if (prevTopSlot && !prevTopSlot.filled) return false;
    }

    return true;
  }

  static fillSlot(game: Game, playerId: string, slotId: string): { updatedGame: Game, gains: string[], bonusEffects: { type: string, amount: number }[] } {
    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { updatedGame: game, gains: [], bonusEffects: [] };
    
    const player = updatedGame.players[playerIndex] as any;
    
    if (!this.canFillSlot(player, slotId)) {
        return { updatedGame: game, gains: [], bonusEffects: [] };
    }

    const slot = player.computer.slots[slotId];
    
    player.data -= 1;
    slot.filled = true;
    
    const gains: string[] = [];
    const bonusEffects: { type: string, amount: number }[] = [];

    if (slot.bonus === 'media') {
       player.mediaCoverage = Math.min((player.mediaCoverage || 0) + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE || 10);
       gains.push("1 Média");
    }
    if (slot.bonus === 'reservation') {
       bonusEffects.push({ type: 'reservation', amount: 1 });
       gains.push("1 Réservation");
    }
    if (slot.bonus === '2pv') {
       player.score += 2;
       gains.push("2 PV");
    }
    if (slot.bonus === 'credit') {
       player.credits += 1;
       gains.push("1 Crédit");
    }
    if (slot.bonus === 'energy') {
       player.energy += 1;
       gains.push("1 Énergie");
    }
    if (slot.bonus === 'card') {
       bonusEffects.push({ type: 'card', amount: 1 });
       gains.push("1 Carte");
    }

    // Si la case 6a est remplie, on active la capacité d'analyse
    if (slotId === '6a' && player.dataComputer) {
      player.dataComputer.canAnalyze = true;
      gains.push("Analyse activée");
    }

    return { updatedGame, gains, bonusEffects };
  }

  static assignTechnology(player: any, tech: Technology, column: number) {
    if (!player.computer || !player.computer.slots) return;
    
    const slots = player.computer.slots;
    const topSlotId = `${column}a`;
    const bottomSlotId = `${column}b`;
    
    if (slots[topSlotId]) {
        slots[topSlotId].bonus = '2pv';
    }
    
    // Déterminer le bonus du bas en fonction de la tech
    let bottomBonus = '';
    if (tech.id.startsWith('computing-1')) bottomBonus = 'credit';
    else if (tech.id.startsWith('computing-2')) bottomBonus = 'card';
    else if (tech.id.startsWith('computing-3')) bottomBonus = 'energy';
    else if (tech.id.startsWith('computing-4')) bottomBonus = 'media';

    if (slots[bottomSlotId] && bottomBonus) {
        slots[bottomSlotId].bonus = bottomBonus;
    }
  }

  static clearComputer(player: any) {
    if (player.computer && player.computer.slots) {
      Object.values(player.computer.slots).forEach((slot: any) => {
        slot.filled = false;
      });
    }
    if (player.dataComputer) {
        player.dataComputer.canAnalyze = false;
    }
  }
}
