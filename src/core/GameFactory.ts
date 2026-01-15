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
  FreeAction,
  SectorColor,
  RevenueBonus,
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

    // Créer et mélanger le deck d'actions
    let actionDeck = this.createActionDeck();
    actionDeck = this.shuffleCards(actionDeck);

    // Créer la rangée de cartes initiale en piochant dans le deck
    const initialCardRow = actionDeck.splice(0, 3);

    // Créer les decks
    const decks: Decks = {
      actionCards: actionDeck, // Le reste du deck
      missionCards: [],
      endGameCards: [],
      speciesCards: []
    };

    // Créer le plateau
    const board = BoardManager.createInitialBoard();

    // Créer les espèces (non découvertes initialement)
    const species: Species[] = [];

    // Créer les paquets de fin de manche (Manches 1 à 4)
    const roundDecks: { [round: number]: Card[] } = {};
    const cardsPerDeck = players.length + 1;
    for (let i = 1; i <= 4; i++) {
      roundDecks[i] = this.createRoundDeck(cardsPerDeck);
    }

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
    addLog("--- DÉBUT DE LA PARTIE ---");
    
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
      cardRow: initialCardRow,
      species,
      discoveredSpecies: [],
      history: [],
      isFirstToPass: false,
      roundDecks,
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
      missions: [],
      dataComputer: this.createDataComputer(),
      lifeTraces: [],
      score: initialScore,
      hasPassed: false,
      type: 'human',
      color: '#4a90e2' as string,
      claimedMilestones: []
    };
  }

  /**
   * Crée un ordinateur de données vide
   */
  private static createDataComputer(): DataComputer {
    return {
      topRow: [],
      bottomRow: [],
      canAnalyze: false
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

    // Distribuer les cartes initiales
    for (const player of updatedGame.players) {
        updatedGame = CardSystem.drawCards(updatedGame, player.id, GAME_CONSTANTS.INITIAL_HAND_SIZE, "Main de départ");
    }

    // Mélanger les technologies et appliquer les bonus de pile
    this.shuffleTechnologies(updatedGame);

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
   * Crée un paquet de cartes pour une manche spécifique
   */
  private static createRoundDeck(count: number): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < count; i++) {
      cards.push(this.createRandomCard(i));
    }
    return cards;
  }

  /**
   * Mock
   */
  private static createRandomCard(id: number): Card {
    const colors = [SectorColor.BLUE, SectorColor.RED, SectorColor.YELLOW, SectorColor.BLACK];
    const freeActions = [FreeAction.DATA, FreeAction.MEDIA, FreeAction.MOVEMENT];
    const revenues = [RevenueBonus.CREDIT, RevenueBonus.ENERGY, RevenueBonus.CARD];
    return {
        id: `row_card_${id}`,
        name: `Projet ${id+1}`,
        type: CardType.ACTION,
        cost: Math.floor(Math.random() * 5) + 1,
        freeAction: freeActions[Math.floor(Math.random() * freeActions.length)],
        scanSector: colors[Math.floor(Math.random() * colors.length)],
        revenue: revenues[Math.floor(Math.random() * revenues.length)],
        effects: [],
        description: "Carte random"
    };
  }
    
  /**
   * Crée le paquet de cartes Action initial
   * Importé depuis cartes.csv
   */
  private static createActionDeck(): Card[] {
    const csvContent = `Id;Nom;Texte;Action gratuite;Couleur scan;Revenu;Cout;Condition;Gain;Contrainte
9;Falcon Heavy;Gagnez 2 sondes et 1 Média. Ignorez la limite de sondes sur le plateau Systéme Solaire pour ces lancements.;1 Déplacement;Jaune;1 Crédit;3 Crédits;;2 Déplacements;ASTEROID_EXIT_COST
11;Subventions;Gagnez 1 Carte. Révélez la carte que vous avez piochée et bénéfciez de son action gratuite.;1 Média;Jaune;1 Energie;1 Crédit;;? Energie + 1 Reservation;
13;Rover Perseverance;Gagnez 1 Atterrissage. Si vous posez une sonde sur Mars, Mercure ou n'importe quelle lune avec cette action, gagnez 4 PVs.;1 Média;Bleu;1 Pioche;1 Crédit;;1 Donnée + 1 Rotation +1 Tech Informatique;
15;Rentrée Atmosphérique;Retirez l'un de vos orbiteurs de n'importe quelle planète pour gagner: 3 PVs, 1 Donnée, 1 Carte.;1 Déplacement;Bleu;1 Crédit;1 Crédit;;;
16;Dragonfly;Gagnez 1 Atterrissage. Vous pouvez poser une sonde sur une case déjà occupée, et tout de même gagner la récompense recouverte.;1 Déplacement;Bleu;1 Crédit;1 Crédit;;;
17;OSIRIS-REx;Choisissez 1 de vos sondes. Gagnez 2 Données si elle est placée sur un champ d'astéroïdes et 1 Donnée pour chaque champ d'astéroïdes adjacent.;1 Déplacement;Jaune;1 Energie;1 Crédit;;;
19;Assistance Gravitationnelle;Gagnez 2 Déplacements. Chaque fois que vous visitez une planète ce tour-ci, vous pouvez gagner 1 Déplacement au lieu de 1 Média.;1 Média;Jaune;1 Crédit;Crédit;;2 Déplacements;
20;Survol de Mercure;Gagnez 2 Déplacements. Si vous visitez Mercure ce tour-ci, gagnez 4 PVs.;1 Média;Rouge;1 Energie;1 Crédit;;2 Déplacements;
21;Survol de Vénus;Gagnez 2 Déplacements. Si vous visitez Vénus ce tour-ci, gagnez 3 PVs.;1 Média;Jaune;1 Crédit;1 Crédit;;2 Déplacements;
22;Survol de Mars;Gagnez 2 Déplacements. Si vous visitez Mars ce tour-ci, gagnez 4 PVs.;1 Donnée;Jaune;1 Energie;1 Crédit;;2 Déplacements;
23;Survol de Jupiter;Gagnez 2 Déplacements. Si vous visitez Jupiter ce tour-ci, gagnez 4 PVs.;1 Média;Bleu;1 Energie;1 Crédit;;2 Déplacements;
25;Voile Solaire;Gagnez 4 Déplacements. Gagnez 1 PV pour chaque planète unique que vous visitez ce tour-ci (y compris la Terre).;1 Média;Rouge;1 Crédit;2 Crédits;;4 Déplacements;
26;A Travers la Ceinture d'Astéroïdes;Gagnez 2 déplacements. Ignorez les restrictions de déplacement lorsque vous quittez un chaamp d'astéroïdes ce tour-ci.;1 Donnée;Bleu;1 Pioche;1 Crédit;;2 Déplacements;
57;Radiotélescope D'Effelsberg;Gagnez 1 Carte, 1 Rotation, 1 Technologie Observation.;1 Média;Bleu;1 Energie;3 Crédits;;1 Carte + 1 Rotation + 1 Tech Observation;
59;Système de Propulsion Ionique;Gagez 1 Energie, 1 Rotation, 1 Technologie Exploration.;1 Média;Rouge;1 Pioche;3 Crédits;;1 Energie + 1 Rotation + 1 Tech Exploration;
69;Grand Collisionneur de Hadrons;Gagnez 1 Donnée, 1 Rotation, 1 Technologie Informatique.;1 Déplacement;Noir;1 Energie;3 Crédits;;1 Donnée + 1 Rotation + 1 Tech Informatique;
71;Recherche Ciblée;Gagnez 1 Rotation et 1 Technologie de n'importe quelle couleur. Puis gagnez 2 PV pour chaque technologie de ce type que vous possédez.;1 Média;Rouge;1 Crédit;3 Crédits;;;
72;Coopération Scientifique;Gagnez 1 Rotation et 1 Technologie de n'importe quelle couleur. Si vos développez une technologie qu'un autre joueur possède déjà, gagnez 2 Média.;1 Donnée;Bleu;1 Energie;3 Crédits;;;
73;Initiative Clean Space;Défaussez les 3 cartes de la rangée de cartes pour effectuer leurs actions gratuites.;1 Média;Jaune;1 Crédit;1 Crédit;;;
74;Essais de Prélancement;Gagnez 1 Sonde et 1 Déplacement pour chaque carte avec une action gratuite de déplacement que vous révélez de votre main.;1 Média;Jaune;1 Pioche;2 Crédits;;;
85;Lanceur Starship;Gagnez 1 Sonde, 1 Rotation et 1 Technologie Exploration.;1 Média;Rouge;1 Crédit;4 Crédits;;1 Sonde + 1 Rotation + 1 Tech Exploration;
90;Réservoirs d'Ergols;Gagnez 1 Energie pour chaque carte avec un revenu Energie que vous révélez de votre main.;1 Donnée;Bleu;1 Pioche;1 Crédit;;;
91;Réacteur à Fusion;Gagnez 1 Energie pour chaque carte Energie glissée sous vos revenus. Puis réservez cette carte.;1 Média;Rouge;1 Energie;3 Crédits;;;
92;Photo du Jour de la NASA;Gagnez 2 Médias. Gagnez 1 Média pour chaque carte Pioche glissée sous vos revenus. Puis réservez cette carte.;1 Donnée;Bleu;1 Pioche;3 Crédits;;;
93;Financement Public;Gagnez 3 PV pour chaque carte Crédit glissée sous vos revenus. Puis réservez cette carte.;1 Média;Jaune;1 Crédit;3 Crédits;;;
109;Microprocesseurs Basse Consommation;Gagnez 1 Energie, 1 Rotation, 1 Technologie Informatique.;1 Donnée;Jaune;1 Pioche;3 Crédits;;1 Energie + 1 Rotation + 1 Tech Informatique;
110;Conférence de Presse;Gagnez 3 Médias.;1 Donnée;Rouge;1 Crédit;1 Crédit;;3 Médias;
119;PIXL;Gagnez 1 Rotation et 1 Technologie Informatique. Gagnez ensuite 1 PV pour chaque niveau de Média que vous avez.;1 Donnée;Bleu;1 Energie;3 Crédits;;1 Rotation + 1 Tech Informatique;
121;Futur Collisionneur Circulaire;Gagnez 3 Données, 1 Rotation, et 1 Technologie Informatique.;1 Déplacement;Jaune;1 Energie;4 Crédits;;3 Données + 1 Rotation + 1 Tech Informatique;
123;Survol d'Astéroïdes;Gagnez 1 Déplacement. Si vous visitez un champ d'astéroïdes ce tour-ci, gagnez 1 Donnée.;1 Média;Rouge;1 Pioche;0 Crédit;;1 Déplacement;
124;Rencontre avec une Comète;Gagnez 2 Déplacements. Si vous visitez une comète ce tour-ci, gagnez 4 PVs.;1 Média;Jaune;1 Energie;1 Crédit;;2 Déplacements;
125;Correction de Trajectoire;Gagnez 1 Déplacement. Si vous vous déplacez sur le même disque au moins une fois ce tour-ci, gagnez 3 PV et 1 Média.;1 Donnée;Bleu;1 Pioche;1 Crédit;;1 Déplacement;
130;Lancement Spatial à Faible Coût;Gagnez 1 Sonde.;1 Média;Jaune;1 Energie;1 Crédit;;;
133;Fenêtre de Lancement Optimale;Gagnez 1 Sonde. Puis 1 Déplacement pour chaque autre planète ou comète dans le même secteur que la Terre.;1 Donnée;Rouge;1 Pioche;2 Crédits;;;
137;Archives de Données du SETI;Gagnez 2 Données.;1 Média;Noir;1 Energie;1 Crédit;;2 Données;`

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
        const [id, nom, texte, actionGratuite, couleurScan, revenue, cout, condition, gain, contrainte] = columns;
        
        cards.push({
            id: id.trim(),
            name: nom.trim(),
            description: texte.trim(),
            type: CardType.ACTION,
            cost: parseInt(cout.trim(), 10) || 0,
            freeAction: this.mapFreeAction(actionGratuite.trim()),
            scanSector: this.mapSectorColor(couleurScan.trim()),
            revenue: this.mapRevenueBonus(revenue.trim()),
            effects: [],
            immediateEffects: this.parseGainColumn(gain.trim()),
            passiveEffects: contrainte.trim() ? [{ type: 'PASSIVE', target: contrainte.trim(), value: 1 }] : []
        });
      }
    }
    return cards;
  }

  private static mapFreeAction(value: string): FreeAction {
      const v = value.toLowerCase();
      if (v.includes('déplacement') || v.includes('movement')) return FreeAction.MOVEMENT;
      if (v.includes('donnée') || v.includes('data')) return FreeAction.DATA;
      if (v.includes('média') || v.includes('media')) return FreeAction.MEDIA;
      return FreeAction.DATA; // Valeur par défaut
  }

  private static mapSectorColor(value: string): SectorColor {
      const v = value.toLowerCase();
      if (v.includes('bleu') || v.includes('blue')) return SectorColor.BLUE;
      if (v.includes('rouge') || v.includes('red')) return SectorColor.RED;
      if (v.includes('jaune') || v.includes('yellow')) return SectorColor.YELLOW;
      if (v.includes('noir') || v.includes('black')) return SectorColor.BLACK;
      return SectorColor.BLUE; // Valeur par défaut
  }

  private static mapRevenueBonus(value: string): RevenueBonus {
      const v = value.toLowerCase();
      if (v.includes('crédit') || v.includes('credit')) return RevenueBonus.CREDIT;
      if (v.includes('énergie') || v.includes('energy')) return RevenueBonus.ENERGY;
      if (v.includes('carte') || v.includes('card')) return RevenueBonus.CARD;
      return RevenueBonus.CREDIT; // Valeur par défaut
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

        if (lower.includes('déplacement') || lower.includes('deplacement')) effects.push({ type: 'GAIN', target: 'MOVEMENT', value: amount });
        else if (lower.includes('sonde')) effects.push({ type: 'GAIN', target: 'PROBE', value: amount });
        else if (lower.includes('média') || lower.includes('media')) effects.push({ type: 'GAIN', target: 'MEDIA', value: amount });
        else if (lower.includes('crédit') || lower.includes('credit')) effects.push({ type: 'GAIN', target: 'CREDIT', value: amount });
        else if (lower.includes('energie') || lower.includes('énergie')) effects.push({ type: 'GAIN', target: 'ENERGY', value: amount });
        else if (lower.includes('donnée') || lower.includes('data')) effects.push({ type: 'GAIN', target: 'DATA', value: amount });
        else if (lower.includes('pioche') || lower.includes('carte')) effects.push({ type: 'GAIN', target: 'CARD', value: amount });
        else if (lower.includes('rotation')) effects.push({ type: 'ACTION', target: 'ROTATION', value: amount });
        else if (lower.includes('atterrissage')) effects.push({ type: 'ACTION', target: 'LAND', value: amount });
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
}
