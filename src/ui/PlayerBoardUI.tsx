import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, GamePhase, ActionType, GAME_CONSTANTS, Card, Mission, InteractionState, CardType } from '../core/types';
import { CardSystem } from '../systems/CardSystem';
import { PlayerComputer } from './components/PlayerComputer';
import { HandCard } from './components/HandCard';
import { CardBack } from './components/CardBack';
import { MissionCard } from './components/MissionCard';
import { PlayedMissionCard } from './components/PlayedMissionCard';
import { SlotTooltip } from './components/SlotTooltip';
import { PlayerTabs } from './player/PlayerTabs';
import { PlayerResources } from './player/PlayerResources';
import { PlayerActions } from './player/PlayerActions';
import { ExplorationTrack, ObservationTrack } from './player/PlayerTracks';
import './PlayerBoardUI.css';

interface PlayerBoardUIProps {
  game: Game;
  playerId: string;
  interactionState: InteractionState;
  onViewPlayer: (playerId: string) => void;
  onAction: (actionType: ActionType) => void;
  onCardClick: (cardId: string) => void;
  onDiscardCardAction: (cardId: string) => void;
  onPlayCard: (cardId: string) => void;
  onBuyCardAction: () => void;
  onTradeCardAction: (targetGain?: string) => void;
  /** Transfert d'une donnée sur une case de l'ordinateur (commande TRANSFER_DATA) */
  onTransferData: (slotId: string) => void;
  onComputerSlotSelect: (col: number) => void;
  onNextPlayer: () => void;
  onDirectTradeAction: (spendType: string, gainType: string) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null) => void;
  onSettingsClick: () => void;
  onDocumentationClick: () => void;
  onMissionClick: (missionId: string, requirementId: string) => void;
  onConfirmAction: (message: string, onConfirm: () => void) => void;
  /** Partie en ligne : joueurs humains joués sur un autre écran (affichés comme robots pour bloquer les actions) */
  remoteHumanIds?: string[];
  /** Action « Jouer une carte » choisie : met en avant les cartes jouables de la main */
  highlightPlayableCards?: boolean;
}

const PlayerBoardUIView: React.FC<PlayerBoardUIProps> = ({ game, playerId, interactionState, onViewPlayer, onAction, onCardClick, onDiscardCardAction, onPlayCard, onBuyCardAction, onTradeCardAction, onTransferData, onComputerSlotSelect, onNextPlayer, onDirectTradeAction, setActiveTooltip, onSettingsClick, onDocumentationClick, onMissionClick, onConfirmAction, highlightPlayableCards = false, remoteHumanIds = [] }) => {
  const currentPlayer = playerId 
    ? (game.players.find(p => p.id === playerId) || game.players[game.currentPlayerIndex])
    : game.players[game.currentPlayerIndex];
  
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const isRobot = currentPlayer.type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  const isDiscarding = interactionState.type === 'DISCARDING_CARD';
  const isTrading = interactionState.type === 'TRADING_CARD';
  const isReserving = interactionState.type === 'RESERVING_CARD';
  const isDiscardingForSignal = interactionState.type === 'DISCARDING_FOR_SIGNAL';
  const isSelectingComputerSlot = interactionState.type === 'SELECTING_COMPUTER_SLOT';
  const isAnalyzing = interactionState.type === 'ANALYZING';
  const isPlacingLifeTrace = interactionState.type === 'PLACING_LIFE_TRACE';
  const isSelectingSector = interactionState.type === 'SELECTING_SCAN_SECTOR' || interactionState.type === 'SELECTING_SCAN_CARD';



  const handCards = currentPlayer.cards.filter(c => c.type !== CardType.EXERTIEN);
  // Joueur de cet écran : le seul humain de la partie affichée (en ligne, les autres humains y sont des robots)
  const viewerId = game.players.find(p => p.type === 'human')?.id;
  const playableCardIds = highlightPlayableCards ? CardSystem.getPlayableCardIds(game, currentPlayer.id) : [];
  // Action « Jouer une carte » choisie : la main est ramenée à l'écran
  const cardsListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightPlayableCards) cardsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightPlayableCards]);

  // Infobulles du plateau : on peut y entrer (elles restent ouvertes) pour cliquer les actions gratuites d'une ressource
  // ou survoler les symboles d'une action
  const tooltipCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTooltipClose = useCallback(() => {
    if (tooltipCloseRef.current) clearTimeout(tooltipCloseRef.current);
    tooltipCloseRef.current = null;
  }, []);
  const scheduleTooltipClose = useCallback(() => {
    cancelTooltipClose();
    tooltipCloseRef.current = setTimeout(() => setActiveTooltip(null), 250);
  }, [cancelTooltipClose, setActiveTooltip]);
  useEffect(() => cancelTooltipClose, [cancelTooltipClose]);
  const showInteractiveTooltip = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    cancelTooltipClose();
    setActiveTooltip({ content, rect: e.currentTarget.getBoundingClientRect(), pointerEvents: 'auto', onMouseEnter: cancelTooltipClose, onMouseLeave: scheduleTooltipClose });
  }, [cancelTooltipClose, scheduleTooltipClose, setActiveTooltip]);
  const handleTooltipHover = showInteractiveTooltip;
  const handleTooltipLeave = scheduleTooltipClose;
  
  const isInteractiveMode = isDiscarding || isTrading || isReserving || isSelectingComputerSlot || isAnalyzing || isPlacingLifeTrace || isSelectingSector || isDiscardingForSignal || interactionState.type === 'CHOOSING_BONUS_ACTION' || interactionState.type === 'CLAIMING_MISSION_REQUIREMENT';


  // Effect to reset selection when exiting trading mode
  useEffect(() => {
    if (!isTrading) {
      setHighlightedCardId(null);
    }
  }, [isTrading]);

  const handleComputerSlotClick = (slotId: string) => {
    if (isRobot) return;
    if (isInteractiveMode && !isSelectingComputerSlot) return;

    const executeFillSlot = () => onTransferData(slotId);

    const slot = currentPlayer.dataComputer.slots[slotId];
    if (slot && slot.bonus === 'media') {
      let mediaAmount = 1;
      if (slot.technologyId && slot.technologyId.startsWith('computing-4')) mediaAmount = 2;
      if (currentPlayer.mediaCoverage + mediaAmount > GAME_CONSTANTS.MAX_MEDIA_COVERAGE && onConfirmAction) {
        onConfirmAction("Vous avez atteint la limite de couverture médiatique. Le gain de médias sera perdu. Voulez-vous continuer ?", executeFillSlot);
        return;
      }
    }

    executeFillSlot();
  };



  // Helper pour les boutons d'action (factorisé)
  const renderActionButton = React.useCallback((
    icon: React.ReactNode,
    tooltip: React.ReactNode,
    onClick: (e: React.MouseEvent) => void,
    disabled: boolean,
    color: string = '#fff',
    style: React.CSSProperties = {},
    extraClassName: string = '',
    ariaLabel?: string
  ) => {
    return (
      <button
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick(e);
        }}
        className={`seti-action-btn ${extraClassName}`}
        aria-disabled={disabled}
        style={{
          color: !disabled ? color : '#555',
          ...style
        }}
        onMouseEnter={(e) => {
          handleTooltipHover(e, tooltip);
        }}
        onMouseLeave={() => {
          handleTooltipLeave();
        }}
      >
        {icon}
      </button>
    );
  }, [handleTooltipHover, handleTooltipLeave]);

  return (
    <div className="seti-player-board-container">
      {/* Onglets des joueurs */}
      <PlayerTabs game={game} viewedId={currentPlayer.id} remoteHumanIds={remoteHumanIds} onViewPlayer={onViewPlayer}
        onDocumentationClick={onDocumentationClick} onSettingsClick={onSettingsClick}
        handleTooltipHover={handleTooltipHover} handleTooltipLeave={handleTooltipLeave} />

      {/* Plateau du joueur */}
      {/* Contour à la couleur du joueur dont le plateau est affiché (celle du joueur qui a la main sinon, BoardUI.css) */}
      <div className="seti-player-panel" style={{ '--board-color': currentPlayer.color } as React.CSSProperties}>
        <div className="seti-player-layout-container seti-thin-scroll">
          {/* Sections Ressources (tuiles symbole + valeur, revenus) et Actions (actions principales, fin du tour) */}
          <div className="seti-stats-bar">
            <PlayerResources player={currentPlayer} handCount={handCards.length} isRobot={isRobot} isCurrentTurn={isCurrentTurn}
              isInteractiveMode={isInteractiveMode} onDirectTradeAction={onDirectTradeAction} onTradeCardAction={onTradeCardAction}
              onBuyCardAction={onBuyCardAction} setActiveTooltip={setActiveTooltip} showInteractiveTooltip={showInteractiveTooltip}
              scheduleTooltipClose={scheduleTooltipClose} />
            {/* Les 8 actions principales en hexagones, puis la fin du tour dans son propre cadre */}
            {!isRobot && (
              <PlayerActions game={game} playerId={currentPlayer.id} interactionState={interactionState} isInteractiveMode={isInteractiveMode}
                onAction={onAction} onNextPlayer={onNextPlayer} handleTooltipHover={handleTooltipHover} handleTooltipLeave={handleTooltipLeave} />
            )}
          </div>

          <div className="seti-player-section">
            <div className="seti-player-section-title">Exploration</div>
            <ExplorationTrack
              game={game}
              playerId={currentPlayer.id}
              handleTooltipHover={handleTooltipHover}
              handleTooltipLeave={handleTooltipLeave}
            />
          </div>

          {/* Observation Track */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Observation</div>
            <ObservationTrack
              game={game}
              playerId={currentPlayer.id}
              handleTooltipHover={handleTooltipHover}
              handleTooltipLeave={handleTooltipLeave}
            />
          </div>

          {/* Informatique (ordinateur de données) */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Informatique</div>
            <div className="seti-player-list seti-computer-list">
              <PlayerComputer 
                player={currentPlayer} 
                onSlotClick={handleComputerSlotClick}
                isSelecting={isSelectingComputerSlot && !isRobot}
                onColumnSelect={onComputerSlotSelect}
                isAnalyzing={isAnalyzing}
                disabled={isInteractiveMode || isRobot}
                onHover={handleTooltipHover}
                onLeave={handleTooltipLeave}
              />
            </div>
          </div>

          {/* Cartes */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Main</div>
            <div className="seti-player-list seti-cards-list seti-thin-scroll" ref={cardsListRef}>
              {!isRobot ? (
                handCards.length > 0 ? (
                  handCards.map(card => (
                    <HandCard
                        key={card.id}
                        card={card}
                        game={game}
                        currentPlayerId={currentPlayer.id}
                        interactionState={interactionState}
                        highlightedCardId={highlightedCardId}
                        setHighlightedCardId={setHighlightedCardId}
                        onCardClick={onCardClick}
                        onPlayCard={onPlayCard}
                        onDiscardCardAction={onDiscardCardAction}
                        handleTooltipHover={handleTooltipHover}
                        handleTooltipLeave={handleTooltipLeave}
                        renderActionButton={renderActionButton}
                        cardOrigin="hand"
                        isPlayableFocus={playableCardIds.includes(card.id)}
                    />
                  ))
                ) : (
                  <div className="seti-player-list-empty">Aucune carte en main</div>
                )
              ) : (
                // Main d'un robot : cartes révélées face visible, les autres de dos
                handCards.length > 0 ? (
                  <>
                    {handCards.filter(c => c.isRevealed).map(card => (
                      <HandCard
                        key={card.id}
                        card={card}
                        game={game}
                        currentPlayerId={currentPlayer.id}
                        interactionState={interactionState}
                        highlightedCardId={null}
                        setHighlightedCardId={() => {}}
                        onCardClick={() => {}}
                        onPlayCard={() => {}}
                        onDiscardCardAction={() => {}}
                        handleTooltipHover={handleTooltipHover}
                        handleTooltipLeave={handleTooltipLeave}
                        renderActionButton={() => null}
                        cardOrigin="hand"
                      />
                    ))}
                    {handCards.filter(c => !c.isRevealed).map(card => (
                      <CardBack key={card.id}
                        onMouseEnter={e => handleTooltipHover(e, <SlotTooltip status="Carte masquée" statusColor="#9fb2da" note={`Main de ${currentPlayer.name}`} />)}
                        onMouseLeave={handleTooltipLeave} />
                    ))}
                  </>
                ) : (
                  <div className="seti-player-list-empty">Aucune carte en main</div>
                )
              )}
            </div>
          </div>

          {/* Missions */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Mission</div>
            {/*isSelectingMission && !isRobot && (
              <div className="seti-cards-warning">
                Veuillez sélectionner une mission à accomplir.
                <br />
                Sélectionnées : {selectedMissionId ? 1 : 0} / 1
                <button className="seti-confirm-btn" onClick={onConfirmMissionClaim}>Confirmer</button>
                <button className="seti-cancel-btn" onClick={onCancelMissionClaim}>Annuler</button>
              </div>
            )*/}
            <div className="seti-player-list seti-cards-list seti-thin-scroll">
              {((currentPlayer.missions && currentPlayer.missions.length > 0) || (currentPlayer.playedCards && currentPlayer.playedCards.length > 0)) ? (
                <>
                {/* Mission conditionnelle et Mission déclenchable */}
                {(currentPlayer.missions || []).map((mission: Mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    game={game}
                    playerId={currentPlayer.id}
                    currentPlayerColor={currentPlayer.color || '#fff'}
                    isCurrentTurn={isCurrentTurn}
                    isRobot={isRobot}
                    isInteractiveMode={isInteractiveMode}
                    onMissionClick={onMissionClick}
                    handleTooltipHover={handleTooltipHover}
                    handleTooltipLeave={handleTooltipLeave}
                  />
                ))}
                {/* Fin de jeu et Centaurien */}
                {(currentPlayer.playedCards || []).map((card: Card) => (
                  // Carte Exertien d'un adversaire : jouée face cachée jusqu'au décompte final (règles)
                  card.type === CardType.EXERTIEN && currentPlayer.id !== viewerId && game.phase !== GamePhase.FINAL_SCORING ? (
                    <CardBack key={card.id}
                      onMouseEnter={e => handleTooltipHover(e, <SlotTooltip status="Carte Exertien face cachée" statusColor="#9fb2da" note="Révélée au décompte final" />)}
                      onMouseLeave={handleTooltipLeave} />
                  ) : <PlayedMissionCard
                    key={card.id}
                    card={card}
                    centaurienMarker={currentPlayer.centaurienMilestones.find(m => m.cardId === card.id)}
                    handleTooltipHover={handleTooltipHover}
                    handleTooltipLeave={handleTooltipLeave}
                  />
                ))}
                </>
              ) : (
                <div className="seti-player-list-empty">Aucune mission</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

/** Mémoïsé : redessiné seulement quand ses props changent (partie, interaction…), pas à chaque rendu de BoardUI */
export const PlayerBoardUI = React.memo(PlayerBoardUIView);
