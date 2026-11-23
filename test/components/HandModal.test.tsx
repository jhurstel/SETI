/** @jest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { HandModal } from '../../src/ui/modals/HandModal';

/** Fenêtre « main en grand » : contenu rendu dans le corps de la page, fermeture par Échap, bouton ou clic dehors */

test('rend ses cartes et se ferme par Échap, par Fermer ou par un clic hors de la fenêtre', () => {
  const onClose = jest.fn();
  const { getByText, getByRole } = render(<HandModal title="Votre main" onClose={onClose}><div className="seti-common-card">carte</div></HandModal>);
  expect(document.body.querySelector('.seti-hand-modal .seti-common-card')!.textContent).toBe('carte');
  fireEvent.click(getByText('carte'));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(getByRole('button', { name: 'Fermer' }));
  fireEvent.click(document.body.querySelector('.seti-modal-overlay')!);
  expect(onClose).toHaveBeenCalledTimes(3);
});
