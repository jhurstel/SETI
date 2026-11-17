import { AIBehavior } from '../src/ai/AIBehavior';
import { AIEvaluator } from '../src/ai/AIEvaluator';
import { AITurn } from '../src/ai/AITurn';
import { getRandomState } from '../src/core/random';
import { CardSystem } from '../src/systems/CardSystem';
import { GameSession } from '../src/session/GameSession';
import { Game, GamePhase } from '../src/core/types';
import { ROBOT_LEVELS } from '../src/ui/modals/SetupFields';
import { parseClientMessage } from '../src/session/protocol';
import { createTestGame } from './helpers/gameFixture';

/** Partie où le premier joueur est un adversaire passif du tutoriel (IDLE) et doit jouer */
async function idleGame(): Promise<Game> {
  const game = await createTestGame(['Passif', 'Alice']);
  game.players[0].type = 'robot';
  game.players[0].aiDifficulty = 'IDLE';
  game.players[1].type = 'human';
  game.currentPlayerIndex = 0;
  return game;
}

/** Joue les étapes du robot courant jusqu'à ce que la main change (comme useAITurn, sans React) */
function playIdleTurn(initial: Game): Game {
  let game = initial;
  const robotId = game.players[game.currentPlayerIndex].id;
  for (let i = 0; i < 10 && game.players[game.currentPlayerIndex].id === robotId && !game.players[game.currentPlayerIndex].hasPassed; i++) {
    const step = AITurn.playStep(game);
    const result = step.kind === 'END_TURN'
      ? GameSession.applyRobotStep(game, { kind: 'END_TURN_DONE', end: AITurn.endTurn(game) })
      : GameSession.applyRobotStep(game, step);
    expect(result.error).toBeUndefined();
    game = result.game;
  }
  return game;
}

describe('adversaire passif du tutoriel (IDLE)', () => {
  test("n'est pas stratégique, ne simule rien et passe aussitôt", async () => {
    const game = await idleGame();
    const robot = game.players[0];
    expect(AIBehavior.isIdle(robot)).toBe(true);
    expect(AIBehavior.isStrategic(robot)).toBe(false);
    const step = AITurn.playStep(game);
    expect(step.kind).toBe('PASS');
  });

  test('garde les 4 premières cartes de sa main, dans l\'ordre', async () => {
    const game = await idleGame();
    const hand = CardSystem.getHandCards(game.players[0]);
    const step = AITurn.playStep(game);
    expect(step).toEqual({ kind: 'PASS', cardsToKeep: hand.slice(0, 4).map(c => c.id) });
  });

  test('son tour passe par la session, sans modifier la partie reçue ni tirer au hasard', async () => {
    const game = await idleGame();
    const snapshot = JSON.stringify(game);
    const after = playIdleTurn(game);
    expect(JSON.stringify(game)).toBe(snapshot);
    const robot = after.players.find(p => p.id === game.players[0].id)!;
    expect(robot.hasPassed).toBe(true);
    expect(after.players[after.currentPlayerIndex].id).toBe(game.players[1].id);
    // Aucune action gratuite : ni ressource dépensée ni sonde lancée
    expect(robot.credits).toBe(game.players[0].credits);
    expect(robot.energy).toBe(game.players[0].energy);
    expect(robot.probes).toEqual(game.players[0].probes);
    // Carte de fin de manche : la première de la pile
    const firstRoundCard = game.decks.roundDecks[game.currentRound]?.[0];
    expect(firstRoundCard).toBeDefined();
    expect(robot.cards.map(c => c.id)).toContain(firstRoundCard!.id);
  });

  test('ses tours ne dépendent ni des poids des robots ni du générateur', async () => {
    const game = await idleGame();
    const first = playIdleTurn(game);
    AIEvaluator.weightOverrides.set(game.players[0].id, { ...AIEvaluator.weightsFor(game, game.players[0].id), credit: 999 });
    try {
      const second = playIdleTurn(game);
      expect(JSON.stringify(second.players)).toBe(JSON.stringify(first.players));
      expect(second.board).toEqual(first.board);
    } finally {
      AIEvaluator.weightOverrides.clear();
    }
    // L'étape de passe elle-même ne tire rien
    const state = getRandomState();
    AITurn.playStep(game);
    expect(getRandomState()).toBe(state);
  });

  test('réserve la première carte de sa main à la mise en place', async () => {
    const game = await idleGame();
    const setup: Game = { ...game, phase: GamePhase.SETUP };
    const firstCard = CardSystem.getHandCards(setup.players[0])[0];
    const step = AITurn.playStep(setup);
    expect(step.kind).toBe('SETUP_RESERVED');
    if (step.kind === 'SETUP_RESERVED') {
      expect(step.updatedGame.players[0].reservedCards.map(c => c.id)).toContain(firstCard.id);
    }
  });

  test("n'est proposé ni pour une nouvelle partie ni pour une salle en ligne", () => {
    expect(ROBOT_LEVELS.map(l => l.id)).not.toContain('IDLE');
    const message = parseClientMessage(JSON.stringify({ type: 'create', version: '1.0.0', name: 'A', seats: [{ type: 'human' }, { type: 'robot', aiDifficulty: 'IDLE' }] }));
    const seats = (message as { seats?: { aiDifficulty?: string }[] } | null)?.seats ?? [];
    expect(seats.some(s => s.aiDifficulty === 'IDLE')).toBe(false);
  });
});
