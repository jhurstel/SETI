/**
 * Générateur pseudo-aléatoire à graine (mulberry32), utilisé par tout le moteur et les robots
 * à la place de `Math.random()`.
 *
 * Une même graine redonne la même mise en place et, avec les mêmes choix, la même partie :
 * tests déterministes, parties entre robots comparables, bug reproductible depuis une sauvegarde
 * (qui enregistre l'état du générateur, voir GamePersistence).
 */
let state = newSeed();

/** Graine tirée au hasard (seul usage de Math.random). */
export function newSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

/** Repart d'une graine donnée. */
export function seedRandom(seed: number): void {
  state = seed >>> 0;
}

/** État courant du générateur (à enregistrer pour reprendre la même suite de tirages). */
export function getRandomState(): number {
  return state;
}

/** Reprend la suite de tirages à un état enregistré par getRandomState. */
export function setRandomState(value: number): void {
  state = value >>> 0;
}

/** Nombre dans [0, 1), comme Math.random. */
export function random(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
}
