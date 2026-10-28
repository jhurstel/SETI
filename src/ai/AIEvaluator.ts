import { Game, Player, ProbeState, DiskName, SectorNumber, LifeTraceType, CardType } from '../core/types';
import { ScoreManager } from '../core/ScoreManager';
import { ScanSystem } from '../systems/ScanSystem';
import { createRotationState, getAbsoluteSectorForProbe, getAllCells, calculateReachableCells, RotationState } from '../core/SolarSystemPosition';

/** Nombre maximal de déplacements explorés pour estimer la distance d'une sonde à une planète */
const MAX_PROBE_DISTANCE = 8;
const DISTANCE_CACHE_SIZE = 2000;
const distanceCache = new Map<string, number>();

/**
 * Poids de la fonction d'évaluation (en équivalent points de victoire).
 * Les ressources et le potentiel perdent leur valeur à mesure que la partie avance.
 * Réglés ensemble par parties entre robots Experts (SPSA, 30 itérations de 48 parties à 2 et 3 joueurs) :
 * contre les poids précédents, 60 victoires sur 96 et environ +9 PV en moyenne (± 3,9).
 */
export const DEFAULT_WEIGHTS = {
  credit: 0.96,
  energy: 0.82,
  media: 0.41,
  data: 0.45,
  card: 0.54,
  maxUsefulCards: 6,
  computerSlot: 0.44,
  signal: 0.36,
  lifeTrace: 1.93,
  technology: 2.11,
  probeInSystem: 1.48,
  probeOnPlanet: 3.71,
  probeStep: 0.72,
  capsule: 1.86,
  capsuleAtDestination: 2.8,
  capsuleStep: 0.75,
  orbiter: 3.75,
  lander: 4.28,
  openMission: 0.95,
  playedCard: 0.67,
  incomePerRound: 1.38,
  // 1re trace d'une couleur sur une espèce non découverte : carte Alien reçue à la découverte,
  // d'autant plus probable que les 3 couleurs sont déjà présentes
  discoveryClaim: 3.2,
  // Carte Alien en main : plus forte qu'une carte normale (en plus de la valeur d'une carte)
  alienCard: 0.99,
  // Secteur où le joueur a la majorité : part du bonus de couverture (PV, traces de vie) comptée,
  // multipliée par le remplissage du secteur (un secteur presque plein sera bientôt couvert)
  sectorLead: 0.64,
  // Valeur en PV d'une trace de vie gagnée en couvrant un secteur (pour estimer son bonus)
  sectorLifeTraceValue: 2.66,
  // Robot Expert : part des points du décompte final déjà acquis (tuiles objectif, cartes Fin de partie,
  // cartes Exertiens), partielle avant la dernière manche : ce n'est qu'une projection
  endGameBefore: 0.19,
  endGameLastRound: 1,
  // Pendant la dernière manche, les ressources et le potentiel ne valent plus que cette part
  lastRoundFactor: 0.27,
  // Gain minimal (en PV) pour qu'un robot stratégique joue une action gratuite facultative
  freeActionMinGain: 0.22,
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

  /** Poids utilisés pour un joueur : les siens s'il en a reçu (réglage), sinon DEFAULT_WEIGHTS */
  static weightsFor(playerId: string): EvaluatorWeights {
    return this.weightOverrides.get(playerId) ?? DEFAULT_WEIGHTS;
  }

  static evaluate(game: Game, playerId: string): number {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return 0;
    const w = this.weightsFor(playerId);

    // Valeur du potentiel : pleine jusqu'à l'avant-dernière manche, réduite pendant la dernière
    const remainingRounds = Math.max(0, game.maxRounds - game.currentRound);
    const futureFactor = remainingRounds >= 1 ? 1 : w.lastRoundFactor;

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

    // Signaux posés (un secteur couvert se remplit à nouveau : ses signaux comptent aussi)
    const signals = game.board.sectors
      .reduce((count, s) => count + s.signals.filter(sig => sig.marked && sig.markedBy === player.id).length, 0);
    value += signals * w.signal;
    value += this.sectorProspects(game, player.id, w);

    value += player.lifeTraces.length * w.lifeTrace;
    value += this.discoveryClaims(game, player.id) * w.discoveryClaim;
    value += player.cards.filter(c => c.id.startsWith('ET.') && c.type !== CardType.EXERTIEN).length * w.alienCard;
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
   * Secteurs en cours de remplissage : le joueur présent gagnera 1 Média à la couverture, et le joueur
   * majoritaire le bonus du secteur (PV, traces de vie). Valeur proportionnelle au remplissage du secteur.
   */
  private static sectorProspects(game: Game, playerId: string, w: EvaluatorWeights): number {
    let value = 0;
    for (const sector of game.board.sectors) {
      const marked = sector.signals.filter(s => s.marked).length;
      if (marked === 0 || !sector.signals.some(s => s.markedBy === playerId)) continue;
      const fill = marked / sector.signals.length;
      value += fill * w.media;
      if (ScanSystem.calculateMajorities(sector)[0]?.playerId === playerId) {
        const bonus = sector.isCovered ? sector.nextBonus : sector.firstBonus;
        const lifeTraces = (bonus.lifetraces || []).reduce((n, t) => n + t.amount, 0);
        value += fill * w.sectorLead * ((bonus.pv || 0) + lifeTraces * w.sectorLifeTraceValue);
      }
    }
    return value;
  }

  /**
   * Cartes Alien promises : pour chaque espèce non découverte, chaque couleur dont le joueur a posé la 1re trace,
   * pondérée par l'avancement de la découverte (couleurs présentes / 3)
   */
  private static discoveryClaims(game: Game, playerId: string): number {
    const colors = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE];
    return game.board.alienBoards
      .filter(board => !board.isDiscovered)
      .reduce((sum, board) => {
        const firsts = colors.map(c => board.lifeTraces.find(t => t.type === c));
        const progress = firsts.filter(Boolean).length / colors.length;
        return sum + firsts.filter(t => t?.playerId === playerId).length * progress;
      }, 0);
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
