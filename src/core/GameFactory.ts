/**
 * Factory pour créer et initialiser une nouvelle partie de SETI
 */

import {
  Game,
  GamePhase,
  Player,
  Decks,
  Species,
  DataComputer,
  GAME_CONSTANTS,
  Technology,
  Card,
  CardType,
  FreeActionType,
  SectorColor,
  RevenueType,
  CardEffect,
  GameLogEntry,
  TechnologyCategory
} from './types';
import { BoardManager } from './Board';
import { CardSystem } from '../systems/CardSystem';

export class GameFactory {
  /**
   * Crée une nouvelle partie
   */
  static createGame(playerNames: string[]): Game {
    if (playerNames.length < GAME_CONSTANTS.MIN_PLAYERS || playerNames.length > GAME_CONSTANTS.MAX_PLAYERS) {
      throw new Error(
        `Nombre de joueurs invalide (min ${GAME_CONSTANTS.MIN_PLAYERS}, max ${GAME_CONSTANTS.MAX_PLAYERS})`
      );
    }

    // Créer les joueurs
    const players: Player[] = playerNames.map((name, index) => 
      this.createPlayer(`player_${index}`, name, index + 1)
    );

    // Créer les decks
    const decks: Decks = {
      cards: this.createActionDeck(),
      speciesCards: [],
      cardRow: [],
      discardPile: [],
      roundDecks: {}
    };

    // Créer le plateau
    const board = BoardManager.createInitialBoard();

    // Créer les espèces (non découvertes initialement)
    const species: Species[] = [];

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
      addLog(`${p.name} a rejoint la partie (${index + 1}${suffix} joueur) avec ${p.score} PV`);
    })
    
    const game: Game = {
      id: `game_${Date.now()}`,
      currentRound: 1,
      maxRounds: GAME_CONSTANTS.MAX_ROUNDS,
      currentPlayerIndex: 0,
      firstPlayerIndex: 0,
      phase: GamePhase.SETUP,
      players,
      board,
      decks,
      species,
      discoveredSpecies: [],
      history: [],
      isFirstToPass: false,
      gameLog
    };

    return game;
  }

  /**
   * Crée un joueur initialisé
   */
  private static createPlayer(id: string, name: string, initialScore: number): Player {
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
      missions: [],
      dataComputer: this.createDataComputer(),
      lifeTraces: [],
      score: initialScore,
      hasPassed: false,
      type: 'human',
      color: '#4a90e2' as string,
      claimedMilestones: [],
      visitedPlanetsThisTurn: [],
      activeBuffs: []
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
        updatedGame = CardSystem.drawCards(updatedGame, playerId, GAME_CONSTANTS.INITIAL_HAND_SIZE, "Main de départ");
        
        // Logique Robot : Réservation automatique au début de la partie
        const currentPlayer = updatedGame.players.find(p => p.id === playerId);
        if (currentPlayer && currentPlayer.type === 'robot' && currentPlayer.cards.length > 0) {
            const randomIndex = Math.floor(Math.random() * currentPlayer.cards.length);
            const card = currentPlayer.cards[randomIndex];
            
            // Retirer la carte
            currentPlayer.cards.splice(randomIndex, 1);
            
            let gainMsg = "";
            // Appliquer le revenu et le bonus immédiat
            if (card.revenue === RevenueType.CREDIT) {
                currentPlayer.revenueCredits += 1;
                currentPlayer.credits += 1;
                gainMsg = "1 Crédit";
            } else if (card.revenue === RevenueType.ENERGY) {
                currentPlayer.revenueEnergy += 1;
                currentPlayer.energy += 1;
                gainMsg = "1 Énergie";
            } else if (card.revenue === RevenueType.CARD) {
                currentPlayer.revenueCards += 1;
                gainMsg = "1 Carte";
                // Pioche immédiate
                if (updatedGame.decks.cards.length > 0) {
                    const newCard = updatedGame.decks.cards.shift();
                    if (newCard) currentPlayer.cards.push(newCard);
                }
            }

            if (updatedGame.gameLog) {
                updatedGame.gameLog.push({
                    id: `log_robot_reserve_${Date.now()}_${playerId}`,
                    message: `réserve carte "${card.name}" et gagne ${gainMsg}`,
                    timestamp: Date.now(),
                    playerId: currentPlayer.id
                });
            }
        }
    }

    // Mélanger les technologies et appliquer les bonus de pile
    this.shuffleTechnologies(updatedGame);

    if (updatedGame.gameLog) {
      updatedGame.gameLog.push({
          id: `log_robot_reserve_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: "--- DÉBUT DE LA PARTIE ---",
          timestamp: Date.now()
      });
    }
    updatedGame.phase = GamePhase.PLAYING;

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
   * Mock
   */
  //private static createRandomCard(id: number): Card {
  //  const colors = [SectorColor.BLUE, SectorColor.RED, SectorColor.YELLOW, SectorColor.BLACK];
  //  const freeActions = [FreeActionType.DATA, FreeActionType.MEDIA, FreeActionType.MOVEMENT];
  //  const revenues = [RevenueType.CREDIT, RevenueType.ENERGY, RevenueType.CARD];
  //  return {
  //      id: `random_card_${id}`,
  //      name: `Projet ${id+1}`,
  //      type: CardType.ACTION,
  //      cost: Math.floor(Math.random() * 5) + 1,
  //      freeAction: freeActions[Math.floor(Math.random() * freeActions.length)],
  //      scanSector: colors[Math.floor(Math.random() * colors.length)],
  //      revenue: revenues[Math.floor(Math.random() * revenues.length)],
  //      effects: [],
  //      description: "Carte random"
  //  };
  //}
    
  /**
   * Crée le paquet de cartes Action initial
   * Importé depuis cartes.csv
   */
  private static createActionDeck(): Card[] {
    const csvContent = `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte
9;Falcon Heavy;Action;Gagnez 2 sondes et 1 Média. Ignorez la limite de sondes sur le plateau Systéme Solaire pour ces lancements.;1 Déplacement;Jaune;1 Crédit;3 Crédits;2 Sondes + 1 Média;IGNORE_PROBE_LIMIT
11;Subventions;Action;Gagnez 1 Carte. Révélez la carte que vous avez piochée et bénéfciez de son action gratuite.;1 Média;Jaune;1 Energie;1 Crédit;1 Carte;REVEAL_AND_TRIGGER_FREE_ACTION
13;Rover Perseverance;Action;Gagnez 1 Atterrissage. Si vous posez une sonde sur Mars, Mercure ou n'importe quelle lune avec cette action, gagnez 4 PVs.;1 Média;Bleu;1 Pioche;1 Crédit;1 Atterrissage;
15;Rentrée Atmosphérique;Action;Retirez l'un de vos orbiteurs de n'importe quelle planète pour gagner 3 PVs, 1 Donnée, 1 Carte.;1 Déplacement;Bleu;1 Crédit;1 Crédit;;ATMOSPHERIC_ENTRY
16;Dragonfly;Action;Gagnez 1 Atterrissage. Vous pouvez poser une sonde sur une case déjà occupée, et tout de même gagner la récompense recouverte.;1 Déplacement;Bleu;1 Crédit;1 Crédit;1 Atterrissage;
17;OSIRIS-REx;Action;Choisissez 1 de vos sondes. Gagnez 2 Données si elle est placée sur un champ d'astéroïdes et 1 Donnée pour chaque champ d'astéroïdes adjacent.;1 Déplacement;Jaune;1 Energie;1 Crédit;;OSIRIS_REX_BONUS
19;Assistance Gravitationnelle;Action;Gagnez 2 Déplacements. Chaque fois que vous visitez une planète ce tour-ci, vous pouvez gagner 1 Déplacement au lieu de 1 Média.;1 Média;Jaune;1 Crédit;Crédit;2 Déplacements;CHOICE_MEDIA_OR_MOVE
20;Survol de Mercure;Action;Gagnez 2 Déplacements. Si vous visitez Mercure ce tour-ci, gagnez 4 PVs.;1 Média;Rouge;1 Energie;1 Crédit;2 Déplacements;VISIT_PLANET:mercury:4
21;Survol de Vénus;Action;Gagnez 2 Déplacements. Si vous visitez Vénus ce tour-ci, gagnez 3 PVs.;1 Média;Jaune;1 Crédit;1 Crédit;2 Déplacements;VISIT_PLANET:venus:3
22;Survol de Mars;Action;Gagnez 2 Déplacements. Si vous visitez Mars ce tour-ci, gagnez 4 PVs.;1 Donnée;Jaune;1 Energie;1 Crédit;2 Déplacements;VISIT_PLANET:mars:4
23;Survol de Jupiter;Action;Gagnez 2 Déplacements. Si vous visitez Jupiter ce tour-ci, gagnez 4 PVs.;1 Média;Bleu;1 Energie;1 Crédit;2 Déplacements;VISIT_PLANET:jupiter:4
24;Survol de Saturne;Action;Gagnez 3 Déplacements. Si vous visitez Saturne ce tour-ci, gagnez 6 PVs.;1 Donnée;Rouge;1 Pioche;2 Crédit;3 Déplacements;VISIT_PLANET:saturn:6
25;Voile Solaire;Action;Gagnez 4 Déplacements. Gagnez 1 PV pour chaque planète unique que vous visitez ce tour-ci (y compris la Terre).;1 Média;Rouge;1 Crédit;2 Crédits;4 Déplacements;VISIT_UNIQUE:1
26;A Travers la Ceinture d'Astéroïdes;Action;Gagnez 2 déplacements. Ignorez les restrictions de déplacement lorsque vous quittez un chaamp d'astéroïdes ce tour-ci.;1 Donnée;Bleu;1 Pioche;1 Crédit;2 Déplacements;ASTEROID_EXIT_COST:1
57;Radiotélescope D'Effelsberg;Action;Gagnez 1 Carte, 1 Rotation et 1 Technologie Observation.;1 Média;Bleu;1 Energie;3 Crédits;1 Carte + 1 Rotation + 1 Tech Observation;
59;Système de Propulsion Ionique;Action;Gagez 1 Energie, 1 Rotation et 1 Technologie Exploration.;1 Média;Rouge;1 Pioche;3 Crédits;1 Energie + 1 Rotation + 1 Tech Exploration;
69;Grand Collisionneur de Hadrons;Action;Gagnez 1 Donnée, 1 Rotation et 1 Technologie Informatique.;1 Déplacement;Noir;1 Energie;3 Crédits;1 Donnée + 1 Rotation + 1 Tech Informatique;
71;Recherche Ciblée;Action;Gagnez 1 Rotation et 1 Technologie de n'importe quelle couleur. Puis gagnez 2 PV pour chaque technologie de ce type que vous possédez.;1 Média;Rouge;1 Crédit;3 Crédits;1 Rotation + 1 Tech;SCORE_PER_TECH_TYPE:2
72;Coopération Scientifique;Action;Gagnez 1 Rotation et 1 Technologie de n'importe quelle couleur. Si vous développez une technologie qu'un autre joueur possède déjà, gagnez 2 Média.;1 Donnée;Bleu;1 Energie;3 Crédits;1 Rotation + 1 Tech;MEDIA_IF_SHARED_TECH:2
73;Initiative Clean Space;Action;Défaussez les 3 cartes de la rangée de cartes pour effectuer leurs actions gratuites.;1 Média;Jaune;1 Crédit;1 Crédit;;DISCARD_ROW_FOR_FREE_ACTIONS
74;Essais de Prélancement;Action;Gagnez 1 Sonde et 1 Déplacement pour chaque carte avec une action gratuite de déplacement que vous révélez de votre main.;1 Média;Jaune;1 Pioche;2 Crédits;1 Sonde;REVEAL_MOVEMENT_CARDS_FOR_BONUS
81;Collaboration Internationale;Action;Gagnez 1 Technologie de n'importe quelle couleur qu'un autre joueur possède déjà. Ne faites pas pivoter le système solaire. Ne gagner pas le bonus indiqué sur la tuile.;1 Déplacement;Jaune;1 Pioche;2 Crédits;1 Tech;SHARED_TECH_ONLY_NO_BONUS
85;Lanceur Starship;Action;Gagnez 1 Sonde, 1 Rotation et 1 Technologie Exploration.;1 Média;Rouge;1 Crédit;4 Crédits;1 Sonde + 1 Rotation + 1 Tech Exploration;
90;Réservoirs d'Ergols;Action;Gagnez 1 Energie pour chaque carte avec un revenu Energie que vous révélez de votre main.;1 Donnée;Bleu;1 Pioche;1 Crédit;;GAIN_ENERGY_PER_ENERGY_REVENUE
91;Réacteur à Fusion;Action;Gagnez 1 Energie pour chaque carte Energie glissée sous vos revenus. Puis réservez cette carte.;1 Média;Rouge;1 Energie;3 Crédits;;GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE
92;Photo du Jour de la NASA;Action;Gagnez 2 Médias. Gagnez 1 Média pour chaque carte Pioche glissée sous vos revenus. Puis réservez cette carte.;1 Donnée;Bleu;1 Pioche;3 Crédits;2 Médias;GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE
93;Financement Public;Action;Gagnez 3 PV pour chaque carte Crédit glissée sous vos revenus. Puis réservez cette carte.;1 Média;Jaune;1 Crédit;3 Crédits;;GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE
109;Microprocesseurs Basse Consommation;Action;Gagnez 1 Energie, 1 Rotation et 1 Technologie Informatique.;1 Donnée;Jaune;1 Pioche;3 Crédits;1 Energie + 1 Rotation + 1 Tech Informatique;
110;Conférence de Presse;Action;Gagnez 3 Médias.;1 Donnée;Rouge;1 Crédit;1 Crédit;3 Médias;
119;PIXL;Action;Gagnez 1 Rotation et 1 Technologie Informatique. Gagnez ensuite 1 PV pour chaque niveau de Média que vous avez.;1 Donnée;Bleu;1 Energie;3 Crédits;1 Rotation + 1 Tech Informatique;SCORE_PER_MEDIA:1
121;Futur Collisionneur Circulaire;Action;Gagnez 3 Données, 1 Rotation et 1 Technologie Informatique.;1 Déplacement;Jaune;1 Energie;4 Crédits;3 Données + 1 Rotation + 1 Tech Informatique;
123;Survol d'Astéroïdes;Action;Gagnez 1 Déplacement. Si vous visitez un champ d'astéroïdes ce tour-ci, gagnez 1 Donnée.;1 Média;Rouge;1 Pioche;0 Crédit;1 Déplacement;VISIT_ASTEROID:1
124;Rencontre avec une Comète;Action;Gagnez 2 Déplacements. Si vous visitez une comète ce tour-ci, gagnez 4 PVs.;1 Média;Jaune;1 Energie;1 Crédit;2 Déplacements;VISIT_COMET:4
125;Correction de Trajectoire;Action;Gagnez 1 Déplacement. Si vous vous déplacez sur le même disque au moins une fois ce tour-ci, gagnez 3 PV et 1 Média.;1 Donnée;Bleu;1 Pioche;1 Crédit;1 Déplacement;SAME_DISK_MOVE:3:1
130;Lancement Spatial à Faible Coût;Action;Gagnez 1 Sonde.;1 Média;Jaune;1 Energie;1 Crédit;1 Sonde;
133;Fenêtre de Lancement Optimale;Action;Gagnez 1 Sonde. Puis 1 Déplacement pour chaque autre planète ou comète dans le même secteur que la Terre.;1 Donnée;Rouge;1 Pioche;2 Crédits;1 Sonde;OPTIMAL_LAUNCH_WINDOW
137;Archives de Données du SETI;Action;Gagnez 2 Données.;1 Média;Noir;1 Energie;1 Crédit;2 Données;
65;Radiotélescope FAST;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée, 1 Rotation et 1 Technologie Observation;1 Déplacement;Noir;1 Crédit;4 Crédits;1 Rotation + 1 Tech Observation + 2 Signaux Rangée;
67;Radiotélescope d'Eupatoria;Action;Gagnez 1 Média, 1 Rotation et 1 Technologie Observation. Puis vous pouvez défausser 1 carte de votre main pour son signal.;1 Déplacement;Bleu;1 Pioche;3 Crédits;1 Média + 1 Rotation + 1 Tech Observation;GAIN_SIGNAL_FROM_HAND:1
114;Chasseurs de Planètes;Action;Gagnez 1 Carte.Vous pouvez ensuite défausser jusqu'à 3 cartes de votre main pour leurs signaux.;1 Média;Rouge;1 Energie;1 Crédit;1 Carte;GAIN_SIGNAL_FROM_HAND:3
83;Signal "Wow!";Action;Gagnez 1 Média et 2 Signaux dans le secteur de la Terre.;1 Déplacement;Bleu;1 Energie;2 Crédits;1 Média + 2 Signaux Terre;
47;Very Large Array;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée. Si vous remplissez au moins un secteur ce tour-ci, gagnez 1 Donnée.;1 Média;Jaune;1 Energie;2 Crédits;2 Signaux Rangée;BONUS_IF_COVERED:data:1
46;Observatoire ALMA;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée. Si vous remplissez au moins un secteur ce tour-ci, gagnez 1 Pioche.;1 Déplacement;Jaune;1 Crédit;2 Crédits;2 Signaux Rangée;BONUS_IF_COVERED:draw:1
45;Allen Telescope Array;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée. Si vous remplissez au moins un secteur ce tour-ci, gagnez 1 Energie.;1 Média;Rouge;1 Pioche;2 Crédits;2 Signaux Rangée;BONUS_IF_COVERED:energy:1
28;Télescope Spatial Kepler;Action;Gagnez 1 Déplacemet et 2 Signaux dans un secteur où se trouve l'une de vos sondes.;1 Média;Bleu;1 Crédit;2 Crédits;1 Déplacement + 2 Signaux Sonde;
27;Télescope Spatial Huble;Action;Gagnez 1 Déplacemet et 1 Signal dans un secteur où se trouve l'une de vos sondes.;1 Média;Rouge;1 Pioche;1 Crédit;1 Déplacement + 1 Signal Sonde;
49;Program Breakthrough Watch;Action;Gagnez 1 Déplacement et 1 Signal dans un secteur Jaune.;1 Média;Rouge;1 Crédit;1 Crédit;1 Déplacement + 1 Signal Jaune;
50;Program Breakthrough Listen;Action;Gagnez 1 Déplacement et 1 Signal dans un secteur Bleu.;1 Média;Jaune;1 Crédit;1 Crédit;1 Déplacement + 1 Signal Bleu;
48;Program Breakthrough Starshot;Action;Gagnez 1 Déplacement et 1 Signal dans un secteur Rouge.;1 Média;Bleu;1 Crédit;1 Crédit;1 Déplacement + 1 Signal Rouge;
120;Orbite aux Points de Lagrange;Action;Gagnez 1 Signal dans un secteur où se trouve l'une de vos sondes. Si vous avez marqué exactement 1 signal dans ce secteur, reprenez cette carte en main.;1 Déplacement;Noir;1 Crédit;1 Crédit;1 Signal Sonde;KEEP_CARD_IF_ONLY
110;PLATO;Action;Gagnez 3 Signaux dans un secteur où se trouve l'une de vos sondes. Toutefois, ces signaux ne vous permettent pas d'obtenir de Données.;1 Donnée;Jaune;1 Crédit;1 Crédit;3 Signaux Sonde;NO_DATA
30;Programme des Grand Observatoires;Action;Choisissez jusqu'à 3 sondes (les vôtres et/ou celles d'autres joueurs). Pour chaque sonde, marquez un Signal dans son secteur.;1 Déplacement;Jaune;1 Pioche;2 Crédits;3 Signaux Sonde;ANY_PROBE
122;Astronomes Amateurs;Action;Effectuez ceci 3 fois: Défaussez la première carte du paquet pour son signal.;1 Média;Noir;1 Energie;2 Crédits;3 Signaux Deck;
90;Square Kilometre Array;Action;Gagnez 3 Signaux dans un secteur d'une carte de la rangée. Gagnez 2 PVs pour chaque secteur unique dans lequel vous marquez un signal.;1 Média;Bleu;1 Crédit;3 Crédits;3 Signaux Rangée;SCORE_IF_UNIQUE:2
135;Radiotélescope de Noto;Action;Gagnez 1 Média et 1 Scan;1 Déplacement;Bleu;1 Energie;2 Crédits;1 Média + 1 Scan;
53;Deep Synoptic Array;Action;Gagnez 1 Scan. Gagnez 2 PVs chaque fois que vous marquez un Signal dans un secteur Jaune grâce à cette action.;1 Déplacement;Bleu;1 Energie;2 Crédits;1 Scan;SCORE_PER_SECTOR:yellow:2
52;Observatoire de Parkes;Action;Gagnez 1 Scan. Gagnez 2 PVs chaque fois que vous marquez un Signal dans un secteur Rouge grâce à cette action.;1 Déplacement;Jaune;1 Pioche;2 Crédits;1 Scan;SCORE_PER_SECTOR:red:2
54;Télescope VERITAS;Action;Gagnez 1 Scan. Gagnez 2 PVs chaque fois que vous marquez un Signal dans un secteur Bleu grâce à cette action.;1 Déplacement;Rouge;1 Crédit;2 Crédits;1 Scan;SCORE_PER_SECTOR:blue:2
55;Radiotélescope d'Arecibo;Action;Gagnez 1 Scan. Marquez également 1 Signal dans n'importe quel secteur.;1 Média;Jaune;1 Pioche;3 Crédits;1 Scan + 1 Signal;
136;Radiotélescope d'Algonquin;Action;Gagnez 4 Signaux dans un secteur Jaune, Rouge, Bleu et Noir. Toutefois, ces signaux ne vous permettent pas dobtenir des Données.;1 Donnée;Rouge;1 Energie;1 Crédit;1 Signal Jaune + 1 Signal Bleu + 1 Signal Rouge + 1 Signal Noir;NO_DATA
29;Télescope Spatial James Webb;Action;Gagnez 1 Déplacement et 1 Signal dans un secteur où se trouve l'une de vos sondes et dans les deux secteurs adjacents.;1 Média;Jaune;1 Energie;2 Crédits;1 Déplacement + 1 Signal Sonde;GAIN_SIGNAL_ADJACENTS
75;Etude sur les Extrêmophiles;Action;Gagnez 1 Trace de Vie de n'importe quelle couleur. Puis gagnez 1 PV pour chaque Trace de Vie que vous avez marquée de cette couleur.;1 Donnée;Noir;1 Crédit;2 Crédits;1 Trace;SCORE_PER_TRACE:any:1
108;SETI@home;Action;Si vous avez au moins 8 Médias marquez 1 Trace de Vie Rouge.;1 Donnée;Noir;1 Crédit;1 Crédit;;GAIN_LIFETRACE_IF_MEDIA:red:1
18;Hayabusa;Action;Si vous avez une sonde sur un champ d'astéroïdes, marquez 1 Trace de Vie Jaune.;1 Déplacement;Noir;1 Pioche;1 Crédit;;GAIN_LIFETRACE_IF_ASTEROID:yellow:1
84;Retour d'Echantillons;Action;Retirez l'un de vos atterrisseurs de n'importe quelle planète ou lune pour marquer 1 Trace de Vie Jaune.;1 Média;Bleu;1 Energie;1 Crédit;;SAMPLE_RETURN
98;Spectrographe Coronal;Action;Marquez 1 Trace de Vie Rouge pour une espèce pour laquelle vous avez déjà marqué 1 Trace de Vie Rouge.;1 Donnée;Rouge;1 Energie;1 Crédit;;GAIN_LIFETRACE_IF_ALREADY:red:1
99;Microscope Electronique;Action;Marquez 1 Trace de Vie Jaune pour une espèce pour laquelle vous avez déjà marqué 1 Trace de Vie Jaune.;1 Donnée;Jaune;1 Pioche;1 Crédit;;GAIN_LIFETRACE_IF_ALREADY:yellow:1
100;Supercalculateur Exascale;Action;Marquez 1 Trace de Vie Bleu pour une espèce pour laquelle vous avez déjà marqué 1 Trace de Vie Bleu.;1 Donnée;Bleu;1 Crédit;1 Crédit;;GAIN_LIFETRACE_IF_ALREADY:blue:1
86;Télescope Géant Magellan;Fin de jeu;Gagnez 1 Signal dans un secteur d'une carte de la rangée. Mission: Gagnez 1 PV pour chaque secteur où vous avez un signal.;1 Média;Rouge;1 Energie;1 Crédit;1 Signal Rangée;
40;Observatoire de Kepler-22;Fin de jeu;Gagnez 2 Signaux dans le secteur de Kepler-22. Mission: Gagnez 3PVs pour chaque secteur Jaune que vous avez couvert.;1 Média;Rouge;1 Crédit;2 Crédits;2 Signaux Kepler-22;
38;Observatoire de l'Etoile de Barnard;Fin de jeu;Gagnez 2 Signaux dans le secteur de l'Etoile de Barnard. Mission: Gagnez 3 PVs pour chaque secteur Rouge que vous avez couvert.;1 Média;Bleu;1 Energie;2 Crédits;2 Signaux Etoile de Barnard;
42;Observatoire de Procyon;Fin de jeu;Gagnez 2 Signaux dans le secteur de Procyon. Mission: Gagnez 3 PVs pour chaque secteur Bleu que vous avez couvert.;1 Média;Jaune;1 Pioche;2 Crédits;2 Signaux Procyon;
44;Observatoire de Vega;Fin de jeu;Gagnez 1 Signal dans le secteur de Véga. Mission: Gagnez 3 PVs pour chaque secteur Noir que vous avez couvert.;1 Média;Rouge;1 Crédit;1 Crédit;1 Signal Véga;
126;Télescope Spatial Euclide;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Exploration ou Observation. Mission: Gagnez 2 PVs pour chaque Technologie Informatique.;1 Média;Bleu;1 Pioche;3 Crédits;1 Rotation + 1 Tech;CHOICE_EXPLO_OR_OBSERV
14;Mars Science Laboratory;Fin de jeu;Gagnez 1 Média et 2 Données. Mission: Gagnez 4 PVs pour chacun de vos Orbiteurs et Atterrisseurs sur Mars (lunes comprises).;1 Déplacement;Rouge;1 Crédit;2 Crédits;1 Média + 2 Données;
12;Europa Clipper;Fin de jeu;Gagnez 1 Atterrissage sur une planète ou une lune, même sans la technologie requise. Mission: Gagnez 3 PVs pour chacun de vos Orbiteurs et Atterrisseurs sur Jupiter (lunes comprises).;1 Média;Noir;1 Crédit;2 Crédits;1 Atterrissage;IGNORE_SATELLITE_LIMIT
127;NEAR Shoemaker;Fin de jeu;Gagnez 2 Médias. Mission: Si vous avez une sonde sur un champ d'astéroïdes, gagnez 13 PVs.;1 Donnée;Jaune;1 Crédit;1 Crédit;2 Médias;
113;Congrès Solvay;Fin de jeu;Gagnez 2 Médias. Mission: résolvez la case la plus à droite d'une tuile Score dorée sur laquelle vou sn'avez pas placé de marqueur.;1 Donnée;Bleu;1 Pioche;2 Crédits;2 Médias;
63;SHERLOC;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Exploration. Mission: Gagnez 2 PVs pour chaque Trace de Vie Jaune.;1 Déplacement;Bleu;1 Crédit;3 Crédits;1 Rotation + 1 Tech Exploration;
68;DUNE;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Informatique. Mission: Gagnez 2 PVs pour chaque Trace de Vie Bleu.;1 Média;Rouge;1 Crédit;3 Crédits;1 Rotation + 1 Tech Informatique;
62;Observatoire Spatial d'Onsala;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Observation. Mission: Gagnez 2 PVs pour chaque Trace de Vie Rouge.;1 Donnée;Rouge;1 Crédit;3 Crédits;1 Rotation + 1 Tech Observation;
`
    return this.parseCSV(csvContent);
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

      if (columns.length >= 10) {
        const [id, nom, type, texte, actionGratuite, couleurScan, revenue, cout, gain, contrainte] = columns;
        cards.push({
            id: id.trim(),
            name: nom.trim(),
            description: texte.trim(),
            type: this.mapCardType(type.trim()),
            cost: parseInt(cout.trim(), 10) || 0,
            freeAction: this.mapFreeActionType(actionGratuite.trim()),
            scanSector: this.mapSectorColor(couleurScan.trim()),
            revenue: this.mapRevenueType(revenue.trim()),
            effects: [],
            immediateEffects: this.parseGainColumn(gain.trim()),
            passiveEffects: this.parseConstraintColumn(contrainte.trim())
        });
      }
    }
    return cards;
  }

  private static mapCardType(value: string): CardType {
    const v = value.toLowerCase();
    if (v.includes('action')) return CardType.ACTION;
    if (v.includes('conditionnel')) return CardType.CONDITIONAL_MISSION;
    if (v.includes('déclenchable')) return CardType.TRIGGERED_MISSION;
    if (v.includes('fin')) return CardType.END_GAME
    return CardType.ACTION; // Valeur par défaut
  }

  private static mapFreeActionType(value: string): FreeActionType {
      const v = value.toLowerCase();
      if (v.includes('déplacement') || v.includes('movement')) return FreeActionType.MOVEMENT;
      if (v.includes('donnée') || v.includes('data')) return FreeActionType.DATA;
      if (v.includes('média') || v.includes('media')) return FreeActionType.MEDIA;
      return FreeActionType.DATA; // Valeur par défaut
  }

  private static mapSectorColor(value: string): SectorColor {
      const v = value.toLowerCase();
      if (v.includes('bleu') || v.includes('blue')) return SectorColor.BLUE;
      if (v.includes('rouge') || v.includes('red')) return SectorColor.RED;
      if (v.includes('jaune') || v.includes('yellow')) return SectorColor.YELLOW;
      if (v.includes('noir') || v.includes('black')) return SectorColor.BLACK;
      return SectorColor.BLUE; // Valeur par défaut
  }

  private static mapRevenueType(value: string): RevenueType {
      const v = value.toLowerCase();
      if (v.includes('crédit') || v.includes('credit')) return RevenueType.CREDIT;
      if (v.includes('energie') || v.includes('energy')) return RevenueType.ENERGY;
      if (v.includes('pioche') || v.includes('card')) return RevenueType.CARD;
      return RevenueType.CREDIT; // Valeur par défaut
  }

  private static parseGainColumn(gain: string): CardEffect[] {
    if (!gain) return [];
    const effects: CardEffect[] = [];
    
    // Séparer les effets multiples (ex: "2 Sondes + 1 Média")
    const parts = gain.split('+').map(p => p.trim());

    for (const part of parts) {
        const lower = part.toLowerCase();
        
        // Regex simple pour extraire la quantité
        const match = lower.match(/^(\d+)\s+(.+)$/);
        const amount = match ? parseInt(match[1], 10) : 1;

        if (lower.includes('média') || lower.includes('media')) effects.push({ type: 'GAIN', target: 'MEDIA', value: amount });
        else if (lower.includes('crédit') || lower.includes('credit')) effects.push({ type: 'GAIN', target: 'CREDIT', value: amount });
        else if (lower.includes('energie') || lower.includes('énergie')) effects.push({ type: 'GAIN', target: 'ENERGY', value: amount });
        else if (lower.includes('donnée') || lower.includes('data')) effects.push({ type: 'GAIN', target: 'DATA', value: amount });
        else if (lower.includes('pioche')) effects.push({ type: 'GAIN', target: 'CARD', value: amount });
        else if (lower.includes('carte')) effects.push({ type: 'ACTION', target: 'ANYCARD', value: amount });
        else if (lower.includes('déplacement') || lower.includes('deplacement')) effects.push({ type: 'ACTION', target: 'MOVEMENT', value: amount });
        else if (lower.includes('rotation')) effects.push({ type: 'ACTION', target: 'ROTATION', value: amount });
        else if (lower.includes('atterrissage')) effects.push({ type: 'ACTION', target: 'LAND', value: amount });
        else if (lower.includes('scan')) effects.push({ type: 'ACTION', target: 'SCAN', value: amount });
        else if (lower.includes('signal') || lower.includes('signaux')) {
          let scope = 'ANY';
          if (lower.includes('rangée') || lower.includes('rangee')) scope = 'ROW';
          else if (lower.includes('terre')) scope = 'EARTH';
          else if (lower.includes('sonde')) scope = 'PROBE';
          else if (lower.includes('jaune')) scope = 'YELLOW';
          else if (lower.includes('bleu')) scope = 'BLUE';
          else if (lower.includes('rouge')) scope = 'RED';
          else if (lower.includes('noir')) scope = 'BLACK';
          else if (lower.includes('deck')) scope = 'DECK';
          else if (lower.includes('kepler')) scope = 'KEPLER';
          else if (lower.includes('barnard')) scope = 'BARNARD';
          else if (lower.includes('procyon')) scope = 'PROCYON';
          else if (lower.includes('véga')) scope = 'VEGA';
          
          effects.push({ type: 'ACTION', target: 'SIGNAL', value: { amount, scope } });
        }
        else if (lower.includes('sonde')) effects.push({ type: 'GAIN', target: 'PROBE', value: amount });
        else if (lower.includes('tech')) {
            let techColor: TechnologyCategory | undefined = undefined;
            if (lower.includes('informatique') || lower.includes('bleu')) techColor = TechnologyCategory.COMPUTING;
            else if (lower.includes('exploration') || lower.includes('jaune')) techColor = TechnologyCategory.EXPLORATION;
            else if (lower.includes('observation') || lower.includes('rouge')) techColor = TechnologyCategory.OBSERVATION;
            
            effects.push({ type: 'ACTION', target: 'TECH', value: { amount, color: techColor } });
        }
    }
    return effects;
  }

  private static parseConstraintColumn(constraint: string): CardEffect[] {
    if (!constraint) return [];
    
    // Gestion du format VISIT_PLANET:mars:4
    if (constraint.startsWith('VISIT_PLANET:')) {
        const parts = constraint.split(':');
        if (parts.length === 3) {
            return [{ type: 'VISIT_BONUS', target: parts[1], value: parseInt(parts[2], 10) }];
        }
    }

    // Gestion du format VISIT_UNIQUE:1
    if (constraint.startsWith('VISIT_UNIQUE:')) {
        const parts = constraint.split(':');
        if (parts.length === 2) {
            return [{ type: 'VISIT_UNIQUE', value: parseInt(parts[1], 10) }];
        }
    }

    // Gestion du format ASTEROID_EXIT_COST:1
    if (constraint.startsWith('ASTEROID_EXIT_COST:')) {
        const parts = constraint.split(':');
        if (parts.length === 2) {
            return [{ type: 'ASTEROID_EXIT_COST', value: parseInt(parts[1], 10) }];
        }
    }

    // Gestion du format VISIT_ASTEROID:1
    if (constraint.startsWith('VISIT_ASTEROID:')) {
        const parts = constraint.split(':');
        if (parts.length === 2) {
            return [{ type: 'VISIT_ASTEROID', value: parseInt(parts[1], 10) }];
        }
    }

    // Gestion du format VISIT_COMET:4
    if (constraint.startsWith('VISIT_COMET:')) {
        const parts = constraint.split(':');
        if (parts.length === 2) {
            return [{ type: 'VISIT_COMET', value: parseInt(parts[1], 10) }];
        }
    }

    // Gestion du format SAME_DISK_MOVE:3:1 (3 PV, 1 Media)
    if (constraint.startsWith('SAME_DISK_MOVE:')) {
        const parts = constraint.split(':');
        if (parts.length === 3) {
            return [{ type: 'SAME_DISK_MOVE', value: { pv: parseInt(parts[1], 10), media: parseInt(parts[2], 10) } }];
        }
    }

    // Gestion du format REVEAL_AND_TRIGGER_FREE_ACTION
    if (constraint === 'REVEAL_AND_TRIGGER_FREE_ACTION') {
        return [{ type: 'REVEAL_AND_TRIGGER_FREE_ACTION', value: 1 }];
    }

    // Gestion du format SCORE_PER_MEDIA:1
    if (constraint.startsWith('SCORE_PER_MEDIA:')) {
        const parts = constraint.split(':');
        if (parts.length === 2) {
            return [{ type: 'SCORE_PER_MEDIA', value: parseInt(parts[1], 10) }];
        }
    }

    // Gestion du format SCORE_PER_TECH_TYPE:2
    if (constraint.startsWith('SCORE_PER_TECH_TYPE:')) {
        const parts = constraint.split(':');
        if (parts.length === 2) {
            return [{ type: 'SCORE_PER_TECH_TYPE', value: parseInt(parts[1], 10) }];
        }
    }

    // Gestion du format MEDIA_IF_SHARED_TECH:2
    if (constraint.startsWith('MEDIA_IF_SHARED_TECH:')) {
        const parts = constraint.split(':');
        if (parts.length === 2) {
            return [{ type: 'MEDIA_IF_SHARED_TECH', value: parseInt(parts[1], 10) }];
        }
    }

    // Gestion du format REVEAL_MOVEMENT_CARDS_FOR_BONUS
    if (constraint === 'REVEAL_MOVEMENT_CARDS_FOR_BONUS') {
        return [{ type: 'REVEAL_MOVEMENT_CARDS_FOR_BONUS', value: 1 }];
    }

    // Gestion du format GAIN_ENERGY_PER_ENERGY_REVENUE
    if (constraint === 'GAIN_ENERGY_PER_ENERGY_REVENUE') {
        return [{ type: 'GAIN_ENERGY_PER_ENERGY_REVENUE', value: 1 }];
    }

    // Gestion du format GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE
    if (constraint === 'GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE') {
        return [{ type: 'GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE', value: 1 }];
    }

    // Gestion du format GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE
    if (constraint === 'GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE') {
        return [{ type: 'GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE', value: 1 }];
    }

    // Gestion du format GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE
    if (constraint === 'GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE') {
        return [{ type: 'GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE', value: 1 }];
    }

    // Gestion du format SHARED_TECH_ONLY_NO_BONUS
    if (constraint === 'SHARED_TECH_ONLY_NO_BONUS') {
        return [{ type: 'SHARED_TECH_ONLY_NO_BONUS', value: 1 }];
    }

    // Gestion du format OPTIMAL_LAUNCH_WINDOW
    if (constraint === 'OPTIMAL_LAUNCH_WINDOW') {
        return [{ type: 'OPTIMAL_LAUNCH_WINDOW', value: 1 }];
    }

    // Gestion du format OSIRIS_REX_BONUS
    if (constraint === 'OSIRIS_REX_BONUS') {
        return [{ type: 'OSIRIS_REX_BONUS', value: 1 }];
    }

    // Gestion du format DISCARD_ROW_FOR_FREE_ACTIONS
    if (constraint === 'DISCARD_ROW_FOR_FREE_ACTIONS') {
        return [{ type: 'DISCARD_ROW_FOR_FREE_ACTIONS', value: 1 }];
    }

    // Gestion du format ATMOSPHERIC_ENTRY
    if (constraint === 'ATMOSPHERIC_ENTRY') {
        return [{ type: 'ATMOSPHERIC_ENTRY', value: 1 }];
    }

    // Gestion du format IGNORE_PROBE_LIMIT
    if (constraint === 'IGNORE_PROBE_LIMIT') {
        return [{ type: 'IGNORE_PROBE_LIMIT', value: true }];
    }

    // Gestion du format CHOICE_MEDIA_OR_MOVE
    if (constraint === 'CHOICE_MEDIA_OR_MOVE') {
      return [{ type: 'CHOICE_MEDIA_OR_MOVE', value: true }];
  }

    // Gestion du format GAIN_SIGNAL_FROM_HAND:x
    if (constraint.startsWith('GAIN_SIGNAL_FROM_HAND:')) {
        const parts = constraint.split(':');
        return [{ type: 'GAIN_SIGNAL_FROM_HAND', value: parseInt(parts[1], 10) }];
    }

    // Gestion du format BONUS_IF_COVERED:type
    if (constraint.startsWith('BONUS_IF_COVERED:')) {
        const parts = constraint.split(':');
        return [{ type: 'BONUS_IF_COVERED', target: parts[1], value: 1 }];
    }

    // Gestion du format SCORE_IF_UNIQUE:x
    if (constraint.startsWith('SCORE_IF_UNIQUE:')) {
        const parts = constraint.split(':');
        return [{ type: 'SCORE_IF_UNIQUE', value: parseInt(parts[1], 10) }];
    }

    // Gestion du format KEEP_CARD_IF_ONLY
    if (constraint === 'KEEP_CARD_IF_ONLY') {
      return [{ type: 'KEEP_CARD_IF_ONLY', value: true }];
    }

    // Gestion du format NO_DATA
    if (constraint === 'NO_DATA') {
      return [{ type: 'NO_DATA', value: true }];
    }

    // Gestion du format ANY_PROBE
    if (constraint === 'ANY_PROBE'){
      return [{ type: 'ANY_PROBE', value: true }];
    }

    // Gestion du format GAIN_SIGNAL_ADJACENTS
    if (constraint === 'GAIN_SIGNAL_ADJACENTS') {
      return [{ type: 'GAIN_SIGNAL_ADJACENTS', value: true }];
    }

    // Gestion du format SCORE_PER_SECTOR:color:value
    if (constraint.startsWith('SCORE_PER_SECTOR:')) {
        const parts = constraint.split(':');
        if (parts.length === 3) {
            return [{ type: 'SCORE_PER_SECTOR', target: parts[1], value: parseInt(parts[2], 10) }];
        }
    }

    // Gestion du format CHOICE_EXPLO_OR_OBSERV
    if (constraint === 'CHOICE_EXPLO_OR_OBSERV') {
      return [{ type: 'CHOICE_EXPLO_OR_OBSERV', value: true }];
    }

    // Gestion du format IGNORE_SATELLITE_LIMIT
    if (constraint === 'IGNORE_SATELLITE_LIMIT') {
      return [{ type: 'IGNORE_SATELLITE_LIMIT', value: true }];
    }

    return [{ type: 'PASSIVE', target: constraint, value: 1 }];
  }
}
