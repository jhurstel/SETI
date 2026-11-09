import { test, expect } from '@playwright/test';
import { anyAvailableAction, availableAction } from './helpers';

test('tour complet du joueur humain : lancer une sonde, passer la main au robot, la récupérer', async ({ page }) => {
  await page.goto('/');

  // Nouvelle partie : 1 robot (place par défaut) Débutant ; premier joueur tiré au hasard (radar, un clic le ferme)
  await page.getByRole('button', { name: 'Nouvelle Partie' }).click();
  await page.getByRole('radio', { name: 'Débutant' }).click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  const draw = page.getByRole('dialog', { name: 'Tirage du premier joueur' });
  await expect(draw).toBeVisible({ timeout: 30_000 });
  await draw.click();
  await expect(draw).toHaveCount(0);

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
