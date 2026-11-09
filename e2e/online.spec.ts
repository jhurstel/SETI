import { test, expect, Page } from '@playwright/test';
import { anyAvailableAction, availableAction, dismissFirstPlayerDraw, history, probesOnBoard, reserveIfAsked, undoLastButton } from './helpers';

/** Accueil → Partie en ligne, avec son nom */
async function openOnline(page: Page, name: string) {
  await page.goto('/');
  await page.getByText('Partie en ligne').first().click();
  await page.locator('#seti-online-name').fill(name);
}

test('partie en ligne à deux : salle, liste des salles, commande vue des deux côtés, annulation, reprise après rechargement', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();

  // Alice crée une salle de 2 joueurs humains (place 2 : humain, par défaut)
  await openOnline(alice, 'Alice');
  await alice.getByRole('button', { name: 'Créer la salle' }).click();
  const code = (await alice.locator('.seti-online-code').textContent({ timeout: 60_000 }))!.trim();
  expect(code).toMatch(/^[A-Z]{5}$/);

  // Bob trouve la salle dans la liste de l'onglet Rejoindre et la rejoint d'un clic
  await openOnline(bob, 'Bob');
  await bob.getByRole('tab', { name: 'Rejoindre' }).click();
  const room = bob.locator('.seti-room-row', { hasText: code });
  await expect(room).toBeVisible({ timeout: 15_000 });
  await expect(room).toContainText('Salle de Alice');
  await room.getByRole('button', { name: 'Rejoindre' }).click();

  // La partie commence chez les deux : tirage du premier joueur, puis mise en place (chacun réserve à son tour)
  await dismissFirstPlayerDraw(alice);
  await dismissFirstPlayerDraw(bob);
  const pages = [alice, bob];
  await expect.poll(async () => {
    for (const page of pages) await reserveIfAsked(page);
    return (await anyAvailableAction(alice).count()) + (await anyAvailableAction(bob).count());
  }, { timeout: 60_000, intervals: [500] }).toBeGreaterThan(0);

  // Le joueur dont c'est le tour lance une sonde ; l'autre la voit sur son plateau et dans l'historique
  const active = (await anyAvailableAction(alice).count()) > 0 ? alice : bob;
  const other = active === alice ? bob : alice;
  await expect(anyAvailableAction(other)).toHaveCount(0);
  const probesBefore = await probesOnBoard(active).count();
  await availableAction(active, 'Lancer une sonde').click();
  await expect(probesOnBoard(active)).toHaveCount(probesBefore + 1);
  await expect(probesOnBoard(other)).toHaveCount(probesBefore + 1);
  await expect(history(other)).toContainText('Lancer une sonde');

  // Annulation en ligne : seul l'auteur peut annuler son action, et les deux plateaux reviennent en arrière
  await expect(undoLastButton(other)).toHaveCount(0);
  await undoLastButton(active).click();
  await expect(probesOnBoard(active)).toHaveCount(probesBefore);
  await expect(probesOnBoard(other)).toHaveCount(probesBefore);
  await expect(availableAction(active, 'Lancer une sonde')).toBeVisible();

  // Bob recharge sa page : l'accueil propose de reprendre sa place, et il retrouve la partie en cours
  await bob.reload();
  await bob.getByText('Reprendre en ligne').click();
  await expect(bob.locator('.seti-player-tab', { hasText: 'Alice' })).toBeVisible({ timeout: 30_000 });
  await expect(bob.locator('.seti-player-tab', { hasText: 'Bob' })).toBeVisible();
  await expect(probesOnBoard(bob)).toHaveCount(probesBefore);
  // Toujours en ligne : une action d'un joueur arrive chez l'autre
  await availableAction(active, 'Lancer une sonde').click();
  await expect(probesOnBoard(bob)).toHaveCount(probesBefore + 1);

  await alice.context().close();
  await bob.context().close();
});
