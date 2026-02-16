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
  SectorType,
  RevenueType,
  CardEffect,
  GameLogEntry,
  TechnologyCategory,
  LifeTraceType,
  NEUTRAL_MILESTONES
} from './types';
import { BoardManager } from './Board';
import { CardSystem } from '../systems/CardSystem';
import { Logger } from './Logger';

export class GameFactory {
  /**
   * Crée une nouvelle partie
   */
  static createGame(playerNames: string[], humanIsFirstPlayer: boolean = true): Game {
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
   * Mock
   */
  //private static createRandomCard(id: number): Card {
  //  const colors = [SectorType.BLUE, SectorType.RED, SectorType.YELLOW, SectorType.BLACK];
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
  //      description: "Carte random"
  //  };
  //}
    
  /**
   * Crée le paquet de cartes Action initial
   * Importé depuis cartes.csv
   */
  private static createActionDeck(): Card[] {
    const csvContent = `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte
1;Mission Pioneer 11;Mission conditionnelle;Mission: Gagnez 1 Donnée après avoir visité Jupiter. Mission: Gagnez 4 PV après avoir visité Saturne.;1 Déplacement;Jaune;1 Energie;0 Crédit;;GAIN_ON_VISIT:jupiter:data:1 + GAIN_ON_VISIT:saturn:pv:4
2;Mission Mariner 10;Mission conditionnelle;Mission: Gagnez 1 Pioche après avoir visité Mercure. Mission: Gagnez 1 Média après avoir visité Vénus.;1 Déplacement;Bleu;1 Crédit;0 Crédit;;GAIN_ON_VISIT:mercury:card:1 + GAIN_ON_VISIT:venus:media:1
3;Mission Voyager 2;Mission conditionnelle;Mission: Gagnez 1 Energie après avoir visité Uranus. Mission: Gagnez 1 Crédit après avoir visité Neptune.;1 Déplacement;Jaune;1 Pioche;0 Crédit;;GAIN_ON_VISIT:uranus:energy:1 + GAIN_ON_VISIT:neptune:credit:1
4;Mission Galileo;Mission conditionnelle;Mission: Gagnez 1 Média après avoir visité Vénus. Mission: Gagnez 1 Donnée après avoir visité Jupiter.;1 Déplacement;Rouge;1 Pioche;0 Crédit;;GAIN_ON_VISIT:venus:media:1 + GAIN_ON_VISIT:jupiter:data:1
5;Sonde Venera;Mission déclenchable;Gagnez 1 Sonde et 1 Média. Mission: Gagnez 7 PV et 1 Média si vous avez un orbiteur/atterrisseur sur Vénus.;1 Déplacement;Bleu;1 Crédit;3 Crédits;1 Sonde + 1 Média;GAIN_IF_ORBITER_OR_LANDER:venus:pv:7:media:1
6;Sonde Juno;Mission déclenchable;Gagnez 1 Sonde et 1 Donnée. Mission: Gagnez 7 PV et 1 Média si vous avez un orbiteur/atterrisseur sur Jupiter (lunes comprises).;1 Donnée;Rouge;1 Energie;3 Crédits;1 Sonde + 1 Donnée;GAIN_IF_ORBITER_OR_LANDER:jupiter:pv:7:media:1
7;Sonde MESSENGER;Mission déclenchable;Gagnez 1 Sonde et 1 Déplacement. Mission: Gagnez 7 PV et 1 Média si vous avez un orbiteur/atterrisseur sur Mercure.;1 Média;Jaune;1 Pioche;3 Crédits;1 Sonde + 1 Déplacement;GAIN_IF_ORBITER_OR_LANDER:mercury:pv:7:media:1
8;Sonde Cassini;Mission déclenchable;Gagnez 1 Sonde et 1 Carte. Mission: Gagnez 6 PV et 1 Média si vous avez un orbiteur/atterrisseur sur Saturne (lunes comprises).;1 Média;Rouge;1 Energie;3 Crédits;1 Sonde + 1 Carte;GAIN_IF_ORBITER_OR_LANDER:saturn:pv:6:media:1
9;Falcon Heavy;Action;Gagnez 2 sondes et 1 Média. Ignorez la limite de sondes sur le plateau Systéme Solaire pour ces lancements.;1 Déplacement;Jaune;1 Crédit;3 Crédits;2 Sondes + 1 Média;IGNORE_PROBE_LIMIT
10;Mission ODINUS;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Exploration. Mission: Gagnez 5 PV et 1 Carte si vous avez un orbiteur/atterrisseur sur Neptune et Uranus (lunes comprises).;1 Donnée;Noir;1 Energie;3 Crédits;1 Rotation + 1 Tech Exploration;GAIN_IF_ORBITER_OR_LANDER:uranus&neptune:pv:5:anycard:1
11;Subventions;Action;Gagnez 1 Carte. Révélez la carte que vous avez piochée et bénéfciez de son action gratuite.;1 Média;Jaune;1 Energie;1 Crédit;;REVEAL_AND_TRIGGER_FREE_ACTION
12;Europa Clipper;Fin de jeu;Gagnez 1 Atterrissage sur une planète ou une lune, même sans la technologie requise. Fin de jeu: Gagnez 3 PVs pour chacun de vos Orbiteurs et Atterrisseurs sur Jupiter (lunes comprises).;1 Média;Noir;1 Crédit;2 Crédits;1 Atterrissage;IGNORE_SATELLITE_LIMIT + SCORE_PER_ORBITER_LANDER:jupiter:3
13;Rover Perseverance;Action;Gagnez 1 Atterrissage. Si vous posez une sonde sur Mars, Mercure ou n'importe quelle lune avec cette action, gagnez 4 PVs.;1 Média;Bleu;1 Pioche;1 Crédit;1 Atterrissage;
14;Mars Science Laboratory;Fin de jeu;Gagnez 1 Média et 2 Données. Fin de jeu: Gagnez 4 PVs pour chacun de vos Orbiteurs et Atterrisseurs sur Mars (lunes comprises).;1 Déplacement;Rouge;1 Crédit;2 Crédits;1 Média + 2 Données;SCORE_PER_ORBITER_LANDER:mars:4
15;Rentrée Atmosphérique;Action;Retirez l'un de vos orbiteurs de n'importe quelle planète pour gagner 3 PVs, 1 Donnée, 1 Carte.;1 Déplacement;Bleu;1 Crédit;1 Crédit;;ATMOSPHERIC_ENTRY
16;Dragonfly;Action;Gagnez 1 Atterrissage. Vous pouvez poser une sonde sur une case déjà occupée, et tout de même gagner la récompense recouverte.;1 Déplacement;Bleu;1 Crédit;1 Crédit;1 Atterrissage;
17;OSIRIS-REx;Action;Choisissez 1 de vos sondes. Gagnez 2 Données si elle est placée sur un champ d'astéroïdes et 1 Donnée pour chaque champ d'astéroïdes adjacent.;1 Déplacement;Jaune;1 Energie;1 Crédit;;OSIRIS_REX_BONUS
18;Hayabusa;Action;Si vous avez une sonde sur un champ d'astéroïdes, marquez 1 Trace de Vie Jaune.;1 Déplacement;Noir;1 Pioche;1 Crédit;;GAIN_LIFETRACE_IF_ASTEROID:yellow:1
19;Assistance Gravitationnelle;Action;Gagnez 2 Déplacements. Chaque fois que vous visitez une planète ce tour-ci, vous pouvez gagner 1 Déplacement au lieu de 1 Média.;1 Média;Jaune;1 Crédit;Crédit;2 Déplacements;CHOICE_MEDIA_OR_MOVE
20;Survol de Mercure;Action;Gagnez 2 Déplacements. Si vous visitez Mercure ce tour-ci, gagnez 4 PVs.;1 Média;Rouge;1 Energie;1 Crédit;2 Déplacements;VISIT_PLANET:mercury:4
21;Survol de Vénus;Action;Gagnez 2 Déplacements. Si vous visitez Vénus ce tour-ci, gagnez 3 PVs.;1 Média;Jaune;1 Crédit;1 Crédit;2 Déplacements;VISIT_PLANET:venus:3
22;Survol de Mars;Action;Gagnez 2 Déplacements. Si vous visitez Mars ce tour-ci, gagnez 4 PVs.;1 Donnée;Jaune;1 Energie;1 Crédit;2 Déplacements;VISIT_PLANET:mars:4
23;Survol de Jupiter;Action;Gagnez 2 Déplacements. Si vous visitez Jupiter ce tour-ci, gagnez 4 PVs.;1 Média;Bleu;1 Energie;1 Crédit;2 Déplacements;VISIT_PLANET:jupiter:4
24;Survol de Saturne;Action;Gagnez 3 Déplacements. Si vous visitez Saturne ce tour-ci, gagnez 6 PVs.;1 Donnée;Rouge;1 Pioche;2 Crédit;3 Déplacements;VISIT_PLANET:saturn:6
25;Voile Solaire;Action;Gagnez 4 Déplacements. Gagnez 1 PV pour chaque planète unique que vous visitez ce tour-ci (y compris la Terre).;1 Média;Rouge;1 Crédit;2 Crédits;4 Déplacements;VISIT_UNIQUE:1
26;A Travers la Ceinture d'Astéroïdes;Action;Gagnez 2 déplacements. Ignorez les restrictions de déplacement lorsque vous quittez un champ d'astéroïdes ce tour-ci.;1 Donnée;Bleu;1 Pioche;1 Crédit;2 Déplacements;ASTEROID_EXIT_COST:1
27;Télescope Spatial Huble;Action;Gagnez 1 Déplacement. Puis, gagnez 1 Signal dans un secteur où se trouve l'une de vos sondes.;1 Média;Rouge;1 Pioche;1 Crédit;1 Déplacement + 1 Signal Sonde;
28;Télescope Spatial Kepler;Action;Gagnez 1 Déplacement. Puis, gagnez 2 Signaux dans un secteur où se trouve l'une de vos sondes.;1 Média;Bleu;1 Crédit;2 Crédits;1 Déplacement + 2 Signaux Sonde;
29;Télescope Spatial James Webb;Action;Gagnez 1 Déplacement. Puis, gagnez 1 Signal dans un secteur où se trouve l'une de vos sondes et dans les deux secteurs adjacents.;1 Média;Jaune;1 Energie;2 Crédits;1 Déplacement + 1 Signal Sonde;GAIN_SIGNAL_ADJACENTS
30;Programme des Grands Observatoires;Action;Choisissez jusqu'à 3 sondes (les vôtres et/ou celles d'autres joueurs). Pour chaque sonde, marquez un Signal dans son secteur.;1 Déplacement;Jaune;1 Pioche;2 Crédits;3 Signaux Sonde;ANY_PROBE
31;Space Launch System;Mission déclenchable;Gagnez 1 Sonde et 1 Déplacement. Mission: Gagnez 1 Crédit si vous avez 3 atterisseurs (hors lunes).;1 Donnée;Jaune;1 Pioche;2 Crédits;1 Sonde + 1 Déplacement;GAIN_IF_3_LANDERS:credit:1
32;Programme d'Exploration de Mercure;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Mercure. Mission: Gagnez 4 PV si vous avez un orbiteur/atterrisseur sur Mercure.;1 Média;Jaune;1 Crédit;2 Crédits;2 Signaux Mercure;GAIN_IF_ORBITER_OR_LANDER:mercury:pv:4
33;Programme d'Exploration de Vénus;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Vénus. Mission: Gagnez 4 PV si vous avez un orbiteur/atterrisseur sur Vénus.;1 Déplacement;Rouge;1 Energie;2 Crédits;2 Signaux Vénus;GAIN_IF_ORBITER_OR_LANDER:venus:pv:4
34;Programme d'Exploration de Mars;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Mars. Mission: Gagnez 4 PV si vous avez un orbiteur/atterrisseur (lunes comprises) sur Mars.;1 Déplacement;Bleu;1 Pioche;2 Crédits;2 Signaux Mars;GAIN_IF_ORBITER_OR_LANDER:mars:pv:4
35;Programme d'Exploration de Jupiter;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Jupiter. Mission: Gagnez 4 PV si vous avez un orbiteur/atterrisseur (lunes comprises) sur Jupiter.;1 Média;Bleu;1 Crédit;2 Crédits;2 Signaux Jupiter;GAIN_IF_ORBITER_OR_LANDER:jupiter:pv:4
36;Programme d'Exploration de Saturne;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Saturne. Mission: Gagnez 4 PV si vous avez un orbiteur/atterrisseur (lunes comprises) sur Saturne.;1 Média;Bleu;1 Pioche;2 Crédits;2 Signaux Saturne;GAIN_IF_ORBITER_OR_LANDER:saturn:pv:4
37;Observation de Proxima du Centaure;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Proxima du Centaure. Mission: Gagnez 4 PV et 1 Média si vous avez couvert 2 secteurs Rouge.;1 Déplacement;Jaune;1 Crédit;2 Crédits;2 Signaux Proxima;GAIN_IF_COVERED:red:pv:4:media:1
38;Observatoire de l'Etoile de Barnard;Fin de jeu;Gagnez 2 Signaux dans le secteur de l'Etoile de Barnard. Fin de jeu: Gagnez 3 PVs pour chaque secteur Rouge que vous avez couvert.;1 Média;Bleu;1 Energie;2 Crédits;2 Signaux Etoile de Barnard;SCORE_PER_COVERED_SECTOR:red:3
39;Observation de 61 Virginis;Mission déclenchable;Gagnez 2 Signaux dans le secteur de 61 Virginis. Mission: Gagnez 4 PV et 1 Média si vous avez couvert 2 secteurs Jaune.;1 Déplacement;Bleu;1 Pioche;2 Crédits;2 Signaux Virginis;GAIN_IF_COVERED:yellow:pv:4:media:1
40;Observatoire de Kepler-22;Fin de jeu;Gagnez 2 Signaux dans le secteur de Kepler-22. Fin de jeu: Gagnez 3PVs pour chaque secteur Jaune que vous avez couvert.;1 Média;Rouge;1 Crédit;2 Crédits;2 Signaux Kepler-22;SCORE_PER_COVERED_SECTOR:yellow:3
41;Observation de Sirius A;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Sirius A. Mission: Gagnez 4 PV et 1 Média si vous avez couvert 2 secteurs Bleu.;1 Déplacement;Rouge;1 Energie;2 Crédits;2 Signaux Sirius;GAIN_IF_COVERED:blue:pv:4:media:1
42;Observatoire de Procyon;Fin de jeu;Gagnez 2 Signaux dans le secteur de Procyon. Fin de jeu: Gagnez 3 PVs pour chaque secteur Bleu que vous avez couvert.;1 Média;Jaune;1 Pioche;2 Crédits;2 Signaux Procyon;SCORE_PER_COVERED_SECTOR:blue:3
43;Observation de Beta Pictoris;Mission déclenchable;Gagnez 2 Signaux dans le secteur de Beta Pictoris. Mission: Gagnez 4 PV et 1 Média si vous avez couvert un secteur Noir.;1 Déplacement;Bleu;1 Energie;1 Crédit;1 Signal Pictoris;GAIN_IF_COVERED:black:pv:2:media:1
44;Observatoire de Vega;Fin de jeu;Gagnez 1 Signal dans le secteur de Véga. Fin de jeu: Gagnez 3 PVs pour chaque secteur Noir que vous avez couvert.;1 Média;Rouge;1 Crédit;1 Crédit;1 Signal Véga;SCORE_PER_COVERED_SECTOR:black:3
45;Allen Telescope Array;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée. Si vous remplissez au moins un secteur ce tour-ci, gagnez 1 Energie.;1 Média;Rouge;1 Pioche;2 Crédits;2 Signaux Rangée;BONUS_IF_COVERED:energy:1
46;Observatoire ALMA;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée. Si vous remplissez au moins un secteur ce tour-ci, gagnez 1 Pioche.;1 Déplacement;Jaune;1 Crédit;2 Crédits;2 Signaux Rangée;BONUS_IF_COVERED:draw:1
47;Very Large Array;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée. Si vous remplissez au moins un secteur ce tour-ci, gagnez 1 Donnée.;1 Média;Jaune;1 Energie;2 Crédits;2 Signaux Rangée;BONUS_IF_COVERED:data:1
48;Program Breakthrough Starshot;Action;Gagnez 1 Déplacement et 1 Signal dans un secteur Rouge.;1 Média;Bleu;1 Crédit;1 Crédit;1 Déplacement + 1 Signal Rouge;
49;Program Breakthrough Watch;Action;Gagnez 1 Déplacement et 1 Signal dans un secteur Jaune.;1 Média;Rouge;1 Crédit;1 Crédit;1 Déplacement + 1 Signal Jaune;
50;Program Breakthrough Listen;Action;Gagnez 1 Déplacement et 1 Signal dans un secteur Bleu.;1 Média;Jaune;1 Crédit;1 Crédit;1 Déplacement + 1 Signal Bleu;
51;Télescope Lovell;Mission déclenchable;Gagnez 1 Donnée et 1 Scan. Mission: Gagnez 3 PV et 1 Carte si vous avez au moins 8 Média.;1 Déplacement;Rouge;1 Energie;3 Crédits;1 Donnée + 1 Scan;GAIN_IF_8_MEDIA:pv:3:anycard:1
52;Observatoire de Parkes;Action;Gagnez 1 Scan. Gagnez 2 PVs chaque fois que vous marquez un Signal dans un secteur Rouge grâce à cette action.;1 Déplacement;Jaune;1 Pioche;2 Crédits;1 Scan;SCORE_PER_SECTOR:red:2
53;Deep Synoptic Array;Action;Gagnez 1 Scan. Gagnez 2 PVs chaque fois que vous marquez un Signal dans un secteur Jaune grâce à cette action.;1 Déplacement;Bleu;1 Energie;2 Crédits;1 Scan;SCORE_PER_SECTOR:yellow:2
54;Télescope VERITAS;Action;Gagnez 1 Scan. Gagnez 2 PVs chaque fois que vous marquez un Signal dans un secteur Bleu grâce à cette action.;1 Déplacement;Rouge;1 Crédit;2 Crédits;1 Scan;SCORE_PER_SECTOR:blue:2
55;Radiotélescope d'Arecibo;Action;Gagnez 1 Scan. Marquez également 1 Signal dans n'importe quel secteur.;1 Média;Jaune;1 Pioche;3 Crédits;1 Scan + 1 Signal;
57;Radiotélescope D'Effelsberg;Action;Gagnez 1 Carte, 1 Rotation et 1 Technologie Observation.;1 Média;Bleu;1 Energie;3 Crédits;1 Carte + 1 Rotation + 1 Tech Observation;
58;Orbiteur et Sonde d'Uranus;Mission déclenchable;Gagnez 1 Sonde. Mission: Gagnez 3 PV et 1 Pioche si vous avez un orbiteur/atterrisseur (lunes comprises) sur Uranus.;1 Média;Rouge;1 Crédit;2 Crédits;1 Sonde;GAIN_IF_ORBITER_OR_LANDER:uranus:pv:3:card:1
59;Système de Propulsion Ionique;Action;Gagez 1 Energie, 1 Rotation et 1 Technologie Exploration.;1 Média;Rouge;1 Pioche;3 Crédits;1 Energie + 1 Rotation + 1 Tech Exploration;
60;Sonde Trident;Mission déclenchable;Gagnez 1 Sonde. Mission: Gagnez 4 PV et 1 Donnée si vous avez un orbiteur/atterrisseur (lunes comprises) sur Neptune.;1 Média;Bleu;1 Pioche;2 Crédits;1 Sonde;GAIN_IF_ORBITER_OR_LANDER:neptune:pv:4:data:1
61;Ordinateur Quantique;Mission déclenchable;Gagnez 1 Rotation et 1 Tech Informatique. Mission: Gagnez 1 Réservation si vous avez au moins 50 PV.;1 Média;Noir;1 Pioche;3 Crédits;1 Rotation + 1 Tech Informatique;GAIN_IF_50_PV:reservation:1
62;Observatoire Spatial d'Onsala;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Observation. Fin de jeu: Gagnez 2 PVs pour chaque Trace de Vie Rouge.;1 Donnée;Rouge;1 Crédit;3 Crédits;1 Rotation + 1 Tech Observation;SCORE_PER_LIFETRACE:red:2
63;SHERLOC;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Exploration. Fin de jeu: Gagnez 2 PVs pour chaque Trace de Vie Jaune.;1 Déplacement;Bleu;1 Crédit;3 Crédits;1 Rotation + 1 Tech Exploration;SCORE_PER_LIFETRACE:yellow:2
64;ALICE;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Informatique. Mission: Gagnez 2 Données si vous avez acquis 1 Trace de Vie Bleu sur chaque espèce.;1 Déplacement;Bleu;1 Crédit;3 Crédits;1 Rotation + 1 Tech Informatique;GAIN_IF_LIFETRACE_BOTH_SPECIES:blue:data:2
65;Radiotélescope FAST;Action;Gagnez 2 Signaux dans un secteur d'une carte de la rangée, 1 Rotation et 1 Technologie Observation;1 Déplacement;Noir;1 Crédit;4 Crédits;1 Rotation + 1 Tech Observation + 2 Signaux Rangée;
66;GMRT;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Observation. Mission: Gagnez 2 PV et 1 Energie si vous avez acquis 1 Trace de Vie Rouge sur chaque espèce.;1 Média;Jaune;1 Pioche;3 Crédits;1 Rotation + 1 Tech Observation;GAIN_IF_LIFETRACE_BOTH_SPECIES:red:pv:2:energy:1
67;Radiotélescope d'Eupatoria;Action;Gagnez 1 Média, 1 Rotation et 1 Technologie Observation. Puis vous pouvez défausser 1 carte de votre main pour son signal.;1 Déplacement;Bleu;1 Pioche;3 Crédits;1 Média + 1 Rotation + 1 Tech Observation;GAIN_SIGNAL_FROM_HAND:1
68;DUNE;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Informatique. Fin de jeu: Gagnez 2 PVs pour chaque Trace de Vie Bleu.;1 Média;Rouge;1 Crédit;3 Crédits;1 Rotation + 1 Tech Informatique;SCORE_PER_LIFETRACE:blue:2
69;Grand Collisionneur de Hadrons;Action;Gagnez 1 Donnée, 1 Rotation et 1 Technologie Informatique.;1 Déplacement;Noir;1 Energie;3 Crédits;1 Donnée + 1 Rotation + 1 Tech Informatique;
70;ATLAS;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Informatique. Mission: Gagnez 3 PV et 1 Donnée si vous avez acquis 3 Traces de Vie Bleu.;1 Média;Rouge;1 Crédit;3 Crédits;1 Rotation + 1 Tech Informatique;GAIN_IF_3_LIFETRACES:blue:pv:3:data:1
71;Recherche Ciblée;Action;Gagnez 1 Rotation et 1 Technologie de n'importe quelle couleur. Puis gagnez 2 PV pour chaque technologie de ce type que vous possédez.;1 Média;Rouge;1 Crédit;3 Crédits;1 Rotation + 1 Tech;SCORE_PER_TECH_TYPE:2
72;Coopération Scientifique;Action;Gagnez 1 Rotation et 1 Technologie de n'importe quelle couleur. Si vous développez une technologie qu'un autre joueur possède déjà, gagnez 2 Média.;1 Donnée;Bleu;1 Energie;3 Crédits;1 Rotation + 1 Tech;MEDIA_IF_SHARED_TECH:2
73;Initiative Clean Space;Action;Défaussez les 3 cartes de la rangée de cartes pour effectuer leurs actions gratuites.;1 Média;Jaune;1 Crédit;1 Crédit;;DISCARD_ROW_FOR_FREE_ACTIONS
74;Essais de Prélancement;Action;Gagnez 1 Sonde et 1 Déplacement pour chaque carte avec une action gratuite de déplacement que vous révélez de votre main.;1 Média;Jaune;1 Pioche;2 Crédits;1 Sonde;REVEAL_MOVEMENT_CARDS_FOR_BONUS
75;Etude sur les Extrêmophiles;Action;Gagnez 1 Trace de Vie de n'importe quelle couleur. Puis gagnez 1 PV pour chaque Trace de Vie que vous avez marquée de cette couleur.;1 Donnée;Noir;1 Crédit;2 Crédits;1 Trace;GAIN_LIFETRACE:any:1 + SCORE_PER_TRACE:any:1
76;Centre Spatial Kennedy (KSC);Mission conditionnelle;Mission: Gagnez 1 Energie après avoir acquis une Technologie Exploration. Mission: Gagnez 1 Média après avoir acquis une Technologie Observation. Mission: Gagnez 1 Carte après avoir acquis une Technologie Informatique.;1 Déplacement;Bleu;1 Pioche;1 Crédit;;GAIN_ON_TECH:yellow:energy:1 + GAIN_ON_TECH:red:media:1 + GAIN_ON_TECH:blue:anycard:1
77;Institut d'Astrobiologie de la NASA;Mission conditionnelle;Gagnez 1 Média. Mission: Gagnez 1 Donnée après avoir acquis 1 Trace de Vie Rouge. Mission: gagnez 1 Donnée après avoir acquis 1 Trace de Vie Jaune. Mission: Gagnez 1 Donnée après avoir acquis 1 Trace de Vie Bleu.;1 Média;Jaune;1 Pioche;1 Crédit;1 Média;GAIN_ON_LIFETRACE:red:data:1 + GAIN_ON_LIFETRACE:yellow:data:1 + GAIN_ON_LIFETRACE:blue:data:1
78;Institut SETI;Mission conditionnelle;Gagnez 1 Média. Mission: Gagnez 2 Données après avoir effectué l'action Scanner un secteur. Mission: Gagnez 1 Carte après avoir effectué l'action Scanner un secteur. Mission: Gagnez 4 PV après avoir effectué l'action Scanner un secteur.;1 Donnée;Rouge;1 Energie;2 Crédits;1 Média;GAIN_ON_SCAN_data:2 + GAIN_ON_SCAN:anycard:1 + GAIN_ON_SCAN:pv:4
79;ISS;Mission conditionnelle; Gagnez 1 Média.Mission: Gagnez 1 Crédit après avoir effectué l'action Lancer une sonde.Mission: Gagnez 1 Carte après avoir effectué l'action Lancer une sonde. Mission: Gagnez 5 PV après avoir effectué l'action Lancer une sonde.;1 Donnée;Rouge;1 Crédit;2 Crédits;1 Média;GAIN_ON_LAUNCH:credit:1 + GAIN_ON_LAUNCH:anycard:1 + GAIN_ON_LAUNCH:pv:5
80;Base de lancement du KSC;Mission conditionnelle;Mission: Gagnez 1 Déplacement après avoir effectué l'action Lancer une sonde. Mission: Gagnez 1 Déplacemet après avoir effectué l'action Lancer une sonde. Mission: Gagnez 1 Déplacement après avoir effectué l'action Lancer une sonde.;1 Média;Noir;1 Pioche;1 Crédit;;GAIN_ON_LAUNCH:move:1 + GAIN_ON_LAUNCH:move:1 + GAIN_ON_LAUNCH:move:1
81;Collaboration Internationale;Action;Gagnez 1 Technologie de n'importe quelle couleur qu'un autre joueur possède déjà. Ne faites pas pivoter le système solaire. Ne gagner pas le bonus indiqué sur la tuile.;1 Déplacement;Jaune;1 Pioche;2 Crédits;1 Tech;SHARED_TECH_ONLY_NO_BONUS
82;Johnson Space Center;Mission conditionnelle;Mission: Gagnez 2 Médias après avoir effectué l'action Mettre en orbite. Mission: Gagnez 2 Médias après avoir effectué une action Poser une sonde.;1 Donnée;Jaune;1 Energie;1 Crédit;;GAIN_ON_ORBIT:media:2 + GAIN_ON_LAND:media:2
83;Signal Wow!;Action;Gagnez 1 Média et 2 Signaux dans le secteur de la Terre.;1 Déplacement;Bleu;1 Energie;2 Crédits;1 Média + 2 Signaux Terre;
84;Retour d'Echantillons;Action;Retirez l'un de vos atterrisseurs de n'importe quelle planète ou lune pour marquer 1 Trace de Vie Jaune.;1 Média;Bleu;1 Energie;1 Crédit;;SAMPLE_RETURN
85;Lanceur Starship;Action;Gagnez 1 Sonde, 1 Rotation et 1 Technologie Exploration.;1 Média;Rouge;1 Crédit;4 Crédits;1 Sonde + 1 Rotation + 1 Tech Exploration;
86;Télescope Géant Magellan;Fin de jeu;Gagnez 1 Signal dans un secteur d'une carte de la rangée. Fin de jeu: Gagnez 1 PV pour chaque secteur où vous avez un signal.;1 Média;Rouge;1 Energie;1 Crédit;1 Signal Rangée;SCORE_PER_SIGNAL:any:1
87;Projet Longshot;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Exploration. Mission: Gagnez 3 PV et 1 Energie si vous avez une sonde à moins de 5 cases de la Terre.;1 Déplacement;Jaune;1 Pioche;3 Crédits;1 Rotation + 1 Tech Exploration;GAIN_IF_PROBE_IN_DEEP_SPACE:pv:3:energy:1
88;Observatoire Spatial Chandra;Mission déclenchable;Gagnez 2 Signaux dans un secteur où se trouve l'une de vos sondes. Mission: Gagnez 2 Médias si vous avez marqué un signal dans 4 secteurs différents.;1 Déplacement;Bleu;1 Energie;2 Crédits;2 Signaux Sonde;GAIN_IF_4_SIGNALS:media:2
89;Programme NIAC;Mission déclenchable;Gagnez 3 Pioche. Mission: Gagnez 1 Carte si vous n'avez aucune carte en main.;1 Média;Bleu;1 Crédit;2 Crédits;3 Pioche;GAIN_IF_EMPTY_HAND:anycard:1
90;Réservoirs d'Ergols;Action;Gagnez 1 Energie pour chaque carte avec un revenu Energie que vous révélez de votre main.;1 Donnée;Bleu;1 Pioche;1 Crédit;;GAIN_ENERGY_PER_ENERGY_REVENUE
90;Square Kilometre Array;Action;Gagnez 3 Signaux dans un secteur d'une carte de la rangée. Gagnez 2 PVs pour chaque secteur unique dans lequel vous marquez un signal.;1 Média;Bleu;1 Crédit;3 Crédits;3 Signaux Rangée;SCORE_IF_UNIQUE:2
91;Réacteur à Fusion;Action;Gagnez 1 Energie pour chaque carte Energie glissée sous vos revenus. Puis réservez cette carte.;1 Média;Rouge;1 Energie;3 Crédits;;GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE
92;Photo du Jour de la NASA;Action;Gagnez 2 Médias. Gagnez 1 Média pour chaque carte Pioche glissée sous vos revenus. Puis réservez cette carte.;1 Donnée;Bleu;1 Pioche;3 Crédits;2 Médias;GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE
93;Financement Public;Action;Gagnez 3 PV pour chaque carte Crédit glissée sous vos revenus. Puis réservez cette carte.;1 Média;Jaune;1 Crédit;3 Crédits;;GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE
94;Vulgarisation Scientifique;Mission conditionnelle;Gagnez 1 Média. Mission: Gagnez 2 Média après avoir acquis une Technologie Exploration. Mission: Gagnez 2 Média après avoir acquis une Technologie Observation. Mission: Gagnez 2 Média après avoir acquis une Technologie Informatique.;1 Donnée;Rouge;1 Crédit;2 Crédits;1 Média;GAIN_ON_TECH:yellow:media:2 + GAIN_ON_TECH:red:media:2 + GAIN_ON_TECH:blue:media:2
95;Etude des Astéroïdes Géocroiseurs;Mission déclenchable;Gagnez 2 Média. Mission: Gagnez 5 PV et 1 Carte si vous avez une sonde sur un champ d'astéroïdes adjacent à la Terre.;1 Donnée;Jaune;1 Energie;2 Crédits;2 Médias;GAIN_IF_PROBE_ON_ASTEROID:pv:5:anycard:1
96;Etude des Tardigrades;Mission déclenchable;Gagnez 1 Média, 1 Donnée et 1 Pioche. Mission: Gagnez 1 Trace de Vie Jaune si vous avez acquis 3 Traces de Vie Jaune.;1 Déplacement;Jaune;1 Energie;2 Crédits;1 Média + 1 Donnée + 1 Pioche;GAIN_IF_3_LIFETRACES:yellow:yellowlifetrace:1
97;Mission Apollo 11;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Exploration. Mission: Gagnez 2 PV et 1 Pioche si vous avez acquis 1 Trace de Vie Jaune sur chaque espèce.;1 Donnée;Bleu;1 Energie;3 Crédits;1 Rotation + 1 Tech Exploration;GAIN_IF_LIFETRACE_BOTH_SPECIES:yellow:pv:2:card:1
98;Spectrographe Coronal;Action;Marquez 1 Trace de Vie Rouge pour une espèce pour laquelle vous avez déjà marqué 1 Trace de Vie Rouge.;1 Donnée;Rouge;1 Energie;1 Crédit;;GAIN_LIFETRACE_IF_ALREADY:red:1
99;Microscope Electronique;Action;Marquez 1 Trace de Vie Jaune pour une espèce pour laquelle vous avez déjà marqué 1 Trace de Vie Jaune.;1 Donnée;Jaune;1 Pioche;1 Crédit;;GAIN_LIFETRACE_IF_ALREADY:yellow:1
100;Supercalculateur Exascale;Action;Marquez 1 Trace de Vie Bleu pour une espèce pour laquelle vous avez déjà marqué 1 Trace de Vie Bleu.;1 Donnée;Bleu;1 Crédit;1 Crédit;;GAIN_LIFETRACE_IF_ALREADY:blue:1
101;Temps de Télescope;Mission conditionnelle;Mission: Gagnez 1 Signal dans un secteur Jaune après avoir effectué l'action Scanner un secteur. Mission: Gagnez 1 Signal dans un secteur Rouge après avoir effectué l'action Scanner un secteur. Mission: Gagnez 1 Signal dans un secteur Bleu après avoir effectué l'action Scanner un secteur.;1 Média;Jaune;1 Energie;2 Crédits;;GAIN_ON_SCAN:yellowsignal:1 + GAIN_ON_SCAN:redsignal:1 + GAIN_ON_SCAN:bluesignal:1
102;Analyse Linguistique;Mission déclenchable;Gagnez 3 Médias. Mission: Gagnez 1 Trace de Vie de n'importe quelle couleur pour une espèce où vous avez acquis 3 Traces de Vie de couleurs différentes.;1 Donnée;Bleu;1 Crédit;2 Crédits;3 Médias;GAIN_IF_3_LIFETRACES:different:lifetrace:1
103;Radiotélescope de Synthèse de Westerbork;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Observation. Mission: Gagnez 9 PV si vous avez couvert 2 fois un même secteur.;1 Donnée;Jaune;1 Energie;3 Crédits;1 Rotation + 1 Tech Observation;GAIN_IF_COVERED:same:pv:9
104;Sonde Rosetta;Mission déclenchable;Gagnez 1 Sonde. Mission: Gagnez 3 PV et 1 Donnée si vous avez une sonde sur une comète.;1 Média;Bleu;1 Energie;2 Crédits;1 Sonde;GAIN_IF_PROBE_ON_COMET:pv:3:data:1
105;Observatoire de Green Bank;Mission déclenchable;Gagnez 1 Scan. Mission: Gagnez 1 Trace de Vie Rouge si vous avez acquis 3 Traces de Vie Rouge.;1 Déplacement;Noir;1 Crédit;2 Crédits;1 Scan;GAIN_IF_3_LIFETRACES:red:redlifetrace:1
106;Planification Stratégique;Mission conditionnelle;Mission: Gagnez 2 PV après avoir joué une carte pour 1 Crédit. Mission: Gagnez 1 Carte après avoir joué une carte pour 2 Crédits. Mission: Gagnez 2 Média après avoir joué une carte pour 3 Crédits.;1 Déplacement;Jaune;1 Crédit;1 Crédit;;GAIN_ON_PLAY:1:pv:2 + GAIN_ON_PLAY:2:anycard:1 + GAIN_ON_PLAY:3:media:2
107;Première Photo d'un Trou Noir;Mission conditionnelle;Gagnez 2 Données. Mission: Gagnez 2 Média après avoir acquis une trace de vie Bleu. Mission: Gagnez 4 PV après avoir acquis une trace de vie Bleu.;1 Déplacement;Rouge;1 Energie;2 Crédits;2 Données;GAIN_ON_LIFETRACE:blue:media:2 + GAIN_ON_LIFETRACE:blue:pv:4
108;SETI@home;Action;Si vous avez au moins 8 Médias marquez 1 Trace de Vie Rouge.;1 Donnée;Noir;1 Crédit;1 Crédit;;GAIN_LIFETRACE_IF_MEDIA:red:1
109;Microprocesseurs Basse Consommation;Action;Gagnez 1 Energie, 1 Rotation et 1 Technologie Informatique.;1 Donnée;Jaune;1 Pioche;3 Crédits;1 Energie + 1 Rotation + 1 Tech Informatique;
110;Conférence de Presse;Action;Gagnez 3 Médias.;1 Donnée;Rouge;1 Crédit;1 Crédit;3 Médias;
110;PLATO;Action;Gagnez 3 Signaux dans un secteur où se trouve l'une de vos sondes. Toutefois, ces signaux ne vous permettent pas d'obtenir de Données.;1 Donnée;Jaune;1 Crédit;1 Crédit;3 Signaux Sonde;NO_DATA
111;Télescope Spatial Roman;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Observation. Mission: Gagnez 2 Données si vous avez 2 orbiteurs.;1 Média;Rouge;1 Energie;3 Crédits;1 Rotation + 1 Tech Observation;GAIN_IF_2_ORBITERS:data:2
112;Cartographie Géologique Planétaire;Mission déclenchable;Gagnez 1 Rotation et 1 Technologie Exploration. Mission: Gagnez 3 PV et 1 Donnée si vous avez un orbiteur et un atterrisseur sur une même planète.;1 Média;Jaune;1 Energie;3 Crédits;1 Rotation + 1 Tech Exploration;GAIN_IF_ORBITER_AND_LANDER:pv:3:data:1
113;Congrès Solvay;Fin de jeu;Gagnez 2 Médias. Fin de jeu: Résolvez la case la plus à droite d'une tuile Score dorée sur laquelle vous n'avez pas placé de marqueur.;1 Donnée;Bleu;1 Pioche;2 Crédits;2 Médias;
114;Chasseurs de Planètes;Action;Gagnez 1 Carte.Vous pouvez ensuite défausser jusqu'à 3 cartes de votre main pour leurs signaux.;1 Média;Rouge;1 Energie;1 Crédit;1 Carte;GAIN_SIGNAL_FROM_HAND:3
115;Radiotélescope CHIME;Mission déclenchable;Gagnez 1 Signal dans n'importe quel secteur. Mission: Gagnez 1 Donnée si vous avez acquis 3 Technologie Observation.;1 Média;Rouge;1 Pioche;1 Crédit;1 Signal;GAIN_IF_3_TECH_OBS:data:1
116;Centre de Contrôle;Mission conditionnelle;Mission: Gagnez 1 Déplacement après avoir marqué un signal dans un secteur Jaune. Mission: Gagnez 1 Déplacement après avoir marqué un signal dans un secteur Rouge. Mission: Gagnez 1 Déplacement après avoir marqué un signal dans un secteur Bleu.;1 Média;Noir;1 Pioche;1 Crédit;;GAIN_ON_SIGNAL:yellow:move:1 + GAIN_ON_SIGNAL:red:move:1 + GAIN_ON_SIGNAL:blue:move:1
117;Station Lunar Gateway;Mission conditionnelle;Gagnez 1 Sonde. Mission: Gagnez 1 Sonde après avoir effectué l'action Mettre en orbite ou Poser une sonde. Mission: Gagnez 1 Energie après avoir effectué l'action Mettre en orbite ou Poser une sonde.;1 Média;Rouge;1 Pioche;3 Crédits;1 Sonde;GAIN_ON_ORBIT_OR_LAND:probe:1 + GAIN_ON_ORBIT_OR_LAND:energy:1
119;PIXL;Action;Gagnez 1 Rotation et 1 Technologie Informatique. Gagnez ensuite 1 PV pour chaque niveau de Média que vous avez.;1 Donnée;Bleu;1 Energie;3 Crédits;1 Rotation + 1 Tech Informatique;SCORE_PER_MEDIA:1
120;Orbite aux Points de Lagrange;Action;Gagnez 1 Signal dans un secteur où se trouve l'une de vos sondes. Si vous avez marqué exactement 1 signal dans ce secteur, reprenez cette carte en main.;1 Déplacement;Noir;1 Crédit;1 Crédit;1 Signal Sonde;KEEP_CARD_IF_ONLY
121;Futur Collisionneur Circulaire;Action;Gagnez 3 Données, 1 Rotation et 1 Technologie Informatique.;1 Déplacement;Jaune;1 Energie;4 Crédits;3 Données + 1 Rotation + 1 Tech Informatique;
122;Astronomes Amateurs;Action;Effectuez ceci 3 fois: Défaussez la première carte du paquet pour son signal.;1 Média;Noir;1 Energie;2 Crédits;3 Signaux Deck;
123;Survol d'Astéroïdes;Action;Gagnez 1 Déplacement. Si vous visitez un champ d'astéroïdes ce tour-ci, gagnez 1 Donnée.;1 Média;Rouge;1 Pioche;0 Crédit;1 Déplacement;VISIT_ASTEROID:1
124;Rencontre avec une Comète;Action;Gagnez 2 Déplacements. Si vous visitez une comète ce tour-ci, gagnez 4 PVs.;1 Média;Jaune;1 Energie;1 Crédit;2 Déplacements;VISIT_COMET:4
125;Correction de Trajectoire;Action;Gagnez 1 Déplacement. Si vous vous déplacez sur le même disque au moins une fois ce tour-ci, gagnez 3 PV et 1 Média.;1 Donnée;Bleu;1 Pioche;1 Crédit;1 Déplacement;SAME_DISK_MOVE:3:1
126;Télescope Spatial Euclide;Fin de jeu;Gagnez 1 Rotation et 1 Technologie Exploration ou Observation. Fin de jeu: Gagnez 2 PVs pour chaque Technologie Informatique.;1 Média;Bleu;1 Pioche;3 Crédits;1 Rotation + 1 Tech;CHOICE_EXPLO_OR_OBSERV + SCORE_PER_TECH_CATEGORY:computing:2
127;NEAR Shoemaker;Fin de jeu;Gagnez 2 Médias. Fin de jeu: Si vous avez une sonde sur un champ d'astéroïdes, gagnez 13 PVs.;1 Donnée;Jaune;1 Crédit;1 Crédit;2 Médias;SCORE_IF_PROBE_ON_ASTEROID:13
128;Système de Navigation Avancée;Mission conditionnelle;Mission: Gagnez 1 Energie après avoir visité une planète (sauf la Terre). Mission: Gagnez 1 Donnée après avoir visité une planète (sauf la Terre). Mission: Gagnez 1 Déplacement après avoir visité une planète (sauf la Terre).;1 Média;Bleu;1 Pioche;1 Crédit;;GAIN_ON_VISIT:planet:energy:1 + GAIN_ON_VISIT:planet:data:1 + GAIN_ON_VISIT:planet:move:1
129;Recherche d'Astéroïdes;Mission conditionnelle;Mission: Gagnez 1 Donnée après avoir visité un champ d'astéroïdes lors de vote tour. Mission: Gagnez 1 Donnée après avoir visité un champ d'astéroïdes lors de vote tour. Mission: Gagnez 1 Donnée après avoir visité un champ d'astéroïdes lors de vote tour.;1 Déplacement;Rouge;1 Energie;0 Crédit;;GAIN_ON_VISIT:asteroid:data:1 + GAIN_ON_VISIT:asteroid:data:1 + GAIN_ON_VISIT:asteroid:data:1
130;Lancement Spatial à Faible Coût;Action;Gagnez 1 Sonde.;1 Média;Jaune;1 Energie;1 Crédit;1 Sonde;
131;Modernisation de Télescopes;Mission conditionnelle;Gagnez 1 Carte. Mission: Gagnez 1 Média après avoir acquis une Technologie Observation. Mission: Gagnez 1 Donnée après avoir effectué l'action Scanner un secteur.;1 Donnée;Rouge;1 Crédit;1 Crédit;1 Carte;GAIN_ON_TECH:red:media:1 + GAIN_ON_SCAN:data:1
132;Navette Spatiale;Mission déclenchable;Gagnez 1 Sonde et 2 Média. Mission: Gagnez 3 PV et 1 Crédit si vous avez 5 atterrisseur/orbiteur.;1 Déplacement;Noir;1 Pioche;3 Crédits;1 Sonde + 2 Média;GAIN_IF_ORBITER_OR_LANDER:total:pv:3:credit:1
133;Fenêtre de Lancement Optimale;Action;Gagnez 1 Sonde. Puis 1 Déplacement pour chaque autre planète ou comète dans le même secteur que la Terre.;1 Donnée;Rouge;1 Pioche;2 Crédits;1 Sonde;OPTIMAL_LAUNCH_WINDOW
134;Télescope Spatial Herschel;Mission déclenchable;Gagnez 1 Signal dans un secteur où se trouve l'une de vos sondes. Mission: Gagnez 2 Médias si vous avez marqué un signal dans 4 secteurs différents.;1 Déplacement;Rouge;1 Pioche;1 Crédit;1 Signal Sonde;GAIN_IF_4_SIGNALS:media:2
135;Radiotélescope de Noto;Action;Gagnez 1 Média et 1 Scan;1 Déplacement;Bleu;1 Energie;2 Crédits;1 Média + 1 Scan;
136;Radiotélescope d'Algonquin;Action;Gagnez 4 Signaux dans un secteur Jaune, Rouge, Bleu et Noir. Toutefois, ces signaux ne vous permettent pas dobtenir des Données.;1 Donnée;Rouge;1 Energie;1 Crédit;1 Signal Jaune + 1 Signal Bleu + 1 Signal Rouge + 1 Signal Noir;NO_DATA
137;Archives de Données du SETI;Action;Gagnez 2 Données.;1 Média;Noir;1 Energie;1 Crédit;2 Données;
138;Université Cornell;Mission conditionnelle;Mission: Gagnez 1 Média après avoir défaussé une carte pour gagnez 1 Média gratuitement. Mission: Gagnez 1 Donnée après avoir défaussé une carte pour gagnez 1 Donnée gratuitement. Mission: gagnez 1 Déplacement après avoir défaussé une carte pour gagnez 1 Déplacement.;1 Média;Bleu;1 Pioche;1 Crédit;;GAIN_ON_DISCARD:media:media:1 + GAIN_ON_DISCARD:data:data:1 + GAIN_ON_DISCARD:move:move:1
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
            scanSector: this.mapSectorType(couleurScan.trim()),
            revenue: this.mapRevenueType(revenue.trim()),
            immediateEffects: this.parseImmediateEffects(gain.trim()),
            passiveEffects: this.parsePassiveEffects(contrainte.trim()),
            permanentEffects: this.parsePermanentEffects(contrainte.trim())
        });
      }
    }
    return cards;
  }

  private static mapCardType(value: string): CardType {
    const v = value.toLowerCase();
    if (v.includes('action')) return CardType.ACTION;
    if (v.includes('conditionnelle')) return CardType.CONDITIONAL_MISSION;
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

  private static mapSectorType(value: string): SectorType {
      const v = value.toLowerCase();
      if (v.includes('bleu') || v.includes('blue')) return SectorType.BLUE;
      if (v.includes('rouge') || v.includes('red')) return SectorType.RED;
      if (v.includes('jaune') || v.includes('yellow')) return SectorType.YELLOW;
      if (v.includes('noir') || v.includes('black')) return SectorType.BLACK;
      return SectorType.ANY; // Valeur par défaut
  }

  private static mapRevenueType(value: string): RevenueType {
      const v = value.toLowerCase();
      if (v.includes('crédit') || v.includes('credit')) return RevenueType.CREDIT;
      if (v.includes('energie') || v.includes('energy')) return RevenueType.ENERGY;
      if (v.includes('pioche') || v.includes('card')) return RevenueType.CARD;
      return RevenueType.CREDIT; // Valeur par défaut
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
      else if (passive === 'ANY_PROBE'){
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

      // Gestion du format CHOICE_EXPLO_OR_OBSERV
      else if (passive === 'CHOICE_EXPLO_OR_OBSERV') {
        effects.push({ type: 'CHOICE_EXPLO_OR_OBSERV', value: true });
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
          effects.push({ id: permanent, type: 'GAIN_ON_ORBIT', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format GAIN_ON_LAND:target:value
      else if (permanent.startsWith('GAIN_ON_LAND:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ id: permanent, type: 'GAIN_ON_LAND', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format GAIN_ON_ORBIT_OR_LAND:target:value
      else if (permanent.startsWith('GAIN_ON_ORBIT_OR_LAND:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ id: permanent, type: 'GAIN_ON_ORBIT_OR_LAND', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format GAIN_ON_LAUNCH:target:value
      else if (permanent.startsWith('GAIN_ON_LAUNCH:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ id: permanent, type: 'GAIN_ON_LAUNCH', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format GAIN_ON_SCAN:target:value
      else if (permanent.startsWith('GAIN_ON_SCAN:')) {
        const parts = permanent.split(':');
        if (parts.length === 3) {
          effects.push({ id: permanent, type: 'GAIN_ON_SCAN', target: parts[1], value: parseInt(parts[2], 10) });
        }
      }

      // Gestion du format GAIN_ON_SIGNAL:color:target:value
      else if (permanent.startsWith('GAIN_ON_SIGNAL:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'yellow') effects.push({ id: permanent, type: 'GAIN_ON_YELLOW_SIGNAL', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'red') effects.push({ id: permanent, type: 'GAIN_ON_RED_SIGNAL', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'blue') effects.push({ id: permanent, type: 'GAIN_ON_BLUE_SIGNAL', target: parts[2], value: parseInt(parts[3], 10) });
        }
      }

      // Gestion du format GAIN_ON_TECH:color:target:value
      else if (permanent.startsWith('GAIN_ON_TECH:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'yellow') effects.push({ id: permanent, type: 'GAIN_ON_YELLOW_TECH', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'red') effects.push({ id: permanent, type: 'GAIN_ON_RED_TECH', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'blue') effects.push({ id: permanent, type: 'GAIN_ON_BLUE_TECH', target: parts[2], value: parseInt(parts[3], 10) });
        }
      }

      // Gestion du format GAIN_ON_LIFETRACE:color:target:value
      else if (permanent.startsWith('GAIN_ON_LIFETRACE:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'yellow') effects.push({ id: permanent, type: 'GAIN_ON_YELLOW_LIFETRACE', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'red') effects.push({ id: permanent, type: 'GAIN_ON_RED_LIFETRACE', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'blue') effects.push({ id: permanent, type: 'GAIN_ON_BLUE_LIFETRACE', target: parts[2], value: parseInt(parts[3], 10) });
        }
      }

      // Gestion du format GAIN_ON_VISIT:object:target:value
      else if (permanent.startsWith('GAIN_ON_VISIT:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'jupiter') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_JUPITER', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'saturn') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_SATURN', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'mercury') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_MERCURY', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'venus') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_VENUS', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'uranus') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_URANUS', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'neptune') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_NEPTUNE', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'planet') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_PLANET', target: parts[2], value: parseInt(parts[3], 10) }); // excluding earth
          else if (parts[1] === 'asteroid') effects.push({ id: permanent, type: 'GAIN_ON_VISIT_ASTEROID', target: parts[2], value: parseInt(parts[3], 10) });
        }
      }

      // Gestion du format GAIN_ON_PLAY:cost:target:value
      else if (permanent.startsWith('GAIN_ON_PLAY:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === '1') effects.push({ id: permanent, type: 'GAIN_ON_PLAY_1_CREDIT', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === '2') effects.push({ id: permanent, type: 'GAIN_ON_PLAY_2_CREDITS', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === '3') effects.push({ id: permanent, type: 'GAIN_ON_PLAY_3_CREDITS', target: parts[2], value: parseInt(parts[3], 10) });
        }
      }

      // Gestion du format GAIN_ON_DISCARD:resource:target:value
      else if (permanent.startsWith('GAIN_ON_DISCARD:')) {
        const parts = permanent.split(':');
        if (parts.length === 4) {
          if (parts[1] === 'media') effects.push({ id: permanent, type: 'GAIN_ON_DISCARD_MEDIA', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'data') effects.push({ id: permanent, type: 'GAIN_ON_DISCARD_DATA', target: parts[2], value: parseInt(parts[3], 10) });
          else if (parts[1] === 'move') effects.push({ id: permanent, type: 'GAIN_ON_DISCARD_MOVE', target: parts[2], value: parseInt(parts[3], 10) });
        }
      }

      // Gestion du format GAIN_IF_... (Missions déclenchables)
      else if (permanent.startsWith('GAIN_IF_')) {
        const parts = permanent.split(':').map(p => p.trim());
        // On stocke la contrainte brute comme effet pour qu'elle apparaisse dans les requirements
        effects.push({ id: permanent, type: parts[0], target: parts[1], value: permanent });
      }
    }
    return effects;
  }
}
