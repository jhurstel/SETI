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
  Player,
  HistoryEntry,
  InteractionState
} from '../core/types';
import { cloneGame } from '../core/cloneGame';
import { uniqueId } from '../core/ids';
import { CardSystem } from './CardSystem';

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

  /**
   * Transfère 1 donnée sur une case de l'ordinateur (action gratuite), joueur humain comme robot :
   * gains directs, message d'historique, et interactions des bonus à choix (réservation d'une carte
   * de la main, carte de la rangée ou de la pioche).
   */
  static transferData(game: Game, playerId: string, slotId: string, sequenceId: string = `computer-${uniqueId()}`): {
    updatedGame: Game;
    historyEntries: HistoryEntry[];
    newPendingInteractions: InteractionState[];
  } {
    const { updatedGame, gains, bonusEffects } = this.fillSlot(game, playerId, slotId);
    const player = updatedGame.players.find(p => p.id === playerId);
    if (updatedGame === game || !player) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

    const newPendingInteractions: InteractionState[] = [];
    bonusEffects.forEach(effect => {
      if (effect.type === 'reservation') {
        const count = Math.min(effect.amount, CardSystem.getHandCards(player).length);
        if (count > 0) newPendingInteractions.push({ type: 'RESERVING_CARD', count, selectedCards: [], sequenceId });
      } else if (effect.type === 'anycard') {
        newPendingInteractions.push({ type: 'ACQUIRING_CARD', count: effect.amount, isFree: true, sequenceId });
      }
    });

    let message = `transfère 1 donnée vers l'ordinateur${gains.length > 0 ? ` et gagne ${gains.join(', ')}` : ''}`;
    if (slotId === '6a') message += " et complète l'ordinateur";
    return { updatedGame, historyEntries: [{ message, playerId, sequenceId }], newPendingInteractions };
  }

  static fillSlot(game: Game, playerId: string, slotId: string): { updatedGame: Game, gains: string[], bonusEffects: { type: string, amount: number }[] } {
    // Copie profonde : les cases de l'ordinateur (dataComputer.slots) sont modifiées ci-dessous
    const updatedGame = cloneGame(game);
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
      let amount = 1;
      if (slot.technologyId && slot.technologyId.startsWith('computing-4')) {
        amount = 2;
      }
      player.mediaCoverage = Math.min((player.mediaCoverage || 0) + amount, GAME_CONSTANTS.MAX_MEDIA_COVERAGE || 10);
      gains.push(`${amount} Média${amount > 1 ? 's' : ''}`);
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
      bonusEffects.push({ type: 'anycard', amount: 1 });
      gains.push("1 Carte");
    }

    // Si la case 6a est remplie, on active la capacité d'analyse
    if (slotId === '6a') {
      player.dataComputer.canAnalyze = true;
    }

    return { updatedGame, gains, bonusEffects };
  }

  /** Colonnes de l'ordinateur pouvant recevoir une technologie Informatique */
  static readonly TECH_COLUMNS = [1, 3, 5, 6];

  /** Une technologie Informatique peut-elle être placée dans cette colonne (colonne prévue et encore libre) ? */
  static canAssignTechnology(player: Player, column: number): { canAssign: boolean; reason?: string } {
    if (!this.TECH_COLUMNS.includes(column)) return { canAssign: false, reason: 'Colonne non prévue pour une technologie' };
    if (player.dataComputer.slots?.[`${column}a`]?.bonus === '2pv') {
      return { canAssign: false, reason: 'Emplacement déjà occupé. Sélectionnez un autre emplacement.' };
    }
    return { canAssign: true };
  }

  static assignTechnology(player: Player, tech: Technology, column: number) {
    const slots = player.dataComputer.slots;
    const topSlotId = `${column}a`;
    const bottomSlotId = `${column}b`;

    if (slots[topSlotId]) {
      slots[topSlotId].bonus = '2pv';
      slots[topSlotId].isOccupied = true;
      slots[topSlotId].technologyId = tech.id;
    }

    // Déterminer le bonus du bas en fonction de la tech
    let bottomBonus = '';
    if (tech.id.startsWith('computing-1')) bottomBonus = 'credit';
    else if (tech.id.startsWith('computing-2')) bottomBonus = 'card';
    else if (tech.id.startsWith('computing-3')) bottomBonus = 'energy';
    else if (tech.id.startsWith('computing-4')) bottomBonus = 'media';

    if (slots[bottomSlotId] && bottomBonus) {
      slots[bottomSlotId].bonus = bottomBonus;
      slots[bottomSlotId].isOccupied = true;
      slots[bottomSlotId].technologyId = tech.id;
    }
  }

  static clearComputer(player: Player) {
    if (player.dataComputer) {
      Object.values(player.dataComputer.slots).forEach(slot => {
        slot.filled = false;
      });
    }
    if (player.dataComputer) {
      player.dataComputer.canAnalyze = false;
    }
  }
}
