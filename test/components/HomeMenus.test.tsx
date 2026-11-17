/** @jest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { HistoryProgressBar } from '../../src/ui/components/HistoryProgressBar';
import { TutorialMenu } from '../../src/ui/components/TutorialMenu';
import { TimelineRound } from '../../src/core/historyTimeline';

const players = [{ id: 'p1', name: 'Alice', color: '#4a9eff' }, { id: 'p2', name: 'HAL', color: '#ff6b6b' }];
const rounds: TimelineRound[] = [{ round: 1, entryIndex: 0, complete: false, turns: [{ playerId: 'p1', entryIndex: 1, action: 'lance une sonde' }, { playerId: 'p2', entryIndex: 2 }] }];

describe('barre de progression de la partie', () => {
  const tooltipOnHover = (container: HTMLElement) => {
    const before = document.querySelectorAll('.seti-tooltip').length;
    fireEvent.mouseEnter(container.querySelector('.seti-progress-mark.turn')!);
    return document.querySelectorAll('.seti-tooltip').length - before;
  };

  test('carte « Continuer » de l\'accueil : pas d\'infobulle sur les traits', () => {
    const { container } = render(<HistoryProgressBar rounds={rounds} maxRounds={5} players={players} compact tooltips={false} />);
    expect(container.querySelectorAll('.seti-progress-mark.turn')).toHaveLength(2);
    expect(tooltipOnHover(container)).toBe(0);
  });

  test('par défaut (fin de partie), chaque trait a son infobulle', () => {
    const { container } = render(<HistoryProgressBar rounds={rounds} maxRounds={5} players={players} compact />);
    expect(tooltipOnHover(container)).toBe(1);
  });
});

describe('menu des chapitres : fermeture sans bouton', () => {
  test('pas de bouton Fermer ; Échap ou un clic hors de la fenêtre ferment le menu', () => {
    const onClose = jest.fn();
    const { container } = render(<TutorialMenu chapters={[]} text={null} done={[]} onStart={() => {}} onClose={onClose} />);
    expect(container.textContent).not.toContain('Fermer');
    // Un clic dans la fenêtre ne la ferme pas
    fireEvent.click(container.querySelector('.seti-tutorial-menu')!);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(container.querySelector('.seti-modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
