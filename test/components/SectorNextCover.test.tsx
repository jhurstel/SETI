/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../../src/core/DataLoader';
import { Game } from '../../src/core/types';
import { SectorDetails } from '../../src/ui/components/SectorDetails';
import { sectorNamePrefixAngles } from '../../src/ui/solarGeometry';
import { createTestGame } from '../helpers/gameFixture';

/** Prochain gain de couverture dessiné avant le nom de chaque secteur */

let base: Game;
beforeAll(async () => {
  // jsdom n'a ni fetch ni Response : les CSV sont lus sur le disque
  (global as { fetch?: unknown }).fetch ??= () => Promise.reject(new Error('fetch'));
  DataLoader.setReader(async p => fs.readFileSync(path.resolve(__dirname, '../../public', p), 'utf8'));
  base = await createTestGame();
});

const PV_VIEWBOX = '-20 -20 40 40';
/** Symboles dessinés avant le nom de chaque secteur : 'trace' ou 'pv:<n>', dans l'ordre du DOM */
const symbolsBySector = (game: Game) => {
  const { container } = render(<SectorDetails game={game} interactionState={{ type: 'IDLE' }} highlightedSectorSlots={[]} onSectorClick={jest.fn()} setActiveTooltip={jest.fn()} />);
  return Object.fromEntries([...container.querySelectorAll('svg.seti-sector-details-svg > g')].map((g, i) => [
    game.board.sectors[i].name,
    [...g.querySelectorAll('.sector-next-cover > g > svg')].map(svg => svg.getAttribute('viewBox') === PV_VIEWBOX ? `pv:${svg.textContent}` : 'trace').sort(),
  ]));
};

test('secteur jamais couvert : trace de vie rouge ; trace et PV pour les secteurs noirs', () => {
  const symbols = symbolsBySector(base);
  const beta = base.board.sectors.find(s => s.name === 'Beta Pictoris')!;
  const kepler = base.board.sectors.find(s => s.name === 'Kepler 22')!;
  expect(symbols[kepler.name]).toEqual(['trace']);
  expect(symbols[beta.name]).toEqual([`pv:${beta.firstBonus.pv}`, 'trace']);
});

test('secteur déjà couvert : récompense des couvertures suivantes', () => {
  const game: Game = JSON.parse(JSON.stringify(base));
  const kepler = game.board.sectors.find(s => s.name === 'Kepler 22')!;
  const proxima = game.board.sectors.find(s => s.name === 'Proxima Centauri')!;
  kepler.isCovered = true;
  proxima.isCovered = true;
  const symbols = symbolsBySector(game);
  expect(symbols[kepler.name]).toEqual([`pv:${kepler.nextBonus.pv}`]);
  expect(symbols[proxima.name]).toEqual(['trace']);
});

test('symboles avant le nom, du côté où commence la lecture, sans toucher le nom', () => {
  // Nom de 10 caractères centré à -112,5° sur un arc de rayon 76 : en haut, le début est vers les angles décroissants
  const [near, far] = sectorNamePrefixAngles(-112.5, 10, 76, false, 2, 3);
  expect(near).toBeLessThan(-112.5);
  expect(far).toBeLessThan(near);
  const halfName = (10 * 2.2 / 2) / 76 * 180 / Math.PI;
  expect(-112.5 - near).toBeGreaterThan(halfName);
  // En bas, le nom se lit dans l'autre sens
  const [bottom] = sectorNamePrefixAngles(90, 10, 76, true, 1, 3);
  expect(bottom).toBeGreaterThan(90 + halfName);
});
