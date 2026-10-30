// Worker de réglage : joue des parties entre robots Experts, chaque siège avec ses propres poids d'évaluation.
// Reçoit { id, seed, weights: EvaluatorWeights[] } et renvoie { id, scores: number[] } (score final par siège).
import * as fs from 'fs';
import * as path from 'path';
import { GameFactory } from '../../src/core/GameFactory';
import { TurnManager } from '../../src/core/TurnManager';
import { GameEngine } from '../../src/core/Game';
import { PassAction } from '../../src/actions/PassAction';
import { CardSystem } from '../../src/systems/CardSystem';
import { AITurn } from '../../src/ai/AITurn';
import { AIEvaluator, EvaluatorWeights } from '../../src/ai/AIEvaluator';
import { Game, GamePhase } from '../../src/core/types';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
(globalThis as { fetch: unknown }).fetch = async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
};
console.log = () => {};
console.warn = () => {};

async function playGame(seed: number, weights: EvaluatorWeights[]): Promise<number[]> {
  const names = weights.map((_, i) => `R${i + 1}`);
  let game: Game = await GameFactory.createGame(names, true, seed);
  game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EXPERT'; });
  AIEvaluator.weightOverrides.clear();
  game.players.forEach((p, i) => AIEvaluator.weightOverrides.set(p.id, weights[i]));
  game = GameFactory.initializeGame(game);

  for (let steps = 0; steps < 6000 && game.phase !== GamePhase.FINAL_SCORING; steps++) {
    game = CardSystem.refillCardRow(game);
    const step = AITurn.playStep(game);
    if (step.kind === 'SETUP_RESERVED') game = TurnManager.advanceSetup(step.updatedGame).updatedGame;
    else if (step.kind === 'UPDATED') game = step.updatedGame;
    else if (step.kind === 'END_TURN') game = AITurn.endTurn(game).updatedGame;
    else if (step.kind === 'PASS') {
      const player = game.players[game.currentPlayerIndex];
      const res = new GameEngine(game).executeAction(new PassAction(player.id, step.cardsToKeep));
      if (!res.success || !res.updatedState) throw new Error(`Passe refusée : ${res.error}`);
      game = res.updatedState;
    } else throw new Error('Robot bloqué');
  }
  if (game.phase !== GamePhase.FINAL_SCORING) throw new Error('Partie non terminée');
  return game.players.map(p => game.finalScores!.find(s => s.playerId === p.id)!.finalScore);
}

process.on('message', async (msg: { id: number; seed: number; weights: EvaluatorWeights[] }) => {
  try {
    const scores = await playGame(msg.seed, msg.weights);
    process.send!({ id: msg.id, scores });
  } catch (error) {
    process.send!({ id: msg.id, error: String(error) });
  }
});
