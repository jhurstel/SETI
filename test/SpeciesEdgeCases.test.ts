import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { AlienBoardType, Game, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

/** Plateau 0 révélé comme `species`, découvert, sans trace */
function discoveredBoard(game: Game, species: AlienBoardType) {
  const board = game.board.alienBoards[0];
  board.speciesId = species;
  board.isDiscovered = true;
  board.lifeTraces = [];
  return board;
}

describe('SpeciesSystem : cas limites', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  describe('spécimens Mascamites', () => {
    test('consulter : la récompense est gagnée, le jeton reste sur la planète', () => {
      const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
      jupiter.mascamiteTokens = [{ bonus: { credits: 2 } }];
      const credits = getPlayer(game, P1).credits;
      const res = SpeciesSystem.takeMascamiteSpecimen(game, P1, 'jupiter', 0, 'consult', 's')!;
      expect(getPlayer(res.updatedGame, P1).credits).toBe(credits + 2);
      expect(res.updatedGame.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens).toHaveLength(1);
      expect(res.historyEntries[0].message).toBe('étudie un spécimen Mascamite sur Jupiter');
      expect(jupiter.mascamiteTokens).toHaveLength(1);
    });

    test('pas de jeton à cet index : null', () => {
      game.board.planets.find(p => p.id === 'jupiter')!.mascamiteTokens = [];
      expect(SpeciesSystem.takeMascamiteSpecimen(game, P1, 'jupiter', 0, 'consult', 's')).toBeNull();
    });
  });

  describe('placement des traces de vie', () => {
    test('placement automatique limité à des plateaux sans emplacement possible : rien ne change', () => {
      const res = SpeciesSystem.placeLifeTraceAuto(game, LifeTraceType.RED, P1, 's', [99]);
      expect(res.updatedGame).toBe(game);
      expect(res.historyEntries).toEqual([]);
    });

    test('emplacements libres d\'une piste : aucun sans espèce ; l\'emplacement infini suivant après ceux déjà pris', () => {
      game.board.alienBoards[0].speciesId = 'Inconnue' as AlienBoardType;
      expect(SpeciesSystem.freeSpeciesSlotIndices(game, 0, LifeTraceType.RED)).toEqual([]);

      const board = discoveredBoard(game, AlienBoardType.ANOMALIES);
      const fixed = game.species.find(s => s.name === AlienBoardType.ANOMALIES)!.fixedSlots.redlifetrace.length;
      board.lifeTraces = [{ id: 't', type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.SPECIES, slotIndex: fixed }];
      const free = SpeciesSystem.freeSpeciesSlotIndices(game, 0, LifeTraceType.RED);
      expect(free).toContain(fixed + 1);
      expect(free).not.toContain(fixed);
    });

    test('sur la piste sans emplacement précisé : le premier emplacement libre de la couleur', () => {
      discoveredBoard(game, AlienBoardType.ANOMALIES);
      const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.YELLOW, P1, 's', LifeTraceLocation.SPECIES);
      expect(res.updatedGame.board.alienBoards[0].lifeTraces).toEqual([expect.objectContaining({ type: LifeTraceType.YELLOW, slotIndex: 0 })]);
    });

    test('piste Exertiens : le danger de l\'emplacement s\'ajoute à celui du joueur', () => {
      discoveredBoard(game, AlienBoardType.EXERTIENS);
      getPlayer(game, P1).danger = 1;
      const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.SPECIES, 0);
      const slotDanger = game.species.find(s => s.name === AlienBoardType.EXERTIENS)!.fixedSlots.redlifetrace[0].danger!;
      expect(getPlayer(res.updatedGame, P1).danger).toBe(1 + Math.abs(slotDanger));
    });

    test('trois couleurs sur un plateau d\'espèce inconnue : découverte sans planter, sans cartes distribuées', () => {
      const board = game.board.alienBoards[0];
      board.speciesId = 'Inconnue' as AlienBoardType;
      board.isDiscovered = false;
      board.lifeTraces = [
        { id: 'r', type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.TRIANGLE },
        { id: 'y', type: LifeTraceType.YELLOW, playerId: P1, location: LifeTraceLocation.TRIANGLE },
      ];
      const hand = getPlayer(game, P1).cards.length;
      const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.BLUE, P1, 's', LifeTraceLocation.TRIANGLE);
      expect(res.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);
      expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(hand);
    });
  });

  describe('Centauriens', () => {
    test('premier palier d\'un joueur : la liste est créée, à son score + 15', () => {
      const player = getPlayer(game, P1);
      player.score = 12;
      delete (player as { centaurienMilestones?: unknown }).centaurienMilestones;
      SpeciesSystem.addCentaurienMarker(player);
      expect(player.centaurienMilestones).toEqual([expect.objectContaining({ score: 27, cardId: undefined })]);
    });

    test('palier atteint : le plus bas non résolu', () => {
      const player = getPlayer(game, P1);
      player.centaurienMilestones = [
        { id: 'b', score: 30 },
        { id: 'a', score: 20 },
        { id: 'r', score: 10, resolved: 'déjà' },
      ];
      player.score = 25;
      expect(SpeciesSystem.reachedCentaurienMarker(player)?.id).toBe('a');
      player.score = 15;
      expect(SpeciesSystem.reachedCentaurienMarker(player)).toBeUndefined();
    });

    test('réception : palier inconnu, rien ; carte absente des cartes jouées, palier résolu sans gain', () => {
      expect(SpeciesSystem.receiveCentaurienCard(game, P1, 'inconnu').updatedGame).toBe(game);

      const player = getPlayer(game, P1);
      const card = makeCard('ET.99', { name: 'Signal perdu' });
      player.centaurienMilestones = [{ id: 'm', score: 0, cardId: card.id, cardName: card.name }];
      const res = SpeciesSystem.receiveCentaurienCard(game, P1, 'm');
      expect(res.historyEntries).toEqual([]);
      expect(getPlayer(res.updatedGame, P1).centaurienMilestones[0].resolved).toBe('Réception (« Signal perdu ») : carte absente');
      expect(player.centaurienMilestones[0].resolved).toBeUndefined();
    });
  });
});
