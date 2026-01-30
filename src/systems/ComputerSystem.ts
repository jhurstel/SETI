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
  GAME_CONSTANTS,
  Technology,
  Player
} from '../core/types';

export class ComputerSystem {
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

  static canFillSlot(player: Player, slotId: string): boolean {
    if (!player.dataComputer) return false;
    const slots = player.dataComputer.slots;
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
      const prevTopSlot = Object.values(slots).find((s) => s.col === prevCol && s.type === 'top');
      if (prevTopSlot && !prevTopSlot.filled) return false;
    }

    return true;
  }

  static fillSlot(game: Game, playerId: string, slotId: string): { updatedGame: Game, gains: string[], bonusEffects: { type: string, amount: number }[] } {
    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { updatedGame: game, gains: [], bonusEffects: [] };
    
    const player = updatedGame.players[playerIndex];
    
    if (!this.canFillSlot(player, slotId)) {
        return { updatedGame: game, gains: [], bonusEffects: [] };
    }

    const slot = player.dataComputer.slots[slotId]!;
    
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
    if (slotId === '6a') {
      player.dataComputer.canAnalyze = true;
      gains.push("Analyse activée");
    }

    return { updatedGame, gains, bonusEffects };
  }

  static assignTechnology(player: Player, tech: Technology, column: number) {
    const slots = player.dataComputer.slots;
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

  static clearComputer(player: Player) {
    if (player.dataComputer) {
      Object.values(player.dataComputer.slots).forEach((slot: any) => {
        slot.filled = false;
      });
    }
    if (player.dataComputer) {
        player.dataComputer.canAnalyze = false;
    }
  }
}
