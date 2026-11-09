import { defineConfig } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';

/** Port du serveur du jeu en ligne lancé pour les tests (différent de celui du développement, 8787) */
export const E2E_SERVER_PORT = 8799;

/**
 * Tests de bout en bout (navigateur réel) : `npm run test:e2e`.
 * Sous Windows, le Chrome installé est utilisé (aucun téléchargement, PW_CHANNEL pour un autre) ;
 * ailleurs (CI), le Chromium de Playwright (`npx playwright install chromium`).
 * Deux serveurs sont lancés : le serveur du jeu en ligne (salles enregistrées dans un dossier temporaire neuf à
 * chaque lancement) et Vite, qui reçoit son adresse (VITE_SERVER_URL).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5199',
    channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined),
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run server',
      url: `http://localhost:${E2E_SERVER_PORT}/health`,
      env: { PORT: String(E2E_SERVER_PORT), SETI_DATA_DIR: path.join(os.tmpdir(), `seti-e2e-server-${Date.now()}`) },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite --port 5199 --strictPort',
      url: 'http://localhost:5199',
      env: { VITE_SERVER_URL: `ws://localhost:${E2E_SERVER_PORT}` },
      // Jamais un Vite déjà lancé : il n'aurait pas l'adresse du serveur de test
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
