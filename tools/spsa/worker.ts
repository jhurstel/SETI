// Worker de réglage : joue des parties entre robots Experts, chaque siège avec ses propres poids d'évaluation.
// Reçoit { id, seed, weights: (EvaluatorWeights | null)[], levels?: niveau par siège (Expert par défaut), temperatures?: température imposée par siège (null : celle du niveau), lookaheads?: anticipation imposée par siège, rollouts?: suites jouées imposées par siège } et renvoie { id, scores: number[] } (score final par siège).
import * as fs from 'fs';
import * as path from 'path';
import { GameFactory } from '../../src/engine/GameFactory';
import { TurnManager } from '../../src/engine/TurnManager';
import { GameSession } from '../../src/session/GameSession';
import { CardSystem } from '../../src/systems/CardSystem';
import { AITurn } from '../../src/ai/AITurn';
import { AIEvaluator, EvaluatorWeights } from '../../src/ai/AIEvaluator';
import { AIBehavior } from '../../src/ai/AIBehavior';
import { AIDifficulty, Game, GamePhase } from '../../src/core/types';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
(globalThis as { fetch: unknown }).fetch = async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
};
console.log = () => {};
console.warn = () => {};

type Job = { id: number; seed: number; weights: (EvaluatorWeights | null)[]; levels?: AIDifficulty[]; temperatures?: (number | null)[]; lookaheads?: (number | null)[]; rollouts?: (number | null)[] };

async function playGame({ seed, weights, levels, temperatures, lookaheads, rollouts }: Job): Promise<number[]> {
  const names = weights.map((_, i) => `R${i + 1}`);
  let game: Game = await GameFactory.createGame(names, true, seed);
  game.players.forEach((p, i) => { p.type = 'robot'; p.aiDifficulty = levels?.[i] ?? 'EXPERT'; });
  AIEvaluator.weightOverrides.clear();
  // Siège sans poids : ceux du jeu pour ce nombre de joueurs
  game.players.forEach((p, i) => { const w = weights[i]; if (w) AIEvaluator.weightOverrides.set(p.id, w); });
  AIBehavior.temperatureOverrides.clear();
  game.players.forEach((p, i) => { const t = temperatures?.[i]; if (t !== null && t !== undefined) AIBehavior.temperatureOverrides.set(p.id, t); });
  AIBehavior.lookaheadOverrides.clear();
  game.players.forEach((p, i) => { const k = lookaheads?.[i]; if (k !== null && k !== undefined) AIBehavior.lookaheadOverrides.set(p.id, k); });
  AIBehavior.rolloutOverrides.clear();
  game.players.forEach((p, i) => { const r = rollouts?.[i]; if (r !== null && r !== undefined) AIBehavior.rolloutOverrides.set(p.id, r); });
  game = GameFactory.initializeGame(game);

  for (let steps = 0; steps < 6000 && game.phase !== GamePhase.FINAL_SCORING; steps++) {
    game = CardSystem.refillCardRow(game);
    const step = AITurn.playStep(game);
    if (step.kind === 'SETUP_RESERVED') game = TurnManager.advanceSetup(step.updatedGame).updatedGame;
    else if (step.kind === 'UPDATED') game = step.updatedGame;
    else if (step.kind === 'END_TURN') game = AITurn.endTurn(game).updatedGame;
    else if (step.kind === 'PASS') {
      const res = GameSession.applyRobotStep(game, step);
      if (res.error) throw new Error(`Passe refusée : ${res.error}`);
      game = res.game;
    } else throw new Error('Robot bloqué');
  }
  if (game.phase !== GamePhase.FINAL_SCORING) throw new Error('Partie non terminée');
  return game.players.map(p => game.finalScores!.find(s => s.playerId === p.id)!.finalScore);
}

process.on('message', async (msg: Job) => {
  try {
    const scores = await playGame(msg);
    process.send!({ id: msg.id, scores });
  } catch (error) {
    process.send!({ id: msg.id, error: String(error) });
  }
});
