import { Game, Player, ProbeState, DiskName, SectorNumber } from '../core/types';
import { createRotationState, getAbsoluteSectorForProbe, getAllCells, calculateReachableCells, RotationState } from '../core/SolarSystemPosition';

/** Nombre maximal de déplacements explorés pour estimer la distance d'une sonde à une planète */
const MAX_PROBE_DISTANCE = 8;
const DISTANCE_CACHE_SIZE = 2000;
const distanceCache = new Map<string, number>();

/**
 * Poids de la fonction d'évaluation (en équivalent points de victoire).
 * Les ressources et le potentiel perdent leur valeur à mesure que la partie avance.
 */
const WEIGHTS = {
  credit: 0.7,
  energy: 0.6,
  media: 0.35,
  data: 0.5,
  card: 1.1,
  maxUsefulCards: 6,
  computerSlot: 0.6,
  signal: 0.7,
  lifeTrace: 2,
  technology: 2.5,
  probeInSystem: 1.5,
  probeOnPlanet: 3.5,
  probeStep: 0.45,
  capsule: 1.5,
  capsuleAtDestination: 5,
  capsuleStep: 0.5,
  orbiter: 3,
  lander: 4,
  openMission: 1.5,
  playedCard: 1,
  incomePerRound: 0.8,
};

/**
 * Évaluation heuristique d'une position du point de vue d'un joueur.
 * Pure et sans effet de bord : sert à comparer les états obtenus en simulant chaque choix possible.
 */
export class AIEvaluator {
  static evaluate(game: Game, playerId: string): number {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return 0;

    // Valeur du potentiel : pleine jusqu'à l'avant-dernière manche, réduite pendant la dernière
    const remainingRounds = Math.max(0, game.maxRounds - game.currentRound);
    const futureFactor = remainingRounds >= 1 ? 1 : 0.3;

    let value = player.score;
    value += futureFactor * this.resourceValue(player);
    value += futureFactor * this.boardValue(game, player);
    value += remainingRounds * WEIGHTS.incomePerRound * (player.revenueCredits * WEIGHTS.credit + player.revenueEnergy * WEIGHTS.energy + player.revenueCards * WEIGHTS.card);
    return value;
  }

  private static resourceValue(player: Player): number {
    const handSize = player.cards.length;
    return player.credits * WEIGHTS.credit
      + player.energy * WEIGHTS.energy
      + player.mediaCoverage * WEIGHTS.media
      + player.data * WEIGHTS.data
      + Math.min(handSize, WEIGHTS.maxUsefulCards) * WEIGHTS.card;
  }

  private static boardValue(game: Game, player: Player): number {
    let value = 0;

    const filledSlots = Object.values(player.dataComputer.slots).filter(s => s.filled).length;
    value += filledSlots * WEIGHTS.computerSlot;

    const signals = game.board.sectors
      .filter(s => !s.isCovered)
      .reduce((count, s) => count + s.signals.filter(sig => sig.marked && sig.markedBy === player.id).length, 0);
    value += signals * WEIGHTS.signal;

    value += player.lifeTraces.length * WEIGHTS.lifeTrace;
    value += player.technologies.length * WEIGHTS.technology;
    value += player.missions.filter(m => !m.completed).length * WEIGHTS.openMission;
    value += player.playedCards.length * WEIGHTS.playedCard;

    value += player.probes.filter(p => p.state === ProbeState.IN_ORBIT).length * WEIGHTS.orbiter;
    value += player.probes.filter(p => p.state === ProbeState.LANDED).length * WEIGHTS.lander;

    const probesInSystem = player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition);
    if (probesInSystem.length > 0) {
      const solarSystem = game.board.solarSystem;
      const rotationState = createRotationState(solarSystem.rotationAngleLevel1 || 0, solarSystem.rotationAngleLevel2 || 0, solarSystem.rotationAngleLevel3 || 0);
      const extraObjects = solarSystem.extraCelestialObjects || [];
      for (const probe of probesInSystem) {
        const distance = this.distanceToPlanet(probe.solarPosition.disk, getAbsoluteSectorForProbe(probe.solarPosition, rotationState), rotationState, extraObjects);
        // Une sonde vaut davantage à mesure qu'elle s'approche d'une planète où se mettre en orbite ou atterrir
        value += WEIGHTS.probeInSystem + Math.max(0, (WEIGHTS.probeOnPlanet - WEIGHTS.probeInSystem) - distance * WEIGHTS.probeStep);
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
        value += WEIGHTS.capsule + Math.max(0, (WEIGHTS.capsuleAtDestination - WEIGHTS.capsule) - distance * WEIGHTS.capsuleStep);
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
