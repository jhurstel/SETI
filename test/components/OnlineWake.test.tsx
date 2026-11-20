/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OnlineModal } from '../../src/ui/modals/OnlineModal';
import { OnlineSession } from '../../src/ui/hooks/useOnlineSession';
import { RemoteState } from '../../src/session/RemoteClient';

/** Session en ligne minimale : seul l'état est lu par la fenêtre tant qu'aucune salle n'est ouverte */
const session = (state: RemoteState) => ({ state, leave: jest.fn() }) as unknown as OnlineSession;

describe('Partie en ligne : attente du réveil du serveur', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  test('onglet Rejoindre : « Réveil du serveur… » avec les secondes, puis la liste dès que le serveur répond', async () => {
    let awake = false;
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => (awake
      ? Promise.resolve({ json: () => Promise.resolve([]) })
      : Promise.reject(new Error('endormi'))));
    render(<OnlineModal visible online={session({ status: 'disconnected', entries: [] })} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rejoindre' }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Réveil du serveur… \(0 s\)/)).toBeTruthy();

    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); });
    expect(screen.getByText(/Réveil du serveur… \(5 s\)/)).toBeTruthy();

    awake = true;
    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.queryByText(/Réveil du serveur/)).toBeNull();
    expect(screen.getByText(/Aucune salle ouverte/)).toBeTruthy();
  });

  test('après deux minutes sans réponse, le serveur est annoncé injoignable', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('hors service')));
    render(<OnlineModal visible online={session({ status: 'disconnected', entries: [] })} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rejoindre' }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { jest.advanceTimersByTime(121_000); await Promise.resolve(); });
    expect(screen.getByText(/Serveur injoignable pour le moment/)).toBeTruthy();
  });

  test('connexion en cours : compteur des secondes écoulées', () => {
    render(<OnlineModal visible online={session({ status: 'connecting', entries: [] })} onBack={() => {}} />);
    expect(screen.getByText('0 s')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByText('3 s')).toBeTruthy();
  });
});
