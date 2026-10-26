import { useState } from 'react';

const STORAGE_KEY = 'seti_show_debug';

/** Lit le réglage mémorisé ; le stockage peut être indisponible (navigation privée, données bloquées). */
function readSetting(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Affichage des outils de débogage (réglage du menu Paramètres), masqués par défaut
 * et mémorisés dans le navigateur.
 */
export function useDebugSetting(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(readSetting);
  const update = (value: boolean) => {
    setShow(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Stockage indisponible : le réglage vaut pour la session en cours
    }
  };
  return [show, update];
}
