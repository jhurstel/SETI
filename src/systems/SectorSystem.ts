/**
 * Système de gestion des secteurs et scans
 * 
 * Gère :
 * - Scans de secteurs
 * - Marquage de signaux
 * - Majorités et couverture de secteurs
 * - Réinitialisation après couverture
 */

import {
  Game,
  Player,
  Sector,
  Signal,
  PlayerMarker,
  GAME_CONSTANTS
} from '../core/types';

export class SectorSystem {
  /**
   * Vérifie si un joueur peut scanner un secteur
   */
  static canScanSector(
    game: Game,
    playerId: string,
    sectorId: string
  ): {
    canScan: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canScan: false, reason: 'Joueur introuvable' };
    }

    // Vérifier les ressources
    if (player.credits < GAME_CONSTANTS.SCAN_COST_CREDITS) {
      return { 
        canScan: false, 
        reason: `Crédits insuffisants (nécessite ${GAME_CONSTANTS.SCAN_COST_CREDITS})` 
      };
    }

    if (player.energy < GAME_CONSTANTS.SCAN_COST_ENERGY) {
      return { 
        canScan: false, 
        reason: `Énergie insuffisante (nécessite ${GAME_CONSTANTS.SCAN_COST_ENERGY})` 
      };
    }

    const sector = game.board.sectors.find(s => s.id === sectorId);
    if (!sector) {
      return { canScan: false, reason: 'Secteur introuvable' };
    }

    if (sector.isCovered) {
      return { canScan: false, reason: 'Secteur déjà couvert' };
    }

    // Vérifier qu'il y a au moins 2 signaux non marqués
    const unmarkedSignals = sector.signals.filter(s => !s.marked);
    if (unmarkedSignals.length < 2) {
      return { 
        canScan: false, 
        reason: 'Au moins 2 signaux doivent être marqués' 
      };
    }

    return { canScan: true };
  }

  /**
   * Scanne un secteur
   */
  static scanSector(
    game: Game,
    playerId: string,
    sectorId: string,
    signalIds: string[] // Au moins 2 signaux à marquer
  ): {
    updatedGame: Game;
    covered: boolean;
    newMajority?: boolean;
  } {
    const validation = this.canScanSector(game, playerId, sectorId);
    if (!validation.canScan) {
      throw new Error(validation.reason || 'Scan impossible');
    }

    if (signalIds.length < 2) {
      throw new Error('Au moins 2 signaux doivent être marqués');
    }

    const updatedGame = { ...game };
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const sectorIndex = updatedGame.board.sectors.findIndex(s => s.id === sectorId);
    const sector = updatedGame.board.sectors[sectorIndex];

    // Débiter les ressources
    const updatedPlayer = {
      ...player,
      credits: player.credits - GAME_CONSTANTS.SCAN_COST_CREDITS,
      energy: player.energy - GAME_CONSTANTS.SCAN_COST_ENERGY
    };

    // Marquer les signaux
    const updatedSector = { ...sector };
    updatedSector.signals = updatedSector.signals.map(signal => {
      if (signalIds.includes(signal.id)) {
        return {
          ...signal,
          marked: true,
          markedBy: playerId
        };
      }
      return signal;
    });

    // Remplacer les jetons Donnée par des marqueurs joueur
    const dataSignals = updatedSector.signals.filter(
      s => s.marked && s.type === 'DATA'
    );
    
    // TODO: Ajouter les données à l'ordinateur du joueur
    // Pour chaque signal DATA marqué, ajouter une donnée

    // Ajouter un marqueur joueur
    const marker: PlayerMarker = {
      id: `marker_${Date.now()}_${playerId}`,
      playerId,
      placedAt: game.currentRound
    };
    updatedSector.playerMarkers.push(marker);

    // Vérifier la majorité
    const majority = this.calculateMajority(updatedSector);
    let covered = false;
    let newMajority = false;

    if (majority.playerId === playerId && sector.coveredBy !== playerId) {
      newMajority = true;
    }

    // Si le secteur est couvert (majorité établie)
    if (majority.playerId) {
      updatedSector.coveredBy = majority.playerId;
      updatedSector.coveredAt = game.currentRound;
      updatedSector.isCovered = true;
      covered = true;

      // Réinitialiser le secteur
      updatedSector.signals = [];
      updatedSector.playerMarkers = [];

      // Bonus de couverture
      if (majority.playerId === playerId) {
        // TODO: Gagner PV, couverture médiatique, etc. selon les règles
        updatedPlayer.score += 5; // Exemple
      }
    }

    updatedGame.players[playerIndex] = updatedPlayer;
    updatedGame.board.sectors[sectorIndex] = updatedSector;

    return {
      updatedGame,
      covered,
      newMajority
    };
  }

  /**
   * Calcule la majorité dans un secteur
   */
  static calculateMajority(sector: Sector): {
    playerId: string | null;
    count: number;
  } {
    if (sector.playerMarkers.length === 0) {
      return { playerId: null, count: 0 };
    }

    // Compter les marqueurs par joueur
    const counts = new Map<string, number>();
    sector.playerMarkers.forEach(marker => {
      const count = counts.get(marker.playerId) || 0;
      counts.set(marker.playerId, count + 1);
    });

    // Trouver le maximum
    let maxCount = 0;
    let maxPlayerId: string | null = null;
    let isTie = false;

    counts.forEach((count, playerId) => {
      if (count > maxCount) {
        maxCount = count;
        maxPlayerId = playerId;
        isTie = false;
      } else if (count === maxCount) {
        isTie = true;
      }
    });

    // En cas d'égalité, le dernier marqueur posé gagne
    if (isTie && maxPlayerId) {
      // Trouver le dernier marqueur
      const lastMarker = sector.playerMarkers
        .sort((a, b) => b.placedAt - a.placedAt)[0];
      maxPlayerId = lastMarker.playerId;
    }

    return {
      playerId: maxPlayerId,
      count: maxCount
    };
  }

  /**
   * Obtient les secteurs couverts par un joueur
   */
  static getCoveredSectors(game: Game, playerId: string): Sector[] {
    return game.board.sectors.filter(
      s => s.coveredBy === playerId && s.isCovered
    );
  }

  /**
   * Obtient le nombre de secteurs couverts par un joueur
   */
  static getCoveredSectorCount(game: Game, playerId: string): number {
    return this.getCoveredSectors(game, playerId).length;
  }
}

