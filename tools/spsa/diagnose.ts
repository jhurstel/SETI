// Diagnostic des robots : joue des parties entre Experts (poids en place) et écrit, par joueur, une ligne JSON
// (détail du score final, score à chaque fin de manche, ressources inutilisées, missions, objectifs, actions choisies).
// Usage : node build/diagnose.js <joueurs> <première graine> <nombre de graines> [niveaux]   (voir README.md)
// niveaux : un niveau par siège séparé par des virgules (EXPERT,MEDIUM) ; chaque graine est alors jouée dans chaque
// rotation des sièges (Expert premier, puis deuxième…), pour que le premier joueur ne fausse pas la comparaison.
import * as fs from 'fs';
import * as path from 'path';
import { GameFactory } from '../../src/engine/GameFactory';
import { TurnManager } from '../../src/engine/TurnManager';
import { GameSession } from '../../src/session/GameSession';
import { CardSystem } from '../../src/systems/CardSystem';
import { ScoreManager } from '../../src/engine/ScoreManager';
import { AITurn } from '../../src/ai/AITurn';
import { setTraceLevel } from '../../src/core/trace';
import { AIDifficulty, Game, GamePhase, ProbeState } from '../../src/core/types';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
(globalThis as { fetch: unknown }).fetch = async (url: string) => {
  const file = path.join(PUBLIC_DIR, url);
  return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response('', { status: 404 });
};

// Les décisions des robots passent par trace.info (« [AI] R1 chose: <action> ») : on les compte
const out = process.stdout.write.bind(process.stdout);
let actions: Record<string, Record<string, number>> = {};
let roundOf = 0;
setTraceLevel('info');
// Les suites jouées par l'anticipation de l'Expert passent aussi par là : on ne compte que les vraies décisions
const isSimulating = () => (AITurn as unknown as { simulating: boolean }).simulating;
console.log = (...args: unknown[]) => {
  if (isSimulating()) return;
  const text = args.map(String).join(' ');
  const m = /^\[AI\] (R\d) chose: (.+?) \(gain/.exec(text);
  if (m) {
    const key = `${m[2]}`;
    actions[m[1]] = actions[m[1]] || {};
    actions[m[1]][key] = (actions[m[1]][key] || 0) + 1;
    actions[m[1]][`manche ${roundOf}`] = (actions[m[1]][`manche ${roundOf}`] || 0) + 1;
  } else if (/^\[AI\] (R\d) : aucune action/.test(text)) {
    const name = /^\[AI\] (R\d)/.exec(text)![1];
    actions[name] = actions[name] || {};
    actions[name][`passe manche ${roundOf}`] = 1;
  }
};
console.warn = () => {};

async function playGame(players: number, seed: number, levels: string[]) {
  actions = {};
  const names = Array.from({ length: players }, (_, i) => `R${i + 1}`);
  let game: Game = await GameFactory.createGame(names, true, seed);
  game.players.forEach((p, i) => {
    const spec = levels[i] ?? 'EXPERT';
    p.type = 'robot';
    p.aiDifficulty = spec as AIDifficulty;
  });
  game = GameFactory.initializeGame(game);
  const roundScores: Record<string, number[]> = Object.fromEntries(game.players.map(p => [p.id, []]));
  let round = game.currentRound;
  roundOf = round;
  // Marqueurs objectif posés : tuile, rang, manche et série du joueur au moment du choix
  const choices: Record<string, { tile: string; rank: number; round: number; series: number; others: Record<string, number> }[]> = Object.fromEntries(game.players.map(p => [p.id, []]));
  const seen = new Set<string>();
  const tileKey = (t: Game['board']['objectiveTiles'][number]) => `${t.name} ${t.side}`;

  for (let steps = 0; steps < 8000 && game.phase !== GamePhase.FINAL_SCORING; steps++) {
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
    for (const tile of game.board.objectiveTiles) {
      tile.markers.forEach((id, rank) => {
        if (seen.has(`${tile.id}/${id}`)) return;
        seen.add(`${tile.id}/${id}`);
        const p = game.players.find(pl => pl.id === id)!;
        const others = Object.fromEntries(game.board.objectiveTiles.map(t => [tileKey(t), ScoreManager.objectiveTileSeries(p, game.board, t)]));
        choices[id].push({ tile: tileKey(tile), rank, round: game.currentRound, series: others[tileKey(tile)], others });
      });
    }
    if (game.currentRound !== round) {
      game.players.forEach(p => roundScores[p.id].push(p.score));
      round = game.currentRound;
      roundOf = round;
    }
  }
  if (game.phase !== GamePhase.FINAL_SCORING) throw new Error('Partie non terminée');

  const best = Math.max(...game.finalScores!.map(s => s.finalScore));
  game.players.forEach(p => {
    const fs_ = game.finalScores!.find(s => s.playerId === p.id)!;
    roundScores[p.id].push(fs_.baseScore);
    const openRequirements = p.missions.filter(m => !m.completed)
      .reduce((n, m) => n + m.requirements.filter(r => !m.completedRequirementIds.includes(r.id)).length, 0);
    const line = {
      players, seed, player: p.name, level: p.aiDifficulty, seat: game.players.indexOf(p), win: fs_.finalScore === best,
      final: fs_.finalScore, base: fs_.baseScore, ...fs_.categories, dangerPenalty: fs_.dangerPenalty, danger: fs_.danger,
      roundScores: roundScores[p.id],
      left: { credits: p.credits, energy: p.energy, data: p.data, media: p.mediaCoverage, hand: CardSystem.getHandCards(p).length, reserved: p.reservedCards.length },
      income: { credits: p.revenueCredits, energy: p.revenueEnergy, cards: p.revenueCards },
      missions: p.missions.length, missionsCompleted: p.missions.filter(m => m.completed).length, openRequirements,
      playedCards: p.playedCards.length, technologies: p.technologies.length, lifeTraces: p.lifeTraces.length,
      orbiters: p.probes.filter(pr => pr.state === ProbeState.IN_ORBIT).length,
      landers: p.probes.filter(pr => pr.state === ProbeState.LANDED).length,
      probesInSystem: p.probes.filter(pr => pr.state === ProbeState.IN_SOLAR_SYSTEM).length,
      objectiveMarkers: game.board.objectiveTiles.reduce((n, t) => n + t.markers.filter(id => id === p.id).length, 0),
      exertienPlayed: fs_.revealedExertienCards.length, exertienMet: fs_.revealedExertienCards.filter(c => c.conditionMet).length,
      species: game.board.alienBoards.filter(b => b.isDiscovered).length,
      actions: actions[p.name] || {},
      tileSeries: Object.fromEntries(game.board.objectiveTiles.map(t => [tileKey(t), ScoreManager.objectiveTileSeries(p, game.board, t)])),
      tileChoices: choices[p.id],
    };
    out(JSON.stringify(line) + '\n');
  });
}

(async () => {
  const [players, first, count] = process.argv.slice(2, 5).map(Number);
  const levels = (process.argv[5] ?? '').split(',').filter(Boolean);
  // Sans niveaux : tous Experts, une partie par graine ; sinon une partie par rotation des niveaux
  const rotations = levels.length ? levels.map((_, r) => levels.map((__, i) => levels[(i + r) % levels.length])) : [[]];
  for (let i = 0; i < count; i++) {
    for (const seats of rotations) await playGame(players, first + i, seats);
  }
})().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exit(1); });
