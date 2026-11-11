import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../src/core/DataLoader';
import { serializeGame } from '../src/core/GamePersistence';
import { cloneGame } from '../src/core/cloneGame';
import { AlienBoardType, Card, LifeTraceType, Game, GamePhase, HistoryEntry, InteractionState, Player } from '../src/core/types';
import { GameFactory } from '../src/engine/GameFactory';
import { TurnManager } from '../src/engine/TurnManager';
import { GameSession } from '../src/session/GameSession';
import { InteractionQueue } from '../src/session/InteractionQueue';
import { CardSystem } from '../src/systems/CardSystem';
import { AITurn } from '../src/ai/AITurn';

/**
 * Captures des fenêtres de choix pour la documentation (public/docs/images/menus/*.png) : pas un test.
 * Lancer : SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus
 * Une partie de milieu de manche (graine fixe, robots Débutants) reçoit l'interaction de chaque fenêtre,
 * puis est injectée comme sauvegarde automatique et reprise dans le navigateur.
 */
test.skip(!process.env.SETI_DOC_SCREENSHOTS, 'Captures de la documentation : SETI_DOC_SCREENSHOTS=1');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const OUT_DIR = path.join(PUBLIC_DIR, 'docs', 'images', 'menus');

let base: { game: Game; entries: HistoryEntry[] };

/** Manche 2, au tour d'Alice (humaine) */
async function midGame() {
  DataLoader.setReader(file => fs.promises.readFile(path.join(PUBLIC_DIR, file), 'utf-8'));
  const log = console.log;
  console.log = () => {};
  try {
    let game: Game = await GameFactory.createGame(['Alice', 'HAL'], true, 4242);
    game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EASY'; });
    game = GameFactory.initializeGame(game);
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 6000; i++) {
      if (game.phase === GamePhase.PLAYING && game.currentRound >= 2 && game.currentPlayerIndex === 0 && !game.interaction
        && !game.players[0].hasPerformedMainAction && !game.players[0].hasPassed) break;
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
    return { game, entries };
  } finally {
    console.log = log;
  }
}

const alice = (game: Game): Player => game.players[0];

/** Retire une carte de la pioche, de la rangée ou des piles de manche */
function take(game: Game, id: string): Card {
  for (const pile of [game.decks.cards, game.decks.cardRow, game.decks.discardPile, ...Object.values(game.decks.roundDecks)]) {
    const index = pile.findIndex(c => c.id === id);
    if (index !== -1) return pile.splice(index, 1)[0];
  }
  throw new Error(`Carte ${id} introuvable`);
}

/** Main d'Alice complétée jusqu'à `count` cartes (hors Exertiens) */
function fillHand(game: Game, count: number) {
  while (CardSystem.getHandCards(alice(game)).length < count) alice(game).cards.push(game.decks.cards.shift()!);
}

function setInteraction(game: Game, interaction: InteractionState): Game {
  return InteractionQueue.set(game, interaction, []);
}

/** Fenêtres capturées : nom du fichier → préparation de la partie */
const MENUS: Record<string, (game: Game) => Game> = {
  recompenses: game => InteractionQueue.enqueue(game, [
    { type: 'ACQUIRING_TECH', isBonus: true },
    { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.YELLOW },
    { type: 'MOVING_PROBE', count: 2 },
  ], 'doc'),
  reservation: game => { fillHand(game, 4); return setInteraction(game, { type: 'RESERVING_CARD', count: 1, selectedCards: [] }); },
  'carte-fin-de-manche': game => setInteraction(game, { type: 'CHOOSING_ROUND_CARD', round: game.currentRound, playerId: alice(game).id }),
  'defausse-fin-de-manche': game => { fillHand(game, 6); return setInteraction(game, { type: 'DISCARDING_CARD', count: 2, selectedCards: [] }); },
  echange: game => { fillHand(game, 4); return setInteraction(game, { type: 'TRADING_CARD', count: 2, targetGain: 'energy', selectedCards: [] }); },
  'defausse-signaux': game => { fillHand(game, 4); return setInteraction(game, { type: 'DISCARDING_FOR_SIGNAL', count: 2, selectedCards: [] }); },
  'vie-quotidienne': game => {
    const drawn = game.decks.cards.splice(0, 3);
    alice(game).cards.push(...drawn);
    return setInteraction(game, { type: 'DISCARDING_DRAWN_CARD', cardIds: drawn.map(c => c.id), step: 'FREE_ACTION' });
  },
  'media-ou-deplacement': game => setInteraction(game, { type: 'CHOOSING_MEDIA_OR_MOVE' }),
  'observation-2': game => setInteraction(game, { type: 'CHOOSING_OBS2_ACTION' }),
  'observation-3': game => setInteraction(game, { type: 'CHOOSING_OBS3_ACTION' }),
  'observation-4': game => { alice(game).energy = Math.max(alice(game).energy, 2); return setInteraction(game, { type: 'CHOOSING_OBS4_ACTION' }); },
  token: game => {
    alice(game).tokens = 2;
    return setInteraction(game, {
      type: 'DISCARDING_TOKEN', reward: { movements: 2 }, rewardText: '2 Déplacements', repeat: true, then: { landing: 1 },
      cardId: 'ET.25', cardName: 'Adaptation des Sondes',
    });
  },
  centaurien: game => {
    const species = game.species.find(s => s.name === AlienBoardType.CENTAURIENS)!;
    species.message![1] = { ...species.message![1], isAvailable: false, claimedBy: game.players[1].id };
    return setInteraction(game, { type: 'CHOOSING_CENTAURIEN_REWARD' });
  },
  exertien: game => {
    const species = game.species.find(s => s.name === AlienBoardType.EXERTIENS)!;
    alice(game).cards.push(...species.cards.splice(0, 3));
    return setInteraction(game, { type: 'CHOOSING_EXERTIEN_CARD', milestone: 0 });
  },
  specimen: game => {
    const species = game.species.find(s => s.name === AlienBoardType.MASCAMITES)!;
    const jupiter = game.board.planets.find(p => p.id === 'jupiter')!;
    jupiter.mascamiteTokens = species.specimen!.slice(0, 3);
    jupiter.mascamiteSeenBy = [alice(game).id];
    return setInteraction(game, { type: 'COLLECTING_SPECIMEN', planetId: 'jupiter' });
  },
  mission: game => {
    const player = alice(game);
    player.credits = 20;
    player.energy = 10;
    let played = game;
    for (const id of ['1', '51']) {
      player.cards.push(take(played, id));
      played = CardSystem.playCard(played, player.id, id).updatedGame;
    }
    const missions = alice(played).missions.filter(m => m.cardId === '1' || m.cardId === '51');
    return setInteraction(played, {
      type: 'CHOOSING_MISSION_REQUIREMENT', playerId: player.id,
      options: missions.flatMap(m => m.requirements.map(r => ({ missionId: m.id, requirementId: r.id! }))),
    });
  },
};

// Machine chargée (partie simulée, premier chargement de Vite) : délais allongés
test.setTimeout(400_000);

test.beforeAll(async () => {
  test.setTimeout(400_000);
  base = await midGame();
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

for (const [name, prepare] of Object.entries(MENUS)) {
  test(`capture : ${name}`, async ({ page }) => {
    const game = prepare(cloneGame(base.game));
    const save = JSON.stringify(serializeGame(game, base.entries));
    await page.addInitScript(json => { localStorage.setItem('seti_autosave', json); }, save);
    await page.goto('/', { timeout: 300_000 });
    await page.getByText('Continuer la partie').click();
    const modal = page.locator('.seti-choice-modal');
    await expect(modal).toBeVisible();
    // Annonces de début de tour terminées, souris hors de la fenêtre (pas d'infobulle)
    await page.mouse.move(5, 5);
    await page.waitForTimeout(2500);
    await modal.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  });
}
