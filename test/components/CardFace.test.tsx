/** @jest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { DataLoader } from '../../src/core/DataLoader';
import { Card, CardType } from '../../src/core/types';
import { CardFace } from '../../src/ui/components/CardFace';
import * as fs from 'fs';
import * as path from 'path';

/** Face d'une carte : coins, coût, pied de carte, panneaux, élément mis en avant */

let allCards: Card[];
beforeAll(async () => {
  // jsdom n'a pas fetch : lecture des CSV sur disque
  DataLoader.setReader(async p => fs.readFileSync(path.resolve(__dirname, '../../public', p), 'utf8'));
  allCards = [];
  for (const name of ['main', 'centauriens', 'exertiens']) allCards.push(...await DataLoader.loadCards(`cards/${name}.csv`));
});
const card = (id: string) => allCards.find(c => c.id === id)!;
const q = (root: HTMLElement, selector: string) => root.querySelector(selector) as HTMLElement | null;

describe('CardFace', () => {
  test('carte 1 : action gratuite, triangle jaune, coût doré, liseré et revenu verts (énergie), numéro dans l\'illustration', () => {
    const { container } = render(<CardFace card={card('1')} />);
    const face = q(container, '.card-face')!;
    expect(face.classList.contains('sector-yellow')).toBe(true);
    expect(q(face, '.card-face-free-action')).not.toBeNull();
    expect(q(face, '.card-face-sector')).not.toBeNull();
    expect(q(face, '.card-face-cost.credit')).not.toBeNull();
    expect(face.classList.contains('revenue-energy')).toBe(true);
    expect(q(face, '.card-face-footer .card-face-revenue')).not.toBeNull();
    expect(q(face, '.card-face-art .card-face-number')!.textContent).toBe('1');
    expect(face.textContent).toContain('Mission Pioneer 11');
  });

  test('carte Centaurien payée en énergie : badge vert, teinte de l\'espèce, panneau de réception', () => {
    const centaurien = allCards.find(c => c.type === CardType.CENTAURIEN && c.costType === 'Energie')!;
    const { container } = render(<CardFace card={centaurien} />);
    expect(q(container, '.card-face.species-centauriens')).not.toBeNull();
    expect(q(container, '.card-face-cost.energy')).not.toBeNull();
    expect(q(container, '.card-face-panel.reception')).not.toBeNull();
  });

  test('carte Exertien : danger, ni coins ni pied de carte', () => {
    const { container } = render(<CardFace card={card('ET.41')} />);
    expect(q(container, '.card-face-danger')!.textContent).toBe('6');
    expect(q(container, '.card-face-free-action')).toBeNull();
    expect(q(container, '.card-face-sector')).toBeNull();
    expect(q(container, '.card-face-footer')).toBeNull();
    expect(q(container, '.card-face-cost')).toBeNull();
    // En taille compacte, la condition de fin de partie reste visible : c'est toute la carte
    const compact = render(<CardFace card={card('ET.41')} compact />);
    // Les PV débutent la phrase, puis la condition en symboles : 3 technologies Exploration
    const condition = compact.container.querySelector('.card-face-panel.endGame .card-face-condition-symbols')!;
    expect(condition.firstElementChild!.classList.contains('bonus-icons')).toBe(true);
    expect([...condition.querySelectorAll('svg')].filter(svg => !svg.closest('.bonus-icons'))).toHaveLength(3);
  });

  test('élément mis en avant : pied (revenu) ou triangle (secteur)', () => {
    const revenue = render(<CardFace card={card('9')} compact highlight="revenue" />);
    expect(q(revenue.container, '.card-face-revenue.highlighted')).not.toBeNull();
    const sector = render(<CardFace card={card('9')} compact highlight="sector" />);
    expect(q(sector.container, '.card-face-sector.highlighted')).not.toBeNull();
  });

  test('miniature : la même carte que l\'infobulle, mise à l\'échelle de son emplacement', () => {
    const large = render(<CardFace card={card('9')} />);
    const compact = render(<CardFace card={card('9')} compact />);
    expect(q(compact.container, '.card-face-mini .card-face-mini-inner .card-face.large')).not.toBeNull();
    expect(q(compact.container, '.card-face.large')!.textContent).toBe(q(large.container, '.card-face.large')!.textContent);
  });

  test('carte 2 : panneau de mission déclenchable, deux cercles étiquetés', () => {
    const { container } = render(<CardFace card={card('2')} />);
    const panel = q(container, '.card-face-panel.mission.triggered')!;
    expect(panel.textContent).toContain('Lorsque vous visitez :');
    const labels = Array.from(panel.querySelectorAll('.card-face-circle-column > .card-face-tab')).map(e => e.textContent);
    expect(labels).toEqual(['Mercure', 'Vénus']);
  });

  test('mission conditionnelle : condition à gauche, récompense dans un carré en creux qui clignote quand elle est réalisable', () => {
    const onClick = jest.fn();
    const { container } = render(<CardFace card={card('134')} circleStates={[{ completed: false, fulfillable: true, flash: true, onClick }]} />);
    const row = q(container, '.card-face-panel.conditional .card-face-condition-row')!;
    expect(row.querySelector('.card-face-condition')).not.toBeNull();
    expect(row.querySelector('.card-face-circle')).toBeNull();
    const slot = row.querySelector('.card-face-slot')!;
    expect(slot.classList.contains('seti-flash-green')).toBe(true);
    fireEvent.click(slot);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('mission conditionnelle et carte Fin de partie', () => {
    const conditional = allCards.find(c => c.type === CardType.CONDITIONAL_MISSION)!;
    expect(q(render(<CardFace card={conditional} />).container, '.card-face-panel.mission.conditional')).not.toBeNull();
    const endGame = render(<CardFace card={card('38')} />);
    // « Pour chaque » + symbole du secteur rouge couvert, et ses PV
    const endPanel = q(endGame.container, '.card-face-panel.endGame')!;
    expect(endPanel.querySelector('.card-face-condition-symbols')!.textContent).toContain('pour chaque');
    expect(endPanel.querySelectorAll('.card-face-condition-symbols svg').length).toBeGreaterThan(0);
  });

  test('mission jouée : cercle recouvert, cercle réalisable cliquable', () => {
    const onClick = jest.fn();
    const { container } = render(<CardFace card={card('2')} circleStates={[{ completed: true, fulfillable: false, markerColor: '#f00' }, { completed: false, fulfillable: true, onClick }]} />);
    const circles = container.querySelectorAll('.card-face-circle');
    expect(circles[0].classList.contains('completed')).toBe(true);
    expect(circles[0].querySelector('.card-face-marker')).not.toBeNull();
    expect(circles[1].classList.contains('fulfillable')).toBe(true);
    fireEvent.click(circles[1]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
