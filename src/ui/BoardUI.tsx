import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Game, ActionType, DiskName, SectorNumber, FreeAction, GAME_CONSTANTS, SectorColor, Technology } from '../core/types';
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
import { DataSystem } from '../systems/DataSystem';
import { CardSystem } from '../systems/CardSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TechnologySystem } from '../systems/TechnologySystem';

interface BoardUIProps {
  game: Game;
}

interface HistoryEntry {
  id: string;
  message: string;
  playerId?: string;
  previousState?: Game;
  timestamp: number;
}

type InteractionState = 
  | { type: 'IDLE' }
  | { type: 'DISCARDING', cardsToDiscard: string[] }
  | { type: 'TRADING_SPEND' }
  | { type: 'TRADING_GAIN', spendType: string, spendCardIds?: string[] }
  | { type: 'FREE_MOVEMENT' }
  | { type: 'RESEARCHING' }
  | { type: 'SELECTING_COMPUTER_SLOT', tech: Technology }
  | { type: 'ANALYZING' };

export const BoardUI: React.FC<BoardUIProps> = ({ game: initialGame }) => {
  // États pour le jeu
  const [game, setGame] = useState<Game>(initialGame);
  const gameEngineRef = useRef<GameEngine | null>(null);
  
  // Ref pour accéder à l'état du jeu le plus récent dans les callbacks
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Initialiser le GameEngine
  if (!gameEngineRef.current) {
    gameEngineRef.current = new GameEngine(game);
  }
  
  // États pour l'UI
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [interactionState, setInteractionState] = useState<InteractionState>({ type: 'IDLE' });
  const [hasPerformedMainAction, setHasPerformedMainAction] = useState(false);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);

  // Ref pour contrôler le plateau solaire
  const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

  // Helper pour ajouter une entrée à l'historique
  const addToHistory = useCallback((message: string, playerId?: string, previousState?: Game) => {
    const entry: HistoryEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      playerId,
      previousState,
      timestamp: Date.now()
    };
    setHistoryLog(prev => [entry, ...prev]);
  }, []);

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

  // Helper pour exécuter l'action Passer via PassAction
  const performPass = useCallback((cardsToKeep: string[]) => {
    if (!gameEngineRef.current) return;
    
    // Synchroniser l'état
    const currentGame = gameRef.current;
    gameEngineRef.current.setState(currentGame);
    
    // Utiliser l'état du moteur pour garantir la cohérence
    const engineState = gameEngineRef.current.getState();
    const enginePlayer = engineState.players[engineState.currentPlayerIndex];
    
    const action = new PassAction(enginePlayer.id, cardsToKeep);
    const result = gameEngineRef.current.executeAction(action);
    
    if (result.success && result.updatedState) {
        const oldGame = currentGame;
        const newGame = result.updatedState;
        
        if (newGame.isFirstToPass) {
          const currentLevel = oldGame.board.solarSystem.nextRingLevel || 1;
          setToast({ message: `Rotation du système solaire (Niveau ${currentLevel})`, visible: true });
          addToHistory(`passe son tour en premier`, enginePlayer.id, oldGame);
        } else {
          addToHistory("passe son tour", enginePlayer.id, oldGame);
        }

        // Détecter la fin de manche (si le numéro de manche a augmenté)
        if (newGame.currentRound > oldGame.currentRound) {
          setToast({ message: "Fin de manche : Revenus perçus", visible: true });
          addToHistory(`--- FIN DE LA MANCHE ${oldGame.currentRound} ---`);

          // Log des revenus pour chaque joueur
          newGame.players.forEach(newPlayer => {
            const oldPlayer = oldGame.players.find(p => p.id === newPlayer.id);
            if (oldPlayer) {
              const creditsGain = newPlayer.credits - oldPlayer.credits;
              const energyGain = newPlayer.energy - oldPlayer.energy;
              const gains: string[] = [];
              if (creditsGain > 0) gains.push(`${creditsGain} Crédit${creditsGain > 1 ? 's' : ''}`);
              if (energyGain > 0) gains.push(`${energyGain} Énergie${energyGain > 1 ? 's' : ''}`);
              if (gains.length > 0) addToHistory(`perçoit ses revenus : ${gains.join(', ')}`, newPlayer.id, newGame);
            }
          });

          // Log du changement de premier joueur
          const newFirstPlayer = newGame.players[newGame.firstPlayerIndex];
          const oldFirstPlayer = oldGame.players[oldGame.firstPlayerIndex];
          if (newFirstPlayer.id !== oldFirstPlayer.id) {
            addToHistory(`devient le Premier Joueur`, newFirstPlayer.id, newGame);
          }
        }

        setGame(newGame);
        setHasPerformedMainAction(false); // Réinitialiser pour le prochain joueur
    } else {
        console.error("Erreur lors de l'action Passer:", result.error);
        setToast({ message: "Erreur lors de l'action Passer", visible: true });
    }
  }, [addToHistory]);

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
  }, [game, performPass]);

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  const handleNextPlayer = () => {
    if (!gameEngineRef.current) return;
    gameEngineRef.current.nextPlayer();
    setGame(gameEngineRef.current.getState());
    setHasPerformedMainAction(false);
    setToast({ message: "Au tour du joueur suivant", visible: true });
  };

  // Gestionnaire pour le clic sur une carte en mode défausse
  const handleCardClick = (cardId: string) => {
    if (interactionState.type !== 'DISCARDING') return;
    
    const currentCards = interactionState.cardsToDiscard;
    if (currentCards.includes(cardId)) {
      setInteractionState({ ...interactionState, cardsToDiscard: currentCards.filter(id => id !== cardId) });
    } else {
      // Vérifier qu'on ne sélectionne pas plus que nécessaire
      const currentPlayer = game.players[game.currentPlayerIndex];
      const cardsToKeep = currentPlayer.cards.length - (currentCards.length + 1);
      if (cardsToKeep >= 4) {
        setInteractionState({ ...interactionState, cardsToDiscard: [...currentCards, cardId] });
      }
    }
  };

  // Gestionnaire pour confirmer la défausse
  const handleConfirmDiscard = () => {
    if (interactionState.type !== 'DISCARDING') return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    const cardsToKeep = currentPlayer.cards.filter(c => !interactionState.cardsToDiscard.includes(c.id)).map(c => c.id);
    
    // Réinitialiser l'état de défausse
    setInteractionState({ type: 'IDLE' });
    
    performPass(cardsToKeep);
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current) return;
    
    // Atomicité : Si on est dans un mode interactif, on ne peut pas lancer d'autre action
    if (interactionState.type !== 'IDLE') {
        return;
    }
    
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
        
        const oldCredits = currentPlayer.credits;
        const newCredits = result.updatedState.players.find(p => p.id === currentPlayer.id)?.credits || 0;
        const cost = oldCredits - newCredits;
        const costText = cost === 0 ? "gratuitement (Exploration I)" : `pour ${cost} crédits`;
        addToHistory(`lance une sonde depuis la Terre ${locString} ${costText}`, currentPlayer.id, game);
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
        setInteractionState({ type: 'DISCARDING', cardsToDiscard: [] });
        setToast({ message: "Veuillez défausser jusqu'à 4 cartes", visible: true });
        return;
      }
      
      const cardsToKeep = currentPlayer.cards.map(c => c.id);
      performPass(cardsToKeep);
    }
    else if (actionType === ActionType.RESEARCH_TECH) {
      
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
      if (gameEngineRef.current) {
        gameEngineRef.current.setState(updatedGame);
      }
      setInteractionState({ type: 'RESEARCHING' });
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
      setInteractionState({ type: 'ANALYZING' });
      setToast({ message: "Analyse des données en cours...", visible: true });

      const previousState = game; // Capture state for undo
      // Délai pour l'animation avant d'appliquer les effets
      setTimeout(() => {
        const currentGame = gameRef.current;
        const updatedGame = { ...currentGame };
        updatedGame.players = updatedGame.players.map(p => ({ ...p }));
        const player = updatedGame.players[updatedGame.currentPlayerIndex];

        // 1. Dépenser 1 énergie
        player.energy -= 1;

        // 2. Vider l'ordinateur (haut et bas)
        DataSystem.clearComputer(player);

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
        if (gameEngineRef.current) {
          gameEngineRef.current.setState(updatedGame);
        }
        setHasPerformedMainAction(true);
        setToast({ message: `Données analysées ! ${bonusMsg}`, visible: true });
        addToHistory(`analyse des données et gagne ${bonusMsg}`, player.id, previousState);
        setInteractionState({ type: 'IDLE' });
      }, 1500);
    }
  };

  // Gestionnaire pour le déplacement des sondes
  const handleProbeMove = async (probeId: string, targetDisk: DiskName, targetSector: SectorNumber, cost: number, path: string[]) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel
    gameEngineRef.current.setState(game);

    let currentGame = game;
    const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex].id;

    let freeMovements = interactionState.type === 'FREE_MOVEMENT' ? 1 : 0;

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
    if (interactionState.type === 'FREE_MOVEMENT') {
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour l'action gratuite (défausse de carte)
  const handleDiscardCardAction = (cardId: string) => {
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
      addToHistory("défausse une carte pour gagner 1 Média", currentPlayer.id, game);
    } else if (card.freeAction === FreeAction.DATA) {
      currentPlayer.data = (currentPlayer.data || 0) + 1;
      setToast({ message: "Action gratuite : +1 Data", visible: true });
      addToHistory("défausse une carte pour gagner 1 Donnée", currentPlayer.id, game);
    } else if (card.freeAction === FreeAction.MOVEMENT) {
      setInteractionState({ type: 'FREE_MOVEMENT' });
      setToast({ message: "Sélectionnez une sonde à déplacer", visible: true });
      addToHistory("défausse une carte pour un déplacement gratuit", currentPlayer.id, game);
    }
    
    // Défausser la carte
    currentPlayer.cards = currentPlayer.cards.filter(c => c.id !== cardId);
    
    setGame(updatedGame);
  };

  // Gestionnaire pour jouer une carte (payer son coût en crédits)
  const handlePlayCard = (cardId: string) => {
    if (interactionState.type !== 'IDLE') return;
    if (hasPerformedMainAction) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    
    const result = CardSystem.playCard(game, currentPlayer.id, cardId);
    if (result.error) {
        setToast({ message: result.error, visible: true });
        return;
    }

    const card = currentPlayer.cards.find(c => c.id === cardId)!;
    setGame(result.updatedGame);
    if (gameEngineRef.current) {
      gameEngineRef.current.setState(result.updatedGame);
    }
    setHasPerformedMainAction(true);
    setToast({ message: `Carte jouée: ${card.name}`, visible: true });
    addToHistory(`joue la carte "${card.name}" pour ${card.cost} crédits`, currentPlayer.id, game);
  };

  // Gestionnaire pour l'action d'achat de carte avec du média
  const handleBuyCardAction = () => {
    if (interactionState.type !== 'IDLE') return;
    const currentPlayerIndex = game.currentPlayerIndex;
    const currentPlayer = game.players[currentPlayerIndex];

    const result = ResourceSystem.buyCard(game, currentPlayer.id);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    setGame(result.updatedGame);
    setToast({ message: "Carte achetée (-3 Média)", visible: true });
    addToHistory("achète une carte pour 3 médias", currentPlayer.id, game);
  };

  // Gestionnaire unifié pour les échanges
  const handleTrade = (step: 'START' | 'CANCEL' | 'SPEND' | 'GAIN', payload?: any) => {
    if (step === 'START') {
      if (interactionState.type !== 'IDLE') return;
      setInteractionState({ type: 'TRADING_SPEND' });
      setToast({ message: "Choisissez une ressource à dépenser (x2)", visible: true });
    } 
    else if (step === 'CANCEL') {
      setInteractionState({ type: 'IDLE' });
      setToast({ message: "Echange annulé", visible: true });
    }
    else if (step === 'SPEND') {
      if (interactionState.type !== 'TRADING_SPEND' && interactionState.type !== 'TRADING_GAIN') return;
      const { spendType, cardIds } = payload;
      
      if (spendType === 'card' && (!cardIds || cardIds.length < 2)) {
        setInteractionState({ type: 'TRADING_SPEND' });
        setToast({ message: "Choisissez une ressource à dépenser (x2)", visible: true });
      } else {
        setInteractionState({ type: 'TRADING_GAIN', spendType, spendCardIds: cardIds });
        setToast({ message: "Choisissez une ressource à recevoir (x1)", visible: true });
      }
    }
    else if (step === 'GAIN') {
      if (interactionState.type !== 'TRADING_GAIN') return;
      const { gainType } = payload;
      const { spendType, spendCardIds } = interactionState;
      
      const currentPlayerIndex = game.currentPlayerIndex;
      const currentPlayer = game.players[currentPlayerIndex];

      const result = ResourceSystem.tradeResources(game, currentPlayer.id, spendType, gainType, spendCardIds);
      
      if (result.error) {
          alert(result.error);
          setInteractionState({ type: 'IDLE' });
          return;
      }

      setGame(result.updatedGame);
      setToast({ message: "Echange effectué", visible: true });

      const translateResource = (type: string, count: number) => {
        const t = type.toLowerCase();
        let label = t;
        if (t === 'card') label = 'carte';
        else if (t === 'energy') label = 'énergie';
        else if (t === 'credit') label = 'crédit';
        return count > 1 ? `${label}s` : label;
      };
      addToHistory(`échange 2 ${translateResource(spendType, 2)} contre 1 ${translateResource(gainType, 1)}`, currentPlayer.id, game);
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Fonction interne pour traiter l'achat (commune à l'achat direct et après sélection)
  const processTechPurchase = (tech: Technology, targetComputerCol?: number) => {
    const currentGame = gameRef.current;
    const { updatedGame, gains } = TechnologySystem.acquireTechnology(currentGame, currentGame.players[currentGame.currentPlayerIndex].id, tech, targetComputerCol);
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];

    setGame(updatedGame);
    if (gameEngineRef.current) {
      gameEngineRef.current.setState(updatedGame);
    }
    setInteractionState({ type: 'IDLE' });
    setHasPerformedMainAction(true);
    setToast({ message: `Technologie ${tech.name} acquise !`, visible: true });
    
    let category = "";
    if (tech.id.startsWith('exploration')) category = "Exploration";
    else if (tech.id.startsWith('observation')) category = "Observation";
    else if (tech.id.startsWith('computing')) category = "Informatique";

    const gainsText = gains.length > 0 ? ` et gagne : ${gains.join(', ')}` : '';
    addToHistory(`acquiert la technologie "${category} ${tech.name}"${gainsText}`, currentPlayer.id, game);
  };

  // Gestionnaire pour l'achat de technologie (clic initial)
  const handleTechClick = (tech: Technology) => {
    if (interactionState.type !== 'RESEARCHING') return;

    // Si c'est une technologie informatique, on demande de sélectionner un emplacement
    if (tech.id.startsWith('computing')) {
      setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech });
      setToast({ message: "Sélectionnez une colonne (1, 3, 5, 6) sur l'ordinateur", visible: true });
      return;
    }

    // Sinon achat direct
    processTechPurchase(tech);
  };

  // Gestionnaire pour la sélection de la colonne ordinateur
  const handleComputerColumnSelect = (col: number) => {
    if (interactionState.type !== 'SELECTING_COMPUTER_SLOT') return;

    // Vérifier que c'est une colonne valide (1, 3, 5, 6)
    if (![1, 3, 5, 6].includes(col)) return;

    // Vérifier si la colonne est déjà occupée par une technologie
    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    const playerAny = currentPlayer as any;
    const topSlotId = `${col}a`;
    if (playerAny.computer?.slots?.[topSlotId]?.bonus === '2pv') {
      setToast({ message: "Emplacement déjà occupé par une technologie", visible: true });
      return;
    }

    // Finaliser l'achat
    processTechPurchase(interactionState.tech, col);
  };

  // Gestionnaire pour la pioche de carte depuis le PlayerBoardUI (ex: bonus ordinateur)
  const handleDrawCard = (count: number, source: string) => {
    // Note: drawCards est maintenant dans CardSystem
    const updatedGame = CardSystem.drawCards(game, game.players[game.currentPlayerIndex].id, count, source);
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

  const humanPlayer = game.players.find(p => (p as any).type === 'human');
  const currentPlayerIdToDisplay = viewedPlayerId || humanPlayer?.id;

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
              isResearching={interactionState.type === 'RESEARCHING'}
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
              highlightPlayerProbes={interactionState.type === 'FREE_MOVEMENT'}
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
              playerId={currentPlayerIdToDisplay}
              onViewPlayer={setViewedPlayerId}
              onAction={handleAction} 
              isDiscarding={interactionState.type === 'DISCARDING'}
              selectedCardIds={interactionState.type === 'DISCARDING' ? interactionState.cardsToDiscard : []}
              onCardClick={handleCardClick}
              onConfirmDiscard={handleConfirmDiscard}
              onDiscardCardAction={handleDiscardCardAction}
              onPlayCard={handlePlayCard}
              onBuyCardAction={handleBuyCardAction}
              onTradeResourcesAction={() => handleTrade('START')}
              tradeState={{ phase: interactionState.type === 'TRADING_SPEND' ? 'spending' : (interactionState.type === 'TRADING_GAIN' ? 'gaining' : 'inactive'), spend: interactionState.type === 'TRADING_GAIN' ? { type: interactionState.spendType, cardIds: interactionState.spendCardIds } : undefined }}
              onSpendSelection={(spendType, cardIds) => handleTrade('SPEND', { spendType, cardIds })}
              onGainSelection={(gainType) => handleTrade('GAIN', { gainType })}
              onCancelTrade={() => handleTrade('CANCEL')}
              onGameUpdate={(newGame) => setGame(newGame)}
              isSelectingComputerSlot={interactionState.type === 'SELECTING_COMPUTER_SLOT'}
              onComputerSlotSelect={handleComputerColumnSelect}
              onDrawCard={handleDrawCard}
              isAnalyzing={interactionState.type === 'ANALYZING'}
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
                if (entry.message.startsWith('--- FIN DE LA MANCHE')) {
                  return (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', margin: '10px 0', color: '#aaa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#555' }}></div>
                      <div style={{ padding: '0 10px' }}>{entry.message.replace(/---/g, '').trim()}</div>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#555' }}></div>
                    </div>
                  );
                }
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
