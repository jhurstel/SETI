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
  Sector,
  Bonus,
  SignalType,
  GAME_CONSTANTS
} from '../core/types';

export class SectorSystem {
  /**
   * Vérifie si un joueur peut scanner un secteur
   */
  static canScanSector(
    game: Game,
    playerId: string,
    checkCost: boolean = true
  ): {
    canScan: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canScan: false, reason: 'Joueur introuvable' };
    }

    // Vérifier les ressources
    if (checkCost && player.credits < GAME_CONSTANTS.SCAN_COST_CREDITS) {
      return { 
        canScan: false, 
        reason: `Crédits insuffisants (nécessite ${GAME_CONSTANTS.SCAN_COST_CREDITS})` 
      };
    }

    if (checkCost && player.energy < GAME_CONSTANTS.SCAN_COST_ENERGY) {
      return { 
        canScan: false, 
        reason: `Énergie insuffisante (nécessite ${GAME_CONSTANTS.SCAN_COST_ENERGY})` 
      };
    }

    return { canScan: true };
  }

  /**
   * Scanne un secteur
   */
  static scanSector(game: Game, playerId: string, sectorId: string, checkCost: boolean = true) : {
    updatedGame: Game;
    logs: string[];
    bonuses: Bonus;
  } {
    const validation = this.canScanSector(game, playerId, checkCost);
    if (!validation.canScan) {
      console.log(game);
      throw new Error(validation.reason || 'Scan impossible');
    }

    const updatedGame = structuredClone(game);
    const sector = updatedGame.board.sectors.find(s => s.id === sectorId)!;
    if (!sector) {
      return { updatedGame, logs: [], bonuses: {} };
    }
    const player = updatedGame.players.find(p => p.id === playerId)!;
    
    const logs: string[] = [];
    let bonuses: Bonus = {};
  
    // Find first available signal
    const signal = sector.signals.find(s => !s.marked);
    if (signal) {
      signal.marked = true;
      signal.markedBy = playerId;
      
      logs.push(`marque un signal dans le secteur "${sector.name}"`);
      
      // Base gain: 1 Data (if type is DATA)
      if (signal.type === SignalType.DATA) {
          player.data = Math.min(player.data + 1, GAME_CONSTANTS.MAX_DATA);
          bonuses.data = 1;
      }
      
      // Signal bonus: 2PV
      if (signal.bonus) {
          player.score += signal.bonus.pv || 0;
          bonuses.pv = signal.bonus.pv;
      }
    } else {
      logs.push(`tente de scanner le secteur ${sector.id} mais il est plein`);
    }
  
    return { updatedGame, logs, bonuses };
  }

  /**
   * Vérifie si un secteur est couvert
   */
  static isSectorCovered(game: Game, sectorId: string): boolean {
    return game.board.sectors.find(s => s.id === sectorId)!.signals.filter(s => s.type === SignalType.DATA).every(s => s.marked);
  }

  /**
   * Couvre un secteur
   */
  static coverSector(game: Game, playerId: string, sectorId: string): {
    updatedGame: Game;
    logs: string[];
    bonuses: Bonus;
    winnerId?: string;
  } {
    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId)!;
    if (!player) {
      return { updatedGame, logs: [], bonuses: {} };
    }
    const sector = updatedGame.board.sectors.find(s => s.id === sectorId)!;
    if (!sector) {
      return { updatedGame, logs: [], bonuses: {} };
    }
    
    const logs: string[] = [];
    let bonuses: Bonus = {};
    const majority = this.calculateMajority(sector);
    const winnerId = majority.playerId;

    if (winnerId) {
        const winner = updatedGame.players.find(p => p.id === winnerId);
        if (winner) {
            logs.push('couvre le secteur');
            
            // Appliquer les bonus au gagnant
            const isFirstTime = !sector.isCovered;
            const sectorBonus = isFirstTime ? sector.firstBonus : sector.nextBonus;
            if (sectorBonus) {
                // PV
                if (sectorBonus.pv) {
                    winner.score += sectorBonus.pv;
                    if (winnerId === playerId) bonuses.pv = (bonuses.pv || 0) + sectorBonus.pv;
                }
                // Red Lifetrace
                if (winnerId === playerId && sectorBonus.redlifetrace) bonuses.redlifetrace = sectorBonus.redlifetrace;
            }

            // Bonus de Média (Chaque joueur présent gagne 1 Média)
            const uniquePlayersIds = new Set(sector.signals.map(s => s.markedBy).filter(id => id) as string[]);
            const participants: string[] = [];
            uniquePlayersIds.forEach(pId => {
                const p = updatedGame.players.find(pl => pl.id === pId);
                if (p) {
                    p.mediaCoverage = Math.min(p.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                    if (pId === playerId) {
                        bonuses.media = (bonuses.media || 0) + 1;
                    } else {
                        participants.push(p.name);
                    }
                }
            });

            if (participants.length > 0) {
                logs.push(`${participants.join(', ')} gagn${participants.length > 1 ? 'ent' : 'e'} 1 Média. ${player.name} `);
            }

            // Marquer le secteur comme couvert
            sector.isCovered = true;
            sector.coveredBy.push(winnerId);
            
            // Reset signals
            sector.signals.forEach(s => {
                s.marked = false;
                s.markedBy = undefined;
            });
        }
    }
    return { updatedGame, logs, bonuses, winnerId };
  }

  /**
   * Calcule la majorité dans un secteur
   */
  static calculateMajority(sector: Sector): {
    playerId: string | null;
    count: number;
  } {
    // Compter les marqueurs par joueur dans les signaux
    const counts = new Map<string, number>();
    
    sector.signals.forEach(signal => {
      if (signal.marked && signal.markedBy) {
        const count = counts.get(signal.markedBy) || 0;
        counts.set(signal.markedBy, count + 1);
      }
    });

    if (counts.size === 0) {
      return { playerId: null, count: 0 };
    }

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
      for (let i = sector.signals.length - 1; i >= 0; i--) {
          const s = sector.signals[i];
          if (s.marked && s.markedBy) {
              if (counts.get(s.markedBy) === maxCount) {
                  maxPlayerId = s.markedBy;
                  break;
              }
          }
      }
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
      s => s.coveredBy.includes(playerId) && s.isCovered
    );
  }

  /**
   * Obtient le nombre de secteurs couverts par un joueur
   */
  static getCoveredSectorCount(game: Game, playerId: string): number {
    return this.getCoveredSectors(game, playerId).length;
  }
}
