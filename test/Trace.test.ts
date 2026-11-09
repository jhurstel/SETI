import { setTraceLevel, trace, traceLevel } from '../src/core/trace';

describe('traces du moteur (core/trace)', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  const initial = traceLevel();

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    setTraceLevel(initial);
    jest.restoreAllMocks();
  });

  const emit = () => {
    trace.info('[AI] décision');
    trace.warn('[AI] cas imprévu');
    trace.error('[Session] erreur');
  };

  test('par défaut (production, serveur, tests) : avertissements et erreurs seulement', () => {
    expect(initial).toBe('warn');
    emit();
    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[AI] cas imprévu');
    expect(error).toHaveBeenCalledWith('[Session] erreur');
  });

  test('développement (info) : tout est affiché', () => {
    setTraceLevel('info');
    emit();
    expect(log).toHaveBeenCalledWith('[AI] décision');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  test('erreurs seules, puis silence complet', () => {
    setTraceLevel('error');
    emit();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    setTraceLevel('silent');
    emit();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
