import { CardSystem } from '../src/systems/CardSystem';
import { Game } from '../src/core/types';
import { createTestGame, getPlayer, giveCard } from './helpers/gameFixture';

const P1 = 'player_0';

/** Donne au joueur la carte du catalogue `id` et assez de ressources pour la jouer. */
function giveCatalogCard(game: Game, id: string) {
  const card = giveCard(game, P1, id);
  getPlayer(game, P1).credits = 10;
  getPlayer(game, P1).energy = 10;
  return card;
}

describe('CardSystem.playCard : effets passifs', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('92 Photo du Jour de la NASA : réservée sous les revenus Pioche, pioche une seule carte (régression : deux)', () => {
    const card = giveCatalogCard(game, '92');
    const player = getPlayer(game, P1);
    const handBefore = player.cards.length;
    const revenueBefore = player.revenueCards;
    const mediaBefore = player.mediaCoverage;

    const { updatedGame } = CardSystem.playCard(game, P1, card.id);
    const after = getPlayer(updatedGame, P1);

    expect(after.revenueCards).toBe(revenueBefore + 1);
    // La carte jouée quitte la main, la réservation fait piocher 1 carte
    expect(after.cards).toHaveLength(handBefore - 1 + 1);
    expect(after.mediaCoverage).toBe(mediaBefore + 2);
  });

  test('91 Réacteur à Fusion : réservée sous les revenus Energie, +1 Energie', () => {
    const card = giveCatalogCard(game, '91');
    const player = getPlayer(game, P1);
    const energyBefore = player.energy;
    const revenueBefore = player.revenueEnergy;

    const { updatedGame } = CardSystem.playCard(game, P1, card.id);
    const after = getPlayer(updatedGame, P1);

    expect(after.revenueEnergy).toBe(revenueBefore + 1);
    expect(after.energy).toBe(energyBefore + 1);
  });
});
