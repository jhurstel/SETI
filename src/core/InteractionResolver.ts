import { Bonus, Game, HistoryEntry, InteractionState } from './types';
import { cloneGame } from './cloneGame';
import { ScanSystem } from '../systems/ScanSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { CardSystem } from '../systems/CardSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';

/** Interactions résolues sans choix du joueur (effets de carte, résolution de secteur, validation de mission…). */
export type AutomaticInteraction = Extract<InteractionState, { type: 'TRIGGER_CARD_EFFECT' | 'RESOLVING_SECTOR' | 'DRAW_AND_SCAN' | 'CLAIMING_MISSION_REQUIREMENT' }>;

const AUTOMATIC_TYPES: ReadonlyArray<InteractionState['type']> = ['TRIGGER_CARD_EFFECT', 'RESOLVING_SECTOR', 'DRAW_AND_SCAN', 'CLAIMING_MISSION_REQUIREMENT'];

export function isAutomaticInteraction(interaction: InteractionState): interaction is AutomaticInteraction {
  return AUTOMATIC_TYPES.includes(interaction.type);
}

export interface AutomaticResolution {
  updatedGame: Game;
  historyEntries: HistoryEntry[];
  /**
   * Interactions déclenchées, dans l'ordre. Celles destinées à un autre joueur humain
   * (ex: gagnant de la majorité d'un secteur) portent son `playerId`.
   */
  newInteractions: InteractionState[];
  /** Résumé proposé si plusieurs interactions doivent être ordonnées par le joueur. */
  summary?: string;
  /** Les nouvelles interactions s'enchaînent sans menu de choix d'ordre. */
  forceStacking?: boolean;
  /** Résolution refusée (ex: conditions de mission non remplies) : l'état est inchangé. */
  error?: string;
}

/**
 * Résout une interaction automatique pour un joueur.
 * Utilisé par l'interface (joueur humain) et par l'IA (AIController) : une seule implémentation des règles.
 */
export class InteractionResolver {
  static resolve(game: Game, playerId: string, interaction: AutomaticInteraction): AutomaticResolution {
    switch (interaction.type) {
      case 'TRIGGER_CARD_EFFECT': return this.triggerCardEffect(game, playerId, interaction);
      case 'RESOLVING_SECTOR': return this.resolveSector(game, playerId, interaction);
      case 'DRAW_AND_SCAN': return this.drawAndScan(game, playerId, interaction);
      case 'CLAIMING_MISSION_REQUIREMENT': return this.claimMissionRequirement(game, playerId, interaction);
    }
  }

  /** Carte 119 (PIXL) : PV par média. */
  private static triggerCardEffect(game: Game, playerId: string, interaction: Extract<AutomaticInteraction, { type: 'TRIGGER_CARD_EFFECT' }>): AutomaticResolution {
    const updatedGame = cloneGame(game);
    const player = updatedGame.players.find(p => p.id === playerId)!;
    const historyEntries: HistoryEntry[] = [];

    if (interaction.effectType === 'SCORE_PER_MEDIA') {
      const pointsGained = player.mediaCoverage * interaction.value;
      if (pointsGained > 0) {
        player.score += pointsGained;
        historyEntries.push({ message: `gagne ${pointsGained} PV (Bonus PIXL)`, playerId, sequenceId: interaction.sequenceId });
      }
    }
    return { updatedGame, historyEntries, newInteractions: [] };
  }

  /** Couverture d'un secteur rempli : bonus du gagnant, médias, interactions des autres joueurs. */
  private static resolveSector(game: Game, playerId: string, interaction: Extract<AutomaticInteraction, { type: 'RESOLVING_SECTOR' }>): AutomaticResolution {
    const { sectorId, sequenceId } = interaction;
    const coverage = ScanSystem.coverSector(game, playerId, sectorId);
    let updatedGame = coverage.updatedGame;
    const historyEntries: HistoryEntry[] = [];
    const newInteractions: InteractionState[] = [];
    const coverageLogs = [...coverage.logs];

    if (coverage.bonuses) {
      const bonusRes = ResourceSystem.processBonuses(coverage.bonuses, updatedGame, playerId, 'scan', sequenceId || '');
      updatedGame = bonusRes.updatedGame;
      coverageLogs.push(...bonusRes.logs);
      historyEntries.push(...bonusRes.historyEntries.map(e => ({ ...e, sequenceId })));
      newInteractions.push(...bonusRes.newPendingInteractions.map(i => ({ ...i, sequenceId })));
    }

    if (coverageLogs.length > 0) {
      historyEntries.push({ message: coverageLogs.join(', '), playerId: coverage.winnerId || playerId, sequenceId });
    }

    // Interactions des autres joueurs (ex: le gagnant de la majorité place une trace de vie)
    for (const { interaction: other, playerId: otherId } of coverage.newPendingInteractions || []) {
      const owner = updatedGame.players.find(p => p.id === otherId);
      if (!owner) continue;

      if (owner.type === 'human') {
        newInteractions.push({ ...other, playerId: otherId, sequenceId } as InteractionState);
      } else if (other.type === 'PLACING_LIFE_TRACE') {
        // Robot : placement automatique pour ne pas bloquer la partie
        const trace = SpeciesSystem.placeLifeTraceAuto(updatedGame, 0, other.color, otherId, sequenceId);
        updatedGame = trace.updatedGame;
        historyEntries.push(...trace.historyEntries.map(e => ({ ...e, sequenceId })));
        if (updatedGame.isSpeciesDiscovered) {
          historyEntries.push({ message: 'découvre une nouvelle espèce Alien !', playerId: otherId, sequenceId });
          updatedGame.isSpeciesDiscovered = false;
        }
        newInteractions.push(...trace.newPendingInteractions);
      }
    }

    const summary = coverageLogs.length > 0 ? `Secteur résolu. ${coverageLogs.join(', ')}` : 'Secteur résolu.';
    return { updatedGame, historyEntries, newInteractions, summary };
  }

  /** Astronomes Amateurs : révèle la carte du dessus de la pioche et marque un signal de sa couleur. */
  private static drawAndScan(game: Game, playerId: string, interaction: Extract<AutomaticInteraction, { type: 'DRAW_AND_SCAN' }>): AutomaticResolution {
    if (game.decks.cards.length === 0) return { updatedGame: game, historyEntries: [], newInteractions: [] };

    const updatedGame = cloneGame(game);
    const { sequenceId } = interaction;
    const drawnCard = updatedGame.decks.cards.shift()!;
    if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
    updatedGame.decks.discardPile.push(drawnCard);

    return {
      updatedGame,
      historyEntries: [{ message: `révèle carte "${drawnCard.name}" (${drawnCard.scanSector}) de la pioche`, playerId, sequenceId }],
      newInteractions: [{
        type: 'SELECTING_SCAN_SECTOR',
        color: drawnCard.scanSector,
        cardId: drawnCard.id,
        message: `Marquez un signal dans un secteur ${drawnCard.scanSector} (Carte "${drawnCard.name}")`,
        sequenceId,
      }],
      forceStacking: true,
    };
  }

  /** Validation d'un objectif de mission (et de la mission si c'était le dernier). */
  private static claimMissionRequirement(game: Game, playerId: string, interaction: Extract<AutomaticInteraction, { type: 'CLAIMING_MISSION_REQUIREMENT' }>): AutomaticResolution {
    const updatedGame = cloneGame(game);
    const player = updatedGame.players.find(p => p.id === playerId)!;
    const mission = player.missions.find(m => m.id === interaction.missionId);
    if (!mission || mission.completedRequirementIds.includes(interaction.requirementId)) {
      return { updatedGame: game, historyEntries: [], newInteractions: [] };
    }

    const requirement = mission.requirements.find(r => r.id === interaction.requirementId);
    const bonuses: Bonus = {};
    // Prérequis déjà signalé comme réalisable par le moteur (GAIN_ON_…) : pas de nouvelle vérification
    const skipCheck = mission.fulfillableRequirementIds.includes(interaction.requirementId);

    if (requirement && (requirement.type.startsWith('GAIN_IF_') || requirement.type.startsWith('GAIN_ON_'))) {
      const bonus = CardSystem.evaluateMission(updatedGame, playerId, requirement.value, skipCheck);
      if (!bonus) return { updatedGame: game, historyEntries: [], newInteractions: [], error: 'Conditions non remplies.' };
      ResourceSystem.accumulateBonus(bonus, bonuses);
    }

    mission.completedRequirementIds.push(interaction.requirementId);
    // Un seul prérequis réalisable peut être choisi : vider la liste pour toutes les missions du joueur
    player.missions.forEach(m => (m.fulfillableRequirementIds = []));
    const isCompleted = mission.completedRequirementIds.length >= mission.requirements.length;
    if (isCompleted) mission.completed = true;

    const sequenceId = interaction.sequenceId || `mission-claim-${Date.now()}`;
    const res = ResourceSystem.processBonuses(bonuses, updatedGame, playerId, 'mission-claim', sequenceId);
    const actionText = isCompleted ? 'accomplit' : 'valide un objectif de';
    return {
      updatedGame: res.updatedGame,
      historyEntries: [
        { message: `${actionText} la mission "${mission.name}"${res.logs.length > 0 ? ' et ' + res.logs.join(', ') : ''}`, playerId, sequenceId },
        ...res.historyEntries.map(e => ({ ...e, sequenceId })),
      ],
      newInteractions: res.newPendingInteractions.map(i => ({ ...i, sequenceId })),
    };
  }
}
