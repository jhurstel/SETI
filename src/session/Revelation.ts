import { Card, Game } from '../core/types';
import { requirePlayer } from '../core/players';
import { viewFor, HIDDEN_SPECIES } from './PlayerView';

/** Raison affichée quand une annulation est bloquée par une révélation */
export const REVELATION_REASON = 'Action non annulable : une information cachée a été révélée.';

/** Ce qu'un joueur connaît de la partie : cartes visibles, spécimens visibles, espèces nommées */
export type Knowledge = Set<string>;

/** Une carte, où qu'elle soit (main, rangée, piles, interactions…) : on la reconnaît à ses effets */
function isCard(value: object): value is Card {
  return typeof (value as Card).id === 'string' && Array.isArray((value as Card).immediateEffects);
}

/** Jeton de spécimen montré (un jeton caché n'a pas de récompense) */
function shownSpecimen(token: { bonus?: object } | undefined): string | undefined {
  return token?.bonus && Object.keys(token.bonus).length > 0 ? JSON.stringify(token.bonus) : undefined;
}

/**
 * Ce que la vue d'un joueur (`viewFor`) lui laisse connaître. Les cartes sont reconnues partout dans la vue
 * (interactions comprises) ; une carte cachée a un identifiant `hidden-…`.
 */
export function knowledgeOf(game: Game, playerId: string): Knowledge {
  const view = viewFor(game, playerId);
  const known: Knowledge = new Set();

  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (isCard(value) && !value.id.startsWith('hidden-')) known.add(`card:${value.id}`);
    Object.values(value).forEach(walk);
  };
  walk({ ...view, gameLog: undefined });

  view.board.planets.forEach(planet => planet.mascamiteTokens?.forEach((token, index) => {
    const shown = shownSpecimen(token);
    if (shown) known.add(`specimen:${planet.id}:${index}:${shown}`);
  }));
  [...view.board.solarSystem.probes, ...view.players.flatMap(p => p.probes)].forEach(probe => {
    const shown = shownSpecimen(probe.specimen);
    if (shown) known.add(`specimen:${probe.id}:${shown}`);
  });
  view.species.forEach(species => known.add(`species:${species.name}`));
  view.board.alienBoards.forEach(board => { if (board.speciesId !== HIDDEN_SPECIES) known.add(`species:${board.speciesId}`); });
  return known;
}

/** Cartes qu'un joueur tient de sa propre main (main, réserve, cartes jouées) : les montrer n'est pas une révélation */
function ownCards(game: Game, playerId: string): Set<string> {
  const player = requirePlayer(game, playerId);
  return new Set([...player.cards, ...player.reservedCards, ...player.playedCards].map(card => `card:${card.id}`));
}

/**
 * La commande (ou l'étape de robot) qui a fait passer la partie de `before` à `after` a-t-elle révélé une
 * information cachée à l'un des `viewerIds` ? Un élément nouvellement connu compte, sauf une carte que l'auteur
 * `actorId` montre de sa propre main ; un tirage au hasard compte aussi (`ignoreRng` : pas pour un robot, qui tire
 * pour décider).
 */
export function revealedTo(
  before: Game,
  after: Game,
  viewerIds: string[],
  options: { actorId?: string; ignoreRng?: boolean } = {},
): boolean {
  if (!options.ignoreRng && before.rngState !== undefined && after.rngState !== undefined && before.rngState !== after.rngState) return true;
  const shownByActor = options.actorId ? ownCards(before, options.actorId) : new Set<string>();
  return viewerIds.some(viewerId => {
    const known = knowledgeOf(before, viewerId);
    for (const item of knowledgeOf(after, viewerId)) {
      if (!known.has(item) && !shownByActor.has(item)) return true;
    }
    return false;
  });
}
