import { GameEngine } from '../src/core/Game';
import { PassAction } from '../src/actions/PassAction';
import { Game, Player, GamePhase } from '../src/core/types';
import { performRotation } from '../src/core/SolarSystemPosition';

// On "mock" le module qui contient les fonctions à simuler.
// Cela remplace toutes les fonctions exportées de ce module par des simulations (mocks).
jest.mock('../src/core/SolarSystemPosition');

// Mock minimaliste pour le GameEngine
const createMockGame = (): Game => {
  const createPlayer = (id: string): Player => ({
    id,
    name: `Player ${id}`,
    credits: 5,
    energy: 5,
    cards: [], // Pas de cartes pour simplifier le test de Pass
    hasPassed: false,
    hasPerformedMainAction: false,
    // ... autres propriétés obligatoires initialisées à vide/0
    data: 0, mediaCoverage: 0, revenueCredits: 0, revenueEnergy: 0, revenueCards: 0,
    probes: [], technologies: [], playedCards: [], reservedCards: [], missions: [],
    dataComputer: { canAnalyze: false, slots: {} }, lifeTraces: [], score: 0,
    type: 'human', color: '#000', claimedGoldenMilestones: [], claimedNeutralMilestones: [],
    visitedPlanetsThisTurn: [], activeBuffs: [], permanentBuffs: [], centaurienMilestones: []
  });

  return {
    id: 'test-engine',
    currentRound: 1,
    maxRounds: 5,
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    phase: GamePhase.PLAYING,
    players: [createPlayer('p1'), createPlayer('p2')],
    board: { solarSystem: { probes: [], rotationAngleLevel1: 0, rotationAngleLevel2: 0, rotationAngleLevel3: 0, nextRingLevel: 3 } } as any,
    decks: { cards: [], cardRow: [], discardPile: [], roundDecks: {} },
    species: [],
    discoveredSpecies: [],
    history: [],
    isFirstToPass: false,
    isRoundEnd: false,
    isSpeciesDiscovered: false,
    gameLog: [],
    neutralMilestonesAvailable: {}
  };
};

describe('GameEngine Integration', () => {
  let engine: GameEngine;
  // On "cast" la fonction importée en `jest.Mock` pour avoir l'autocomplétion et le typage.
  const mockedPerformRotation = performRotation as jest.Mock;

  beforeEach(() => {
    const initialState = createMockGame();
    engine = new GameEngine(initialState);
    // C'est une bonne pratique de nettoyer les mocks avant chaque test.
    mockedPerformRotation.mockClear();
  });

  test('PassAction should mark player as passed and switch turn', () => {
    mockedPerformRotation.mockImplementation((game: Game) => {
      const updatedGame = { ...game };
      // On peut simuler un effet de la rotation si on veut tester ses conséquences
      updatedGame.board.solarSystem.rotationAngleLevel3 = -45;
      return { updatedGame, logs: ['Rotation simulée !'] };
    });

    const action = new PassAction('p1', []); // p1 passe sans garder de cartes    
    const result = engine.executeAction(action);

    expect(result.success).toBe(true);
    
    const newState = engine.getState();
    
    // Vérifier que p1 a passé
    expect(newState.players[0].hasPassed).toBe(true);
    
    // Vérifier que c'est au tour de p2
    expect(newState.currentPlayerIndex).toBe(1);
  });

  test('First PassAction of the round should call performRotation', () => {
    // On définit ce que la fonction simulée doit retourner pour ce test.
    // Ici, elle retourne le jeu sans modification et un log personnalisé.
    mockedPerformRotation.mockImplementation((game: Game) => {
      const updatedGame = { ...game };
      // On peut simuler un effet de la rotation si on veut tester ses conséquences
      updatedGame.board.solarSystem.rotationAngleLevel3 = -45;
      return { updatedGame, logs: ['Rotation simulée !'] };
    });

    const action = new PassAction('p1', []);
    const result = engine.executeAction(action);

    expect(result.success).toBe(true);

    // On vérifie que notre fonction simulée a bien été appelée une fois.
    expect(mockedPerformRotation).toHaveBeenCalledTimes(1);

    const newState = engine.getState();
    // On vérifie que l'état du jeu a bien été modifié par notre simulation.
    expect(newState.board.solarSystem.rotationAngleLevel3).toBe(-45);
  });
});