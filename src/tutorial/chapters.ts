/**
 * Chapitres du tutoriel : position de départ (graine, ajustements, commandes), étapes et solution.
 * Les textes sont dans public/docs/tutoriel.md (une section par étape, même identifiant) ;
 * test/TutorialChapters.test.ts vérifie que chaque chapitre se prépare et se termine par sa solution.
 */
import { ActionType, Game, GamePhase, LifeTraceLocation, LifeTraceType, SignalType } from '../core/types';
import { getObjectPosition } from '../core/SolarSystemPosition';
import { requirePlayer } from '../core/players';
import { CardSystem } from '../systems/CardSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import type { TutorialChapter, TutorialContext } from './types';
import {
  fillComputer, filledTopSlots, freshTurn, giveCardToHand, handSize, hasLander, hasOrbiter, humanOf, lifeTracesOf,
  opponentsPassed, probeOnPlanet, signalsOf, stepTowards,
} from './scenario';

/** Graine des chapitres : Mars et Jupiter à 2 déplacements de la Terre */
const SEED = 2026;
/** Carte ISS (mission déclenchée par le lancement d'une sonde) */
const ISS_CARD = '79';
/** Carte Télescope Lovell (mission conditionnelle : au moins 8 Médias) */
const LOVELL_CARD = '51';
/** Carte Mars Science Laboratory (Fin de jeu : 4 PV par orbiteur ou atterrisseur sur Mars) */
const MSL_CARD = '14';
/** Cartes données au chapitre Cartes et missions (la défausse demandée porte sur une autre carte de la main) */
const GIVEN_CARDS = [ISS_CARD, LOVELL_CARD, MSL_CARD];

const launched = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).probes.length > 0;
const reachedMars = ({ game, humanId }: TutorialContext) => probeOnPlanet(game, humanId, 'mars') || hasOrbiter(game, humanId, 'mars');
/** Le système solaire a tourné depuis le début du chapitre */
const rotated = ({ game, start }: TutorialContext) => {
  const angles = (g: typeof game) => [g.board.solarSystem.rotationAngleLevel1, g.board.solarSystem.rotationAngleLevel2, g.board.solarSystem.rotationAngleLevel3].join('/');
  return angles(game) !== angles(start);
};
const techAcquired = ({ game, humanId, start }: TutorialContext) => humanOf(game, humanId).technologies.length > humanOf(start, humanId).technologies.length;
/** Marque au nom du joueur toutes les cases de données du secteur de la Terre, sauf la dernière */
const fillEarthSector = (game: Game, humanId: string): Game => {
  const s = game.board.solarSystem;
  const earth = getObjectPosition('earth', s.rotationAngleLevel1, s.rotationAngleLevel2, s.rotationAngleLevel3, s.extraCelestialObjects)!;
  const sector = game.board.sectors[earth.absoluteSector - 1];
  const dataSlots = sector.signals.filter(signal => signal.type === SignalType.DATA).length;
  let marked = 0;
  sector.signals = sector.signals.map(signal => (signal.type === SignalType.DATA && ++marked < dataSlots ? { ...signal, marked: true, markedBy: humanId } : signal));
  return game;
};
/** Une trace de vie de plus qu'au départ : elle est posée sur un plateau Alien */
const tracePlaced = (c: TutorialContext) => lifeTracesOf(c.game, c.humanId) > lifeTracesOf(c.start, c.humanId);
/** L'analyse est lancée : l'ordinateur est vidé (la trace bleue reste à poser), ou la trace est déjà posée */
const analysisDone = (c: TutorialContext) => filledTopSlots(c.game, c.humanId) < filledTopSlots(c.start, c.humanId) || tracePlaced(c);
const missionOf = ({ game, humanId }: TutorialContext, cardId = ISS_CARD) => humanOf(game, humanId).missions.find(m => m.cardId === cardId);
/** Au moins un cercle ou carré de la mission de cette carte recouvert */
const missionClaimed = (c: TutorialContext, cardId: string) => (missionOf(c, cardId)?.completedRequirementIds.length ?? 0) > 0;
/** Une carte de la main de départ (hors cartes données) est dans la défausse */
const discardedFromHand = ({ game, humanId, start }: TutorialContext) => {
  const startHand = humanOf(start, humanId).cards.map(card => card.id).filter(id => !GIVEN_CARDS.includes(id));
  return game.decks.discardPile.some(card => startHand.includes(card.id));
};
const endGameCardPlayed = ({ game, humanId }: TutorialContext) => humanOf(game, humanId).playedCards.some(card => card.id === MSL_CARD);
/** Commande : recouvrir le premier cercle (ou carré) réalisable de la mission d'une carte */
const claimMission = (cardId: string) => (game: Parameters<typeof humanOf>[0], humanId: string) => {
  const mission = humanOf(game, humanId).missions.find(m => m.cardId === cardId)!;
  const requirement = mission.requirements.find(r => CardSystem.isRequirementClaimable(game, humanId, mission, r.id!))!;
  return { type: 'CLAIM_MISSION' as const, missionId: mission.id, requirementId: requirement.id! };
};

const ecran: TutorialChapter = {
  id: 'ecran',
  seed: SEED,
  adjust: opponentsPassed,
  prepare: [],
  steps: [
    { id: 'bienvenue' },
    { id: 'systeme-solaire', target: 'solar-system', docLink: '2-1-systeme-solaire' },
    { id: 'plateau-joueur', target: 'player-board', docLink: '1-2-l-ecran' },
    { id: 'ressources', target: 'resources' },
    { id: 'actions', target: 'actions', docLink: '1-4-actions-principales' },
    { id: 'rangee', target: 'card-row' },
    { id: 'technologies', target: 'tech-board' },
    { id: 'objectifs', target: 'objectives' },
    { id: 'especes', target: 'species' },
    { id: 'historique', target: 'history', docLink: '1-6-annuler' },
    { id: 'lancer', target: 'actions', done: launched, allowedActions: [ActionType.LAUNCH_PROBE] },
    { id: 'fin-du-tour', target: 'end-turn', done: c => launched(c) && freshTurn(c.game, c.humanId), allowedActions: ['END_TURN'], docLink: '1-3-le-tour' },
    { id: 'conclusion' },
  ],
  solution: [{ type: 'LAUNCH_PROBE' }, { type: 'END_TURN' }],
};

const sondes: TutorialChapter = {
  id: 'sondes',
  seed: SEED,
  adjust: (game, humanId) => {
    const human = humanOf(opponentsPassed(game, humanId), humanId);
    human.credits = 6;
    human.energy = 5;
    return game;
  },
  prepare: [],
  steps: [
    { id: 'intro', target: 'solar-system' },
    { id: 'lancer', target: 'actions', done: launched, allowedActions: [ActionType.LAUNCH_PROBE] },
    { id: 'deplacer', target: 'solar-system', done: c => reachedMars(c), docLink: '1-5-actions-gratuites' },
    { id: 'fin-du-tour', target: 'end-turn', done: c => reachedMars(c) && (freshTurn(c.game, c.humanId) || hasOrbiter(c.game, c.humanId, 'mars')), allowedActions: ['END_TURN'] },
    { id: 'orbite', target: 'actions', done: c => hasOrbiter(c.game, c.humanId, 'mars'), allowedActions: [ActionType.ORBIT], docLink: '1-4-actions-principales' },
    { id: 'conclusion', target: 'planets' },
  ],
  solution: [{ type: 'LAUNCH_PROBE' }, stepTowards('mars'), stepTowards('mars'), { type: 'END_TURN' }, { type: 'ORBIT', planetId: 'mars' }],
};

const atterrir: TutorialChapter = {
  id: 'atterrir',
  seed: SEED,
  adjust: (game, humanId) => {
    const human = humanOf(opponentsPassed(game, humanId), humanId);
    human.credits = 10;
    human.energy = 10;
    human.mediaCoverage = 4;
    return game;
  },
  // Un orbiteur sur Mars, puis une deuxième sonde arrivée sur Mars
  prepare: [
    { type: 'LAUNCH_PROBE' }, stepTowards('mars'), stepTowards('mars'), { type: 'END_TURN' },
    { type: 'ORBIT', planetId: 'mars' }, { type: 'END_TURN' },
    { type: 'LAUNCH_PROBE' }, stepTowards('mars'), stepTowards('mars'), { type: 'END_TURN' },
  ],
  steps: [
    { id: 'intro', target: 'planets' },
    { id: 'atterrir', target: 'actions', done: c => hasLander(c.game, c.humanId, 'mars'), allowedActions: [ActionType.LAND], docLink: '1-4-actions-principales' },
    // La case d'atterrissage rapporte une trace de vie jaune : bonus de découverte, carte de l'espèce promise
    // Affichée pendant le placement de la trace : « À vous de jouer » pour la poser
    { id: 'trace-jaune', target: 'species', duringChoice: 'PLACING_LIFE_TRACE', done: tracePlaced, docLink: '3-1-decouverte' },
    { id: 'medias', target: 'resources' },
    { id: 'acheter', target: 'resources', done: c => handSize(c.game, c.humanId) > handSize(c.start, c.humanId), docLink: '1-5-actions-gratuites' },
    { id: 'conclusion' },
  ],
  solution: [{ type: 'LAND', planetId: 'mars' }, { type: 'BUY_CARD' }],
};

const scanner: TutorialChapter = {
  id: 'scanner',
  seed: SEED,
  // Le secteur de la Terre est presque plein de signaux du joueur : son scan le couvre et lui rapporte une trace rouge
  adjust: (game, humanId) => {
    const human = humanOf(opponentsPassed(game, humanId), humanId);
    human.credits = 5;
    human.energy = 5;
    return fillEarthSector(game, humanId);
  },
  prepare: [],
  steps: [
    { id: 'intro', target: 'solar-system', docLink: '2-2-signaux-et-secteurs' },
    // Le secteur couvert est vidé de ses signaux : la trace de vie gagnée prouve que le scan est fait
    { id: 'scanner', target: 'actions', done: c => signalsOf(c.game, c.humanId) > signalsOf(c.start, c.humanId) || lifeTracesOf(c.game, c.humanId) > lifeTracesOf(c.start, c.humanId), allowedActions: [ActionType.SCAN_SECTOR] },
    { id: 'trace-rouge', target: 'species', duringChoice: 'PLACING_LIFE_TRACE', done: tracePlaced, docLink: '2-6-traces-de-vie' },
    { id: 'signaux', target: 'solar-system' },
    { id: 'donnees', target: 'resources' },
    { id: 'conclusion', docLink: '2-2-signaux-et-secteurs' },
  ],
  solution: [{ type: 'SCAN' }],
};

/** Ordinateur rempli jusqu'à la colonne 4 et 2 données à placer (chapitres Ordinateur et Espèces) */
const nearlyFullComputer = (game: Parameters<typeof opponentsPassed>[0], humanId: string) => {
  const human = humanOf(fillComputer(opponentsPassed(game, humanId), humanId, ['1a', '2', '3a', '4']), humanId);
  human.data = 2;
  human.energy = 3;
  return game;
};

const ordinateur: TutorialChapter = {
  id: 'ordinateur',
  seed: SEED,
  adjust: nearlyFullComputer,
  prepare: [],
  steps: [
    { id: 'intro', target: 'computer', docLink: '2-3-ordinateur-de-donnees' },
    { id: 'placer', target: 'computer', done: c => filledTopSlots(c.game, c.humanId) > filledTopSlots(c.start, c.humanId) || analysisDone(c) },
    { id: 'remplir', target: 'computer', done: c => filledTopSlots(c.game, c.humanId) >= 6 || analysisDone(c) },
    { id: 'analyser', target: 'actions', done: analysisDone, allowedActions: [ActionType.ANALYZE_DATA] },
    { id: 'trace-bleue', target: 'species', duringChoice: 'PLACING_LIFE_TRACE', done: tracePlaced, docLink: '2-6-traces-de-vie' },
  ],
  solution: [{ type: 'TRANSFER_DATA', slotId: '5a' }, { type: 'TRANSFER_DATA', slotId: '6a' }, { type: 'ANALYZE' }],
};

const cartes: TutorialChapter = {
  id: 'cartes',
  seed: SEED,
  // Trois cartes en main : une mission déclenchée (ISS), une mission conditionnelle (Télescope Lovell, au moins
  // 8 Médias : condition remplie après ISS) et une carte Fin de jeu (Mars Science Laboratory)
  adjust: (game, humanId) => {
    GIVEN_CARDS.forEach(cardId => giveCardToHand(game, humanId, cardId));
    const human = humanOf(opponentsPassed(game, humanId), humanId);
    human.credits = 10;
    human.energy = 5;
    human.mediaCoverage = 7; // 8 après ISS (condition du Télescope Lovell), jamais plus de 10 ensuite
    return game;
  },
  prepare: [],
  steps: [
    { id: 'intro', target: 'hand', docLink: '2-5-cartes' },
    // Tour 1 : mission déclenchée, puis défausse d'une carte pour son action gratuite
    { id: 'jouer', target: 'hand', done: c => !!missionOf(c), allowedActions: [ActionType.PLAY_CARD] },
    { id: 'mission', target: 'missions' },
    { id: 'defausser', target: 'hand', done: discardedFromHand, docLink: '1-5-actions-gratuites' },
    { id: 'fin-du-tour', target: 'end-turn', done: c => !!missionOf(c) && (freshTurn(c.game, c.humanId) || launched(c)), allowedActions: ['END_TURN'] },
    // Tour 2 : le lancement déclenche la mission
    { id: 'lancer', target: 'actions', done: c => launched(c), allowedActions: [ActionType.LAUNCH_PROBE] },
    { id: 'valider', target: 'missions', done: c => missionClaimed(c, ISS_CARD) },
    { id: 'fin-du-tour-2', target: 'end-turn', done: c => missionClaimed(c, ISS_CARD) && (freshTurn(c.game, c.humanId) || !!missionOf(c, LOVELL_CARD)), allowedActions: ['END_TURN'] },
    // Tour 3 : mission conditionnelle, accomplie dès qu'elle est jouée (condition déjà remplie)
    { id: 'conditionnelle', target: 'hand' },
    { id: 'jouer-conditionnelle', target: 'hand', done: c => missionClaimed(c, LOVELL_CARD), allowedActions: [ActionType.PLAY_CARD] },
    { id: 'carre', target: 'missions' },
    { id: 'fin-du-tour-3', target: 'end-turn', done: c => missionClaimed(c, LOVELL_CARD) && (freshTurn(c.game, c.humanId) || endGameCardPlayed(c)), allowedActions: ['END_TURN'] },
    // Tour 4 : carte Fin de jeu, décomptée à la fin de la partie
    { id: 'fin-de-jeu', target: 'hand', done: endGameCardPlayed, allowedActions: [ActionType.PLAY_CARD] },
    { id: 'decompte', target: 'missions', docLink: '2-8-fin-de-partie' },
  ],
  solution: [
    { type: 'PLAY_CARD', cardId: ISS_CARD },
    (game, humanId) => ({ type: 'DISCARD_FOR_FREE_ACTION', cardId: humanOf(game, humanId).cards.find(card => !GIVEN_CARDS.includes(card.id))!.id }),
    { type: 'END_TURN' },
    { type: 'LAUNCH_PROBE' }, claimMission(ISS_CARD), { type: 'END_TURN' },
    { type: 'PLAY_CARD', cardId: LOVELL_CARD }, { type: 'END_TURN' },
    { type: 'PLAY_CARD', cardId: MSL_CARD },
  ],
};

const technologies: TutorialChapter = {
  id: 'technologies',
  seed: SEED,
  adjust: (game, humanId) => {
    humanOf(opponentsPassed(game, humanId), humanId).mediaCoverage = 6;
    return game;
  },
  prepare: [],
  steps: [
    { id: 'intro', target: 'tech-board', docLink: '2-4-technologies' },
    // La recherche fait d'abord tourner le système solaire, puis ouvre le choix de la technologie
    { id: 'rechercher', target: 'actions', done: c => rotated(c) || techAcquired(c), allowedActions: [ActionType.RESEARCH_TECH] },
    // Montrée pendant le choix, panneau des technologies replié : la rotation reste visible
    { id: 'rotation', target: 'solar-system', duringChoice: 'ACQUIRING_TECH' },
    { id: 'choisir', target: 'tech-board', done: techAcquired },
    { id: 'effet', target: 'player-board' },
  ],
  solution: [{ type: 'RESEARCH_TECH' }],
};

const especes: TutorialChapter = {
  id: 'especes',
  seed: SEED,
  adjust: (game, humanId) => {
    let updated = nearlyFullComputer(game, humanId);
    // Traces rouge et jaune déjà posées par le joueur sur le premier plateau Alien
    for (const color of [LifeTraceType.RED, LifeTraceType.YELLOW]) {
      updated = SpeciesSystem.placeLifeTrace(updated, 0, color, humanId, '', LifeTraceLocation.TRIANGLE).updatedGame;
    }
    return updated;
  },
  prepare: [],
  steps: [
    { id: 'intro', target: 'species', docLink: '2-6-traces-de-vie' },
    { id: 'remplir', target: 'computer', done: c => filledTopSlots(c.game, c.humanId) >= 6 || analysisDone(c) },
    { id: 'analyser', target: 'actions', done: analysisDone, allowedActions: [ActionType.ANALYZE_DATA] },
    { id: 'poser', target: 'species', duringChoice: 'PLACING_LIFE_TRACE', done: c => c.game.board.alienBoards[0].isDiscovered },
    { id: 'decouverte', target: 'species', docLink: '3-1-decouverte' },
    { id: 'conclusion', docLink: '3-les-especes-alien' },
  ],
  solution: [{ type: 'TRANSFER_DATA', slotId: '5a' }, { type: 'TRANSFER_DATA', slotId: '6a' }, { type: 'ANALYZE' }],
};

const manche: TutorialChapter = {
  id: 'manche',
  seed: SEED,
  prepare: [],
  steps: [
    { id: 'intro', target: 'actions' },
    {
      id: 'passer', target: 'actions',
      done: c => c.game.currentRound > c.start.currentRound,
      allowedActions: [ActionType.PASS], docLink: '1-4-actions-principales',
    },
    { id: 'revenus', target: 'resources' },
    { id: 'rotation', target: 'solar-system' },
    { id: 'conclusion' },
  ],
  solution: [(game, humanId) => ({ type: 'PASS', cardsToKeep: humanOf(game, humanId).cards.slice(0, 4).map(c => c.id) })],
};

const finDePartie: TutorialChapter = {
  id: 'fin-de-partie',
  seed: SEED,
  adjust: (game, humanId) => {
    opponentsPassed(game, humanId);
    game.currentRound = 5;
    const human = requirePlayer(game, humanId);
    human.score = 26;
    human.credits = 4;
    // Palier neutre de 20 PV déjà passé : seul le palier de 25 PV reste à franchir
    human.claimedNeutralMilestones = [20];
    return game;
  },
  prepare: [],
  steps: [
    { id: 'intro', target: 'score', docLink: '2-7-paliers-et-objectifs' },
    {
      id: 'palier', target: 'end-turn',
      done: c => c.game.board.objectiveTiles.some(t => t.markers.includes(c.humanId)),
      allowedActions: [ActionType.LAUNCH_PROBE, 'END_TURN'],
    },
    { id: 'objectifs', target: 'objectives' },
    { id: 'passer', target: 'actions', done: c => c.game.phase === GamePhase.FINAL_SCORING, allowedActions: [ActionType.PASS], docLink: '2-8-fin-de-partie' },
    { id: 'conclusion' },
  ],
  solution: [
    { type: 'LAUNCH_PROBE' }, { type: 'END_TURN' },
    (game, humanId) => ({ type: 'PASS', cardsToKeep: humanOf(game, humanId).cards.slice(0, 4).map(c => c.id) }),
  ],
};

/** Partie normale contre un robot Débutant, avec l'aide au contexte */
export const FIRST_GAME_ID = 'premiere-partie';
const premierePartie: TutorialChapter = {
  id: FIRST_GAME_ID,
  prepare: [],
  steps: [{ id: 'bienvenue' }, { id: 'aides', docLink: '1-jouer' }],
  solution: [],
};

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  ecran, sondes, atterrir, scanner, ordinateur, cartes, technologies, especes, manche, finDePartie, premierePartie,
];

export function chapterById(id: string): TutorialChapter | undefined {
  return TUTORIAL_CHAPTERS.find(c => c.id === id);
}
