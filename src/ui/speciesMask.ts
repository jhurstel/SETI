import { createContext, useContext } from 'react';
import { NO_SPECIES_MASK, SpeciesMask } from '../tutorial/unlock';

/**
 * Espèce masquée à l'écran (chapitre « Traces de vie et espèces », espèce pas encore rencontrée en partie) : fournie par
 * BoardUI, lue par les plateaux (Alien, main, système solaire, historique) et les annonces. Un contexte plutôt que des
 * props : les plateaux mémoïsés se redessinent quand il change, sans changer leurs props.
 */
export const SpeciesMaskContext = createContext<SpeciesMask>(NO_SPECIES_MASK);

export const useSpeciesMask = (): SpeciesMask => useContext(SpeciesMaskContext);
