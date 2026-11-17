/** @jest-environment jsdom */
import { fireEvent, render } from '@testing-library/react';
import { BonusChoiceModal } from '../../src/ui/modals/GameModals';
import { InteractionState, SectorType } from '../../src/core/types';

const menu = (done: boolean[], autoGains?: InteractionState['autoGains']): InteractionState => ({
  type: 'CHOOSING_BONUS_ACTION',
  bonusesSummary: 'Choisissez',
  choices: [
    { id: 'a', label: 'Observation II', state: { type: 'CHOOSING_OBS2_ACTION' }, done: done[0] },
    { id: 'b', label: 'Observation III', state: { type: 'CHOOSING_OBS3_ACTION' }, done: done[1] },
  ],
  ...(autoGains ? { autoGains } : {}),
});

const tiles = (container: HTMLElement) => [...container.ownerDocument.querySelectorAll<HTMLButtonElement>('.seti-choice-option')];

describe('fenêtre Récompenses', () => {
  test('gains automatiques : une tuile grisée et cochée par gain, avant les choix', () => {
    const { container } = render(<BonusChoiceModal interactionState={menu([false, false], { pv: 2, signals: [{ amount: 1, scope: SectorType.MARS }] })} onChoice={() => {}} onFinish={() => {}} />);
    // 2 gains automatiques, 2 choix, « Ne rien faire d'autre »
    const all = tiles(container);
    expect(all).toHaveLength(5);
    expect(all.slice(0, 2).every(t => t.classList.contains('done') && t.disabled)).toBe(true);
    expect(all.slice(2).some(t => t.classList.contains('done'))).toBe(false);
  });

  test('« Ne rien faire d\'autre » renonce aux récompenses restantes ; absent une fois tout fait', () => {
    const onFinish = jest.fn();
    const onChoice = jest.fn();
    const { container, rerender } = render(<BonusChoiceModal interactionState={menu([true, false])} onChoice={onChoice} onFinish={onFinish} />);
    const all = tiles(container);
    expect(all).toHaveLength(3);
    fireEvent.click(all[1]);
    expect(onChoice).toHaveBeenCalledWith(1);
    fireEvent.click(all[2]);
    expect(onFinish).toHaveBeenCalledTimes(1);

    rerender(<BonusChoiceModal interactionState={menu([true, true])} onChoice={onChoice} onFinish={onFinish} />);
    expect(tiles(container)).toHaveLength(2);
    expect(container.ownerDocument.body.textContent).toContain('Terminer');
  });
});
