import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { CardSystem } from '../src/systems/CardSystem';
import { ScoreManager } from '../src/core/ScoreManager';
import { AIController } from '../src/ai/AIController';
import { AITurn } from '../src/ai/AITurn';
import { PassAction } from '../src/actions/PassAction';
import { AlienBoardType, Card, CardType, Game, Technology, TechnologyCategory } from '../src/core/types';
import { AIEvaluator, DEFAULT_WEIGHTS } from '../src/ai/AIEvaluator';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const exertien = (id: string, danger: number): Card =>
  makeCard(id, { type: CardType.EXERTIEN, danger, name: `Exertien ${id}`, description: `DANGER ${danger}. Fin de jeu: ...` });

describe('Exertiens', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.exertienMilestones = [30, 50];
    // Isoler les paliers Exertiens : le palier doré de 25 PV est déjà réclamé
    game.players.forEach(p => (p.claimedGoldenMilestones = [25]));
  });

  describe('découverte', () => {
    test('chaque joueur reçoit 3 cartes Exertiens (régression : comparaison sur species.id)', () => {
      const boardIndex = 0;
      game.board.alienBoards[boardIndex].speciesId = AlienBoardType.EXERTIENS;
      game.board.alienBoards[boardIndex].lifeTraces = [];
      const species = game.species.find(s => s.name === AlienBoardType.EXERTIENS)!;
      const deckSize = species.cards.length;

      const { updatedGame } = SpeciesSystem['distributeDiscoveryCards'](game, boardIndex);

      updatedGame.players.forEach(p => {
        expect(p.cards.filter(c => c.type === CardType.EXERTIEN)).toHaveLength(3);
      });
      expect(updatedGame.species.find(s => s.name === AlienBoardType.EXERTIENS)!.cards).toHaveLength(deckSize - 6);
    });
  });

  describe('palier (ScoreManager.checkScoreMilestones)', () => {
    test('déclenche le choix d\'une carte quand le joueur a des cartes Exertiens', () => {
      const player = getPlayer(game, P1);
      player.score = 31;
      player.cards.push(exertien('e1', 3));

      const res = ScoreManager.checkScoreMilestones(game, P1);

      expect(res.shouldStop).toBe(true);
      expect(res.newInteraction).toEqual({ type: 'CHOOSING_EXERTIEN_CARD', milestone: 30 });
    });

    test('un palier déjà utilisé ne se redéclenche pas', () => {
      const player = getPlayer(game, P1);
      player.score = 31;
      player.cards.push(exertien('e1', 3));
      player.claimedExertienMilestones = [30];

      expect(ScoreManager.checkScoreMilestones(game, P1).shouldStop).toBe(false);
    });

    test('sans carte Exertien, le palier est consommé sans interaction', () => {
      getPlayer(game, P1).score = 31;
      const res = ScoreManager.checkScoreMilestones(game, P1);

      expect(res.shouldStop).toBe(false);
      expect(getPlayer(res.updatedGame, P1).claimedExertienMilestones).toEqual([30]);
    });

    test('les paliers sont propres à chaque joueur', () => {
      getPlayer(game, P1).claimedExertienMilestones = [30];
      const p2 = getPlayer(game, P2);
      p2.score = 31;
      p2.cards.push(exertien('e2', 1));

      expect(ScoreManager.checkScoreMilestones(game, P2).newInteraction).toEqual({ type: 'CHOOSING_EXERTIEN_CARD', milestone: 30 });
    });
  });

  describe('SpeciesSystem.playExertienCard', () => {
    beforeEach(() => {
      getPlayer(game, P1).cards.push(exertien('e1', 4), exertien('e2', 7));
      getPlayer(game, P1).danger = 1;
    });

    test('joue la carte face cachée, ajoute son danger et consomme le palier', () => {
      const { updatedGame, historyEntries } = SpeciesSystem.playExertienCard(game, P1, 30, 'e2');
      const player = getPlayer(updatedGame, P1);

      expect(player.cards.some(c => c.id === 'e2')).toBe(false);
      expect(player.playedCards.map(c => c.id)).toContain('e2');
      expect(player.danger).toBe(8);
      expect(player.claimedExertienMilestones).toEqual([30]);
      expect(historyEntries[0].message).toContain('face cachée');
      expect(historyEntries[0].message).not.toContain('Exertien e2'); // la carte reste secrète
    });

    test('renoncer consomme le palier sans jouer de carte', () => {
      const { updatedGame } = SpeciesSystem.playExertienCard(game, P1, 30);
      const player = getPlayer(updatedGame, P1);

      expect(player.cards.filter(c => c.type === CardType.EXERTIEN)).toHaveLength(2);
      expect(player.danger).toBe(1);
      expect(player.claimedExertienMilestones).toEqual([30]);
    });

    test('refuse une carte qui n\'est pas une carte Exertien du joueur', () => {
      const normal = getPlayer(game, P1).cards[0].id;
      expect(SpeciesSystem.playExertienCard(game, P1, 30, normal).error).toBeDefined();
      expect(SpeciesSystem.playExertienCard(game, P1, 30, 'inconnue').error).toBeDefined();
    });

    test('ne modifie pas la partie d\'origine', () => {
      const before = JSON.stringify(game);
      SpeciesSystem.playExertienCard(game, P1, 30, 'e1');
      expect(JSON.stringify(game)).toBe(before);
    });
  });

  describe('les cartes Exertiens ne sont pas des cartes en main (FAQ Q40)', () => {
    beforeEach(() => {
      getPlayer(game, P1).cards.push(exertien('e1', 2));
    });

    test('elles ne peuvent être ni défaussées, ni réservées, ni jouées normalement', () => {
      expect(getPlayer(CardSystem.discardCard(game, P1, 'e1'), P1).cards.some(c => c.id === 'e1')).toBe(true);
      expect(CardSystem.reserveCard(game, P1, 'e1')).toBe(game);
      expect(CardSystem.canPlayCard(game, P1, exertien('e1', 2)).canPlay).toBe(false);
      expect(CardSystem.getHandCards(getPlayer(game, P1)).some(c => c.id === 'e1')).toBe(false);
    });

    test('elles sont conservées en passant et ne comptent pas dans les 4 cartes', () => {
      const hand = CardSystem.getHandCards(getPlayer(game, P1)).map(c => c.id);
      const action = new PassAction(P1, hand.slice(0, 4));

      expect(action.validate(game).valid).toBe(true);
      const updated = action.execute(game);
      expect(getPlayer(updated, P1).cards.some(c => c.id === 'e1')).toBe(true);
      expect(action.historyEntries.some(e => e.message.includes('Exertien e1'))).toBe(false);
    });
  });

  describe('IA', () => {
    // Carte Exertien avec sa condition de fin de partie : END_CONDITION:TECH:<catégorie>:<seuil>:<PV>
    const withCondition = (id: string, danger: number, category: string, threshold: number, points: number): Card => ({
      ...exertien(id, danger),
      passiveEffects: [{ type: 'END_CONDITION', target: 'TECH', value: `${category}:${threshold}:${points}` }],
    });
    const giveTechs = (g: Game, playerId: string, category: TechnologyCategory, count: number) => {
      const player = getPlayer(g, playerId);
      for (let i = 0; i < count; i++) player.technologies.push({ ...player.technologies[0], id: `${category}-${i}-1`, type: category } as Technology);
    };

    test('AIController joue la carte dont la condition est remplie, même plus dangereuse', () => {
      const player = getPlayer(game, P1);
      game.currentRound = 3;
      player.score = 40;
      giveTechs(game, P1, TechnologyCategory.EXPLORATION, 3);
      // e2 rapporte plus que la pénalité de danger attendue (le joueur devient le plus exposé)
      player.cards.push(withCondition('e1', 2, 'computing', 3, 9), withCondition('e2', 6, 'exploration', 3, 30));

      const res = AIController.processInteractionQueue(game, [{ type: 'CHOOSING_EXERTIEN_CARD', milestone: 30 }], 'seq', player);

      expect(getPlayer(res.updatedGame, P1).playedCards.map(c => c.id)).toEqual(['e2']);
      expect(getPlayer(game, P1).playedCards.map(c => c.id)).toEqual([]);
    });

    test("AIController renonce quand aucune condition n'est engagée : le danger coûterait la pénalité", () => {
      const player = getPlayer(game, P1);
      player.score = 60;
      player.cards.push(withCondition('e1', 3, 'computing', 3, 9), withCondition('e2', 6, 'observation', 3, 15));

      const res = AIController.processInteractionQueue(game, [{ type: 'CHOOSING_EXERTIEN_CARD', milestone: 30 }], 'seq', player);

      expect(getPlayer(res.updatedGame, P1).playedCards).toEqual([]);
      expect(getPlayer(res.updatedGame, P1).claimedExertienMilestones).toEqual([30]);
    });

    test("l'évaluation retire la pénalité de danger attendue, moins si un adversaire est plus exposé", () => {
      const player = getPlayer(game, P1);
      player.score = 50;
      const base = AIEvaluator.evaluate(game, P1);
      player.playedCards.push(exertien('e1', 4));
      const exposed = AIEvaluator.evaluate(game, P1);
      getPlayer(game, P2).playedCards.push(exertien('e2', 6));
      const lessExposed = AIEvaluator.evaluate(game, P1);

      // 10 % du score final estimé (au moins le score actuel), moins la valeur d'une carte jouée (poids commun à toutes les cartes)
      expect(exposed).toBeLessThanOrEqual(base - 5 + DEFAULT_WEIGHTS.playedCard + 1e-9);
      expect(lessExposed).toBeGreaterThan(exposed);
      expect(lessExposed).toBeLessThan(base);
    });

    test('un robot qui atteint un palier Exertien termine son tour sans blocage', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const player = getPlayer(game, P1);
      player.type = 'robot';
      player.score = 31;
      player.cards.push(exertien('e1', 3));

      const end = AITurn.endTurn(game);

      expect(end.updatedGame.currentPlayerIndex).toBe(1);
      expect(getPlayer(end.updatedGame, P1).claimedExertienMilestones).toHaveLength(1);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
