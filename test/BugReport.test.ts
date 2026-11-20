import { deserializeGame, serializeGame } from '../src/core/GamePersistence';
import { cloneGame } from '../src/core/cloneGame';
import { GAME_VERSION } from '../src/core/version';
import { buildBugReport, bugReportFileName } from '../src/ui/bugReport';
import { ErrorLogEntry } from '../src/ui/errorLog';
import { createTestGame } from './helpers/gameFixture';

const env = { userAgent: 'test', screen: '1280x800 @1', language: 'fr-FR' };
const errors: ErrorLogEntry[] = [{ time: '2026-11-20T10:00:00.000Z', source: 'error', message: 'boum', count: 1 }];
const now = new Date('2026-11-20T14:05:33.000Z');

describe('rapport « Signaler un problème »', () => {
  test('partie solo : version, environnement, commentaire, erreurs, graine et sauvegarde rechargeable', async () => {
    const game = await createTestGame();
    const before = JSON.stringify(serializeGame(game, []));
    const report = buildBugReport({ comment: '  La sonde ne bouge pas  ', mode: 'solo', game, historyLog: [], errors, env, now });

    expect(report).toMatchObject({ reportVersion: 1, gameVersion: GAME_VERSION, date: now.toISOString(), env, mode: 'solo', comment: 'La sonde ne bouge pas', errors, seed: game.seed });
    // La sauvegarde du rapport, extraite dans un fichier, se recharge par « Restaurer une sauvegarde »
    const { game: reloaded } = deserializeGame(JSON.stringify(report.save));
    expect(JSON.stringify(serializeGame(reloaded, []))).toBe(JSON.stringify(serializeGame(cloneGame(game), [])));
    // La partie reçue n'est pas modifiée
    expect(JSON.stringify(serializeGame(game, []))).toBe(before);
  });

  test('écran d\'erreur ou accueil : la dernière autosauvegarde est jointe, avec sa graine', async () => {
    const game = await createTestGame();
    const autosave = JSON.stringify(serializeGame(game, []));
    const report = buildBugReport({ comment: '', mode: 'solo', autosave, errors, env, now });
    expect(report.seed).toBe(game.seed);
    expect(report.save).toEqual(JSON.parse(autosave));
  });

  test('autosauvegarde illisible : jointe telle quelle', () => {
    const report = buildBugReport({ comment: '', mode: 'solo', autosave: '{pas du json', errors: [], env, now });
    expect(report.save).toBe('{pas du json');
    expect(report.seed).toBeUndefined();
  });

  test('partie en ligne : code de la salle, joueur et vue, jamais le jeton de la place', async () => {
    const game = await createTestGame();
    const seat = { url: 'wss://seti.example.com', code: 'ABCDE', token: 'jeton-secret', playerId: game.players[0].id };
    const report = buildBugReport({ comment: '', mode: 'online', online: { ...seat, game, entries: [] }, errors, env, now });
    expect(report.online?.code).toBe('ABCDE');
    expect(report.online?.playerId).toBe(seat.playerId);
    expect(report.online?.view).toBeDefined();
    expect(report.save).toBeUndefined();
    const json = JSON.stringify(report);
    expect(json).not.toContain('jeton-secret');
    // La place n'est pas recopiée : seuls le code, le joueur et la vue
    expect(Object.keys(report.online!).sort()).toEqual(['code', 'playerId', 'view']);
  });

  test('sans partie ni autosauvegarde : rapport valide avec la version, l\'environnement et les erreurs', () => {
    const report = buildBugReport({ comment: 'menu bloqué', mode: 'none', errors, env, now });
    expect(report).toEqual({ reportVersion: 1, gameVersion: GAME_VERSION, build: expect.stringContaining(GAME_VERSION), date: now.toISOString(), env, mode: 'none', comment: 'menu bloqué', errors });
  });

  test('nom du fichier daté', () => {
    expect(bugReportFileName(now)).toBe('seti_rapport_2026-11-20-14-05-33.json');
  });
});
