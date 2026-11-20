import { serverWaitText, wakeServer, WAKE_TIMEOUT_MS } from '../src/ui/serverWake';

describe('réveil du serveur du jeu en ligne', () => {
  test('un seul appel au contrôle de santé, en no-cors, à l\'adresse HTTP du serveur', () => {
    const fetchFn = jest.fn(() => Promise.resolve(new Response())) as unknown as jest.Mock & typeof fetch;
    wakeServer('wss://seti.example.com', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('https://seti.example.com/health', expect.objectContaining({ mode: 'no-cors' }));
  });

  test('aucune requête sans adresse de serveur (jeu en ligne non configuré)', () => {
    const fetchFn = jest.fn() as unknown as jest.Mock & typeof fetch;
    wakeServer('', fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('serveur injoignable : aucune erreur ne remonte', async () => {
    const rejected = jest.fn(() => Promise.reject(new Error('réseau'))) as unknown as typeof fetch;
    expect(() => wakeServer('wss://seti.example.com', rejected)).not.toThrow();
    const throwing = jest.fn(() => { throw new Error('fetch absent'); }) as unknown as typeof fetch;
    expect(() => wakeServer('wss://seti.example.com', throwing)).not.toThrow();
    await Promise.resolve();
  });

  test('texte d\'attente : secondes écoulées, puis serveur injoignable après deux minutes', () => {
    expect(serverWaitText(1000, 1000)).toEqual({ text: 'Réveil du serveur… (0 s)', givenUp: false });
    expect(serverWaitText(1000, 43_900)).toEqual({ text: 'Réveil du serveur… (42 s)', givenUp: false });
    expect(serverWaitText(0, WAKE_TIMEOUT_MS).givenUp).toBe(true);
    expect(serverWaitText(0, WAKE_TIMEOUT_MS).text).toContain('injoignable');
  });
});
