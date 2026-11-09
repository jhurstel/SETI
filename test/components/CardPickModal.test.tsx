/** @jest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CardPickModal } from '../../src/ui/modals/CardPickModal';
import { makeCard } from '../helpers/gameFixture';

const cards = [makeCard('a', { name: 'Télescope' }), makeCard('b', { name: 'Sonde' }), makeCard('c', { name: 'Radar' })];

/** Défausse de 2 cartes, la sélection étant tenue par l'appelant comme dans BoardUI */
const Discard = ({ onConfirm, onCancel }: { onConfirm: (ids: string[]) => void; onCancel?: () => void }) => {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <CardPickModal
      title="Défaussez 2 cartes"
      cards={cards}
      selectedIds={selected}
      onToggle={id => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))}
      highlightedAttribute="scan"
      status={`Sélectionnées : ${selected.length} / 2`}
      confirmLabel="Défausser"
      canConfirm={selected.length === 2}
      onConfirm={() => onConfirm(selected)}
      onCancel={onCancel}
    />
  );
};

const tile = (name: string) => screen.getAllByText(name)[0].closest('.seti-choice-card-tile') as HTMLElement;

describe('CardPickModal (choix de plusieurs cartes de la main)', () => {
  test('sélection et désélection des cartes, confirmation possible seulement au bon nombre', () => {
    const onConfirm = jest.fn();
    render(<Discard onConfirm={onConfirm} />);
    const confirm = screen.getByText('Défausser') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    // Pas d'annulation pour une défausse obligatoire
    expect(screen.queryByText('Annuler')).toBeNull();

    fireEvent.click(tile('Télescope'));
    fireEvent.click(tile('Radar'));
    fireEvent.click(tile('Télescope'));
    expect(screen.getByText('Sélectionnées : 1 / 2')).toBeTruthy();
    expect(tile('Radar').classList.contains('selected')).toBe(true);
    expect(tile('Télescope').classList.contains('selected')).toBe(false);

    fireEvent.click(tile('Sonde'));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(['c', 'b']);
  });

  test('choix facultatif : bouton Annuler', () => {
    const onCancel = jest.fn();
    render(<Discard onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Annuler'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('le survol d\'une carte affiche son infobulle, un clic la ferme', () => {
    render(<Discard onConfirm={() => {}} />);
    const before = document.querySelectorAll('.seti-tooltip').length;
    fireEvent.mouseEnter(tile('Sonde'));
    expect(document.querySelectorAll('.seti-tooltip').length).toBe(before + 1);
    // L'infobulle reprend le nom de la carte
    expect(screen.getAllByText('Sonde').length).toBeGreaterThan(1);

    fireEvent.click(tile('Sonde'));
    expect(document.querySelectorAll('.seti-tooltip').length).toBe(before);
  });
});
