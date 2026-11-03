import { useState } from 'react';

const STORAGE_KEY = 'seti_show_debug';

declare const __DEBUG_TOOLS__: boolean | undefined;

/** Les outils de débogage n'existent qu'en développement (injecté par Vite), jamais dans la version publiée */
export const DEBUG_AVAILABLE: boolean = typeof __DEBUG_TOOLS__ === 'boolean' && __DEBUG_TOOLS__;

/** Lit le réglage mémorisé ; le stockage peut être indisponible (navigation privée, données bloquées). */
function readSetting(): boolean {
  if (!DEBUG_AVAILABLE) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Affichage des outils de débogage (réglage du menu Paramètres), masqués par défaut
 * et mémorisés dans le navigateur ; toujours masqués hors développement.
 */
export function useDebugSetting(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(readSetting);
  const update = (value: boolean) => {
    if (!DEBUG_AVAILABLE) return;
    setShow(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Stockage indisponible : le réglage vaut pour la session en cours
    }
  };
  return [show, update];
}
