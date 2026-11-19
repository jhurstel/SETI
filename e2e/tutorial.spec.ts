import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { TUTORIAL_CHAPTERS } from '../src/tutorial/chapters';
import { parseTutorialText } from '../src/tutorial/tutorialText';
import { availableAction, dismissFirstPlayerDraw, reserveIfAsked, startLocalGame, undoLastButton } from './helpers';

const text = parseTutorialText(fs.readFileSync(path.resolve(__dirname, '../public/docs/tutoriel.md'), 'utf-8'));
const bubble = (page: Page) => page.locator('.seti-tutorial-bubble');

/** Ferme l'annonce de début de tour si elle est affichée (elle recouvre l'écran un instant) */
async function dismissAnnouncement(page: Page) {
  const announcement = page.locator('.seti-announcement');
  if (await announcement.isVisible()) await announcement.click({ force: true, timeout: 5_000 }).catch(() => {});
  await expect(announcement).toHaveCount(0, { timeout: 10_000 });
}

/** Clic dans la bulle, souris d'abord éloignée du plateau (une infobulle ouverte la recouvrirait) */
async function clickInBubble(page: Page, name: string) {
  await page.mouse.move(1, 1);
  await bubble(page).getByRole('button', { name }).click();
}

/** Progression du tutoriel où ces espèces sont débloquées (proposition du premier lancement refusée) */
async function unlockAllSpecies(page: Page, species = ['Mascamites', 'Anomalies', 'Oumuamua', 'Centauriens', 'Exertiens']) {
  await page.addInitScript(names => {
    localStorage.setItem('seti_tutorial', JSON.stringify({ done: [], dismissed: true, hintsShown: [], contextHelp: false, species: names }));
  }, species);
}

/** Accueil → menu du tutoriel → chapitre */
async function openChapter(page: Page, chapterId: string) {
  await page.getByRole('button', { name: /Tutoriel/ }).first().click();
  await page.getByRole('dialog', { name: 'Tutoriel' }).getByRole('button', { name: new RegExp(`^${text[chapterId].title}`) }).click();
  await expect(bubble(page)).toBeVisible({ timeout: 30_000 });
  await expect(bubble(page)).toContainText(text[chapterId].title);
}

test('premier lancement : le tutoriel est proposé ; « Plus tard » ne le propose plus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Nouveau sur SETI ?')).toBeVisible();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await page.reload();
  await expect(page.getByText('Nouveau sur SETI ?')).toHaveCount(0);
});

test('chapitre « L\'écran et le tour » joué jusqu\'au bout, puis coché dans le menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Commencer le tutoriel' }).click();
  await expect(bubble(page)).toBeVisible({ timeout: 30_000 });
  await dismissAnnouncement(page);

  // Explications : « Suivant » jusqu'à l'étape d'action, la zone décrite mise en avant
  for (let i = 0; i < 10; i++) {
    await clickInBubble(page, 'Suivant');
  }
  await expect(bubble(page)).toContainText(text.ecran.steps.lancer.title);
  // Guidage souple : seule l'action attendue est jouable
  await expect(availableAction(page, 'Scanner un secteur')).toHaveCount(0);
  await availableAction(page, 'Lancer une sonde').click();
  await expect(bubble(page)).toContainText(text.ecran.steps['fin-du-tour'].title);
  await availableAction(page, 'Prochain joueur').click();
  await dismissAnnouncement(page);
  await expect(bubble(page)).toContainText(text.ecran.steps.conclusion.title);
  await clickInBubble(page, 'Suivant');
  await expect(bubble(page)).toContainText('Chapitre terminé !');

  await clickInBubble(page, 'Menu des chapitres');
  await expect(page.getByRole('button', { name: `${text.ecran.title} (terminé)` })).toBeVisible();
});

/** Échange 2 crédits contre 1 énergie (infobulle de la tuile des crédits) */
async function tradeCredits(page: Page) {
  await page.locator('.seti-stat-tile.has-actions').first().hover();
  await page.locator('.seti-resource-tooltip').getByRole('button', { name: 'Échanger' }).first().click();
  await page.mouse.move(1, 1);
}

test("impasse : crédits échangés, mode annulation ; l'annulation rend l'étape, « Recommencer » le chapitre", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await openChapter(page, 'ecran');
  await dismissAnnouncement(page);
  for (let i = 0; i < 10; i++) await clickInBubble(page, 'Suivant');
  await expect(bubble(page)).toContainText(text.ecran.steps.lancer.title);

  // 4 crédits : deux échanges n'en laissent plus pour lancer une sonde
  await tradeCredits(page);
  await expect(bubble(page)).toContainText(text.ecran.steps.lancer.title);
  await tradeCredits(page);
  await expect(bubble(page)).toContainText(text.ecran.steps['annuler-credits'].title);
  await expect(bubble(page)).toContainText('Annulez, ou recommencez le chapitre');
  await expect(availableAction(page, 'Lancer une sonde')).toHaveCount(0);

  // Annulation du dernier échange : l'étape « Lancez une sonde » revient
  await undoLastButton(page).click();
  await expect(bubble(page)).toContainText(text.ecran.steps.lancer.title);

  // De nouveau dans l'impasse, puis « Recommencer le chapitre » : retour à la première étape
  await tradeCredits(page);
  await expect(bubble(page)).toContainText(text.ecran.steps['annuler-credits'].title);
  await clickInBubble(page, 'Recommencer le chapitre');
  await dismissAnnouncement(page);
  await expect(bubble(page)).toContainText(text.ecran.steps.bienvenue.title);
});

test('chaque chapitre préparé démarre avec sa bulle, et toutes les zones qu\'il décrit sont à l\'écran', async ({ page }) => {
  // Toutes les espèces débloquées : les chapitres d'espèce sont jouables
  await unlockAllSpecies(page);
  await page.goto('/');
  for (const chapter of TUTORIAL_CHAPTERS.filter(c => c.seed !== undefined)) {
    await openChapter(page, chapter.id);
    for (const target of new Set(chapter.steps.map(s => s.target).filter((t): t is string => !!t))) {
      expect(await page.locator(`[data-tutorial="${target}"]`).count(), `${chapter.id} : ${target}`).toBeGreaterThan(0);
    }
    await clickInBubble(page, 'Quitter');
    await expect(page.getByRole('dialog', { name: 'Accueil' })).toBeVisible();
  }
});

test('un chapitre ne touche pas la partie sauvegardée ; un rechargement en plein chapitre ramène à l\'accueil', async ({ page }) => {
  await startLocalGame(page);
  await page.waitForTimeout(800); // écriture différée de la sauvegarde automatique (500 ms)
  const saved = await page.evaluate(() => localStorage.getItem('seti_autosave'));
  expect(saved).toBeTruthy();

  await page.reload();
  await openChapter(page, 'sondes');
  await dismissAnnouncement(page);
  await clickInBubble(page, 'Suivant');
  await availableAction(page, 'Lancer une sonde').click();
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => localStorage.getItem('seti_autosave'))).toBe(saved);

  // Rechargement : le chapitre n'est pas conservé
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Accueil' })).toBeVisible();
  await expect(bubble(page)).toHaveCount(0);

  // Quitter un chapitre : « Continuer » reprend la partie sauvegardée
  await openChapter(page, 'scanner');
  await clickInBubble(page, 'Quitter');
  expect(await page.evaluate(() => localStorage.getItem('seti_autosave'))).toBe(saved);
  await page.getByText('Continuer', { exact: true }).click();
  await expect(bubble(page)).toHaveCount(0);
});

test('« Première vraie partie » : une vraie partie contre un robot Débutant, avec la bulle d\'accueil', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await page.getByRole('button', { name: /Tutoriel/ }).first().click();
  await page.getByRole('dialog', { name: 'Tutoriel' }).getByRole('button', { name: new RegExp(`^${text['premiere-partie'].title}`) }).click();
  await dismissFirstPlayerDraw(page);
  // Mise en place : la réservation est un choix en cours, la bulle s'efface jusqu'à ce qu'elle soit faite
  const reservation = page.locator('.seti-choice-modal', { hasText: 'Réservez une carte' });
  await expect(reservation).toBeVisible({ timeout: 30_000 });
  await expect(bubble(page)).toHaveCount(0);
  await reserveIfAsked(page);
  await expect(bubble(page)).toContainText(text['premiere-partie'].steps.bienvenue.title, { timeout: 30_000 });
  await expect(page.locator('.seti-player-kind').filter({ has: page.locator('.seti-level-strength') }).first()).toBeVisible();
});

test("chapitres d'espèce verrouillés et règles des espèces masquées, puis débloqués", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await page.getByRole('button', { name: /Tutoriel/ }).first().click();
  const menu = page.getByRole('dialog', { name: 'Tutoriel' });
  await expect(menu.getByRole('button', { name: 'Espèce inconnue (chapitre verrouillé)' })).toHaveCount(5);
  await expect(menu).not.toContainText('Anomalies');
  // Pas de bouton Fermer : Échap ramène à l'accueil
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Documentation' }).click();
  const doc = page.getByRole('dialog', { name: 'Documentation' });
  await expect(doc).toContainText('Espèces encore inconnues');
  await expect(doc.locator('h3, h4', { hasText: 'Anomalies' })).toHaveCount(0);

  // Les Anomalies rencontrées en partie (progression enregistrée) : leur chapitre et leurs règles apparaissent
  await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('seti_tutorial') ?? '{}');
    localStorage.setItem('seti_tutorial', JSON.stringify({ ...progress, species: ['Anomalies'] }));
  });
  await page.reload();
  await page.getByRole('button', { name: /Tutoriel/ }).first().click();
  await expect(menu.getByRole('button', { name: 'Espèce inconnue (chapitre verrouillé)' })).toHaveCount(4);
  await expect(menu.getByRole('button', { name: new RegExp(`^${text.anomalies.title}`) })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Documentation' }).click();
  await expect(doc.locator('h3, h4', { hasText: 'Anomalies' })).toHaveCount(1);
});

test('chapitre Anomalies : découverte, ellipse, puis la rotation amène la Terre sur une anomalie', async ({ page }) => {
  await unlockAllSpecies(page, ['Anomalies']);
  await page.goto('/');
  await openChapter(page, 'anomalies');
  await dismissAnnouncement(page);
  await clickInBubble(page, 'Suivant');
  await expect(bubble(page)).toContainText(text.anomalies.steps.analyser.title);
  await availableAction(page, 'Analyser les données').click();
  // Trace bleue sur le triangle de la première espèce : la découverte se résout à la fin du tour
  await page.locator('.alien-triangle-slot.clickable').first().click();
  await expect(bubble(page)).toContainText(text.anomalies.steps.reveler.title);
  await availableAction(page, 'Prochain joueur').click();
  await dismissAnnouncement(page);
  await expect(bubble(page)).toContainText(text.anomalies.steps.decouverte.title, { timeout: 15_000 });
  await clickInBubble(page, 'Suivant');
  await expect(bubble(page)).toContainText(text.anomalies.steps.jetons.title);
  await clickInBubble(page, 'Suivant');
  await expect(bubble(page)).toContainText(text.anomalies.steps.ellipse.title);
  await clickInBubble(page, 'Suivant');
  await expect(bubble(page)).toContainText(text.anomalies.steps.rechercher.title);
  await expect(page.locator('[data-tutorial="history"]')).toContainText('Quelques tours plus tard');
  await availableAction(page, 'Rechercher une tech').click();
  // La rotation a amené la Terre sur l'anomalie : récompense gagnée (l'historique le raconte), technologie à choisir
  await expect(page.locator('[data-tutorial="history"]')).toContainText('activée', { timeout: 15_000 });
});

test("« Traces de vie et espèces » sans espèce rencontrée : l'espèce découverte reste anonyme", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await openChapter(page, 'especes');
  await dismissAnnouncement(page);
  await clickInBubble(page, 'Suivant');
  // Deux données dans l'ordinateur, analyse, trace bleue sur le triangle de la première espèce
  for (let i = 0; i < 2; i++) await page.locator('.computer-slot.can-fill').first().click();
  await availableAction(page, 'Analyser les données').click();
  await page.locator('.alien-triangle-slot.clickable').first().click();
  // La découverte se résout à la fin du tour
  await expect(bubble(page)).toContainText(text.especes.steps.reveler.title);
  await availableAction(page, 'Prochain joueur').click();
  await dismissAnnouncement(page);
  await expect(bubble(page)).toContainText(text.especes.steps.decouverte.title, { timeout: 15_000 });
  await expect(page.locator('.alien-board-container.left')).toContainText('Espèce découverte');
  await expect(page.locator('body')).not.toContainText('Anomalies');
});
