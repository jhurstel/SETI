import React from 'react';
import { Game, ActionType, GAME_CONSTANTS, ProbeState, InteractionState } from '../../core/types';
import { ProbeSystem } from '../../systems/ProbeSystem';
import { ComputerSystem } from '../../systems/ComputerSystem';
import { CardSystem } from '../../systems/CardSystem';
import { ScanSystem } from '../../systems/ScanSystem';
import { TurnManager } from '../../engine/TurnManager';
import { requirePlayer } from '../../core/players';
import { ActionHexIcon, ActionIconKind, EndTurnIcon } from '../components/GameIcons';
import { ActionTooltip, ResourceSymbols, PieceSymbol, ScanSymbol, BlueTraceSymbol, CardCostSymbol, TechSymbol } from '../components/BoardTooltips';
import { TrackSlot } from './PlayerTracks';

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
}> = ({ game, playerId, interactionState, isInteractiveMode, onAction, onNextPlayer, handleTooltipHover, handleTooltipLeave }) => {
  const currentPlayer = requirePlayer(game, playerId);
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const hasPerformedMainAction = currentPlayer.hasPerformedMainAction;

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: isCurrentTurn && !hasPerformedMainAction && ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.ORBIT]: isCurrentTurn && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: isCurrentTurn && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: isCurrentTurn && !hasPerformedMainAction && ScanSystem.canScanSector(game, currentPlayer.id).canScan,
    [ActionType.ANALYZE_DATA]: isCurrentTurn && !hasPerformedMainAction && ComputerSystem.canAnalyzeData(game, currentPlayer.id).canAnalyze,
    [ActionType.PLAY_CARD]: isCurrentTurn && !hasPerformedMainAction && CardSystem.canPlayCards(game, currentPlayer.id).canPlay,
    [ActionType.RESEARCH_TECH]: isCurrentTurn && !hasPerformedMainAction && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA,
    [ActionType.PASS]: isCurrentTurn && !hasPerformedMainAction,
    [ActionType.MOVE_PROBE]: false,
    [ActionType.TRANSFERE_DATA]: false,
    [ActionType.DISCARD_CARD]: false,
    [ActionType.ACCOMPLISH_MISSION]: false,
    [ActionType.BUY_CARD]: false,
    [ActionType.TRADE_RESOURCES]: false,
  };

  // Infobulle d'une action principale : coût, bonus, puis action possible ou raison de l'indisponibilité
  const getActionTooltip = (actionType: ActionType, available: boolean): React.ReactNode => {
    const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);
    let cost: React.ReactNode = '';
    let bonus: React.ReactNode | undefined = '';
    let action = '';
    let bonusLabel = 'Bonus';
    let reason: string | undefined;

    switch (actionType) {
      case ActionType.LAUNCH_PROBE: {
        cost = <ResourceSymbols bonus={{ credits: GAME_CONSTANTS.PROBE_LAUNCH_COST }} />;
        bonus = <PieceSymbol kind="probe" label="Sonde" />;
        action = 'Cliquez pour lancer une sonde depuis la Terre';
        const launchCheck = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
        if (!launchCheck.canLaunch) reason = launchCheck.reason || 'Impossible de lancer une sonde';
        break;
      }

      case ActionType.ORBIT: {
        cost = <ResourceSymbols bonus={{ credits: GAME_CONSTANTS.ORBIT_COST_CREDITS, energy: GAME_CONSTANTS.ORBIT_COST_ENERGY }} />;
        bonus = <PieceSymbol kind="orbiter" label="Orbiteur" />;
        action = 'Cliquez pour mettre une sonde en orbite';
        const orbitProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!orbitProbe) reason = 'Nécessite une sonde dans le système solaire';
        else {
          const orbitCheck = ProbeSystem.canOrbit(game, currentPlayer.id, orbitProbe.id);
          if (!orbitCheck.canOrbit) reason = orbitCheck.reason || 'Impossible';
        }
        break;
      }

      case ActionType.LAND: {
        bonus = <PieceSymbol kind="lander" label="Atterrisseur" />;
        action = 'Cliquez pour poser une sonde sur une planète';
        // Coût courant : celui de la planète où se trouve la sonde, sinon le coût de base (réduit par Exploration III)
        const hasExploration3 = currentPlayer.technologies.some(t => t.id.startsWith('exploration-3'));
        const landCost = hasProbeOnPlanetInfo.landCost ?? (hasExploration3 ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY : GAME_CONSTANTS.LAND_COST_ENERGY);
        const reductions = [hasProbeOnPlanetInfo.hasOrbiter && 'orbiteur présent', hasExploration3 && 'Exploration III'].filter(Boolean);
        cost = <ResourceSymbols bonus={{ energy: landCost }} note={reductions.length > 0 ? reductions.join(', ') : undefined} />;
        const landProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!landProbe) reason = 'Nécessite une sonde dans le système solaire';
        else {
          const landCheck = ProbeSystem.canLand(game, currentPlayer.id, landProbe.id);
          if (!landCheck.canLand) reason = landCheck.reason || 'Impossible';
        }
        break;
      }

      case ActionType.SCAN_SECTOR:
        cost = <ResourceSymbols bonus={{ credits: GAME_CONSTANTS.SCAN_COST_CREDITS, energy: GAME_CONSTANTS.SCAN_COST_ENERGY }} />;
        bonus = <ScanSymbol />;
        action = 'Cliquez pour scanner';
        if (currentPlayer.credits < GAME_CONSTANTS.SCAN_COST_CREDITS || currentPlayer.energy < GAME_CONSTANTS.SCAN_COST_ENERGY) reason = `Vous avez ${currentPlayer.credits} crédit(s) et ${currentPlayer.energy} énergie(s)`;
        break;

      case ActionType.ANALYZE_DATA:
        cost = <ResourceSymbols bonus={{ energy: GAME_CONSTANTS.ANALYZE_COST_ENERGY }} />;
        bonus = <BlueTraceSymbol />;
        action = 'Cliquez pour analyser les données';
        if (!currentPlayer.dataComputer.canAnalyze) reason = "Ligne du haut de l'ordinateur incomplète";
        else if (currentPlayer.energy < 1) reason = `Vous avez ${currentPlayer.energy} énergie`;
        break;

      case ActionType.RESEARCH_TECH:
        cost = <ResourceSymbols bonus={{ media: GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA }} />;
        // Le Système solaire tourne avant de prendre la technologie
        bonus = <><ResourceSymbols bonus={{ rotation: 1 }} /><TechSymbol /></>;
        action = 'Cliquez pour rechercher une technologie';
        if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) reason = `Vous avez ${currentPlayer.mediaCoverage} média(s)`;
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

      case ActionType.PLAY_CARD: {
        // Pas de ligne Bonus : les effets dépendent de la carte
        bonus = undefined;
        action = 'Cliquez pour jouer une carte de votre main';
        cost = <CardCostSymbol />;
        const cardCheck = CardSystem.canPlayCards(game, currentPlayer.id);
        if (!cardCheck.canPlay) reason = cardCheck.reason || 'Impossible';
        break;
      }
    }

    // Les raisons générales passent avant celles propres à l'action
    if (!isCurrentTurn) reason = "Ce n'est pas votre tour";
    else if (hasPerformedMainAction) reason = 'Action principale déjà effectuée';
    else if (!reason && !available) reason = "Terminez d'abord l'action en cours";

    return <ActionTooltip title={actionType} cost={cost} bonus={bonus} bonusLabel={bonusLabel} available={available} hint={available ? action : reason} />;
  };

  // Une interaction obligatoire en cours (ex : technologie à choisir) empêche de finir le tour ou de passer
  const interactionBlocks = isInteractiveMode || TurnManager.blocksEndOfTurn(interactionState);
  const canEndTurn = isCurrentTurn && hasPerformedMainAction && !interactionBlocks;
  let endTurnReason = "Terminez d'abord l'action en cours";
  if (!isCurrentTurn) endTurnReason = "Ce n'est pas votre tour";
  else if (!hasPerformedMainAction) endTurnReason = "Effectuez d'abord une action principale";
  const endTurnTooltip = <ActionTooltip title="Fin du tour" bonusLabel="Effet" bonus="Les paliers de score sont vérifiés"
    available={canEndTurn} hint={canEndTurn ? 'Cliquez pour terminer votre tour' : endTurnReason} />;
  const canPass = actionAvailability[ActionType.PASS] && !interactionBlocks;
  const mainActions: [ActionIconKind, ActionType][] = [
    ['launch', ActionType.LAUNCH_PROBE], ['orbit', ActionType.ORBIT], ['land', ActionType.LAND], ['scan', ActionType.SCAN_SECTOR],
    ['analyze', ActionType.ANALYZE_DATA], ['card', ActionType.PLAY_CARD], ['research', ActionType.RESEARCH_TECH], ['pass', ActionType.PASS],
  ];
  return (
    <div className="seti-player-section">
      <div className="seti-player-section-title">Actions</div>
      <div className="seti-main-actions-row">
      <div className="seti-main-actions">
      {mainActions.map(([kind, actionType]) => {
        const available = actionType === ActionType.PASS ? canPass : actionAvailability[actionType] && !isInteractiveMode;
        return (
          <TrackSlot key={actionType} icon={<ActionHexIcon kind={kind} size={42} />} hex label={actionType} tooltip={getActionTooltip(actionType, available)}
            clickable={available} flash={available} onClick={() => onAction(actionType)}
            onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
        );
      })}
      </div>
      <div className="seti-main-actions">
        <TrackSlot icon={<EndTurnIcon size={42} />} hex label="Prochain joueur" tooltip={endTurnTooltip} clickable={canEndTurn} flash={canEndTurn}
          onClick={() => onNextPlayer && onNextPlayer()} onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
      </div>
      </div>
    </div>
  );
};
