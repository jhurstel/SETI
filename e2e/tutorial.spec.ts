import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { TUTORIAL_CHAPTERS } from '../src/tutorial/chapters';
import { parseTutorialText } from '../src/tutorial/tutorialText';
import { availableAction, dismissFirstPlayerDraw, reserveIfAsked, startLocalGame } from './helpers';

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

test('chaque chapitre préparé démarre avec sa bulle, et toutes les zones qu\'il décrit sont à l\'écran', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Plus tard' }).click();
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
  await page.getByText('Continuer la partie').click();
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
