import { TurnManager } from '../src/core/TurnManager';
import { GameEngine } from '../src/core/Game';
import { PassAction } from '../src/actions/PassAction';
import { CardType, Game, GamePhase, InteractionState, LifeTraceType } from '../src/core/types';
import { InteractionChoices } from '../src/core/InteractionChoices';
import { revealText } from '../src/core/historyText';
import { ScoreManager } from '../src/core/ScoreManager';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';
import { DISCOVERY_NOTICE } from '../src/systems/SpeciesSystem';

const P1 = 'player_0';
const P2 = 'player_1';

describe('TurnManager', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame(['Alice', 'Bob', 'Carol']);
    game.currentPlayerIndex = 0;
    game.firstPlayerIndex = 0;
  });

  describe('nextPlayer', () => {
    test('passe au joueur suivant et réinitialise son tour', () => {
      game.players[1].hasPerformedMainAction = true;
      game.players[1].visitedPlanetsThisTurn = ['mars'];
      const updated = TurnManager.nextPlayer(game);

      expect(updated.currentPlayerIndex).toBe(1);
      expect(updated.players[1].hasPerformedMainAction).toBe(false);
      expect(updated.players[1].visitedPlanetsThisTurn).toEqual([]);
    });

    test('saute les joueurs qui ont passé et boucle', () => {
      game.currentPlayerIndex = 1;
      game.players[2].hasPassed = true;
      expect(TurnManager.nextPlayer(game).currentPlayerIndex).toBe(0);
    });

    test('déclenche la fin de manche quand tout le monde a passé', () => {
      game.players.forEach(p => (p.hasPassed = true));
      const updated = TurnManager.nextPlayer(game);
      expect(updated.isRoundEnd).toBe(true);
      expect(updated.currentRound).toBe(2);
    });

    test('ne modifie pas la partie d\'origine (régression : copie superficielle)', () => {
      game.players[1].hasPerformedMainAction = true;
      game.players[1].visitedPlanetsThisTurn = ['mars'];
      TurnManager.nextPlayer(game);
      expect(game.players[1].hasPerformedMainAction).toBe(true);
      expect(game.players[1].visitedPlanetsThisTurn).toEqual(['mars']);
    });
  });

  describe('endRound', () => {
    test('verse les revenus en crédits, énergie et cartes', () => {
      const before = game.players.map(p => ({ credits: p.credits, energy: p.energy, cards: p.cards.length }));
      const updated = TurnManager.endRound(game);

      updated.players.forEach((p, i) => {
        expect(p.credits).toBe(before[i].credits + p.revenueCredits);
        expect(p.energy).toBe(before[i].energy + p.revenueEnergy);
        expect(p.cards).toHaveLength(before[i].cards + p.revenueCards);
      });
    });

    test('réinitialise les joueurs et fait tourner le premier joueur', () => {
      game.players.forEach(p => {
        p.hasPassed = true;
        p.hasPerformedMainAction = true;
      });
      const updated = TurnManager.endRound(game);

      expect(updated.players.every(p => !p.hasPassed && !p.hasPerformedMainAction)).toBe(true);
      expect(updated.firstPlayerIndex).toBe(1);
      expect(updated.currentPlayerIndex).toBe(1);
      expect(updated.currentRound).toBe(2);
      expect(updated.phase).toBe(GamePhase.PLAYING);
    });

    test('ne modifie pas la partie d\'origine', () => {
      const deckSize = game.decks.cards.length;
      const round = game.currentRound;
      TurnManager.endRound(game);
      expect(game.decks.cards).toHaveLength(deckSize);
      expect(game.currentRound).toBe(round);
      expect(game.isRoundEnd).toBe(false);
    });

    test('après la dernière manche, passe au décompte final', () => {
      game.currentRound = game.maxRounds;
      const updated = TurnManager.endRound(game);
      expect(updated.phase).toBe(GamePhase.FINAL_SCORING);
      expect(updated.currentRound).toBe(game.maxRounds);
    });
  });

  describe('advanceSetup', () => {
    test('passe au joueur suivant tant que la mise en place n\'est pas finie', () => {
      game.phase = GamePhase.SETUP;
      const { updatedGame, started, historyEntries } = TurnManager.advanceSetup(game);
      expect(started).toBe(false);
      expect(updatedGame.currentPlayerIndex).toBe(1);
      expect(updatedGame.phase).toBe(GamePhase.SETUP);
      expect(historyEntries).toEqual([]);
    });

    test('démarre la partie au retour au premier joueur', () => {
      game.phase = GamePhase.SETUP;
      game.currentPlayerIndex = 2;
      game.players.forEach(p => (p.hasPerformedMainAction = true));
      const { updatedGame, started, historyEntries } = TurnManager.advanceSetup(game);

      expect(started).toBe(true);
      expect(updatedGame.phase).toBe(GamePhase.PLAYING);
      expect(updatedGame.currentPlayerIndex).toBe(0);
      expect(updatedGame.players.every(p => !p.hasPerformedMainAction)).toBe(true);
      expect(historyEntries.map(e => e.message)).toEqual(['--- DÉBUT DE LA PARTIE ---', `--- Manche 1 / ${updatedGame.maxRounds} ---`, '--- Tour de Alice ---']);
      expect(game.phase).toBe(GamePhase.SETUP);
    });
  });

  describe('finishTurn', () => {
    test('sans palier atteint : passe au joueur suivant', () => {
      const turn = TurnManager.finishTurn(game);
      expect(turn.turnEnded).toBe(true);
      expect(turn.updatedGame.currentPlayerIndex).toBe(1);
      expect(turn.turnEntries[0].message).toBe('--- Tour de Bob ---');
    });

    test('palier doré atteint : le tour s\'arrête sur le choix d\'un objectif', () => {
      game.players[0].score = 26;
      const turn = TurnManager.finishTurn(game);
      expect(turn.turnEnded).toBe(false);
      expect(turn.pendingInteractions).toEqual([{ type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }]);
      expect(turn.updatedGame.currentPlayerIndex).toBe(0);
    });
  });

  describe('utilitaires', () => {
    test('isFirstPassOfRound : vrai pour le premier joueur qui passe seulement', () => {
      getPlayer(game, P1).hasPassed = true;
      expect(TurnManager.isFirstPassOfRound(game)).toBe(true);
      getPlayer(game, P2).hasPassed = true;
      expect(TurnManager.isFirstPassOfRound(game)).toBe(false);
    });
  });
});

describe('TurnManager.blocksEndOfTurn', () => {
  test("une technologie à choisir (ou toute interaction obligatoire) empêche de finir son tour", () => {
    expect(TurnManager.blocksEndOfTurn({ type: 'ACQUIRING_TECH', isBonus: false })).toBe(true);
    expect(TurnManager.blocksEndOfTurn({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED })).toBe(true);
  });

  test('on peut finir son tour sans interaction, avec des déplacements restants ou pendant un échange', () => {
    expect(TurnManager.blocksEndOfTurn({ type: 'IDLE' })).toBe(false);
    expect(TurnManager.blocksEndOfTurn({ type: 'MOVING_PROBE', count: 2 })).toBe(false);
    expect(TurnManager.blocksEndOfTurn({ type: 'TRADING_CARD', count: 2, targetGain: 'credit', selectedCards: [] })).toBe(false);
  });
});

describe('PassAction', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame(['Alice', 'Bob']);
    game.currentPlayerIndex = 0;
    game.firstPlayerIndex = 0;
    game.board.solarSystem.nextRingLevel = 3;
  });

  const keepFirst = (g: Game, playerId: string, n: number) => getPlayer(g, playerId).cards.slice(0, n).map(c => c.id);

  describe('validate', () => {
    test('refuse de garder plus de 4 cartes', () => {
      getPlayer(game, P1).cards.push(...game.decks.cards.slice(0, 2));
      const action = new PassAction(P1, keepFirst(game, P1, 5));
      expect(action.validate(game).errors[0].message).toBe('Gardez exactement 4 cartes de votre main');
    });

    test('refuse de défausser plus que l\'excédent de la main (régression : seule l\'interface le vérifiait)', () => {
      getPlayer(game, P1).cards.push(...game.decks.cards.slice(0, 2));
      expect(new PassAction(P1, keepFirst(game, P1, 3)).validate(game).valid).toBe(false);
      expect(new PassAction(P1, keepFirst(game, P1, 4)).validate(game).valid).toBe(true);
    });

    test('main de 4 cartes ou moins : toutes sont gardées', () => {
      const hand = getPlayer(game, P1).cards;
      hand.splice(3);
      expect(new PassAction(P1, []).validate(game).valid).toBe(false);
      expect(new PassAction(P1, hand.map(c => c.id)).validate(game).valid).toBe(true);
    });

    test('une carte Exertien ne compte pas comme carte gardée en main', () => {
      const hand = getPlayer(game, P1).cards;
      hand.splice(4);
      const exertien = makeCard('ET.X', { type: CardType.EXERTIEN });
      hand.push(exertien);
      expect(new PassAction(P1, [...keepFirst(game, P1, 3), exertien.id]).validate(game).valid).toBe(false);
      expect(new PassAction(P1, keepFirst(game, P1, 4)).validate(game).valid).toBe(true);
    });

    test('refuse des cartes qui ne sont pas en main', () => {
      expect(new PassAction(P1, ['inconnue']).validate(game).valid).toBe(false);
    });

  });

  describe('execute', () => {
    test('défausse à 4 cartes, puis la carte de fin de manche est à choisir pendant son tour (pile intacte)', () => {
      const kept = keepFirst(game, P1, 4);
      const action = new PassAction(P1, kept);
      const updated = action.execute(game);
      const p1 = getPlayer(updated, P1);

      expect(p1.hasPassed).toBe(true);
      expect(p1.cards.map(c => c.id)).toEqual(kept);
      expect(updated.decks.roundDecks[1]).toHaveLength(game.decks.roundDecks[1].length);
      expect(action.newPendingInteractions[0]).toEqual(expect.objectContaining({ type: 'CHOOSING_ROUND_CARD', round: 1, playerId: P1 }));
      expect(updated.currentPlayerIndex).toBe(0);
      expect(action.historyEntries.some(e => e.message.startsWith('--- Tour de'))).toBe(false);
    });

    test('la carte choisie, le tour passe au joueur suivant (choix inscrit dans le tour du joueur qui passe)', () => {
      const action = new PassAction(P1, keepFirst(game, P1, 4));
      const passed = action.execute(game);
      const card = game.decks.roundDecks[1][1];
      const chosen = InteractionChoices.chooseRoundCard(passed, P1, action.newPendingInteractions[0] as Extract<InteractionState, { type: 'CHOOSING_ROUND_CARD' }>, card.id);

      expect(getPlayer(chosen.updatedGame, P1).cards.some(c => c.id === card.id)).toBe(true);
      expect(chosen.updatedGame.currentPlayerIndex).toBe(1);
      expect(chosen.historyEntries.map(e => revealText(e.message))).toEqual([`prend "${card.name}" de la pile de fin de manche`, '--- Tour de Bob ---']);
      expect(passed.currentPlayerIndex).toBe(0);
    });

    test('pile de fin de manche vide : rien à choisir', () => {
      game.decks.roundDecks[1] = [];
      const action = new PassAction(P1, keepFirst(game, P1, 4));
      action.execute(game);
      expect(action.newPendingInteractions.some(i => i.type === 'CHOOSING_ROUND_CARD')).toBe(false);
    });

    test('ne modifie pas la partie d\'origine', () => {
      const hand = getPlayer(game, P1).cards.map(c => c.id);
      const roundDeck = game.decks.roundDecks[1].map(c => c.id);
      new PassAction(P1, hand.slice(0, 2)).execute(game);

      expect(getPlayer(game, P1).cards.map(c => c.id)).toEqual(hand);
      expect(getPlayer(game, P1).hasPassed).toBe(false);
      expect(game.decks.roundDecks[1].map(c => c.id)).toEqual(roundDeck);
      expect(game.currentPlayerIndex).toBe(0);
    });

    test('le premier joueur à passer fait tourner le système solaire', () => {
      const angle3 = game.board.solarSystem.rotationAngleLevel3;
      const action = new PassAction(P1, keepFirst(game, P1, 4));
      const updated = action.execute(game);

      expect(updated.isFirstToPass).toBe(true);
      expect(updated.board.solarSystem.rotationAngleLevel3).toBe(angle3 - 45);
      expect(updated.board.solarSystem.nextRingLevel).toBe(2);
      expect(action.historyEntries[0].message).toContain('premier de la manche');
    });

  });

  describe('via GameEngine (manche complète)', () => {
    test('les deux joueurs passent : une seule rotation, puis fin de manche', () => {
      // Pile de fin de manche vide : la passe termine aussitôt le tour (le choix de la carte est testé à part)
      game.decks.roundDecks[1] = [];
      const engine = new GameEngine(game);
      const angle3 = game.board.solarSystem.rotationAngleLevel3;

      expect(engine.executeAction(new PassAction(P1, keepFirst(game, P1, 4))).success).toBe(true);
      const afterP1 = engine.getState();
      expect(afterP1.currentPlayerIndex).toBe(1);

      expect(engine.executeAction(new PassAction(P2, keepFirst(afterP1, P2, 4))).success).toBe(true);
      const afterRound = engine.getState();

      expect(afterRound.currentRound).toBe(2);
      expect(afterRound.isRoundEnd).toBe(true);
      expect(afterRound.board.solarSystem.rotationAngleLevel3).toBe(angle3 - 45);
      expect(afterRound.firstPlayerIndex).toBe(1);
      expect(afterRound.players.every(p => !p.hasPassed)).toBe(true);
    });

    test('un joueur ne peut pas passer hors de son tour', () => {
      const engine = new GameEngine(game);
      const result = engine.executeAction(new PassAction(P2, []));
      expect(result).toMatchObject({ success: false, error: "Ce n'est pas votre tour" });
    });
  });
  describe('paliers neutres', () => {
    test("une espèce découverte par un palier neutre ne laisse pas l'indicateur de découverte actif", () => {
      const board = game.board.alienBoards[0];
      board.lifeTraces = [
        { id: 't1', type: LifeTraceType.RED, playerId: P2 },
        { id: 't2', type: LifeTraceType.YELLOW, playerId: P2 },
      ];
      getPlayer(game, P1).score = 20;

      const res = ScoreManager.checkScoreMilestones(game, P1);

      expect(res.updatedGame.board.alienBoards[0].isDiscovered).toBe(true);
      // L'annonce est celle qui ouvre la fenêtre « Découverte » de l'interface
      expect(res.discoveryNotification?.message).toBe(DISCOVERY_NOTICE);
      expect(res.updatedGame.isSpeciesDiscovered).toBe(false);
    });
  });
});
