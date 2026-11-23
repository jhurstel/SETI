import { useCallback, useEffect, useState } from 'react';

/**
 * Plein écran de la page (API Fullscreen) : `supported` est faux quand le navigateur ne le permet pas (iPhone :
 * ajouter le jeu à l'écran d'accueil à la place).
 */
export function useFullscreen() {
  const supported = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const [active, setActive] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);

  useEffect(() => {
    if (!supported) return;
    const update = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [supported]);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }, []);

  return { supported, active, toggle };
}
