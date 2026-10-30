import { effectNumber } from '../core/cardEffects';
import { cloneGame } from '../core/cloneGame';
import { Game, Technology, GAME_CONSTANTS, TechnologyCategory, HistoryEntry, InteractionState } from '../core/types';
import { ComputerSystem } from './ComputerSystem';
import { ProbeSystem } from './ProbeSystem';
import { CardSystem } from './CardSystem';

export class TechnologySystem {

  /** Pile d'une technologie : son identifiant sans le numéro d'exemplaire (« exploration-2-3 » → « exploration-2 ») */
  static stackId(tech: Technology): string {
    return tech.id.substring(0, tech.id.lastIndexOf('-'));
  }

  /**
   * Technologies que le joueur peut prendre : le dessus de chaque pile non vide, dans les catégories
   * autorisées, dont il n'a pas déjà un exemplaire, et (sharedOnly) qu'un adversaire possède déjà.
   * Même liste pour le joueur humain (plateau des technologies) et pour les robots.
   */
  static acquirableTechs(game: Game, playerId: string, options: { categories?: TechnologyCategory[]; sharedOnly?: boolean } = {}): Technology[] {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return [];
    const owned = new Set(player.technologies.map(t => this.stackId(t)));
    const shared = new Set(game.players.filter(p => p.id !== playerId).flatMap(p => p.technologies.map(t => this.stackId(t))));
    const result: Technology[] = [];
    (game.board.technologyBoard?.categorySlots || []).forEach(slot => {
      if (options.categories && !options.categories.includes(slot.category)) return;
      const seen = new Set<string>();
      slot.technologies.forEach(tech => {
        const stack = this.stackId(tech);
        if (seen.has(stack)) return;
        seen.add(stack);
        if (owned.has(stack) || (options.sharedOnly && !shared.has(stack))) return;
        result.push(tech);
      });
    });
    return result;
  }

  static canResearchTech(game: Game, playerId: string): { canResearch: boolean, reason?: string } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return { canResearch: false, reason: "Joueur non trouvé" };

    if (player.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
      return { canResearch: false, reason: `Couverture médiatique insuffisante (Requis: ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA})` };
    }

    return { canResearch: true };
  }

  /** Au moins une technologie disponible pour ce gain (sinon le gain est perdu) */
  public static canAcquireTech(game: Game, playerId: string, categories?: TechnologyCategory[]): boolean {
    return this.acquirableTechs(game, playerId, { categories }).length > 0;
  }

  static acquireTechnology(game: Game, playerId: string, tech: Technology, targetComputerCol?: number, noTileBonus: boolean = false): { updatedGame: Game, gains: string[], historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] } {
    let updatedGame = cloneGame(game);
    let player = updatedGame.players.find(p => p.id === playerId);
    const historyEntries: HistoryEntry[] = [];
    const newPendingInteractions: InteractionState[] = [];
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
    const gains: string[] = [];
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
        player = updatedGame.players.find(p => p.id === playerId)!;
        gains.push(`${tech.bonus.card} Carte`);
      }
      if (tech.bonus.probe) {
        const result = ProbeSystem.launchProbe(updatedGame, player.id, true, false);
        if (result.probeId) {
          updatedGame = result.updatedGame;
          player = updatedGame.players.find(p => p.id === playerId)!;
          historyEntries.push(...result.historyEntries);
          gains.push(`1 Sonde`);
        } else {
          gains.push(`1 Sonde (Perdue: Limite atteinte)`);
        }
      }
    }
    historyEntries.push({ message: `acquiert technologie "${tech.type} ${tech.name}"${gains.length > 0 ? ` et gagne ${gains.join(', ')}` : ''}`, playerId, sequenceId: '' });

    // Traitement des missions conditionnelles (GAIN_ON_TECH)
    const hasFulfillable = CardSystem.processMissionBuffs(player, buff => {
      if (tech.type === TechnologyCategory.EXPLORATION && buff.type === 'GAIN_ON_YELLOW_TECH') return true;
      if (tech.type === TechnologyCategory.OBSERVATION && buff.type === 'GAIN_ON_RED_TECH') return true;
      if (tech.type === TechnologyCategory.COMPUTING && buff.type === 'GAIN_ON_BLUE_TECH') return true;
      return false;
    });
    if (hasFulfillable) {
      historyEntries.push({ message: 'déclenche une mission à recouvrir', playerId, sequenceId: ''});
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
          const points = count * effectNumber(buff);
          if (points > 0) {
            player.score += Number(points);
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
          player.mediaCoverage = Math.min(player.mediaCoverage + (effectNumber(buff) || 0), GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
          gains.push(`${buff.value} Média (${buff.source})`);
          buffsToRemove.push(index);
        }
      }
    });

    // Nettoyer les buffs consommés
    if (buffsToRemove.length > 0) {
      player.activeBuffs = player.activeBuffs.filter((_, index) => !buffsToRemove.includes(index));
    }

    return { updatedGame, gains, historyEntries, newPendingInteractions };
  }
}