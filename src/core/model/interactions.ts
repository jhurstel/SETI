/** Interactions en cours (union discriminée InteractionState) et leurs libellés */
import type { Technology } from './board';
import type { Bonus } from './cards';
import { LifeTraceLocation, LifeTraceType, SectorType, TechnologyCategory } from './enums';

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

/** Type d'une interaction, et la variante correspondante */
export type InteractionType = InteractionState['type'];
export type Interaction<T extends InteractionType> = Extract<InteractionState, { type: T }>;

/**
 * Réponse du joueur à l'interaction en cours (`game.interaction`), transmise par la commande CHOOSE.
 * Les genres acceptés par chaque interaction sont dans `INTERACTIONS` (vérifiés par GameSession).
 */
export type Choice =
  | { kind: 'LIFE_TRACE'; boardIndex: number; color: LifeTraceType; slotType: LifeTraceLocation; slotIndex?: number }
  /** Carte de la rangée de l'espèce, ou 'deck' */
  | { kind: 'ALIEN_CARD'; cardId: string }
  | { kind: 'OBJECTIVE'; tileId: string }
  | { kind: 'TECH'; techId: string }
  | { kind: 'COMPUTER_COLUMN'; column: number }
  | { kind: 'PLANET'; planetId: string; slotIndex?: number }
  | { kind: 'CENTAURIEN'; tokenIndex: number }
  | { kind: 'MENU'; index: number }
  /** Absent : la pioche (achat de carte) */
  | { kind: 'CARD'; cardId?: string }
  | { kind: 'CARDS'; cardIds: string[] }
  | { kind: 'MEDIA_OR_MOVE'; choice: 'MEDIA' | 'MOVE' }
  | { kind: 'SPECIMEN'; planetId: string; tokenIndex: number }
  /** Absent : renoncer */
  | { kind: 'EXERTIEN'; cardId?: string }
  /** Absents : renoncer */
  | { kind: 'MISSION'; missionId?: string; requirementId?: string }
  | { kind: 'ACCEPT'; accepted: boolean }
  | { kind: 'OBS4'; choice: 'PROBE' | 'MOVE' }
  | { kind: 'SECTOR'; sectorId: string };
export type ChoiceKind = Choice['kind'];

/**
 * Description d'une interaction :
 * - `label` : message affiché au joueur ;
 * - `resolution` : `choice` (le joueur choisit, par une commande CHOOSE d'un des genres `choices`, ou par une action
 *   gratuite pour MOVING_PROBE ; les robots par AIController), `automatic` (règle sans choix, InteractionResolver),
 *   `local` (mode de sélection de l'interface, jamais dans la file de la partie) ;
 * - `skippable` : le joueur peut y renoncer (commande SKIP).
 * Les tables qui traitent les interactions (GameSession, AIController) sont indexées par `InteractionType` :
 * le compilateur signale un type oublié.
 */
interface InteractionDescriptor<T extends InteractionType> {
  label: (state: Interaction<T>) => string;
  resolution: 'choice' | 'automatic' | 'local';
  choices: readonly ChoiceKind[];
  skippable?: (state: Interaction<T>) => boolean;
}

const plural = (count: number) => (count > 1 ? 's' : '');
const choice = <const K extends readonly ChoiceKind[]>(...choices: K) => ({ resolution: 'choice' as const, choices });
const automatic = { resolution: 'automatic' as const, choices: [] as const };
const local = { resolution: 'local' as const, choices: [] as const };
const always = () => true;

export const INTERACTIONS = {
  IDLE: { ...local, label: () => 'Aucune action en cours.' },
  ANALYZING: { ...local, label: () => 'Analyse en cours...' },
  DISCARDING_CARD: { ...local, label: s => `Veuillez défausser ${s.count} carte${plural(s.count)}.` },
  TRADING_CARD: { ...local, label: s => `Veuillez échanger ${s.count} carte${plural(s.count)} pour gagner ${s.targetGain}.` },

  RESOLVING_SECTOR: { ...automatic, label: () => 'Résolution du secteur complété...' },
  DRAW_AND_SCAN: { ...automatic, label: () => "Pioche d'une carte pour signal..." },
  CLAIMING_MISSION_REQUIREMENT: { ...automatic, label: () => "Validation d'une mission..." },
  TRIGGER_CARD_EFFECT: {
    ...automatic,
    label: s => (s.effectType === 'SCORE_PER_MEDIA' ? `Gagner ${s.value} PV par niveau de Média (PIXL).` : "Appliquer l'effet de la carte."),
  },

  RESERVING_CARD: { ...choice('CARDS'), label: s => `Veuillez réserver ${s.count} carte${plural(s.count)}.` },
  ACQUIRING_CARD: {
    ...choice('CARD'),
    label: s => (s.isFree ? `Veuillez choisir ${s.count} carte${plural(s.count)}.` : `Veuillez acheter ${s.count} carte${plural(s.count)}.`),
    // Une carte gagnée en bonus doit être prise ; un achat peut être abandonné
    skippable: s => !s.isFree,
  },
  MOVING_PROBE: { ...choice(), label: s => `Veuillez déplacer une sonde gratuitement (${s.count} déplacement${plural(s.count)}).`, skippable: always },
  ORBITING_PROBE: { ...choice('PLANET'), label: () => 'Veuillez mettre une sonde en orbite gratuitement.' },
  LANDING_PROBE: { ...choice('PLANET'), label: () => 'Veuillez poser une sonde gratuitement.' },
  ACQUIRING_TECH: {
    ...choice('TECH'),
    label: s => (s.isBonus ? `Veuillez sélectionner une technologie ${s.categories ? s.categories.join(' ou ') : ''}.` : 'Veuillez acheter une technologie.'),
  },
  SELECTING_COMPUTER_SLOT: { ...choice('COMPUTER_COLUMN'), label: s => `Veuillez sélectionner un emplacement d'ordinateur pour technologie ${s.tech.shorttext}.` },
  PLACING_LIFE_TRACE: { ...choice('LIFE_TRACE'), label: s => `Veuillez placer trace de vie (${s.color}).` },
  PLACING_OBJECTIVE_MARKER: { ...choice('OBJECTIVE'), label: s => `Veuillez placer un marqueur d'objectif pour avoir dépassé ${s.milestone} PV.` },
  SELECTING_SCAN_CARD: { ...choice('CARD'), label: () => 'Veuillez sélectionner une carte de la rangée pour marquer un signal.' },
  SELECTING_SCAN_SECTOR: {
    ...choice('SECTOR'),
    label: s => (s.adjacents ? 'Veuillez sélectionner un secteur adjacent à la Terre pour marquer un signal.' : `Veuillez sélectionner un secteur ${s.color} pour marquer un signal.`),
  },
  CHOOSING_MEDIA_OR_MOVE: { ...choice('MEDIA_OR_MOVE'), label: () => 'Veuillez sélectionner le bonus de la carte 19.' },
  CHOOSING_OBS2_ACTION: { ...choice('ACCEPT'), label: () => 'Veuillez sélectionner le bonus de technologie Observation II.' },
  CHOOSING_OBS3_ACTION: { ...choice('ACCEPT'), label: () => 'Veuillez sélectionner le bonus de technologie Observation III.' },
  CHOOSING_OBS4_ACTION: { ...choice('OBS4'), label: () => 'Veuillez sélectionner le bonus de technologie Observation IV.' },
  DISCARDING_DRAWN_CARD: {
    ...choice('CARD'),
    label: s => (s.step === 'FREE_ACTION'
      ? 'Défaussez une des cartes piochées pour son action gratuite.'
      : 'Défaussez une autre des cartes piochées pour gagner la ressource de son revenu.'),
  },
  DISCARDING_FOR_SIGNAL: { ...choice('CARDS'), label: s => `Veuillez défausser ${s.count} carte${plural(s.count)} pour marquer un signal.` },
  REMOVING_ORBITER: { ...choice('PLANET'), label: () => 'Veuillez retirer un orbiteur (bonus carte 15).' },
  REMOVING_LANDER: { ...choice('PLANET'), label: () => 'Veuillez retirer un atterrisseur (bonus carte 84).' },
  CHOOSING_BONUS_ACTION: { ...choice('MENU'), label: () => 'Veuillez choisir la prochaine action.', skippable: always },
  ACQUIRING_ALIEN_CARD: { ...choice('ALIEN_CARD'), label: s => `Veuillez choisir ${s.count} carte${plural(s.count)} Alien (Pioche ou Rangée).` },
  CHOOSING_CENTAURIEN_REWARD: { ...choice('CENTAURIEN'), label: () => 'Veuillez choisir une récompense Centaurien.' },
  COLLECTING_SPECIMEN: { ...choice('SPECIMEN'), label: () => 'Veuillez cliquer sur un spécimen Mascamite pour le prélever.' },
  CONSULTING_SPECIMEN: { ...choice('SPECIMEN'), label: () => "Veuillez cliquer sur un spécimen Mascamite pour l'étudier." },
  CHOOSING_EXERTIEN_CARD: {
    ...choice('EXERTIEN'),
    label: s => (s.milestone === 0
      ? 'Découverte des Exertiens : vous pouvez jouer une carte Exertien.'
      : `Palier Exertien (${s.milestone} PV) : vous pouvez jouer une carte Exertien.`),
  },
  CHOOSING_ROUND_CARD: { ...choice('CARD'), label: s => `Choisissez une carte de fin de manche ${s.round}.` },
  DISCARDING_TOKEN: { ...choice('ACCEPT'), label: s => `Défausser 1 Token pour gagner ${s.rewardText} ("${s.cardName}") ?` },
  CHOOSING_MISSION_REQUIREMENT: { ...choice('MISSION'), label: () => 'Mission déclenchée : vous pouvez recouvrir un cercle.' },
} as const satisfies { [T in InteractionType]: InteractionDescriptor<T> };

/** Types d'interaction selon leur résolution */
type TypesResolvedBy<R extends InteractionDescriptor<InteractionType>['resolution']> =
  { [T in InteractionType]: (typeof INTERACTIONS)[T]['resolution'] extends R ? T : never }[InteractionType];
export type ChoiceInteractionType = TypesResolvedBy<'choice'>;
export type AutomaticInteraction = Interaction<TypesResolvedBy<'automatic'>>;

/** Choix acceptés par une interaction */
export type ChoiceFor<T extends InteractionType> = Extract<Choice, { kind: (typeof INTERACTIONS)[T]['choices'][number] }>;

/** Description d'une interaction (non typée par variante) ; absente pour une interaction d'une sauvegarde plus ancienne */
function describe(state: InteractionState): InteractionDescriptor<InteractionType> | undefined {
  return (INTERACTIONS as Partial<Record<string, InteractionDescriptor<InteractionType>>>)[state.type];
}

/** Interaction résolue par le moteur seul (InteractionResolver) */
export function isAutomaticInteraction(state: InteractionState): state is AutomaticInteraction {
  return describe(state)?.resolution === 'automatic';
}

/** Le joueur peut renoncer à l'interaction (commande SKIP) */
export function isSkippable(state: InteractionState): boolean {
  return describe(state)?.skippable?.(state) ?? false;
}

/** Le choix répond-il à l'interaction ? */
export function acceptsChoice<T extends InteractionType>(state: Interaction<T>, choice: Choice): choice is ChoiceFor<T> {
  return describe(state)?.choices.includes(choice.kind) ?? false;
}

/** Message affiché au joueur pour l'interaction en cours */
export const getInteractionLabel = (state: InteractionState): string =>
  describe(state)?.label(state) ?? `Interaction en cours (${state.type}).`;
