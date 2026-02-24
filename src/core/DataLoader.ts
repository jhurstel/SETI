import { Card, CardType, FreeActionType, SectorType, RevenueType, CardEffect, TechnologyCategory, LifeTraceType, CostType } from './types';

export class DataLoader {
  /**
   * Charge et parse un fichier CSV de cartes depuis une URL/chemin
   */
  static async loadCards(path: string): Promise<Card[]> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Erreur lors du chargement de ${path}: ${response.statusText}`);
      }
      const csvContent = await response.text();
      return this.parseCSV(csvContent);
    } catch (error) {
      console.error(`Impossible de charger les cartes depuis ${path}`, error);
      return [];
    }
  }

  /**
   * Parse le contenu CSV pour créer des cartes
   */
  private static parseCSV(csvContent: string): Card[] {
    const cards: Card[] = [];
    const lines = csvContent.split('\n');

    // Ignorer l'en-tête si présent
    const startIndex = lines.length > 0 && lines[0].toLowerCase().startsWith('id') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Séparation par virgule (gestion simple)
      const columns = line.split(';');

      const [id, nom, type, texte, actionGratuite, couleurScan, revenue, cout, gain, contrainte] = columns;

      let cost = 0;
      let costType = CostType.CREDIT;
      const costStr = cout.trim().toLowerCase();
      if (costStr.includes('energie') || costStr.includes('energy')) {
        costType = CostType.ENERGY;
        cost = parseInt(costStr.replace(/[^0-9]/g, ''), 10) || 0;
      } else {
        cost = parseInt(costStr, 10) || 0;
      }

      cards.push({
        id: id.trim(),
        name: nom.trim(),
        description: texte.trim(),
        type: this.mapCardType(type.trim()),
        cost: cost,
        costType: costType,
        freeAction: this.mapFreeActionType(actionGratuite.trim()),
        scanSector: this.mapSectorType(couleurScan.trim()),
        revenue: this.mapRevenueType(revenue.trim()),
        immediateEffects: this.parseImmediateEffects(gain.trim()),
        passiveEffects: this.parsePassiveEffects(contrainte.trim()),
        permanentEffects: this.parsePermanentEffects(contrainte.trim())
      });
    }
    return cards;
  }

  private static mapCardType(value: string): CardType {
    const v = value.toLowerCase();
    if (v.includes('action')) return CardType.ACTION;
    if (v.includes('conditionnelle')) return CardType.CONDITIONAL_MISSION;
    if (v.includes('déclenchable')) return CardType.TRIGGERED_MISSION;
    if (v.includes('fin')) return CardType.END_GAME;
    if (v.includes('exertien')) return CardType.EXERTIEN;
    if (v.includes('centaurien')) return CardType.CENTAURIEN;
    return CardType.UNDEFINED; // Valeur par défaut
  }

  private static mapFreeActionType(value: string): FreeActionType {
    const v = value.toLowerCase();
    if (v.includes('1 pv + 1 déplacement') || v.includes('1pv + 1 déplacement') || v.includes('1 pv + 1 deplacement')) return FreeActionType.PV_MOVEMENT;
    if (v.includes('1 pv + 1 donnée') || v.includes('1pv + 1 donnée') || v.includes('1 pv + 1 data')) return FreeActionType.PV_DATA;
    if (v.includes('2 médias') || v.includes('2 medias') || v.includes('2 média')) return FreeActionType.TWO_MEDIA;
    if (v.includes('déplacement') || v.includes('movement')) return FreeActionType.MOVEMENT;
    if (v.includes('donnée') || v.includes('data')) return FreeActionType.DATA;
    if (v.includes('média') || v.includes('media')) return FreeActionType.MEDIA;
    return FreeActionType.UNDEFINED; // Valeur par défaut
  }

  private static mapSectorType(value: string): SectorType {
    const v = value.toLowerCase();
    if (v.includes('bleu') || v.includes('blue')) return SectorType.BLUE;
    if (v.includes('rouge') || v.includes('red')) return SectorType.RED;
    if (v.includes('jaune') || v.includes('yellow')) return SectorType.YELLOW;
    if (v.includes('noir') || v.includes('black')) return SectorType.BLACK;
    return SectorType.UNDEFINED; // Valeur par défaut
  }

  private static mapRevenueType(value: string): RevenueType {
    const v = value.toLowerCase();
    if (v.includes('energie') || v.includes('energy')) return RevenueType.ENERGY;
    if (v.includes('pioche') || v.includes('card')) return RevenueType.CARD;
    if (v.includes('crédit') || v.includes('credit')) return RevenueType.CREDIT;
    if (v.includes('donnée') || v.includes('data')) return RevenueType.DATA;
    if (v.includes('média') || v.includes('media')) return RevenueType.MEDIA;
    return RevenueType.UNDEFINED; // Valeur par défaut
  }

  private static parseImmediateEffects(gain: string): CardEffect[] {
    if (!gain) return [];
    const effects: CardEffect[] = [];

    // Séparer les effets multiples (ex: "2 Sondes + 1 Média")
    const parts = gain.split('+').map(p => p.trim());

    for (const part of parts) {
      const lower = part.toLowerCase();

      // Regex simple pour extraire la quantité
      const match = lower.match(/^(\d+)\s+(.+)$/);
      const amount = match ? parseInt(match[1], 10) : 1;

      if (lower.includes('média') || lower.includes('media')) {
        effects.push({ type: 'GAIN', target: 'MEDIA', value: amount });
      } else if (lower.includes('crédit') || lower.includes('credit')) {
        effects.push({ type: 'GAIN', target: 'CREDIT', value: amount });
      } else if (lower.includes('energie') || lower.includes('énergie')) {
        effects.push({ type: 'GAIN', target: 'ENERGY', value: amount });
      } else if (lower.includes('donnée') || lower.includes('data')) {
        effects.push({ type: 'GAIN', target: 'DATA', value: amount });
      } else if (lower.includes('signal') || lower.includes('signaux')) {
        let scope = SectorType.ANY;
        if (lower.includes('rangée') || lower.includes('rangee')) scope = SectorType.ROW;
        else if (lower.includes('terre')) scope = SectorType.EARTH;
        else if (lower.includes('mercure')) scope = SectorType.MERCURY;
        else if (lower.includes('vénus')) scope = SectorType.VENUS;
        else if (lower.includes('jupiter')) scope = SectorType.JUPITER;
        else if (lower.includes('saturne')) scope = SectorType.SATURN;
        else if (lower.includes('mars')) scope = SectorType.MARS;
        else if (lower.includes('sonde')) scope = SectorType.PROBE;
        else if (lower.includes('jaune')) scope = SectorType.YELLOW;
        else if (lower.includes('bleu')) scope = SectorType.BLUE;
        else if (lower.includes('rouge')) scope = SectorType.RED;
        else if (lower.includes('noir')) scope = SectorType.BLACK;
        else if (lower.includes('deck')) scope = SectorType.DECK;
        else if (lower.includes('kepler')) scope = SectorType.KEPLER;
        else if (lower.includes('virginis')) scope = SectorType.VIRGINIS;
        else if (lower.includes('barnard')) scope = SectorType.BARNARD;
        else if (lower.includes('proxima')) scope = SectorType.PROXIMA;
        else if (lower.includes('procyon')) scope = SectorType.PROCYON;
        else if (lower.includes('sirius')) scope = SectorType.SIRIUS;
        else if (lower.includes('véga')) scope = SectorType.VEGA;
        else if (lower.includes('pictoris')) scope = SectorType.PICTORIS;
        effects.push({ type: 'ACTION', target: 'SIGNAL', value: { amount, scope } });
      } else if (lower.includes('sonde')) {
        effects.push({ type: 'GAIN', target: 'PROBE', value: amount });
      } else if (lower.includes('pioche')) {
        effects.push({ type: 'GAIN', target: 'CARD', value: amount });
      } else if (lower.includes('carte')) {
        effects.push({ type: 'ACTION', target: 'ANYCARD', value: amount });
      } else if (lower.includes('déplacement') || lower.includes('deplacement')) {
        effects.push({ type: 'ACTION', target: 'MOVEMENT', value: amount });
      } else if (lower.includes('rotation')) {
        effects.push({ type: 'ACTION', target: 'ROTATION', value: amount });
      } else if (lower.includes('atterrissage')) {
        effects.push({ type: 'ACTION', target: 'LAND', value: amount });
      } else if (lower.includes('scan')) {
        effects.push({ type: 'ACTION', target: 'SCAN', value: amount });
      } else if (lower.includes('tech')) {
        let scope = TechnologyCategory.ANY;
        if (lower.includes('informatique') || lower.includes('bleu')) scope = TechnologyCategory.COMPUTING;
        else if (lower.includes('exploration') || lower.includes('jaune')) scope = TechnologyCategory.EXPLORATION;
        else if (lower.includes('observation') || lower.includes('rouge')) scope = TechnologyCategory.OBSERVATION;
        else if (lower.includes('exploorobs')) scope = TechnologyCategory.EXPLORATION_OR_OBSERVATION;
        effects.push({ type: 'ACTION', target: 'TECH', value: { amount, scope } });
      } else if (lower.includes('trace')) {
        let scope: any = 'ANY';
        if (lower.includes('rouge') || lower.includes('red')) scope = LifeTraceType.RED;
        else if (lower.includes('bleu') || lower.includes('blue')) scope = LifeTraceType.BLUE;
        else if (lower.includes('jaune') || lower.includes('yellow')) scope = LifeTraceType.YELLOW;
        effects.push({ type: 'ACTION', target: 'LIFETRACE', value: { amount, scope } });
      }
    }
    return effects;
  }

  private static parsePassiveEffects(constraint: string): CardEffect[] {
    if (!constraint) return [];
    const effects: CardEffect[] = [];

    // Séparer les effets multiples (ex: "GAIN_ON_ORBIT:media:2 + GAIN_ON_LAND:media:2")
    const passives = constraint.split('+').map(p => p.trim());

    for (const passive of passives) {

      // Gestion du format VISIT_PLANET:mars:4 (4 PV)
      if (passive.startsWith('VISIT_PLANET:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'VISIT_BONUS', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format VISIT_UNIQUE:1 (1 PV)
      else if (passive.startsWith('VISIT_UNIQUE:')) {
        const parts = passive.split(':');
        if (parts.length === 2) {
          effects.push({ type: 'VISIT_UNIQUE', value: parseInt(parts[1], 10) });
        }
      }

      // Gestion du format ASTEROID_EXIT_COST:1 (1 Déplacement)
      else if (passive.startsWith('ASTEROID_EXIT_COST:')) {
        const parts = passive.split(':');
        if (parts.length === 2) {
          effects.push({ type: 'ASTEROID_EXIT_COST', value: parseInt(parts[1], 10) });
        }
      }

      // Gestion du format VISIT_ASTEROID:1 (1 PV)
      else if (passive.startsWith('VISIT_ASTEROID:')) {
        const parts = passive.split(':');
        if (parts.length === 2) {
          effects.push({ type: 'VISIT_ASTEROID', value: parseInt(parts[1], 10) });
        }
      }

      // Gestion du format VISIT_COMET:4 (4 PV)
      else if (passive.startsWith('VISIT_COMET:')) {
        const parts = passive.split(':');
        if (parts.length === 2) {
          effects.push({ type: 'VISIT_COMET', value: parseInt(parts[1], 10) });
        }
      }

      // Gestion du format SAME_DISK_MOVE:3:1 (3 PV, 1 Media)
      else if (passive.startsWith('SAME_DISK_MOVE:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'SAME_DISK_MOVE', value: { pv: parseInt(parts[1], 10), media: parseInt(parts[2], 10) } });
        }
      }

      // Gestion du format GAIN_LIFETRACE_IF_ASTEROID:color:value
      else if (passive.startsWith('GAIN_LIFETRACE_IF_ASTEROID:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_LIFETRACE_IF_ASTEROID', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format REVEAL_AND_TRIGGER_FREE_ACTION
      else if (passive === 'REVEAL_AND_TRIGGER_FREE_ACTION') {
        effects.push({ type: 'REVEAL_AND_TRIGGER_FREE_ACTION', value: 1 });
      }

      // Gestion du format SCORE_PER_MEDIA:1
      else if (passive.startsWith('SCORE_PER_MEDIA:')) {
        const parts = passive.split(':');
        if (parts.length === 2) {
          effects.push({ type: 'SCORE_PER_MEDIA', value: parseInt(parts[1], 10) });
        }
      }

      // Gestion du format SCORE_PER_TECH_TYPE:2
      else if (passive.startsWith('SCORE_PER_TECH_TYPE:')) {
        const parts = passive.split(':');
        if (parts.length === 2) {
          effects.push({ type: 'SCORE_PER_TECH_TYPE', value: parseInt(parts[1], 10) });
        }
      }

      // Gestion du format MEDIA_IF_SHARED_TECH:2
      else if (passive.startsWith('MEDIA_IF_SHARED_TECH:')) {
        const parts = passive.split(':');
        if (parts.length === 2) {
          effects.push({ type: 'MEDIA_IF_SHARED_TECH', value: parseInt(parts[1], 10) });
        }
      }

      // Gestion du format REVEAL_MOVEMENT_CARDS_FOR_BONUS
      else if (passive === 'REVEAL_MOVEMENT_CARDS_FOR_BONUS') {
        effects.push({ type: 'REVEAL_MOVEMENT_CARDS_FOR_BONUS', value: 1 });
      }

      // Gestion du format GAIN_ENERGY_PER_ENERGY_REVENUE
      else if (passive === 'GAIN_ENERGY_PER_ENERGY_REVENUE') {
        effects.push({ type: 'GAIN_ENERGY_PER_ENERGY_REVENUE', value: 1 });
      }

      // Gestion du format GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE
      else if (passive === 'GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE') {
        effects.push({ type: 'GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE', value: 1 });
      }

      // Gestion du format GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE
      else if (passive === 'GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE') {
        effects.push({ type: 'GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE', value: 1 });
      }

      // Gestion du format GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE
      else if (passive === 'GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE') {
        effects.push({ type: 'GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE', value: 1 });
      }

      // Gestion du format SHARED_TECH_ONLY_NO_BONUS
      else if (passive === 'SHARED_TECH_ONLY_NO_BONUS') {
        effects.push({ type: 'SHARED_TECH_ONLY_NO_BONUS', value: 1 });
      }

      // Gestion du format OPTIMAL_LAUNCH_WINDOW
      else if (passive === 'OPTIMAL_LAUNCH_WINDOW') {
        effects.push({ type: 'OPTIMAL_LAUNCH_WINDOW', value: 1 });
      }

      // Gestion du format OSIRIS_REX_BONUS
      else if (passive === 'OSIRIS_REX_BONUS') {
        effects.push({ type: 'OSIRIS_REX_BONUS', value: 1 });
      }

      // Gestion du format DISCARD_ROW_FOR_FREE_ACTIONS
      else if (passive === 'DISCARD_ROW_FOR_FREE_ACTIONS') {
        effects.push({ type: 'DISCARD_ROW_FOR_FREE_ACTIONS', value: 1 });
      }

      // Gestion du format ATMOSPHERIC_ENTRY
      else if (passive === 'ATMOSPHERIC_ENTRY') {
        effects.push({ type: 'ATMOSPHERIC_ENTRY', value: 1 });
      }

      // Gestion du format IGNORE_PROBE_LIMIT
      else if (passive === 'IGNORE_PROBE_LIMIT') {
        effects.push({ type: 'IGNORE_PROBE_LIMIT', value: true });
      }

      // Gestion du format CHOICE_MEDIA_OR_MOVE
      else if (passive === 'CHOICE_MEDIA_OR_MOVE') {
        effects.push({ type: 'CHOICE_MEDIA_OR_MOVE', value: true });
      }

      // Gestion du format GAIN_SIGNAL_FROM_HAND:x
      else if (passive.startsWith('GAIN_SIGNAL_FROM_HAND:')) {
        const parts = passive.split(':');
        effects.push({ type: 'GAIN_SIGNAL_FROM_HAND', value: parseInt(parts[1], 10) });
      }

      // Gestion du format BONUS_IF_COVERED:type
      else if (passive.startsWith('BONUS_IF_COVERED:')) {
        const parts = passive.split(':');
        effects.push({ type: 'BONUS_IF_COVERED', target: parts[1], value: 1 });
      }

      // Gestion du format SCORE_IF_UNIQUE:x
      else if (passive.startsWith('SCORE_IF_UNIQUE:')) {
        const parts = passive.split(':');
        effects.push({ type: 'SCORE_IF_UNIQUE', value: parseInt(parts[1], 10) });
      }

      // Gestion du format KEEP_CARD_IF_ONLY
      else if (passive === 'KEEP_CARD_IF_ONLY') {
        effects.push({ type: 'KEEP_CARD_IF_ONLY', value: true });
      }

      // Gestion du format NO_DATA
      else if (passive === 'NO_DATA') {
        effects.push({ type: 'NO_DATA', value: true });
      }

      // Gestion du format ANY_PROBE
      else if (passive === 'ANY_PROBE') {
        effects.push({ type: 'ANY_PROBE', value: true });
      }

      // Gestion du format GAIN_SIGNAL_ADJACENTS
      else if (passive === 'GAIN_SIGNAL_ADJACENTS') {
        effects.push({ type: 'GAIN_SIGNAL_ADJACENTS', value: true });
      }

      // Gestion du format SCORE_PER_SECTOR:color:value
      else if (passive.startsWith('SCORE_PER_SECTOR:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'SCORE_PER_SECTOR', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format IGNORE_SATELLITE_LIMIT
      else if (passive === 'IGNORE_SATELLITE_LIMIT') {
        effects.push({ type: 'IGNORE_SATELLITE_LIMIT', value: true });
      }

      // Gestion du format SCORE_PER_ORBITER_LANDER:planet:value
      else if (passive.startsWith('SCORE_PER_ORBITER_LANDER:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'SCORE_PER_ORBITER_LANDER', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format SCORE_PER_COVERED_SECTOR:color:value
      else if (passive.startsWith('SCORE_PER_COVERED_SECTOR:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'SCORE_PER_COVERED_SECTOR', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format SCORE_PER_LIFETRACE:color:value
      else if (passive.startsWith('SCORE_PER_LIFETRACE:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'SCORE_PER_LIFETRACE', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format SCORE_PER_SIGNAL:any:value
      else if (passive.startsWith('SCORE_PER_SIGNAL:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'SCORE_PER_SIGNAL', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format SCORE_SOLVAY
      else if (passive === 'SCORE_SOLVAY') {
        effects.push({ type: 'SCORE_SOLVAY', value: 1 });
      }

      // Gestion du format SCORE_PER_TECH_CATEGORY:category:value
      else if (passive.startsWith('SCORE_PER_TECH_CATEGORY:')) {
        const parts = passive.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'SCORE_PER_TECH_CATEGORY', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format SCORE_IF_PROBE_ON_ASTEROID:value
      else if (passive.startsWith('SCORE_IF_PROBE_ON_ASTEROID:')) {
        const parts = passive.split(':');
        effects.push({ type: 'SCORE_IF_PROBE_ON_ASTEROID', value: parseInt(parts[1], 10) });
      }

      // Gestion du format SCORE_PER_TRACE:any:value (pour carte 75)
      else if (passive.startsWith('SCORE_PER_TRACE:')) {
        const parts = passive.split(':');
        effects.push({ type: 'SCORE_PER_TRACE', target: parts[1], value: parseInt(parts[2], 10) });
      }
    }
    return effects;
  }

  private static parsePermanentEffects(constraint: string): CardEffect[] {
    if (!constraint) return [];
    const effects: CardEffect[] = [];

    // Séparer les effets multiples (ex: "GAIN_ON_ORBIT:media:2 + GAIN_ON_LAND:media:2")
    const permanents = constraint.split('+').map(p => p.trim());

    for (const permanent of permanents) {
      // Gestion du format GAIN_ON_ORBIT:target:value
      if (permanent.startsWith('GAIN_ON_ORBIT:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_ON_ORBIT', target: parts[1], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_LAND:target:value
      else if (permanent.startsWith('GAIN_ON_LAND:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_ON_LAND', target: parts[1], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_ORBIT_OR_LAND:target:value
      else if (permanent.startsWith('GAIN_ON_ORBIT_OR_LAND:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_ON_ORBIT_OR_LAND', target: parts[1], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_LAUNCH:target:value
      else if (permanent.startsWith('GAIN_ON_LAUNCH:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_ON_LAUNCH', target: parts[1], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_SCAN:target:value
      else if (permanent.startsWith('GAIN_ON_SCAN:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_ON_SCAN', target: parts[1], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_SIGNAL:color:target:value
      else if (permanent.startsWith('GAIN_ON_SIGNAL:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'yellow') effects.push({ type: 'GAIN_ON_YELLOW_SIGNAL', target: parts[2], value: permanent });
          else if (parts[1] === 'red') effects.push({ type: 'GAIN_ON_RED_SIGNAL', target: parts[2], value: permanent });
          else if (parts[1] === 'blue') effects.push({ type: 'GAIN_ON_BLUE_SIGNAL', target: parts[2], value: permanent });
          else if (parts[1] === 'oumuamua') effects.push({ type: 'GAIN_ON_OUMUAMUA_SIGNAL', target: parts[2], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_TECH:color:target:value
      else if (permanent.startsWith('GAIN_ON_TECH:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'yellow') effects.push({ type: 'GAIN_ON_YELLOW_TECH', target: parts[2], value: permanent });
          else if (parts[1] === 'red') effects.push({ type: 'GAIN_ON_RED_TECH', target: parts[2], value: permanent });
          else if (parts[1] === 'blue') effects.push({ type: 'GAIN_ON_BLUE_TECH', target: parts[2], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_LIFETRACE:color:target:value
      else if (permanent.startsWith('GAIN_ON_LIFETRACE:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'yellow') effects.push({ type: 'GAIN_ON_YELLOW_LIFETRACE', target: parts[2], value: permanent });
          else if (parts[1] === 'red') effects.push({ type: 'GAIN_ON_RED_LIFETRACE', target: parts[2], value: permanent });
          else if (parts[1] === 'blue') effects.push({ type: 'GAIN_ON_BLUE_LIFETRACE', target: parts[2], value: permanent });
          else if (parts[1] === 'any') effects.push({ type: 'GAIN_ON_ANY_LIFETRACE', target: parts[2], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_VISIT:object:target:value
      else if (permanent.startsWith('GAIN_ON_VISIT:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'jupiter') effects.push({ type: 'GAIN_ON_VISIT_JUPITER', target: parts[2], value: permanent });
          else if (parts[1] === 'saturn') effects.push({ type: 'GAIN_ON_VISIT_SATURN', target: parts[2], value: permanent });
          else if (parts[1] === 'mercury') effects.push({ type: 'GAIN_ON_VISIT_MERCURY', target: parts[2], value: permanent });
          else if (parts[1] === 'venus') effects.push({ type: 'GAIN_ON_VISIT_VENUS', target: parts[2], value: permanent });
          else if (parts[1] === 'uranus') effects.push({ type: 'GAIN_ON_VISIT_URANUS', target: parts[2], value: permanent });
          else if (parts[1] === 'neptune') effects.push({ type: 'GAIN_ON_VISIT_NEPTUNE', target: parts[2], value: permanent });
          else if (parts[1] === 'planet') effects.push({ type: 'GAIN_ON_VISIT_PLANET', target: parts[2], value: permanent }); // excluding earth
          else if (parts[1] === 'asteroid') effects.push({ type: 'GAIN_ON_VISIT_ASTEROID', target: parts[2], value: permanent });
          else if (parts[1] === 'oumuamua') effects.push({ type: 'GAIN_ON_VISIT_OUMUAMUA', target: parts[2], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_PLAY:cost:target:value
      else if (permanent.startsWith('GAIN_ON_PLAY:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === '1') effects.push({ type: 'GAIN_ON_PLAY_1_CREDIT', target: parts[2], value: permanent });
          else if (parts[1] === '2') effects.push({ type: 'GAIN_ON_PLAY_2_CREDITS', target: parts[2], value: permanent });
          else if (parts[1] === '3') effects.push({ type: 'GAIN_ON_PLAY_3_CREDITS', target: parts[2], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_DISCARD:resource:target:value
      else if (permanent.startsWith('GAIN_ON_DISCARD:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'media') effects.push({ type: 'GAIN_ON_DISCARD_MEDIA', target: parts[2], value: permanent });
          else if (parts[1] === 'data') effects.push({ type: 'GAIN_ON_DISCARD_DATA', target: parts[2], value: permanent });
          else if (parts[1] === 'move') effects.push({ type: 'GAIN_ON_DISCARD_MOVE', target: parts[2], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_TOKEN:target:value
      else if (permanent.startsWith('GAIN_ON_TOKEN:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_ON_TOKEN', target: parts[1], value: permanent });
        }
      }

      // Gestion du format GAIN_ON_TOKEN_AND_LAND:target:value
      else if (permanent.startsWith('GAIN_ON_TOKEN_AND_LAND:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ type: 'GAIN_ON_TOKEN_AND_LAND', target: parts[1], value: permanent });
        }
      }

      // Gestion du format GAIN_IF_... (Missions conditionnelles)
      else if (permanent.startsWith('GAIN_IF_')) {
        const parts = permanent.split(':').map(p => p.trim());
        // On stocke la contrainte brute comme effet pour qu'elle apparaisse dans les requirements
        effects.push({ type: parts[0], target: parts[1], value: permanent });
      }
    }
    return effects;
  }
}
