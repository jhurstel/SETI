import { Game, Technology, GAME_CONSTANTS } from '../core/types';
import { DataSystem } from './DataSystem';
import { ProbeSystem } from './ProbeSystem';
import { CardSystem } from './CardSystem';

export class TechnologySystem {
  static acquireTechnology(game: Game, playerId: string, tech: Technology, targetComputerCol?: number): { updatedGame: Game, gains: string[] } {
    let updatedGame = { ...game };
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

    // Computer slot assignment
    if (targetComputerCol !== undefined) {
      DataSystem.assignTechnology(player, tech, targetComputerCol);
    }

    // Apply bonuses
    let gains: string[] = [];
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
      const result = ProbeSystem.launchProbe(updatedGame, player.id, true);
      updatedGame.board = result.updatedGame.board;
      updatedGame.players = result.updatedGame.players;
      gains.push(`1 Sonde gratuite`);
    }

    return { updatedGame, gains };
  }
}