import { Game, Player, ProbeState, DiskName, SectorNumber } from '../core/types';
import { ScoreManager } from '../core/ScoreManager';
import { createRotationState, getAbsoluteSectorForProbe, getAllCells, calculateReachableCells, RotationState } from '../core/SolarSystemPosition';

/** Nombre maximal de déplacements explorés pour estimer la distance d'une sonde à une planète */
const MAX_PROBE_DISTANCE = 8;
const DISTANCE_CACHE_SIZE = 2000;
const distanceCache = new Map<string, number>();

/**
 * Poids de la fonction d'évaluation (en équivalent points de victoire).
 * Les ressources et le potentiel perdent leur valeur à mesure que la partie avance.
 * Réglés par parties entre robots Experts (SPSA, 12 itérations de 48 parties) : contre les poids
 * précédents, 57 victoires sur 96 et environ +10 PV en moyenne.
 */
export const DEFAULT_WEIGHTS = {
  credit: 0.86,
  energy: 0.54,
  media: 0.45,
  data: 0.52,
  card: 0.65,
  maxUsefulCards: 6,
  computerSlot: 0.5,
  signal: 0.5,
  lifeTrace: 1.45,
  technology: 2.31,
  probeInSystem: 1.17,
  probeOnPlanet: 4.33,
  probeStep: 0.42,
  capsule: 1.42,
  capsuleAtDestination: 4.08,
  capsuleStep: 0.49,
  orbiter: 3.79,
  lander: 4.95,
  openMission: 1.24,
  playedCard: 0.91,
  incomePerRound: 1.09,
  // Robot Expert : part des points du décompte final déjà acquis (tuiles objectif, cartes Fin de partie,
  // cartes Exertiens), partielle avant la dernière manche : ce n'est qu'une projection
  endGameBefore: 0.38,
  endGameLastRound: 1,
};

export type EvaluatorWeights = typeof DEFAULT_WEIGHTS;

/**
 * Évaluation heuristique d'une position du point de vue d'un joueur.
 * Pure et sans effet de bord : sert à comparer les états obtenus en simulant chaque choix possible.
 */
export class AIEvaluator {
  /**
   * Poids propres à certains joueurs (par identifiant), à la place de DEFAULT_WEIGHTS.
   * Sert au réglage des poids par parties entre robots ; vide en jeu.
   */
  static weightOverrides = new Map<string, EvaluatorWeights>();

  static evaluate(game: Game, playerId: string): number {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return 0;
    const w = this.weightOverrides.get(playerId) ?? DEFAULT_WEIGHTS;

    // Valeur du potentiel : pleine jusqu'à l'avant-dernière manche, réduite pendant la dernière
    const remainingRounds = Math.max(0, game.maxRounds - game.currentRound);
    const futureFactor = remainingRounds >= 1 ? 1 : 0.3;

    let value = player.score;
    value += futureFactor * this.resourceValue(player, w);
    value += futureFactor * this.boardValue(game, player, w);
    value += remainingRounds * w.incomePerRound * (player.revenueCredits * w.credit + player.revenueEnergy * w.energy + player.revenueCards * w.card);

    // Le décompte final se calcule une seule fois, en fin de partie : l'Expert l'anticipe
    if (player.aiDifficulty === 'EXPERT' && !game.finalScores) {
      const weight = remainingRounds >= 1 ? w.endGameBefore : w.endGameLastRound;
      value += weight * ScoreManager.calculateFinalScore(game, playerId).total;
    }
    return value;
  }

  private static resourceValue(player: Player, w: EvaluatorWeights): number {
    const handSize = player.cards.length;
    return player.credits * w.credit
      + player.energy * w.energy
      + player.mediaCoverage * w.media
      + player.data * w.data
      + Math.min(handSize, w.maxUsefulCards) * w.card;
  }

  private static boardValue(game: Game, player: Player, w: EvaluatorWeights): number {
    let value = 0;

    const filledSlots = Object.values(player.dataComputer.slots).filter(s => s.filled).length;
    value += filledSlots * w.computerSlot;

    const signals = game.board.sectors
      .filter(s => !s.isCovered)
      .reduce((count, s) => count + s.signals.filter(sig => sig.marked && sig.markedBy === player.id).length, 0);
    value += signals * w.signal;

    value += player.lifeTraces.length * w.lifeTrace;
    value += player.technologies.length * w.technology;
    value += player.missions.filter(m => !m.completed).length * w.openMission;
    value += player.playedCards.length * w.playedCard;

    value += player.probes.filter(p => p.state === ProbeState.IN_ORBIT).length * w.orbiter;
    value += player.probes.filter(p => p.state === ProbeState.LANDED).length * w.lander;

    const probesInSystem = player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition);
    if (probesInSystem.length > 0) {
      const solarSystem = game.board.solarSystem;
      const rotationState = createRotationState(solarSystem.rotationAngleLevel1 || 0, solarSystem.rotationAngleLevel2 || 0, solarSystem.rotationAngleLevel3 || 0);
      const extraObjects = solarSystem.extraCelestialObjects || [];
      for (const probe of probesInSystem) {
        const distance = this.distanceToPlanet(probe.solarPosition.disk, getAbsoluteSectorForProbe(probe.solarPosition, rotationState), rotationState, extraObjects);
        // Une sonde vaut davantage à mesure qu'elle s'approche d'une planète où se mettre en orbite ou atterrir
        value += w.probeInSystem + Math.max(0, (w.probeOnPlanet - w.probeInSystem) - distance * w.probeStep);
      }
    }

    // Capsules : un spécimen vaut d'autant plus qu'il approche de sa destination (Terre, ou Mars pour le Laboratoire Martien)
    const capsules = player.probes.filter(p => p.state === ProbeState.CAPSULE && p.solarPosition);
    if (capsules.length > 0) {
      const solarSystem = game.board.solarSystem;
      const rotationState = createRotationState(solarSystem.rotationAngleLevel1 || 0, solarSystem.rotationAngleLevel2 || 0, solarSystem.rotationAngleLevel3 || 0);
      const extraObjects = solarSystem.extraCelestialObjects || [];
      const destinations = player.missions.some(m => !m.completed && m.requirements.some(r => r.type === 'GAIN_IF_SPECIMEN' && r.target === 'mars')) ? ['earth', 'mars'] : ['earth'];
      for (const capsule of capsules) {
        const absSector = getAbsoluteSectorForProbe(capsule.solarPosition, rotationState);
        const distance = Math.min(...destinations.map(d => this.distanceToPlanet(capsule.solarPosition.disk, absSector, rotationState, extraObjects, d)));
        value += w.capsule + Math.max(0, (w.capsuleAtDestination - w.capsule) - distance * w.capsuleStep);
      }
    }

    return value;
  }

  /**
   * Nombre de déplacements jusqu'à une planète : la plus proche hors Terre par défaut, ou une planète donnée
   * (mis en cache : ne dépend que du plateau)
   */
  static distanceToPlanet(disk: DiskName, absoluteSector: SectorNumber, rotationState: RotationState, extraObjects: Game['board']['solarSystem']['extraCelestialObjects'] = [], targetPlanetId?: string): number {
    const key = `${targetPlanetId ?? '*'}/${rotationState.level1Angle}/${rotationState.level2Angle}/${rotationState.level3Angle}/${extraObjects.map(o => `${o.id}:${o.position.disk}${o.position.sector}:${o.level ?? 0}`).join(',')}/${disk}${absoluteSector}`;
    const cached = distanceCache.get(key);
    if (cached !== undefined) return cached;
    if (distanceCache.size > DISTANCE_CACHE_SIZE) distanceCache.clear();

    const cells = getAllCells(rotationState, extraObjects);
    const reachable = calculateReachableCells(disk, absoluteSector, MAX_PROBE_DISTANCE, rotationState, false, undefined, extraObjects);
    let best = MAX_PROBE_DISTANCE + 1;
    reachable.forEach((info, key) => {
      const cell = cells.get(key);
      const isTarget = targetPlanetId ? cell?.planetId === targetPlanetId : cell?.hasPlanet && cell.planetId !== 'earth';
      if (isTarget && info.movements < best) best = info.movements;
    });
    distanceCache.set(key, best);
    return best;
  }
}
