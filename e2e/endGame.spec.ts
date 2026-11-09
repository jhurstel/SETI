import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../src/core/DataLoader';
import { serializeGame } from '../src/core/GamePersistence';
import { Game, GamePhase, HistoryEntry } from '../src/core/types';
import { GameFactory } from '../src/engine/GameFactory';
import { TurnManager } from '../src/engine/TurnManager';
import { GameSession } from '../src/session/GameSession';
import { CardSystem } from '../src/systems/CardSystem';
import { AITurn } from '../src/ai/AITurn';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Partie terminée, jouée côté Node par deux robots Débutants (graine fixe), puis rendue au joueur humain « Alice » :
 * sauvegarde automatique prête à reprendre, en phase de décompte final.
 */
async function finishedGameSave(): Promise<string> {
  DataLoader.setReader(file => fs.promises.readFile(path.join(PUBLIC_DIR, file), 'utf-8'));
  const log = console.log;
  console.log = () => {};
  try {
    let game: Game = await GameFactory.createGame(['Alice', 'HAL'], true, 777);
    game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EASY'; });
    game = GameFactory.initializeGame(game);
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 6000 && game.phase !== GamePhase.FINAL_SCORING; i++) {
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
    expect(game.phase).toBe(GamePhase.FINAL_SCORING);
    game.players[0].type = 'human';
    delete game.players[0].aiDifficulty;
    return JSON.stringify(serializeGame(game, entries));
  } finally {
    console.log = log;
  }
}

test('fin de partie : l\'écran de fin affiche le décompte de chaque joueur et le vainqueur', async ({ page }) => {
  const save = await finishedGameSave();
  await page.addInitScript(json => { localStorage.setItem('seti_autosave', json); }, save);
  await page.goto('/');
  await page.getByText('Continuer la partie').click();

  const endGame = page.locator('.seti-endgame-modal');
  await expect(endGame).toBeVisible();
  await expect(endGame.getByRole('heading', { name: 'FIN DE PARTIE' })).toBeVisible();
  // Une ligne par joueur, avec un vainqueur au moins (trophée)
  await expect(endGame.locator('.seti-endgame-row:not(.header)')).toHaveCount(2);
  const players = endGame.locator('.seti-endgame-row:not(.header) .col-player');
  await expect(players.filter({ hasText: 'Alice' })).toHaveCount(1);
  await expect(players.filter({ hasText: 'HAL' })).toHaveCount(1);
  // Suivi de l'historique complet de la partie
  await expect(endGame.locator('.seti-history-message').first()).toBeVisible();
  await expect(endGame.locator('.seti-endgame-trophy').first()).toBeVisible();
  // Plus aucune action possible
  await expect(page.locator('.seti-main-actions .obs-track-slot.clickable[aria-label]')).toHaveCount(0);
});
