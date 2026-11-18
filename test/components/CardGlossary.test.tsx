/** @jest-environment jsdom */
import * as fs from 'fs';
import * as path from 'path';
import { render, screen, waitFor } from '@testing-library/react';
import { DataLoader } from '../../src/core/DataLoader';
import { CardGlossary, SpeciesCardGlossary } from '../../src/ui/components/CardGlossary';

/** Planches de cartes de la documentation : paquet de base par type, cartes d'une espèce */

beforeAll(() => {
  // jsdom n'a pas fetch : lecture des CSV sur disque
  DataLoader.setReader(async p => fs.readFileSync(path.resolve(__dirname, '../../public', p), 'utf8'));
});

test('planche du paquet de base : 138 cartes sans sous-section, par numéro', async () => {
  const { container } = render(<CardGlossary />);
  await waitFor(() => expect(container.querySelectorAll('.card-face')).toHaveLength(138), { timeout: 20000 });
  expect(container.querySelector('section, h4')).toBeNull();
  const ids = [...container.querySelectorAll('.card-face')].map(face => face.getAttribute('data-card-id')!);
  // Numéros croissants, quel que soit le type
  expect(ids.slice(0, 4)).toEqual(['1', '2', '3', '4']);
  expect(ids.indexOf('127')).toBeLessThan(ids.indexOf('128'));
  expect(ids[ids.length - 1]).toBe('138');
}, 30000); // 138 faces rendues dans jsdom : plus lent que le délai par défaut quand la machine est chargée

test('planche d\'une espèce : ses cartes, à sa teinte', async () => {
  const { container } = render(<SpeciesCardGlossary species="Centauriens" />);
  await screen.findByText(/ET\.31/);
  expect(container.querySelectorAll('.card-face.species-centauriens')).toHaveLength(10);
});

test('espèce inconnue : rien', () => {
  const { container } = render(<SpeciesCardGlossary species="Inconnue" />);
  expect(container.innerHTML).toBe('');
});
