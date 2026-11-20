/** @jest-environment jsdom */
import { clearErrors, ERROR_LOG_SIZE, installErrorListeners, listErrors, recordError, subscribeErrors } from '../src/ui/errorLog';

describe('journal des erreurs de la page', () => {
  beforeEach(() => clearErrors());

  test('garde les 20 dernières erreurs, de la plus ancienne à la plus récente', () => {
    for (let i = 0; i < ERROR_LOG_SIZE + 5; i++) recordError(new Error(`erreur ${i}`), 'error');
    const errors = listErrors();
    expect(errors).toHaveLength(ERROR_LOG_SIZE);
    expect(errors[0].message).toBe('erreur 5');
    expect(errors[ERROR_LOG_SIZE - 1].message).toBe(`erreur ${ERROR_LOG_SIZE + 4}`);
  });

  test('une erreur identique répétée augmente son compteur ; les abonnés savent qu\'elle se répète', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeErrors((_entry, repeated) => seen.push(repeated));
    recordError(new Error('boum'), 'error');
    recordError(new Error('boum'), 'error');
    recordError(new Error('boum'), 'promise');
    expect(listErrors().map(e => [e.message, e.source, e.count])).toEqual([['boum', 'error', 2], ['boum', 'promise', 1]]);
    expect(seen).toEqual([false, true, false]);
    unsubscribe();
    recordError('autre', 'error');
    expect(seen).toHaveLength(3);
  });

  test('message lisible pour une Error, un texte ou une valeur quelconque ; pile d\'affichage jointe', () => {
    recordError({ code: 42 }, 'promise');
    recordError('texte', 'error');
    const withStack = recordError(new Error('rendu'), 'render', '\n    at Plateau');
    expect(listErrors().map(e => e.message)).toEqual(['{"code":42}', 'texte', 'rendu']);
    expect(withStack.stack).toContain('at Plateau');
  });

  test('écouteurs de la page : erreur non traitée et promesse rejetée sont retenues, puis retirés', () => {
    // Cible à part : jsdom signalerait comme non traitée une erreur envoyée à window sans écouteur
    const target = new EventTarget();
    const remove = installErrorListeners(target as unknown as Window);
    target.dispatchEvent(new ErrorEvent('error', { error: new Error('clic'), message: 'clic' }));
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = new Error('promesse');
    target.dispatchEvent(rejection);
    expect(listErrors().map(e => [e.message, e.source])).toEqual([['clic', 'error'], ['promesse', 'promise']]);
    remove();
    target.dispatchEvent(new ErrorEvent('error', { error: new Error('après') }));
    expect(listErrors()).toHaveLength(2);
  });
});
