import { Card, Game, GamePhase, Player, Decks, Species, DataComputer, GAME_CONSTANTS, Technology, SectorType, GameLogEntry, LifeTraceType, NEUTRAL_MILESTONES, AlienBoardType, SignalType, Planet } from '../core/types';
import { BoardManager } from './Board';
import { CardSystem } from '../systems/CardSystem';
import { Logger } from '../core/Logger';
import { DataLoader } from '../core/DataLoader';
import { cloneGame } from '../core/cloneGame';
import { ResourceSystem } from '../systems/ResourceSystem';
import { uniqueId } from '../core/ids';
import { random, newSeed, seedRandom, getRandomState, setRandomState } from '../core/random';

/** Couleurs des joueurs, dans l'ordre des places (bleu, rouge, jaune, vert) : affichées aussi avant la partie */
export const PLAYER_COLORS = ['#4a90e2', '#ff6b6b', '#ffd700', '#4caf50'];

/** Fichiers de cartes (public/cards/<nom>.csv) */
const CARD_FILES = ['main', 'mascamites', 'anomalies', 'oumuamua', 'centauriens', 'exertiens'] as const;
type CardFile = typeof CARD_FILES[number];

export class GameFactory {
  /**
   * Crée une nouvelle partie
   */
  static async createGame(playerNames: string[], humanIsFirstPlayer: boolean = true, seed: number = newSeed()): Promise<Game> {
    // Cartes lues d'abord : la mise en place tire ensuite sans interruption (pas d'await entre deux tirages)
    const cards = await this.loadAllCards();
    return this.createGameFromCards(cards, playerNames, humanIsFirstPlayer, seed);
  }

  /** Fichiers des cartes (base et espèces), lus en parallèle */
  private static async loadAllCards(): Promise<Record<CardFile, Card[]>> {
    const loaded = await Promise.all(CARD_FILES.map(file => DataLoader.loadCards(`cards/${file}.csv`)));
    return Object.fromEntries(CARD_FILES.map((file, index) => [file, loaded[index]])) as Record<CardFile, Card[]>;
  }

  /** Partie créée à partir des cartes lues, synchrone ; l'état du générateur atteint est noté dans `rngState` */
  private static createGameFromCards(cards: Record<CardFile, Card[]>, playerNames: string[], humanIsFirstPlayer: boolean, seed: number): Game {
    // Toute la mise en place (et la suite de la partie) découle de la graine
    seedRandom(seed);

    if (playerNames.length < GAME_CONSTANTS.MIN_PLAYERS || playerNames.length > GAME_CONSTANTS.MAX_PLAYERS) {
      throw new Error(
        `Nombre de joueurs invalide (min ${GAME_CONSTANTS.MIN_PLAYERS}, max ${GAME_CONSTANTS.MAX_PLAYERS})`
      );
    }

    // Créer les joueurs
    const players: Player[] = playerNames.map((name, index) =>
      this.createPlayer(`player_${index}`, name, index + 1, index)
    );

    // Créer les decks
    const decks: Decks = {
      cards: cards.main,
      cardRow: [],
      discardPile: [],
      roundDecks: {}
    };

    // Créer les espèces (non découvertes initialement)
    const species = this.createSpecies(cards);

    // Créer le plateau
    const board = BoardManager.createInitialBoard();

    // Journal de départ : l'arrivée des joueurs est écrite par setFirstPlayer (ordre du tour)
    const gameLog: GameLogEntry[] = [];

    const neutralCount = playerNames.length === 2 ? 2 : (playerNames.length === 3 ? 1 : 0);
    const neutralMilestonesAvailable: Record<number, number> = {};
    NEUTRAL_MILESTONES.forEach(m => {
      neutralMilestonesAvailable[m] = neutralCount;
    });

    let firstPlayerIndex = 0;
    if (!humanIsFirstPlayer && players.length > 1) {
      // Si l'humain (index 0) ne commence pas, on choisit un robot au hasard (index 1 à N-1)
      firstPlayerIndex = Math.floor(random() * (players.length - 1)) + 1;
    }

    const game: Game = {
      id: `game_${uniqueId()}`,
      seed,
      currentRound: 1,
      maxRounds: GAME_CONSTANTS.MAX_ROUNDS,
      currentPlayerIndex: firstPlayerIndex,
      firstPlayerIndex: firstPlayerIndex,
      phase: GamePhase.SETUP,
      players,
      board,
      decks,
      species,
      discoveredSpecies: [],
      isFirstToPass: false,
      isRoundEnd: false,
      gameLog,
      neutralMilestonesAvailable,
      isSpeciesDiscovered: false
    };

    // Les tirages suivants (premier joueur, initializeGame) reprennent de cet état
    return { ...this.setFirstPlayer(game, firstPlayerIndex), rngState: getRandomState() };
  }

  /**
   * Premier joueur de la partie : il joue le 1er tour, et les PV de départ suivent l'ordre du tour
   * (1 PV pour le premier, 2 pour le deuxième…, règles : « Le premier joueur commence avec 1 PV et l'autre avec 2 PV »).
   * Réécrit l'arrivée des joueurs dans le journal de départ, dans l'ordre du tour.
   */
  static setFirstPlayer(game: Game, firstIndex: number): Game {
    const count = game.players.length;
    if (!Number.isInteger(firstIndex) || firstIndex < 0 || firstIndex >= count) {
      throw new Error(`Premier joueur invalide : ${firstIndex}`);
    }
    const updatedGame = cloneGame(game);
    updatedGame.firstPlayerIndex = firstIndex;
    updatedGame.currentPlayerIndex = firstIndex;
    const joins: GameLogEntry[] = [];
    for (let rank = 0; rank < count; rank++) {
      const player = updatedGame.players[(firstIndex + rank) % count];
      player.score = rank + 1;
      joins.push({
        id: `log_join_${uniqueId()}`,
        message: `${player.name} a rejoint la partie (${rank + 1}${rank === 0 ? 'er' : 'ème'} joueur) avec ${player.score} PV`,
        timestamp: Date.now(),
        playerId: player.id,
      });
    }
    updatedGame.gameLog = [...joins, ...(updatedGame.gameLog || []).filter(log => !log.id.startsWith('log_join_'))];
    return updatedGame;
  }

  /**
   * Crée un joueur initialisé
   */
  private static createPlayer(id: string, name: string, initialScore: number, index: number): Player {
    return {
      id,
      name,
      credits: GAME_CONSTANTS.INITIAL_CREDITS,
      energy: GAME_CONSTANTS.INITIAL_ENERGY,
      data: GAME_CONSTANTS.INITIAL_DATA,
      mediaCoverage: GAME_CONSTANTS.INITIAL_MEDIA_COVERAGE,
      revenueCredits: GAME_CONSTANTS.INITIAL_REVENUE_CREDITS,
      revenueEnergy: GAME_CONSTANTS.INITIAL_REVENUE_ENERGY,
      revenueCards: GAME_CONSTANTS.INITIAL_REVENUE_CARDS,
      probes: [],
      technologies: [],
      cards: [],
      playedCards: [],
      reservedCards: [],
      missions: [],
      dataComputer: this.createDataComputer(),
      lifeTraces: [],
      score: initialScore,
      hasPassed: false,
      hasPerformedMainAction: false,
      type: 'human',
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      danger: 0,
      claimedGoldenMilestones: [],
      claimedNeutralMilestones: [],
      visitedPlanetsThisTurn: [],
      activeBuffs: [],
      permanentBuffs: [],
      centaurienMilestones: [],
      claimedExertienMilestones: []
    };
  }

  /**
   * Crée un ordinateur de données vide
   */
  private static createDataComputer(): DataComputer {
    return {
      canAnalyze: false,
      slots: {
        '1a': { id: '1a', filled: false, type: 'top', col: 1, isOccupied: false },
        '1b': { id: '1b', filled: false, type: 'bottom', parentId: '1a', col: 1, isOccupied: false },
        '2': { id: '2', filled: false, type: 'top', bonus: 'media', col: 2, isOccupied: false },
        '3a': { id: '3a', filled: false, type: 'top', col: 3, isOccupied: false },
        '3b': { id: '3b', filled: false, type: 'bottom', parentId: '3a', col: 3, isOccupied: false },
        '4': { id: '4', filled: false, type: 'top', bonus: 'reservation', col: 4, isOccupied: false },
        '5a': { id: '5a', filled: false, type: 'top', col: 5, isOccupied: false },
        '5b': { id: '5b', filled: false, type: 'bottom', parentId: '5a', col: 5, isOccupied: false },
        '6a': { id: '6a', filled: false, type: 'top', col: 6, isOccupied: false },
        '6b': { id: '6b', filled: false, type: 'bottom', parentId: '6a', col: 6, isOccupied: false },
      }
    };
  }

  /**
   * Initialise une partie (après le SETUP)
   */
  static initializeGame(game: Game): Game {
    if (game.phase !== GamePhase.SETUP) {
      throw new Error('La partie doit être en phase SETUP');
    }

    // Repart de l'état du générateur noté par createGame (ou par le tirage du premier joueur)
    if (game.rngState !== undefined) setRandomState(game.rngState);
    let updatedGame = cloneGame(game);

    // Mélanger le deck de cartes
    updatedGame.decks.cards = ResourceSystem.shuffle(updatedGame.decks.cards);

    // Créer les paquets de fin de manche (Manches 1 à 4) avec des vraies cartes
    const cardsPerDeck = updatedGame.players.length + 1;
    for (let i = 1; i <= GAME_CONSTANTS.MAX_ROUNDS - 1; i++) {
      updatedGame.decks.roundDecks[i] = [];
      for (let j = 0; j < cardsPerDeck; j++) {
        const card = updatedGame.decks.cards.shift();
        if (card) updatedGame.decks.roundDecks[i].push(card);
      }
    }

    // Remplir la rangée de cartes
    updatedGame = CardSystem.refillCardRow(updatedGame);

    // Distribuer les cartes initiales
    for (let i = 0; i < updatedGame.players.length; i++) {
      const playerId = updatedGame.players[i].id;
      updatedGame = CardSystem.drawCards(updatedGame, playerId, GAME_CONSTANTS.INITIAL_HAND_SIZE);
    }

    // Mélanger les cartes des espèces
    updatedGame.board.alienBoards.forEach(alienBoard => {
      const species = updatedGame.species.find(s => s.name === alienBoard.speciesId);
      if (species) {
        species.cards = ResourceSystem.shuffle(species.cards);
      }
    });

    // Mélanger les technologies et appliquer les bonus de pile
    this.shuffleTechnologies(updatedGame);

    Logger.log(updatedGame, "--- PHASE DE RÉSERVATION ---");

    // Le générateur de la partie reprend ici à chaque commande (session/GameSession)
    updatedGame.rngState = getRandomState();
    return updatedGame;
  }

  /**
   * Mélange les piles de technologies et applique le bonus à la première carte
   */
  private static shuffleTechnologies(game: Game): void {
    if (game.board.technologyBoard.categorySlots) {
      game.board.technologyBoard.categorySlots.forEach(slot => {
        const stacks = new Map<string, Technology[]>();

        // Regrouper les technologies par pile (basé sur l'ID racine, ex: 'exploration-1')
        slot.technologies.forEach(tech => {
          const lastDashIndex = tech.id.lastIndexOf('-');
          const baseId = tech.id.substring(0, lastDashIndex);

          if (!stacks.has(baseId)) {
            stacks.set(baseId, []);
          }
          stacks.get(baseId)!.push(tech);
        });

        const shuffledTechnologies: Technology[] = [];

        // Mélanger chaque pile et appliquer le bonus
        stacks.forEach((stack) => {
          const shuffledStack = ResourceSystem.shuffle(stack);

          // La première carte (visible) gagne +2 PV
          if (shuffledStack.length > 0) {
            shuffledStack[0].bonus = {
              ...shuffledStack[0].bonus,
              pv: (shuffledStack[0].bonus.pv || 0) + 2
            };
          }

          shuffledTechnologies.push(...shuffledStack);
        });

        slot.technologies = shuffledTechnologies;
      });

      // Mettre à jour la liste globale des technologies disponibles
      game.board.technologyBoard.available = game.board.technologyBoard.categorySlots.flatMap(s => s.technologies);
    }
  }

  /**
   * Crée les espèces alien
   */
  private static createSpecies(cards: Record<CardFile, Card[]>): Species[] {
    return [
      {
        id: `species-${AlienBoardType.MASCAMITES}-${uniqueId()}`,
        name: AlienBoardType.MASCAMITES,
        description: `Nous avons découvert une forme de vie sur les lunes de Jupiter et de Saturne. Le nom donné à cette espèce s'inspire de son régime alimentaire, car ces créatures \
        se nourissent d'un minérallunaire rare, la mascagnite. Elles présentent des similarités comportementales avec les insectes terriens. Toutefois, seule une étude approfondie de \
        quelques spécimens permettra de révéler leur vraie nature.`,
        fixedSlots: {
          redlifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, { pv: 5 }, { pv: 4 }],
          yellowlifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, { pv: 5 }, { pv: 4 }],
          bluelifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, {}, {}, {}, {}, {}, {}, {}]
        },
        infiniteSlots: {
          redlifetrace: {},
          yellowlifetrace: {},
          bluelifetrace: {}
        },
        cards: cards.mascamites,
        cardRow: [],
        discovered: false,
        specimen: [
          { bonus: { credits: 2 } },
          { bonus: { energy: 2 } },
          { bonus: { media: 3 } },
          { bonus: { data: 2 } },
          { bonus: { card: 2 } },
          { bonus: { pv: 3, anycard: 1 } },
          { bonus: { pv: 7 } },
        ]
      },
      {
        id: `species-${AlienBoardType.ANOMALIES}-${uniqueId()}`,
        name: AlienBoardType.ANOMALIES,
        description: `Trois gigantesques objets hautement réfléchissants ont été repérés dans le système solaire. Ces "anomalies" provoquent des distorsions de l'espace-temps \
        autour d'elles, permettant ainsi une connexion avec des observateurs lointains. Depuis leur découverte, certaines personnes les vénèrent, d'autres les dénigrent... Ce \
        qui est sûr, c'est que cette avancée a redéfini le sens de l'unité à l'échelle mondiale. Nous les observons. Nous observent-elles également ?`,
        fixedSlots: {
          redlifetrace: [{ pv: 4, speciesCard: 1 }, { pv: 2, speciesCard: 1 }, { pv: 2, media: 1 }, { pv: 3 }],
          yellowlifetrace: [{ pv: 4, speciesCard: 1 }, { pv: 2, speciesCard: 1 }, { pv: 2, media: 1 }, { pv: 3 }],
          bluelifetrace: [{ pv: 4, speciesCard: 1 }, { pv: 2, speciesCard: 1 }, { pv: 2, media: 1 }, { pv: 3 }]
        },
        infiniteSlots: {
          redlifetrace: { pv: 2 },
          yellowlifetrace: { pv: 2 },
          bluelifetrace: { pv: 2 }
        },
        cards: cards.anomalies,
        cardRow: [],
        discovered: false,
        anomalie: [
          { color: LifeTraceType.RED, head: { credits: 1 }, tail: { pv: 4 } },
          { color: LifeTraceType.YELLOW, head: { media: 2 }, tail: { anycard: 1 } },
          { color: LifeTraceType.BLUE, head: { data: 1 }, tail: { energy: 1 } },
        ]
      },
      {
        id: `species-${AlienBoardType.OUMUAMUA}-${uniqueId()}`,
        name: AlienBoardType.OUMUAMUA,
        description: `Cet astéroïde de 400 mètres de long est le premier objet extrasolaire observé dans le système solaire. A sa surface, nous avons fait une découverte fascinante: \
        les restes fossilisés d'une forme de vie extraterrestre. Une étude approfondie de ces exofossiles pourrait changer à jamais notre compréhension de la vie dans l'univers.`,
        fixedSlots: {
          redlifetrace: [{ pv: 25, token: -4 }, { pv: 3, speciesCard: 1, token: 1 }, { pv: 3, speciesCard: 1 }, { pv: 2, token: 1 }],
          yellowlifetrace: [{ pv: 25, token: -4 }, { pv: 3, speciesCard: 1, token: 1 }, { pv: 3, speciesCard: 1 }, { pv: 2, token: 1 }],
          bluelifetrace: [{ pv: 25, token: -4 }, { pv: 3, speciesCard: 1, token: 1 }, { pv: 3, speciesCard: 1 }, { pv: 2, token: 1 }]
        },
        infiniteSlots: {
          redlifetrace: { pv: 6, token: -1 },
          yellowlifetrace: { pv: 6, token: -1 },
          bluelifetrace: { pv: 6, token: -1 }
        },
        cards: cards.oumuamua,
        cardRow: [],
        discovered: false,
        sector: {
          id: 'oumuamua',
          name: 'Oumuamua',
          color: SectorType.OUMUAMUA,
          signals: [
            { id: `sig_${random().toString(36).substr(2, 9)}`, type: SignalType.DATA, marked: false, bonus: { pv: 1 } },
            { id: `sig_${random().toString(36).substr(2, 9)}`, type: SignalType.DATA, marked: false, bonus: {} },
            { id: `sig_${random().toString(36).substr(2, 9)}`, type: SignalType.DATA, marked: false, bonus: { pv: 2 } },
          ],
          playerMarkers: [],
          isCovered: false,
          coveredBy: [],
          firstBonus: {},
          nextBonus: {}
        },
        planet: (() => {
          const p: Planet = {
            id: 'oumuamua',
            name: 'Oumuamua',
            orbiters: [],
            landers: [],
            orbitFirstBonus: { speciesCard: 1 },
            orbitNextBonus: { pv: 10, token: 1, signals: [{ amount: 1, scope: SectorType.OUMUAMUA }] },
            landFirstBonus: { data: 3 },
            landSecondBonus: { data: 2 },
            landThirdBonus: { data: 1 },
            landNextBonus: { pv: 9, token: 2 },
            orbitSlots: [],
            landSlots: []
          };
          p.orbitSlots = new Array(5).fill(null).map((_, i) => {
            if (i === 0) return ResourceSystem.mergeBonuses(p.orbitFirstBonus, p.orbitNextBonus);
            return p.orbitNextBonus || {};
          });
          p.landSlots = new Array(4).fill(null).map((_, i) => {
            if (i === 0) return ResourceSystem.mergeBonuses(p.landFirstBonus, p.landNextBonus);
            if (i === 1) return ResourceSystem.mergeBonuses(p.landSecondBonus, p.landNextBonus);
            if (i === 2) return ResourceSystem.mergeBonuses(p.landThirdBonus, p.landNextBonus);
            return p.landNextBonus || {};
          });
          return p;
        })(),

      },
      {
        id: `species-${AlienBoardType.CENTAURIENS}-${uniqueId()}`,
        name: AlienBoardType.CENTAURIENS,
        description: `Nous avons établi le contact avec une civilisation intelligente, situé à 4.5 années lumière de la Terre. Elle utilise une technologie comparable à la nôtre, \
        ce qui signifie que nous devons attendre 9 ans avant de recevoir leur réponse. Pendant ce temps, astronomes et scientifiques travaillent sans relâche sur Terre pour décoder \
        leurs messages.`,
        fixedSlots: {
          redlifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, { pv: 5 }, { pv: 15, data: -3 }],
          yellowlifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, { pv: 5 }, { pv: 15, data: -3 }],
          bluelifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, { pv: 5 }, { pv: 15, data: -3 }]
        },
        infiniteSlots: {
          redlifetrace: { pv: 6, data: -1 },
          yellowlifetrace: { pv: 6, data: -1 },
          bluelifetrace: { pv: 6, data: -1 }
        },
        cards: cards.centauriens,
        cardRow: [],
        discovered: false,
        message: [
          {
            bonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.ANY }] },
            isAvailable: true,
          },
          {
            bonus: { speciesCard: 1, energy: 1 },
            isAvailable: true,
          },
          {
            bonus: { media: 3 },
            isAvailable: true,
          },
          {
            bonus: { pv: 8 },
            isAvailable: true,
          }
        ]
      },
      {
        id: `species-${AlienBoardType.EXERTIENS}-${uniqueId()}`,
        name: AlienBoardType.EXERTIENS,
        description: `Découverts grâce aux balises qu'ils essaiment derrière eux, les Exertiens utilisaient une technologie avancée de forage afin d'extraire l'énergie du noyau \
        des planètes. L'exploitation intense de cette technologie a finalement conduit à leur extinction. L'utilisation de cette technologie doit être envisagée avec précaution: \
        sa surexploitation pourrait engendrer une désapprobation massive de la population.`,
        fixedSlots: {
          redlifetrace: [{ pv: 9, credits: 1, danger: 3 }, { pv: 7, credits: 1, danger: 3 }, { pv: 5, credits: 1, danger: 2 }, { pv: 4, credits: 1, danger: 2 }, { pv: 3, media: 1, danger: 1 }],
          yellowlifetrace: [{ pv: 6, energy: 1, anycard: 1, danger: 3 }, { pv: 4, energy: 1, anycard: 1, danger: 3 }, { pv: 2, energy: 1, anycard: 1, danger: 2 }, { pv: 1, energy: 1, anycard: 1, danger: 2 }, { pv: 3, media: 1, danger: 1 }],
          bluelifetrace: [{ pv: 6, data: 1, media: 1, danger: 3 }, { pv: 4, data: 1, media: 1, danger: 3 }, { pv: 2, data: 1, media: 1, danger: 2 }, { pv: 1, data: 1, media: 1, danger: 2 }, { pv: 3, media: 1, danger: 1 }]
        },
        infiniteSlots: {
          redlifetrace: {},
          yellowlifetrace: {},
          bluelifetrace: {}
        },
        cards: cards.exertiens,
        cardRow: [],
        discovered: false
      },
    ];
  }
}
