import { AlienBoardType, Game, Planet } from '../../core/types';

/** Données d'une planète, Oumuamua compris (sa planète est portée par l'espèce) */
export function findPlanet(game: Game, planetId: string): Planet | undefined {
  let planet = game.board.planets.find(p => p.id === planetId);
  if (!planet && planetId === 'oumuamua') {
    const species = game.species.find(s => s.name === AlienBoardType.OUMUAMUA);
    if (species) planet = species.planet;
  }
  return planet;
}
