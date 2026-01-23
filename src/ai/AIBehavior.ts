import { Game, Player } from '../core/types';

export class AIBehavior {
  /**
   * Décide de l'action à entreprendre pour le robot.
   * Pour l'instant, le comportement est simple : passer son tour.
   */
  static decideAction(game: Game, player: Player): { action: 'PASS', cardsToKeep: string[], selectedCardId?: string } | null {
    // Mock behavior: always pass
    // Garder les 4 premières cartes (ou moins)
    const cardsToKeep = player.cards.slice(0, 4).map(c => c.id);
    
    let selectedCardId: string | undefined;
    const roundDeck = game.decks.roundDecks[game.currentRound];
    if (roundDeck && roundDeck.length > 0) {
        // Choisir la première carte disponible
        selectedCardId = roundDeck[0].id;
    }

    return { action: 'PASS', cardsToKeep, selectedCardId };
  }

  /**
   * Vérifie si le robot doit réclamer un palier d'objectif.
   * Retourne le palier et l'ID de la tuile objectif choisie.
   */
  static checkAndClaimMilestone(game: Game, player: Player): { milestone: number, tileId: string } | null {
    const milestones = [25, 50, 70];
    
    for (const m of milestones) {
      if (player.score >= m && !player.claimedGoldenMilestones.includes(m)) {
        // Trouver les tuiles où le joueur n'a pas encore de marqueur
        const availableTiles = (game.board.objectiveTiles || []).filter(t => !t.markers.includes(player.id));
        
        if (availableTiles.length > 0) {
          // Mock: Choisir une tuile au hasard parmi celles disponibles
          const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
          return { milestone: m, tileId: randomTile.id };
        }
      }
    }
    return null;
  }
}