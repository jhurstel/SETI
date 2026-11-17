/** Déblocage des chapitres d'espèce : un chapitre d'espèce n'est jouable que si le joueur a rencontré l'espèce en partie */
import type { Game } from '../core/types';
import type { TutorialChapter } from './types';

/** Le chapitre est jouable : chapitre commun, ou espèce débloquée */
export function isChapterUnlocked(chapter: TutorialChapter, unlockedSpecies: string[]): boolean {
  return !chapter.species || unlockedSpecies.includes(chapter.species);
}

/** Espèces découvertes dans une partie (plateaux Alien révélés) : elles se débloquent quand la partie n'est pas un chapitre */
export function discoveredSpecies(game: Game): string[] {
  return game.board.alienBoards.filter(board => board.isDiscovered).map(board => board.speciesId);
}

/** Espèce masquée à l'écran pendant un chapitre (« Traces de vie et espèces ») : son nom, ses cartes */
export interface SpeciesMask {
  /** Noms des espèces masquées */
  species: string[];
  /** Cartes de ces espèces (pioche et rangée de l'espèce au départ du chapitre) : de dos */
  cardIds: string[];
  cardNames: string[];
}

export const NO_SPECIES_MASK: SpeciesMask = { species: [], cardIds: [], cardNames: [] };

/**
 * Masque d'un chapitre : l'espèce du premier plateau, si le chapitre masque son espèce et que le joueur ne l'a pas
 * débloquée ; sinon rien de masqué
 */
export function speciesMask(chapter: TutorialChapter, start: Game, unlockedSpecies: string[]): SpeciesMask {
  const name = start.board.alienBoards[0].speciesId;
  if (!chapter.masksSpecies || unlockedSpecies.includes(name)) return NO_SPECIES_MASK;
  const species = start.species.find(s => s.name === name);
  const cards = species ? [...species.cards, ...species.cardRow] : [];
  return { species: [name], cardIds: cards.map(c => c.id), cardNames: cards.map(c => c.name) };
}

/** Texte affiché (historique) sous un masque : cartes de l'espèce anonymes, message qui nomme l'espèce remplacé */
export function maskText(text: string, mask: SpeciesMask): string {
  if (mask.species.length === 0) return text;
  const anonymous = mask.cardNames.reduce((current, name) => current.split(`"${name}"`).join('une carte Alien'), text);
  // Radical du nom (« anomalie » pour Anomalies) : singulier et pluriel
  const stems = mask.species.map(name => name.toLowerCase().replace(/s$/, ''));
  return stems.some(stem => anonymous.toLowerCase().includes(stem)) ? 'Une espèce Alien inconnue se manifeste.' : anonymous;
}
