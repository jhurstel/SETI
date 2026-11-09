import { test, expect } from '@playwright/test';
import { availableAction, history, probesOnBoard, startLocalGame, undoLastButton } from './helpers';

test('partie solo : annuler une action, puis retrouver la partie après un rechargement de la page', async ({ page }) => {
  await startLocalGame(page);
  const probesBefore = await probesOnBoard(page).count();
  const launches = () => history(page).getByText('Lancer une sonde');
  const launchesBefore = await launches().count();

  // Lancer une sonde, puis l'annuler : la sonde disparaît du plateau et de l'historique, l'action est de nouveau possible
  await availableAction(page, 'Lancer une sonde').click();
  await expect(probesOnBoard(page)).toHaveCount(probesBefore + 1);
  await expect(launches()).toHaveCount(launchesBefore + 1);
  await undoLastButton(page).click();
  await expect(probesOnBoard(page)).toHaveCount(probesBefore);
  await expect(launches()).toHaveCount(launchesBefore);
  await expect(availableAction(page, 'Lancer une sonde')).toBeVisible();

  // Relancer, puis recharger la page : la sauvegarde automatique rend la partie telle quelle
  await availableAction(page, 'Lancer une sonde').click();
  await expect(probesOnBoard(page)).toHaveCount(probesBefore + 1);
  await page.waitForTimeout(800); // écriture différée de la sauvegarde automatique (500 ms)
  await page.reload();
  await page.getByText('Continuer la partie').click();
  await expect(probesOnBoard(page)).toHaveCount(probesBefore + 1);
  await expect(launches()).toHaveCount(launchesBefore + 1);
  // Le tirage du premier joueur ne se rejoue pas, et l'action principale reste faite
  await expect(page.getByRole('dialog', { name: 'Tirage du premier joueur' })).toHaveCount(0);
  await expect(availableAction(page, 'Lancer une sonde')).toHaveCount(0);
  // L'annulation reste possible après le rechargement
  await expect(undoLastButton(page)).toBeVisible();
});
