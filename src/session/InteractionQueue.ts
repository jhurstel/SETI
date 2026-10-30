import { Game, InteractionState, getInteractionLabel } from '../core/types';
import { uniqueId } from '../core/ids';

/**
 * File des interactions d'une partie, dans l'état (`game.interaction` en cours, `game.pendingInteractions` ensuite) :
 * même ordre de résolution pour tous les joueurs, sur un poste comme sur un serveur.
 * Fonctions pures : elles renvoient une nouvelle partie (seuls les champs de la file changent).
 */
export class InteractionQueue {
  static active(game: Game): InteractionState | undefined {
    return game.interaction;
  }

  static pending(game: Game): InteractionState[] {
    return game.pendingInteractions || [];
  }

  /** Aucune interaction en cours ni en attente */
  static isEmpty(game: Game): boolean {
    return !game.interaction && this.pending(game).length === 0;
  }

  /** Joueur qui doit résoudre l'interaction : celui qu'elle désigne, sinon le joueur actif */
  static ownerId(game: Game, interaction: InteractionState): string {
    return interaction.playerId ?? game.players[game.currentPlayerIndex].id;
  }

  static set(game: Game, interaction: InteractionState | undefined, pending: InteractionState[] = this.pending(game)): Game {
    return { ...game, interaction, pendingInteractions: pending };
  }

  /** Termine l'interaction en cours (la suivante sera prise par `next`) */
  static clear(game: Game): Game {
    return this.set(game, undefined);
  }

  /** Passe à l'interaction suivante de la file, s'il n'y en a pas en cours */
  static next(game: Game): Game {
    if (game.interaction) return game;
    const [first, ...rest] = this.pending(game);
    return first ? this.set(game, first, rest) : game;
  }

  /** Remet une interaction en tête de file, juste après celle en cours (suite d'une interaction : placements restants…) */
  static pushFront(game: Game, interaction: InteractionState): Game {
    return game.interaction ? this.set(game, game.interaction, [interaction, ...this.pending(game)]) : this.set(game, interaction);
  }

  /**
   * Ajoute des interactions déclenchées (gains d'une action, d'une carte, d'un secteur…) :
   * plusieurs interactions à choix deviennent un menu (CHOOSING_BONUS_ACTION) où le joueur choisit l'ordre,
   * sauf `forceStacking` ; les résolutions de secteur passent après tout le reste.
   * Les interactions s'ajoutent avant celles déjà en attente (une action se résout avant la suivante).
   */
  static enqueue(game: Game, interactions: InteractionState[], sequenceId?: string, summary?: string, forceStacking = false): Game {
    if (interactions.length === 0) return game;
    const withSequence = (i: InteractionState): InteractionState => ({ ...i, sequenceId: i.sequenceId || sequenceId });
    const resolutions = interactions.filter(i => i.type === 'RESOLVING_SECTOR').map(withSequence);
    const others = interactions.filter(i => i.type !== 'RESOLVING_SECTOR').map(withSequence);
    const pending = this.pending(game);
    const current = game.interaction ? [game.interaction] : [];

    let queue: InteractionState[];
    if (others.length > 1 && !forceStacking) {
      const menu: InteractionState = {
        type: 'CHOOSING_BONUS_ACTION',
        bonusesSummary: summary || "Plusieurs actions disponibles. Choisissez l'ordre de résolution :",
        choices: others.map((state, index) => ({ id: `choice-${uniqueId()}-${index}`, label: getInteractionLabel(state), state, done: false })),
        sequenceId: sequenceId || others[0].sequenceId,
        playerId: others[0].playerId,
      };
      queue = [...current, menu, ...pending, ...resolutions];
    } else {
      queue = [...current, ...others, ...pending, ...resolutions];
    }
    const [first, ...rest] = queue;
    return this.set(game, first, rest);
  }
}
