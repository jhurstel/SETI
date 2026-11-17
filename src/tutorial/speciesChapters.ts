/**
 * Chapitres des espèces Alien : un par espèce, verrouillé tant que le joueur ne l'a pas rencontrée en partie
 * (`species`). Le joueur découvre lui-même l'espèce (troisième trace de vie, par une analyse), puis pratique sa
 * mécanique principale. Textes dans public/docs/tutoriel.md ; solutions vérifiées par test/TutorialChapters.test.ts.
 */
import {
  ActionType, AlienBoardType, Game, LifeTraceLocation, LifeTraceType, ProbeState, SignalType,
} from '../core/types';
import { calculateAbsolutePosition, createRotationState, getObjectPosition } from '../core/SolarSystemPosition';
import { requirePlayer } from '../core/players';
import { CardSystem } from '../systems/CardSystem';
import { performRotation } from '../systems/RotationSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import type { TutorialChapter, TutorialContext, TutorialStep } from './types';
import {
  cannotReachWithCapsule, freeProbe, freshTurn, giveSpeciesCardToHand, humanOf, opponentsPassed, probeOnPlanet, readyToDiscover, stepTowards,
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
/** L'analyse est lancée : l'ordinateur est vidé, ou l'espèce déjà découverte */
const analysisDone = (c: TutorialContext) => !humanOf(c.game, c.humanId).dataComputer.slots['6a']?.filled || discovered(c);
/** Trace du joueur sur la piste d'une couleur de l'espèce du premier plateau */
const onTrack = ({ game, humanId }: TutorialContext, color: LifeTraceType) =>
  game.board.alienBoards[0].lifeTraces.some(t => t.playerId === humanId && t.type === color && t.location === LifeTraceLocation.SPECIES);

/** Étapes communes : présentation, analyse (trace bleue), pose de la trace qui découvre l'espèce, découverte */
function discoverySteps(species: AlienBoardType): TutorialStep[] {
  return [
    { id: 'intro', target: 'species' },
    { id: 'analyser', target: 'actions', done: analysisDone, allowedActions: [ActionType.ANALYZE_DATA] },
    { id: 'poser', target: 'species', duringChoice: 'PLACING_LIFE_TRACE', done: discovered },
    { id: 'decouverte', target: 'species', docLink: SPECIES_DOC[species] },
  ];
}

/** Fin du tour après la découverte (analyse = action principale du tour) : nouveau tour, ou l'étape suivante déjà faite */
const endTurnAfterDiscovery = (next: (c: TutorialContext) => boolean): TutorialStep => ({
  id: 'fin-du-tour', target: 'end-turn', done: c => discovered(c) && (freshTurn(c.game, c.humanId) || next(c)), allowedActions: ['END_TURN'],
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

const exertiens: TutorialChapter = {
  id: 'exertiens',
  seed: SEED,
  species: AlienBoardType.EXERTIENS,
  adjust: (game, humanId) => readyToDiscover(opponentsPassed(game, humanId), humanId, AlienBoardType.EXERTIENS),
  prepare: [],
  steps: [
    // La découverte ouvre aussitôt le choix des cartes Exertiens : l'étape qui la présente s'affiche pendant ce choix
    ...discoverySteps(AlienBoardType.EXERTIENS).filter(step => step.id !== 'decouverte'),
    { id: 'jouer', target: 'species', duringChoice: 'CHOOSING_EXERTIEN_CARD', done: exertienPlayed, docLink: SPECIES_DOC[AlienBoardType.EXERTIENS] },
    { id: 'danger', target: 'species' },
    { id: 'paliers', target: 'score' },
    { id: 'conclusion', docLink: SPECIES_DOC[AlienBoardType.EXERTIENS] },
  ],
  solution: [{ type: 'ANALYZE' }],
};

// --- Centauriens : palier de message à + 15 PV, tuile Message ---

/** Emplacement de la piste des Centauriens qui rapporte 15 PV contre 3 données */
const CENTAURIEN_15PV_SLOT = 3;

const messageClaimed = ({ game, humanId }: TutorialContext) =>
  !!game.species.find(s => s.name === AlienBoardType.CENTAURIENS)?.message?.some(tile => tile.claimedBy === humanId);

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
    endTurnAfterDiscovery(c => onTrack(c, LifeTraceType.RED) || (discovered(c) && c.game.interaction?.type === 'PLACING_LIFE_TRACE')),
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
  solution: [{ type: 'ANALYZE' }, { type: 'END_TURN' }, { type: 'SCAN' }, { type: 'END_TURN' }],
  // Trace rouge du scan : l'emplacement à 15 PV (3 données) de la piste des Centauriens
  answer: game => (game.interaction?.type === 'PLACING_LIFE_TRACE' && game.board.alienBoards[0].isDiscovered
    ? { type: 'CHOOSE', choice: { kind: 'LIFE_TRACE', boardIndex: 0, color: LifeTraceType.RED, slotType: LifeTraceLocation.SPECIES, slotIndex: CENTAURIEN_15PV_SLOT } }
    : undefined),
};

// --- Oumuamua : nouvelle planète, son secteur, jetons ---

const tokensOf = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).tokens ?? 0;

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
    const index = updated.decks.cards.findIndex(card => card.scanSector === color);
    const [card] = updated.decks.cards.splice(index, 1);
    updated.decks.cardRow = [card, ...updated.decks.cardRow];
    const human = requirePlayer(updated, humanId);
    human.credits = Math.max(human.credits, 3);
    human.energy = 4;
    return updated;
  },
  prepare: [],
  steps: [
    ...discoverySteps(AlienBoardType.OUMUAMUA),
    { id: 'planete', target: 'solar-system' },
    endTurnAfterDiscovery(c => tokensOf(c) > 0),
    { id: 'scanner', target: 'actions', done: c => tokensOf(c) > 0, allowedActions: [ActionType.SCAN_SECTOR] },
    { id: 'jetons', target: 'species' },
    { id: 'conclusion', docLink: SPECIES_DOC[AlienBoardType.OUMUAMUA] },
  ],
  solution: [{ type: 'ANALYZE' }, { type: 'END_TURN' }, { type: 'SCAN' }],
  // Second signal du scan : sur Oumuamua
  answer: game => (game.interaction?.type === 'SELECTING_SCAN_SECTOR' ? { type: 'CHOOSE', choice: { kind: 'SECTOR', sectorId: 'oumuamua' } } : undefined),
};

// --- Mascamites : spécimen prélevé, capsule ramenée sur Terre ---

/** Premier Contact : 1 Déplacement et 1 Atterrissage, puis prélèvement d'un spécimen ; mission : le ramener sur Terre */
const SPECIMEN_CARD = 'ET.2';
const capsuleOf = (game: Game, humanId: string) => freeProbe(game, humanId, ProbeState.CAPSULE);
const specimenMission = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).missions.find(m => m.cardId === SPECIMEN_CARD);
const specimenDelivered = (c: TutorialContext) => (specimenMission(c)?.completedRequirementIds.length ?? 0) > 0;
const earthOutOfReach = ({ game, humanId }: TutorialContext) => cannotReachWithCapsule(game, humanId, 'earth');
const collected = (c: TutorialContext) => !!capsuleOf(c.game, c.humanId) || specimenDelivered(c);

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
    endTurnAfterDiscovery(collected),
    { id: 'prelever', target: 'hand', done: collected, allowedActions: [ActionType.PLAY_CARD] },
    { id: 'capsule', target: 'solar-system' },
    // Capsule partie trop loin (plus assez d'énergie pour rejoindre la Terre) : annuler ses déplacements
    { id: 'annuler', target: 'history', onlyIf: earthOutOfReach, done: c => !earthOutOfReach(c), docLink: 'historique' },
    { id: 'ramener', target: 'solar-system', done: c => probeOnPlanet(c.game, c.humanId, 'earth', ProbeState.CAPSULE) || specimenDelivered(c) },
    { id: 'mission', target: 'missions', done: specimenDelivered },
    { id: 'conclusion', target: 'species', docLink: SPECIES_DOC[AlienBoardType.MASCAMITES] },
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
  solution: [{ type: 'ANALYZE' }, { type: 'RESEARCH_TECH' }],
};

/** Chapitres d'espèce, dans l'ordre du menu */
export const SPECIES_CHAPTERS: TutorialChapter[] = [mascamites, anomalies, oumuamua, centauriens, exertiens];
