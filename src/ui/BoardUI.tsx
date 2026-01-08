import React, { useRef, useState, useEffect } from 'react';
import { Game, ActionType, DiskName, SectorNumber, FreeAction, GAME_CONSTANTS, CardType, SectorColor, RevenueBonus } from '../core/types';
import { SolarSystemBoard, SolarSystemBoardRef } from './SolarSystemBoard';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoard } from './PlayerBoard';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { GameEngine } from '../core/Game';
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState, getCell } from '../core/SolarSystemPosition';

interface BoardUIProps {
  game: Game;
}

export const BoardUI: React.FC<BoardUIProps> = ({ game: initialGame }) => {
  // État pour le jeu
  const [game, setGame] = useState<Game>(initialGame);
  const gameEngineRef = useRef<GameEngine | null>(null);
  
  // État pour les notifications (toasts)
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);

  // État pour la gestion de la défausse (Action Passer)
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [cardsToDiscard, setCardsToDiscard] = useState<string[]>([]);

  // État pour le mode d'échange de ressources (en plusieurs étapes)
  const [tradeState, setTradeState] = useState<{ phase: 'inactive' | 'spending' | 'gaining', spend?: { type: string, cardIds?: string[] } }>({ phase: 'inactive' });

  // État pour le mode déplacement gratuit (suite à une action gratuite)
  const [isFreeMovementMode, setIsFreeMovementMode] = useState(false);

  // Effet pour masquer le toast après 3 secondes
  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        setToast(prev => prev ? { ...prev, visible: false } : null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initialiser le GameEngine
  if (!gameEngineRef.current) {
    gameEngineRef.current = new GameEngine(game);
  }

  // Ref pour contrôler le plateau solaire
  const solarSystemRef = useRef<SolarSystemBoardRef>(null);

  // Logique d'exécution de l'action Passer (après défausse éventuelle)
  const executePass = (gameToUpdate: Game) => {
    let updatedGame = { ...gameToUpdate };
    // Copie des joueurs pour éviter la mutation directe
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];

    // 1. Marquer le joueur comme ayant passé
    // Note: On suppose que la propriété hasPassed existe sur Player, sinon on l'ajoute dynamiquement
    currentPlayer.hasPassed = true;

    // 2. Si c'est le premier joueur à passer, pivoter le système solaire
    const passedPlayersCount = updatedGame.players.filter(p => p.hasPassed).length;
    
    // Si passedPlayersCount vaut 1, c'est que le joueur actuel vient de passer et est le seul
    if (passedPlayersCount === 1) {
      const techBoard = updatedGame.board.technologyBoard;
      const currentLevel = techBoard.nextRingLevel; // 1, 2 ou 3
      
      console.log(`Premier joueur à passer. Rotation du niveau ${currentLevel}`);
      setToast({ message: `Rotation du système solaire (Niveau ${currentLevel})`, visible: true });

      // Sauvegarder l'ancien état de rotation pour la mise à jour des sondes
      const oldRotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );

      // Copie du board pour éviter la mutation directe
      updatedGame.board = {
        ...updatedGame.board,
        solarSystem: {
          ...updatedGame.board.solarSystem
        }
      };

      // Pivoter le plateau courant (-45 degrés = sens anti-horaire)
      // La rotation des niveaux supérieurs entraîne celle des niveaux inférieurs selon la logique physique,
      // mais ici on applique la règle du jeu : "Pivoter le plateau courant"
      if (currentLevel === 1) {
        updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
      } else if (currentLevel === 2) {
        updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
        updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
      } else if (currentLevel === 3) {
        updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
      }

      // Incrémenter le plateau modulo 3 (1->2, 2->3, 3->1)
      techBoard.nextRingLevel = (currentLevel % 3) + 1;

      // Nouvel état de rotation
      const newRotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );

      // Mettre à jour les positions des sondes (pour qu'elles restent fixes si elles sont sur un niveau inférieur)
      updatedGame = ProbeSystem.updateProbesAfterRotation(updatedGame, oldRotationState, newRotationState);
    }

    // 3. TODO: Choisissez une carte dans le paquet de fin de manche

    // Vérifier si tout le monde a passé (Fin de manche)
    const allPassed = updatedGame.players.every(p => p.hasPassed);
    if (allPassed) {
      console.log("Fin de manche déclenchée");
      setToast({ message: "Fin de manche : Revenus perçus", visible: true });

      // 1. Chaque joueur perçoit ses revenus
      updatedGame.players = updatedGame.players.map(player => {
        return {
          ...player,
          credits: player.credits + player.revenueCredits,
          energy: player.energy + player.revenueEnergy,
          // Réinitialiser le statut passé pour la prochaine manche
          hasPassed: false 
        };
      });

      // Passer au joueur suivant pour commencer la nouvelle manche (évite que le dernier joueur rejoue immédiatement)
      updatedGame.currentPlayerIndex = (currentPlayerIndex + 1) % updatedGame.players.length;

      // TODO: Autres étapes de fin de manche (ordre du tour, etc.)
    } else {
      // Passer au joueur suivant qui n'a pas encore passé
      let nextIndex = (currentPlayerIndex + 1) % updatedGame.players.length;
      let loopCount = 0;
      while (updatedGame.players[nextIndex].hasPassed && loopCount < updatedGame.players.length) {
        nextIndex = (nextIndex + 1) % updatedGame.players.length;
        loopCount++;
      }
      updatedGame.currentPlayerIndex = nextIndex;
    }

    setGame(updatedGame);
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
    const updatedGame = { ...game };
    const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    
    // Retirer les cartes sélectionnées
    currentPlayer.cards = currentPlayer.cards.filter(c => !cardsToDiscard.includes(c.id));
    
    // Réinitialiser l'état de défausse
    setIsDiscarding(false);
    setCardsToDiscard([]);
    
    // Exécuter l'action Passer
    executePass(updatedGame);
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel (pour préserver les angles de rotation)
    gameEngineRef.current.setState(game);

    const currentPlayer = game.players[game.currentPlayerIndex];
    
    if (actionType === ActionType.LAUNCH_PROBE) {
      const action = new LaunchProbeAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        console.log('Sonde lancée, nouvelles sondes:', result.updatedState.board.solarSystem.probes);
        setGame(result.updatedState);
      } else {
        console.error('Erreur lors du lancement de la sonde:', result.error);
        alert(result.error || 'Impossible de lancer la sonde');
      }
    }
    else if (actionType === ActionType.PASS) {
      // 1. Vérifier la taille de la main
      if (currentPlayer.cards.length > 4) {
        setIsDiscarding(true);
        setToast({ message: "Veuillez défausser jusqu'à 4 cartes", visible: true });
        return;
      }
      
      executePass(game);
    }
    // TODO: Gérer les autres actions
  };

  // Effet pour gérer le tour du joueur Mock
  useEffect(() => {
    const currentPlayer = game.players[game.currentPlayerIndex];
    // Si le joueur est un robot, il passe son tour automatiquement
    if (currentPlayer && currentPlayer.type === 'robot') {
      const timer = setTimeout(() => {
        executePass(game);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [game]);

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

      // Calculer le coût pour cette étape
      // On doit regarder la case précédente pour voir si on sort d'un champ d'astéroïdes
      const prevKey = path[i-1];
      const prevDisk = prevKey[0] as DiskName;
      const prevSector = parseInt(prevKey.substring(1)) as SectorNumber;

      const rotationState = createRotationState(
        currentGame.board.solarSystem.rotationAngleLevel1 || 0,
        currentGame.board.solarSystem.rotationAngleLevel2 || 0,
        currentGame.board.solarSystem.rotationAngleLevel3 || 0
      );

      const prevCell = getCell(prevDisk, prevSector, rotationState);
      
      // Coût de base = 1 + malus astéroïde éventuel
      let stepCost = 1;
      if (prevCell?.hasAsteroid) {
        stepCost += 1;
      }

      // Appliquer les mouvements gratuits
      let energyCost = stepCost;
      if (freeMovements > 0) {
        const deduction = Math.min(freeMovements, energyCost);
        freeMovements -= deduction;
        energyCost -= deduction;
      }

      try {
        const updatedGame = ProbeSystem.moveProbe(
          currentGame,
          currentPlayerId,
          probeId,
          energyCost,
          disk,
          sector
        );

        // Vérifier le gain de média pour afficher un toast (pour cette étape)
        const updatedPlayer = updatedGame.players.find(p => p.id === currentPlayerId);
        const oldPlayer = currentGame.players.find(p => p.id === currentPlayerId);
        
        if (updatedPlayer && oldPlayer) {
            const mediaGain = updatedPlayer.mediaCoverage - oldPlayer.mediaCoverage;
            if (mediaGain > 0) {
              setToast({ message: `Gain de média : +${mediaGain}`, visible: true });
            }
        }

        currentGame = updatedGame;
        setGame(currentGame);
        
        // Petit délai pour l'animation
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error: any) {
        console.error('Erreur lors du déplacement de la sonde (étape):', error);
        alert(error.message || 'Impossible de déplacer la sonde');
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
    } else if (card.freeAction === FreeAction.DATA) {
      currentPlayer.data = (currentPlayer.data || 0) + 1;
      setToast({ message: "Action gratuite : +1 Data", visible: true });
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
    setToast({ message: `Carte jouée: ${card.name}`, visible: true });
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

    // Ajouter une carte (Simulation de pioche)
    const newCard = {
      id: `card_bought_${Date.now()}`,
      name: 'Soutien Médiatique',
      type: CardType.ACTION,
      cost: 1,
      freeAction: FreeAction.MEDIA,
      scanSector: SectorColor.YELLOW,
      revenue: RevenueBonus.CREDIT,
      effects: [],
      description: 'Carte obtenue grâce à votre influence médiatique.',
    };
    
    currentPlayer.cards.push(newCard);

    setGame(updatedGame);
    setToast({ message: "Carte achetée (-3 Média)", visible: true });
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

    const updatedGame = { ...game };
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
        const newCard = {
            id: `card_trade_${Date.now()}`,
            name: 'Ressource échangée',
            type: CardType.ACTION,
            cost: 0,
            freeAction: FreeAction.MEDIA,
            scanSector: SectorColor.BLUE,
            revenue: RevenueBonus.CREDIT,
            effects: [],
            description: 'Carte obtenue par échange.',
        };
        currentPlayer.cards.push(newCard);
    } else {
         alert("Type de ressource à recevoir invalide.");
         setTradeState({ phase: 'inactive' });
         return;
    }

    setGame(updatedGame);
    setToast({ message: "Echange effectué", visible: true });
    setTradeState({ phase: 'inactive' });
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

  // Handlers pour les boutons de rotation
  const handleRotateLevel1 = () => {
    solarSystemRef.current?.rotateCounterClockwise1();
    // Mettre à jour l'angle dans l'état du jeu
    const currentAngle1 = getCurrentAngle1();
    const currentAngle2 = getCurrentAngle2();
    const currentAngle3 = getCurrentAngle3();
    updateRotationAngles(currentAngle1 - 45, currentAngle2 - 45, currentAngle3 - 45);
  };

  const handleRotateLevel2 = () => {
    solarSystemRef.current?.rotateCounterClockwise2();
    // Mettre à jour l'angle dans l'état du jeu
    const currentAngle2 = getCurrentAngle2();
    const currentAngle3 = getCurrentAngle3();
    updateRotationAngles(
      getCurrentAngle1(),
      currentAngle2 - 45,
      currentAngle3 - 45
    );
  };

  const handleRotateLevel3 = () => {
    solarSystemRef.current?.rotateCounterClockwise3();
    // Mettre à jour l'angle dans l'état du jeu
    const currentAngle3 = getCurrentAngle3();
    updateRotationAngles(
      getCurrentAngle1(),
      getCurrentAngle2(),
      currentAngle3 - 45
    );
  };

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
          <TechnologyBoardUI game={game} />
          <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'visible' }}>
            <SolarSystemBoard 
              ref={solarSystemRef} 
              game={game} 
              onProbeMove={handleProbeMove} 
              initialSector1={initialSector1} 
              initialSector2={initialSector2} 
              initialSector3={initialSector3}
              highlightPlayerProbes={isFreeMovementMode}
            />
            {/* Boutons de rotation des plateaux */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 1000,
            }}>
              <button
                onClick={handleRotateLevel1}
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
                Tourner Niveau 3
              </button>
            </div>
          </div>
        </div>
        <PlayerBoard 
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
        />
      </div>
    </div>
  );
};
