import { Game, Technology, GAME_CONSTANTS, TechnologyCategory, HistoryEntry, InteractionState } from '../core/types';
import { ComputerSystem } from './ComputerSystem';
import { ProbeSystem } from './ProbeSystem';
import { CardSystem } from './CardSystem';
import { ResourceSystem } from './ResourceSystem';

export class TechnologySystem {

  static getAvailableTechs(game: Game): Technology[] {
    const availableTechs: Technology[] = [];
    if (game.board.technologyBoard.categorySlots) {
      game.board.technologyBoard.categorySlots.forEach(slot => {
        if (slot.technologies.length > 0) {
          availableTechs.push(slot.technologies[0]);
        }
      });
    }
    return availableTechs;
  }

  static canResearchTech(game: Game, playerId: string): { canResearch: boolean, reason?: string } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return { canResearch: false, reason: "Joueur non trouvé" };

    if (player.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
        return { canResearch: false, reason: `Couverture médiatique insuffisante (Requis: ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA})` };
    }
    
    return { canResearch: true };
  }
  
  public static canAcquireTech(game: Game, playerId: string, category?: TechnologyCategory): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    const techBoard = game.board.technologyBoard;
    if (!techBoard || !techBoard.categorySlots) return false;

    for (const slot of techBoard.categorySlots) {
      if (category && slot.category !== category) continue;

      // Group by baseId
      const stacks = new Map<string, Technology[]>();
      slot.technologies.forEach(tech => {
        const lastDashIndex = tech.id.lastIndexOf('-');
        const baseId = tech.id.substring(0, lastDashIndex);
        if (!stacks.has(baseId)) stacks.set(baseId, []);
        stacks.get(baseId)!.push(tech);
      });

      for (const [baseId, stack] of stacks) {
        if (stack.length > 0) {
          // Check if player has this tech
          const hasTech = player.technologies.some(t => {
            const tLastDash = t.id.lastIndexOf('-');
            return t.id.substring(0, tLastDash) === baseId;
          });

          if (!hasTech) return true;
        }
      }
    }
    return false;
  }

  static acquireTechnology(game: Game, playerId: string, tech: Technology, targetComputerCol?: number, noTileBonus: boolean = false): { updatedGame: Game, gains: string[], historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] } {
    let updatedGame = structuredClone(game);
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    let historyEntries: HistoryEntry[] = [];
    let newPendingInteractions: InteractionState[] = [];
    if (!player) return { updatedGame: game, gains: [], historyEntries: [], newPendingInteractions: [] };

    const updatedTechBoard = updatedGame.board.technologyBoard;

    // Remove tech from board
    if (updatedTechBoard.categorySlots) {
      for (const slot of updatedTechBoard.categorySlots) {
        const index = slot.technologies.findIndex(t => t.id === tech.id);
        if (index !== -1) {
          slot.technologies.splice(index, 1);
          break;
        }
      }
      updatedTechBoard.available = updatedTechBoard.categorySlots.flatMap(s => s.technologies);
    }

    // Add to player
    player.technologies.push(tech);

    // Assign to computer slot (if needed)
    if (targetComputerCol !== undefined) {
      ComputerSystem.assignTechnology(player, tech, targetComputerCol);
    }

    // Apply bonuses
    let gains: string[] = [];
    if (!noTileBonus) {
      //const { updatedGame: gameAfterBonus, newPendingInteractions, passiveGains, logs, historyEntries } = ResourceSystem.processBonuses(tech.bonus, updatedGame, currentPlayer.id);
      if (tech.bonus.pv) {
          player.score += tech.bonus.pv;
          gains.push(`${tech.bonus.pv} PV`);
      }
      if (tech.bonus.media) {
          player.mediaCoverage = Math.min(player.mediaCoverage + tech.bonus.media, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
          gains.push(`${tech.bonus.media} Média`);
      }
      if (tech.bonus.credits) {
          player.credits += tech.bonus.credits;
          gains.push(`${tech.bonus.credits} Crédit`);
      }
      if (tech.bonus.energy) {
          player.energy += tech.bonus.energy;
          gains.push(`${tech.bonus.energy} Énergie`);
      }
      if (tech.bonus.data) {
          player.data = Math.min((player.data || 0) + tech.bonus.data, GAME_CONSTANTS.MAX_DATA);
          gains.push(`${tech.bonus.data} Data`);
      }
      if (tech.bonus.card) {
        updatedGame = CardSystem.drawCards(updatedGame, player.id, tech.bonus.card);
        gains.push(`${tech.bonus.card} Carte`);
      }
      if (tech.bonus.probe) {
        const result = ProbeSystem.launchProbe(updatedGame, player.id, true, false);
        if (result.probeId) {
            updatedGame.board = result.updatedGame.board;
            updatedGame.players = result.updatedGame.players;
            historyEntries = result.historyEntries;
            gains.push(`1 Sonde`);
        } else {
            gains.push(`1 Sonde (Perdue: Limite atteinte)`);
        }
      }
    }
    console.log(updatedGame);

    // Traitement des missions conditionnelles (GAIN_ON_TECH)
    const processedSources = new Set<string>();
    player.permanentBuffs.forEach(buff => {
        let shouldTrigger = false;
        if (tech.type === TechnologyCategory.EXPLORATION && buff.type === 'GAIN_ON_YELLOW_TECH') shouldTrigger = true;
        if (tech.type === TechnologyCategory.OBSERVATION && buff.type === 'GAIN_ON_RED_TECH') shouldTrigger = true;
        if (tech.type === TechnologyCategory.COMPUTING && buff.type === 'GAIN_ON_BLUE_TECH') shouldTrigger = true;

        if (shouldTrigger) {
             if (buff.source && processedSources.has(buff.source)) return;
             const bonus: any = {};
             if (buff.target === 'media') bonus.media = buff.value;
             else if (buff.target === 'energy') bonus.energy = buff.value;
             else if (buff.target === 'anycard') bonus.anycard = buff.value;
             else if (buff.target === 'card') bonus.card = buff.value;
             else if (buff.target === 'credit') bonus.credits = buff.value;
             else if (buff.target === 'data') bonus.data = buff.value;
             else if (buff.target === 'pv') bonus.pv = buff.value;

             const res = ResourceSystem.processBonuses(bonus, updatedGame, playerId, 'tech_mission', '');
             updatedGame = res.updatedGame;
             
             if (res.logs.length > 0) {
                 gains.push(...res.logs.map(l => `${l} (Mission "${buff.source}")`));
             }
             if (res.historyEntries) {
                 historyEntries.push(...res.historyEntries);
             }
             if (res.newPendingInteractions) {
                 newPendingInteractions.push(...res.newPendingInteractions);
             }

             if (buff.source) processedSources.add(buff.source);

             console.log(updatedGame);
             // Re-récupérer le joueur car updatedGame a pu changer (ex: pioche de carte)
             const currentPlayer = updatedGame.players.find(p => p.id === playerId);
             if (currentPlayer) {
                 const completed = CardSystem.updateMissionProgress(currentPlayer, buff);
                 if (completed) {
                     historyEntries.push({ message: `accomplit la mission "${completed}"`, playerId: playerId, sequenceId: '' });
                 }
             }
        }
    });

    // Traitement des buffs actifs (ex: Recherche Ciblée, Coopération Scientifique)
    const buffsToRemove: number[] = [];
    player.activeBuffs.forEach((buff, index) => {
        if (buff.type === 'SCORE_PER_TECH_TYPE') {
            // Identifier la catégorie de la tech acquise
            let categoryPrefix = '';
            if (tech.id.startsWith('exploration')) categoryPrefix = 'exploration';
            else if (tech.id.startsWith('observation')) categoryPrefix = 'observation';
            else if (tech.id.startsWith('computing')) categoryPrefix = 'computing';

            if (categoryPrefix) {
                // Compter les technologies de ce type possédées par le joueur (incluant la nouvelle)
                const count = player.technologies.filter(t => t.id.startsWith(categoryPrefix)).length;
                const points = count * buff.value;
                if (points > 0) {
                    player.score += points;
                    gains.push(`${points} PV (${buff.source})`);
                }
                buffsToRemove.push(index);
            }
        } else if (buff.type === 'MEDIA_IF_SHARED_TECH') {
            // Vérifier si un autre joueur possède une technologie de la même famille (même ID de base)
            // Les IDs sont du format 'category-X-Y', on veut 'category-X'
            const baseId = tech.id.substring(0, tech.id.lastIndexOf('-'));
            
            let isShared = false;
            for (const otherPlayer of game.players) {
                if (otherPlayer.id === playerId) continue;
                
                const hasSameTech = otherPlayer.technologies.some(t => t.id.startsWith(baseId));
                if (hasSameTech) {
                    isShared = true;
                    break;
                }
            }

            if (isShared) {
                player.mediaCoverage = Math.min(player.mediaCoverage + buff.value, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                gains.push(`${buff.value} Média (${buff.source})`);
            }
            buffsToRemove.push(index);
        }
    });

    // Nettoyer les buffs consommés
    if (buffsToRemove.length > 0) {
        player.activeBuffs = player.activeBuffs.filter((_, index) => !buffsToRemove.includes(index));
    }

    return { updatedGame, gains, historyEntries, newPendingInteractions };
  }
}