import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../src/core/DataLoader';
import { serializeGame } from '../src/core/GamePersistence';
import { cloneGame } from '../src/core/cloneGame';
import { AlienBoardType, Card, LifeTraceType, Game, GamePhase, HistoryEntry, InteractionState, Player, SectorType } from '../src/core/types';
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
    // Gains appliqués d'office par le même bonus : tuiles grisées
    { type: 'ACQUIRING_TECH', isBonus: true, autoGains: { pv: 2, media: 1, signals: [{ amount: 1, scope: SectorType.MARS }] } },
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
    await page.getByText('Continuer', { exact: true }).click();
    const modal = page.locator('.seti-choice-modal');
    await expect(modal).toBeVisible();
    // Annonces de début de tour terminées, souris hors de la fenêtre (pas d'infobulle)
    await page.mouse.move(5, 5);
    await page.waitForTimeout(2500);
    await modal.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  });
}

/** Écrans entiers de la documentation (public/docs/images/ecrans/) : accueil, puis partie en cours sans fenêtre */
const SCREENS_DIR = path.join(PUBLIC_DIR, 'docs', 'images', 'ecrans');

test('capture : écran d\'accueil', async ({ page }) => {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  const save = JSON.stringify(serializeGame(base.game, base.entries));
  await page.addInitScript(json => { localStorage.setItem('seti_autosave', json); }, save);
  await page.goto('/', { timeout: 300_000 });
  await expect(page.getByText('Continuer', { exact: true })).toBeVisible();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SCREENS_DIR, 'accueil.png') });
});

test('capture : écran de jeu', async ({ page }) => {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  const save = JSON.stringify(serializeGame(base.game, base.entries));
  await page.addInitScript(json => { localStorage.setItem('seti_autosave', json); }, save);
  await page.goto('/', { timeout: 300_000 });
  await page.getByText('Continuer', { exact: true }).click();
  // Annonce de début de tour fermée, souris hors du plateau (pas d'infobulle)
  await page.waitForTimeout(3000);
  await page.mouse.click(5, 5);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENS_DIR, 'jeu.png') });
});

/** Plateaux de l'écran de jeu, ouverts un par un (public/docs/images/ecrans/plateau-<nom>.png) */
const BOARDS: Record<string, { panel: string; header: string }> = {
  objectifs: { panel: '[data-tutorial="objectives"]', header: '[data-tutorial="objectives"] .seti-foldable-header' },
  technologies: { panel: '[data-tutorial="tech-board"]', header: '[data-tutorial="tech-board"] .seti-foldable-header' },
  rangee: { panel: '[data-tutorial="card-row"]', header: '[data-tutorial="card-row"] .seti-foldable-header' },
  planetes: { panel: '[data-tutorial="planets"]', header: '[data-tutorial="planets"] .seti-foldable-header' },
  especes: { panel: '.alien-board-container.left', header: '.alien-board-container.left .seti-foldable-header' },
  joueur: { panel: '[data-tutorial="player-board"]', header: '' },
  historique: { panel: '[data-tutorial="history"]', header: '' },
};

for (const [name, board] of Object.entries(BOARDS)) {
  test(`capture : plateau ${name}`, async ({ page }) => {
    fs.mkdirSync(SCREENS_DIR, { recursive: true });
    const save = JSON.stringify(serializeGame(base.game, base.entries));
    await page.addInitScript(json => { localStorage.setItem('seti_autosave', json); }, save);
    await page.goto('/', { timeout: 300_000 });
    await page.getByText('Continuer', { exact: true }).click();
    // Annonce de début de tour fermée
    await page.waitForTimeout(3000);
    await page.mouse.click(5, 5);
    if (board.header) await page.locator(board.header).first().click();
    // Souris hors du plateau (pas d'infobulle), animation d'ouverture terminée
    await page.mouse.move(5, 5);
    await page.waitForTimeout(1200);
    await page.locator(board.panel).first().screenshot({ path: path.join(SCREENS_DIR, `plateau-${name}.png`) });
  });
}

/**
 * Sous-écrans de l'accueil (public/docs/images/ecrans/accueil-<nom>.png) : fenêtres ouvertes depuis l'accueil,
 * sans partie sauvegardée, nom du joueur connu, proposition du tutoriel déjà refusée
 */
async function openHome(page: import('@playwright/test').Page, tutorial: { done?: string[]; species?: string[] } = {}) {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  await page.addInitScript(progress => {
    localStorage.setItem('seti_player_name', 'Alice');
    localStorage.setItem('seti_tutorial', JSON.stringify({ done: progress.done ?? [], dismissed: true, hintsShown: [], contextHelp: true, species: progress.species ?? [] }));
  }, tutorial);
  await page.goto('/', { timeout: 300_000 });
  await expect(page.getByText('Nouvelle partie', { exact: true })).toBeVisible();
}

/** Capture d'une fenêtre, souris à l'écart et animation d'ouverture terminée */
async function shoot(page: import('@playwright/test').Page, selector: string, name: string) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(800);
  await page.locator(selector).first().screenshot({ path: path.join(SCREENS_DIR, `accueil-${name}.png`) });
}

test('capture : nouvelle partie et tirage du premier joueur', async ({ page }) => {
  await openHome(page);
  await page.getByText('Nouvelle partie', { exact: true }).click();
  // Deux robots de niveaux différents
  await page.getByRole('button', { name: '+ Ajouter un robot' }).click();
  await page.getByRole('radiogroup', { name: 'Place 2' }).getByRole('radio', { name: 'Avancé' }).click();
  await page.getByRole('radiogroup', { name: 'Place 3' }).getByRole('radio', { name: 'Expert' }).click();
  await shoot(page, '.seti-newgame-modal', 'nouvelle-partie');

  // Tirage : faisceau verrouillé sur le premier joueur, résultat affiché
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.locator('.seti-draw-result.visible')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(400);
  await page.locator('.seti-draw-box').screenshot({ path: path.join(SCREENS_DIR, 'accueil-tirage.png') });
});

test('capture : menu du tutoriel', async ({ page }) => {
  // Quelques chapitres terminés, une espèce débloquée (les autres chapitres d'espèce restent verrouillés)
  await openHome(page, { done: ['ecran', 'sondes', 'atterrir'], species: ['Mascamites'] });
  await page.getByText('Tutoriel', { exact: true }).click();
  await expect(page.locator('.seti-tutorial-menu')).toBeVisible();
  await shoot(page, '.seti-tutorial-menu', 'tutoriel');
});

test('capture : partie en ligne (créer, rejoindre, salon)', async ({ page }) => {
  // Liste des salles fixe pour l'onglet Rejoindre : un salon qui attend un joueur, une partie en cours
  await page.route('**/rooms', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify([
      { code: 'KEPLR', status: 'lobby', createdAt: Date.now(), seats: [
        { name: 'Bob', type: 'human', claimed: true }, { name: '', type: 'human', claimed: false },
        { name: 'HAL 9000', type: 'robot', aiDifficulty: 'MEDIUM', claimed: true },
      ] },
      { code: 'VEGAS', status: 'playing', createdAt: Date.now(), round: 3, seats: [
        { name: 'Carole', type: 'human', claimed: true }, { name: 'David', type: 'human', claimed: true },
      ] },
    ]),
  }));
  await openHome(page);
  await page.getByText('Partie en ligne', { exact: true }).click();
  await expect(page.locator('.seti-online-modal')).toBeVisible();
  await shoot(page, '.seti-online-modal', 'en-ligne-creer');

  await page.getByRole('tab', { name: 'Rejoindre' }).click();
  await expect(page.locator('.seti-room-row').first()).toBeVisible({ timeout: 15_000 });
  await shoot(page, '.seti-online-modal', 'en-ligne-rejoindre');

  // Salon : une salle créée sur le serveur de test, qui attend son deuxième joueur humain
  await page.getByRole('tab', { name: 'Créer une salle' }).click();
  await page.getByRole('button', { name: 'Créer la salle' }).click();
  await expect(page.locator('.seti-online-code')).toBeVisible({ timeout: 60_000 });
  await shoot(page, '.seti-online-modal', 'en-ligne-salon');
});

/** Partie terminée entre trois robots Débutants (graine fixe), rendue à Alice : écran de fin de partie */
async function finishedGame(): Promise<string> {
  DataLoader.setReader(file => fs.promises.readFile(path.join(PUBLIC_DIR, file), 'utf-8'));
  const log = console.log;
  console.log = () => {};
  try {
    let game: Game = await GameFactory.createGame(['Alice', 'HAL', 'Chouchou'], true, 777);
    game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EASY'; });
    game = GameFactory.initializeGame(game);
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 9000 && game.phase !== GamePhase.FINAL_SCORING; i++) {
      game = CardSystem.refillCardRow(game);
      const step = AITurn.playStep(game);
      if (step.kind === 'SETUP_RESERVED') game = TurnManager.advanceSetup(step.updatedGame).updatedGame;
      else if (step.kind === 'END_TURN') {
        // Entrées de fin de tour gardées (séparateurs « Tour de … », manches) : résumé de la partie complet
        const ended = AITurn.endTurn(game);
        game = ended.updatedGame;
        entries.push(...ended.historyEntries);
      }
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

test('capture : écran de fin de partie', async ({ page }) => {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  const save = await finishedGame();
  await page.addInitScript(json => { localStorage.setItem('seti_autosave', json); }, save);
  await page.goto('/', { timeout: 300_000 });
  await page.getByText('Continuer', { exact: true }).click();
  const endGame = page.locator('.seti-endgame-modal');
  await expect(endGame).toBeVisible({ timeout: 30_000 });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(800);
  await endGame.screenshot({ path: path.join(SCREENS_DIR, 'fin-de-partie.png') });

  // Résumé de la partie : infobulle d'un tour de la manche 3 (action principale et sa cible)
  await endGame.locator('.seti-progress-round').nth(2).locator('.seti-progress-chip').nth(4).hover();
  await expect(page.locator('.seti-tooltip').first()).toBeVisible();
  await page.waitForTimeout(400);
  const area = await endGame.locator('.seti-endgame-history-title').boundingBox();
  await page.screenshot({ path: path.join(SCREENS_DIR, 'fin-de-partie-resume.png'), clip: { x: area!.x - 8, y: area!.y - 60, width: area!.width + 16, height: area!.height + 68 } });
});
