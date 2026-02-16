/**
 * Système de gestion des secteurs et scans
 * 
 * Gère :
 * - Scans de secteurs
 * - Marquage de signaux
 * - Majorités et couverture de secteurs
 * - Réinitialisation après couverture
 */

import { Game, Sector, Bonus, SignalType, GAME_CONSTANTS, InteractionState, ProbeState, HistoryEntry } from '../core/types';
import { getObjectPosition } from '../core/SolarSystemPosition';
import { ResourceSystem } from './ResourceSystem';
import { ProbeSystem } from './ProbeSystem';

export class ScanSystem {
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
  static scanSector(game: Game, playerId: string, sectorId: string, checkCost: boolean = true, noData: boolean = false) : {
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
    
    const logs: string[] = [];
    let bonuses: Bonus = {};
  
    // Find first available signal
    const signal = sector.signals.find(s => !s.marked);
    if (signal) {
      signal.marked = true;
      signal.markedBy = playerId;
      
      logs.push(`marque un signal dans le secteur "${sector.name}" (${sector.color})`);
      
      // Base gain: 1 Data (if type is DATA)
      if (signal.type === SignalType.DATA) {
          if (noData) {
            logs.push(`sans gagner de Donnée`);
          } else {
            bonuses.data = 1;
          }
      }
      
      // Signal bonus: 2PV
      if (signal.bonus) {
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
    let updatedGame = structuredClone(game);
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
    const majorities = this.calculateMajorities(sector);
    if (majorities.length === 0) {
      return { updatedGame, logs: [], bonuses: {} };
    }
    const winnerId = majorities[0].playerId;

    let winner = updatedGame.players.find(p => p.id === winnerId);
    if (winner) {
        logs.push('couvre le secteur');
        
        // Appliquer les bonus au gagnant
        const isFirstTime = !sector.isCovered;
        const sectorBonus = isFirstTime ? sector.firstBonus : sector.nextBonus;
        if (sectorBonus) {
            if (winnerId === playerId) {
                if (sectorBonus.pv) bonuses.pv = (bonuses.pv || 0) + sectorBonus.pv;
                if (sectorBonus.lifetraces) bonuses.lifetraces = [...(bonuses.lifetraces || []), ...sectorBonus.lifetraces];
            } else {
                const res = ResourceSystem.processBonuses(sectorBonus, updatedGame, winnerId, 'sector_cover_passive', '');
                updatedGame = res.updatedGame;
                res.logs.forEach(l => logs.push(`${winner!.name} ${l}`));
                winner = updatedGame.players.find(p => p.id === winnerId);
            }
        }

        // Bonus de Média (Chaque joueur présent gagne 1 Média)
        const uniquePlayersIds = new Set(sector.signals.map(s => s.markedBy).filter(id => id) as string[]);
        const participants: string[] = [];
        uniquePlayersIds.forEach(pId => {
            const p = updatedGame.players.find(pl => pl.id === pId);
            if (p) {
                if (pId === playerId) {
                    bonuses.media = (bonuses.media || 0) + 1;
                } else {
                    p.mediaCoverage = Math.min(p.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                    participants.push(p.name);
                }
            }
        });

        if (participants.length > 0) {
            logs.push(`${participants.join(', ')} gagn${participants.length > 1 ? 'ent' : 'e'} 1 Média. ${player.name} `);
        }

        // Bonus BONUS_IF_COVERED (Cartes 45, 46, 47)
        const buffsToTrigger = winner!.activeBuffs.filter(buff => buff.type === 'BONUS_IF_COVERED');
        buffsToTrigger.forEach(buff => {
            if (winnerId === playerId) {
                if (buff.target === 'energy') {
                    bonuses.energy = (bonuses.energy || 0) + buff.value;
                    logs.push(`gagne ${ResourceSystem.formatResource(buff.value, 'ENERGY')} (Bonus carte "${buff.source}")`);
                } else if (buff.target === 'draw') {
                    bonuses.card = (bonuses.card || 0) + buff.value;
                    logs.push(`gagne ${ResourceSystem.formatResource(buff.value, 'CARD')} (Bonus carte "${buff.source}")`);
                } else if (buff.target === 'data') {
                    bonuses.data = (bonuses.data || 0) + buff.value;
                    logs.push(`gagne ${ResourceSystem.formatResource(buff.value, 'DATA')} (Bonus carte "${buff.source}")`);
                }
            }
        });

        if (buffsToTrigger.length > 0) {
            winner!.activeBuffs = winner!.activeBuffs.filter(buff => buff.type !== 'BONUS_IF_COVERED');
        }

        // Marquer le secteur comme couvert
        sector.isCovered = true;
        sector.coveredBy.push(winnerId);

        // Reset signals
        // Le gagnant (1er) retire ses marqueurs.
        // Le 2ème (ou les 2èmes ex-aequo) place un marqueur en 1ère position.
        // Les autres (3ème et plus) retirent leurs marqueurs.
        
        let secondPlacePlayers: string[] = [];

        if (majorities.length > 1) {
            // Find the score of the actual second place.
            // This is the first player in the sorted list whose score is less than the winner's.
            const winnerScore = majorities[0].count;
            const secondPlaceEntry = majorities.find(p => p.count < winnerScore);

            if (secondPlaceEntry) {
                const secondPlaceCount = secondPlaceEntry.count;
                // Find all players who are tied for second place
                const tiedSecondPlacePlayers = majorities.filter(p => p.count === secondPlaceCount).map(p => p.playerId);

                if (tiedSecondPlacePlayers.length > 1) {
                    // Tie-breaker: last one to place a marker wins second place.
                    for (let i = sector.signals.length - 1; i >= 0; i--) {
                        const s = sector.signals[i];
                        if (s.marked && s.markedBy && tiedSecondPlacePlayers.includes(s.markedBy)) {
                            secondPlacePlayers = [s.markedBy];
                            break;
                        }
                    }
                } else {
                    secondPlacePlayers = tiedSecondPlacePlayers;
                }
            }
        }

        sector.signals.forEach(s => {
            s.marked = false;
            s.markedBy = undefined;
        });

        // Place markers for 2nd place players
        secondPlacePlayers.forEach((playerId, index) => {
            if (index < sector.signals.length) {
                const signal = sector.signals[index];
                signal.marked = true;
                signal.markedBy = playerId;
            }
        });
    }
    return { updatedGame, logs, bonuses, winnerId};
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
   * Calcule les majorités dans un secteur et retourne une liste triée des joueurs.
   */
  static calculateMajorities(sector: Sector): { playerId: string; count: number }[] {
    const counts = new Map<string, number>();
    sector.signals.forEach(signal => {
      if (signal.marked && signal.markedBy) {
        const count = counts.get(signal.markedBy) || 0;
        counts.set(signal.markedBy, count + 1);
      }
    });

    if (counts.size === 0) {
      return [];
    }

    // Convertir la map en tableau
    const sortedPlayers = Array.from(counts.entries()).map(([playerId, count]) => ({ playerId, count }));

    // Trier par nombre de marqueurs (décroissant)
    sortedPlayers.sort((a, b) => b.count - a.count);

    // Gérer les égalités pour la première place : le dernier à avoir posé gagne
    if (sortedPlayers.length > 1 && sortedPlayers[0].count === sortedPlayers[1].count) {
      const maxCount = sortedPlayers[0].count;
      const tiedPlayers = sortedPlayers.filter(p => p.count === maxCount).map(p => p.playerId);
      
      for (let i = sector.signals.length - 1; i >= 0; i--) {
        const s = sector.signals[i];
        if (s.marked && s.markedBy && tiedPlayers.includes(s.markedBy)) {
          const winner = s.markedBy;
          // Mettre le gagnant en première position
          const winnerIndex = sortedPlayers.findIndex(p => p.playerId === winner);
          if (winnerIndex > 0) {
            const winnerData = sortedPlayers.splice(winnerIndex, 1)[0];
            sortedPlayers.unshift(winnerData);
          }
          break;
        }
      }
    }

    return sortedPlayers;
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

  // Helper pour effectuer une séquence de scan complète
  static performScanAction(game: Game, isBonus: boolean = false, sequenceId?: string) : { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[]}
  {
      // Initier la séquence
      let updatedGame = structuredClone(game);
      if (!sequenceId) sequenceId = `scan-${Date.now()}`;
      const historyEntries: HistoryEntry[] = [];
      const newPendingInteractions: InteractionState[] = [];
      const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      const hasObs1 = currentPlayer.technologies.some(t => t.id.startsWith('observation-1'));
      const hasObs2 = currentPlayer.technologies.some(t => t.id.startsWith('observation-2'));
      const hasObs3 = currentPlayer.technologies.some(t => t.id.startsWith('observation-3'));
      const hasObs4 = currentPlayer.technologies.some(t => t.id.startsWith('observation-4'));
  
      // Payer le coût
      if (!isBonus) {
        currentPlayer.credits -= GAME_CONSTANTS.SCAN_COST_CREDITS;
        currentPlayer.energy -= GAME_CONSTANTS.SCAN_COST_ENERGY;
        historyEntries.push({ message: `paye ${ResourceSystem.formatResource(GAME_CONSTANTS.SCAN_COST_CREDITS, 'CREDIT')} et ${ResourceSystem.formatResource(GAME_CONSTANTS.SCAN_COST_ENERGY, 'ENERGY')} pour <strong>Scanner un secteur</strong>`, playerId: currentPlayer.id, sequenceId});
      } else {
        historyEntries.push({ message: `gagne l'action <strong>Scanner un secteur</strong>`, playerId: currentPlayer.id, sequenceId});
      }

      // 1. Signal depuis la Terre
      const solarSystem = game.board.solarSystem;
      const earthPos = getObjectPosition('earth', solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3);
      if (earthPos) {
        const earthSector = game.board.sectors[earthPos.absoluteSector - 1];
        if (hasObs1) {
            newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: earthSector.color, sequenceId, adjacents: true })
        } else {
            const res = this.performSignalAndCover(updatedGame, currentPlayer.id, earthSector.id, [], false, sequenceId);
            updatedGame = res.updatedGame;
            historyEntries.push(...res.historyEntries);
            newPendingInteractions.push(...res.newPendingInteractions);
        }
      }

      // 2. Signal depuis la rangée de carte
      newPendingInteractions.push({ type: 'SELECTING_SCAN_CARD', sequenceId })

      // 3. Signal depuis Mercure
      if (hasObs2) {
        if (currentPlayer.mediaCoverage > 0) {
            newPendingInteractions.push({ type: 'CHOOSING_OBS2_ACTION', sequenceId });
        } else {
            historyEntries.push({ message: "ne peut pas utiliser Observation II (manque de Média)", playerId: currentPlayer.id, sequenceId });
        }
      }

      // 4. Signal depuis carte de la main (Obs3)
      if (hasObs3) {
        if (currentPlayer.cards.length > 0) {
            newPendingInteractions.push({ type: 'CHOOSING_OBS3_ACTION', sequenceId });
        } else {
            historyEntries.push({ message: "ne peut pas utiliser Observation III (manque de cartes en main)", playerId: currentPlayer.id, sequenceId });
        }
      }

      // 5. Lancer une Sonde pour 1 Energie ou 1 Déplacement
      if (hasObs4) {
        const canLaunch = currentPlayer.energy >= 1 && ProbeSystem.canLaunchProbe(updatedGame, currentPlayer.id, false).canLaunch;
        const canMove = currentPlayer.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);

        if (canLaunch || canMove) {
            newPendingInteractions.push({ type: 'CHOOSING_OBS4_ACTION', sequenceId });
        } else {
            historyEntries.push({ message: "ne peut pas utiliser Observation IV (conditions non remplies)", playerId: currentPlayer.id, sequenceId });
        }
      }

      return { updatedGame, historyEntries, newPendingInteractions };
  }

  // Helper pour effectuer un scan et potentiellement une couverture de secteur
  static performSignalAndCover(
    gameToUpdate: Game,
    playerId: string,
    sectorId: string,
    initialLogs: string[] = [],
    noData: boolean = false,
    sequenceId: string
  ): { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] }
  {
    let updatedGame = gameToUpdate;
    const historyEntries: HistoryEntry[] = [];
    const scanLogs: string[] = [...initialLogs];

    let newPendingInteractions: InteractionState[] = [];

    // 1. Scan
    const scanResult = ScanSystem.scanSector(updatedGame, playerId, sectorId, false, noData);
    updatedGame = scanResult.updatedGame;
    scanLogs.push(...scanResult.logs);

    // 2. Process scan bonuses
    if (scanResult.bonuses) {
      const bonusRes = ResourceSystem.processBonuses(scanResult.bonuses, updatedGame, playerId, 'scan', sequenceId);
      updatedGame = bonusRes.updatedGame;
      scanLogs.push(...bonusRes.logs);
      if (bonusRes.historyEntries) {
        historyEntries.push(...bonusRes.historyEntries);
      }
      if (bonusRes.newPendingInteractions.length > 0) {
        newPendingInteractions = bonusRes.newPendingInteractions.map(i => ({ ...i, sequenceId }));
      }
    }

    // 3. Check if covered
    if (ScanSystem.isSectorCovered(updatedGame, sectorId)) {
      scanLogs.push(`complète le secteur`);
      historyEntries.push({ message: scanLogs.join(', '), playerId, sequenceId });
      newPendingInteractions.push({ type: 'RESOLVING_SECTOR', sectorId, sequenceId });
    } else {
      // 6. Log scan only
      historyEntries.push({ message: scanLogs.join(', '), playerId, sequenceId });
    }

    return { updatedGame, historyEntries, newPendingInteractions };
  };
}
