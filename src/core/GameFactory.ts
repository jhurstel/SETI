/**
 * Factory pour créer et initialiser une nouvelle partie de SETI
 */

import { Game, GamePhase, Player, Decks, Species, DataComputer, GAME_CONSTANTS, Technology, SectorType, GameLogEntry, LifeTraceType, NEUTRAL_MILESTONES, AlienBoardType, Bonus, SignalType, Planet } from './types';
import { BoardManager } from './Board';
import { CardSystem } from '../systems/CardSystem';
import { Logger } from './Logger';
import { DataLoader } from './DataLoader';

export class GameFactory {
  /**
   * Crée une nouvelle partie
   */
  static async createGame(playerNames: string[], humanIsFirstPlayer: boolean = true): Promise<Game> {
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
      cards: await DataLoader.loadCards('assets/Cartes.csv'),
      cardRow: [],
      discardPile: [],
      roundDecks: {}
    };

    // Créer les espèces (non découvertes initialement)
    const species = await this.createSpecies();

    // Créer le plateau
    const board = BoardManager.createInitialBoard();

    // Initialiser les logs
    const gameLog: GameLogEntry[] = [];
    const addLog = (message: string, playerId?: string) => {
        gameLog.push({
            id: `log_init_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            message,
            timestamp: Date.now(),
            playerId
        });
    };

    players.map((p, index) => {
      const suffix = index === 0 ? 'er' : 'ème';
      addLog(`${p.name} a rejoint la partie (${index + 1}${suffix} joueur) avec ${p.score} PV`, p.id);
    })
    
    const neutralCount = playerNames.length === 2 ? 2 : (playerNames.length === 3 ? 1 : 0);
    const neutralMilestonesAvailable: Record<number, number> = {};
    NEUTRAL_MILESTONES.forEach(m => {
        neutralMilestonesAvailable[m] = neutralCount;
    });

    let firstPlayerIndex = 0;
    if (!humanIsFirstPlayer && players.length > 1) {
        // Si l'humain (index 0) ne commence pas, on choisit un robot au hasard (index 1 à N-1)
        firstPlayerIndex = Math.floor(Math.random() * (players.length - 1)) + 1;
    }

    const game: Game = {
      id: `game_${Date.now()}`,
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
      history: [],
      isFirstToPass: false,
      isRoundEnd: false,
      gameLog,
      neutralMilestonesAvailable
    };

    return game;
  }

  /**
   * Crée un joueur initialisé
   */
  private static createPlayer(id: string, name: string, initialScore: number, index: number): Player {
    const colors = ['#4a90e2', '#ff6b6b', '#ffd700', '#4caf50']; // Bleu, Rouge, Jaune, Vert
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
      color: colors[index % colors.length],
      claimedGoldenMilestones: [],
      claimedNeutralMilestones: [],
      visitedPlanetsThisTurn: [],
      activeBuffs: [],
      permanentBuffs: []
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
        '2':  { id: '2', filled: false, type: 'top', bonus: 'media', col: 2, isOccupied: false },
        '3a': { id: '3a', filled: false, type: 'top', col: 3, isOccupied: false },
        '3b': { id: '3b', filled: false, type: 'bottom', parentId: '3a', col: 3, isOccupied: false },
        '4':  { id: '4', filled: false, type: 'top', bonus: 'reservation', col: 4, isOccupied: false },
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

    let updatedGame = { ...game };

    // Mélanger le deck de cartes
    updatedGame.decks.cards = this.shuffleCards(updatedGame.decks.cards);

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
        species.cards = this.shuffleCards(species.cards);
      }
    });

    // Mélanger les technologies et appliquer les bonus de pile
    this.shuffleTechnologies(updatedGame);

    Logger.log(updatedGame, "--- PHASE DE RÉSERVATION ---");

    return updatedGame;
  }

  /**
   * Mélange un tableau de manière aléatoire (Fisher-Yates shuffle)
   */
  private static shuffleCards<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  /**
   * Mélange les piles de technologies et applique le bonus à la première carte
   */
  private static shuffleTechnologies(game: Game): void {
    const shuffle = <T>(array: T[]): T[] => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

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
          const shuffledStack = shuffle(stack);
          
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
   * Helper pour fusionner les bonus
   */
  private static mergeBonuses(...bonuses: (Bonus | undefined)[]): Bonus {
    const result: Bonus = {};
    bonuses.forEach(b => {
      if (!b) return;
      (Object.keys(b) as Array<keyof Bonus>).forEach(key => {
        const k = key as keyof Bonus;
        const val = b[k];
        if (typeof val === 'number') {
          (result as any)[k] = ((result[k] as number) || 0) + val;
        } else if (val !== undefined) {
          if (Array.isArray(val)) {
             const existing = (result[k] as any[]) || [];
             (result as any)[k] = [...existing, ...val];
          } else {
            (result as any)[k] = val;
          }
        }
      });
    });
    return result;
  }

  /**
   * Crée les espèces alien
   */
  private static async createSpecies(): Promise<Species[]> {
    return [
      {
        id: `species-${AlienBoardType.MASCAMITES}-${Date.now()}`,
        name: AlienBoardType.MASCAMITES,
        description: `Nous avons découvert une forme de vie sur les lunes de Jupiter et de Saturne. Le nom donné à cette espèce s'inspire de son régime alimentaire, car ces créatures \
        se nourissent d'un minérallunaire rare, la mascagnite. Elles présentent des similarités comportementales avec les insectes terriens. Toutefois, seule une étude approfondie de \
        quelques spécimens permettra de révéler leur vraie nature.`,
        fixedSlots: {
          redlifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, { pv: 5 }, { pv: 4 }],
          yellowlifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, { pv: 5 }, { pv: 4 }],
          bluelifetrace: [{ pv: 5, speciesCard: 1 }, { pv: 3, speciesCard: 1 }, {}, {}, {}, {}, {}, {}, {} ]
        },
        infiniteSlots: {
          redlifetrace: {},
          yellowlifetrace: {},
          bluelifetrace: {}
        },
        cards: await DataLoader.loadCards('assets/mascamites.csv'),
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
        id: `species-${AlienBoardType.ANOMALIES}-${Date.now()}`,
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
          redlifetrace: { pv: 2},
          yellowlifetrace: { pv: 2},
          bluelifetrace: { pv: 2}
        },
        cards: await DataLoader.loadCards('assets/anomalies.csv'),
        cardRow: [],
        discovered: false,
        anomalie: [
          { color: LifeTraceType.RED, head: { credits: 1 }, tail: { pv: 4 } },
          { color: LifeTraceType.YELLOW, head: { media: 2 }, tail: { anycard: 1 } },
          { color: LifeTraceType.BLUE, head: { data: 1 }, tail: { energy: 1 } },
        ]
      },
      {
        id: `species-${AlienBoardType.OUMUAMUA}-${Date.now()}`,
        name: AlienBoardType.OUMUAMUA,
        description: `Cet astéroïde de 400 mètres de long est le premier objet extrasolaire observé dans le système solaire. A sa surface, nous avons fait une découverte fascinante: \
        les restes fossilisés d'une forme de vie extraterrestre. Une étude approfondie de ces exofossiles pourrait changer à jamais notre compréhension de la vie dans l'univers.`,
        fixedSlots: {
          redlifetrace: [{ pv: 25, token: -4 }, { pv: 3, speciesCard: 1, token: 1 }, { pv: 3, speciesCard: 1 }, { pv: 2, token: 1 }],
          yellowlifetrace: [{ pv: 25, token: -4 }, { pv: 3, speciesCard: 1, token: 1 }, { pv: 3, speciesCard: 1 }, { pv: 2, token: 1 }],
          bluelifetrace: [{ pv: 25, token: -4 }, { pv: 3, speciesCard: 1, token: 1 }, { pv: 3, speciesCard: 1 }, { pv: 2, token: 1 }]
        },
        infiniteSlots: {
          redlifetrace: { pv: 6, token: -1},
          yellowlifetrace: { pv: 6, token: -1},
          bluelifetrace: { pv: 6, token: -1}
        },
        cards: await DataLoader.loadCards('assets/oumuamua.csv'),
        cardRow: [],
        discovered: false,
        sector: {
          id: 'oumuamua',
          name: 'Oumuamua',
          color: SectorType.OUMUAMUA,
          signals: [
            { id: `sig_${Math.random().toString(36).substr(2, 9)}`, type: SignalType.DATA, marked: false, bonus: { pv: 1 } },
            { id: `sig_${Math.random().toString(36).substr(2, 9)}`, type: SignalType.DATA, marked: false, bonus: {} },
            { id: `sig_${Math.random().toString(36).substr(2, 9)}`, type: SignalType.DATA, marked: false, bonus: { pv: 2 } },
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
                if (i === 0) return this.mergeBonuses(p.orbitFirstBonus, p.orbitNextBonus);
                return p.orbitNextBonus || {};
            });
            p.landSlots = new Array(4).fill(null).map((_, i) => {
                if (i === 0) return this.mergeBonuses(p.landFirstBonus, p.landNextBonus);
                if (i === 1) return this.mergeBonuses(p.landSecondBonus, p.landNextBonus);
                if (i === 2) return this.mergeBonuses(p.landThirdBonus, p.landNextBonus);
                return p.landNextBonus || {};
            });
            return p;
        })(),
  
      },
      {
        id: `species-${AlienBoardType.CENTAURIENS}-${Date.now()}`,
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
          redlifetrace: { pv: 6, data: -1},
          yellowlifetrace: { pv: 6, data: -1},
          bluelifetrace: { pv: 6, data: -1}
        },
        cards: await DataLoader.loadCards('assets/centauriens.csv'),
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
        id: `species-${AlienBoardType.EXERTIENS}-${Date.now()}`,
        name: AlienBoardType.EXERTIENS,
        description: `Découverts grâce aux balises qu'ils essaiment derrière eux, les Exertiens utilisaient une technologie avancée de forage afin d'extraire l'énergie du noyau \
        des planètes. L'exploitation intense de cette technologie a finalement conduit à leur extinction. L'utilisation de cette technologie doit être envisagée avec précaution: \
        sa surexploitation pourrait engendrer une désapprobation massive de la population.`,
        fixedSlots: {
          redlifetrace: [{ pv: 9, credits: 1 }, { pv: 7, credits: 1 }, { pv: 5, credits: 1 }, { pv: 4, credits: 1 }, { pv: 3, media: 1 }],
          yellowlifetrace: [{ pv: 6, energy: 1, anycard: 1 }, { pv: 4, energy: 1, anycard: 1 }, { pv: 2, energy: 1, anycard: 1 }, { pv: 1, energy: 1, anycard: 1 }, { pv: 3, media: 1 }],
          bluelifetrace: [{ pv: 6, data: 1, media: 1 }, { pv: 4, data: 1, media: 1 }, { pv: 2, data: 1, media: 1 }, { pv: 1, data: 1, media: 1 }, { pv: 3, media: 1 }]
        },
        infiniteSlots: {
          redlifetrace: {},
          yellowlifetrace: {},
          bluelifetrace: {}
        },
        cards: await DataLoader.loadCards('assets/exertiens.csv'),
        cardRow: [],
        discovered: false
      },
    ];
  }
}
