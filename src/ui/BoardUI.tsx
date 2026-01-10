import React, { useRef, useState, useEffect } from 'react';
import { Game, ActionType, DiskName, SectorNumber, FreeAction, GAME_CONSTANTS, CardType, SectorColor, RevenueBonus, Technology, Card } from '../core/types';
import { SolarSystemBoardUI, SolarSystemBoardUIRef } from './SolarSystemBoardUI';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoardUI } from './PlayerBoardUI';
import { AlienBoardUI } from './AlienBoardUI';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { MoveProbeAction } from '../actions/MoveProbeAction';
import { PassAction } from '../actions/PassAction';
import { GameEngine } from '../core/Game';
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState, getCell, getObjectPosition, rotateSector } from '../core/SolarSystemPosition';

interface BoardUIProps {
  game: Game;
}

// Helper pour piocher des cartes (mock ou réel)
const drawCards = (game: Game, playerId: string, count: number, source: string): Game => {
  const updatedGame = { ...game };
  updatedGame.players = updatedGame.players.map(p => ({ ...p }));
  const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return game;
  
  const player = updatedGame.players[playerIndex];

  for (let i = 0; i < count; i++) {
    // Génération de carte mock (factorisée)
    const newCard: Card = {
        id: `card_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
        name: 'Projet SETI',
        type: CardType.ACTION,
        cost: Math.floor(Math.random() * 3) + 1,
        freeAction: [FreeAction.MEDIA, FreeAction.DATA, FreeAction.MOVEMENT][Math.floor(Math.random() * 3)],
        scanSector: [SectorColor.BLUE, SectorColor.RED, SectorColor.YELLOW, SectorColor.BLACK][Math.floor(Math.random() * 4)],
        revenue: [RevenueBonus.CREDIT, RevenueBonus.ENERGY, RevenueBonus.CARD][Math.floor(Math.random() * 3)],
        effects: [],
        description: source,
    };
    player.cards.push(newCard);
  }
  
  return updatedGame;
};

interface HistoryEntry {
  id: string;
  message: string;
  playerId?: string;
  previousState?: Game;
  timestamp: number;
}

export const BoardUI: React.FC<BoardUIProps> = ({ game: initialGame }) => {
  // États pour le jeu
  const [game, setGame] = useState<Game>(initialGame);
  const gameEngineRef = useRef<GameEngine | null>(null);

  // Initialiser le GameEngine
  if (!gameEngineRef.current) {
    gameEngineRef.current = new GameEngine(game);
  }
  
  // États pour l'UI
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [cardsToDiscard, setCardsToDiscard] = useState<string[]>([]);
  const [tradeState, setTradeState] = useState<{ phase: 'inactive' | 'spending' | 'gaining', spend?: { type: string, cardIds?: string[] } }>({ phase: 'inactive' });
  const [isFreeMovementMode, setIsFreeMovementMode] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [pendingTechSelection, setPendingTechSelection] = useState<Technology | null>(null);
  const [isAnalyzingData, setIsAnalyzingData] = useState(false);
  const [hasPerformedMainAction, setHasPerformedMainAction] = useState(false);

  // Ref pour contrôler le plateau solaire
  const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

  // Helper pour ajouter une entrée à l'historique
  const addToHistory = (message: string, playerId?: string, previousState?: Game) => {
    const entry: HistoryEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      playerId,
      previousState,
      timestamp: Date.now()
    };
    setHistoryLog(prev => [entry, ...prev]);
  };

  // Gestionnaire pour annuler une action
  const handleUndo = () => {
    if (historyLog.length === 0) return;
    const lastEntry = historyLog[0];
    if (lastEntry.previousState) {
      setGame(lastEntry.previousState);
      setHistoryLog(prev => prev.slice(1));
      setToast({ message: "Retour en arrière effectué", visible: true });
    } else {
      setToast({ message: "Impossible d'annuler cette action", visible: true });
    }
  };

  // Effet pour masquer le toast après 3 secondes
  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        setToast(prev => prev ? { ...prev, visible: false } : null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Effet pour gérer le tour du joueur Mock
  useEffect(() => {
    const currentPlayer = game.players[game.currentPlayerIndex];
    // Si le joueur est un robot, il passe son tour automatiquement
    if (currentPlayer && currentPlayer.type === 'robot') {
      const timer = setTimeout(() => {
        const cardsToKeep = currentPlayer.cards.slice(0, 4).map(c => c.id);
        performPass(cardsToKeep);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [game]);

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  const handleNextPlayer = () => {
    if (!gameEngineRef.current) return;
    gameEngineRef.current.nextPlayer();
    setGame(gameEngineRef.current.getState());
    setHasPerformedMainAction(false);
    setToast({ message: "Au tour du joueur suivant", visible: true });
  };

  // Helper pour exécuter l'action Passer via PassAction
  const performPass = (cardsToKeep: string[]) => {
    if (!gameEngineRef.current) return;
    
    // Synchroniser l'état
    gameEngineRef.current.setState(game);
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    const action = new PassAction(currentPlayer.id, cardsToKeep);
    const result = gameEngineRef.current.executeAction(action);
    
    if (result.success && result.updatedState) {
        const oldGame = game;
        const newGame = result.updatedState;
        
        if (newGame.isFirstToPass) {
          const currentLevel = oldGame.board.solarSystem.nextRingLevel || 1;
          setToast({ message: `Rotation du système solaire (Niveau ${currentLevel})`, visible: true });
          addToHistory(`passe son tour en premier`, currentPlayer.id, oldGame);
        } else {
          addToHistory("passe son tour", currentPlayer.id, oldGame);
        }

        // Détecter la fin de manche (si le numéro de manche a augmenté)
        if (newGame.currentRound > oldGame.currentRound) {
          setToast({ message: "Fin de manche : Revenus perçus", visible: true });
          addToHistory("Fin de manche : Les joueurs récupèrent leurs revenus");
        }

        setGame(newGame);
        setHasPerformedMainAction(false); // Réinitialiser pour le prochain joueur
    } else {
        console.error("Erreur lors de l'action Passer:", result.error);
        setToast({ message: "Erreur lors de l'action Passer", visible: true });
    }
  };

  // Gestionnaire pour le clic sur une carte en mode défausse
  const handleCardClick = (cardId: string) => {
    if (cardsToDiscard.includes(cardId)) {
      setCardsToDiscard(cardsToDiscard.filter(id => id !== cardId));
    } else {
      // Vérifier qu'on ne sélectionne pas plus que nécessaire
      const currentPlayer = game.players[game.currentPlayerIndex];
      const cardsToKeep = currentPlayer.cards.length - (cardsToDiscard.length + 1);
      if (cardsToKeep >= 4) {
        setCardsToDiscard([...cardsToDiscard, cardId]);
      }
    }
  };

  // Gestionnaire pour confirmer la défausse
  const handleConfirmDiscard = () => {
    const currentPlayer = game.players[game.currentPlayerIndex];
    const cardsToKeep = currentPlayer.cards.filter(c => !cardsToDiscard.includes(c.id)).map(c => c.id);
    
    // Réinitialiser l'état de défausse
    setIsDiscarding(false);
    setCardsToDiscard([]);
    
    performPass(cardsToKeep);
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current) return;
    
    // Si une action principale a déjà été faite, on ne peut pas en faire d'autre (sauf PASS qui est géré spécifiquement)
    if (hasPerformedMainAction && actionType !== ActionType.PASS) {
        return;
    }

    // Synchroniser l'état de GameEngine avec le jeu actuel (pour préserver les angles de rotation)
    gameEngineRef.current.setState(game);

    const currentPlayer = game.players[game.currentPlayerIndex];
    
    if (actionType === ActionType.LAUNCH_PROBE) {
      const action = new LaunchProbeAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        console.log('Sonde lancée, nouvelles sondes:', result.updatedState.board.solarSystem.probes);
        setGame(result.updatedState);
        setHasPerformedMainAction(true);
        
        // Calculer la position de la Terre pour le log
        const earthPos = getObjectPosition(
          'earth',
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const locString = earthPos ? `(${earthPos.disk}${earthPos.absoluteSector})` : '';
        
        addToHistory(`lance une sonde depuis la Terre ${locString} pour ${GAME_CONSTANTS.PROBE_LAUNCH_COST} crédits`, currentPlayer.id, game);
      } else {
        console.error('Erreur lors du lancement de la sonde:', result.error);
        alert(result.error || 'Impossible de lancer la sonde');
      }
    }
    //else if (actionType === ActionType.MOVE_PROBE) {
      
    //}
    else if (actionType === ActionType.PASS) {
      // 1. Vérifier la taille de la main
      if (currentPlayer.cards.length > 4) {
        setIsDiscarding(true);
        setToast({ message: "Veuillez défausser jusqu'à 4 cartes", visible: true });
        return;
      }
      
      const cardsToKeep = currentPlayer.cards.map(c => c.id);
      performPass(cardsToKeep);
    }
    else if (actionType === ActionType.RESEARCH_TECH) {
      if (isResearching) {
        return;
      }
      
      const currentPlayer = game.players[game.currentPlayerIndex];
      if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
        setToast({ message: "Pas assez de couverture médiatique", visible: true });
        return;
      }

      let updatedGame = { ...game };
      updatedGame.players = updatedGame.players.map(p => ({ ...p }));
      const playerIndex = updatedGame.currentPlayerIndex;
      const player = updatedGame.players[playerIndex];

      // Payer le coût
      player.mediaCoverage -= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;

      // Rotation du système solaire
      updatedGame.board = {
        ...updatedGame.board,
        solarSystem: { ...updatedGame.board.solarSystem },
        technologyBoard: { ...updatedGame.board.technologyBoard }
      };

      const currentLevel = updatedGame.board.solarSystem.nextRingLevel || 3;
      const oldRotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );

      if (currentLevel === 3) {
        updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
      } else if (currentLevel === 2) {
        updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
      } else if (currentLevel === 1) {
        updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
      }

      updatedGame.board.solarSystem.nextRingLevel = currentLevel === 1 ? 3 : currentLevel - 1;

      const newRotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );

      updatedGame = ProbeSystem.updateProbesAfterRotation(updatedGame, oldRotationState, newRotationState);
      
      addToHistory(`paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias et fait tourner le système solaire (Niveau ${currentLevel}) pour rechercher une technologie`, player.id, game);

      setGame(updatedGame);
      setIsResearching(true);
      setHasPerformedMainAction(true);
      setToast({ message: "Système pivoté. Sélectionnez une technologie.", visible: true });
    }
    else if (actionType === ActionType.ANALYZE_DATA) {
      if (!currentPlayer.dataComputer.canAnalyze) {
        setToast({ message: "Analyse impossible : Remplissez la ligne du haut", visible: true });
        return;
      }
      if (currentPlayer.energy < 1) {
        setToast({ message: "Énergie insuffisante", visible: true });
        return;
      }

      // Déclencher l'animation
      setIsAnalyzingData(true);
      setToast({ message: "Analyse des données en cours...", visible: true });

      const previousState = game; // Capture state for undo
      // Délai pour l'animation avant d'appliquer les effets
      setTimeout(() => {
        const updatedGame = { ...game };
        updatedGame.players = updatedGame.players.map(p => ({ ...p }));
        const playerIndex = updatedGame.currentPlayerIndex;
        const player = updatedGame.players[playerIndex];

        // 1. Dépenser 1 énergie
        player.energy -= 1;

        // 2. Vider l'ordinateur (haut et bas)
        const playerAny = player as any;
        if (playerAny.computer && playerAny.computer.slots) {
          Object.values(playerAny.computer.slots).forEach((slot: any) => {
            slot.filled = false;
          });
        }
        player.dataComputer.canAnalyze = false;

        // 3. Placer marqueur sur la piste Alien Bleue (Ordinateur)
        const alienBoard = updatedGame.board.alienBoard;
        let bonusMsg = "";

        if (!alienBoard.blue.slot1.playerId) {
          alienBoard.blue.slot1.playerId = player.id;
          player.score += 5;
          player.mediaCoverage = Math.min(player.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
          bonusMsg = "+5 PV, +1 Média (1er)";
        } else if (!alienBoard.blue.slot2.playerId) {
          alienBoard.blue.slot2.playerId = player.id;
          player.score += 3;
          player.mediaCoverage = Math.min(player.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
          bonusMsg = "+3 PV, +1 Média (2ème)";
        } else {
          player.score += 3;
          bonusMsg = "+3 PV";
        }

        setGame(updatedGame);
        setHasPerformedMainAction(true);
        setToast({ message: `Données analysées ! ${bonusMsg}`, visible: true });
        addToHistory(`analyse des données et gagne ${bonusMsg}`, player.id, previousState);
        setIsAnalyzingData(false);
      }, 1500);
    }
    // TODO: Gérer les autres actions
  };

  // Gestionnaire pour le déplacement des sondes
  const handleProbeMove = async (probeId: string, targetDisk: DiskName, targetSector: SectorNumber, cost: number, path: string[]) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel
    gameEngineRef.current.setState(game);

    let currentGame = game;
    const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex].id;

    let freeMovements = isFreeMovementMode ? 1 : 0;

    // Parcourir le chemin étape par étape (en ignorant le point de départ à l'index 0)
    for (let i = 1; i < path.length; i++) {
      const cellKey = path[i];
      const disk = cellKey[0] as DiskName;
      const sector = parseInt(cellKey.substring(1)) as SectorNumber;

      // Pour le log, on récupère la position avant le mouvement
      const probeBeforeMove = currentGame.board.solarSystem.probes.find(p => p.id === probeId);
      let fromLoc = '?';
      if (probeBeforeMove?.solarPosition) {
        const pos = probeBeforeMove.solarPosition;
        const rotationState = createRotationState(
          currentGame.board.solarSystem.rotationAngleLevel1 || 0,
          currentGame.board.solarSystem.rotationAngleLevel2 || 0,
          currentGame.board.solarSystem.rotationAngleLevel3 || 0
        );
        
        let absSector = pos.sector;
        if (pos.level === 1) absSector = rotateSector(pos.sector, rotationState.level1Angle);
        else if (pos.level === 2) absSector = rotateSector(pos.sector, rotationState.level2Angle);
        else if (pos.level === 3) absSector = rotateSector(pos.sector, rotationState.level3Angle);
        
        fromLoc = `${pos.disk}${absSector}`;
      }

      // Utiliser l'action pour effectuer le mouvement
      const useFree = freeMovements > 0;
      const action = new MoveProbeAction(currentPlayerId, probeId, { disk, sector }, useFree);
      const result = gameEngineRef.current.executeAction(action);

      if (result.success && result.updatedState) {
        const updatedGame = result.updatedState;

        // Vérifier le gain de média pour afficher un toast (pour cette étape)
        const updatedPlayer = updatedGame.players.find(p => p.id === currentPlayerId);
        const oldPlayer = currentGame.players.find(p => p.id === currentPlayerId);
        
        if (updatedPlayer && oldPlayer) {
            // Log du coût (approximatif car calculé dans l'action)
            const object = getCell(disk, sector, createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0));
            const objectName = object?.hasComet ? "une comète" : object?.hasAsteroid ? "un champ d'astéroïdes" : object?.hasPlanet ? object?.planetName : "une case vide";  
            const energySpent = oldPlayer.energy - updatedPlayer.energy;
            const mediaGain = updatedPlayer.mediaCoverage - oldPlayer.mediaCoverage;
            
            if (energySpent > 0) {
              addToHistory(`déplace une sonde vers ${disk}${sector} pour ${energySpent} énergie`, currentPlayerId, updatedGame);
            } else {
              addToHistory(`déplace une sonde vers ${disk}${sector} gratuitement`, currentPlayerId, updatedGame);
            }

            if (mediaGain > 0) {
              setToast({ message: `Gain de média : +${mediaGain}`, visible: true });
              addToHistory(`gagne ${mediaGain} média pour avoir visité ${objectName} (${disk}${sector})`, currentPlayerId, updatedGame);
            }
        }

        currentGame = updatedGame;
        setGame(currentGame);
        
        // Mettre à jour le compteur de mouvements gratuits
        if (useFree) {
          freeMovements--;
        }
        
        // Petit délai pour l'animation
        await new Promise(resolve => setTimeout(resolve, 300));

      } else {
        console.error('Erreur lors du déplacement de la sonde (étape):', result.error);
        setToast({ message: result.error || 'Impossible de déplacer la sonde', visible: true });
        break; // Arrêter le mouvement en cas d'erreur
      }
    }
    if (isFreeMovementMode) {
      setIsFreeMovementMode(false);
    }
  };

  // Gestionnaire pour l'action gratuite (défausse de carte)
  const handleFreeAction = (cardId: string) => {
    const updatedGame = { ...game };
    // Copie des joueurs pour éviter la mutation directe
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];
    
    const cardIndex = currentPlayer.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const card = currentPlayer.cards[cardIndex];
    
    // Appliquer l'effet de l'action gratuite
    if (card.freeAction === FreeAction.MEDIA) {
      currentPlayer.mediaCoverage = Math.min(currentPlayer.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
      setToast({ message: "Action gratuite : +1 Média", visible: true });
      addToHistory("défausse une carte pour gagner +1 Média", currentPlayer.id, game);
    } else if (card.freeAction === FreeAction.DATA) {
      currentPlayer.data = (currentPlayer.data || 0) + 1;
      setToast({ message: "Action gratuite : +1 Data", visible: true });
      addToHistory("défausse une carte pour gagner +1 Data", currentPlayer.id, game);
    } else if (card.freeAction === FreeAction.MOVEMENT) {
      setIsFreeMovementMode(true);
      setToast({ message: "Sélectionnez une sonde à déplacer", visible: true });
    }
    
    // Défausser la carte
    currentPlayer.cards = currentPlayer.cards.filter(c => c.id !== cardId);
    
    setGame(updatedGame);
  };

  // Gestionnaire pour jouer une carte (payer son coût en crédits)
  const handlePlayCard = (cardId: string) => {
    if (hasPerformedMainAction) return;

    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];
    
    const cardIndex = currentPlayer.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const card = currentPlayer.cards[cardIndex];

    if (currentPlayer.credits < card.cost) {
        setToast({ message: "Crédits insuffisants", visible: true });
        return;
    }

    // Payer le coût
    currentPlayer.credits -= card.cost;

    // Appliquer les effets (TODO: Implémenter les effets spécifiques)
    // Pour l'instant, on retire juste la carte de la main
    currentPlayer.cards = currentPlayer.cards.filter(c => c.id !== cardId);

    setGame(updatedGame);
    setHasPerformedMainAction(true);
    setToast({ message: `Carte jouée: ${card.name}`, visible: true });
    addToHistory(`joue la carte "${card.name}" pour ${card.cost} crédits`, currentPlayer.id, game);
  };

  // Gestionnaire pour l'action d'achat de carte avec du média
  const handleBuyCardAction = () => {
    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];

    if (currentPlayer.mediaCoverage < 3) {
      setToast({ message: "Couverture médiatique insuffisante", visible: true });
      return;
    }

    // Débiter le média
    currentPlayer.mediaCoverage -= 3;

    // Utiliser le helper pour piocher
    const finalGame = drawCards(updatedGame, currentPlayer.id, 1, 'Carte obtenue grâce à votre influence médiatique.');

    setGame(finalGame);
    setToast({ message: "Carte achetée (-3 Média)", visible: true });
    addToHistory("achète une carte pour 3 médias", currentPlayer.id, game);
  };

  // Gestionnaire pour l'échange de ressources
  const handleTradeResourcesAction = () => {
    setTradeState({ phase: 'spending' });
    setToast({ message: "Choisissez une ressource à dépenser (x2)", visible: true });
  };

  const handleCancelTrade = () => {
    setTradeState({ phase: 'inactive' });
    setToast({ message: "Echange annulé", visible: true });
  };

  // Étape 1 de l'échange : l'utilisateur a choisi quoi dépenser
  const handleSpendSelection = (spendType: string, cardIds?: string[]) => {
    setTradeState({ phase: 'gaining', spend: { type: spendType, cardIds } });
    setToast({ message: "Choisissez une ressource à recevoir (x1)", visible: true });
  }

  // Étape 2 de l'échange : l'utilisateur a choisi quoi gagner
  const handleGainSelection = (gainType: string) => {
    if (!tradeState.spend) {
      setTradeState({ phase: 'inactive' });
      return;
    }
    
    const { type: spendType, cardIds } = tradeState.spend;

    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];

    const normalizedSpend = spendType.toLowerCase().trim().replace('é', 'e');
    const normalizedGain = gainType.toLowerCase().trim().replace('é', 'e');

    // Vérifier et débiter la ressource dépensée
    if (normalizedSpend === 'credit') {
        if (currentPlayer.credits < 2) { alert("Pas assez de crédits"); setTradeState({ phase: 'inactive' }); return; }
        currentPlayer.credits -= 2;
    } else if (normalizedSpend === 'energy') {
        if (currentPlayer.energy < 2) { alert("Pas assez d'énergie"); setTradeState({ phase: 'inactive' }); return; }
        currentPlayer.energy -= 2;
    } else if (normalizedSpend === 'card') {
        if (!cardIds || cardIds.length !== 2) {
          alert("Erreur: 2 cartes doivent être sélectionnées.");
          setTradeState({ phase: 'inactive' });
          return;
        }
        currentPlayer.cards = currentPlayer.cards.filter(c => !cardIds.includes(c.id));
    }

    // Créditer la ressource reçue
    if (normalizedGain === 'credit') {
        currentPlayer.credits += 1;
    } else if (normalizedGain === 'energy') {
        currentPlayer.energy += 1;
    } else if (normalizedGain === 'carte') {
        updatedGame = drawCards(updatedGame, currentPlayer.id, 1, 'Carte obtenue par échange.');
    } else {
         alert("Type de ressource à recevoir invalide.");
         setTradeState({ phase: 'inactive' });
         return;
    }

    setGame(updatedGame);
    setToast({ message: "Echange effectué", visible: true });
    addToHistory(`échange 2 ${normalizedSpend} contre 1 ${normalizedGain}`, currentPlayer.id, game);
    setTradeState({ phase: 'inactive' });
  };

  // Fonction interne pour traiter l'achat (commune à l'achat direct et après sélection)
  const processTechPurchase = (tech: Technology, targetComputerCol?: number) => {
    let updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    let currentPlayer = updatedGame.players[currentPlayerIndex];

    const updatedTechBoard = updatedGame.board.technologyBoard;

    // Retirer la technologie du plateau
    if (updatedTechBoard.categorySlots) {
      for (const slot of updatedTechBoard.categorySlots) {
        const index = slot.technologies.findIndex(t => t.id === tech.id);
        if (index !== -1) {
          slot.technologies.splice(index, 1);
          break;
        }
      }
      // Mettre à jour la liste globale
      updatedTechBoard.available = updatedTechBoard.categorySlots.flatMap(s => s.technologies);
    }

    // Ajouter au joueur
    currentPlayer.technologies.push(tech);

    // Si une colonne d'ordinateur a été ciblée (Tech Informatique)
    if (targetComputerCol !== undefined) {
      const slots = currentPlayer.computer.slots;
      const topSlotId = `${targetComputerCol}a`;
      const bottomSlotId = `${targetComputerCol}b`;
      
      if (slots[topSlotId]) slots[topSlotId].bonus = '2pv';
      
      // Déterminer le bonus du bas en fonction de la tech
      let bottomBonus = '';
      if (tech.id.startsWith('computing-1')) bottomBonus = 'credit';
      else if (tech.id.startsWith('computing-2')) bottomBonus = 'card';
      else if (tech.id.startsWith('computing-3')) bottomBonus = 'energy';
      else if (tech.id.startsWith('computing-4')) bottomBonus = 'media'; // ou 2media si on gère les valeurs

      if (slots[bottomSlotId] && bottomBonus) slots[bottomSlotId].bonus = bottomBonus;
    }

    // Appliquer les bonus immédiats
    let gains: string[] = [];
    if (tech.bonus.pv) {
        currentPlayer.score += tech.bonus.pv;
        gains.push(`${tech.bonus.pv} PV`);
    }
    if (tech.bonus.media) {
        currentPlayer.mediaCoverage = Math.min(currentPlayer.mediaCoverage + tech.bonus.media, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
        gains.push(`${tech.bonus.media} Média`);
    }
    if (tech.bonus.credits) {
        currentPlayer.credits += tech.bonus.credits;
        gains.push(`${tech.bonus.credits} Crédit`);
    }
    if (tech.bonus.energy) {
        currentPlayer.energy += tech.bonus.energy;
        gains.push(`${tech.bonus.energy} Énergie`);
    }
    if (tech.bonus.data) {
        currentPlayer.data = Math.min((currentPlayer.data || 0) + tech.bonus.data, GAME_CONSTANTS.MAX_DATA);
        gains.push(`${tech.bonus.data} Data`);
    }
    if (tech.bonus.card) {
      updatedGame = drawCards(updatedGame, currentPlayer.id, tech.bonus.card, `Bonus technologie ${tech.name}`);
      gains.push(`${tech.bonus.card} Carte`);
    }
    if (tech.bonus.probe) {
      // Lancer une sonde gratuitement
      // On utilise updatedGame qui contient déjà la nouvelle technologie (donc la limite de sondes est augmentée)
      const result = ProbeSystem.launchProbe(updatedGame, currentPlayer.id, true);
      updatedGame.board = result.updatedGame.board;
      updatedGame.players = result.updatedGame.players;
      gains.push(`1 Sonde gratuite`);
    }

    setGame(updatedGame);
    setIsResearching(false);
    setToast({ message: `Technologie ${tech.name} acquise !`, visible: true });
    
    let category = "";
    if (tech.id.startsWith('exploration')) category = "Exploration";
    else if (tech.id.startsWith('observation')) category = "Observation";
    else if (tech.id.startsWith('computing')) category = "Informatique";

    const gainsText = gains.length > 0 ? ` et gagne : ${gains.join(', ')}` : '';
    addToHistory(`acquiert la technologie ${category} "${tech.name}"${gainsText}`, currentPlayer.id, game);
  };

  // Gestionnaire pour l'achat de technologie (clic initial)
  const handleTechClick = (tech: Technology) => {
    if (!isResearching) return;

    // Si c'est une technologie informatique, on demande de sélectionner un emplacement
    if (tech.id.startsWith('computing')) {
      setPendingTechSelection(tech);
      setToast({ message: "Sélectionnez une colonne (1, 3, 5, 6) sur l'ordinateur", visible: true });
      return;
    }

    // Sinon achat direct
    processTechPurchase(tech);
  };

  // Gestionnaire pour la sélection de la colonne ordinateur
  const handleComputerColumnSelect = (col: number) => {
    if (!pendingTechSelection) return;

    // Vérifier que c'est une colonne valide (1, 3, 5, 6)
    if (![1, 3, 5, 6].includes(col)) return;

    // Vérifier si la colonne est déjà occupée par une technologie
    const currentPlayer = game.players[game.currentPlayerIndex];
    const playerAny = currentPlayer as any;
    const topSlotId = `${col}a`;
    if (playerAny.computer?.slots?.[topSlotId]?.bonus === '2pv') {
      setToast({ message: "Emplacement déjà occupé par une technologie", visible: true });
      return;
    }

    // Finaliser l'achat
    processTechPurchase(pendingTechSelection, col);
    setPendingTechSelection(null);
  };

  // Gestionnaire pour la pioche de carte depuis le PlayerBoardUI (ex: bonus ordinateur)
  const handleDrawCard = (count: number, source: string) => {
    const updatedGame = drawCards(game, game.players[game.currentPlayerIndex].id, count, source);
    setGame(updatedGame);
  };

  // Gestionnaire pour le clic sur une planète (ex: Terre pour lancer une sonde)
  const handlePlanetClick = (planetId: string) => {
    if (planetId === 'earth') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const validation = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
      if (validation.canLaunch) {
        handleAction(ActionType.LAUNCH_PROBE);
      } else {
        setToast({ message: validation.reason || "Impossible de lancer une sonde", visible: true });
      }
    }
  };

  // Utiliser les positions initiales depuis le jeu
  const initialSector1 = game.board.solarSystem.initialSectorLevel1 || 1;
  const initialSector2 = game.board.solarSystem.initialSectorLevel2 || 1;
  const initialSector3 = game.board.solarSystem.initialSectorLevel3 || 1;

  // Utiliser les angles initiaux depuis le jeu
  const initialAngle1 = game.board.solarSystem.initialAngleLevel1 || 0;
  const initialAngle2 = game.board.solarSystem.initialAngleLevel2 || 0;
  const initialAngle3 = game.board.solarSystem.initialAngleLevel3 || 0;

  // Obtenir les angles actuels depuis le jeu, ou utiliser les angles initiaux
  const getCurrentAngle1 = () => {
    return game.board.solarSystem.rotationAngleLevel1 ?? initialAngle1;
  };
  const getCurrentAngle2 = () => {
    return game.board.solarSystem.rotationAngleLevel2 ?? initialAngle2;
  };
  const getCurrentAngle3 = () => {
    return game.board.solarSystem.rotationAngleLevel3 ?? initialAngle3;
  };

  // Fonction pour mettre à jour les angles de rotation dans l'état du jeu
  const updateRotationAngles = (level1: number, level2: number, level3: number) => {
    setGame(prevGame => ({
      ...prevGame,
      board: {
        ...prevGame.board,
        solarSystem: {
          ...prevGame.board.solarSystem,
          rotationAngleLevel1: level1,
          rotationAngleLevel2: level2,
          rotationAngleLevel3: level3,
        }
      }
    }));
  };

  // Helper pour la couleur des secteurs
  const getSectorColorCode = (color: SectorColor) => {
    switch(color) {
        case SectorColor.BLUE: return '#4a9eff';
        case SectorColor.RED: return '#ff6b6b';
        case SectorColor.YELLOW: return '#ffd700';
        case SectorColor.BLACK: return '#aaaaaa';
        default: return '#fff';
    }
  };

  // Handlers pour les boutons de rotation
  const handleRotateLevel1 = () => {
    solarSystemRef.current?.rotateCounterClockwise1();
    updateRotationAngles(
      getCurrentAngle1() - 45, // Bleu tourne seul
      getCurrentAngle2(),
      getCurrentAngle3()
    );
  };

  const handleRotateLevel2 = () => {
    solarSystemRef.current?.rotateCounterClockwise2();
    // Mettre à jour l'angle dans l'état du jeu
    updateRotationAngles(
      getCurrentAngle1() - 45, // Rouge entraine Bleu
      getCurrentAngle2() - 45,
      getCurrentAngle3()
    );
  };

  const handleRotateLevel3 = () => {
    solarSystemRef.current?.rotateCounterClockwise3();
    // Mettre à jour l'angle dans l'état du jeu
    updateRotationAngles(
      getCurrentAngle1() - 45,
      getCurrentAngle2() - 45,
      getCurrentAngle3() - 45); // Jaune entraine tout
  };

  const nextRotationLevel = game.board.solarSystem.nextRingLevel || 1;
  let nextRotationBackgroundColor = '#ffd700';
  let nextRotationColor = '#000';
  let nextRotationBorder = '#ffed4e';
  if (nextRotationLevel === 2) {
    nextRotationBackgroundColor = '#ff6b6b';
    nextRotationColor = '#fff';
    nextRotationBorder = '#ff8e8e';
  } else if (nextRotationLevel === 1) {
    nextRotationBackgroundColor = '#4a9eff';
    nextRotationColor = '#fff';
    nextRotationBorder = '#6bb3ff';
  }

  return (
    <div className="seti-root">
      {/* Toast Notification */}
      {toast && toast.visible && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: '#4a9eff',
          padding: '12px 24px',
          borderRadius: '8px',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          border: '1px solid #4a9eff',
          fontWeight: 'bold',
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease-in-out',
        }}>
          {toast.message}
        </div>
      )}
      <div className="seti-root-inner">
        <div className="seti-board-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '300px' }}>
            <TechnologyBoardUI 
              game={game} 
              isResearching={isResearching}
              onTechClick={handleTechClick}
            />
            {/* Rangée de cartes principale */}
            <div className="seti-panel" style={{ flex: 1, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
               <div className="seti-panel-title">Rangée Principale</div>
               <div style={{ display: 'flex', gap: '8px', padding: '8px', overflowX: 'auto', flex: 1, alignItems: 'center' }}>
                 {game.board.cardRow && game.board.cardRow.map(card => (
                   <div key={card.id} style={{
                     border: '1px solid #555',
                     borderRadius: '6px',
                     padding: '8px',
                     backgroundColor: 'rgba(0,0,0,0.3)',
                     minWidth: '120px',
                     flex: 1,
                     display: 'flex',
                     flexDirection: 'column',
                     gap: '6px',
                     boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                   }}>
                     <div style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#fff' }}>{card.name}</div>
                     <div style={{ fontSize: '0.8em', color: '#aaa' }}>Coût: {card.cost}</div>
                     <div style={{ 
                       marginTop: 'auto', 
                       padding: '6px', 
                       backgroundColor: 'rgba(255,255,255,0.05)', 
                       borderRadius: '4px',
                       textAlign: 'center',
                       border: `1px solid ${getSectorColorCode(card.scanSector)}`,
                       boxShadow: `0 0 5px ${getSectorColorCode(card.scanSector)}40`
                     }}>
                       <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: '#ddd', marginBottom: '2px' }}>Scan</div>
                       <div style={{ 
                         color: getSectorColorCode(card.scanSector), 
                         fontWeight: 'bold',
                         fontSize: '1.1em'
                       }}>
                         {card.scanSector}
                       </div>
                     </div>
                   </div>
                 ))}
                 {(!game.board.cardRow || game.board.cardRow.length === 0) && (
                    <div style={{ color: '#888', fontStyle: 'italic', padding: '10px', width: '100%', textAlign: 'center' }}>Aucune carte disponible</div>
                 )}
               </div>
            </div>
          </div>
          <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'auto' }}>
            <SolarSystemBoardUI 
              ref={solarSystemRef} 
              game={game} 
              onProbeMove={handleProbeMove} 
              onPlanetClick={handlePlanetClick}
              initialSector1={initialSector1} 
              initialSector2={initialSector2} 
              initialSector3={initialSector3}
              highlightPlayerProbes={isFreeMovementMode}
            />
            {/* Boutons de rotation des plateaux */}
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '15px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 1000,
            }}>
              <div style={{
                backgroundColor: nextRotationBackgroundColor,
                color: nextRotationColor,
                border: `2px solid ${nextRotationBorder}`,
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              }}>
                Prochaine Rotation
              </div>
              {/*
              <button
                onClick={handleRotateLevel1}
                style={{
                  backgroundColor: '#4a9eff',
                  color: '#fff',
                  border: '2px solid #6bb3ff',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#6bb3ff';
                  target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#4a9eff';
                  target.style.transform = 'scale(1)';
                }}
              >
                Tourner Niveau 1
              </button>
              <button
                onClick={handleRotateLevel2}
                style={{
                  backgroundColor: '#ff6b6b',
                  color: '#fff',
                  border: '2px solid #ff8e8e',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ff8e8e';
                  target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ff6b6b';
                  target.style.transform = 'scale(1)';
                }}
              >
                Tourner Niveau 2
              </button>
              <button
                onClick={handleRotateLevel3}
                style={{
                  backgroundColor: '#ffd700',
                  color: '#000',
                  border: '2px solid #ffed4e',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ffed4e';
                  target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ffd700';
                  target.style.transform = 'scale(1)';
                }}
              >
                Tourner Niveau 3
              </button>
              */}
            </div>
          </div>
          {/*<AlienBoardUI game={game} />*/}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', maxHeight: '35vh', flexShrink: 0 }}>
          <div style={{ flex: 3, minWidth: 0 }}>
            <PlayerBoardUI 
              game={game} 
              onAction={handleAction} 
              isDiscarding={isDiscarding}
              selectedCardIds={cardsToDiscard}
              onCardClick={handleCardClick}
              onConfirmDiscard={handleConfirmDiscard}
              onFreeAction={handleFreeAction}
              onPlayCard={handlePlayCard}
              onBuyCardAction={handleBuyCardAction}
              onTradeResourcesAction={handleTradeResourcesAction}
              tradeState={tradeState}
              onSpendSelection={handleSpendSelection}
              onGainSelection={handleGainSelection}
              onCancelTrade={handleCancelTrade}
              onGameUpdate={(newGame) => setGame(newGame)}
              isSelectingComputerSlot={!!pendingTechSelection}
              onComputerSlotSelect={handleComputerColumnSelect}
              onDrawCard={handleDrawCard}
              isAnalyzing={isAnalyzingData}
              hasPerformedMainAction={hasPerformedMainAction}
              onNextPlayer={handleNextPlayer}
              onHistory={(message) => addToHistory(message, game.players[game.currentPlayerIndex].id, game)}
            />
          </div>
          <div className="seti-panel seti-history-panel" style={{ flex: 1, minWidth: 0 }}>
            <div className="seti-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Historique</span>
              {historyLog.length > 0 && historyLog[0].previousState && (
                <button onClick={handleUndo} style={{ fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', backgroundColor: '#555', border: '1px solid #777', color: '#fff', borderRadius: '4px' }} title="Annuler la dernière action">
                  ↩ Annuler
                </button>
              )}
            </div>
            <div className="seti-history-list">
              {historyLog.length === 0 && <div style={{fontStyle: 'italic', padding: '4px', textAlign: 'center'}}>Aucune action</div>}
              {historyLog.map((entry) => {
                const player = entry.playerId ? game.players.find(p => p.id === entry.playerId) : null;
                const color = player ? (player.color || '#ccc') : '#ccc';
                return (
                  <div key={entry.id} className="seti-history-item" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '8px' }}>
                    {player && <strong style={{ color: color }}>{player.name} </strong>}
                    <span style={{ color: '#ddd' }}>{entry.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
