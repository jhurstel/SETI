/** @jest-environment jsdom */
import { act, fireEvent, render } from '@testing-library/react';
import { Announcement, AnnouncementContent } from '../../src/ui/components/Announcement';

/** Bande d'annonce : découverte d'une espèce avec, la première fois, le bouton de son chapitre du tutoriel */
const discovery = (action?: AnnouncementContent['action']): AnnouncementContent => ({
  key: 'discovery-1', kicker: 'Nouvelle espèce', title: 'Anomalies', subtitle: 'découverte par Alice', color: '#3ddc84', size: 'large', duration: 3500, action,
});

describe('Announcement', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('sans bouton : la bande se ferme seule, ou par Échap', () => {
    const onDone = jest.fn();
    const { container } = render(<Announcement announcement={discovery()} onDone={onDone} />);
    expect(container.querySelector('.seti-announcement-action')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(3500); });
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  test('avec le bouton du chapitre : il ouvre le chapitre et ferme la bande ; le survol la garde affichée', () => {
    const onDone = jest.fn();
    const open = jest.fn();
    const { container, getByText } = render(<Announcement announcement={discovery({ label: 'Voir le chapitre du tutoriel', onClick: open })} onDone={onDone} />);
    const band = container.querySelector('.seti-announcement')!;

    fireEvent.mouseEnter(band);
    act(() => { jest.advanceTimersByTime(10000); });
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(getByText('Voir le chapitre du tutoriel'));
    expect(open).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
