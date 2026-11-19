/**
 * Description d'une carte pour sa face (TS pur, sans React) : coins, coût ou danger, effet en symboles,
 * panneau de mission, de fin de partie ou de réception. Ce que le jeu ne sait pas encore dessiner devient
 * un segment texte (liste « effets sans symbole » de docs/etat-des-lieux-cartes.md, outil tools/cards/cardAudit.ts).
 * Aucune règle n'est calculée ici : les effets sont ceux lus par DataLoader, les récompenses de mission celles
 * de CardSystem.parseMission (la même lecture que le moteur).
 */
import { Bonus, Card, CardEffect, CardType, CostType, FreeActionType, LifeTraceType, RevenueType, SectorType, TechnologyCategory } from '../../core/types';
import { effectAmount, effectNumber, effectString } from '../../core/cardEffects';
import { CardSystem } from '../../systems/CardSystem';
import { freeActionBonus, revenueBonus } from './cardBonus';

/** Couleur d'une étiquette ou d'un secteur (triangle du coin, étiquettes de mission) */
export type FaceColor = 'red' | 'yellow' | 'blue' | 'black';

/** Morceau de la ligne d'effet : gains dessinés, gain sous condition (étiquette + gains), ou texte faute de symbole */
export type EffectSegment =
  | { kind: 'bonus'; bonus: Bonus; caption?: string }
  | { kind: 'conditional'; label: string; reward: Bonus; color?: FaceColor }
  | { kind: 'text'; text: string; effectType: string }
  /** « ou » entre deux choix de gains (carte 126 : rotation + Exploration / rotation + Observation) */
  | { kind: 'or' }
  /** Gain dessiné avec des symboles de condition (orbite / atterrissage) */
  | { kind: 'symbols'; symbols: ConditionSymbol[] };

/**
 * Morceau d'une condition (onglet d'une mission déclenchable, condition d'une mission conditionnelle ou d'un décompte),
 * dessiné avec les symboles du glossaire ; `text` pour les mots qui restent (« sur Jupiter », « Pour chaque »).
 */
export type ConditionSymbol =
  | { kind: 'text'; text: string }
  /** `embedded` : le nombre est incrusté dans le symbole, comme pour les ressources (ET.52 à ET.54) */
  | { kind: 'lifetrace'; color?: 'red' | 'yellow' | 'blue'; count?: number; embedded?: boolean }
  | { kind: 'signal'; color?: FaceColor; count?: number }
  | { kind: 'action'; action: 'launch' | 'orbit' | 'land' | 'scan' }
  /** `repeat` : le symbole est répété autant de fois que le nombre, même au-delà de 3 (ET.49) */
  | { kind: 'orbiterOrLander' | 'orbiter' | 'lander'; count?: number; repeat?: boolean }
  /** Mission accomplie, répétée `count` fois (ET.55) */
  | { kind: 'missionDone'; count: number }
  | { kind: 'tech'; category?: TechnologyCategory; count?: number }
  | { kind: 'covered'; color?: FaceColor; count?: number }
  | { kind: 'bonus'; bonus: Bonus }
  /** Jeton Mascamite ; `resolved` : coche verte, on gagne la récompense du spécimen */
  | { kind: 'specimen'; resolved?: boolean }
  /** Retour à la ligne (« (lunes comprises) » sous « sur Saturne ») */
  | { kind: 'break' };

/** Cercle d'une mission : condition (symboles, et son texte complet) et récompense (index = index du prérequis de la mission) */
export interface MissionCircle {
  label: string;
  /** Condition dessinée (onglet ou partie gauche) ; vide : `label` écrit */
  symbols: ConditionSymbol[];
  color?: FaceColor;
  reward: Bonus;
  /** Récompense sans symbole (spécimen…) : écrite en texte */
  rewardText?: string;
  /** Déclencheur entièrement dit par l'intitulé (toute planète, tout champ d'astéroïdes) : pas d'onglet */
  noCriterion?: boolean;
  /** Précision sous la récompense (« pour cette espèce », carte 102) */
  rewardCaption?: string;
  /** Récompense dessinée en plus des gains (spécimen résolu des Mascamites, phrase avec symboles) */
  rewardSymbols?: ConditionSymbol[];
  effectType: string;
}

export interface MissionPanel {
  kind: 'triggered' | 'conditional';
  /** Intitulé commun (« Lorsque vous visitez : ») quand tous les cercles ont le même déclencheur */
  intro?: string;
  circles: MissionCircle[];
}

/** Panneau doré (fin de partie) ou de réception (Centauriens) : condition en texte et récompense */
export interface ScorePanel {
  kind: 'endGame' | 'reception';
  text: string;
  /** Condition dessinée ; vide : `text` écrit */
  symbols: ConditionSymbol[];
  reward: Bonus;
  /** Récompense écrite en phrase autour de son symbole (Centauriens : « Augmentez vos [revenu] grâce à cette carte. ») */
  rewardSentence?: { before: string; after: string };
}

export interface CardFaceModel {
  id: string;
  name: string;
  type: CardType;
  /** Coin supérieur gauche (absent pour un Exertien) */
  freeAction: Bonus | null;
  freeActionType?: FreeActionType;
  /** Coin supérieur droit */
  sector: SectorType | null;
  sectorColor?: FaceColor;
  /** Pied de carte */
  revenue: Bonus | null;
  revenueType?: RevenueType;
  /** Badge de coût (absent pour un Exertien) */
  cost: { amount: number; kind: 'credit' | 'energy' } | null;
  danger?: number;
  effects: EffectSegment[];
  mission?: MissionPanel;
  scorePanel?: ScorePanel;
  /** Texte propre à la carte, hors missions et fin de partie, sans ce que disent déjà les symboles */
  text: string;
  /** Précision du gain dessiné, écrite à sa droite (12 : « sur une planète… », 81 : « qu'un autre joueur possède déjà ») */
  inlineText?: string;
  /** Gains annoncés à la fin du texte (« … pour gagner : »), dessinés en grand à la ligne, sans virgule (carte 15) */
  textGains?: Bonus[];
  /** Mot écrit devant ces gains (« Puis », ET.25) */
  textGainsLead?: string;
}

const SECTOR_COLORS: Partial<Record<SectorType, FaceColor>> = {
  [SectorType.RED]: 'red', [SectorType.YELLOW]: 'yellow', [SectorType.BLUE]: 'blue', [SectorType.BLACK]: 'black',
};

const COLOR_NAMES: Record<string, { color?: FaceColor; name: string }> = {
  red: { color: 'red', name: 'rouge' }, yellow: { color: 'yellow', name: 'jaune' }, blue: { color: 'blue', name: 'bleu' },
  black: { color: 'black', name: 'noir' }, any: { name: 'au choix' },
};

const PLACES: Record<string, string> = {
  mercury: 'Mercure', venus: 'Vénus', earth: 'Terre', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne',
  uranus: 'Uranus', neptune: 'Neptune', oumuamua: 'Oumuamua', planet: 'Planète', asteroid: 'Astéroïdes',
  'uranus&neptune': 'Uranus et Neptune', total: 'Planètes',
};

const TECH_NAMES: Record<string, string> = { yellow: 'Tech. Exploration', red: 'Tech. Observation', blue: 'Tech. Informatique', any: 'Technologie' };

/** « res:val[:res:val] » → bonus (récompenses écrites comme celles des missions) */
const rewardsOf = (text: string): Bonus => CardSystem.parseRewards(text.split(':'));

const isEmptyBonus = (bonus: Bonus): boolean => Object.values(bonus).every(v => v === undefined || v === 0 || (Array.isArray(v) && v.length === 0));

// --- Effets immédiats (colonne Gain) : chaque effet devient un bonus, dans l'ordre du CSV ------------

const IMMEDIATE: Partial<Record<string, (effect: CardEffect) => Bonus>> = {
  'GAIN:CREDIT': e => ({ credits: effectNumber(e) }),
  'GAIN:ENERGY': e => ({ energy: effectNumber(e) }),
  'GAIN:DATA': e => ({ data: effectNumber(e) }),
  'GAIN:MEDIA': e => ({ media: effectNumber(e) }),
  'GAIN:CARD': e => ({ card: effectNumber(e) }),
  'GAIN:PROBE': e => ({ probe: effectNumber(e) }),
  'GAIN:TOKEN': e => ({ token: effectNumber(e) }),
  'ACTION:ANYCARD': e => ({ anycard: effectNumber(e) }),
  'ACTION:ROTATION': e => ({ rotation: effectNumber(e) }),
  'ACTION:LAND': e => ({ landing: effectNumber(e) }),
  'ACTION:MOVEMENT': e => ({ movements: effectNumber(e) }),
  'ACTION:SCAN': e => ({ scan: effectNumber(e) }),
  'ACTION:TECH': e => ({ technologies: [effectAmount<TechnologyCategory>(e)] }),
  'ACTION:SIGNAL': e => ({ signals: [effectAmount<SectorType>(e)] }),
  'ACTION:LIFETRACE': e => ({ lifetraces: [effectAmount<LifeTraceType>(e)] }),
};

/**
 * Signal dans le secteur d'une étoile : signal à la couleur de son secteur (plateau, engine/Board.ts) et « sur Sirius A » ;
 * dans le secteur d'une planète : symbole de la planète et « sur Saturne »
 */
const STAR_SECTORS: Partial<Record<SectorType, { name: string; color: SectorType }>> = {
  [SectorType.KEPLER]: { name: 'Kepler-22', color: SectorType.YELLOW },
  [SectorType.VIRGINIS]: { name: '61 Virginis', color: SectorType.YELLOW },
  [SectorType.PROXIMA]: { name: 'Proxima du Centaure', color: SectorType.RED },
  [SectorType.BARNARD]: { name: 'l\'Étoile de Barnard', color: SectorType.RED },
  [SectorType.SIRIUS]: { name: 'Sirius A', color: SectorType.BLUE },
  [SectorType.PROCYON]: { name: 'Procyon', color: SectorType.BLUE },
  [SectorType.VEGA]: { name: 'Véga', color: SectorType.BLACK },
  [SectorType.PICTORIS]: { name: 'Beta Pictoris', color: SectorType.BLACK },
};
const PLANET_SECTORS: Partial<Record<SectorType, string>> = {
  [SectorType.EARTH]: 'la Terre', [SectorType.MERCURY]: 'Mercure', [SectorType.VENUS]: 'Vénus', [SectorType.MARS]: 'Mars',
  [SectorType.JUPITER]: 'Jupiter', [SectorType.SATURN]: 'Saturne', [SectorType.OUMUAMUA]: 'Oumuamua',
};

/**
 * Signal là où se trouve une sonde (27-30, 88, 118, 120, 134) ou dans le secteur d'une anomalie (ET.14) : pas de symbole à part,
 * la phrase de la carte le dessine (signal quelconque)
 */
const SENTENCE_SIGNAL_SCOPES = new Set<SectorType>([SectorType.PROBE, SectorType.ANOMALY, SectorType.NEXT_ANOMALY]);
export const isSentenceSignal = (effect: CardEffect): boolean =>
  `${effect.type}:${effect.target}` === 'ACTION:SIGNAL' && SENTENCE_SIGNAL_SCOPES.has(effectAmount<SectorType>(effect).scope);

function immediateSegment(effect: CardEffect): EffectSegment {
  const key = `${effect.type}:${effect.target}`;
  if (key === 'ACTION:SIGNAL') {
    const { amount, scope } = effectAmount<SectorType>(effect);
    const star = STAR_SECTORS[scope];
    if (star) return { kind: 'bonus', bonus: { signals: [{ amount, scope: star.color }] }, caption: `sur ${star.name}` };
    const planet = PLANET_SECTORS[scope];
    if (planet) return { kind: 'bonus', bonus: { signals: [{ amount, scope }] }, caption: `dans le secteur ${/^[AEIOUÉ]/.test(planet) ? 'd\'' : 'de '}${planet}` };
  }
  const toBonus = IMMEDIATE[key];
  return toBonus ? { kind: 'bonus', bonus: toBonus(effect) } : { kind: 'text', text: key, effectType: key };
}

// --- Effets de la colonne Contrainte (hors missions et fin de partie) ---------------------------------

type SegmentOf = (effect: CardEffect, card: Card) => EffectSegment;
const text = (effectType: string, label: string): SegmentOf => () => ({ kind: 'text', text: label, effectType });

/**
 * Effets de la colonne Contrainte qui sont des gains (la colonne Gain ne les porte pas : le moteur les lit ici) :
 * atterrissage des Mascamites, orbite ou atterrissage (ET.3), carte piochée (11). Dessinés avec les autres gains.
 */
export const EFFECT_SYMBOLS: Partial<Record<string, SegmentOf>> = {
  GAIN_LANDING_AND_SPECIMEN: () => ({ kind: 'bonus', bonus: { landing: 1 } }),
  GAIN_SATELLITE_LANDING_AND_SPECIMEN: () => ({ kind: 'bonus', bonus: { landing: 1 } }),
  GAIN_ORBIT_OR_LAND_AND_SPECIMEN: () => ({ kind: 'symbols', symbols: [{ kind: 'action', action: 'orbit' }, { kind: 'text', text: '/' }, { kind: 'action', action: 'land' }] }),
  REVEAL_AND_TRIGGER_FREE_ACTION: () => ({ kind: 'bonus', bonus: { anycard: 1 } }),
};

/**
 * Gains sous condition : la phrase de la carte les dit, écrite avec ses symboles (« Si vous visitez Mercure ce tour-ci,
 * gagnez [4 PV] ») ; pas de segment à part
 */
const SENTENCE_EFFECTS = new Set([
  'VISIT_BONUS', 'VISIT_UNIQUE', 'VISIT_ASTEROID', 'VISIT_COMET', 'SAME_DISK_MOVE', 'GAIN_LIFETRACE_IF_ASTEROID', 'BONUS_IF_COVERED',
  'MEDIA_IF_SHARED_TECH', 'LAND_BONUS', 'DISCARD_TOKEN_FOR', 'DISCARD_TOKENS_THEN_LAND', 'OUMUAMUA_SIGNAL_BONUS', 'GAIN_LIFETRACE_IF_ALREADY',
  'GAIN_LIFETRACE_IF_MEDIA', 'GAIN_SIGNAL_ADJACENTS', 'ANY_PROBE',
]);

/** Effets sans symbole : texte court affiché dans la ligne d'effet (le texte complet reste celui de la carte) */
export const TEXT_EFFECTS: Partial<Record<string, SegmentOf>> = {
  IGNORE_PROBE_LIMIT: text('IGNORE_PROBE_LIMIT', 'Limite de sondes ignorée'),
  IGNORE_SATELLITE_LIMIT: text('IGNORE_SATELLITE_LIMIT', 'Lune sans technologie'),
  ATMOSPHERIC_ENTRY: text('ATMOSPHERIC_ENTRY', 'Retirez un orbiteur'),
  OSIRIS_REX_BONUS: text('OSIRIS_REX_BONUS', 'Gains des astéroïdes'),
  CHOICE_MEDIA_OR_MOVE: text('CHOICE_MEDIA_OR_MOVE', 'Média ou déplacement'),
  ASTEROID_EXIT_COST: text('ASTEROID_EXIT_COST', 'Sortie des astéroïdes gratuite'),
  GAIN_SIGNAL_ADJACENTS: text('GAIN_SIGNAL_ADJACENTS', 'Secteurs adjacents'),
  ANY_PROBE: text('ANY_PROBE', 'Sondes de tous les joueurs'),
  SCORE_IF_UNIQUE: (e) => ({ kind: 'text', text: `${effectNumber(e)} PV par secteur différent`, effectType: 'SCORE_IF_UNIQUE' }),
  SCORE_PER_SECTOR: (e) => ({ kind: 'text', text: `${effectNumber(e)} PV par signal ${COLOR_NAMES[e.target ?? '']?.name ?? ''}`.trim(), effectType: 'SCORE_PER_SECTOR' }),
  GAIN_SIGNAL_FROM_HAND: (e) => ({ kind: 'text', text: `Défaussez jusqu'à ${effectNumber(e)} carte${effectNumber(e) > 1 ? 's' : ''} pour leur signal`, effectType: 'GAIN_SIGNAL_FROM_HAND' }),
  SCORE_PER_TECH_TYPE: (e) => ({ kind: 'text', text: `${effectNumber(e)} PV par type de technologie`, effectType: 'SCORE_PER_TECH_TYPE' }),
  DISCARD_ROW_FOR_FREE_ACTIONS: text('DISCARD_ROW_FOR_FREE_ACTIONS', 'Rangée défaussée : actions gratuites'),
  REVEAL_MOVEMENT_CARDS_FOR_BONUS: text('REVEAL_MOVEMENT_CARDS_FOR_BONUS', 'Cartes Déplacement révélées'),
  SCORE_PER_TRACE: text('SCORE_PER_TRACE', 'PV selon la couleur de la trace'),
  SHARED_TECH_ONLY_NO_BONUS: text('SHARED_TECH_ONLY_NO_BONUS', 'Technologie déjà prise, sans bonus'),
  SAMPLE_RETURN: text('SAMPLE_RETURN', 'Retirez un atterrisseur'),
  GAIN_ENERGY_PER_ENERGY_REVENUE: text('GAIN_ENERGY_PER_ENERGY_REVENUE', 'Énergie par revenu énergie'),
  GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE: text('GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE', 'Énergie par revenu énergie, carte réservée'),
  GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE: text('GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE', 'Média par revenu carte, carte réservée'),
  GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE: text('GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE', 'PV par revenu crédit, carte réservée'),
  NO_DATA: text('NO_DATA', 'Sans donnée'),
  NO_MEDIA: text('NO_MEDIA', 'Sans Média'),
  SCORE_PER_MEDIA: (e) => ({ kind: 'text', text: `${effectNumber(e)} PV par Média`, effectType: 'SCORE_PER_MEDIA' }),
  KEEP_CARD_IF_ONLY: text('KEEP_CARD_IF_ONLY', 'Gardez la carte si elle est seule'),
  OPTIMAL_LAUNCH_WINDOW: text('OPTIMAL_LAUNCH_WINDOW', 'Fenêtre de lancement'),
  GAIN_SPECIMEN_BONUS: text('GAIN_SPECIMEN_BONUS', 'Consultez un spécimen'),
  TAKE_CARD_ROW: text('TAKE_CARD_ROW', 'Prenez la rangée'),
  DISCARD_DRAWN_FOR_ACTION_AND_REVENUE: text('DISCARD_DRAWN_FOR_ACTION_AND_REVENUE', 'Cartes piochées : action et revenu'),
  GAIN_MOVE_IF_ANOMALY: text('GAIN_MOVE_IF_ANOMALY', 'Déplacement si Terre sur une anomalie'),
  GAIN_REWARD_NEXT_ANOMALY: text('GAIN_REWARD_NEXT_ANOMALY', 'Récompense de la prochaine anomalie'),
  SCORE_PER_ANOMALY: (e) => ({ kind: 'text', text: `${effectNumber(e)} PV par signal sur une anomalie`, effectType: 'SCORE_PER_ANOMALY' }),
};

/** Texte du panneau de réception des cartes Centauriens */
export const RECEPTION_TEXT = 'À réception du message.';

/** Effets lus dans le panneau de fin de partie ou de réception, pas dans la ligne d'effet (PV : valeur du décompte) */
const SCORE_EFFECTS: Partial<Record<string, (effect: CardEffect) => Bonus>> = {
  SCORE_PER_ORBITER_LANDER: e => ({ pv: effectNumber(e) }),
  SCORE_PER_COVERED_SECTOR: e => ({ pv: effectNumber(e) }),
  SCORE_PER_LIFETRACE: e => ({ pv: effectNumber(e) }),
  SCORE_PER_SIGNAL: e => ({ pv: effectNumber(e) }),
  SCORE_PER_TECH_CATEGORY: e => ({ pv: effectNumber(e) }),
  SCORE_IF_PROBE_ON_ASTEROID: e => ({ pv: effectNumber(e) }),
  SCORE_PER_SPECIES_LIFETRACE: e => ({ pv: effectNumber(e) }),
  SCORE_SOLVAY: () => ({}),
  END_CONDITION: e => ({ pv: parseInt(effectString(e).split(':').pop() ?? '', 10) || 0 }),
};
const RECEPTION_EFFECTS: Partial<Record<string, (effect: CardEffect, card: Card) => Bonus>> = {
  RECEPTION: e => rewardsOf(effectString(e)),
  // Seul le symbole du revenu : la ressource gagnée en réservant la carte ne fait pas partie de la réception
  RECEPTION_REVENUE: () => ({ revenue: 1 }),
};

// --- Missions : un cercle par prérequis (ordre de mission.requirements = ordre de card.permanentEffects) ---

/** Déclencheur d'une mission déclenchable : intitulé commun (seulement s'il est nécessaire), onglet dessiné, libellé */
function triggerOf(type: string): { intro?: string; symbols: ConditionSymbol[]; label: string; color?: FaceColor; noCriterion?: boolean } | null {
  const visit = type.match(/^GAIN_ON_VISIT_(\w+)$/);
  if (visit) {
    const place = PLACES[visit[1].toLowerCase()] ?? visit[1];
    // Toute planète (128) ou tout champ d'astéroïdes (129) : l'intitulé dit tout, pas d'onglet
    if (visit[1] === 'PLANET') return { intro: 'Lorsque vous visitez une planète (sauf la Terre) :', symbols: [], label: 'Planète', noCriterion: true };
    if (visit[1] === 'ASTEROID') return { intro: 'Lorsque vous visitez un champ d\'astéroïdes lors de votre tour :', symbols: [], label: 'Astéroïdes', noCriterion: true };
    return { intro: 'Lorsque vous visitez :', symbols: [{ kind: 'text', text: place }], label: place };
  }
  const colored = type.match(/^GAIN_ON_(YELLOW|RED|BLUE|ANY)_(SIGNAL|TECH|LIFETRACE)$/);
  if (colored) {
    const key = colored[1].toLowerCase();
    const color = COLOR_NAMES[key]?.color;
    if (colored[2] === 'SIGNAL') return { symbols: [{ kind: 'signal', color }], label: `Signal ${COLOR_NAMES[key].name}`, color };
    if (colored[2] === 'TECH') return { symbols: [{ kind: 'tech', category: TECH_CATEGORIES[key] }], label: TECH_NAMES[key], color };
    const traceColor = TRACE_COLORS[key];
    return { symbols: [{ kind: 'lifetrace', color: traceColor }], label: key === 'any' ? 'Trace au choix' : `Trace ${COLOR_NAMES[key].name}`, color };
  }
  const play = type.match(/^GAIN_ON_PLAY_(\d)_CREDITS?$/);
  if (play) return { intro: 'Lorsque vous payez ce coût pour jouer une carte en tant qu\'action principale :', symbols: [{ kind: 'bonus', bonus: { credits: Number(play[1]) } }], label: `${play[1]} crédit${play[1] === '1' ? '' : 's'}` };
  const discard = type.match(/^GAIN_ON_DISCARD_(MEDIA|DATA|MOVE)$/);
  if (discard) {
    const gains: Record<string, Bonus> = { MEDIA: { media: 1 }, DATA: { data: 1 }, MOVE: { movements: 1 } };
    const names: Record<string, string> = { MEDIA: 'Média', DATA: 'Donnée', MOVE: 'Déplacement' };
    return { intro: 'Lorsque vous défaussez une carte de votre main pour cette action gratuite :', symbols: [{ kind: 'bonus', bonus: gains[discard[1]] }], label: names[discard[1]] };
  }
  // Actions : le symbole suffit, sans intitulé
  const actions: Record<string, { symbols: ConditionSymbol[]; label: string }> = {
    GAIN_ON_ORBIT: { symbols: [{ kind: 'action', action: 'orbit' }], label: 'Mise en orbite' },
    GAIN_ON_LAND: { symbols: [{ kind: 'action', action: 'land' }], label: 'Atterrissage' },
    GAIN_ON_ORBIT_OR_LAND: { symbols: [{ kind: 'action', action: 'orbit' }, { kind: 'text', text: '/' }, { kind: 'action', action: 'land' }], label: 'Orbite ou atterrissage' },
    GAIN_ON_LAUNCH: { symbols: [{ kind: 'action', action: 'launch' }], label: 'Lancement' },
    GAIN_ON_SCAN: { symbols: [{ kind: 'action', action: 'scan' }], label: 'Scan' },
  };
  return actions[type] ?? null;
}

const TECH_CATEGORIES: Record<string, TechnologyCategory | undefined> = {
  yellow: TechnologyCategory.EXPLORATION, exploration: TechnologyCategory.EXPLORATION,
  red: TechnologyCategory.OBSERVATION, observation: TechnologyCategory.OBSERVATION,
  blue: TechnologyCategory.COMPUTING, computing: TechnologyCategory.COMPUTING,
  any: undefined,
};
const TRACE_COLORS: Record<string, 'red' | 'yellow' | 'blue' | undefined> = { red: 'red', yellow: 'yellow', blue: 'blue' };
const RGB_TRACES: ConditionSymbol[] = [{ kind: 'lifetrace', color: 'red' }, { kind: 'lifetrace', color: 'yellow' }, { kind: 'lifetrace', color: 'blue' }];
const words = (value: string): ConditionSymbol => ({ kind: 'text', text: value });
/** « sur Jupiter », et « (lunes comprises) » sur la ligne suivante si le texte de la carte le dit */
const onPlace = (target: string | undefined, chunk: string): ConditionSymbol[] => [
  words(`sur ${PLACES[target ?? ''] ?? target}`),
  ...(/lunes comprises/i.test(chunk) ? [{ kind: 'break' } as ConditionSymbol, words('(lunes comprises)')] : []),
];

/** Condition d'une mission conditionnelle en symboles (comme la FAQ : « Amener le [spécimen] sur Terre ») ; null : texte de la carte */
function conditionSymbols(type: string, target: string | undefined, chunk: string): { symbols: ConditionSymbol[]; color?: FaceColor } | null {
  const color = COLOR_NAMES[target ?? '']?.color;
  const trace = TRACE_COLORS[target ?? ''];
  const count = Number(chunk.match(/(\d+)\s+(?:atterr|orbit)/i)?.[1]) || undefined;
  switch (type) {
    case 'GAIN_IF_ORBITER_OR_LANDER':
      return target === 'total' ? { symbols: [{ kind: 'orbiterOrLander', count }] } : { symbols: [{ kind: 'orbiterOrLander' }, ...onPlace(target, chunk)] };
    case 'GAIN_IF_ORBITER_AND_LANDER': return { symbols: [{ kind: 'orbiter' }, words('+'), { kind: 'lander' }, words('sur une même planète')] };
    case 'GAIN_IF_2_ORBITERS': return { symbols: [{ kind: 'orbiter', count: 2 }] };
    case 'GAIN_IF_3_LANDERS': return { symbols: [{ kind: 'lander', count: 3 }, ...(/hors lunes/i.test(chunk) ? [words('(hors lunes)')] : [])] };
    case 'GAIN_IF_LANDER': return { symbols: [{ kind: 'lander' }, ...onPlace(target, chunk)] };
    case 'GAIN_IF_COVERED':
      if (target === 'same') return { symbols: [{ kind: 'covered', count: 2 }, words('même secteur')] };
      return { symbols: [{ kind: 'covered', color, count: /2 secteurs/i.test(chunk) ? 2 : undefined }], color };
    case 'GAIN_IF_4_SIGNALS': return { symbols: [{ kind: 'signal' }, words('dans 4 secteurs différents')] };
    case 'GAIN_IF_8_MEDIA': return { symbols: [words('Avoir au moins'), { kind: 'bonus', bonus: { media: 8 } }] };
    case 'GAIN_IF_50_PV': return { symbols: [words('Avoir au moins'), { kind: 'bonus', bonus: { pv: 50 } }] };
    case 'GAIN_IF_EMPTY_HAND': return { symbols: [words('Aucune carte en main')] };
    case 'GAIN_IF_3_TECH_OBS': return { symbols: [{ kind: 'tech', category: TechnologyCategory.OBSERVATION, count: 3 }] };
    case 'GAIN_IF_3_TOKEN': return { symbols: [words('Avoir au moins'), { kind: 'bonus', bonus: { token: 3 } }] };
    case 'GAIN_IF_PAY_FOR_LIFETRACE': return { symbols: [{ kind: 'lifetrace' }, words('payée en jetons')] };
    case 'GAIN_IF_SIGNAL': return { symbols: [{ kind: 'signal' }, ...onPlace(target, chunk)] };
    case 'GAIN_IF_SPECIMEN': return { symbols: [words('Amener le'), { kind: 'specimen' }, ...onPlace(target, chunk)] };
    case 'GAIN_IF_3_LIFETRACES': return target === 'different' ? { symbols: [...RGB_TRACES, { kind: 'break' }, words('pour une même espèce')] } : { symbols: [{ kind: 'lifetrace', color: trace, count: 3 }], color };
    case 'GAIN_IF_2_LIFETRACES': return { symbols: [{ kind: 'lifetrace', color: trace, count: 2 }, words('pour cette espèce')], color };
    case 'GAIN_IF_LIFETRACE_BOTH_SPECIES': return { symbols: [{ kind: 'lifetrace', color: trace }, words('sur chaque espèce')], color };
    case 'GAIN_IF_LIFETRACES_ALL_COLORS': return { symbols: [...RGB_TRACES, words('pour cette espèce')] };
    default: return null;
  }
}

/** Condition d'un décompte de fin de partie en symboles (PV à droite) ; null : texte de la carte */
function scoreSymbols(effect: CardEffect, chunk: string): ConditionSymbol[] | null {
  const target = effect.target;
  const each = words('pour chaque');
  switch (effect.type) {
    case 'SCORE_PER_ORBITER_LANDER': return [each, { kind: 'orbiterOrLander' }, ...onPlace(target, chunk)];
    case 'SCORE_PER_COVERED_SECTOR': return [each, { kind: 'covered', color: COLOR_NAMES[target ?? '']?.color }];
    case 'SCORE_PER_LIFETRACE': return [each, { kind: 'lifetrace', color: TRACE_COLORS[target ?? ''] }];
    case 'SCORE_PER_SIGNAL': return [words('pour chaque secteur où vous avez un signal')];
    case 'SCORE_PER_TECH_CATEGORY': return [each, { kind: 'tech', category: TECH_CATEGORIES[target ?? ''] }];
    case 'SCORE_IF_PROBE_ON_ASTEROID': return [words('Si vous avez une sonde sur un champ d\'astéroïdes')];
    case 'SCORE_PER_SPECIES_LIFETRACE': return [each, { kind: 'lifetrace' }, words('de cette espèce')];
    case 'END_CONDITION': {
      const [param, threshold] = effectString(effect).split(':');
      const n = Number(threshold) || undefined;
      switch (target) {
        case 'TECH': return [{ kind: 'tech', category: TECH_CATEGORIES[param], count: n }];
        case 'COVERED': return [{ kind: 'covered', color: COLOR_NAMES[param]?.color, count: n }];
        case 'ORBITERS': return [{ kind: 'orbiter', count: n }];
        // Les atterrisseurs sur une ligne, la précision dessous (ET.49)
        case 'LANDERS': return [{ kind: 'lander', count: n, repeat: true }, { kind: 'break' }, words('(lunes comprises)')];
        // ET.50 : deux lignes au plus, de longueurs proches (les symboles et « sur une même », puis « planète (lunes comprises) »)
        case 'SAME_PLANET': return [{ kind: 'orbiterOrLander', count: n }, words('sur une même'), { kind: 'break' }, words('planète (lunes comprises)')];
        case 'RESERVED': return [words(`${n} cartes réservées`)];
        case 'MISSIONS': return [{ kind: 'missionDone', count: n ?? 1 }];
        case 'TRACES_SAME_COLOR': return [{ kind: 'lifetrace', count: n, embedded: true }, words('de la même couleur')];
        case 'TRACES_SPECIES': return [{ kind: 'lifetrace', count: n, embedded: true }, words(param === 'this' ? 'pour cette espèce' : 'pour les autres espèces')];
        default: return null;
      }
    }
    default: return null;
  }
}

/**
 * Récompense d'une mission Mascamite en symboles : ramener un spécimen (ET.1 à ET.4, ET.6) donne aussi sa récompense
 * (jeton résolu) ; ET.7 la donne deux fois ; ET.8 à ET.10 font consulter un spécimen de Jupiter ou Saturne
 */
function specimenReward(type: string, parts: string[]): ConditionSymbol[] | undefined {
  const specimenIndex = parts.indexOf('specimen');
  const resolved: ConditionSymbol = { kind: 'specimen', resolved: true };
  if (type === 'GAIN_IF_SPECIMEN') {
    return specimenIndex === -1 ? [resolved] : [words('Résolvez'), resolved, words('deux fois')];
  }
  if (specimenIndex !== -1) {
    return [words('Choisissez Jupiter ou Saturne. Consultez tous ses'), { kind: 'specimen' }, words(', choisissez-en un, gagnez sa récompense, puis remettez-le en place.')];
  }
  return undefined;
}

/** Couleur d'un secteur écrite dans le texte (« un Signal dans un secteur Rouge ») */
const SIGNAL_WORD_COLORS: Partial<Record<string, FaceColor>> = { rouge: 'red', jaune: 'yellow', bleu: 'blue', noir: 'black' };

/**
 * Texte écrit avec ses symboles : les ressources chiffrées (« 4 PVs », « 1 Donnée »), les traces de vie, orbiteurs,
 * atterrisseurs et jetons Mascamites deviennent les symboles du glossaire ; le reste reste en mots
 */
export function richText(value: string): ConditionSymbol[] {
  const pattern = /\n|\b(\d+|une?|chaque)\s+Signa(?:l|ux)\b(?:\s+dans un secteur (Rouge|Jaune|Bleu|Noir)\b)?|(\d+)\s*(PVs?|Données?|Médias?|Crédits?|[EÉ]nergies?|Cartes?|Pioches?|Déplacements?|Atterrissages?|Tokens?)\b|(?:(\d+|une?)\s+)?Traces? de Vie(?:\s+(Rouges?|Jaunes?|Bleue?s?))?|\b(orbiteurs?|atterrisseurs?)\b|(?:jetons|spécimen|specimen)s? Mascamites?/gi;
  const symbols: ConditionSymbol[] = [];
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    const before = value.slice(last, match.index).trim();
    if (before) symbols.push(words(before));
    last = match.index! + match[0].length;
    const [whole, signalCount, signalColor, amount, resource, traceCount, traceColor, piece] = match;
    if (whole === '\n') {
      symbols.push({ kind: 'break' });
    } else if (signalCount) {
      // Signal dans la phrase : quelconque, ou de la couleur du secteur (« un Signal dans un secteur Rouge » : 52-54)
      const count = /^\d+$/.test(signalCount) ? Number(signalCount) : 1;
      const color = signalColor ? SIGNAL_WORD_COLORS[signalColor.toLowerCase()] : undefined;
      // « chaque signal » (ET.21) : le mot reste, le signal est dessiné
      if (/^chaque$/i.test(signalCount)) {
        const previous = symbols[symbols.length - 1];
        if (previous?.kind === 'text') symbols[symbols.length - 1] = words(`${previous.text} ${signalCount}`);
        else symbols.push(words(signalCount));
      }
      symbols.push({ kind: 'signal', ...(color ? { color } : {}), count: count > 1 ? count : undefined });
    } else if (resource) {
      const n = Number(amount);
      const key = resource.toLowerCase();
      const bonus: Bonus = key.startsWith('pv') ? { pv: n } : key.startsWith('donn') ? { data: n } : key.startsWith('méd') ? { media: n }
        : key.startsWith('créd') ? { credits: n } : /^[eé]ner/.test(key) ? { energy: n } : key.startsWith('pioch') ? { card: n }
        : key.startsWith('carte') ? { anycard: n } : key.startsWith('dépl') ? { movements: n } : key.startsWith('atter') ? { landing: n } : { token: n };
      symbols.push({ kind: 'bonus', bonus });
    } else if (piece) {
      symbols.push({ kind: piece.toLowerCase().startsWith('orbit') ? 'orbiter' : 'lander' });
    } else if (/mascamite/i.test(whole)) {
      symbols.push({ kind: 'specimen' });
    } else {
      const color = traceColor ? TRACE_COLORS[{ r: 'red', j: 'yellow', b: 'blue' }[traceColor[0].toLowerCase() as 'r' | 'j' | 'b']] : undefined;
      const count = traceCount && /^\d+$/.test(traceCount) ? Number(traceCount) : undefined;
      symbols.push({ kind: 'lifetrace', color, count: count && count > 1 ? count : undefined });
    }
  }
  const rest = value.slice(last).trim();
  if (rest) symbols.push(words(rest));
  return symbols;
}

function missionPanel(card: Card): MissionPanel | undefined {
  const isMission = card.type === CardType.TRIGGERED_MISSION || card.type === CardType.CONDITIONAL_MISSION;
  const requirements = card.permanentEffects.filter(e => e.type.startsWith('GAIN_ON_') || e.type.startsWith('GAIN_IF_'));
  if (!isMission || requirements.length === 0) return undefined;
  const chunks = descriptionChunks(card.description).filter(c => c.header === 'Mission:').map(c => c.content);
  // Intitulé commun seulement si tous les cercles en ont un, le même (visites, cartes jouées, défausses)
  const intros = new Set<string | undefined>();
  const circles = requirements.map((effect, index): MissionCircle => {
    const parsed = CardSystem.parseMission(effectString(effect));
    const reward = parsed?.rewards ?? {};
    const chunk = chunks[index] ?? '';
    const trigger = triggerOf(effect.type);
    const condition = trigger ? null : conditionSymbols(effect.type, parsed?.target, chunk);
    if (trigger) intros.add(trigger.intro);
    const fallback = chunks[index] ?? effect.type;
    const specimen = (parsed?.parts ?? []).includes('specimen');
    const rewardSymbols = specimenReward(effect.type, parsed?.parts ?? []);
    return {
      // Déclenchable : étiquette courte ; conditionnelle : la condition écrite comme sur la carte (« Avoir un signal dans 4 secteurs »)
      label: trigger?.label ?? (chunks[index] ? conditionText(chunks[index]) : fallback),
      symbols: trigger?.symbols ?? condition?.symbols ?? [],
      noCriterion: trigger?.noCriterion,
      rewardCaption: effect.type === 'GAIN_IF_3_LIFETRACES' && parsed?.target === 'different' ? 'pour cette espèce' : undefined,
      color: trigger?.color ?? condition?.color,
      reward,
      rewardText: rewardSymbols ? undefined : isEmptyBonus(reward) || specimen ? (specimen ? 'Spécimen' : fallback) : undefined,
      rewardSymbols,
      effectType: effect.type,
    };
  });
  const kind = card.type === CardType.TRIGGERED_MISSION ? 'triggered' : 'conditional';
  const intro = kind === 'triggered' && intros.size === 1 ? [...intros][0] : undefined;
  return { kind, intro, circles };
}

// --- Texte de la carte : seulement ce que les symboles ne disent pas ------------------------------

/** Verbe conjugué → infinitif (« avez » → « avoir », « marquez » → « marquer ») */
const infinitive = (verb: string): string => {
  const lower = verb.toLowerCase();
  const special: Record<string, string> = { avez: 'avoir', 'n\'avez': 'n\'avoir', êtes: 'être', faites: 'faire' };
  return special[lower] ?? lower.replace(/ez$/, 'er');
};
const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/**
 * Condition d'une mission ou d'un décompte, écrite comme sur les vraies cartes : « Gagnez 2 Médias si vous avez un signal
 * dans 4 secteurs » → « Avoir un signal dans 4 secteurs » ; « Gagnez 3 PVs pour chaque secteur Rouge… » → « Pour chaque secteur Rouge… ».
 */
export function conditionText(chunk: string): string {
  const text = chunk.trim().replace(/\.\s*$/, '');
  const ifClause = text.match(/\bsi vous (\S+)\s(.*?)(?:,\s*gagnez\b.*)?$/i);
  if (ifClause) return capitalize(`${infinitive(ifClause[1])} ${ifClause[2]}`);
  const perUnit = text.match(/^Gagnez\s+\d+\s*PVs?\s+(.*)$/i);
  if (perUnit) return capitalize(perUnit[1]);
  return text;
}

/** PV annoncés par le texte d'un décompte (« Gagnez 3 PVs pour chaque… »), quand aucun effet ne les porte */
const pvOfText = (chunk: string): Bonus => {
  const pv = chunk.match(/gagnez\s+(\d+)\s*PVs?/i);
  return pv ? { pv: Number(pv[1]) } : {};
};

/** Qualificatifs d'un gain que ses symboles disent déjà (secteur du signal, catégorie ou couleur au choix) */
const DRAWN_QUALIFIERS = /\s*(dans (?:un|le|les|n'importe quel) secteurs?(?: [^,]*)?|de n'importe quelle (?:couleur|catégorie))/gi;
/** Phrase qui ne fait que lister des gains (« Gagnez 2 sondes et 1 Média », « Piochez 1 Carte », « DANGER 6 ») */
const isGainsOnly = (sentence: string): boolean => {
  const bare = sentence.replace(/^Puis,?\s+/i, '').replace(DRAWN_QUALIFIERS, '').trim();
  if (/^DANGER \d+$/i.test(bare)) return true;
  if (!/^(Gagn?e?z|Gagez|Piochez)\s+(\d+|un|une)\s/i.test(bare)) return false;
  return !/\b(si|sur|même|pour chaque|chaque fois|lorsque|quand|après|puis|où|que|qui|ce tour|sans|grâce)\b|qu'/i.test(bare);
};

/** Texte propre à la carte : phrases de l'introduction qui ne répètent ni les gains dessinés ni un gain sous condition */
export function specificText(card: Card): string {
  return specificTextOf(card).text;
}

/**
 * Phrases propres à la carte. Une phrase qui commence par un gain déjà dessiné suivi de sa précision
 * (« Gagnez 1 Atterrissage sur une planète ou une lune… ») perd le gain : la précision s'écrit à droite du symbole (`inline`).
 */
function specificSentences(intro: string): { text: string; inline?: string } {
  let inline: string | undefined;
  const sentences = intro
    .replace(/\.(?=\S)/g, '. ')
    .split(/(?<=\.)\s+/)
    .map(sentence => sentence.trim())
    // Signal là où se trouve une sonde : la phrase reste, le signal y est dessiné
    // Atterrissage gagné après un autre effet (« Puis gagnez 1 Atterrissage », ET.25) : la phrase reste, le symbole y est dessiné
    .filter(sentence => sentence && (PROBE_SIGNAL_SENTENCE.test(sentence) || /^Puis gagnez \d+ Atterrissage/.test(sentence) || !isGainsOnly(sentence.replace(/\.$/, ''))))
    .filter((sentence, index) => {
      // Première phrase : gain dessiné suivi de sa précision (« sur une planète… », « qu'un autre joueur possède déjà »)
      const gainThenDetail = index === 0 ? sentence.match(/^(Gagnez \d+ .+?)\s+((?:sur |qu'un ).+)$/i) : null;
      if (gainThenDetail && isGainsOnly(gainThenDetail[1])) {
        inline = gainThenDetail[2];
        return false;
      }
      return true;
    });
  return { text: sentences.map((sentence, i) => lineBreaks(withoutDrawnVerb(sentence), i === sentences.length - 1)).join(' '), inline };
}

/** Phrase qui donne un signal là où se trouve une sonde (« … où se trouve l'une de vos sondes », « … dans son secteur ») */
const PROBE_SIGNAL_SENTENCE = /signa(?:l|ux)\b.*(?:l'une de vos sondes|dans son secteur)/i;

/**
 * Retours à la ligne d'une phrase (`\n`) : « …ce tour-ci, » puis « gagnez … » (22) ; la parenthèse qui termine le texte, à part (25),
 * pas celle d'une phrase suivie d'une autre (30)
 */
const lineBreaks = (sentence: string, last: boolean): string => {
  // Seulement si la première partie est courte : « Si vous visitez un champ d'astéroïdes ce tour-ci, » reste suivi de « gagnez » (123)
  const broken = sentence.replace(/^(.{0,32}ce tour-ci,)\s+(gagnez)/i, '$1\n$2');
  return last ? broken.replace(/\s+(\([^)]*\)\.?)$/, '\n$1') : broken;
};

/**
 * Phrase qui commence par son gain dessiné : sans « Gagnez » (le symbole suffit). Signal là où se trouve une sonde
 * (88, 118, 120, 134), PV « chaque fois que » (52-54), déplacement « pour chaque » après la sonde déjà dessinée (74)
 */
const withoutDrawnVerb = (sentence: string): string => sentence
  .replace(/^Gagnez \d+ Scans? et gagnez /, 'Gagnez ')
  .replace(/^Puis gagnez (?=\d+ Atterrissages?\.?$)/, 'Puis ')
  .replace(/^Gagnez \d+ Sondes? et (?=\d+ \S+ pour chaque)/, '')
  .replace(/^Gagnez (?=\d+ Signa(?:l|ux) dans un secteur où se trouve)/, '')
  .replace(/^Gagnez (?=\d+ PVs? chaque fois que)/, '');

/** Texte de la carte découpé en introduction, « Mission: », « Fin de jeu: », « Réception: » */
export function descriptionChunks(description: string): { header: string; content: string }[] {
  const parts = description.split(/(Mission:|Fin de jeu:|Réception:)/);
  const chunks = [{ header: '', content: parts[0].trim() }];
  for (let i = 1; i < parts.length; i += 2) chunks.push({ header: parts[i], content: (parts[i + 1] ?? '').trim() });
  return chunks;
}

/** « 1 Rotation + 1 Tech Exploration ou Observation » → rotation + Exploration / rotation + Observation (symboles existants) */
function splitTechChoice(effects: EffectSegment[]): EffectSegment[] {
  const choiceIndex = effects.findIndex(s => s.kind === 'bonus' && s.bonus.technologies?.some(t => t.scope === TechnologyCategory.EXPLORATION_OR_OBSERVATION));
  if (choiceIndex === -1) return effects;
  const choice = effects[choiceIndex] as Extract<EffectSegment, { kind: 'bonus' }>;
  const amount = choice.bonus.technologies!.find(t => t.scope === TechnologyCategory.EXPLORATION_OR_OBSERVATION)!.amount;
  const rotationIndex = effects.findIndex(s => s.kind === 'bonus' && !!s.bonus.rotation);
  const rotation: Bonus = rotationIndex === -1 ? {} : { rotation: (effects[rotationIndex] as Extract<EffectSegment, { kind: 'bonus' }>).bonus.rotation };
  const option = (scope: TechnologyCategory): EffectSegment => ({ kind: 'bonus', bonus: { ...rotation, technologies: [{ amount, scope }] } });
  return [
    ...effects.filter((_, i) => i !== choiceIndex && i !== rotationIndex),
    option(TechnologyCategory.EXPLORATION), { kind: 'or' }, option(TechnologyCategory.OBSERVATION),
  ];
}

/** Texte propre et sa place (à droite du gain qu'il précise, ou dessous) */
function specificTextOf(card: Card): { text: string; inlineText?: string; textGains?: Bonus[]; textGainsLead?: string } {
  const { text, inline } = specificSentences(descriptionChunks(card.description)[0].content);
  // « … pour gagner 3 PVs, 1 Donnée, 1 Carte. » : la phrase s'arrête à « pour gagner : », les gains passent à la ligne en symboles
  const tail = text.match(/^(.*\bpour gagner)\s+([^.]+)\.?$/);
  if (tail) {
    const parts = richText(tail[2]);
    const onlyGains = parts.every(p => p.kind === 'bonus' || (p.kind === 'text' && /^(,|et)?$/.test(p.text.trim())));
    if (onlyGains && parts.some(p => p.kind === 'bonus')) {
      // Un gain par symbole, dans l'ordre du texte
      const textGains = parts.flatMap(p => (p.kind === 'bonus' ? [p.bonus] : []));
      return { text: `${tail[1]} :`, inlineText: inline, textGains };
    }
  }
  // « … Puis 1 Atterrissage. » (ET.25) : « Puis » et l'atterrissage en grand, à la ligne
  const then = text.match(/^(.*?)\s*Puis (\d+) Atterrissages?\.$/);
  if (then) return { text: then[1], inlineText: inline, textGains: [{ landing: Number(then[2]) }], textGainsLead: 'Puis' };
  // Carte de mission dont la seule phrase précise l'atterrissage dessiné (« Si vous posez une sonde… », ET.30) : à droite du symbole
  const isMission = card.type === CardType.CONDITIONAL_MISSION || card.type === CardType.TRIGGERED_MISSION;
  if (!inline && isMission && /^Si vous posez une sonde[^.]*\.$/.test(text)) return { text: '', inlineText: text };
  return { text, inlineText: inline };
}

/** Décompte lu comme une phrase après ses PV (« 3 PV pour chaque… », « 13 PV si vous avez… ») : première lettre en minuscule */
function continueAfterPv(panel: ScorePanel): ScorePanel {
  const lower = (text: string) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text);
  const [first, ...rest] = panel.symbols;
  const symbols = first?.kind === 'text' ? [{ kind: 'text' as const, text: lower(first.text) }, ...rest] : panel.symbols;
  return { ...panel, text: lower(panel.text), symbols };
}

/** Description complète d'une carte pour sa face */
export function describeCard(card: Card): CardFaceModel {
  const isExertien = card.type === CardType.EXERTIEN;
  const chunks = descriptionChunks(card.description);
  const effects: EffectSegment[] = splitTechChoice(card.immediateEffects.filter(e => !isSentenceSignal(e)).map(immediateSegment));

  let scorePanel: ScorePanel | undefined;
  for (const effect of card.passiveEffects) {
    const score = SCORE_EFFECTS[effect.type];
    const reception = RECEPTION_EFFECTS[effect.type];
    if (score || reception) {
      const header = score ? 'Fin de jeu:' : 'Réception:';
      const reward = score ? score(effect) : reception!(effect, card);
      const chunk = chunks.find(c => c.header === header)?.content ?? effect.type;
      // Réception (Centauriens) : à gauche toujours « À réception du message. », à droite ce qu'elle rapporte
      scorePanel ??= score
        ? { kind: 'endGame', text: conditionText(chunk), symbols: scoreSymbols(effect, chunk) || [], reward: isEmptyBonus(reward) ? pvOfText(chunk) : reward }
        : {
          kind: 'reception', text: RECEPTION_TEXT, symbols: [], reward,
          ...(effect.type === 'RECEPTION_REVENUE' ? { rewardSentence: { before: 'Augmentez vos', after: 'grâce à cette carte.' } } : {}),
        };
      continue;
    }
    if (SENTENCE_EFFECTS.has(effect.type)) continue;
    const toSegment = EFFECT_SYMBOLS[effect.type] ?? TEXT_EFFECTS[effect.type];
    effects.push(toSegment ? toSegment(effect, card) : { kind: 'text', text: effect.type, effectType: effect.type });
  }
  // Carte Fin de partie sans effet de décompte lu (ex. carte 12) : panneau doré avec le texte de la carte
  if (!scorePanel && (card.type === CardType.END_GAME || isExertien)) {
    const chunk = chunks.find(c => c.header === 'Fin de jeu:');
    if (chunk) scorePanel = { kind: 'endGame', text: conditionText(chunk.content), symbols: [], reward: pvOfText(chunk.content) };
  }
  // Exertien : la condition débute le panneau (les PV viennent après), sa majuscule reste
  if (scorePanel?.kind === 'endGame' && !isExertien && !isEmptyBonus(scorePanel.reward)) scorePanel = continueAfterPv(scorePanel);

  // Effets permanents hors mission (rares) : écrits en texte pour ne rien perdre
  const mission = missionPanel(card);
  if (!mission) {
    for (const effect of card.permanentEffects) effects.push({ kind: 'text', text: effect.type, effectType: effect.type });
  }

  return {
    id: card.id,
    name: card.name,
    type: card.type,
    freeAction: isExertien ? null : freeActionBonus(card.freeAction),
    freeActionType: isExertien ? undefined : card.freeAction,
    sector: isExertien ? null : (SECTOR_COLORS[card.scanSector] ? card.scanSector : null),
    sectorColor: isExertien ? undefined : SECTOR_COLORS[card.scanSector],
    revenue: isExertien ? null : revenueBonus(card.revenue),
    revenueType: isExertien ? undefined : card.revenue,
    cost: isExertien ? null : { amount: card.cost, kind: card.costType === CostType.ENERGY ? 'energy' : 'credit' },
    danger: isExertien ? card.danger ?? 0 : undefined,
    effects,
    mission,
    scorePanel,
    ...specificTextOf(card),
  };
}

/** Effets que la face ne sait pas dessiner (segments texte, conditions écrites faute de symbole, récompenses sans symbole) */
export function unsymbolizedParts(model: CardFaceModel): string[] {
  const parts = model.effects.filter(s => s.kind === 'text').map(s => (s as { text: string }).text);
  model.mission?.circles.forEach(c => {
    if (c.symbols.length === 0 && !c.noCriterion) parts.push(`condition « ${c.label} »`);
    if (c.rewardText) parts.push(`récompense « ${c.rewardText} »`);
  });
  const panel = model.scorePanel;
  if (panel?.kind === 'endGame' && panel.symbols.length === 0) parts.push(`fin de partie « ${panel.text} »`);
  if (panel && isEmptyBonus(panel.reward)) parts.push(`${panel.kind === 'endGame' ? 'décompte' : 'réception'} sans symbole`);
  return parts;
}
