import { CardSystem } from '../src/systems/CardSystem';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { ComputerSystem } from '../src/systems/ComputerSystem';
import { FreeActionType, Game, RevenueType } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

/**
 * Opérations du moteur appelées par l'interface (et les robots) : chacune renvoie une nouvelle partie,
 * son historique, et ne modifie jamais la partie reçue.
 */
describe('Opérations du moteur utilisées par l\'interface', () => {
  const P1 = 'player_0';
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  describe('CardSystem.reserveCards', () => {
    test('une carte à revenu Crédit : +1 crédit et +1 revenu, la carte passe sous le plateau', () => {
      getPlayer(game, P1).cards = [makeCard('c1', { revenue: RevenueType.CREDIT })];
      const { credits, revenueCredits } = getPlayer(game, P1);
      const snapshot = JSON.stringify(game);

      const res = CardSystem.reserveCards(game, P1, ['c1'], 'seq');

      const p = getPlayer(res.updatedGame, P1);
      expect(p.credits).toBe(credits + 1);
      expect(p.revenueCredits).toBe(revenueCredits + 1);
      expect(p.reservedCards.map(c => c.id)).toEqual(['c1']);
      expect(p.cards).toEqual([]);
      expect(res.historyEntries).toEqual([{ message: expect.stringMatching(/^réserve carte "Carte c1" et gagne /), playerId: P1, sequenceId: 'seq' }]);
      expect(JSON.stringify(game)).toBe(snapshot);
    });

    test('une carte à revenu Carte : pioche une carte, nommée dans l\'historique', () => {
      getPlayer(game, P1).cards = [makeCard('c1', { revenue: RevenueType.CARD })];
      const res = CardSystem.reserveCards(game, P1, ['c1']);
      const p = getPlayer(res.updatedGame, P1);
      expect(p.cards).toHaveLength(1);
      expect(res.historyEntries[0].message).toContain(`"${p.cards[0].name}"`);
    });

    test('une carte absente de la main est ignorée', () => {
      const res = CardSystem.reserveCards(game, P1, ['absente']);
      expect(res.reservedCount).toBe(0);
      expect(res.historyEntries).toEqual([]);
    });
  });

  describe('CardSystem.acquireCard', () => {
    test("l'achat coûte 3 Médias ; sans assez de Médias, erreur", () => {
      getPlayer(game, P1).mediaCoverage = 2;
      expect(CardSystem.acquireCard(game, P1, undefined).error).toBeDefined();

      getPlayer(game, P1).mediaCoverage = 4;
      const rowCard = game.decks.cardRow[0];
      const res = CardSystem.acquireCard(game, P1, rowCard.id, {}, 'seq');
      expect(getPlayer(res.updatedGame, P1).mediaCoverage).toBe(1);
      expect(getPlayer(res.updatedGame, P1).cards.some(c => c.id === rowCard.id)).toBe(true);
      expect(res.historyEntries[0].message).toBe(`paye 3 médias pour acheter carte "${rowCard.name}" depuis la rangée`);
    });

    test('Subventions : la carte gagnée est révélée et son action gratuite appliquée, sans toucher la partie reçue', () => {
      game.decks.cardRow[0] = makeCard('sub', { freeAction: FreeActionType.MEDIA });
      const media = getPlayer(game, P1).mediaCoverage;
      const res = CardSystem.acquireCard(game, P1, 'sub', { isFree: true, triggerFreeAction: true });

      const p = getPlayer(res.updatedGame, P1);
      expect(p.mediaCoverage).toBe(media + 1);
      expect(p.cards.find(c => c.id === 'sub')!.isRevealed).toBe(true);
      expect(res.historyEntries[0].message).toBe('choisit carte "Carte sub" et gagne 1 Média');
      expect(game.decks.cardRow[0].isRevealed).toBe(false);
    });

    test('Subventions avec une carte Déplacement : un déplacement gratuit à effectuer', () => {
      game.decks.cardRow[0] = makeCard('mv', { freeAction: FreeActionType.MOVEMENT });
      const res = CardSystem.acquireCard(game, P1, 'mv', { isFree: true, triggerFreeAction: true }, 'seq');
      expect(res.newPendingInteractions).toEqual([{ type: 'MOVING_PROBE', count: 1, sequenceId: 'seq' }]);
    });
  });

  describe('CardSystem.discardForSignals', () => {
    test('une sélection de secteur par carte de la main, de la couleur de la carte', () => {
      const card = getPlayer(game, P1).cards[0];
      const res = CardSystem.discardForSignals(game, P1, [card.id, 'absente'], 'seq');
      expect(res.newPendingInteractions).toEqual([{ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, cardId: card.id, sequenceId: 'seq' }]);
    });

    test('aucune carte : un message, aucune interaction', () => {
      const res = CardSystem.discardForSignals(game, P1, [], 'seq');
      expect(res.newPendingInteractions).toEqual([]);
      expect(res.historyEntries[0].message).toBe('ne défausse aucune carte pour marquer des signaux');
    });
  });

  test('CardSystem.previewImmediateBonuses : gains annoncés par la carte', () => {
    const card = makeCard('p', {
      immediateEffects: [{ type: 'GAIN', target: 'DATA', value: 2 }, { type: 'GAIN', target: 'PROBE', value: 1 }, { type: 'ACTION', target: 'MOVEMENT', value: 3 }],
      passiveEffects: [{ type: 'SAMPLE_RETURN', value: true }],
    });
    expect(CardSystem.previewImmediateBonuses(card)).toEqual({ data: 2, probe: 1, movements: 3, sampleReturn: true });
  });

  describe('ResourceSystem.tradeResources', () => {
    test('2 crédits contre 1 énergie', () => {
      getPlayer(game, P1).credits = 3;
      const energy = getPlayer(game, P1).energy;
      const res = ResourceSystem.tradeResources(game, P1, 'credit', 'energy');
      expect(getPlayer(res.updatedGame, P1).credits).toBe(1);
      expect(getPlayer(res.updatedGame, P1).energy).toBe(energy + 1);
      expect(res.historyEntries[0].message).toMatch(/^échange .+ contre /);
      expect(getPlayer(game, P1).credits).toBe(3);
    });

    test('2 cartes contre 1 crédit : les cartes vont à la défausse, sans toucher la partie reçue', () => {
      const [a, b] = getPlayer(game, P1).cards;
      const discardBefore = game.decks.discardPile.length;
      const res = ResourceSystem.tradeResources(game, P1, 'card', 'credit', [a.id, b.id]);
      expect(res.updatedGame.decks.discardPile.slice(-2).map(c => c.id)).toEqual([a.id, b.id]);
      expect(res.historyEntries[0].message).toBe(`échange "${a.name}" et "${b.name}" contre ${ResourceSystem.formatResource(1, 'credit')}`);
      expect(game.decks.discardPile).toHaveLength(discardBefore);
    });

    test('pas assez de ressources : erreur', () => {
      getPlayer(game, P1).energy = 1;
      expect(ResourceSystem.tradeResources(game, P1, 'energy', 'credit').error).toBe("Pas assez d'énergie");
    });
  });

  describe('ProbeSystem.chooseMediaOrMove (carte 19)', () => {
    test('Média : +1 Média, puis les déplacements gratuits restants', () => {
      const media = getPlayer(game, P1).mediaCoverage;
      const res = ProbeSystem.chooseMediaOrMove(game, P1, 'MEDIA', 2, 'seq');
      expect(getPlayer(res.updatedGame, P1).mediaCoverage).toBe(media + 1);
      expect(res.nextInteraction).toEqual({ type: 'MOVING_PROBE', count: 2, sequenceId: 'seq' });
      expect(getPlayer(game, P1).mediaCoverage).toBe(media);
    });

    test('Déplacement : un déplacement gratuit de plus', () => {
      expect(ProbeSystem.chooseMediaOrMove(game, P1, 'MOVE', 2, 'seq').nextInteraction).toEqual({ type: 'MOVING_PROBE', count: 3, sequenceId: 'seq' });
      expect(ProbeSystem.chooseMediaOrMove(game, P1, 'MEDIA', 0).nextInteraction).toBeUndefined();
    });
  });

  test('ComputerSystem.canAssignTechnology : colonnes 1, 3, 5, 6 encore libres', () => {
    const player = getPlayer(game, P1);
    expect(ComputerSystem.canAssignTechnology(player, 2).canAssign).toBe(false);
    expect(ComputerSystem.canAssignTechnology(player, 3).canAssign).toBe(true);
    player.dataComputer.slots['3a'].bonus = '2pv';
    expect(ComputerSystem.canAssignTechnology(player, 3)).toEqual({ canAssign: false, reason: expect.stringContaining('occupé') });
  });

  test('ResourceSystem.updateMedia ne modifie pas la partie reçue', () => {
    const media = getPlayer(game, P1).mediaCoverage;
    ResourceSystem.updateMedia(game, P1, 2);
    expect(getPlayer(game, P1).mediaCoverage).toBe(media);
  });
});
