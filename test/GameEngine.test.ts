import { GameEngine } from '../src/core/Game';
import { PassAction } from '../src/actions/PassAction';
import { Game, Player, GamePhase } from '../src/core/types';

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
    visitedPlanetsThisTurn: [], activeBuffs: [], permanentBuffs: [], centaurienMilestone: []
  });

  return {
    id: 'test-engine',
    currentRound: 1,
    maxRounds: 5,
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    phase: GamePhase.PLAYING,
    players: [createPlayer('p1'), createPlayer('p2')],
    board: { solarSystem: { probes: [], rotationAngleLevel1: 0, rotationAngleLevel2: 0, rotationAngleLevel3: 0 } } as any,
    decks: { cards: [], cardRow: [], discardPile: [], roundDecks: {} },
    species: [],
    discoveredSpecies: [],
    history: [],
    isFirstToPass: false,
    isRoundEnd: false,
    gameLog: [],
    neutralMilestonesAvailable: {}
  };
};

describe('GameEngine Integration', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const initialState = createMockGame();
    engine = new GameEngine(initialState);
  });

  test('PassAction should mark player as passed and switch turn', () => {
    const action = new PassAction('p1', []); // p1 passe sans garder de cartes
    
    const result = engine.executeAction(action);

    expect(result.success).toBe(true);
    
    const newState = engine.getState();
    
    // Vérifier que p1 a passé
    expect(newState.players[0].hasPassed).toBe(true);
    
    // Vérifier que c'est au tour de p2
    expect(newState.currentPlayerIndex).toBe(1);
  });
});