import { effectNumber, effectAmount } from '../core/cardEffects';
import { Game, Card, ProbeState, FreeActionType, Bonus, GAME_CONSTANTS, RevenueType, InteractionState, LifeTraceType, Player, CardEffect, SectorType, SectorNumber, TechnologyCategory, CelestialObject } from '../core/types';
import { createRotationState, calculateAbsolutePosition, getCell, getAdjacentCells, getObjectPosition, getAllCelestialObjects, getAbsoluteSectorForProbe, RotationState } from '../core/SolarSystemPosition';
import { ResourceSystem } from './ResourceSystem';

/** Carte 108 (SETI@home) : Médias nécessaires pour marquer la trace de vie */
const LIFETRACE_MEDIA_THRESHOLD = 8;

/**
 * État partagé par les effets d'une carte jouée (CardSystem.playCard) : la partie est déjà une copie,
 * les effets la modifient directement et cumulent leurs gains dans `bonuses` (traités ensuite par
 * ResourceSystem.processBonuses).
 */
export interface PlayCardContext {
  game: Game;
  player: Player;
  card: Card;
  bonuses: Bonus;
  /** Interactions créées directement par un effet (ex: trace de vie limitée à certains plateaux) */
  extraInteractions: InteractionState[];
  /** Noms des cartes de la rangée prises en main (ET.16) */
  takenRowCards: string[];
}

/** Couleur de trace de vie d'un paramètre de carte (red, yellow, blue ; sinon n'importe laquelle) */
export function lifeTraceColor(target?: string): LifeTraceType {
  if (target === 'red') return LifeTraceType.RED;
  if (target === 'yellow') return LifeTraceType.YELLOW;
  if (target === 'blue') return LifeTraceType.BLUE;
  return LifeTraceType.ANY;
}

function add(bonuses: Bonus, key: 'credits' | 'energy' | 'card' | 'probe' | 'token' | 'anycard' | 'rotation' | 'orbiting' | 'landing' | 'movements' | 'scan' | 'pv' | 'data' | 'media', amount: number): void {
  bonuses[key] = (bonuses[key] || 0) + amount;
}

function rotationOf(game: Game): RotationState {
  const solarSystem = game.board.solarSystem;
  return createRotationState(solarSystem.rotationAngleLevel1 || 0, solarSystem.rotationAngleLevel2 || 0, solarSystem.rotationAngleLevel3 || 0);
}

function anomaliesOf(game: Game): CelestialObject[] {
  return (game.board.solarSystem.extraCelestialObjects || []).filter(o => o.type === 'anomaly');
}

// --- Effets immédiats (colonne Gain) ---------------------------------------------------------

const IMMEDIATE_GAINS: Record<string, (bonuses: Bonus, effect: CardEffect) => void> = {
  'GAIN:CREDIT': (b, e) => add(b, 'credits', effectNumber(e)),
  'GAIN:ENERGY': (b, e) => add(b, 'energy', effectNumber(e)),
  'GAIN:DATA': (b, e) => { b.data = Math.min((b.data || 0) + effectNumber(e), GAME_CONSTANTS.MAX_DATA); },
  'GAIN:MEDIA': (b, e) => { b.media = Math.min((b.media || 0) + effectNumber(e), GAME_CONSTANTS.MAX_MEDIA_COVERAGE); },
  'GAIN:CARD': (b, e) => add(b, 'card', effectNumber(e)),
  'GAIN:PROBE': (b, e) => add(b, 'probe', effectNumber(e)),
  'GAIN:TOKEN': (b, e) => add(b, 'token', effectNumber(e)),
  'ACTION:ANYCARD': (b, e) => add(b, 'anycard', effectNumber(e)),
  'ACTION:ROTATION': (b, e) => add(b, 'rotation', effectNumber(e)),
  'ACTION:ORBIT': (b, e) => add(b, 'orbiting', effectNumber(e)),
  'ACTION:LAND': (b, e) => add(b, 'landing', effectNumber(e)),
  'ACTION:MOVEMENT': (b, e) => add(b, 'movements', effectNumber(e)),
  'ACTION:SCAN': (b, e) => add(b, 'scan', effectNumber(e)),
  'ACTION:TECH': (b, e) => { (b.technologies ??= []).push(effectAmount<TechnologyCategory>(e)); },
  'ACTION:SIGNAL': (b, e) => { (b.signals ??= []).push(effectAmount<SectorType>(e)); },
  'ACTION:LIFETRACE': (b, e) => { (b.lifetraces ??= []).push(effectAmount<LifeTraceType>(e)); },
};

/** Cumule dans `bonuses` les gains immédiats d'une carte (GAIN et ACTION). */
export function addImmediateEffects(effects: CardEffect[] | undefined, bonuses: Bonus): void {
  (effects || []).forEach(effect => IMMEDIATE_GAINS[`${effect.type}:${effect.target}`]?.(bonuses, effect));
}

// --- Effets passifs (colonne Contrainte) -----------------------------------------------------

type PassiveHandler = (ctx: PlayCardContext, effect: CardEffect) => void;

/** Effets qui restent actifs pour le reste du tour (ou de la partie) : ajoutés aux buffs du joueur */
const BUFF_EFFECTS = [
  'VISIT_UNIQUE', 'ASTEROID_EXIT_COST', 'VISIT_ASTEROID', 'VISIT_COMET', 'SAME_DISK_MOVE',
  'SCORE_PER_TECH_TYPE', 'MEDIA_IF_SHARED_TECH', 'CHOICE_MEDIA_OR_MOVE', 'BONUS_IF_COVERED',
  'SCORE_IF_UNIQUE', 'SCORE_PER_SECTOR', 'NO_MEDIA',
  // Carte 75 : les PV dépendent de la couleur de la trace gagnée, appliqués au placement (SpeciesSystem.placeLifeTrace)
  'SCORE_PER_TRACE',
];

/** Effets qui modifient seulement les gains en cours (options de processBonuses) */
const FLAG_EFFECTS: Record<string, (bonuses: Bonus, effect: CardEffect) => void> = {
  'REVEAL_AND_TRIGGER_FREE_ACTION': b => { b.revealAndTriggerFreeAction = true; },
  'SCORE_PER_MEDIA': (b, e) => { b.scorePerMedia = effectNumber(e); },
  'SHARED_TECH_ONLY_NO_BONUS': b => { b.sharedOnly = true; b.noTileBonus = true; },
  'IGNORE_PROBE_LIMIT': b => { b.ignoreProbeLimit = true; },
  'ATMOSPHERIC_ENTRY': b => { b.atmosphericEntry = true; },
  'SAMPLE_RETURN': b => { b.sampleReturn = true; },
  'GAIN_SIGNAL_FROM_HAND': (b, e) => { b.gainSignalFromHand = effectNumber(e); },
  'KEEP_CARD_IF_ONLY': b => { b.keepCardIfOnly = true; },
  'NO_DATA': b => { b.noData = true; },
  'ANY_PROBE': b => { b.anyProbe = true; },
  'GAIN_SIGNAL_ADJACENTS': b => { b.gainSignalAdjacents = true; },
  'IGNORE_SATELLITE_LIMIT': b => { b.ignoreSatelliteLimit = true; },
  'GAIN_LANDING_AND_SPECIMEN': b => { add(b, 'landing', 1); b.collectSpecimen = true; },
  'GAIN_SATELLITE_LANDING_AND_SPECIMEN': b => { add(b, 'landing', 1); b.ignoreSatelliteLimit = true; b.collectSpecimen = true; },
  'GAIN_ORBIT_OR_LAND_AND_SPECIMEN': b => { b.orbitOrLandAndSpecimen = true; b.collectSpecimen = true; },
  'GAIN_SPECIMEN_BONUS': b => { b.consultSpecimen = true; },
};

const PASSIVE_HANDLERS: Record<string, PassiveHandler> = {
  'VISIT_BONUS': ({ player, card, bonuses }, effect) => {
    if (!effect.target) return;
    // Si la planète a DÉJÀ été visitée ce tour-ci, le bonus s'applique immédiatement (PV ajoutés par
    // processBonuses), sinon pour le reste du tour
    if (player.visitedPlanetsThisTurn.includes(effect.target)) {
      add(bonuses, 'pv', effectNumber(effect));
    } else {
      player.activeBuffs.push({ ...effect, source: card.name });
    }
  },

  'GAIN_LIFETRACE_IF_ASTEROID': ({ game, player, bonuses }, effect) => {
    const rotationState = rotationOf(game);
    const hasProbeOnAsteroid = player.probes.some(p => {
      if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
      const absSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
      return getCell(p.solarPosition.disk, absSector, rotationState, game.board.solarSystem.extraCelestialObjects)?.hasAsteroid;
    });
    if (hasProbeOnAsteroid) (bonuses.lifetraces ??= []).push({ amount: effectNumber(effect), scope: lifeTraceColor(effect.target) });
  },

  // Cartes 98 à 100 : une trace de cette couleur pour une espèce où le joueur en a déjà marqué une
  'GAIN_LIFETRACE_IF_ALREADY': ({ game, player, extraInteractions }, effect) => {
    const color = lifeTraceColor(effect.target);
    const boardIndices = game.board.alienBoards
      .map((board, index) => board.lifeTraces.some(t => t.playerId === player.id && t.type === color) ? index : -1)
      .filter(index => index !== -1);
    if (boardIndices.length > 0) {
      for (let i = 0; i < effectNumber(effect); i++) extraInteractions.push({ type: 'PLACING_LIFE_TRACE', color, boardIndices });
    }
  },

  // Carte 108 (SETI@home) : trace de vie si le joueur a au moins 8 Médias
  'GAIN_LIFETRACE_IF_MEDIA': ({ player, bonuses }, effect) => {
    if (player.mediaCoverage >= LIFETRACE_MEDIA_THRESHOLD) {
      (bonuses.lifetraces ??= []).push({ amount: effectNumber(effect), scope: lifeTraceColor(effect.target) });
    }
  },

  // ET.16 : les cartes de la rangée vont dans la main (la rangée est ensuite complétée)
  'TAKE_CARD_ROW': ({ game, player, takenRowCards }) => {
    const taken = game.decks.cardRow.splice(0);
    player.cards.push(...taken);
    takenRowCards.push(...taken.map(c => c.name));
  },

  'GAIN_ENERGY_PER_ENERGY_REVENUE': ({ player, bonuses }) => {
    const revealed = player.cards.filter(c => c.revenue === RevenueType.ENERGY);
    revealed.forEach(c => { c.isRevealed = true; });
    if (revealed.length > 0) add(bonuses, 'energy', revealed.length);
  },

  'REVEAL_MOVEMENT_CARDS_FOR_BONUS': ({ player, bonuses }) => {
    const revealed = player.cards.filter(c => c.freeAction === FreeActionType.MOVEMENT);
    revealed.forEach(c => { c.isRevealed = true; });
    if (revealed.length > 0) add(bonuses, 'movements', revealed.length);
  },

  // Carte 91 : la carte est réservée sous les revenus Energie (gain immédiat : 1 Energie)
  'GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE': ({ player, bonuses }) => {
    const energyRevCards = player.revenueEnergy - GAME_CONSTANTS.INITIAL_REVENUE_ENERGY;
    if (energyRevCards > 0) add(bonuses, 'energy', energyRevCards);
    player.revenueEnergy += 1;
    add(bonuses, 'energy', 1);
  },

  // Carte 92 : la carte est réservée sous les revenus Pioche (gain immédiat : 1 carte, piochée par processBonuses)
  'GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE': ({ player, bonuses }) => {
    const cardRevCards = player.revenueCards - GAME_CONSTANTS.INITIAL_REVENUE_CARDS;
    if (cardRevCards > 0) add(bonuses, 'media', cardRevCards);
    player.revenueCards += 1;
    add(bonuses, 'card', 1);
  },

  // Carte 93 : la carte est réservée sous les revenus Crédit (gain immédiat : 1 Crédit)
  'GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE': ({ player, bonuses }) => {
    const creditRevCards = player.revenueCredits - GAME_CONSTANTS.INITIAL_REVENUE_CREDITS;
    if (creditRevCards > 0) add(bonuses, 'pv', creditRevCards * 3);
    player.revenueCredits += 1;
    add(bonuses, 'credits', 1);
  },

  // 1 Déplacement par planète ou comète visible dans le secteur de la Terre
  'OPTIMAL_LAUNCH_WINDOW': ({ game, bonuses }) => {
    const rotationState = rotationOf(game);
    const extra = game.board.solarSystem.extraCelestialObjects;
    const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, extra);
    if (!earthPos) return;
    const movementBonus = getAllCelestialObjects(extra).filter(obj => {
      if (obj.id === 'earth' || (obj.type !== 'planet' && obj.type !== 'comet')) return false;
      const objPos = calculateAbsolutePosition(obj, rotationState, extra);
      return objPos.isVisible && objPos.absoluteSector === earthPos.absoluteSector;
    }).length;
    if (movementBonus > 0) add(bonuses, 'movements', movementBonus);
  },

  // Meilleure sonde : +2 Données sur un champ d'astéroïdes, +1 par champ adjacent
  'OSIRIS_REX_BONUS': ({ game, player, bonuses }) => {
    const rotationState = rotationOf(game);
    const extra = game.board.solarSystem.extraCelestialObjects;
    let maxDataBonus = 0;
    player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition).forEach(probe => {
      // Position absolue de la sonde (le type de l'objet ne compte pas pour ce calcul)
      const tempObj: CelestialObject = {
        id: probe.id,
        type: 'empty',
        name: 'probe',
        position: { disk: probe.solarPosition!.disk, sector: probe.solarPosition!.sector, x: 0, y: 0 },
        level: (probe.solarPosition!.level || 0) as 0 | 1 | 2 | 3,
      };
      const absPos = calculateAbsolutePosition(tempObj, rotationState, extra);
      let probeBonus = getCell(absPos.disk, absPos.absoluteSector, rotationState, extra)?.hasAsteroid ? 2 : 0;
      getAdjacentCells(absPos.disk, absPos.absoluteSector as SectorNumber).forEach(adj => {
        if (getCell(adj.disk, adj.sector, rotationState, extra)?.hasAsteroid) probeBonus += 1;
      });
      maxDataBonus = Math.max(maxDataBonus, probeBonus);
    });
    if (maxDataBonus > 0) add(bonuses, 'data', maxDataBonus);
  },

  // Les actions gratuites de toutes les cartes de la rangée, puis la rangée est défaussée
  'DISCARD_ROW_FOR_FREE_ACTIONS': ({ game, bonuses }) => {
    game.decks.cardRow.forEach(rowCard => {
      if (rowCard.freeAction === FreeActionType.MOVEMENT) add(bonuses, 'movements', 1);
      else if (rowCard.freeAction === FreeActionType.DATA) add(bonuses, 'data', 1);
      else if (rowCard.freeAction === FreeActionType.MEDIA) add(bonuses, 'media', 1);
    });
    game.decks.cardRow = [];
  },

  'SCORE_PER_LIFETRACE': ({ player, bonuses }, effect) => {
    const scope = lifeTraceColor(effect.target);
    const count = player.lifeTraces.filter(t => scope === LifeTraceType.ANY || t.type === scope).length;
    if (count > 0) add(bonuses, 'pv', count * effectNumber(effect));
  },

  // 1 Déplacement si la Terre est dans le secteur d'une anomalie
  'GAIN_MOVE_IF_ANOMALY': ({ game, bonuses }) => {
    const rotationState = rotationOf(game);
    const extra = game.board.solarSystem.extraCelestialObjects;
    const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, extra);
    if (!earthPos) return;
    const hasAnomaly = anomaliesOf(game).some(a => calculateAbsolutePosition(a, rotationState, extra).absoluteSector === earthPos.absoluteSector);
    if (hasAnomaly) add(bonuses, 'movements', 1);
  },

  // Récompense de la prochaine anomalie dans le sens des secteurs à partir de la Terre (une anomalie
  // sur le secteur de la Terre compte comme la plus lointaine)
  'GAIN_REWARD_NEXT_ANOMALY': ({ game, bonuses }) => {
    const rotationState = rotationOf(game);
    const extra = game.board.solarSystem.extraCelestialObjects;
    const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, extra);
    const anomalies = anomaliesOf(game);
    if (!earthPos || anomalies.length === 0) return;
    const next = anomalies
      .map(anomaly => {
        const dist = (calculateAbsolutePosition(anomaly, rotationState, extra).absoluteSector - earthPos.absoluteSector + 8) % 8;
        return { anomaly, dist: dist === 0 ? 8 : dist };
      })
      .sort((a, b) => a.dist - b.dist)[0].anomaly;
    if (next.anomalyData?.bonus) ResourceSystem.accumulateBonus(next.anomalyData.bonus, bonuses);
  },
};

/** PV par signal du joueur dans les secteurs des anomalies (SCORE_PER_ANOMALY…) */
const scorePerAnomaly: PassiveHandler = ({ game, player, bonuses }, effect) => {
  if (typeof effect.value !== 'number' || isNaN(effect.value)) return;
  const rotationState = rotationOf(game);
  const extra = game.board.solarSystem.extraCelestialObjects;
  const anomalySectors = new Set<number>(anomaliesOf(game).map(a => calculateAbsolutePosition(a, rotationState, extra).absoluteSector));
  let signalCount = 0;
  game.board.sectors.forEach(sector => {
    if (anomalySectors.has(parseInt(sector.id.replace('sector_', '')))) {
      signalCount += sector.signals.filter(s => s.markedBy === player.id).length;
    }
  });
  if (signalCount > 0) add(bonuses, 'pv', signalCount * effectNumber(effect));
};

/** Applique un effet passif d'une carte jouée (buff, option de gain ou gain conditionnel). */
export function applyPassiveEffect(ctx: PlayCardContext, effect: CardEffect): void {
  if (BUFF_EFFECTS.includes(effect.type)) {
    ctx.player.activeBuffs.push({ ...effect, source: ctx.card.name });
  } else if (FLAG_EFFECTS[effect.type]) {
    FLAG_EFFECTS[effect.type](ctx.bonuses, effect);
  } else if (PASSIVE_HANDLERS[effect.type]) {
    PASSIVE_HANDLERS[effect.type](ctx, effect);
  } else if (effect.type.startsWith('SCORE_PER_ANOMALY')) {
    scorePerAnomaly(ctx, effect);
  }
}
