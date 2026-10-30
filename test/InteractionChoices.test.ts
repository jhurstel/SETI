import { InteractionChoices } from '../src/core/InteractionChoices';
import { AIController } from '../src/ai/AIController';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { CardSystem } from '../src/systems/CardSystem';
import { Game, LifeTraceType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

describe('InteractionChoices', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('carte Alien : prend la carte, garde l\'interaction pour la suivante, sans modifier la partie reçue', () => {
    const species = game.species[0];
    const before = JSON.stringify(game);
    const handSize = getPlayer(game, P1).cards.length;

    const res = InteractionChoices.acquireAlienCard(game, P1, { type: 'ACQUIRING_ALIEN_CARD', count: 2, speciesId: species.id, sequenceId: 's' }, 'deck');

    expect(res.error).toBeUndefined();
    expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(handSize + 1);
    expect(res.historyEntries[0].message).toContain('de la pioche');
    expect(res.newPendingInteractions).toEqual([{ type: 'ACQUIRING_ALIEN_CARD', count: 1, speciesId: species.id, sequenceId: 's' }]);
    expect(JSON.stringify(game)).toBe(before);
  });

  test('robot : prend toutes les cartes Alien promises (régression : une seule pour un gain de 2)', () => {
    const species = game.species[0];
    const handSize = getPlayer(game, P1).cards.length;

    const res = AIController.processInteractionQueue(game, [{ type: 'ACQUIRING_ALIEN_CARD', count: 2, speciesId: species.id }], 'seq', getPlayer(game, P1));

    expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(handSize + 2);
  });

  test('tuile objectif déjà occupée : refusée, partie inchangée (régression : le joueur perdait son marqueur)', () => {
    const tile = game.board.objectiveTiles[0];
    tile.markers.push(P1);

    const res = InteractionChoices.placeObjectiveMarker(game, P1, { type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }, tile.id);

    expect(res.error).toBeDefined();
    expect(res.updatedGame).toBe(game);
  });

  test('tuile objectif libre : marqueur placé et message dans la séquence', () => {
    const tile = game.board.objectiveTiles[0];

    const res = InteractionChoices.placeObjectiveMarker(game, P1, { type: 'PLACING_OBJECTIVE_MARKER', milestone: 25, sequenceId: 'obj' }, tile.id);

    expect(res.updatedGame.board.objectiveTiles[0].markers).toContain(P1);
    expect(res.historyEntries).toEqual([expect.objectContaining({ playerId: P1, sequenceId: 'obj' })]);
    expect(game.board.objectiveTiles[0].markers).not.toContain(P1);
  });

  test('trace de vie : couleur non demandée refusée', () => {
    const res = InteractionChoices.placeLifeTrace(game, P1, { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }, 0, LifeTraceType.BLUE, 'triangle' as never);

    expect(res.error).toBeDefined();
    expect(res.updatedGame).toBe(game);
  });

  test('trace de vie : placée sur le premier emplacement proposé, sans découverte annoncée à tort', () => {
    // Indicateur resté actif d'une action précédente : ne doit pas annoncer de découverte
    game.isSpeciesDiscovered = true;
    const option = SpeciesSystem.lifeTraceOptions(game, LifeTraceType.RED)[0];

    const res = InteractionChoices.placeLifeTrace(game, P1, { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED, sequenceId: 't' }, option.boardIndex, option.color, option.location, option.slotIndex);

    expect(res.error).toBeUndefined();
    expect(res.updatedGame).not.toBe(game);
    expect(res.discoveredSpecies).toBeUndefined();
    expect(res.updatedGame.isSpeciesDiscovered).toBe(false);
    expect(res.historyEntries.every(e => e.sequenceId === 't')).toBe(true);
  });

  test('robot, Observation III : défausse une carte de la main pour un signal, comme le joueur humain', () => {
    const player = getPlayer(game, P1);
    const card = CardSystem.getHandCards(player)[0];
    const discardSize = game.decks.discardPile.length;

    const res = AIController.processInteractionQueue(game, [{ type: 'CHOOSING_OBS3_ACTION' }], 'seq', player);

    expect(getPlayer(res.updatedGame, P1).cards.some(c => c.id === card.id)).toBe(false);
    expect(res.updatedGame.decks.discardPile.filter(c => c.id === card.id)).toHaveLength(1);
    expect(res.updatedGame.decks.discardPile.length).toBe(discardSize + 1);
  });
});
