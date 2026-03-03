import { ProbeSystem } from '../src/systems/ProbeSystem';
import { Game, Player, GamePhase } from '../src/core/types';

// Helper pour créer un état de jeu minimal pour les tests
const createMockGame = (): Game => {
  const player: Player = {
    id: 'p1',
    name: 'Test Player',
    credits: 10,
    energy: 10,
    data: 0,
    mediaCoverage: 0,
    revenueCredits: 0,
    revenueEnergy: 0,
    revenueCards: 0,
    probes: [],
    technologies: [],
    cards: [],
    playedCards: [],
    reservedCards: [],
    missions: [],
    dataComputer: { canAnalyze: false, slots: {} },
    lifeTraces: [],
    score: 0,
    hasPassed: false,
    hasPerformedMainAction: false,
    type: 'human',
    color: '#fff',
    claimedGoldenMilestones: [],
    claimedNeutralMilestones: [],
    visitedPlanetsThisTurn: [],
    activeBuffs: [],
    permanentBuffs: [],
    centaurienMilestone: []
  };

  return {
    id: 'test-game',
    currentRound: 1,
    maxRounds: 5,
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    phase: GamePhase.PLAYING,
    players: [player],
    board: { solarSystem: { probes: [], rotationAngleLevel1: 0, rotationAngleLevel2: 0, rotationAngleLevel3: 0, extraCelestialObjects: [] } } as any,
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

describe('ProbeSystem', () => {
  let game: Game;

  beforeEach(() => {
    game = createMockGame();
  });

  test('canLaunchProbe should return true if player has enough credits', () => {
    const result = ProbeSystem.canLaunchProbe(game, 'p1');
    expect(result.canLaunch).toBe(true);
  });

  test('canLaunchProbe should return false if player has insufficient credits', () => {
    game.players[0].credits = 0;
    const result = ProbeSystem.canLaunchProbe(game, 'p1');
    expect(result.canLaunch).toBe(false);
    expect(result.reason).toContain('Crédits insuffisants');
  });

  test('launchProbe should deduct credits and add probe to solar system', () => {
    const initialCredits = game.players[0].credits;
    const { updatedGame, probeId } = ProbeSystem.launchProbe(game, 'p1');

    expect(probeId).toBeDefined();
    expect(updatedGame.players[0].credits).toBe(initialCredits - 2); // PROBE_LAUNCH_COST = 2
    expect(updatedGame.board.solarSystem.probes.length).toBe(1);
    expect(updatedGame.board.solarSystem.probes[0].id).toBe(probeId);
  });

  test('moveProbe should deduct energy and update position', () => {
    // Setup: Launch a probe first
    const { updatedGame: gameWithProbe, probeId } = ProbeSystem.launchProbe(game, 'p1');
    
    // Move probe from Earth (A3) to adjacent sector
    const { updatedGame } = ProbeSystem.moveProbe(gameWithProbe, 'p1', probeId!, 'A', 4, 1);

    expect(updatedGame.players[0].energy).toBe(9); // 10 - 1 energy cost
    const movedProbe = updatedGame.board.solarSystem.probes.find(p => p.id === probeId);
    expect(movedProbe?.solarPosition).toEqual({ disk: 'A', sector: 4, level: 3 }); // Assuming level logic holds
  });
});