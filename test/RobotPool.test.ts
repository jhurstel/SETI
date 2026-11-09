import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildSync } from 'esbuild';
import { RobotPool } from '../server/RobotPool';
import { computeEndTurn, computeStep } from '../src/ai/robotCompute';
import { GameSession } from '../src/session/GameSession';
import { Game } from '../src/core/types';
import { createTestGame } from './helpers/gameFixture';

/** Fil des robots compilé comme pour le serveur (npm run server:build), dans un dossier temporaire */
let dir: string;
let workerFile: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seti-robots-'));
  workerFile = path.join(dir, 'robotWorker.js');
  buildSync({ entryPoints: [path.join(__dirname, '..', 'server', 'robotWorker.ts')], bundle: true, platform: 'node', target: 'node20', outfile: workerFile, logLevel: 'error' });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function robotGame(): Promise<Game> {
  const game = await createTestGame(['R1', 'R2']);
  return { ...game, players: game.players.map(p => ({ ...p, type: 'robot' as const, aiDifficulty: 'MEDIUM' as const })) };
}

describe('RobotPool : robots du serveur dans des fils séparés (worker_threads)', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); warnSpy.mockRestore(); });

  test('même étape et même état du générateur que sur place, plusieurs demandes à la fois', async () => {
    const game = await robotGame();
    const pool = new RobotPool(workerFile, 2);
    try {
      const local = computeStep(game);
      const [a, b] = await Promise.all([pool.playStep(game), pool.playStep(game)]);
      expect(pool.busy).toBe(0);
      for (const remote of [a, b]) {
        expect(remote.rngState).toBe(local.rngState);
        expect(remote.step.kind).toBe(local.step.kind);
      }
      // L'étape revenue du fil s'applique comme une étape calculée sur place
      const applied = GameSession.applyRobotStep(game, a.step, a.rngState);
      expect(applied.error).toBeUndefined();
      expect(applied.game.rngState).toBe(GameSession.applyRobotStep(game, local.step, local.rngState).game.rngState);

      const end = await pool.endTurn(game);
      expect(end.rngState).toBe(computeEndTurn(game).rngState);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      await pool.close();
    }
  }, 60000);

  test('calcul qui échoue dans le fil, fil arrêté : calcul sur place, le fil est remplacé', async () => {
    const game = await robotGame();
    const crashFile = path.join(dir, 'crash.js');
    // Fil qui s'arrête dès la première demande
    fs.writeFileSync(crashFile, "require('worker_threads').parentPort.on('message', () => process.exit(3));");
    const pool = new RobotPool(crashFile, 1);
    try {
      const local = computeStep(game);
      expect((await pool.playStep(game)).rngState).toBe(local.rngState);
      expect((await pool.endTurn(game)).rngState).toBe(computeEndTurn(game).rngState);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sur place'), expect.stringContaining('code 3'));
    } finally {
      await pool.close();
    }
    // Arrêté : plus de fil, les demandes se calculent sur place
    expect((await pool.playStep(game)).rngState).toBe(computeStep(game).rngState);

    // Partie que le moteur ne sait pas calculer : l'erreur du fil, puis celle du calcul sur place
    const broken = { ...game, players: [] } as unknown as Game;
    const healthy = new RobotPool(workerFile, 1);
    try {
      await expect(healthy.playStep(broken)).rejects.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('calcul du robot sur place'), expect.any(String));
    } finally {
      await healthy.close();
    }
  }, 60000);
});
