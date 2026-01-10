import { Game } from '../core/types';
import { CardSystem } from './CardSystem';

export class ResourceSystem {
  static buyCard(game: Game, playerId: string): { updatedGame: Game, error?: string } {
    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    if (player.mediaCoverage < 3) {
      return { updatedGame: game, error: "Couverture médiatique insuffisante" };
    }

    player.mediaCoverage -= 3;
    const finalGame = CardSystem.drawCards(updatedGame, playerId, 1, 'Carte obtenue grâce à votre influence médiatique.');

    return { updatedGame: finalGame };
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
    } else if (normalizedGain === 'carte') {
        updatedGame = CardSystem.drawCards(updatedGame, playerId, 1, 'Carte obtenue par échange.');
    } else {
         return { updatedGame: game, error: "Type de ressource à recevoir invalide" };
    }

    return { updatedGame };
  }
}