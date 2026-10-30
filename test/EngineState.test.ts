import { GameEngine } from '../src/core/Game';
import { ActionValidator } from '../src/core/ActionValidator';
import { PassAction } from '../src/actions/PassAction';
import { LaunchProbeAction } from '../src/actions/LaunchProbeAction';
import { ScoreManager } from '../src/core/ScoreManager';
import { TechnologySystem } from '../src/systems/TechnologySystem';
import { Game, GamePhase, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

describe('GameEngine : état de la partie', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('joueur courant, partie en cours, personne n\'a passé', () => {
    const engine = new GameEngine(game);

    expect(engine.getCurrentPlayer().id).toBe(P1);
    expect(engine.isGameOver()).toBe(false);
    expect(engine.allPlayersPassed()).toBe(false);
  });

  test('getState renvoie une nouvelle référence, setState remplace l\'état', () => {
    const engine = new GameEngine(game);
    expect(engine.getState()).not.toBe(game);
    expect(engine.getState()).toEqual(game);

    const other = { ...game, currentPlayerIndex: 1 };
    engine.setState(other);
    expect(engine.getCurrentPlayer().id).toBe(P2);
  });

  test('nextPlayer passe la main au joueur suivant sans modifier la partie reçue', () => {
    const engine = new GameEngine(game);
    engine.nextPlayer();

    expect(engine.getCurrentPlayer().id).toBe(P2);
    expect(game.currentPlayerIndex).toBe(0);
  });

  test('tous les joueurs ont passé : allPlayersPassed', () => {
    game.players.forEach(p => { p.hasPassed = true; });
    expect(new GameEngine(game).allPlayersPassed()).toBe(true);
  });

  test('fin de la dernière manche : décompte final, gagnant, partie terminée', () => {
    game.currentRound = game.maxRounds;
    game.players.forEach(p => { p.hasPassed = true; });
    getPlayer(game, P2).score = 50;
    const engine = new GameEngine(game);

    engine.endRound();

    expect(engine.isGameOver()).toBe(true);
    expect(engine.calculateFinalScores()).toHaveLength(2);
    expect(engine.determineWinner()).toEqual([P2]);
  });

  test('calculateFinalScores refuse une partie non terminée', () => {
    expect(() => new GameEngine(game).calculateFinalScores()).toThrow('La partie n\'est pas terminée');
  });

  test('executeAction renvoie l\'erreur de validation sans rien changer', () => {
    const engine = new GameEngine(game);
    const result = engine.executeAction(new PassAction(P2, []));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Ce n\'est pas votre tour');
    expect(engine.getState()).toEqual(game);
  });

  test('executeAction marque l\'action principale et rattache les interactions à la séquence', () => {
    getPlayer(game, P1).credits = 10;
    const action = new LaunchProbeAction(P1);
    const result = new GameEngine(game).executeAction(action);

    expect(result.success).toBe(true);
    expect(getPlayer(result.updatedState!, P1).hasPerformedMainAction).toBe(true);
    const sequenceId = action.historyEntries.find(e => e.sequenceId)?.sequenceId;
    expect(action.newPendingInteractions.every(i => i.sequenceId === sequenceId)).toBe(true);
  });

  test('une exception pendant l\'action est renvoyée comme erreur', () => {
    const action = new PassAction(P1, getPlayer(game, P1).cards.slice(0, 4).map(c => c.id));
    jest.spyOn(action, 'execute').mockImplementation(() => { throw new Error('boum'); });

    expect(new GameEngine(game).executeAction(action)).toEqual({ success: false, error: 'boum' });
  });
});

describe('ActionValidator', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  const errorCode = (g: Game, playerId = P1) => ActionValidator.validateAction(g, new LaunchProbeAction(playerId)).errors[0]?.code;

  test('partie terminée', () => {
    game.phase = GamePhase.FINAL_SCORING;
    expect(errorCode(game)).toBe('GAME_OVER');
  });

  test('index de joueur courant invalide', () => {
    game.currentPlayerIndex = 5;
    expect(errorCode(game)).toBe('INVALID_TURN');
  });

  test('pas le tour du joueur', () => {
    expect(errorCode(game, P2)).toBe('NOT_PLAYER_TURN');
  });

  test('joueur qui a passé', () => {
    getPlayer(game, P1).hasPassed = true;
    expect(errorCode(game)).toBe('PLAYER_PASSED');
  });

  test('action principale déjà faite', () => {
    getPlayer(game, P1).hasPerformedMainAction = true;
    expect(errorCode(game)).toBe('MAIN_ACTION_ALREADY_PERFORMED');
  });

  test('canExecuteAction suit la validation', () => {
    getPlayer(game, P1).credits = 10;
    expect(ActionValidator.canExecuteAction(game, new LaunchProbeAction(P1))).toBe(true);
    getPlayer(game, P1).hasPassed = true;
    expect(ActionValidator.canExecuteAction(game, new LaunchProbeAction(P1))).toBe(false);
  });
});

describe('TechnologySystem.canAcquireTech', () => {
  test('une technologie disponible que le joueur n\'a pas, filtrée par catégorie', async () => {
    const game = await createTestGame();

    expect(TechnologySystem.canAcquireTech(game, P1)).toBe(true);
    expect(TechnologySystem.canAcquireTech(game, P1, [TechnologyCategory.COMPUTING])).toBe(true);
    expect(TechnologySystem.canAcquireTech(game, 'inconnu')).toBe(false);
  });

  test('faux quand le joueur a déjà toutes les technologies de la catégorie', async () => {
    const game = await createTestGame();
    const slot = game.board.technologyBoard.categorySlots!.find(s => s.category === TechnologyCategory.COMPUTING)!;
    getPlayer(game, P1).technologies.push(...slot.technologies);

    expect(TechnologySystem.canAcquireTech(game, P1, [TechnologyCategory.COMPUTING])).toBe(false);
  });
});

describe('ScoreManager.determineWinner', () => {
  test('ex aequo : tous les meilleurs gagnent', () => {
    const score = (playerId: string, finalScore: number) => ({ playerId, finalScore }) as Parameters<typeof ScoreManager.determineWinner>[0][number];
    expect(ScoreManager.determineWinner([score(P1, 40), score(P2, 40), score('player_2', 10)])).toEqual([P1, P2]);
  });
});
