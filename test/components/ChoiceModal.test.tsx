/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { ChoiceFooterButton, ChoiceModal, ChoiceOption } from '../../src/ui/modals/ChoiceModal';

describe('ChoiceModal (fenêtre de choix commune)', () => {
  test('« Voir le plateau » masque la fenêtre, « Revenir au choix » la réaffiche', () => {
    render(<ChoiceModal title="Choisissez" subtitle="Une seule option"><span>Option A</span></ChoiceModal>);
    expect(screen.getByText('Choisissez')).toBeTruthy();
    expect(screen.getByText('Une seule option')).toBeTruthy();

    fireEvent.click(screen.getByText('Voir le plateau'));
    expect(screen.queryByText('Option A')).toBeNull();

    fireEvent.click(screen.getByText('Revenir au choix'));
    expect(screen.getByText('Option A')).toBeTruthy();
  });

  test('le pied de fenêtre n\'apparaît que s\'il est fourni', () => {
    const onClick = jest.fn();
    const { container, rerender } = render(<ChoiceModal title="T"><span /></ChoiceModal>);
    expect(container.ownerDocument.querySelector('.seti-choice-modal-footer')).toBeNull();

    rerender(<ChoiceModal title="T" footer={<ChoiceFooterButton onClick={onClick}>Terminer</ChoiceFooterButton>}><span /></ChoiceModal>);
    fireEvent.click(screen.getByText('Terminer'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ChoiceOption', () => {
  test('sans symbole, le libellé s\'affiche dans la tuile ; un clic choisit l\'option', () => {
    const onClick = jest.fn();
    render(<ChoiceOption label="2 crédits" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: '2 crédits' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('avec un symbole, le texte n\'est que dans l\'infobulle, affichée au survol', () => {
    render(<ChoiceOption icon={<i data-testid="icone" />} label="1 Média" detail="Gagné tout de suite" onClick={() => {}} />);
    expect(screen.queryByText('1 Média')).toBeNull();

    fireEvent.mouseEnter(screen.getByRole('button').parentElement!);
    expect(screen.getByText('1 Média')).toBeTruthy();
    expect(screen.getByText('Gagné tout de suite')).toBeTruthy();

    fireEvent.mouseLeave(screen.getByRole('button').parentElement!);
    expect(screen.queryByText('1 Média')).toBeNull();
  });

  test('indisponible : bouton désactivé, l\'infobulle en donne la raison', () => {
    const onClick = jest.fn();
    render(<ChoiceOption icon={<i />} label="Message 1" onClick={onClick} disabled disabledReason="Déjà choisi par R2-D2" />);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.getByText('Déjà choisi par R2-D2')).toBeTruthy();
  });

  test('déjà fait : coché et désactivé, sans raison affichée', () => {
    render(<ChoiceOption label="Bonus" onClick={() => {}} done disabledReason="ne doit pas apparaître" />);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('✓');
    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.queryByText('ne doit pas apparaître')).toBeNull();
  });
});
