import { Game, Technology, GAME_CONSTANTS, TechnologyCategory } from '../core/types';
import { ComputerSystem } from './ComputerSystem';
import { ProbeSystem } from './ProbeSystem';
import { CardSystem } from './CardSystem';

export class TechnologySystem {

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

  static acquireTechnology(game: Game, playerId: string, tech: Technology, targetComputerCol?: number, noTileBonus: boolean = false): { updatedGame: Game, gains: string[] } {
    let updatedGame = structuredClone(game);
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, gains: [] };

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
        updatedGame = CardSystem.drawCards(updatedGame, player.id, tech.bonus.card, `Bonus technologie ${tech.name}`);
        gains.push(`${tech.bonus.card} Carte`);
      }
      if (tech.bonus.probe) {
        const result = ProbeSystem.launchProbe(updatedGame, player.id, true, false);
        if (result.probeId) {
            updatedGame.board = result.updatedGame.board;
            updatedGame.players = result.updatedGame.players;
            gains.push(`1 Sonde gratuite`);
        } else {
            gains.push(`1 Sonde (Perdue: Limite atteinte)`);
        }
      }
    }

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

    return { updatedGame, gains };
  }
}