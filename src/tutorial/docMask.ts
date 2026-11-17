/**
 * Règles des espèces masquées dans la documentation (public/docs/documentation.md) : chaque section d'espèce est
 * précédée d'une ligne `<!-- espece:Nom -->`. Une espèce pas encore débloquée (rencontrée en partie) voit sa section
 * remplacée par un encart commun, sans son nom ; un seul encart, quel que soit le nombre de sections masquées.
 */

/** Identifiant du titre de l'encart (ancre de repli d'un lien vers une section masquée) */
export const LOCKED_SPECIES_ANCHOR = 'especes-encore-inconnues';

const MARKER = /^<!--\s*espece:\s*([^\s]+)\s*-->\s*$/;
const HEADING = /^(#{1,6})\s/;

/** Encart d'une ou plusieurs espèces masquées, au niveau de titre de leurs sections */
const placeholder = (level: number) => [
  `${'#'.repeat(level)} Espèces encore inconnues`,
  '',
  '🔒 Les règles d\'une espèce se dévoilent quand vous la découvrez en partie. Le tutoriel propose alors un chapitre pour l\'apprendre.',
  '',
];

/** Texte de la documentation sans les règles des espèces non débloquées (marqueurs retirés dans tous les cas) */
export function hideLockedSpecies(markdown: string, unlockedSpecies: string[]): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let placeholderShown = false;
  for (let i = 0; i < lines.length; i++) {
    const marker = MARKER.exec(lines[i]);
    if (!marker) {
      out.push(lines[i]);
      continue;
    }
    if (unlockedSpecies.includes(marker[1])) continue;
    // Section masquée : de son titre jusqu'au titre suivant de même niveau ou supérieur (ou au marqueur suivant)
    const level = HEADING.exec(lines[i + 1] ?? '')?.[1].length ?? 3;
    let end = i + 2;
    while (end < lines.length) {
      const heading = HEADING.exec(lines[end]);
      if (MARKER.test(lines[end]) || (heading && heading[1].length <= level)) break;
      end++;
    }
    if (!placeholderShown) {
      out.push(...placeholder(level));
      placeholderShown = true;
    }
    i = end - 1;
  }
  return out.join('\n');
}
