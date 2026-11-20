import React, { useMemo } from 'react';
import { Game, ActionType, GAME_CONSTANTS, InteractionState } from '../../core/types';
import { ProbeSystem } from '../../systems/ProbeSystem';
import { TurnManager } from '../../engine/TurnManager';
import { ActionValidator, MainActionType } from '../../engine/ActionValidator';
import { requirePlayer } from '../../core/players';
import { ActionHexIcon, ActionIconKind, EndTurnIcon } from '../components/GameIcons';
import { ActionTooltip, ResourceSymbols, PieceSymbol, ScanSymbol, BlueTraceSymbol, CardCostSymbol, TechSymbol } from '../components/BoardTooltips';
import { TrackSlot } from './PlayerTracks';
import type { TutorialAction } from '../../tutorial/types';

/** Section Actions du plateau joueur (joueur humain) : les 8 actions principales en hexagones, puis la fin du tour */
export const PlayerActions: React.FC<{
  game: Game;
  playerId: string;
  interactionState: InteractionState;
  /** Mode de sélection ou interaction en cours : les actions attendent */
  isInteractiveMode: boolean;
  onAction: (actionType: ActionType) => void;
  onNextPlayer: () => void;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
  /** Tutoriel : raison pour laquelle l'étape en cours refuse une action (null : permise) */
  tutorialBlock?: (action: TutorialAction) => string | null;
}> = ({ game, playerId, interactionState, isInteractiveMode, onAction, onNextPlayer, handleTooltipHover, handleTooltipLeave, tutorialBlock }) => {
  const currentPlayer = requirePlayer(game, playerId);
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const hasPerformedMainAction = currentPlayer.hasPerformedMainAction;

  // Disponibilité des actions principales et raison d'un refus : calculées par le moteur
  const engineAvailability = useMemo(() => ActionValidator.mainActionAvailability(game, playerId), [game, playerId]);
  // Tutoriel : une action permise par les règles mais pas par l'étape en cours est désactivée, avec sa raison
  const tutorialReason = (action: TutorialAction) => tutorialBlock?.(action) ?? null;

  /** Raison qui empêche une action principale : moteur, puis étape du tutoriel, puis choix en cours sur le plateau */
  const blockReason = (actionType: MainActionType, interactionBlocks: boolean): string | null =>
    engineAvailability[actionType].reason
    ?? tutorialReason(actionType)
    ?? (interactionBlocks ? "Terminez d'abord l'action en cours" : null);

  // Infobulle d'une action principale : coût, bonus, puis action possible ou raison de l'indisponibilité
  const getActionTooltip = (actionType: MainActionType, reason: string | null): React.ReactNode => {
    let cost: React.ReactNode = '';
    let bonus: React.ReactNode | undefined = '';
    let action = '';
    let bonusLabel = 'Bonus';

    switch (actionType) {
      case ActionType.LAUNCH_PROBE:
        cost = <ResourceSymbols bonus={{ credits: GAME_CONSTANTS.PROBE_LAUNCH_COST }} />;
        bonus = <PieceSymbol kind="probe" label="Sonde" />;
        action = 'Cliquez pour lancer une sonde depuis la Terre';
        break;

      case ActionType.ORBIT:
        cost = <ResourceSymbols bonus={{ credits: GAME_CONSTANTS.ORBIT_COST_CREDITS, energy: GAME_CONSTANTS.ORBIT_COST_ENERGY }} />;
        bonus = <PieceSymbol kind="orbiter" label="Orbiteur" />;
        action = 'Cliquez pour mettre une sonde en orbite';
        break;

      case ActionType.LAND: {
        bonus = <PieceSymbol kind="lander" label="Atterrisseur" />;
        action = 'Cliquez pour poser une sonde sur une planète';
        // Coût courant (moteur) : celui de la planète où se trouve la sonde, sinon le coût de base ; réductions rappelées
        const planetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);
        const hasExploration3 = currentPlayer.technologies.some(t => t.id.startsWith('exploration-3'));
        const reductions = [planetInfo.hasOrbiter && 'orbiteur présent', hasExploration3 && 'Exploration III'].filter(Boolean);
        cost = <ResourceSymbols bonus={{ energy: ProbeSystem.currentLandCost(game, currentPlayer.id) }} note={reductions.length > 0 ? reductions.join(', ') : undefined} />;
        break;
      }

      case ActionType.SCAN_SECTOR:
        cost = <ResourceSymbols bonus={{ credits: GAME_CONSTANTS.SCAN_COST_CREDITS, energy: GAME_CONSTANTS.SCAN_COST_ENERGY }} />;
        bonus = <ScanSymbol />;
        action = 'Cliquez pour scanner';
        break;

      case ActionType.ANALYZE_DATA:
        cost = <ResourceSymbols bonus={{ energy: GAME_CONSTANTS.ANALYZE_COST_ENERGY }} />;
        bonus = <BlueTraceSymbol />;
        action = 'Cliquez pour analyser les données';
        break;

      case ActionType.RESEARCH_TECH:
        cost = <ResourceSymbols bonus={{ media: GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA }} />;
        // Le Système solaire tourne avant de prendre la technologie
        bonus = <><ResourceSymbols bonus={{ rotation: 1 }} /><TechSymbol /></>;
        action = 'Cliquez pour rechercher une technologie';
        break;

      case ActionType.PASS:
        // Pas de coût : une seule ligne Effet, les 3 étapes de la passe
        cost = undefined;
        bonusLabel = 'Effet';
        bonus = (
          <ol className="seti-board-tooltip-steps">
            <li>Défaussez des cartes pour n'en conserver que 4</li>
            <li><ResourceSymbols bonus={{ rotation: 1 }} /> si vous êtes premier à passer</li>
            <li>Choisissez une carte de Fin de manche</li>
          </ol>
        );
        action = 'Cliquez pour passer';
        break;

      case ActionType.PLAY_CARD:
        // Pas de ligne Bonus : les effets dépendent de la carte
        bonus = undefined;
        action = 'Cliquez pour jouer une carte de votre main';
        cost = <CardCostSymbol />;
        break;
    }

    return <ActionTooltip title={actionType} cost={cost} bonus={bonus} bonusLabel={bonusLabel} available={!reason} hint={reason ?? action} />;
  };

  // Une interaction obligatoire en cours (ex : technologie à choisir) empêche de finir le tour ou de passer
  const interactionBlocks = isInteractiveMode || TurnManager.blocksEndOfTurn(interactionState);
  const canEndTurn = isCurrentTurn && hasPerformedMainAction && !interactionBlocks && !tutorialReason('END_TURN');
  let endTurnReason = "Terminez d'abord l'action en cours";
  if (!isCurrentTurn) endTurnReason = "Ce n'est pas votre tour";
  else if (!hasPerformedMainAction) endTurnReason = "Effectuez d'abord une action principale";
  else if (tutorialReason('END_TURN')) endTurnReason = tutorialReason('END_TURN')!;
  const endTurnTooltip = <ActionTooltip title="Fin du tour" bonusLabel="Effet" bonus={
    // Comme pour Passer : les étapes de la fin du tour, dans l'ordre
    <ol className="seti-board-tooltip-steps">
      <li>Appliquer les paliers de score</li>
      <li>Appliquer la découverte d'espèces</li>
    </ol>
  }
    available={canEndTurn} hint={canEndTurn ? 'Cliquez pour terminer votre tour' : endTurnReason} />;
  const mainActions: [ActionIconKind, MainActionType][] = [
    ['launch', ActionType.LAUNCH_PROBE], ['orbit', ActionType.ORBIT], ['land', ActionType.LAND], ['scan', ActionType.SCAN_SECTOR],
    ['analyze', ActionType.ANALYZE_DATA], ['card', ActionType.PLAY_CARD], ['research', ActionType.RESEARCH_TECH], ['pass', ActionType.PASS],
  ];
  return (
    <div className="seti-player-section" data-tutorial="actions">
      <div className="seti-player-section-title">Actions</div>
      <div className="seti-main-actions-row">
      <div className="seti-main-actions">
      {mainActions.map(([kind, actionType]) => {
        // Passer attend aussi la fin d'une interaction obligatoire ; les autres actions, la fin d'un mode de sélection
        const reason = blockReason(actionType, actionType === ActionType.PASS ? interactionBlocks : isInteractiveMode);
        const available = !reason;
        return (
          <TrackSlot key={actionType} icon={<ActionHexIcon kind={kind} size={42} />} hex label={actionType} tooltip={getActionTooltip(actionType, reason)}
            clickable={available} flash={available} disabled={!available} onClick={() => onAction(actionType)}
            onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
        );
      })}
      </div>
      <div className="seti-main-actions" data-tutorial="end-turn">
        <TrackSlot icon={<EndTurnIcon size={42} />} hex label="Prochain joueur" tooltip={endTurnTooltip} clickable={canEndTurn} flash={canEndTurn} disabled={!canEndTurn}
          onClick={() => onNextPlayer && onNextPlayer()} onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
      </div>
      </div>
    </div>
  );
};
