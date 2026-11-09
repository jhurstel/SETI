// Banc de performance des robots (npm run bench:ai) : parties complètes entre Experts, graines fixes.
// Affiche le temps de calcul par partie et par étape (médiane, p90, max) et une empreinte des résultats
// (scores finaux et nombre d'étapes de chaque partie) : une optimisation ne doit pas la changer.
// Arguments : nombre de parties (3 par défaut), joueurs par partie (2 par défaut).
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { GameFactory } from '../../src/core/GameFactory';
import { TurnManager } from '../../src/core/TurnManager';
import { GameSession } from '../../src/session/GameSession';
import { CardSystem } from '../../src/systems/CardSystem';
import { AITurn } from '../../src/ai/AITurn';
import { Game, GamePhase } from '../../src/core/types';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
(globalThis as { fetch: unknown }).fetch = async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
};
const log = console.log.bind(console);
console.log = () => {};
console.warn = () => {};

async function playGame(seed: number, players: number): Promise<{ scores: number[]; steps: number[] }> {
  let game: Game = await GameFactory.createGame(Array.from({ length: players }, (_, i) => `R${i + 1}`), true, seed);
  game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EXPERT'; });
  game = GameFactory.initializeGame(game);
  const steps: number[] = [];
  for (let i = 0; i < 6000 && game.phase !== GamePhase.FINAL_SCORING; i++) {
    game = CardSystem.refillCardRow(game);
    const start = performance.now();
    const step = AITurn.playStep(game);
    steps.push(performance.now() - start);
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
  return { scores: game.players.map(p => game.finalScores!.find(s => s.playerId === p.id)!.finalScore), steps };
}

async function main() {
  const games = Number(process.argv[2]) || 3;
  const players = Number(process.argv[3]) || 2;
  const all: number[] = [];
  const results: string[] = [];
  const start = performance.now();
  for (let g = 0; g < games; g++) {
    const seed = 424242 + g;
    const gameStart = performance.now();
    const { scores, steps } = await playGame(seed, players);
    all.push(...steps);
    results.push(`${seed}:${scores.join(',')}:${steps.length}`);
    log(`partie ${seed} : ${((performance.now() - gameStart) / 1000).toFixed(1)} s, ${steps.length} étapes, scores ${scores.join(' / ')}`);
  }
  all.sort((a, b) => a - b);
  const q = (p: number) => all[Math.min(all.length - 1, Math.floor(p * all.length))].toFixed(0);
  log(`total ${((performance.now() - start) / 1000).toFixed(1)} s ; étape : médiane ${q(0.5)} ms, p90 ${q(0.9)} ms, max ${all[all.length - 1].toFixed(0)} ms`);
  log(`empreinte des résultats : ${createHash('sha1').update(results.join('|')).digest('hex').slice(0, 12)}`);
}

main().catch(error => { log(error); process.exit(1); });
