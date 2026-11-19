/**
 * Chapitres des espèces Alien : un par espèce, verrouillé tant que le joueur ne l'a pas rencontrée en partie
 * (`species`). Le joueur découvre lui-même l'espèce (troisième trace de vie, par une analyse), puis pratique sa
 * mécanique principale. Textes dans public/docs/tutoriel.md ; solutions vérifiées par test/TutorialChapters.test.ts.
 */
import {
  ActionType, AlienBoardType, GAME_CONSTANTS, Game, LifeTraceLocation, LifeTraceType, ProbeState, SignalType,
} from '../core/types';
import { calculateAbsolutePosition, createRotationState, getObjectPosition } from '../core/SolarSystemPosition';
import { requirePlayer } from '../core/players';
import { CardSystem } from '../systems/CardSystem';
import { performRotation } from '../systems/RotationSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import type { TutorialChapter, TutorialContext, TutorialDeadEnd, TutorialStep } from './types';
import {
  blueTraceElsewhere, cannotReachWithCapsule, cardGone, movesBetween, movesTo, resourceDeadEnds, freeProbe, giveSpeciesCardToHand, humanOf, opponentsPassed, probeOnPlanet, readyToDiscover, stepTowards,
} from './scenario';

/** Graine des chapitres (celle des autres chapitres : Mars et Jupiter à 2 déplacements de la Terre) */
const SEED = 2026;

/** Section de la documentation de chaque espèce */
export const SPECIES_DOC: Record<AlienBoardType, string> = {
  [AlienBoardType.MASCAMITES]: 'mascamites',
  [AlienBoardType.ANOMALIES]: 'anomalies',
  [AlienBoardType.OUMUAMUA]: 'oumuamua',
  [AlienBoardType.CENTAURIENS]: 'centauriens',
  [AlienBoardType.EXERTIENS]: 'exertiens',
};

// --- Prédicats communs ---

const discovered = ({ game }: TutorialContext) => game.board.alienBoards[0].isDiscovered;
/** Troisième trace posée : l'espèce attend sa découverte (fin du tour, règles p. 20), ou elle est déjà révélée */
const completed = (c: TutorialContext) => discovered(c) || SpeciesSystem.isDiscoveryPending(c.game, 0);
/** L'analyse est lancée : l'ordinateur est vidé, ou l'espèce déjà découverte */
const analysisDone = (c: TutorialContext) => !humanOf(c.game, c.humanId).dataComputer.slots['6a']?.filled || discovered(c);
/** Trace du joueur sur la piste d'une couleur de l'espèce du premier plateau */
const onTrack = ({ game, humanId }: TutorialContext, color: LifeTraceType) =>
  game.board.alienBoards[0].lifeTraces.some(t => t.playerId === humanId && t.type === color && t.location === LifeTraceLocation.SPECIES);

/**
 * Étapes communes : présentation, analyse (trace bleue), pose de la troisième trace, fin du tour qui révèle l'espèce
 * (la découverte se résout à la fin du tour, règles p. 20), présentation de l'espèce révélée. `revealedWhen` : étape
 * « reveler » terminée aussi quand la fin du tour ouvre un choix de la découverte (cartes Exertiens)
 */
function discoverySteps(species: AlienBoardType, revealedWhen: (c: TutorialContext) => boolean = discovered): TutorialStep[] {
  return [
    { id: 'intro', target: 'species' },
    { id: 'analyser', target: 'actions', done: analysisDone, allowedActions: [ActionType.ANALYZE_DATA] },
    { id: 'poser', target: 'species', duringChoice: 'PLACING_LIFE_TRACE', done: completed },
    { id: 'reveler', target: 'end-turn', done: revealedWhen, allowedActions: ['END_TURN'], docLink: SPECIES_DOC[species] },
    { id: 'decouverte', target: 'species', docLink: SPECIES_DOC[species] },
  ];
}

/** Impasse commune : trace bleue de l'analyse posée sur l'autre plateau Alien, l'espèce ne sera pas découverte */
const BLUE_TRACE_DEAD_END: TutorialDeadEnd = { id: 'annuler-trace-bleue', when: c => blueTraceElsewhere(c.game, c.humanId) };

/** Énergie de l'analyse qui découvre l'espèce, tant qu'elle n'est pas faite */
const analysisEnergy = (c: TutorialContext) => (analysisDone(c) ? 0 : GAME_CONSTANTS.ANALYZE_COST_ENERGY);

/** Crédits et énergie d'un scan (et de l'analyse qui le précède), tant que `done` n'est pas vrai */
const scanDeadEnds = (done: (c: TutorialContext) => boolean) => resourceDeadEnds({
  credits: c => (done(c) ? 0 : GAME_CONSTANTS.SCAN_COST_CREDITS),
  energy: c => (done(c) ? 0 : GAME_CONSTANTS.SCAN_COST_ENERGY + analysisEnergy(c)),
});

/** Marque au nom du joueur toutes les cases de données du secteur de la Terre, sauf la dernière (son scan le couvre) */
function fillEarthSector(game: Game, humanId: string): Game {
  const s = game.board.solarSystem;
  const earth = getObjectPosition('earth', s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3, s.extraCelestialObjects)!;
  const sector = game.board.sectors[earth.absoluteSector - 1];
  const dataSlots = sector.signals.filter(signal => signal.type === SignalType.DATA).length;
  let marked = 0;
  sector.signals = sector.signals.map(signal => (signal.type === SignalType.DATA && ++marked < dataSlots ? { ...signal, marked: true, markedBy: humanId } : signal));
  return game;
}

// --- Exertiens : cartes hors de la main, jouées face cachée ---

const exertienPlayed = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).playedCards.some(card => CardSystem.isExertienCard(card));
/** Choix des cartes Exertiens refusé à la découverte : aucune carte jouée, le chapitre ne peut plus avancer */
const exertienRefused = (c: TutorialContext) => discovered(c) && c.game.interaction?.type !== 'CHOOSING_EXERTIEN_CARD' && !exertienPlayed(c);

const exertiens: TutorialChapter = {
  id: 'exertiens',
  seed: SEED,
  species: AlienBoardType.EXERTIENS,
  adjust: (game, humanId) => readyToDiscover(opponentsPassed(game, humanId), humanId, AlienBoardType.EXERTIENS),
  prepare: [],
  steps: [
    // La fin du tour révèle les Exertiens et ouvre le choix des cartes : l'étape qui le présente s'affiche pendant ce choix
    ...discoverySteps(AlienBoardType.EXERTIENS, c => discovered(c) || c.game.interaction?.type === 'CHOOSING_EXERTIEN_CARD').filter(step => step.id !== 'decouverte'),
    { id: 'jouer', target: 'species', duringChoice: 'CHOOSING_EXERTIEN_CARD', done: exertienPlayed, docLink: SPECIES_DOC[AlienBoardType.EXERTIENS] },
    { id: 'danger', target: 'species' },
    { id: 'paliers', target: 'score' },
    { id: 'conclusion', docLink: SPECIES_DOC[AlienBoardType.EXERTIENS] },
  ],
  // Renoncé à jouer une carte : annuler pour retrouver le choix
  deadEnds: [BLUE_TRACE_DEAD_END, ...resourceDeadEnds({ energy: analysisEnergy }), { id: 'annuler-refus', when: exertienRefused }],
  solution: [{ type: 'ANALYZE' }, { type: 'END_TURN' }],
};

// --- Centauriens : palier de message à + 15 PV, tuile Message ---

/** Emplacement de la piste des Centauriens qui rapporte 15 PV contre 3 données */
const CENTAURIEN_15PV_SLOT = 3;
/** Données que coûte cet emplacement */
const CENTAURIEN_15PV_DATA = 3;

const messageClaimed = ({ game, humanId }: TutorialContext) =>
  !!game.species.find(s => s.name === AlienBoardType.CENTAURIENS)?.message?.some(tile => tile.claimedBy === humanId);

/** Traces rouges du joueur (tous plateaux) */
const redTraces = ({ game, humanId }: TutorialContext) =>
  game.board.alienBoards.reduce((n, board) => n + board.lifeTraces.filter(t => t.playerId === humanId && t.type === LifeTraceType.RED).length, 0);
/** Trace rouge du scan posée ailleurs que sur l'emplacement à 15 PV de la piste : le palier de message ne sera pas franchi */
const redTraceMisplaced = (c: TutorialContext) => redTraces(c) > redTraces({ ...c, game: c.start })
  && !c.game.board.alienBoards[0].lifeTraces.some(t => t.playerId === c.humanId && t.type === LifeTraceType.RED
    && t.location === LifeTraceLocation.SPECIES && t.slotIndex === CENTAURIEN_15PV_SLOT);

const centauriens: TutorialChapter = {
  id: 'centauriens',
  seed: SEED,
  species: AlienBoardType.CENTAURIENS,
  // Après la découverte, un scan couvre le secteur de la Terre (trace rouge) : sur la piste, elle rapporte 15 PV
  // (3 données), de quoi franchir le palier de message à la fin du tour
  adjust: (game, humanId) => {
    const updated = fillEarthSector(readyToDiscover(opponentsPassed(game, humanId), humanId, AlienBoardType.CENTAURIENS), humanId);
    const human = requirePlayer(updated, humanId);
    human.credits = Math.max(human.credits, 3);
    human.energy = 4;
    human.data = 3;
    // Paliers de score (neutres et dorés) déjà passés : seul le palier de message est franchi
    human.claimedNeutralMilestones = [20, 30];
    human.claimedGoldenMilestones = [25];
    return updated;
  },
  prepare: [],
  steps: [
    ...discoverySteps(AlienBoardType.CENTAURIENS),
    { id: 'palier', target: 'score' },
    // Scan fait : la trace rouge du secteur couvert est à poser (l'étape suivante s'affiche pendant ce choix), ou posée
    {
      id: 'scanner', target: 'actions', allowedActions: [ActionType.SCAN_SECTOR],
      done: c => onTrack(c, LifeTraceType.RED) || (discovered(c) && c.game.interaction?.type === 'PLACING_LIFE_TRACE'),
    },
    { id: 'piste', target: 'species', duringChoice: 'PLACING_LIFE_TRACE', done: c => onTrack(c, LifeTraceType.RED) },
    // Palier atteint en fin de tour : le choix de la tuile s'ouvre, l'étape suivante s'affiche pendant ce choix
    { id: 'fin-du-tour-2', target: 'end-turn', done: c => messageClaimed(c) || c.game.interaction?.type === 'CHOOSING_CENTAURIEN_REWARD', allowedActions: ['END_TURN'] },
    { id: 'message', target: 'species', duringChoice: 'CHOOSING_CENTAURIEN_REWARD', done: messageClaimed },
    { id: 'conclusion', docLink: SPECIES_DOC[AlienBoardType.CENTAURIENS] },
  ],
  deadEnds: [
    BLUE_TRACE_DEAD_END,
    { id: 'annuler-trace-rouge', when: redTraceMisplaced },
    // Scan fait : sa trace rouge est posée (sur la piste ou ailleurs ; pendant sa pose, les impasses attendent)
    ...scanDeadEnds(c => onTrack(c, LifeTraceType.RED) || redTraceMisplaced(c)),
    // Données de l'emplacement à 15 PV (3), placées dans l'ordinateur avant de poser la trace rouge
    ...resourceDeadEnds({ data: c => (onTrack(c, LifeTraceType.RED) || redTraceMisplaced(c) ? 0 : CENTAURIEN_15PV_DATA) }),
  ],
  solution: [{ type: 'ANALYZE' }, { type: 'END_TURN' }, { type: 'SCAN' }, { type: 'END_TURN' }],
  // Trace rouge du scan : l'emplacement à 15 PV (3 données) de la piste des Centauriens
  answer: game => (game.interaction?.type === 'PLACING_LIFE_TRACE' && game.board.alienBoards[0].isDiscovered
    ? { type: 'CHOOSE', choice: { kind: 'LIFE_TRACE', boardIndex: 0, color: LifeTraceType.RED, slotType: LifeTraceLocation.SPECIES, slotIndex: CENTAURIEN_15PV_SLOT } }
    : undefined),
};

// --- Oumuamua : nouvelle planète, son secteur, jetons ---

const tokensOf = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).tokens ?? 0;
/**
 * Scan fait sans couvrir Oumuamua : une autre carte de la rangée a été prise, ou la bonne carte a servi à poser le
 * signal ailleurs (rangée changée, aucun jeton). Une impasse n'est évaluée qu'une fois le choix du secteur fait.
 */
const wrongScanCard = (c: TutorialContext) => {
  if (tokensOf(c) > 0) return false;
  const rowIds = c.game.decks.cardRow.map(card => card.id);
  return c.start.decks.cardRow.some(card => !rowIds.includes(card.id));
};

const oumuamua: TutorialChapter = {
  id: 'oumuamua',
  seed: SEED,
  species: AlienBoardType.OUMUAMUA,
  // Deux signaux du joueur déjà dans le secteur d'Oumuamua ; la première carte de la rangée a la couleur du secteur
  // où apparaîtra Oumuamua : le second signal de son scan peut aller sur Oumuamua et en couvrir le secteur
  adjust: (game, humanId) => {
    const updated = readyToDiscover(opponentsPassed(game, humanId), humanId, AlienBoardType.OUMUAMUA);
    const species = updated.species.find(s => s.name === AlienBoardType.OUMUAMUA)!;
    let marked = 0;
    species.sector = { ...species.sector!, signals: species.sector!.signals.map(signal => (++marked < 3 ? { ...signal, marked: true, markedBy: humanId } : signal)) };
    const s = updated.board.solarSystem;
    const rotation = createRotationState(s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3);
    const sectorNumber = calculateAbsolutePosition({ id: 'oumuamua', type: 'planet', name: 'Oumuamua', position: { disk: 'C', sector: 3, x: 0, y: 0 }, level: 1 }, rotation, []).absoluteSector;
    const color = updated.board.sectors[sectorNumber - 1].color;
    // La carte de la bonne couleur prend la première place de la rangée (qui garde 3 cartes) ; celle qu'elle
    // remplace retourne dans la pioche, à sa place
    const index = updated.decks.cards.findIndex(card => card.scanSector === color);
    const [card] = updated.decks.cards.splice(index, 1);
    const [replaced, ...rest] = updated.decks.cardRow;
    updated.decks.cardRow = [card, ...rest];
    if (replaced) updated.decks.cards.splice(index, 0, replaced);
    const human = requirePlayer(updated, humanId);
    human.credits = Math.max(human.credits, 3);
    human.energy = 4;
    return updated;
  },
  prepare: [],
  steps: [
    ...discoverySteps(AlienBoardType.OUMUAMUA),
    { id: 'planete', target: 'solar-system' },
    { id: 'scanner', target: 'actions', done: c => tokensOf(c) > 0, allowedActions: [ActionType.SCAN_SECTOR] },
    { id: 'jetons', target: 'species' },
    { id: 'conclusion', docLink: SPECIES_DOC[AlienBoardType.OUMUAMUA] },
  ],
  // Mauvaise carte de la rangée (ou signal posé hors d'Oumuamua)
  deadEnds: [BLUE_TRACE_DEAD_END, { id: 'annuler-scan', when: wrongScanCard }, ...scanDeadEnds(c => tokensOf(c) > 0)],
  solution: [{ type: 'ANALYZE' }, { type: 'END_TURN' }, { type: 'SCAN' }],
  // Second signal du scan : sur Oumuamua
  answer: game => (game.interaction?.type === 'SELECTING_SCAN_SECTOR' ? { type: 'CHOOSE', choice: { kind: 'SECTOR', sectorId: 'oumuamua' } } : undefined),
};

// --- Mascamites : spécimen prélevé, capsule ramenée sur Terre ---

/** Premier Contact : 1 Déplacement et 1 Atterrissage, puis prélèvement d'un spécimen ; mission : le ramener sur Terre */
const SPECIMEN_CARD = 'ET.1';
const capsuleOf = (game: Game, humanId: string) => freeProbe(game, humanId, ProbeState.CAPSULE);
const specimenMission = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).missions.find(m => m.cardId === SPECIMEN_CARD);
const specimenDelivered = (c: TutorialContext) => (specimenMission(c)?.completedRequirementIds.length ?? 0) > 0;
const earthOutOfReach = ({ game, humanId }: TutorialContext) => cannotReachWithCapsule(game, humanId, 'earth');
const collected = (c: TutorialContext) => !!capsuleOf(c.game, c.humanId) || specimenDelivered(c);
/**
 * Énergie de la sonde : l'analyse, rejoindre Jupiter, puis ramener la capsule sur Terre (le déplacement gratuit de
 * Premier Contact n'est pas compté : il ne sert pas à la capsule)
 */
const probeShortOfEnergy = (c: TutorialContext) => {
  const moves = movesTo(c.game, c.humanId, 'jupiter');
  return moves !== undefined && humanOf(c.game, c.humanId).energy < analysisEnergy(c) + moves + movesBetween(c.game, 'jupiter', 'earth');
};
/** Premier Contact jouée sans prélever de spécimen (atterrissage ou prélèvement refusé) */
const specimenMissed = (c: TutorialContext) => !!specimenMission(c) && !collected(c);
/** Coût de Premier Contact (en main) */
const specimenCardCost = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).cards.find(card => card.id === SPECIMEN_CARD)?.cost ?? 0;

const mascamites: TutorialChapter = {
  id: 'mascamites',
  seed: SEED,
  species: AlienBoardType.MASCAMITES,
  adjust: (game, humanId) => {
    const updated = giveSpeciesCardToHand(readyToDiscover(opponentsPassed(game, humanId), humanId, AlienBoardType.MASCAMITES), humanId, SPECIMEN_CARD);
    const human = requirePlayer(updated, humanId);
    human.credits = 6;
    human.energy = 6;
    return updated;
  },
  // Une sonde déjà sur Jupiter
  prepare: [{ type: 'LAUNCH_PROBE' }, stepTowards('jupiter'), stepTowards('jupiter'), { type: 'END_TURN' }],
  steps: [
    ...discoverySteps(AlienBoardType.MASCAMITES),
    { id: 'specimens', target: 'solar-system' },
    { id: 'prelever', target: 'hand', done: collected, allowedActions: [ActionType.PLAY_CARD], allowedCards: [SPECIMEN_CARD] },
    { id: 'capsule', target: 'solar-system' },
    { id: 'ramener', target: 'solar-system', done: c => probeOnPlanet(c.game, c.humanId, 'earth', ProbeState.CAPSULE) || specimenDelivered(c) },
    { id: 'mission', target: 'missions', done: specimenDelivered },
    { id: 'conclusion', target: 'species', docLink: SPECIES_DOC[AlienBoardType.MASCAMITES] },
  ],
  // Capsule partie trop loin (plus assez d'énergie pour rejoindre la Terre)
  deadEnds: [
    BLUE_TRACE_DEAD_END,
    // Avant Premier Contact : la sonde doit rejoindre Jupiter (la carte donne 1 déplacement), puis la capsule la Terre
    { id: 'annuler-sonde', when: c => !collected(c) && probeShortOfEnergy(c) },
    { id: 'annuler-carte', when: c => !collected(c) && cardGone(c.game, c.humanId, SPECIMEN_CARD) },
    { id: 'annuler-prelevement', when: specimenMissed },
    { id: 'annuler-capsule', when: earthOutOfReach },
    // Coût de Premier Contact
    ...resourceDeadEnds({ credits: c => (collected(c) ? 0 : specimenCardCost(c)) }),
  ],
  solution: [
    { type: 'ANALYZE' }, { type: 'END_TURN' }, { type: 'PLAY_CARD', cardId: SPECIMEN_CARD },
    stepTowards('earth', ProbeState.CAPSULE), stepTowards('earth', ProbeState.CAPSULE),
    (game, humanId) => {
      const mission = humanOf(game, humanId).missions.find(m => m.cardId === SPECIMEN_CARD)!;
      const requirement = mission.requirements.find(r => CardSystem.isRequirementClaimable(game, humanId, mission, r.id!))!;
      return { type: 'CLAIM_MISSION', missionId: mission.id, requirementId: requirement.id! };
    },
  ],
  // Atterrissage de la carte : sur Jupiter, où est la sonde
  answer: game => (game.interaction?.type === 'LANDING_PROBE' ? { type: 'CHOOSE', choice: { kind: 'PLANET', planetId: 'jupiter' } } : undefined),
};

// --- Anomalies : une rotation amène la Terre sur une anomalie ---

/** Secteur de la Terre */
const earthSector = (game: Game) => {
  const s = game.board.solarSystem;
  return getObjectPosition('earth', s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3, s.extraCelestialObjects)!.absoluteSector;
};
const techAcquired = ({ game, humanId, start }: TutorialContext) =>
  humanOf(game, humanId).technologies.length > humanOf(start, humanId).technologies.length;
/** Rotations du système solaire depuis le début du chapitre (l'anneau de la Terre tourne à chaque rotation) */
const rotations = ({ game, start }: TutorialContext) =>
  Math.round((start.board.solarSystem.rotationAngleLevel3 - game.board.solarSystem.rotationAngleLevel3) / 45);
/** La troisième rotation a amené la Terre sur une anomalie */
const earthOnAnomaly = (c: TutorialContext) => {
  const s = c.game.board.solarSystem;
  const rotation = createRotationState(s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3);
  const earth = earthSector(c.game);
  return rotations(c) >= 3
    && (s.extraCelestialObjects ?? []).some(o => o.type === 'anomaly' && calculateAbsolutePosition(o, rotation, s.extraCelestialObjects).absoluteSector === earth);
};

/**
 * Ellipse : deux rotations plus tard (deux tours), la Terre est à un secteur d'une anomalie ; pendant ces tours, le joueur
 * a posé une trace sur la piste de la couleur de cette anomalie (il y est en tête), et c'est de nouveau son tour
 */
function twoRotationsLater(game: Game, humanId: string): Game {
  let updated = performRotation(performRotation(game).updatedGame).updatedGame;
  const next = performRotation(updated).updatedGame;
  const s = next.board.solarSystem;
  const rotation = createRotationState(s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3);
  const earth = earthSector(next);
  const anomaly = (s.extraCelestialObjects ?? []).find(o => o.type === 'anomaly' && calculateAbsolutePosition(o, rotation, s.extraCelestialObjects).absoluteSector === earth)!;
  updated = SpeciesSystem.placeLifeTrace(updated, 0, anomaly.anomalyData!.color, humanId, '', LifeTraceLocation.SPECIES, 0).updatedGame;
  const human = requirePlayer(updated, humanId);
  human.hasPerformedMainAction = false;
  human.mediaCoverage = Math.max(human.mediaCoverage, 6);
  return updated;
}

const anomalies: TutorialChapter = {
  id: 'anomalies',
  seed: SEED,
  species: AlienBoardType.ANOMALIES,
  adjust: (game, humanId) => readyToDiscover(opponentsPassed(game, humanId), humanId, AlienBoardType.ANOMALIES),
  prepare: [],
  steps: [
    ...discoverySteps(AlienBoardType.ANOMALIES),
    { id: 'jetons', target: 'solar-system' },
    { id: 'ellipse', target: 'solar-system', ellipsis: twoRotationsLater },
    // Terminée une fois la technologie prise (la récompense de l'anomalie et la technologie se choisissent dans l'ordre voulu)
    { id: 'rechercher', target: 'actions', done: c => earthOnAnomaly(c) && techAcquired(c) && !c.game.interaction, allowedActions: [ActionType.RESEARCH_TECH] },
    { id: 'recompense', target: 'history' },
    { id: 'conclusion', docLink: SPECIES_DOC[AlienBoardType.ANOMALIES] },
  ],
  deadEnds: [
    BLUE_TRACE_DEAD_END,
    ...resourceDeadEnds({ energy: analysisEnergy }),
    // Recherche lancée (troisième rotation) sans prendre de technologie
    { id: 'annuler-recherche', when: c => rotations(c) >= 3 && !techAcquired(c) },
    // Après l'ellipse (deux rotations), médias de la recherche (6) dépensés à acheter une carte
    ...resourceDeadEnds({ mediaCoverage: c => (rotations(c) === 2 && !techAcquired(c) ? GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA : 0) }),
  ],
  solution: [{ type: 'ANALYZE' }, { type: 'END_TURN' }, { type: 'RESEARCH_TECH' }],
};

/** Chapitres d'espèce, dans l'ordre du menu */
export const SPECIES_CHAPTERS: TutorialChapter[] = [mascamites, anomalies, oumuamua, centauriens, exertiens];
