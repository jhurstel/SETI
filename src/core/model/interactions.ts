/** Interactions en cours (union discriminée InteractionState) et leurs libellés */
import type { Technology } from './board';
import type { Bonus } from './cards';
import { LifeTraceType, SectorType, TechnologyCategory } from './enums';

/**
 * Représente les différents états d'interaction possibles pour le joueur.
 * L'état 'IDLE' est l'état par défaut où le joueur peut initier une action principale.
 * Tous les autres états représentent une interaction en cours qui bloque les actions principales.
 */
type InteractionStateVariant =
  /** Le joueur est en attente, aucune interaction en cours. */
  | { type: 'IDLE', sequenceId?: string }
  /** Le joueur a un bonus de réservation et doit choisir une carte à glisser sous son plateau. */
  | { type: 'RESERVING_CARD', count: number, selectedCards: string[], sequenceId?: string }
  /** Le joueur doit défausser des cartes (ex: fin de manche). */
  | { type: 'DISCARDING_CARD', count: number, selectedCards: string[], sequenceId?: string }
  /** Le joueur a initié un échange et doit choisir la ressource à dépenser. */
  | { type: 'TRADING_CARD', count: number, targetGain: string, selectedCards: string[], sequenceId?: string }
  /** Le joueur acquiert une carte (gratuitement ou en payant) et doit la sélectionner dans la pioche ou la rangée. */
  | { type: 'ACQUIRING_CARD', count: number, isFree?: boolean, triggerFreeAction?: boolean, sequenceId?: string }
  /** Le joueur a des déplacements gratuits à effectuer. */
  | { type: 'MOVING_PROBE', count: number, autoSelectProbeId?: string, sequenceId?: string }
  /** Le joueur a une mise en orbite gratuite. */
  | { type: 'ORBITING_PROBE', count: number, source?: string, sequenceId?: string }
  /** Le joueur a un atterrissage gratuit (ex: Carte 13). */
  | { type: 'LANDING_PROBE', count: number, source?: string, ignoreSatelliteLimit?: boolean, categories?: TechnologyCategory[], sequenceId?: string }
  /** Le joueur acquiert une technologie (en payant ou en bonus) et doit la sélectionner. */
  | { type: 'ACQUIRING_TECH', isBonus?: boolean, categories?: TechnologyCategory[], sharedOnly?: boolean, noTileBonus?: boolean, sequenceId?: string }
  /** Le joueur a choisi une technologie "Informatique" et doit sélectionner une colonne sur son ordinateur. */
  | { type: 'SELECTING_COMPUTER_SLOT', tech: Technology, noTileBonus?: boolean, sequenceId?: string }
  /** Le joueur a lancé l'action "Analyser", principalement pour l'animation. */
  | { type: 'ANALYZING', sequenceId?: string }
  /** Le joueur doit placer une trace de vie sur le plateau Alien. */
  | { type: 'PLACING_LIFE_TRACE', color: LifeTraceType, playerId?: string, sequenceId?: string, boardIndices?: number[] } // boardIndices : plateaux Alien autorisés (absent : tous)
  /** Le joueur a atteint un palier de score et doit placer un marqueur sur un objectif. */
  | { type: 'PLACING_OBJECTIVE_MARKER', milestone: number, sequenceId?: string }
  /** Le joueur scanne un secteur (2ème étape : choix de la carte). */
  | { type: 'SELECTING_SCAN_CARD', sequenceId?: string }
  /** Le joueur scanne un secteur (3ème étape : choix du secteur couleur). */
  | { type: 'SELECTING_SCAN_SECTOR', color: SectorType, noData?: boolean, onlyProbes?: boolean, anyProbe?: boolean, adjacents?: boolean, keepCardIfOnly?: boolean, sequenceId?: string, cardId?: string, message?: string, markAdjacents?: boolean, usedProbeIds?: string[], sectorId?: string, cardProcessed?: boolean }
  /** Le joueur doit choisir entre un gain de média ou un déplacement (Carte 19). */
  | { type: 'CHOOSING_MEDIA_OR_MOVE', remainingMoves?: number, sequenceId?: string }
  /** Le joueur doit choisir s'il utilise la technologie Observation 2 (Payer 1 Média pour scanner Mercure). */
  | { type: 'CHOOSING_OBS2_ACTION', sequenceId?: string }
  /** Le joueur doit choisir s'il utilise la technologie Observation 3 (Défausser une carte pour un signal). */
  | { type: 'CHOOSING_OBS3_ACTION', sequenceId?: string }
  /** Le joueur doit choisir s'il utilise la technologie Observation 4 (Payer 1 Energie pour lancer une sonde OU gagner 1 déplacement). */
  | { type: 'CHOOSING_OBS4_ACTION', sequenceId?: string }
  /**
   * ET.15 : parmi les cartes piochées (`cardIds`), le joueur en défausse une pour son action gratuite (étape
   * FREE_ACTION), puis une autre pour gagner la ressource de son revenu (étape REVENUE).
   */
  | { type: 'DISCARDING_DRAWN_CARD', cardIds: string[], step: 'FREE_ACTION' | 'REVENUE', sequenceId?: string }
  /** Le joueur doit défausser des cartes de sa main pour leurs signaux. */
  | { type: 'DISCARDING_FOR_SIGNAL', count: number, selectedCards: string[], sequenceId?: string }
  /** Le joueur doit retirer un orbiteur (Carte 15). */
  | { type: 'REMOVING_ORBITER', sequenceId?: string }
  /** Le joueur doit retirer un atterrisseur (Carte 84). */
  | { type: 'REMOVING_LANDER', sequenceId?: string }
  /** Le joueur a reçu plusieurs bonus interactifs et doit choisir l'ordre de résolution. */
  | { type: 'CHOOSING_BONUS_ACTION', bonusesSummary: string, choices: { id: string, label: string, state: InteractionState, done: boolean }[], sequenceId?: string }
  /** Le joueur doit résoudre un secteur complété. */
  | { type: 'RESOLVING_SECTOR', sectorId: string, sequenceId?: string }
  /** Un effet de carte non-interactif est déclenché. */
  | { type: 'TRIGGER_CARD_EFFECT', effectType: string, value: number, sequenceId?: string }
  /** Le joueur doit piocher une carte et scanner son secteur (Bonus Deck). */
  | { type: 'DRAW_AND_SCAN', count: number, sequenceId?: string }
  /** Le joueur valide une condition de mission. */
  | { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: string, requirementId: string, sequenceId?: string }
  /** Le joueur acquiert une carte Alien (bonus) et doit la sélectionner dans la pioche ou la rangée de l'espèce. */
  | { type: 'ACQUIRING_ALIEN_CARD', count: number, speciesId: string, sequenceId?: string }
  /** Le joueur doit choisir une récompense Centaurien. */
  | { type: 'CHOOSING_CENTAURIEN_REWARD', markerId?: string, sequenceId?: string }
  /** Le joueur doit cliquer sur un token Mascamite pour le collecter. */
  | { type: 'COLLECTING_SPECIMEN', planetId: string, sequenceId?: string }
  /** Le joueur doit cliquer sur un token Mascamite pour le consulter (et gagner son bonus sans le retirer). */
  | { type: 'CONSULTING_SPECIMEN', planetId?: string, sequenceId?: string, anyPlanet?: boolean } // anyPlanet : Jupiter ou Saturne au choix, sans sonde (ET.8 à ET.10)
  /** Le joueur a atteint un palier Exertien : il peut jouer une de ses cartes Exertiens face cachée (ou y renoncer). */
  | { type: 'CHOOSING_EXERTIEN_CARD', milestone: number, sequenceId?: string }
  /** Carte de la pile de fin de manche `round`, choisie après avoir passé (la pile est cachée jusque-là) */
  | { type: 'CHOOSING_ROUND_CARD', round: number, playerId: string, sequenceId?: string }
  /** Défausser 1 Token pour le gain d'une carte (ET.24, ET.25, ET.28) : `repeat` tant qu'il reste des tokens, `then` gagné en arrêtant */
  | { type: 'DISCARDING_TOKEN', reward: Bonus, rewardText: string, repeat?: boolean, then?: Bonus, cardId: string, cardName: string, playerId?: string, sequenceId?: string }
  /**
   * Missions déclenchées pendant le tour d'un autre joueur : le joueur recouvre un des cercles `options`
   * (un seul, toutes cartes confondues) ou y renonce.
   */
  | { type: 'CHOOSING_MISSION_REQUIREMENT', options: { missionId: string, requirementId: string }[], sequenceId?: string };

/**
 * `playerId` : joueur qui résout l'interaction quand ce n'est pas le joueur actif
 * (ex. gains du gagnant d'un secteur couvert pendant le tour d'un robot). Absent : le joueur actif.
 */
export type InteractionState = InteractionStateVariant & { playerId?: string };

  // Helper pour les libellés des interactions
export const getInteractionLabel = (state: InteractionState): string => {
  switch (state.type) {
    case 'RESERVING_CARD': return `Veuillez réserver ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'DISCARDING_CARD': return `Veuillez défausser ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'TRADING_CARD': return `Veuillez échanger ${state.count} carte${state.count > 1 ? 's' : ''} pour gagner ${state.targetGain}.`;
    case 'ACQUIRING_CARD': return state.isFree ? `Veuillez choisir ${state.count} carte${state.count > 1 ? 's' : ''}.` : `Veuillez acheter ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'MOVING_PROBE': return `Veuillez déplacer une sonde gratuitement (${state.count} déplacement${state.count > 1 ? 's' : ''}).`;
    case 'ORBITING_PROBE': return `Veuillez mettre une sonde en orbite gratuitement.`;
    case 'LANDING_PROBE': return `Veuillez poser une sonde gratuitement.`;
    case 'ACQUIRING_TECH': return state.isBonus ? `Veuillez sélectionner une technologie ${state.categories ? state.categories.join(' ou ') : ''}.` : `Veuillez acheter une technologie.`;
    case 'SELECTING_COMPUTER_SLOT': return `Veuillez sélectionner un emplacement d'ordinateur pour technologie ${state.tech.shorttext}.`;
    case 'ANALYZING': return `Analyse en cours...`;
    case 'PLACING_LIFE_TRACE': return `Veuillez placer trace de vie (${state.color}).`;
    case 'PLACING_OBJECTIVE_MARKER': return `Veuillez placer un marqueur d'objectif pour avoir dépassé ${state.milestone} PV.`;
    case 'SELECTING_SCAN_CARD': return `Veuillez sélectionner une carte de la rangée pour marquer un signal.`;
    case 'SELECTING_SCAN_SECTOR': return state.adjacents ? `Veuillez sélectionner un secteur adjacent à la Terre pour marquer un signal.` : `Veuillez sélectionner un secteur ${state.color} pour marquer un signal.`;
    case 'CHOOSING_MEDIA_OR_MOVE': return `Veuillez sélectionner le bonus de la carte 19.`;
    case 'CHOOSING_OBS2_ACTION': return `Veuillez sélectionner le bonus de technologie Observation II.`;
    case 'CHOOSING_OBS3_ACTION': return `Veuillez sélectionner le bonus de technologie Observation III.`;
    case 'CHOOSING_OBS4_ACTION': return `Veuillez sélectionner le bonus de technologie Observation IV.`;
    case 'DISCARDING_FOR_SIGNAL': return `Veuillez défausser ${state.count} carte${state.count > 1 ? 's' : ''} pour marquer un signal.`;
    case 'REMOVING_ORBITER': return "Veuillez retirer un orbiteur (bonus carte 15).";
    case 'REMOVING_LANDER': return "Veuillez retirer un atterrisseur (bonus carte 84).";
    case 'CHOOSING_BONUS_ACTION': return `Veuillez choisir la prochaine action.`;
    case 'RESOLVING_SECTOR': return `Résolution du secteur complété...`;
    case 'DRAW_AND_SCAN': return `Pioche d'une carte pour signal...`;
    case 'CLAIMING_MISSION_REQUIREMENT': return `Validation d'une mission...`;
    case 'ACQUIRING_ALIEN_CARD': return `Veuillez choisir ${state.count} carte${state.count > 1 ? 's' : ''} Alien (Pioche ou Rangée).`;
    case 'CHOOSING_CENTAURIEN_REWARD': return `Veuillez choisir une récompense Centaurien.`;
    case 'COLLECTING_SPECIMEN': return `Veuillez cliquer sur un spécimen Mascamite pour le prélever.`;
    case 'CONSULTING_SPECIMEN': return `Veuillez cliquer sur un spécimen Mascamite pour l'étudier.`;
    case 'DISCARDING_DRAWN_CARD': return state.step === 'FREE_ACTION'
      ? "Défaussez une des cartes piochées pour son action gratuite."
      : "Défaussez une autre des cartes piochées pour gagner la ressource de son revenu.";
    case 'CHOOSING_ROUND_CARD': return `Choisissez une carte de fin de manche ${state.round}.`;
    case 'DISCARDING_TOKEN': return `Défausser 1 Token pour gagner ${state.rewardText} ("${state.cardName}") ?`;
    case 'CHOOSING_EXERTIEN_CARD': return state.milestone === 0
      ? 'Découverte des Exertiens : vous pouvez jouer une carte Exertien.'
      : `Palier Exertien (${state.milestone} PV) : vous pouvez jouer une carte Exertien.`;
    case 'CHOOSING_MISSION_REQUIREMENT': return `Mission déclenchée : vous pouvez recouvrir un cercle.`;
    case 'TRIGGER_CARD_EFFECT':
      return state.effectType === 'SCORE_PER_MEDIA'
        ? `Gagner ${state.value} PV par niveau de Média (PIXL).`
        : `Appliquer l'effet de la carte.`;
    case 'IDLE': return `Aucune action en cours.`;
    default: {
      // Chaque type d'interaction doit avoir un libellé : erreur de compilation si un cas manque.
      // Reste possible à l'exécution pour une interaction d'une sauvegarde plus ancienne.
      const missing: never = state;
      return `Interaction en cours (${(missing as { type: string }).type}).`;
    }
  }
};
