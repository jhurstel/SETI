/**
 * Gestionnaire de scoring pour SETI
 * 
 * Calcule tous les points de victoire selon les règles du jeu.
 * 
 * Catégories de scoring :
 * - Tuiles Score dorées
 * - Séries de technologies
 * - Missions accomplies
 * - Revenus réservés
 * - Traces de vie (sets de 3 types)
 * - Paires : secteurs couverts / sondes
 * - Paires : missions / cartes fin de partie
 * - Effets spécifiques d'espèces
 */

import { effectNumber, effectString } from './cardEffects';
import { cloneGame } from './cloneGame';
import {
  Game,
  Player,
  ScoreCategories,
  LifeTraceType,
  Species,
  Card,
  CardType,
  ObjectiveCategory,
  TechnologyCategory,
  GAME_CONSTANTS,
  ProbeState,
  SectorType,
  GOLDEN_MILESTONES,
  NEUTRAL_MILESTONES,
  InteractionState,
  AlienBoardType,
  HistoryEntry,
  FinalScore,
  ScoreDetails,
  ObjectiveTile,
  RevealedExertienCard,
  LifeTraceLocation,
  Bonus
} from '../core/types';
import { createRotationState, getAbsoluteSectorForProbe, getCell } from './SolarSystemPosition';
import { SpeciesSystem } from '../systems/SpeciesSystem';

export class ScoreManager {
  /**
   * Calcule le score final d'un joueur
   */
  static calculateFinalScore(game: Game, playerId: string, details?: ScoreDetails): ScoreCategories {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const scores: ScoreCategories = {
      missionEndGame: 0,
      objectiveTiles: 0,
      speciesBonuses: 0,
      exertienCards: 0,
      total: 0
    };

    scores.missionEndGame = this.calculateMissionEndGame(player, game, details?.missionEndGame);

    scores.speciesBonuses = this.calculateSpeciesBonuses(player, game.discoveredSpecies);

    scores.objectiveTiles = this.calculateObjectiveTiles(player, game.board, details?.objectiveTiles);

    scores.exertienCards = this.revealExertienCards(game, player).reduce((sum, c) => sum + c.points, 0);

    // Total
    scores.total = Object.values(scores).reduce((sum, val) =>
      typeof val === 'number' ? sum + val : sum, 0
    );

    return scores;
  }

  /**
   * Calcule les points des paires missions/cartes fin de partie
   */
  private static calculateMissionEndGame(player: Player, game: Game, details?: string[]): number {
    let bonus = 0;
    const endGameCards: Card[] = (player.playedCards || []).filter(c => c.type === CardType.END_GAME);

    endGameCards.forEach(card => {
      const bonusBefore = bonus;
      // Traitement des règles de scoring définies dans passiveEffects
      if (card.passiveEffects) {
        card.passiveEffects.forEach(effect => {
          if (effect.type === 'SCORE_PER_ORBITER_LANDER') {
            const planetId = effect.target;
            if (planetId) {
              const planet = game.board.planets.find(p => p.id === planetId);
              if (planet) {
                let count = 0;
                // Orbiteurs sur la planète
                count += planet.orbiters.filter(p => p.ownerId === player.id).length;
                // Atterrisseurs sur la planète
                count += planet.landers.filter(p => p.ownerId === player.id).length;
                // Satellites
                if (planet.satellites) {
                  planet.satellites.forEach(sat => {
                    count += sat.landers.filter(p => p.ownerId === player.id).length;
                  });
                }
                bonus += count * effectNumber(effect);
              }
            }
          } else if (effect.type === 'SCORE_PER_COVERED_SECTOR') {
            const colorStr = effect.target;
            let color: SectorType | undefined;
            if (colorStr === 'red') color = SectorType.RED;
            else if (colorStr === 'blue') color = SectorType.BLUE;
            else if (colorStr === 'yellow') color = SectorType.YELLOW;
            else if (colorStr === 'black') color = SectorType.BLACK;

            if (color) {
              let count = 0;
              game.board.sectors.forEach(s => {
                if (s.color === color) {
                  count += s.coveredBy.filter(id => id === player.id).length;
                }
              });
              bonus += count * effectNumber(effect);
            }
          } else if (effect.type === 'SCORE_PER_LIFETRACE') {
            const colorStr = effect.target;
            let type: LifeTraceType | undefined;
            if (colorStr === 'red') type = LifeTraceType.RED;
            else if (colorStr === 'blue') type = LifeTraceType.BLUE;
            else if (colorStr === 'yellow') type = LifeTraceType.YELLOW;

            if (type) {
              const count = player.lifeTraces.filter(t => t.type === type).length;
              bonus += count * effectNumber(effect);
            }
          } else if (effect.type === 'SCORE_PER_SIGNAL') {
            const count = game.board.sectors.filter(s => s.signals.some(sig => sig.markedBy === player.id)).length;
            bonus += count * effectNumber(effect);
          } else if (effect.type === 'SCORE_PER_TECH_CATEGORY') {
            const catStr = effect.target;
            let category: TechnologyCategory | undefined;
            if (catStr === 'computing') category = TechnologyCategory.COMPUTING;
            else if (catStr === 'exploration') category = TechnologyCategory.EXPLORATION;
            else if (catStr === 'observation') category = TechnologyCategory.OBSERVATION;

            if (category) {
              const count = player.technologies.filter(t => t.type === category).length;
              bonus += count * effectNumber(effect);
            }
          } else if (effect.type === 'SCORE_IF_PROBE_ON_ASTEROID') {
            const rotationState = createRotationState(
              game.board.solarSystem.rotationAngleLevel1 || 0,
              game.board.solarSystem.rotationAngleLevel2 || 0,
              game.board.solarSystem.rotationAngleLevel3 || 0
            );
            const hasProbe = player.probes.some(p => {
              if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
              const absSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
              const cell = getCell(p.solarPosition.disk, absSector, rotationState, game.board.solarSystem.extraCelestialObjects);
              return cell?.hasAsteroid;
            });
            if (hasProbe) {
              bonus += effectNumber(effect);
            }
          } else if (effect.type === 'SCORE_SOLVAY') {
            // Congrès Solvay : décompter, avec la case la plus à droite, la meilleure tuile Score dorée sans marqueur du joueur
            const best = (game.board.objectiveTiles || [])
              .filter(tile => !tile.markers.includes(player.id))
              .reduce((max, tile) => Math.max(max, this.objectiveTileSeries(player, game.board, tile) * tile.rewards.others), 0);
            bonus += best;
          } else if (effect.type === 'SCORE_PER_SPECIES_LIFETRACE') {
            // ET.5, ET.24 : PV par trace de vie marquée pour l'espèce de la carte
            const count = effect.target ? SpeciesSystem.playerTracesForSpecies(game, player.id, effect.target).length : 0;
            bonus += count * effectNumber(effect);
          }
        });
      }
      details?.push(`${card.name} : ${bonus - bonusBefore} PV`);
    });

    return bonus;
  }

  /**
   * Nombre de séries réalisées par un joueur pour une tuile Score dorée (à multiplier par la valeur du marqueur).
   */
  static objectiveTileSeries(player: Player, board: Game['board'], tile: ObjectiveTile): number {
    let count = 0;

    switch (tile.category) {
      case ObjectiveCategory.TECHNOLOGY:
        if (tile.side === 'A') {
          // Série de 3 types de technologies
          const typeCounts = new Map<TechnologyCategory, number>();
          player.technologies.forEach(t => {
            typeCounts.set(t.type, (typeCounts.get(t.type) || 0) + 1);
          });

          const counts = Array.from(typeCounts.values()).sort((a, b) => b - a);
          while (counts.length < 3) counts.push(0);
          // Greedy algorithm for sets of 3 distinct types (assuming max 4 types)
          while (counts.length < 4) counts.push(0);

          let sets = 0;
          while (counts[2] > 0) {
            sets++;
            counts[0]--;
            counts[1]--;
            counts[2]--;
            counts.sort((a, b) => b - a);
          }
          count = sets;
        } else {
          // Paire de technologies
          count = Math.floor(player.technologies.length / 2);
        }
        break;

      case ObjectiveCategory.MISSION:
        if (tile.side === 'A') {
          // Mission accomplie
          count = player.missions.filter(m => m.completed).length;
        } else {
          // Paire Mission / Fin de partie
          const completedMissions = player.missions.filter(m => m.completed).length;
          const endGameCards = (player.playedCards || []).filter(c => c.type === CardType.END_GAME).length;
          count = Math.floor((completedMissions + endGameCards) / 2);
        }
        break;

      case ObjectiveCategory.REVENUE: {
        // Revenus réservés (au-delà du départ)
        const reservedCredits = Math.max(0, player.revenueCredits - GAME_CONSTANTS.INITIAL_REVENUE_CREDITS);
        const reservedEnergy = Math.max(0, player.revenueEnergy - GAME_CONSTANTS.INITIAL_REVENUE_ENERGY);
        const reservedCards = Math.max(0, player.revenueCards - GAME_CONSTANTS.INITIAL_REVENUE_CARDS);

        if (tile.side === 'A') {
          // Série de 3 types
          count = Math.min(reservedCredits, reservedEnergy, reservedCards);
        } else {
          // Type le plus réservé
          count = Math.max(reservedCredits, reservedEnergy, reservedCards);
        }
        break;
      }

      case ObjectiveCategory.OTHER:
        if (tile.side === 'A') {
          // Série de 3 types de traces de vie
          const tCounts = new Map<LifeTraceType, number>();
          player.lifeTraces.forEach(t => tCounts.set(t.type, (tCounts.get(t.type) || 0) + 1));
          const cBlue = tCounts.get(LifeTraceType.BLUE) || 0;
          const cRed = tCounts.get(LifeTraceType.RED) || 0;
          const cYellow = tCounts.get(LifeTraceType.YELLOW) || 0;
          count = Math.min(cBlue, cRed, cYellow);
        } else {
          // Paire secteur couvert / sonde (orbiteur ou atterrisseur)
          let coveredSectors = 0;
          board.sectors.forEach(s => {
            coveredSectors += s.coveredBy.filter(id => id === player.id).length;
          });
          const probes = player.probes.filter(p => p.state === ProbeState.IN_ORBIT || p.state === ProbeState.LANDED).length;
          count = Math.min(coveredSectors, probes);
        }
        break;
    }

    return count;
  }

  /**
   * Calcule les points des tuiles objectifs du plateau
   */
  private static calculateObjectiveTiles(player: Player, board: Game['board'], details?: string[]): number {
    let total = 0;
    if (!board.objectiveTiles) return 0;

    board.objectiveTiles.forEach(tile => {
      const index = tile.markers.indexOf(player.id);
      if (index !== -1) {
        let rewardValue = 0;
        if (index === 0) rewardValue = tile.rewards.first;
        else if (index === 1) rewardValue = tile.rewards.second;
        else rewardValue = tile.rewards.others;

        const count = this.objectiveTileSeries(player, board, tile);

        total += count * rewardValue;
        details?.push(`${tile.name} ${tile.side} : ${count} × ${rewardValue} PV = ${count * rewardValue} PV`);
      }
    });
    return total;
  }

  /**
   * Calcule les bonus spécifiques des espèces découvertes
   */
  private static calculateSpeciesBonuses(
    _player: Player,
    _discoveredSpecies: Species[]
  ): number {
    // Règles (p. 21) : « certaines espèces peuvent ajouter une étape de décompte supplémentaire ». Seuls les
    // Exertiens en ajoutent une (cartes Exertiens jouées et danger : voir revealExertienCards et calculateExertienDanger).
    // Les exofossiles d'Oumuamua ne rapportent rien (FAQ Q42) ; les cartes Fin de partie des espèces sont dans missionEndGame.
    return 0;
  }

  /**
   * Cartes Exertiens jouées par le joueur, révélées avec leurs PV de fin de partie.
   * Chaque carte rapporte ses PV une seule fois si sa condition (END_CONDITION) est remplie (FAQ Q45).
   */
  static revealExertienCards(game: Game, player: Player): RevealedExertienCard[] {
    return (player.playedCards || [])
      .filter(card => card.type === CardType.EXERTIEN)
      .map(card => {
        const progress = this.exertienCardProgress(game, player, card);
        const conditionMet = !!progress && progress.value >= progress.threshold;
        return { name: card.name, danger: card.danger || 0, points: conditionMet ? progress.points : 0, conditionMet };
      });
  }

  /**
   * Avancement de la condition de fin de partie d'une carte Exertien (jouée ou non) :
   * valeur actuelle, seuil à atteindre et PV promis ; null si la carte n'a pas de condition.
   */
  static exertienCardProgress(game: Game, player: Player, card: Card): { value: number; threshold: number; points: number } | null {
    const condition = card.passiveEffects.find(e => e.type === 'END_CONDITION');
    if (!condition) return null;
    const [param, threshold, pv] = effectString(condition).split(':');
    return { value: this.exertienConditionValue(game, player, condition.target || '', param), threshold: parseInt(threshold, 10), points: parseInt(pv, 10) };
  }

  /** Valeur mesurée pour une condition de carte Exertien (comparée ensuite au seuil). */
  private static exertienConditionValue(game: Game, player: Player, kind: string, param: string): number {
    const sectorColors: Record<string, SectorType> = { red: SectorType.RED, blue: SectorType.BLUE, yellow: SectorType.YELLOW, black: SectorType.BLACK };
    const techCategories: Record<string, TechnologyCategory> = { exploration: TechnologyCategory.EXPLORATION, observation: TechnologyCategory.OBSERVATION, computing: TechnologyCategory.COMPUTING };
    const owned = (probes: { ownerId: string }[]) => probes.filter(p => p.ownerId === player.id).length;
    const landersOn = (planet: Game['board']['planets'][number]) =>
      owned(planet.landers) + (planet.satellites || []).reduce((sum, s) => sum + owned(s.landers), 0);
    const exertienBoard = game.board.alienBoards.find(b => b.speciesId === AlienBoardType.EXERTIENS);

    switch (kind) {
      case 'TECH':
        return player.technologies.filter(t => t.type === techCategories[param]).length;
      case 'COVERED':
        return game.board.sectors.filter(s => s.color === sectorColors[param]).reduce((sum, s) => sum + s.coveredBy.filter(id => id === player.id).length, 0);
      case 'ORBITERS':
        return game.board.planets.reduce((sum, p) => sum + owned(p.orbiters), 0);
      case 'LANDERS':
        return game.board.planets.reduce((sum, p) => sum + landersOn(p), 0);
      case 'SAME_PLANET':
        return Math.max(0, ...game.board.planets.map(p => owned(p.orbiters) + landersOn(p)));
      case 'RESERVED':
        return (player.reservedCards || []).length;
      case 'TRACES_SPECIES':
        // Traces du joueur sur le plateau Exertiens (« this ») ou sur les autres plateaux Alien (« other »)
        return game.board.alienBoards
          .filter(b => (param === 'this') === (b === exertienBoard))
          .reduce((sum, b) => sum + b.lifeTraces.filter(t => t.playerId === player.id).length, 0);
      case 'TRACES_SAME_COLOR': {
        const colors = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE];
        return Math.max(...colors.map(c => player.lifeTraces.filter(t => t.type === c).length));
      }
      case 'MISSIONS':
        return player.missions.filter(m => m.completed).length;
      default:
        return 0;
    }
  }

  /**
   * Danger Exertien d'un joueur : DANGER des cartes Exertiens jouées
   * + danger des emplacements occupés par ses marqueurs sur la piste d'espèce Exertiens.
   */
  static calculateExertienDanger(game: Game, player: Player, details?: string[]): number {
    const exertienCards = (player.playedCards || []).filter(c => c.type === CardType.EXERTIEN);
    exertienCards.forEach(c => details?.push(`Carte ${c.name} : danger ${c.danger || 0}`));
    const cardsDanger = exertienCards.reduce((sum, c) => sum + (c.danger || 0), 0);

    const board = game.board.alienBoards.find(b => b.speciesId === AlienBoardType.EXERTIENS);
    const species = game.species.find(s => s.name === AlienBoardType.EXERTIENS);
    let markersDanger = 0;
    if (board && species) {
      const slotsByColor: Partial<Record<LifeTraceType, Bonus[]>> = {
        [LifeTraceType.RED]: species.fixedSlots.redlifetrace,
        [LifeTraceType.YELLOW]: species.fixedSlots.yellowlifetrace,
        [LifeTraceType.BLUE]: species.fixedSlots.bluelifetrace,
      };
      board.lifeTraces
        .filter(t => t.playerId === player.id && t.location === LifeTraceLocation.SPECIES && t.slotIndex !== undefined)
        .forEach(t => {
          // Valeur absolue : les anciennes sauvegardes stockaient ces dangers en négatif
          const slotDanger = Math.abs(slotsByColor[t.type]?.[t.slotIndex!]?.danger || 0);
          markersDanger += slotDanger;
          if (slotDanger > 0) details?.push(`Marqueur ${t.type.toLowerCase()} : danger ${slotDanger}`);
        });
    }
    return cardsDanger + markersDanger;
  }

  /**
   * Décompte final : catégories de fin de partie, révélation des cartes Exertiens,
   * puis pénalité de danger (calculée après tous les autres PV).
   *
   * Pénalité : si les Exertiens ont été découverts, le joueur le plus exposé au danger perd 10 % de son
   * total (arrondi à l'inférieur) ; en cas d'égalité, tous les joueurs à égalité la subissent.
   * Si personne n'a de danger positif, personne n'est exposé : aucune pénalité.
   */
  static applyFinalScoring(game: Game): { updatedGame: Game; finalScores: FinalScore[]; historyEntries: HistoryEntry[] } {
    const updatedGame = cloneGame(game);

    const finalScores: FinalScore[] = updatedGame.players.map(player => {
      const details: ScoreDetails = { objectiveTiles: [], missionEndGame: [], speciesBonuses: [], danger: [] };
      const categories = this.calculateFinalScore(updatedGame, player.id, details);
      const revealedExertienCards = this.revealExertienCards(updatedGame, player);
      revealedExertienCards.forEach(c => details.speciesBonuses.push(`Exertiens — ${c.name} : ${c.conditionMet ? `${c.points} PV` : 'condition non remplie'}`));
      const danger = this.calculateExertienDanger(updatedGame, player, details.danger);
      return {
        playerId: player.id,
        baseScore: player.score,
        categories,
        revealedExertienCards,
        danger,
        dangerPenalty: 0,
        finalScore: player.score + categories.total,
        details,
      };
    });

    const exertiensDiscovered = updatedGame.board.alienBoards.some(b => b.speciesId === AlienBoardType.EXERTIENS && b.isDiscovered);
    const maxDanger = Math.max(...finalScores.map(s => s.danger));
    if (exertiensDiscovered && maxDanger > 0) {
      finalScores.filter(s => s.danger === maxDanger).forEach(s => {
        s.dangerPenalty = Math.floor(s.finalScore * 0.1);
        s.details?.danger.push(`Plus exposé au danger : −10 % de ${s.finalScore} PV = −${s.dangerPenalty} PV`);
        s.finalScore -= s.dangerPenalty;
      });
    }

    finalScores.forEach(s => {
      updatedGame.players.find(p => p.id === s.playerId)!.score = s.finalScore;
    });
    updatedGame.finalScores = finalScores;

    return { updatedGame, finalScores, historyEntries: this.describeFinalScores(updatedGame, finalScores) };
  }

  /** Entrées d'historique du décompte final (révélation des cartes Exertiens, PV gagnés, pénalité). */
  static describeFinalScores(game: Game, finalScores: FinalScore[]): HistoryEntry[] {
    const entries: HistoryEntry[] = [{ message: '--- DÉCOMPTE FINAL ---', playerId: '' }];
    finalScores.forEach(s => {
      const playerId = s.playerId;
      if (s.revealedExertienCards.length > 0) {
        const cards = s.revealedExertienCards
          .map(c => `"${c.name}" (danger ${c.danger}, ${c.conditionMet ? `+${c.points} PV` : 'condition non remplie'})`)
          .join(', ');
        entries.push({ message: `révèle ses cartes Exertiens : ${cards}`, playerId });
      }
      const { objectiveTiles, missionEndGame, speciesBonuses, exertienCards, total } = s.categories;
      entries.push({
        message: `gagne ${total} PV au décompte final (objectifs ${objectiveTiles}, fin de partie ${missionEndGame}, espèces ${speciesBonuses}, Exertiens ${exertienCards})`,
        playerId,
      });
      if (s.dangerPenalty > 0) {
        entries.push({ message: `est le plus exposé au danger Exertien (${s.danger}) et perd ${s.dangerPenalty} PV (10 %)`, playerId });
      }
    });
    const best = Math.max(...finalScores.map(s => s.finalScore));
    const winners = finalScores.filter(s => s.finalScore === best).map(s => game.players.find(p => p.id === s.playerId)!.name);
    entries.push({ message: `${winners.length > 1 ? 'Vainqueurs ex aequo' : 'Vainqueur'} : ${winners.join(', ')} avec ${best} PV`, playerId: '' });
    return entries;
  }

  /**
   * Gagnant(s) : meilleur score final (pénalité de danger comprise) ; tous les ex aequo sont renvoyés.
   */
  static determineWinner(finalScores: FinalScore[]): string[] {
    const best = Math.max(...finalScores.map(s => s.finalScore));
    return finalScores.filter(s => s.finalScore === best).map(s => s.playerId);
  }

  /**
   * Checks for score milestones for a player and returns potential new interactions.
   * This is typically called at the end of a player's turn or after a score change.
   */
  static checkScoreMilestones(game: Game, playerId: string): {
    updatedGame: Game;
    newInteraction?: InteractionState;
    historyEntries: HistoryEntry[];
    discoveryNotification?: { message: string };
    shouldStop: boolean; // true if an interaction was triggered and we should wait for the player
  } {
    let updatedGame = cloneGame(game);
    let player = updatedGame.players.find(p => p.id === playerId);
    if (!player) {
      return { updatedGame, historyEntries: [], shouldStop: false };
    }

    const historyEntries: HistoryEntry[] = [];
    let discoveryNotification: { message: string } | undefined;

    // 1. Golden Milestones (Objectives)
    for (const m of GOLDEN_MILESTONES) {
      if (player.score >= m && !player.claimedGoldenMilestones.includes(m)) {
        return {
          updatedGame: game, // Return original game state, no changes made yet
          newInteraction: { type: 'PLACING_OBJECTIVE_MARKER', milestone: m },
          historyEntries: [],
          shouldStop: true,
        };
      }
    }

    // 2. Neutral Milestones (2-3 player games)
    const neutralMilestonesToCheck = updatedGame.players.length < 4 ? NEUTRAL_MILESTONES : [];
    for (const m of neutralMilestonesToCheck) {
      if (player.score >= m && !player.claimedNeutralMilestones.includes(m)) {
        player.claimedNeutralMilestones.push(m);

        const result = SpeciesSystem.placeNeutralMilestone(updatedGame, m);
        updatedGame = result.updatedGame;
        // La découverte est signalée par discoveryNotification : l'indicateur ne doit pas rester actif
        updatedGame.isSpeciesDiscovered = false;
        // Nouvelle copie de la partie : reprendre le joueur pour que les modifications suivantes y soient appliquées
        player = updatedGame.players.find(p => p.id === playerId)!;
        const sequenceId = `neutral-${Date.now()}`;

        if (result.code === 'PLACED' || result.code === 'DISCOVERED') {
          const { color } = result.data!;
          historyEntries.push({ message: `a atteint le palier neutre ${m} PV ce qui place une trace de vie ${color} sur le plateau Alien.`, playerId, sequenceId });

          let message = `Palier ${m} PV : Trace de vie ${color} placée`;

          if (result.code === 'DISCOVERED') {
            message += " - Espèce découverte !";
            historyEntries.push({ message: `déclenche la découverte d'une nouvelle espèce Alien !`, playerId, sequenceId });
            if (result.logs) {
              result.logs.forEach(log => historyEntries.push({ message: log, playerId, sequenceId }));
            }
          }
          discoveryNotification = { message };
        } else if (result.code === 'NO_SPACE') {
          historyEntries.push({ message: `a atteint le palier neutre ${m} PV mais aucun emplacement libre sur les plateaux Alien.`, playerId, sequenceId });
        }
      }
    }

    // 3. Paliers Centauriens atteints (ils restent sur la piste de score avec la récompense obtenue)
    let marker = SpeciesSystem.reachedCentaurienMarker(player);
    while (marker) {
      if (marker.cardId) {
        // Réception d'une carte : son effet est appliqué, sans choix de tuile Message
        const reception = SpeciesSystem.receiveCentaurienCard(updatedGame, playerId, marker.id);
        updatedGame = reception.updatedGame;
        player = updatedGame.players.find(p => p.id === playerId)!;
        historyEntries.push(...reception.historyEntries);
        if (reception.newPendingInteractions.length > 0) {
          return { updatedGame, newInteraction: reception.newPendingInteractions[0], historyEntries, discoveryNotification, shouldStop: true };
        }
      } else {
        const centaurienSpecies = updatedGame.species.find(s => s.name === AlienBoardType.CENTAURIENS);
        if (centaurienSpecies?.message?.some(m => m.isAvailable)) {
          historyEntries.push({ message: `atteint son palier de message Centaurien et choisit une tuile Message.`, playerId });
          return {
            updatedGame,
            newInteraction: { type: 'CHOOSING_CENTAURIEN_REWARD', markerId: marker.id },
            historyEntries,
            discoveryNotification,
            shouldStop: true,
          };
        }
        marker.resolved = 'Message décodé : plus aucune tuile Message disponible';
      }
      marker = SpeciesSystem.reachedCentaurienMarker(player);
    }

    // 4. Exertien Milestone (chaque joueur utilise chaque palier une seule fois)
    const claimedExertien = player.claimedExertienMilestones || [];
    const exertienMilestone = updatedGame.exertienMilestones?.find(m => player.score >= m && !claimedExertien.includes(m));
    if (exertienMilestone !== undefined) {
      if (player.cards.some(c => c.type === CardType.EXERTIEN)) {
        historyEntries.push({ message: `a atteint un palier Exertien et peut jouer une carte.`, playerId });
        return {
          updatedGame,
          newInteraction: { type: 'CHOOSING_EXERTIEN_CARD', milestone: exertienMilestone },
          historyEntries,
          discoveryNotification,
          shouldStop: true,
        };
      }
      // Aucune carte Exertien à jouer : le palier est consommé pour ne pas se redéclencher
      player.claimedExertienMilestones = [...claimedExertien, exertienMilestone];
    }

    return { updatedGame, historyEntries, discoveryNotification, shouldStop: false };
  }

  /**
   * Places an objective marker on a tile for a player who reached a milestone.
   */
  static placeObjectiveMarker(game: Game, playerId: string, tileId: string, milestone: number): {
    updatedGame: Game;
    success: boolean;
    error?: string;
    logMessage?: string;
  } {
    const updatedGame = cloneGame(game);
    const tile = updatedGame.board.objectiveTiles.find(t => t.id === tileId);
    const player = updatedGame.players.find(p => p.id === playerId);

    if (!tile || !player) {
      return { updatedGame: game, success: false, error: "Objectif ou joueur introuvable." };
    }

    if (tile.markers.includes(playerId)) {
      return { updatedGame: game, success: false, error: "Emplacement déjà occupé. Sélectionnez un autre objectif." };
    }

    tile.markers.push(playerId);
    player.claimedGoldenMilestones.push(milestone);

    return {
        updatedGame,
        success: true,
        logMessage: `a atteint le palier objectif ${milestone} PV et place un marqueur sur "${tile.name}" (Points fin de partie)`
    };
  }
}
