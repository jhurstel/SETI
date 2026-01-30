import { Game, GAME_CONSTANTS, Bonus } from '../core/types';
import { CardSystem } from './CardSystem';

export class ResourceSystem {  
  static formatResource(amount: number, type: string): string {
    const absAmount = Math.abs(amount);
    const plural = absAmount > 1 ? 's' : '';
    let label = type;
    const key = type.toUpperCase();

    if (key === 'PV') label = 'PV';
    else if (key === 'MEDIA' || key === 'MEDIAS') label = `Média${plural}`;
    else if (key === 'DATA' || key === 'DATAS') label = `Donnée${plural}`;
    else if (key === 'CREDIT' || key === 'CREDITS') label = `Crédit${plural}`;
    else if (key === 'ENERGY' || key === 'ENERGIE') label = `Énergie${plural}`;
    else if (key === 'CARD' || key === 'CARDS' || key === 'CARTES') label = `Carte${plural}`;
    
    return `${amount} ${label}`;
  }

  // Helper pour formater les bonus
  static formatBonus(bonus: Bonus) {
    if (!bonus) return null;
    const items = [];
    if (bonus.pv) items.push(`${bonus.pv} PV`);
    if (bonus.media) items.push(`${bonus.media} Média`);
    if (bonus.credits) items.push(`${bonus.credits} Crédit`);
    if (bonus.energy) items.push(`${bonus.energy} Énergie`);
    if (bonus.card) items.push(`${bonus.card} Pioche`);
    if (bonus.data) items.push(`${bonus.data} Donnée`);
    if (bonus.planetscan) items.push(`${bonus.planetscan} Scan (Planète)`);
    if (bonus.redscan) items.push(`${bonus.redscan} Scan Rouge`);
    if (bonus.yellowscan) items.push(`${bonus.yellowscan} Scan Jaune`);
    if (bonus.bluescan) items.push(`${bonus.bluescan} Scan Bleu`);
    if (bonus.blackscan) items.push(`${bonus.blackscan} Scan Noir`);
    if (bonus.probescan) items.push(`${bonus.probescan} Scan Sonde`);
    if (bonus.earthscan) items.push(`${bonus.earthscan} Scan Terre`);
    if (bonus.rowscan) items.push(`${bonus.rowscan} Scan Rangée`);
    if (bonus.deckscan) items.push(`${bonus.deckscan} Scan Pioche`);
    if (bonus.anyscan) items.push(`${bonus.anyscan} Scan Quelconque`);
    if (bonus.revenue) items.push(`${bonus.revenue} Réservation`);
    if (bonus.anycard) items.push(`${bonus.anycard} Carte`);
    if (bonus.redlifetrace) items.push(`Trace Rouge`);
    if (bonus.yellowlifetrace) items.push(`Trace Jaune`);
    if (bonus.bluelifetrace) items.push(`Trace Bleu`);
    if (bonus.anytechnology) items.push(`${bonus.anytechnology} Tech`);
    if (bonus.probe) items.push(`${bonus.probe} Sonde`);
    if (bonus.landing) items.push(`${bonus.landing} Atterrisseur`);
    return items;
  };

  static buyCard(game: Game, playerId: string, cardIdFromRow?: string, isFree: boolean = false): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    
    // Copie profonde du joueur et de ses cartes
    updatedGame.players = updatedGame.players.map(p => p.id === playerId ? { ...p, cards: [...p.cards] } : p);
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    if (!isFree) {
      if (player.mediaCoverage < 3) {
        return { updatedGame: game, error: "Couverture médiatique insuffisante" };
      }

      player.mediaCoverage -= 3;
    }

    if (cardIdFromRow) {
      // Copie profonde de la rangée de cartes avant modification
      updatedGame.decks = {
        ...updatedGame.decks,
        cardRow: [...(updatedGame.decks.cardRow || [])]
      };

      const cardIndex = updatedGame.decks.cardRow.findIndex(c => c.id === cardIdFromRow);
      if (cardIndex !== -1) {
        const [card] = updatedGame.decks.cardRow.splice(cardIndex, 1);
        player.cards.push(card);
        updatedGame = CardSystem.refillCardRow(updatedGame);
      } else {
        return { updatedGame: game, error: "Carte non trouvée dans la rangée" };
      }
    } else {
      updatedGame = CardSystem.drawCards(updatedGame, playerId, 1, 'Achat');
    }

    return { updatedGame };
  }

  static tradeResources(game: Game, playerId: string, spendType: string, gainType: string, cardIdsToSpend?: string[]): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    const normalizedSpend = spendType.toLowerCase().trim().replace('é', 'e');
    const normalizedGain = gainType.toLowerCase().trim().replace('é', 'e');

    if (normalizedSpend === 'credit') {
        if (player.credits < 2) return { updatedGame: game, error: "Pas assez de crédits" };
        player.credits -= 2;
    } else if (normalizedSpend === 'energy') {
        if (player.energy < 2) return { updatedGame: game, error: "Pas assez d'énergie" };
        player.energy -= 2;
    } else if (normalizedSpend === 'card') {
        if (!cardIdsToSpend || cardIdsToSpend.length !== 2) return { updatedGame: game, error: "2 cartes doivent être sélectionnées" };
        player.cards = player.cards.filter(c => !cardIdsToSpend.includes(c.id));
    }

    if (normalizedGain === 'credit') {
        player.credits += 1;
    } else if (normalizedGain === 'energy') {
        player.energy += 1;
    } else if (normalizedGain === 'carte' || normalizedGain === 'card') {
        updatedGame = CardSystem.drawCards(updatedGame, playerId, 1, 'Echange');
    } else {
         return { updatedGame: game, error: "Type de ressource à recevoir invalide" };
    }

    return { updatedGame };
  }

  static updateMedia(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.mediaCoverage = Math.min(player.mediaCoverage + count, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
    return { updatedGame };
  }

  static updateCredit(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.credits += count;
    return { updatedGame };
  }

  static updateEnergy(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.energy += count;
    return { updatedGame };
  }

  static updateData(game: Game, playerId: string, count: number): { updatedGame: Game, error?: string } {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    player.data = Math.min(player.data + count, GAME_CONSTANTS.MAX_DATA);
    return { updatedGame };
  }
}