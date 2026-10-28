import { CardSystem } from '../src/systems/CardSystem';
import { GameEngine } from '../src/core/Game';
import { PlayCardAction } from '../src/actions/PlayCardAction';
import { DataLoader } from '../src/core/DataLoader';
import { AlienBoardType, CostType, FreeActionType, Game, LifeTraceLocation, LifeTraceType, RevenueType } from '../src/core/types';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { AIController } from '../src/ai/AIController';
import { createTestGame, getPlayer, makeCard, mockFetchFromPublic } from './helpers/gameFixture';

describe('CardSystem', () => {
  let game: Game;
  const P1 = 'player_0';
  const P2 = 'player_1';

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  describe('drawCards', () => {
    test('prend les cartes du dessus de la pioche', () => {
      const top = game.decks.cards.slice(0, 2).map(c => c.id);
      const handBefore = getPlayer(game, P1).cards.length;
      const updated = CardSystem.drawCards(game, P1, 2);

      expect(getPlayer(updated, P1).cards).toHaveLength(handBefore + 2);
      expect(getPlayer(updated, P1).cards.slice(-2).map(c => c.id)).toEqual(top);
      expect(updated.decks.cards).toHaveLength(game.decks.cards.length - 2);
    });

    test('s\'arrête quand la pioche est vide', () => {
      game.decks.cards = [makeCard('x1')];
      const updated = CardSystem.drawCards(game, P1, 3);
      expect(updated.decks.cards).toHaveLength(0);
      expect(getPlayer(updated, P1).cards.some(c => c.id === 'x1')).toBe(true);
    });

    test('ne modifie pas la partie d\'origine', () => {
      const deckSize = game.decks.cards.length;
      CardSystem.drawCards(game, P1, 2);
      expect(game.decks.cards).toHaveLength(deckSize);
    });
  });

  describe('reserveCard', () => {
    test.each([
      [RevenueType.CREDIT, 'revenueCredits', 'credits'],
      [RevenueType.ENERGY, 'revenueEnergy', 'energy'],
    ] as const)('revenu %s : +1 revenu et +1 ressource immédiate', (revenue, revenueKey, resourceKey) => {
      const player = getPlayer(game, P1);
      player.cards = [makeCard('r1', { revenue })];
      const updated = CardSystem.reserveCard(game, P1, 'r1');
      const after = getPlayer(updated, P1);

      expect(after.cards).toHaveLength(0);
      expect(after.reservedCards.map(c => c.id)).toEqual(['r1']);
      expect(after[revenueKey]).toBe(player[revenueKey] + 1);
      expect(after[resourceKey]).toBe(player[resourceKey] + 1);
    });

    test('revenu Pioche : +1 revenu carte et pioche immédiate', () => {
      getPlayer(game, P1).cards = [makeCard('r1', { revenue: RevenueType.CARD })];
      const updated = CardSystem.reserveCard(game, P1, 'r1');
      const after = getPlayer(updated, P1);

      expect(after.revenueCards).toBe(getPlayer(game, P1).revenueCards + 1);
      expect(after.cards).toHaveLength(1);
    });

    test('carte absente de la main : partie inchangée', () => {
      expect(CardSystem.reserveCard(game, P1, 'inconnue')).toBe(game);
    });
  });

  describe('défausses', () => {
    test('discardToHandSize garde uniquement les cartes choisies', () => {
      const hand = getPlayer(game, P1).cards;
      const keep = hand.slice(0, 2).map(c => c.id);
      const updated = CardSystem.discardToHandSize(game, P1, keep);

      expect(getPlayer(updated, P1).cards.map(c => c.id)).toEqual(keep);
      expect(updated.decks.discardPile).toHaveLength(hand.length - 2);
    });

    test('discardCard envoie la carte dans la défausse', () => {
      const cardId = getPlayer(game, P1).cards[0].id;
      const updated = CardSystem.discardCard(game, P1, cardId);

      expect(getPlayer(updated, P1).cards.some(c => c.id === cardId)).toBe(false);
      expect(updated.decks.discardPile.map(c => c.id)).toContain(cardId);
    });

    test('discardFromRow retire la carte de la rangée', () => {
      const cardId = game.decks.cardRow[0].id;
      const { updatedGame, discardedCard } = CardSystem.discardFromRow(game, cardId);

      expect(discardedCard?.id).toBe(cardId);
      expect(updatedGame.decks.cardRow).toHaveLength(2);
      expect(CardSystem.discardFromRow(game, 'inconnue').discardedCard).toBeNull();
    });

    test('discardCardForFreeAction (Média) : +1 média et carte défaussée', () => {
      const player = getPlayer(game, P1);
      player.mediaCoverage = 2;
      player.cards = [makeCard('f1', { freeAction: FreeActionType.MEDIA })];
      const { updatedGame, historyEntries } = CardSystem.discardCardForFreeAction(game, P1, 'f1');

      expect(getPlayer(updatedGame, P1).mediaCoverage).toBe(3);
      expect(getPlayer(updatedGame, P1).cards).toHaveLength(0);
      expect(historyEntries[0].message).toContain('défausse carte "Carte f1"');
    });
  });

  describe('refillCardRow', () => {
    test('complète la rangée jusqu\'à 3 cartes', () => {
      game.decks.cardRow = [];
      const updated = CardSystem.refillCardRow(game);
      expect(updated.decks.cardRow).toHaveLength(3);
      expect(game.decks.cardRow).toHaveLength(0);
    });

    test('ne dépasse pas la pioche disponible', () => {
      game.decks.cardRow = [];
      game.decks.cards = [makeCard('only')];
      expect(CardSystem.refillCardRow(game).decks.cardRow.map(c => c.id)).toEqual(['only']);
    });
  });

  describe('buyCard', () => {
    test('coûte 3 médias, prend la carte de la rangée et la recomplète', () => {
      getPlayer(game, P1).mediaCoverage = 4;
      const cardId = game.decks.cardRow[1].id;
      const { updatedGame, error } = CardSystem.buyCard(game, P1, cardId);

      expect(error).toBeUndefined();
      expect(getPlayer(updatedGame, P1).mediaCoverage).toBe(1);
      expect(getPlayer(updatedGame, P1).cards.some(c => c.id === cardId)).toBe(true);
      expect(updatedGame.decks.cardRow).toHaveLength(3);
      expect(updatedGame.decks.cardRow.some(c => c.id === cardId)).toBe(false);
    });

    test('sans carte ciblée, pioche dans le paquet', () => {
      getPlayer(game, P1).mediaCoverage = 3;
      const top = game.decks.cards[0].id;
      const { updatedGame } = CardSystem.buyCard(game, P1);
      expect(getPlayer(updatedGame, P1).cards.some(c => c.id === top)).toBe(true);
    });

    test('refusé avec moins de 3 médias, sauf si gratuit', () => {
      getPlayer(game, P1).mediaCoverage = 2;
      expect(CardSystem.buyCard(game, P1).error).toBe('Couverture médiatique insuffisante');

      const { updatedGame, error } = CardSystem.buyCard(game, P1, undefined, true);
      expect(error).toBeUndefined();
      expect(getPlayer(updatedGame, P1).mediaCoverage).toBe(2);
    });

    test('erreur si la carte n\'est pas dans la rangée', () => {
      getPlayer(game, P1).mediaCoverage = 5;
      expect(CardSystem.buyCard(game, P1, 'inconnue').error).toBe('Carte non trouvée dans la rangée');
    });

    test('ne modifie pas la partie d\'origine', () => {
      getPlayer(game, P1).mediaCoverage = 5;
      const rowIds = game.decks.cardRow.map(c => c.id);
      const handSize = getPlayer(game, P1).cards.length;
      CardSystem.buyCard(game, P1, rowIds[0]);

      expect(getPlayer(game, P1).mediaCoverage).toBe(5);
      expect(getPlayer(game, P1).cards).toHaveLength(handSize);
      expect(game.decks.cardRow.map(c => c.id)).toEqual(rowIds);
    });
  });

  describe('getPlayableCardIds', () => {
    test('ne garde que les cartes de la main que le joueur peut payer', () => {
      const player = getPlayer(game, P1);
      player.credits = 2;
      player.cards = [makeCard('cheap', { cost: 1 }), makeCard('expensive', { cost: 5 })];
      expect(CardSystem.getPlayableCardIds(game, P1)).toEqual(['cheap']);
    });
  });

  describe('playCard', () => {
    test("les interactions d'une carte jouée (technologie) appartiennent à la séquence de la carte (historique indenté)", async () => {
      const fetchSpy = mockFetchFromPublic();
      const card = (await DataLoader.loadCards('cards/main.csv')).find(c => c.id === '61')!;
      fetchSpy.mockRestore();

      const player = getPlayer(game, P1);
      player.credits = 10;
      player.cards = [card];
      const engine = new GameEngine(game);
      const action = new PlayCardAction(P1, '61');
      expect(engine.executeAction(action).success).toBe(true);

      const sequenceId = action.historyEntries[0].sequenceId;
      expect(sequenceId).toBeTruthy();
      expect(action.newPendingInteractions).toContainEqual(expect.objectContaining({ type: 'ACQUIRING_TECH' }));
      action.newPendingInteractions.forEach(i => expect(i.sequenceId).toBe(sequenceId));
    });

    test.each([
      ['cards/main.csv', '75'],
      ['cards/anomalies.csv', 'ET.19'],
    ])('%s #%s « Gagnez 1 Trace de Vie » déclenche le placement d\'une trace (régression)', async (file, cardId) => {
      const fetchSpy = mockFetchFromPublic();
      const card = (await DataLoader.loadCards(file)).find(c => c.id === cardId)!;
      fetchSpy.mockRestore();

      const player = getPlayer(game, P1);
      player.credits = 10;
      player.cards = [card];
      const { newPendingInteractions } = CardSystem.playCard(game, P1, cardId);

      expect(newPendingInteractions).toContainEqual(
        expect.objectContaining({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.ANY })
      );
    });
  });

  describe('carte 75 « Étude sur les Extrêmophiles »', () => {
    const playCard75 = async () => {
      const fetchSpy = mockFetchFromPublic();
      const card = (await DataLoader.loadCards('cards/main.csv')).find(c => c.id === '75')!;
      fetchSpy.mockRestore();
      const player = getPlayer(game, P1);
      player.credits = 10;
      player.cards = [card];
      return CardSystem.playCard(game, P1, '75').updatedGame;
    };

    test('après la trace gagnée : 1 PV par trace de vie de cette couleur (celle-ci comprise)', async () => {
      game.players[0].lifeTraces = [{ id: 'old', type: LifeTraceType.RED, playerId: P1 }];
      const afterPlay = await playCard75();
      const scoreBefore = getPlayer(afterPlay, P1).score;

      const res = SpeciesSystem.placeLifeTrace(afterPlay, 0, LifeTraceType.RED, P1, 'seq', LifeTraceLocation.TRIANGLE);

      expect(getPlayer(res.updatedGame, P1).score - scoreBefore).toBeGreaterThanOrEqual(2);
      expect(res.historyEntries.some(e => e.message.includes('2 traces de vie Rouge'))).toBe(true);
      expect(getPlayer(res.updatedGame, P1).activeBuffs.some(b => b.type === 'SCORE_PER_TRACE')).toBe(false);
    });

    test('les traces suivantes ne rapportent plus ce bonus', async () => {
      const afterPlay = await playCard75();
      const first = SpeciesSystem.placeLifeTrace(afterPlay, 0, LifeTraceType.BLUE, P1, 'seq', LifeTraceLocation.TRIANGLE).updatedGame;
      const second = SpeciesSystem.placeLifeTrace(first, 0, LifeTraceType.BLUE, P1, 'seq2', LifeTraceLocation.TRIANGLE);

      expect(second.historyEntries.some(e => e.message.includes('Extrêmophiles'))).toBe(false);
    });
  });

  describe('placement automatique (robots)', () => {
    test('une trace « de n\'importe quelle couleur » reçoit une vraie couleur', () => {
      for (let i = 0; i < 10; i++) {
        const res = SpeciesSystem.placeLifeTraceAuto(game, LifeTraceType.ANY, P1, 'seq');
        const trace = getPlayer(res.updatedGame, P1).lifeTraces.at(-1)!;
        expect([LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE]).toContain(trace.type);
      }
    });

    test("sur un plateau découvert, la trace va sur la piste d'espèce quand elle ne fait pas avancer l'autre découverte", () => {
      game.board.alienBoards[0].lifeTraces = [{ id: 't', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.TRIANGLE }];
      game.board.alienBoards[1].speciesId = AlienBoardType.MASCAMITES;
      game.board.alienBoards[1].isDiscovered = true;
      const res = SpeciesSystem.placeLifeTraceAuto(game, LifeTraceType.RED, P1, 'seq');
      const trace = res.updatedGame.board.alienBoards[1].lifeTraces.find(t => t.playerId === P1)!;
      expect(trace).toMatchObject({ type: LifeTraceType.RED, location: LifeTraceLocation.SPECIES, slotIndex: 0 });
      expect(res.updatedGame.board.alienBoards[0].lifeTraces.some(t => t.playerId === P1)).toBe(false);
    });

    test("la découverte d'abord : une couleur qui manque à l'autre espèce passe avant la piste d'une espèce découverte (régression)", () => {
      game.board.alienBoards[1].speciesId = AlienBoardType.MASCAMITES;
      game.board.alienBoards[1].isDiscovered = true;
      const res = SpeciesSystem.placeLifeTraceAuto(game, LifeTraceType.RED, P1, 'seq');
      expect(res.updatedGame.board.alienBoards[0].lifeTraces.find(t => t.playerId === P1)?.location).toBe(LifeTraceLocation.TRIANGLE);
      expect(res.updatedGame.board.alienBoards[1].lifeTraces.some(t => t.playerId === P1)).toBe(false);
    });

    test("Oumuamua sans tokens : la trace prend un autre emplacement libre de la piste, pas le triangle (régression)", () => {
      game.board.alienBoards[0].lifeTraces = [{ id: 't', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.TRIANGLE }];
      game.board.alienBoards[1].speciesId = AlienBoardType.OUMUAMUA;
      game.board.alienBoards[1].isDiscovered = true;
      getPlayer(game, P1).tokens = 0;
      const res = SpeciesSystem.placeLifeTraceAuto(game, LifeTraceType.RED, P1, 'seq');
      const trace = res.updatedGame.board.alienBoards[1].lifeTraces.find(t => t.playerId === P1);
      expect(trace).toMatchObject({ location: LifeTraceLocation.SPECIES, slotIndex: 1 });
    });

    test('tous les emplacements libres de la piste sont proposés, dans n\'importe quel ordre', () => {
      const board = game.board.alienBoards[1];
      board.speciesId = AlienBoardType.OUMUAMUA;
      board.isDiscovered = true;
      board.lifeTraces = [{ id: 't', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.SPECIES, slotIndex: 1 }];
      // 4 emplacements fixes (le 1 est pris), puis l'emplacement infini
      expect(SpeciesSystem.freeSpeciesSlotIndices(game, 1, LifeTraceType.RED)).toEqual([0, 2, 3, 4]);
    });

    test("Exertiens : pas d'emplacement infini, une piste pleine envoie la trace sur un emplacement excédentaire", () => {
      const board = game.board.alienBoards[1];
      board.speciesId = AlienBoardType.EXERTIENS;
      board.isDiscovered = true;
      board.lifeTraces = [{ id: 't', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.SPECIES, slotIndex: 1 }];
      expect(SpeciesSystem.freeSpeciesSlotIndices(game, 1, LifeTraceType.RED)).toEqual([0, 2, 3, 4]);

      // Piste rouge pleine (5 emplacements fixes) : plus aucun emplacement d'espèce
      board.lifeTraces = [0, 1, 2, 3, 4].map(i => ({ id: `t${i}`, type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.SPECIES, slotIndex: i }));
      expect(SpeciesSystem.freeSpeciesSlotIndices(game, 1, LifeTraceType.RED)).toEqual([]);
      game.board.alienBoards[0].lifeTraces = [{ id: 'a', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.TRIANGLE }];
      const before = JSON.stringify(game);
      const res = SpeciesSystem.placeLifeTraceAuto(game, LifeTraceType.RED, P1, 'seq');
      const placed = res.updatedGame.board.alienBoards.flatMap(b => b.lifeTraces).filter(t => t.playerId === P1);
      expect(placed).toHaveLength(1);
      expect(placed[0].location).not.toBe(LifeTraceLocation.SPECIES);
      expect(JSON.stringify(game)).toBe(before);
    });

    test.each(['EASY', 'MEDIUM'] as const)("robot %s : l'emplacement est choisi par évaluation, sans modifier la partie reçue", (level) => {
      const medium = getPlayer(game, P1);
      medium.type = 'robot';
      medium.aiDifficulty = level;
      game.board.alienBoards[1].speciesId = AlienBoardType.MASCAMITES;
      game.board.alienBoards[1].isDiscovered = true;
      const snapshot = JSON.stringify(game);
      const res = AIController.processInteractionQueue(game, [{ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }], 'seq', medium);
      expect(getPlayer(res.updatedGame, P1).lifeTraces).toHaveLength(1);
      expect(JSON.stringify(game)).toBe(snapshot);
    });

    test("sans espèce découverte, la trace va sur un triangle où sa couleur manque", () => {
      game.board.alienBoards[0].lifeTraces = [{ id: 't', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.TRIANGLE }];
      const res = SpeciesSystem.placeLifeTraceAuto(game, LifeTraceType.RED, P1, 'seq');
      expect(res.updatedGame.board.alienBoards[1].lifeTraces.find(t => t.playerId === P1)?.location).toBe(LifeTraceLocation.TRIANGLE);
    });
  });

  describe('réservation par un robot', () => {
    test('la carte réservée vient de la main et rapporte son revenu', () => {
      const card = makeCard('res', { revenue: RevenueType.CREDIT });
      getPlayer(game, P1).cards = [card];
      const { credits, revenueCredits } = getPlayer(game, P1);
      const res = AIController.processInteractionQueue(game, [{ type: 'RESERVING_CARD', count: 1, selectedCards: [] }], 'seq', getPlayer(game, P1));
      expect(getPlayer(res.updatedGame, P1).reservedCards.map(c => c.id)).toEqual(['res']);
      expect(getPlayer(res.updatedGame, P1).credits).toBe(credits + 1);
      expect(getPlayer(res.updatedGame, P1).revenueCredits).toBe(revenueCredits + 1);
      expect(res.historyEntries[0].message).toContain('et gagne');
    });
  });

  describe('canPlayCard', () => {
    test('vérifie le coût en crédits', () => {
      getPlayer(game, P1).credits = 2;
      expect(CardSystem.canPlayCard(game, P1, makeCard('c', { cost: 2 })).canPlay).toBe(true);
      expect(CardSystem.canPlayCard(game, P1, makeCard('c', { cost: 3 })).canPlay).toBe(false);
    });

    test('vérifie le coût en énergie', () => {
      getPlayer(game, P1).energy = 1;
      const card = makeCard('c', { cost: 2, costType: CostType.ENERGY });
      expect(CardSystem.canPlayCard(game, P1, card)).toMatchObject({ canPlay: false, reason: expect.stringContaining('Énergie') });
    });

    test('refusé hors de son tour', () => {
      expect(CardSystem.canPlayCard(game, P2, makeCard('c', { cost: 0 })).reason).toBe("Ce n'est pas votre tour");
    });
  });
});
