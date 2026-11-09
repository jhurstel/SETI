/** @jest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewGameModal } from '../../src/ui/modals/NewGameModal';
import { SeatChoice, SeatList } from '../../src/ui/modals/SetupFields';

beforeEach(() => localStorage.clear());

/** SeatList avec son état, comme dans les fenêtres de création de partie */
const Seats = ({ allowHuman = false, onSeats }: { allowHuman?: boolean; onSeats: (seats: SeatChoice[]) => void }) => {
  const [seats, setSeats] = useState<SeatChoice[]>(['EXPERT']);
  return <SeatList hostName="Ada" seats={seats} allowHuman={allowHuman} onChange={s => { setSeats(s); onSeats(s); }} />;
};

describe('SeatList (places de la partie)', () => {
  test('ajout jusqu\'à 4 joueurs, choix du niveau, retrait (jamais en dessous de 2 joueurs)', () => {
    const onSeats = jest.fn();
    render(<Seats onSeats={onSeats} />);
    expect(screen.getByText('Ada')).toBeTruthy();
    // Une seule autre place : pas de bouton de retrait
    expect(screen.queryByLabelText('Retirer la place 2')).toBeNull();

    fireEvent.click(screen.getByText('+ Ajouter un robot'));
    fireEvent.click(screen.getByText('+ Ajouter un robot'));
    expect(onSeats).toHaveBeenLastCalledWith(['EXPERT', 'EXPERT', 'EXPERT']);
    // 4 joueurs : plus d'ajout
    expect(screen.queryByText('+ Ajouter un robot')).toBeNull();

    const place3 = screen.getByRole('radiogroup', { name: 'Place 3' });
    fireEvent.click(place3.querySelector('button')!);
    expect(onSeats).toHaveBeenLastCalledWith(['EXPERT', 'EASY', 'EXPERT']);
    expect(place3.querySelector('[aria-checked="true"]')!.textContent).toBe('Débutant');

    fireEvent.click(screen.getByLabelText('Retirer la place 2'));
    expect(onSeats).toHaveBeenLastCalledWith(['EASY', 'EXPERT']);
  });

  test('en ligne : choix « Humain », proposé aussi pour une place ajoutée', () => {
    const onSeats = jest.fn();
    render(<Seats allowHuman onSeats={onSeats} />);
    fireEvent.click(screen.getByText('+ Ajouter une place'));
    expect(onSeats).toHaveBeenLastCalledWith(['EXPERT', 'human']);
    expect(screen.getAllByRole('radio', { name: 'Humain' })).toHaveLength(2);
  });
});

describe('NewGameModal', () => {
  test('fermée : rien n\'est affiché', () => {
    const { container } = render(<NewGameModal visible={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  test('reprend le dernier nom, le garde, et lance la partie avec les robots choisis', () => {
    localStorage.setItem('seti_player_name', 'Ada');
    const onConfirm = jest.fn();
    render(<NewGameModal visible onConfirm={onConfirm} onCancel={() => {}} />);
    expect((screen.getByLabelText('Votre nom') as HTMLInputElement).value).toBe('Ada');
    expect(screen.getByText(/Ada et 1 robot \(Expert\)/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Votre nom'), { target: { value: '  Grace  ' } });
    fireEvent.click(screen.getByText('+ Ajouter un robot'));
    expect(screen.getByText(/Grace et 2 robots \(Expert, Expert\)/)).toBeTruthy();

    fireEvent.click(screen.getByText('Commencer'));
    expect(onConfirm).toHaveBeenCalledWith('Grace', ['EXPERT', 'EXPERT']);
    expect(localStorage.getItem('seti_player_name')).toBe('Grace');
  });

  test('sans nom : « Joueur », et le nom gardé n\'est pas effacé', () => {
    localStorage.setItem('seti_player_name', 'Ada');
    const onConfirm = jest.fn();
    render(<NewGameModal visible onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Votre nom'), { target: { value: '   ' } });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('Joueur', ['EXPERT']);
    expect(localStorage.getItem('seti_player_name')).toBe('Ada');
  });

  test('Échap et un clic hors de la fenêtre annulent ; un clic dedans, non', () => {
    const onCancel = jest.fn();
    render(<NewGameModal visible onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
