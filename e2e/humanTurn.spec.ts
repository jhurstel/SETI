import { test, expect, Page } from '@playwright/test';

/** Emplacement d'action principale disponible sur une piste du plateau joueur (exploration, observation). */
const availableAction = (page: Page, label: string) =>
  page.locator(`.obs-track-slot.clickable[aria-label="${label}"]`);
/** N'importe quel emplacement d'action principale disponible. */
const anyAvailableAction = (page: Page) => page.locator('.obs-track-slot.clickable[aria-label]');

test('tour complet du joueur humain : lancer une sonde, passer la main au robot, la récupérer', async ({ page }) => {
  await page.goto('/');

  // Nouvelle partie : 2 joueurs, robot Débutant, l'humain commence
  await page.getByRole('button', { name: 'Nouvelle Partie' }).click();
  await page.getByText('2 Joueurs').click();
  await page.getByRole('button', { name: 'Commencer' }).click();

  // Mise en place : réserver une carte de la main de départ
  const reservation = page.locator('.seti-choice-modal', { hasText: 'Réservez une carte' });
  await expect(reservation).toBeVisible({ timeout: 30_000 });
  await reservation.locator('.seti-card-wrapper').first().click();
  await reservation.getByRole('button', { name: 'Réserver' }).click();
  await expect(reservation).toHaveCount(0);

  // Action principale : lancer une sonde (2 crédits)
  await expect(availableAction(page, 'Lancer une sonde')).toBeVisible({ timeout: 30_000 });
  await availableAction(page, 'Lancer une sonde').click();
  await expect(page.locator('.seti-history-list')).toContainText('Lancer une sonde');

  // Une seule action principale par tour : les autres ne sont plus proposées
  await expect(availableAction(page, 'Lancer une sonde')).toHaveCount(0);

  // Fin du tour : le robot joue, puis la main revient au joueur humain
  await page.getByRole('button', { name: 'Prochain joueur' }).click();
  await expect(anyAvailableAction(page)).toHaveCount(0);
  await expect(anyAvailableAction(page).first()).toBeVisible({ timeout: 90_000 });

  // La partie est sauvegardée automatiquement, au format versionné
  const autosave = await page.evaluate(() => localStorage.getItem('seti_autosave'));
  expect(autosave).toContain('"saveVersion"');
});
