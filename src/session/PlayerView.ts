import { AlienBoardType, Card, CardType, CostType, FreeActionType, Game, GamePhase, InteractionState, RevenueType, SectorType } from '../core/types';
import { cloneGame } from '../core/cloneGame';
import { InteractionQueue } from './InteractionQueue';

/** Identifiant affiché à la place d'une espèce pas encore découverte (son plateau est face cachée) */
export const HIDDEN_SPECIES = 'Inconnue' as AlienBoardType;

/** Carte face cachée : seule sa présence est connue (et son type, pour une carte Exertien jouée) */
function hiddenCard(index: number, type: CardType = CardType.ACTION): Card {
  return {
    id: `hidden-${index}`,
    name: 'Carte cachée',
    description: '',
    type,
    cost: 0,
    costType: CostType.UNDEFINED,
    freeAction: FreeActionType.MEDIA,
    scanSector: SectorType.BLUE,
    revenue: RevenueType.CREDIT,
    ownerId: '',
    immediateEffects: [],
    passiveEffects: [],
    permanentEffects: [],
    isRevealed: false,
  };
}

function hideCards(cards: Card[] = [], keep: (card: Card) => boolean = () => false): Card[] {
  return cards.map((card, index) => (keep(card) ? card : hiddenCard(index, card.type === CardType.EXERTIEN ? CardType.EXERTIEN : CardType.ACTION)));
}

/**
 * Vue de la partie pour un joueur (prérequis du jeu à distance) : ce que ce joueur a le droit de voir.
 * Masque l'ordre et le contenu des pioches (cartes et cartes Alien), les cartes en main des adversaires
 * (sauf celles révélées), leurs cartes Exertiens (jouées face cachée jusqu'au décompte final), les spécimens
 * Mascamites non prélevés ou transportés par un adversaire, les espèces pas encore découvertes, la graine
 * et le générateur aléatoire, et le détail des interactions qui attendent un autre joueur.
 * Les nombres restent visibles (taille des pioches, nombre de cartes en main). Ne modifie pas la partie reçue.
 * Le jeu local (un humain contre des robots) n'en a pas besoin : un serveur l'enverra à chaque client.
 */
export function viewFor(game: Game, viewerId: string): Game {
  const view = cloneGame(game);
  delete view.seed;
  delete view.rngState;
  const finalScoring = game.phase === GamePhase.FINAL_SCORING;

  view.decks.cards = hideCards(view.decks.cards);

  view.players.forEach(player => {
    if (player.id === viewerId) return;
    player.cards = hideCards(player.cards, card => card.isRevealed && card.type !== CardType.EXERTIEN);
    player.playedCards = hideCards(player.playedCards, card => finalScoring || card.type !== CardType.EXERTIEN);
    player.probes.forEach(probe => { if (probe.specimen) probe.specimen = { bonus: {} }; });
  });

  // Spécimens Mascamites face cachée sur Jupiter et Saturne : leur gain n'est connu qu'une fois prélevé
  view.board.planets.forEach(planet => {
    if (planet.mascamiteTokens) planet.mascamiteTokens = planet.mascamiteTokens.map(() => ({ bonus: {} }));
  });

  view.species.forEach(species => {
    species.cards = hideCards(species.cards);
    if (species.specimen) species.specimen = species.specimen.map(() => ({ bonus: {} }));
  });
  view.species = view.species.filter(species => species.discovered);
  view.board.alienBoards.forEach(board => {
    if (!board.isDiscovered) board.speciesId = HIDDEN_SPECIES;
  });

  // Une interaction qui attend un autre joueur : on sait seulement laquelle et qui doit répondre
  const mask = (interaction: InteractionState): InteractionState => {
    const ownerId = InteractionQueue.ownerId(game, interaction);
    return ownerId === viewerId ? interaction : ({ type: interaction.type, playerId: ownerId } as InteractionState);
  };
  if (view.interaction) view.interaction = mask(view.interaction);
  if (view.pendingInteractions) view.pendingInteractions = view.pendingInteractions.map(mask);

  return view;
}
