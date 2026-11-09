import { AlienBoardType, Card, CardType, CostType, FreeActionType, Game, GamePhase, HistoryEntry, InteractionState, RevenueType, SectorType } from '../core/types';
import { textFor } from '../core/historyText';
import { cloneGame } from '../core/cloneGame';
import { InteractionQueue } from './InteractionQueue';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { ScoreManager } from '../engine/ScoreManager';

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
 * Masque l'ordre et le contenu des pioches (cartes, cartes Alien et piles de fin de manche), les cartes en main des adversaires
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
  // Piles de fin de manche cachées, sauf celle que le joueur découvre après avoir passé
  const roundChoice = game.interaction?.type === 'CHOOSING_ROUND_CARD' && game.interaction.playerId === viewerId ? game.interaction.round : undefined;
  for (const round in view.decks.roundDecks) {
    if (Number(round) !== roundChoice) view.decks.roundDecks[round] = hideCards(view.decks.roundDecks[round]);
  }

  view.players.forEach(player => {
    if (player.id === viewerId) return;
    player.cards = hideCards(player.cards, card => card.isRevealed && card.type !== CardType.EXERTIEN);
    // Danger : seul celui de la piste Exertiens est public (celui des cartes jouées face cachée s'y ajoute au décompte)
    if (!finalScoring) player.danger = ScoreManager.exertienTrackDanger(game, player);
    player.playedCards = hideCards(player.playedCards, card => finalScoring || card.type !== CardType.EXERTIEN);
    player.probes.forEach(probe => { if (probe.specimen) probe.specimen = { bonus: {} }; });
  });

  // Spécimens Mascamites face cachée sur Jupiter et Saturne : visibles seulement par un joueur qui les a regardés
  // (en en prélevant ou en en étudiant un) ou qui est en train d'en choisir un ; celui d'une capsule, par son propriétaire
  view.board.solarSystem.probes.forEach(probe => { if (probe.specimen && probe.ownerId !== viewerId) probe.specimen = { bonus: {} }; });
  view.board.planets.forEach(planet => {
    if (planet.mascamiteTokens && !SpeciesSystem.canSeeSpecimens(game, viewerId, planet.id)) {
      planet.mascamiteTokens = planet.mascamiteTokens.map(() => ({ bonus: {} }));
    }
  });

  view.species.forEach(species => {
    species.cards = hideCards(species.cards);
    if (species.specimen) species.specimen = species.specimen.map(() => ({ bonus: {} }));
  });
  // Espèce découverte : son plateau est retourné (les anciennes sauvegardes n'ont que l'indicateur du plateau)
  const discovered = (name: string) => game.board.alienBoards.some(board => board.speciesId === name && board.isDiscovered);
  view.species = view.species.filter(species => species.discovered || discovered(species.name));
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

/**
 * Historique tel qu'un joueur peut le lire : les passages privés des autres joueurs (cartes qu'ils ont piochées
 * face cachée) sont retirés, et les états d'annulation ne sont pas transmis.
 */
export function viewEntries(entries: HistoryEntry[], viewerId: string): HistoryEntry[] {
  return entries.map(({ previousState: _state, previousInteractionState: _interaction, previousPendingInteractions: _pending, ...entry }) => ({
    ...entry,
    message: textFor(entry.message, viewerId),
  }));
}
