import * as fs from 'fs';
import * as path from 'path';
import { GAME_VERSION } from '../src/core/version';

test('la version du jeu est celle de package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  expect(GAME_VERSION).toBe(pkg.version);
  expect(GAME_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
