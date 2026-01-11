import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Game, ActionType, DiskName, SectorNumber, FreeAction, GAME_CONSTANTS, SectorColor, Technology, RevenueBonus } from '../core/types';
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
import { AIBehavior } from '../ai/AIBehavior';

interface BoardUIProps {
  game: Game;
}

type InteractionState = 
  | { type: 'IDLE' }
  | { type: 'DISCARDING', cardsToDiscard: string[] }
  | { type: 'TRADING_SPEND' }
  | { type: 'TRADING_GAIN', spendType: string, spendCardIds?: string[] }
  | { type: 'FREE_MOVEMENT' }
  | { type: 'RESEARCHING' }
  | { type: 'SELECTING_COMPUTER_SLOT', tech: Technology }
  | { type: 'ANALYZING' }
  | { type: 'RESERVING_CARD', count: number }
  | { type: 'PLACING_LIFE_TRACE', color: 'blue' | 'red' | 'yellow' }
  | { type: 'BUYING_CARD' }
  | { type: 'PLACING_OBJECTIVE_MARKER', milestone: number };

interface HistoryEntry {
  id: string;
  message: string;
  playerId?: string;
  previousState?: Game;
  previousInteractionState?: InteractionState;
  previousHasPerformedMainAction?: boolean;
  timestamp: number;
}

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
  const [isTechOpen, setIsTechOpen] = useState(false);
  const [isObjectivesOpen, setIsObjectivesOpen] = useState(false);
  const [isRowOpen, setIsRowOpen] = useState(false);
  const [isAlienOpen, setIsAlienOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  
  // Auto-open tech panel when researching
  useEffect(() => {
    if (interactionState.type === 'RESEARCHING') {
      setIsTechOpen(true);
    }
    if (interactionState.type === 'BUYING_CARD') {
      setIsRowOpen(true);
    }
  }, [interactionState.type]);

  // État pour la modale de sélection de carte de fin de manche
  const [passModalState, setPassModalState] = useState<{ visible: boolean; cards: any[]; selectedCardId: string | null; cardsToKeep?: string[] }>({ visible: false, cards: [], selectedCardId: null });

  // Ref pour contrôler le plateau solaire
  const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

  // Ref pour accéder à l'état d'interaction actuel dans addToHistory sans dépendance
  const interactionStateRef = useRef(interactionState);
  useEffect(() => { interactionStateRef.current = interactionState; }, [interactionState]);

  // Helper pour ajouter une entrée à l'historique
  const addToHistory = useCallback((message: string, playerId?: string, previousState?: Game, customInteractionState?: InteractionState) => {
    const entry: HistoryEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      playerId,
      previousState,
      previousInteractionState: customInteractionState || interactionStateRef.current,
      previousHasPerformedMainAction: hasPerformedMainAction,
      timestamp: Date.now()
    };
    setHistoryLog(prev => [entry, ...prev]);
  }, [hasPerformedMainAction]);

  // Gestionnaire pour annuler une action
  const handleUndo = () => {
    if (historyLog.length === 0) return;
    const lastEntry = historyLog[0];
    if (lastEntry.previousState) {
      setGame(lastEntry.previousState);
      if (gameEngineRef.current) {
        gameEngineRef.current.setState(lastEntry.previousState);
      }
      setHistoryLog(prev => prev.slice(1));
      // Restaurer l'état d'interaction précédent s'il existe, sinon IDLE
      setInteractionState(lastEntry.previousInteractionState || { type: 'IDLE' });
      
      // Restaurer hasPerformedMainAction
      if (lastEntry.previousHasPerformedMainAction !== undefined) {
        setHasPerformedMainAction(lastEntry.previousHasPerformedMainAction);
      }
      
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
  const performPass = useCallback((cardsToKeep: string[], selectedCardId?: string) => {
    if (!gameEngineRef.current) return;
    
    // Synchroniser l'état
    const currentGame = gameRef.current;
    gameEngineRef.current.setState(currentGame);
    
    // Utiliser l'état du moteur pour garantir la cohérence
    const engineState = gameEngineRef.current.getState();
    const enginePlayer = engineState.players[engineState.currentPlayerIndex];
    
    const action = new PassAction(enginePlayer.id, cardsToKeep, selectedCardId);
    const result = gameEngineRef.current.executeAction(action);
    
    if (result.success && result.updatedState) {
        const oldGame = currentGame;
        const newGame = result.updatedState;
        
        if (newGame.isFirstToPass) {
          const currentLevel = oldGame.board.solarSystem.nextRingLevel || 1;
          setToast({ message: `Rotation du système solaire (Niveau ${currentLevel})`, visible: true });
          addToHistory(`passe son tour en premier et choisit une carte à garder`, enginePlayer.id, oldGame);
        } else {
          addToHistory("passe son tour et choisit une carte à garder", enginePlayer.id, oldGame);
        }

        // Détecter la fin de manche (si le numéro de manche a augmenté)
        if (newGame.currentRound > oldGame.currentRound) {
          setToast({ message: "Fin de manche : Revenus perçus", visible: true });
          addToHistory(`--- FIN DE LA MANCHE ${oldGame.currentRound} ---`);

          // Log des revenus pour chaque joueur
          newGame.players.forEach(newPlayer => {
            const oldPlayer = oldGame.players.find(p => p.id === newPlayer.id);
            if (oldPlayer) {
              const creditsGain = newPlayer.revenueCredits;
              const energyGain = newPlayer.revenueEnergy;
              const cardsGain = newPlayer.revenueCards;
              const gains: string[] = [];
              if (creditsGain > 0) gains.push(`${creditsGain} Crédit${creditsGain > 1 ? 's' : ''}`);
              if (energyGain > 0) gains.push(`${energyGain} Énergie${energyGain > 1 ? 's' : ''}`);
              if (cardsGain > 0) gains.push(`${cardsGain} Carte${cardsGain > 1 ? 's' : ''}`);
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
    // Si le joueur est un robot
    if (currentPlayer && currentPlayer.type === 'robot') {
      const timer = setTimeout(() => {
        // 1. Vérifier les paliers d'objectifs
        const milestoneClaim = AIBehavior.checkAndClaimMilestone(game, currentPlayer);
        
        if (milestoneClaim) {
           const updatedGame = structuredClone(game);
           const upTile = updatedGame.board.objectiveTiles.find(t => t.id === milestoneClaim.tileId)!;
           const upPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
           
           upTile.markers.push(upPlayer.id);
           upPlayer.claimedMilestones.push(milestoneClaim.milestone);
           
           setGame(updatedGame);
           if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
           
           addToHistory(`(Robot) atteint le palier ${milestoneClaim.milestone} PV et place un marqueur sur "${upTile.name}"`, upPlayer.id, game);
           return; // On attend le prochain cycle pour jouer l'action suivante
        }

        // 2. Décider de l'action (Passer)
        const decision = AIBehavior.decideAction(game, currentPlayer);
        if (decision && decision.action === 'PASS') {
            performPass(decision.cardsToKeep, decision.selectedCardId);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [game, performPass, addToHistory]);

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  const handleNextPlayer = () => {
    if (!gameEngineRef.current) return;

    // Vérifier les paliers de score avant de passer au joueur suivant
    // Utiliser l'état du moteur pour avoir la version la plus à jour
    const currentState = gameEngineRef.current.getState();
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    const milestones = [25, 50, 70];
    
    for (const m of milestones) {
      if (currentPlayer.score >= m && !currentPlayer.claimedMilestones.includes(m)) {
        setInteractionState({ type: 'PLACING_OBJECTIVE_MARKER', milestone: m });
        setToast({ message: `Palier de ${m} PV atteint ! Placez un marqueur sur un objectif avant de terminer le tour.`, visible: true });
        setIsObjectivesOpen(true);
        return; // Interrompre le passage au joueur suivant
      }
    }

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
    
    // Vérifier s'il y a un paquet de manche pour déclencher la modale
    const roundDeck = game.roundDecks[game.currentRound];
    if (roundDeck && roundDeck.length > 0) {
        setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
        // Note: performPass sera appelé après la confirmation dans la modale
    } else {
        performPass(cardsToKeep);
    }
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
    gameEngineRef.current.setState(gameRef.current);

    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    
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
      
      // Vérifier s'il y a un paquet de manche pour déclencher la modale
      const roundDeck = game.roundDecks[game.currentRound];
      if (roundDeck && roundDeck.length > 0) {
          setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
      } else {
          performPass(cardsToKeep);
      }
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

      const rotationResult = ProbeSystem.updateProbesAfterRotation(updatedGame, oldRotationState, newRotationState);
      updatedGame = rotationResult.game;
      
      addToHistory(`paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias et fait tourner le système solaire (Niveau ${currentLevel}) pour rechercher une technologie`, player.id, game);

      rotationResult.logs.forEach(log => addToHistory(log));

      setGame(updatedGame);
      if (gameEngineRef.current) {
        gameEngineRef.current.setState(updatedGame);
      }
      setInteractionState({ type: 'RESEARCHING' });
      setIsTechOpen(true);
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

      // Capture state BEFORE analysis for undo (Deep copy to ensure computer data is saved)
      const previousState = structuredClone(currentGame);

      // Délai pour l'animation avant d'appliquer les effets
      setTimeout(() => {
        const currentGame = gameRef.current;
        const updatedGame = structuredClone(currentGame);
        const player = updatedGame.players[updatedGame.currentPlayerIndex];

        // 1. Dépenser 1 énergie
        player.energy -= 1;

        // 2. Vider l'ordinateur (haut et bas)
        DataSystem.clearComputer(player);

        setGame(updatedGame);
        if (gameEngineRef.current) {
          gameEngineRef.current.setState(updatedGame);
        }
        setHasPerformedMainAction(true);
        
        // 3. Passer en mode placement de trace de vie
        setInteractionState({ type: 'PLACING_LIFE_TRACE', color: 'blue' });
        setToast({ message: "Données analysées. Placez une trace de vie sur la piste bleue.", visible: true });
        addToHistory(`analyse des données et gagne 1 trace de vie bleue`, player.id, previousState, { type: 'IDLE' });
      }, 1500);
    }
  };

  // Gestionnaire pour le déplacement des sondes
  const handleProbeMove = async (probeId: string, targetDisk: DiskName, targetSector: SectorNumber, cost: number, path: string[]) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel
    gameEngineRef.current.setState(game);

    let currentGame = gameRef.current; // Utiliser la ref pour avoir l'état le plus frais
    const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex].id;

    let freeMovements = interactionState.type === 'FREE_MOVEMENT' ? 1 : 0;

    // Parcourir le chemin étape par étape (en ignorant le point de départ à l'index 0)
    for (let i = 1; i < path.length; i++) {
      const cellKey = path[i];
      const disk = cellKey[0] as DiskName;
      const sector = parseInt(cellKey.substring(1)) as SectorNumber;

      // Sauvegarder l'état avant le mouvement pour l'historique (copie profonde)
      const stateBeforeMove = structuredClone(currentGame);

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
            
            let message = "";
            if (energySpent > 0) {
              message = `déplace une sonde vers ${disk}${sector} pour ${energySpent} énergie`;
            } else {
              message = `déplace une sonde vers ${disk}${sector} gratuitement`;
            }

            if (mediaGain > 0) {
              setToast({ message: `Gain de média : +${mediaGain}`, visible: true });
              message += ` et gagne ${mediaGain} média (${objectName})`;
            }
            
            addToHistory(message, currentPlayerId, stateBeforeMove);
        }

        currentGame = updatedGame;
        //gameRef.current = currentGame; // Mettre à jour la ref locale
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
    setInteractionState({ type: 'BUYING_CARD' });
    setToast({ message: "Sélectionnez une carte dans la rangée ou la pioche", visible: true });
  };

  const handleCardRowClick = (cardId?: string) => { // cardId undefined means deck
    if (interactionState.type !== 'BUYING_CARD') return;
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    const result = ResourceSystem.buyCard(game, currentPlayer.id, cardId);
    
    if (result.error) {
      setToast({ message: result.error, visible: true });
      // On reste dans l'état BUYING_CARD pour permettre de réessayer ou d'annuler via l'overlay
      return;
    }

    setGame(result.updatedGame);
    setToast({ message: "Carte achetée (-3 Média)", visible: true });
    addToHistory(cardId ? "achète une carte de la rangée pour 3 médias" : "achète une carte de la pioche pour 3 médias", currentPlayer.id, game, { type: 'IDLE' });
    setInteractionState({ type: 'IDLE' });
    setIsRowOpen(false);
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
      addToHistory(`échange 2 ${translateResource(spendType, 2)} contre 1 ${translateResource(gainType, 1)}`, currentPlayer.id, game, { type: 'IDLE' });
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
    setIsTechOpen(false);
    setHasPerformedMainAction(true);
    setToast({ message: `Technologie ${tech.name} acquise !`, visible: true });
    
    let category = "";
    if (tech.id.startsWith('exploration')) category = "Exploration";
    else if (tech.id.startsWith('observation')) category = "Observation";
    else if (tech.id.startsWith('computing')) category = "Informatique";

    const gainsText = gains.length > 0 ? ` et gagne : ${gains.join(', ')}` : '';
    
    // Fusionner avec l'entrée d'historique précédente (Rotation) pour que l'annulation
    // revienne à l'état avant la rotation (et non à la sélection de technologie)
    setHistoryLog(prev => {
      // Trouver l'entrée de la rotation (dernière entrée avec un état précédent sauvegardé)
      const rotationEntryIndex = prev.findIndex(e => e.previousState);
      
      if (rotationEntryIndex !== -1) {
        const rotationEntry = prev[rotationEntryIndex];
        
        const newEntry: HistoryEntry = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          message: `acquiert la technologie "${category} ${tech.name}"${gainsText}`,
          playerId: currentPlayer.id,
          previousState: rotationEntry.previousState, // État AVANT la rotation
          previousInteractionState: rotationEntry.previousInteractionState, // État IDLE
          previousHasPerformedMainAction: rotationEntry.previousHasPerformedMainAction,
          timestamp: Date.now()
        };
        
        // Remplacer l'entrée de rotation (et les logs intermédiaires) par la nouvelle entrée
        return [newEntry, ...prev.slice(rotationEntryIndex + 1)];
      }
      
      // Fallback si pas d'entrée précédente trouvée (ne devrait pas arriver)
      const fallbackEntry: HistoryEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        message: `acquiert la technologie "${category} ${tech.name}"${gainsText}`,
        playerId: currentPlayer.id,
        previousState: currentGame,
        previousInteractionState: { type: 'IDLE' },
        previousHasPerformedMainAction: hasPerformedMainAction,
        timestamp: Date.now()
      };
      return [fallbackEntry, ...prev];
    });
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
    addToHistory(`pioche ${count} carte${count > 1 ? 's' : ''} (${source})`, game.players[game.currentPlayerIndex].id, game);
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

  // Gestionnaire pour les bonus ordinateur (déclenché depuis PlayerBoardUI)
  const handleComputerBonus = (type: string, amount: number) => {
    if (type === 'reservation') {
      setInteractionState({ type: 'RESERVING_CARD', count: amount });
      setToast({ message: `Réservation active : Sélectionnez ${amount} carte(s) avec revenu`, visible: true });
    }
  };

  // Gestionnaire pour la réservation de carte
  const handleReserveCard = (cardId: string) => {
    if (interactionState.type !== 'RESERVING_CARD') return;

    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    
    // Copier le tableau de cartes pour éviter de muter l'état précédent (qui est utilisé pour l'historique)
    currentPlayer.cards = [...currentPlayer.cards];

    const cardIndex = currentPlayer.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const card = currentPlayer.cards[cardIndex];

    if (!card.revenue) {
      setToast({ message: "Cette carte n'a pas de bonus de revenu", visible: true });
      return;
    }

    // Retirer la carte
    currentPlayer.cards.splice(cardIndex, 1);

    // Appliquer le bonus
    let gainMsg = "";
    if (card.revenue === RevenueBonus.CREDIT) {
      currentPlayer.revenueCredits += 1;
      currentPlayer.credits += 1;
      gainMsg = "1 Crédit";
    } else if (card.revenue === RevenueBonus.ENERGY) {
      currentPlayer.revenueEnergy += 1;
      currentPlayer.energy += 1;
      gainMsg = "1 Énergie";
    } else if (card.revenue === RevenueBonus.CARD) {
      currentPlayer.revenueCards += 1;
      gainMsg = "1 Carte";
    }

    addToHistory(`réserve la carte "${card.name}" et gagne immédiatement : ${gainMsg}`, currentPlayer.id, game);

    // Si le bonus est une carte, on pioche immédiatement
    if (card.revenue === RevenueBonus.CARD) {
       const drawResult = CardSystem.drawCards(updatedGame, currentPlayer.id, 1, 'Bonus immédiat réservation');
       setGame(drawResult);
       if (gameEngineRef.current) gameEngineRef.current.setState(drawResult);
    } else {
       setGame(updatedGame);
       if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    }

    // Mettre à jour l'état d'interaction
    const newCount = interactionState.count - 1;
    if (newCount > 0) {
      setInteractionState({ type: 'RESERVING_CARD', count: newCount });
      setToast({ message: `Encore ${newCount} carte(s) à réserver`, visible: true });
    } else {
      setInteractionState({ type: 'IDLE' });
      setToast({ message: "Réservation terminée", visible: true });
    }
  };

  // Gestionnaire pour le clic sur une piste Alien
  const handleAlienTrackClick = (color: string) => {
    if (interactionState.type !== 'PLACING_LIFE_TRACE') return;
    
    if (interactionState.color !== color) {
        setToast({ message: `Veuillez placer sur la piste ${interactionState.color === 'blue' ? 'bleue' : interactionState.color}`, visible: true });
        return;
    }

    const updatedGame = structuredClone(game);
    const player = updatedGame.players[updatedGame.currentPlayerIndex];
    const alienBoard = updatedGame.board.alienBoard;
    const track = (alienBoard as any)[color]; 

    let bonusMsg = "";

    if (!track.slot1.playerId) {
      track.slot1.playerId = player.id;
      player.score += track.slot1.bonus.pv;
      if (track.slot1.bonus.media) player.mediaCoverage = Math.min(player.mediaCoverage + track.slot1.bonus.media, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
      bonusMsg = "+5 PV, +1 Média (1er)";
    } else if (!track.slot2.playerId) {
      track.slot2.playerId = player.id;
      player.score += track.slot2.bonus.pv;
      if (track.slot2.bonus.media) player.mediaCoverage = Math.min(player.mediaCoverage + track.slot2.bonus.media, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
      bonusMsg = "+3 PV, +1 Média (2ème)";
    } else {
      player.score += 3;
      bonusMsg = "+3 PV";
    }

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    
    addToHistory(`place une trace de vie sur la piste ${color} et gagne ${bonusMsg}`, player.id, game);
    setInteractionState({ type: 'IDLE' });
    setToast({ message: `Trace de vie placée ! ${bonusMsg}`, visible: true });
  };

  // Gestionnaire pour le clic sur un objectif (placement de marqueur de palier)
  const handleObjectiveClick = (tileId: string) => {
    if (interactionState.type !== 'PLACING_OBJECTIVE_MARKER') return;
    
    const tile = game.board.objectiveTiles.find(t => t.id === tileId);
    if (!tile) return;
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    
    // Vérifier si le joueur a déjà un marqueur sur cet objectif
    if (tile.markers.includes(currentPlayer.id)) {
      setToast({ message: "Vous avez déjà un marqueur sur cet objectif.", visible: true });
      return;
    }
        
    // Mettre à jour le jeu
    const updatedGame = structuredClone(game);
    const upTile = updatedGame.board.objectiveTiles.find(t => t.id === tileId)!;
    const upPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    
    upTile.markers.push(upPlayer.id);
    upPlayer.claimedMilestones.push(interactionState.milestone);
    
    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

    addToHistory(`a atteint le palier ${interactionState.milestone} PV et place un marqueur sur "${tile.name}" (Points fin de partie)`, upPlayer.id, game);
    
    setInteractionState({ type: 'IDLE' });
    setToast({ message: `Marqueur placé !`, visible: true });

    // Continuer la fin de tour (vérifier d'autres paliers ou passer au joueur suivant)
    handleNextPlayer();
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
      <style>{`
        .seti-root {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background-color: #1a1a2e;
          color: #fff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .seti-root-inner {
          display: flex;
          flex-direction: row;
          height: 100%;
          padding: 10px;
          box-sizing: border-box;
          gap: 10px;
        }
        .seti-left-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-width: 300px;
          height: 100%;
          overflow-y: auto;
        }
        .seti-right-column {
          display: flex;
          flex-direction: column;
          flex: 2;
          min-width: 0;
          gap: 10px;
          height: 100%;
        }
        .seti-center-panel {
          position: relative;
          flex: 1;
          height: 100%;
          width: 100%;
          overflow: hidden;
          border-radius: 8px;
          background-color: rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .seti-bottom-layout {
          display: flex;
          gap: 10px;
          height: 35vh;
          flex-shrink: 0;
          min-height: 250px;
        }
        .seti-player-area {
          flex: 3;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .seti-history-area {
          flex: 1;
          min-width: 250px;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 768px) {
          .seti-root { height: auto; min-height: 100vh; overflow-y: auto; }
          .seti-root-inner { flex-direction: column; height: auto; overflow: visible; }
          .seti-left-panel { width: 100%; min-width: 0; max-width: none; height: auto; }
          .seti-right-column { height: auto; flex: none; }
          .seti-center-panel { display: block; height: auto; padding-bottom: 0; overflow: visible; flex: none; }
          .seti-bottom-layout { flex-direction: column; height: auto; flex: none; }
          .seti-player-area { width: 100%; flex: none; }
          .seti-history-area { width: 100%; height: 300px; flex: none; }
        }
        
        /* Styles pour les panneaux repliables */
        .seti-foldable-container {
          background-color: rgba(30, 30, 40, 0.9);
          border: 1px solid #555;
          border-radius: 6px;
          overflow: hidden;
          transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease;
          max-height: 40px; /* Hauteur du header */
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }
        .seti-foldable-container:hover, .seti-foldable-container.open {
          max-height: 80vh; /* Assez grand pour le contenu */
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border-color: #4a9eff;
          z-index: 20;
        }
        .seti-foldable-header {
          padding: 0 10px;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #333;
          height: 40px;
          min-height: 40px;
          box-sizing: border-box;
        }
        .seti-foldable-header::after {
          content: '▼';
          font-size: 0.8em;
          transition: transform 0.3s;
        }
        .seti-foldable-container:hover .seti-foldable-header::after, .seti-foldable-container.open .seti-foldable-header::after {
          transform: rotate(180deg);
        }
        .seti-foldable-content {
          padding: 10px;
          overflow-y: auto;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .seti-foldable-container:hover .seti-foldable-content, .seti-foldable-container.open .seti-foldable-content {
          opacity: 1;
          transition: opacity 0.5s ease 0.1s;
        }
        /* Overrides pour les composants internes */
        .seti-foldable-content .seti-panel {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          margin: 0 !important;
        }
        .seti-foldable-content .seti-panel-title {
          display: none !important;
        }
        @keyframes cardAppear {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
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
      
      {/* Modale de sélection de carte de fin de manche */}
      {passModalState.visible && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#fff' }}>
            Fin de manche : Choisissez une carte
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            flexWrap: 'wrap', 
            justifyContent: 'center', 
            maxWidth: '800px',
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: '10px'
          }}>
            {passModalState.cards.map(card => (
              <div 
                key={card.id}
                onClick={() => setPassModalState(prev => ({ ...prev, selectedCardId: card.id }))}
                style={{
                  width: '140px',
                  padding: '10px',
                  backgroundColor: passModalState.selectedCardId === card.id ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: passModalState.selectedCardId === card.id ? '2px solid #4a9eff' : '1px solid #555',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: passModalState.selectedCardId === card.id ? 'scale(1.05)' : 'scale(1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{card.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{card.description}</div>
              </div>
            ))}
          </div>
          <button
            disabled={!passModalState.selectedCardId}
            onClick={() => {
              if (passModalState.selectedCardId) {
                const currentPlayer = game.players[game.currentPlayerIndex];
                // Recalculer les cartes à garder (au cas où on vient de la défausse)
                const cardsToKeep = passModalState.cardsToKeep || currentPlayer.cards.map(c => c.id);
                performPass(cardsToKeep, passModalState.selectedCardId);
                setPassModalState({ visible: false, cards: [], selectedCardId: null });
              }
            }}
            style={{
              marginTop: '30px',
              padding: '10px 30px',
              fontSize: '1.1rem',
              backgroundColor: passModalState.selectedCardId ? '#4a9eff' : '#555',
              color: passModalState.selectedCardId ? '#fff' : '#aaa',
              border: 'none',
              borderRadius: '6px',
              cursor: passModalState.selectedCardId ? 'pointer' : 'not-allowed',
            }}
          >
            Confirmer et Passer
          </button>
        </div>
      )}

      {/* Overlay pour la recherche de technologie ou l'achat de carte */}
      {(interactionState.type === 'RESEARCHING' || interactionState.type === 'BUYING_CARD') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1500,
          backdropFilter: 'blur(2px)'
        }} onClick={() => {
          if (interactionState.type === 'BUYING_CARD') {
             setInteractionState({ type: 'IDLE' });
             setIsRowOpen(false);
          } else {
             setToast({ message: "Veuillez sélectionner une technologie", visible: true });
          }
        }} />
      )}

      <div className="seti-root-inner">
        <div className="seti-left-panel">
            <div className={`seti-foldable-container ${isObjectivesOpen ? 'open' : ''}`}>
              <div className="seti-foldable-header" onClick={() => setIsObjectivesOpen(!isObjectivesOpen)}>Objectifs</div>
              <div className="seti-foldable-content">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {game.board.objectiveTiles && game.board.objectiveTiles.map(tile => (
                    <div key={tile.id} 
                      onClick={() => handleObjectiveClick(tile.id)}
                      title={`Récompenses : 1er: ${tile.rewards.first} PV, 2ème: ${tile.rewards.second} PV, Autres: ${tile.rewards.others} PV`}
                      style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? '1px solid #4a9eff' : '1px solid #555',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      cursor: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? 'pointer' : 'default',
                      boxShadow: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? '0 0 10px rgba(74, 158, 255, 0.3)' : 'none',
                      flexDirection: 'column',
                      gap: '4px',
                      minHeight: '100px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#ffd700', fontSize: '0.8em', lineHeight: '1.1' }}>{tile.name}</span>
                        <span style={{ fontSize: '0.65em', color: '#aaa', border: '1px solid #555', padding: '1px 3px', borderRadius: '3px' }}>{tile.side}</span>
                      </div>
                      <div style={{ fontSize: '0.7em', color: '#ccc', fontStyle: 'italic', marginBottom: 'auto' }}>{tile.description}</div>
                      
                      {/* Piste de score avec 4 cercles */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', position: 'relative', padding: '0 5px' }}>
                        {/* Ligne de connexion */}
                        <div style={{ position: 'absolute', top: '50%', left: '10px', right: '10px', height: '2px', backgroundColor: '#555', zIndex: 0 }}></div>
                        
                        {/* Cercles (1er, 2eme, Autre, Autre) */}
                        {[tile.rewards.first, tile.rewards.second, tile.rewards.others, tile.rewards.others].map((pv, idx) => {
                          const markerPlayerId = tile.markers[idx];
                          const player = markerPlayerId ? game.players.find(p => p.id === markerPlayerId) : null;
                          
                          const currentPlayer = game.players[game.currentPlayerIndex];
                          const isPlacingMarker = interactionState.type === 'PLACING_OBJECTIVE_MARKER';
                          const hasMarkerOnTile = tile.markers.includes(currentPlayer.id);
                          const isNextAvailable = isPlacingMarker && !hasMarkerOnTile && idx === tile.markers.length;

                          return (
                            <div key={idx} style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              backgroundColor: player ? (player.color || '#fff') : (isNextAvailable ? 'rgba(74, 158, 255, 0.3)' : '#222'),
                              border: player ? '2px solid #fff' : (isNextAvailable ? '2px solid #4a9eff' : '1px solid #777'),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              zIndex: 1, fontSize: '0.75em', fontWeight: 'bold',
                              color: player ? '#000' : '#fff', 
                              boxShadow: isNextAvailable ? '0 0 8px #4a9eff' : (player ? '0 0 4px rgba(0,0,0,0.5)' : 'none'),
                              transform: isNextAvailable ? 'scale(1.2)' : 'scale(1)',
                              transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                              cursor: isNextAvailable ? 'pointer' : 'default'
                            }} title={player ? `Occupé par ${player.name}` : `${pv} PV`}>
                              {player ? '' : pv}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`seti-foldable-container ${isTechOpen ? 'open' : ''}`}
                 style={interactionState.type === 'RESEARCHING' ? { zIndex: 1501, position: 'relative', borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {}}
            >
              <div className="seti-foldable-header" onClick={() => setIsTechOpen(!isTechOpen)}>Technologies</div>
              <div className="seti-foldable-content">
                <TechnologyBoardUI 
                  game={game} 
                  isResearching={interactionState.type === 'RESEARCHING'}
                  onTechClick={handleTechClick}
                />
              </div>
            </div>
            
            <div className={`seti-foldable-container ${isRowOpen ? 'open' : ''}`}
                 style={interactionState.type === 'BUYING_CARD' ? { zIndex: 1501, position: 'relative', borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {}}
            >
               <div className="seti-foldable-header" onClick={() => setIsRowOpen(!isRowOpen)}>Rangée Principale</div>
               <div className="seti-foldable-content">
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '8px' }}>
                 {/* Pile de pioche */}
                 <div 
                     onClick={() => handleCardRowClick()}
                     style={{
                     border: '1px solid #555',
                     borderRadius: '6px',
                     padding: '6px',
                     backgroundColor: 'rgba(30, 30, 40, 0.8)',
                     boxSizing: 'border-box',
                     display: 'flex',
                     flexDirection: 'column',
                     justifyContent: 'center',
                     alignItems: 'center',
                     gap: '4px',
                     boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                     minHeight: '100px',
                     fontSize: '0.85em',
                     backgroundImage: 'repeating-linear-gradient(45deg, #222 0, #222 10px, #2a2a2a 10px, #2a2a2a 20px)',
                     cursor: interactionState.type === 'BUYING_CARD' ? 'pointer' : 'default',
                     borderColor: interactionState.type === 'BUYING_CARD' ? '#4a9eff' : '#555'
                   }}>
                    <div style={{ fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>Pioche</div>
                    <div style={{ fontSize: '0.8em', color: '#888' }}>{game.decks?.actionCards?.length || 0} cartes</div>
                 </div>

                 {game.board.cardRow && game.board.cardRow.map(card => (
                   <div key={card.id} 
                     onClick={() => handleCardRowClick(card.id)}
                     style={{
                     border: interactionState.type === 'BUYING_CARD' ? '1px solid #4a9eff' : '1px solid #555',
                     borderRadius: '6px',
                     padding: '6px',
                     backgroundColor: 'rgba(30, 30, 40, 0.8)',
                     boxSizing: 'border-box',
                     display: 'flex',
                     flexDirection: 'column',
                     gap: '4px',
                     boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                     minHeight: '100px',
                     fontSize: '0.85em',
                     cursor: interactionState.type === 'BUYING_CARD' ? 'pointer' : 'default',
                     animation: 'cardAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                   }}>
                     <div style={{ fontWeight: 'bold', color: '#fff', lineHeight: '1.1', marginBottom: '2px' }}>{card.name}</div>
                     <div style={{ fontSize: '0.9em', color: '#aaa' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></div>
                     {card.description && <div style={{ fontSize: '0.75em', color: '#ccc', fontStyle: 'italic', margin: '2px 0', lineHeight: '1.2' }}>{card.description}</div>}
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#ddd', marginBottom: '2px' }}>
                        {card.freeAction && <div>Act: {card.freeAction}</div>}
                        {card.revenue && <div>Rev: {card.revenue}</div>}
                     </div>
                     <div style={{ 
                       marginTop: 'auto', 
                       padding: '4px', 
                       backgroundColor: 'rgba(255,255,255,0.05)', 
                       borderRadius: '4px',
                       textAlign: 'center',
                       border: `1px solid ${getSectorColorCode(card.scanSector)}`,
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
                    <div style={{ gridColumn: '2 / -1', color: '#888', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>Aucune carte disponible</div>
                 )}
               </div>
               </div>
            </div>
            
            <div className={`seti-foldable-container ${isAlienOpen ? 'open' : ''}`}>
               <div className="seti-foldable-header" onClick={() => setIsAlienOpen(!isAlienOpen)}>Piste Alien</div>
               <div className="seti-foldable-content">
                 <AlienBoardUI game={game} onTrackClick={handleAlienTrackClick} />
               </div>
            </div>
            
            <div className={`seti-foldable-container ${isHistoryOpen ? 'open' : ''}`}>
               <div className="seti-foldable-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                  <span style={{ flex: 1 }}>Historique</span>
                  {historyLog.length > 0 && historyLog[0].previousState && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleUndo(); }} 
                      style={{ fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', backgroundColor: '#555', border: '1px solid #777', color: '#fff', borderRadius: '4px', marginRight: '5px' }} 
                      title="Annuler la dernière action"
                    >
                      ↩
                    </button>
                  )}
               </div>
               <div className="seti-foldable-content">
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
                      <div key={entry.id} className="seti-history-item" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '8px', marginBottom: '4px' }}>
                        {player && <strong style={{ color: color }}>{player.name} </strong>}
                        <span style={{ color: '#ddd' }}>{entry.message}</span>
                      </div>
                    );
                  })}
                 </div>
               </div>
            </div>
        </div>
        <div className="seti-right-column">
          <div className="seti-center-panel">
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
        
        <div className="seti-bottom-layout">
          <div className="seti-player-area">
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
              onComputerBonus={handleComputerBonus}
              reservationState={interactionState.type === 'RESERVING_CARD' ? { active: true, count: interactionState.count } : { active: false, count: 0 }}
              onReserveCard={handleReserveCard}
              isPlacingLifeTrace={interactionState.type === 'PLACING_LIFE_TRACE'}
            />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
