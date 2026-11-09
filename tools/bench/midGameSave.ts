// Sauvegarde d'une partie en cours (manche 3, robots Experts puis joueur 1 humain), graine fixe : même état à chaque
// fois, pour comparer l'interface avant et après une modification (outil de développement, non publié).
// Usage : node tools/bench/build/midGameSave.js <fichier de sortie>
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../../src/core/DataLoader';
import { serializeGame } from '../../src/core/GamePersistence';
import { Game, GamePhase, HistoryEntry } from '../../src/core/types';
import { GameFactory } from '../../src/engine/GameFactory';
import { TurnManager } from '../../src/engine/TurnManager';
import { GameSession } from '../../src/session/GameSession';
import { CardSystem } from '../../src/systems/CardSystem';
import { AITurn } from '../../src/ai/AITurn';

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
DataLoader.setReader(file => fs.promises.readFile(path.join(PUBLIC_DIR, file), 'utf-8'));
console.log = () => {};

(async () => {
  let game: Game = await GameFactory.createGame(['Alice', 'HAL', 'Data'], true, 31337);
  game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EXPERT'; });
  game = GameFactory.initializeGame(game);
  const entries: HistoryEntry[] = [];
  // Jusqu'au tour d'Alice dans la manche 3
  for (let i = 0; i < 6000 && game.phase !== GamePhase.FINAL_SCORING; i++) {
    if (game.currentRound >= 3 && game.currentPlayerIndex === 0 && !game.interaction && !game.players[0].hasPerformedMainAction) break;
    game = CardSystem.refillCardRow(game);
    const step = AITurn.playStep(game);
    if (step.kind === 'SETUP_RESERVED') game = TurnManager.advanceSetup(step.updatedGame).updatedGame;
    else if (step.kind === 'END_TURN') game = AITurn.endTurn(game).updatedGame;
    else if (step.kind === 'UPDATED' || step.kind === 'PASS') {
      const result = GameSession.applyRobotStep(game, step);
      if (result.error) throw new Error(result.error);
      game = result.game;
      entries.push(...result.entries);
    } else throw new Error('Robot bloqué');
  }
  game.players[0].type = 'human';
  delete game.players[0].aiDifficulty;
  fs.writeFileSync(process.argv[2], JSON.stringify(serializeGame(game, entries)));
  process.stdout.write(`manche ${game.currentRound}, ${entries.length} entrées\n`);
})();
