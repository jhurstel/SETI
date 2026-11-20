/** @jest-environment jsdom */
import { act, fireEvent, render } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { DataLoader } from '../../src/core/DataLoader';
import { Game, InteractionState } from '../../src/core/types';
import { TechnologyBoardUI } from '../../src/ui/TechnologyBoardUI';
import { PlanetBoardUI } from '../../src/ui/PlanetBoardUI';
import { createTestGame } from '../helpers/gameFixture';

/** Panneaux repliables : flèche gardé ouvert / replié, repli immédiat au clic même sous la souris */

let game: Game;
beforeAll(async () => {
  // jsdom n'a ni fetch ni Response : les CSV sont lus sur le disque
  (global as { fetch?: unknown }).fetch ??= () => Promise.reject(new Error('fetch'));
  DataLoader.setReader(async p => fs.readFileSync(path.resolve(__dirname, '../../public', p), 'utf8'));
  game = await createTestGame();
});

const IDLE: InteractionState = { type: 'IDLE' };
const techPanel = (interactionState: InteractionState = IDLE) =>
  <TechnologyBoardUI game={game} interactionState={interactionState} onTechClick={jest.fn()} setActiveTooltip={jest.fn()} />;

const parts = (container: HTMLElement) => {
  const panel = container.querySelector('.seti-foldable-container') as HTMLElement;
  return { panel, header: panel.querySelector('.seti-foldable-header') as HTMLElement };
};

describe('Technologies', () => {
  test('clic : gardé ouvert ; second clic sous la souris : replié aussitôt, aperçu rendu à la sortie', () => {
    const { container } = render(techPanel());
    const { panel, header } = parts(container);
    expect(panel.classList.contains('collapsed')).toBe(true);

    fireEvent.mouseEnter(panel);
    fireEvent.click(header);
    expect(panel.classList.contains('open')).toBe(true);
    expect(panel.classList.contains('no-hover')).toBe(false);

    // Replié alors que la souris reste sur le panneau : plus d'aperçu au survol
    fireEvent.click(header);
    expect(panel.classList.contains('open')).toBe(false);
    expect(panel.classList.contains('no-hover')).toBe(true);

    // La souris sort puis revient : l'aperçu au survol est rendu
    fireEvent.mouseLeave(panel);
    expect(panel.classList.contains('no-hover')).toBe(false);
    expect(panel.classList.contains('collapsed')).toBe(true);
  });

  test('clic ailleurs : le panneau gardé ouvert se replie', () => {
    const { container } = render(techPanel());
    const { panel, header } = parts(container);
    fireEvent.click(header);
    expect(panel.classList.contains('open')).toBe(true);
    act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    expect(panel.classList.contains('open')).toBe(false);
  });

  test('choix d\'une technologie : ouvert, le clic ne le replie pas, refermé à la fin du choix', () => {
    const { container, rerender } = render(techPanel({ type: 'ACQUIRING_TECH' }));
    const { panel, header } = parts(container);
    expect(panel.classList.contains('open')).toBe(true);
    fireEvent.click(header);
    expect(panel.classList.contains('open')).toBe(true);
    expect(panel.classList.contains('no-hover')).toBe(false);
    rerender(techPanel());
    expect(panel.classList.contains('open')).toBe(false);
  });
});

describe('Planètes (aperçu au survol géré par le composant)', () => {
  const planetPanel = () => <PlanetBoardUI game={game} interactionState={IDLE} onOrbit={jest.fn()} onLand={jest.fn()} setActiveTooltip={jest.fn()} />;

  test('aperçu au survol sans être gardé, puis gardé ouvert, puis replié aussitôt sous la souris', () => {
    const { container } = render(planetPanel());
    const { panel, header } = parts(container);

    fireEvent.mouseEnter(panel);
    expect(panel.classList.contains('open')).toBe(true);
    expect(panel.classList.contains('kept')).toBe(false);

    fireEvent.click(header);
    expect(panel.classList.contains('kept')).toBe(true);

    fireEvent.click(header);
    expect(panel.classList.contains('open')).toBe(false);
    expect(panel.classList.contains('no-hover')).toBe(true);
    // Toujours sous la souris : survoler un élément du panneau ne le rouvre pas
    fireEvent.mouseEnter(panel);
    expect(panel.classList.contains('open')).toBe(false);
  });

  test('gardé ouvert : il reste ouvert quand la souris sort', () => {
    jest.useFakeTimers();
    try {
      const { container } = render(planetPanel());
      const { panel, header } = parts(container);
      fireEvent.mouseEnter(panel);
      fireEvent.click(header);
      fireEvent.mouseLeave(panel);
      act(() => { jest.advanceTimersByTime(500); });
      expect(panel.classList.contains('open')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
