import { expect, Page } from '@playwright/test';

/** Action principale disponible dans la ligne des actions du plateau joueur (hexagones) */
export const availableAction = (page: Page, label: string) =>
  page.locator(`.seti-main-actions .obs-track-slot.clickable[aria-label="${label}"]`);

/** N'importe quelle action principale disponible : c'est au joueur de cet écran de jouer */
export const anyAvailableAction = (page: Page) => page.locator('.seti-main-actions .obs-track-slot.clickable[aria-label]');

/** Sondes et capsules posées sur le plateau du système solaire */
export const probesOnBoard = (page: Page) => page.locator('.seti-probe');

/** Historique de la partie */
export const history = (page: Page) => page.locator('.seti-history-list');

/** Bouton « Annuler la dernière action » de l'historique (une flèche ; « début du tour » en a deux) */
export const undoLastButton = (page: Page) => page.locator('.seti-history-undo-btn').filter({ hasText: /^↩$/ });

/** Ferme l'animation du tirage du premier joueur, si elle est affichée */
export async function dismissFirstPlayerDraw(page: Page) {
  const draw = page.getByRole('dialog', { name: 'Tirage du premier joueur' });
  await expect(draw).toBeVisible({ timeout: 30_000 });
  await draw.click();
  await expect(draw).toHaveCount(0);
}

/** Fenêtre de réservation de la mise en place, si elle est affichée pour ce joueur : réserve la première carte */
export async function reserveIfAsked(page: Page): Promise<boolean> {
  const reservation = page.locator('.seti-choice-modal', { hasText: 'Réservez une carte' });
  if (!(await reservation.isVisible())) return false;
  await reservation.locator('.seti-card-wrapper').first().click();
  await reservation.getByRole('button', { name: 'Réserver' }).click();
  await expect(reservation).toHaveCount(0);
  return true;
}

/** Nouvelle partie solo contre un robot Débutant, jusqu'à ce que le joueur humain puisse jouer son premier tour */
export async function startLocalGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouvelle Partie' }).click();
  await page.getByRole('radio', { name: 'Débutant' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  await dismissFirstPlayerDraw(page);
  const reservation = page.locator('.seti-choice-modal', { hasText: 'Réservez une carte' });
  await expect(reservation).toBeVisible({ timeout: 30_000 });
  await reserveIfAsked(page);
  // Le robot réserve et joue éventuellement son premier tour : la main revient au joueur humain
  await expect(anyAvailableAction(page).first()).toBeVisible({ timeout: 90_000 });
}
