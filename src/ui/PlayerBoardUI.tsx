import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, ActionType, GAME_CONSTANTS, ProbeState, Card, Mission, InteractionState, CardType, SectorType, Bonus } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ComputerSystem } from '../systems/ComputerSystem'; 
import { CardSystem } from '../systems/CardSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { TurnManager } from '../core/TurnManager';
import { PlayerComputer } from './components/PlayerComputer';
import { HandCard } from './components/HandCard';
import { CardBack } from './components/CardBack';
import { MissionCard } from './components/MissionCard';
import { PlayedMissionCard } from './components/PlayedMissionCard';
import { TechSpot } from './components/TechSpot';
import { ActionHexIcon, ActionIconKind, SignalIcon, ResourceIcon, VictoryPointsIcon, EndTurnIcon } from './components/GameIcons';
import { SlotTooltip } from './components/SlotTooltip';
import { ActionTooltip, TechTooltip, ResourceSymbols, PieceSymbol, ScanSymbol, BlueTraceSymbol, CardCostSymbol, TechSymbol, DiscardSymbol } from './components/BoardTooltips';
import { ReservationIcon } from './components/ObjectiveSymbol';
import { HoverTooltip } from './components/HoverTooltip';
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

/** Emplacement d'une piste du plateau joueur (exploration, observation) ; dans un cadre s'il reçoit une technologie */
const TrackSlot: React.FC<{
  /** Pictogramme (null : emplacement de technologie sans pastille, la tuile du cadre suffit) */
  icon: React.ReactNode;
  tooltip: React.ReactNode;
  clickable?: boolean;
  onClick?: () => void;
  /** Étape débloquée par une technologie (grisée tant qu'elle n'est pas acquise) */
  tech?: { acquired: boolean };
  /** Emplacement de technologie : cadre TechSpot, avec la tuile de la technologie en fond */
  techFrame?: { acquired: boolean, tile?: string };
  /** Infobulle du cadre de technologie, hors de la pastille (qui garde la sienne) */
  frameTooltip?: React.ReactNode;
  /** Hexagone d'action principale : pas de pastille ronde derrière */
  hex?: boolean;
  flash?: boolean;
  /** Nom accessible (emplacement d'action) */
  label?: string;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}> = ({ icon, tooltip, clickable, onClick, tech, techFrame, frameTooltip, flash, label, hex, onHover, onLeave }) => {
  let className = 'obs-track-slot';
  if (hex) className += ' hex';
  if (icon === null) className += ' ghost';
  if (tech) className += tech.acquired ? ' tech-acquired' : ' tech-locked';
  if (clickable) className += ' clickable';
  if (flash) className += ' seti-flash-green';
  const slot = (
    <div
      className={className}
      role={label ? 'button' : undefined}
      aria-label={label}
      aria-disabled={label ? !clickable : undefined}
      onClick={() => clickable && onClick ? onClick() : null}
      onMouseEnter={(e) => onHover(e, tooltip)}
      onMouseLeave={onLeave}
    >
      {icon}
    </div>
  );
  // Survol du cadre hors de la pastille : infobulle de la technologie
  const onFrameOver = frameTooltip ? (e: React.MouseEvent) => {
    if (!(e.target as Element).closest('.obs-track-slot')) onHover(e, frameTooltip);
  } : undefined;
  return techFrame
    ? <TechSpot acquired={techFrame.acquired} tile={techFrame.tile} onMouseOver={onFrameOver} onMouseLeave={frameTooltip ? onLeave : undefined}>{slot}</TechSpot>
    : slot;
};

interface ExplorationTrackProps {
  game: Game;
  playerId: string;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

/** Piste Exploration : les emplacements des technologies Exploration I à IV (les actions sont dans la section Actions) */
const ExplorationTrack: React.FC<ExplorationTrackProps> = ({ game, playerId, handleTooltipHover, handleTooltipLeave }) => {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const hasTech = (level: number) => player.technologies.some(t => t.id.startsWith(`exploration-${level}`));
  // Pouvoir sans la technologie, puis ce qu'elle apporte
  const techSlot = (base: React.ReactNode, benefit: React.ReactNode, level: number, roman: string) => (
    <TrackSlot icon={null} tooltip={<TechTooltip name={`Exploration ${roman}`} acquired={hasTech(level)} base={base} benefit={benefit} />}
      techFrame={{ acquired: hasTech(level), tile: `exploration-${level}` }}
      onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
  );
  // Les quatre emplacements de technologie Exploration, espacés régulièrement
  return (
    <div className="obs-track-container evenly">
      {techSlot(<>1 <PieceSymbol kind="probe" label="Sonde" /> dans le système solaire</>,
        <>Jusqu'à 2 <PieceSymbol kind="probe" label="Sonde" /> dans le système solaire</>, 1, 'I')}
      {techSlot(<>Quitter un champ d'astéroïdes : <ResourceSymbols bonus={{ movements: 1 }} /> de plus</>,
        <>Champ d'astéroïdes : <ResourceSymbols bonus={{ media: 1 }} />, sortie sans surcoût</>, 2, 'II')}
      {techSlot(<>Atterrir : <ResourceSymbols bonus={{ energy: GAME_CONSTANTS.LAND_COST_ENERGY }} />, 1 de moins avec un orbiteur</>,
        <>Atterrir : <ResourceSymbols bonus={{ energy: 1 }} /> de moins</>, 3, 'III')}
      {techSlot(<><PieceSymbol kind="lander" label="Atterrisseur" /> sur les planètes seulement</>,
        <><PieceSymbol kind="lander" label="Atterrisseur" /> aussi sur les lunes</>, 4, 'IV')}
    </div>
  );
};

interface ObservationTrackProps {
  game: Game;
  playerId: string;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

const ObservationTrack: React.FC<ObservationTrackProps> = ({ game, playerId, handleTooltipHover, handleTooltipLeave }) => {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const hasObs1 = player.technologies.some(t => t.id.startsWith('observation-1'));
  const hasObs2 = player.technologies.some(t => t.id.startsWith('observation-2'));
  const hasObs3 = player.technologies.some(t => t.id.startsWith('observation-3'));
  const hasObs4 = player.technologies.some(t => t.id.startsWith('observation-4'));

  const renderSlot = (
    icon: React.ReactNode,
    tooltip: React.ReactNode,
    isClickable: boolean,
    onClick?: () => void,
    isTech: boolean = false,
    techAcquired: boolean = false,
    isAvailableForAction: boolean = false,
    techFrame?: { acquired: boolean, tile?: string },
    label?: string,
    hex?: boolean
  ) => (
    <TrackSlot icon={icon} label={label} hex={hex} tooltip={tooltip} clickable={isClickable} onClick={onClick} tech={isTech ? { acquired: techAcquired } : undefined}
      techFrame={techFrame} flash={isAvailableForAction} onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
  );

  // Étape du scan sans technologie : effectuée à chaque scan
  const stepTooltip = (title: string, bonus: React.ReactNode) => <ActionTooltip title={title} bonus={bonus} hint="Effectué à chaque scan" />;
  // Étape d'une technologie Observation : pouvoir du scan sans elle, puis ce qu'elle ajoute
  const obsTooltip = (roman: string, acquired: boolean, base: React.ReactNode, benefit: React.ReactNode) =>
    <TechTooltip name={`Observation ${roman}`} acquired={acquired} base={base} benefit={benefit} />;

  // Étapes du scan (l'action est dans la section Actions), reliées par des lignes de même longueur qui s'arrêtent au bord des cadres ;
  // les technologies II à IV n'ont que leur tuile
  return (
    <div className="obs-track-container evenly">
      {/* Étape de la Terre : la pastille (sans Observation I) a l'infobulle de l'étape, le cadre celle de la technologie */}
      {(() => {
        const obs1Tooltip = obsTooltip('I', hasObs1, <><ResourceSymbols bonus={{ signals: [{ amount: 1, scope: SectorType.EARTH }] }} /> dans le secteur de la Terre</>,
          <><ResourceSymbols bonus={{ signals: [{ amount: 1, scope: SectorType.EARTH }] }} /> Terre ou secteur adjacent</>);
        return hasObs1
          ? <TrackSlot icon={null} tooltip={obs1Tooltip} techFrame={{ acquired: true, tile: 'observation-1' }} onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
          : <TrackSlot icon={<SignalIcon badge="earth" size={30} />} tooltip={stepTooltip('Terre', <ResourceSymbols bonus={{ signals: [{ amount: 1, scope: SectorType.EARTH }] }} />)}
              techFrame={{ acquired: false, tile: 'observation-1' }} frameTooltip={obs1Tooltip} onHover={handleTooltipHover} onLeave={handleTooltipLeave} />;
      })()}
      <div className="obs-track-connector into-left" />
      {renderSlot(<SignalIcon badge="card" size={30} />, stepTooltip('Carte de la rangée', <ResourceSymbols bonus={{ signals: [{ amount: 1, scope: SectorType.ROW }] }} note="la carte est défaussée" />), false)}
      <div className="obs-track-connector into-right" />
      {renderSlot(null, obsTooltip('II', hasObs2, <>Pas de <ResourceSymbols bonus={{ signals: [{ amount: 1, scope: SectorType.MERCURY }] }} /></>,
        <><ResourceSymbols bonus={{ media: 1 }} /> : <ResourceSymbols bonus={{ signals: [{ amount: 1, scope: SectorType.MERCURY }] }} /></>), false, undefined, false, false, false, { acquired: hasObs2, tile: 'observation-2' })}
      <div className="obs-track-connector into-left into-right" />
      {renderSlot(null, obsTooltip('III', hasObs3, 'Pas de signal pour une carte de la main',
        <><DiscardSymbol /> : <ResourceSymbols bonus={{ signals: [{ amount: 1, scope: SectorType.ANY }] }} /> dans son secteur</>), false, undefined, false, false, false, { acquired: hasObs3, tile: 'observation-3' })}
      <div className="obs-track-connector into-left into-right" />
      {renderSlot(null, obsTooltip('IV', hasObs4, 'Rien de plus après les signaux',
        <><ResourceSymbols bonus={{ energy: 1 }} /> : <PieceSymbol kind="probe" label="Sonde" />, ou <ResourceSymbols bonus={{ movements: 1 }} /></>), false, undefined, false, false, false, { acquired: hasObs4, tile: 'observation-4' })}
    </div>
  );
};

export const PlayerBoardUI: React.FC<PlayerBoardUIProps> = ({ game, playerId, interactionState, onViewPlayer, onAction, onCardClick, onDiscardCardAction, onPlayCard, onBuyCardAction, onTradeCardAction, onTransferData, onComputerSlotSelect, onNextPlayer, onDirectTradeAction, setActiveTooltip, onSettingsClick, onDocumentationClick, onMissionClick, onConfirmAction, highlightPlayableCards = false, remoteHumanIds = [] }) => {
  const currentPlayer = playerId 
    ? (game.players.find(p => p.id === playerId) || game.players[game.currentPlayerIndex])
    : game.players[game.currentPlayerIndex];
  
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const isRobot = currentPlayer.type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  const hasPerformedMainAction = currentPlayer.hasPerformedMainAction;
  const isDiscarding = interactionState.type === 'DISCARDING_CARD';
  const isTrading = interactionState.type === 'TRADING_CARD';
  const isReserving = interactionState.type === 'RESERVING_CARD';
  const isDiscardingForSignal = interactionState.type === 'DISCARDING_FOR_SIGNAL';
  const isSelectingComputerSlot = interactionState.type === 'SELECTING_COMPUTER_SLOT';
  const isAnalyzing = interactionState.type === 'ANALYZING';
  const isPlacingLifeTrace = interactionState.type === 'PLACING_LIFE_TRACE';
  const isSelectingSector = interactionState.type === 'SELECTING_SCAN_SECTOR' || interactionState.type === 'SELECTING_SCAN_CARD';



  const handCards = currentPlayer.cards.filter(c => c.type !== CardType.EXERTIEN);
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

  // Suivi des changements de ressources pour la notification sur les onglets
  const [tabFlashes, setTabFlashes] = useState<Record<string, boolean>>({});
  const prevResourcesRef = useRef<Record<string, { credits: number, energy: number, media: number, data: number, cards: number }>>({});

  useEffect(() => {
    const newFlashes: Record<string, boolean> = {};
    let hasChanges = false;

    game.players.forEach(p => {
      const prev = prevResourcesRef.current[p.id];
      const current = { credits: p.credits, energy: p.energy, media: p.mediaCoverage, data: p.data || 0, cards: p.cards.filter(c => c.type !== CardType.EXERTIEN).length };
      
      if (prev) {
        if (current.credits > prev.credits || current.energy > prev.energy || current.media > prev.media || current.data > prev.data || current.cards > prev.cards) {
           // Si ce joueur n'est pas celui actuellement affiché, faire clignoter l'onglet
           if (p.id !== currentPlayer.id) {
             newFlashes[p.id] = true;
             hasChanges = true;
           }
        }
      }
      prevResourcesRef.current[p.id] = current;
    });

    if (hasChanges) {
      setTabFlashes(prev => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setTabFlashes({});
      }, 1000);
      return () => clearTimeout(timer);
    }
    return;
  }, [game, currentPlayer.id]);

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

  // Hook personnalisé pour gérer les flashs de ressources
  const useResourceFlash = (value: number, playerId: string) => {
    const [flash, setFlash] = useState<{ type: 'gain' | 'loss'; id: number } | null>(null);
    const prevValueRef = useRef<number>(null);
    const prevPlayerIdRef = useRef<string>(null);

    useEffect(() => {
      const prevPlayerId = prevPlayerIdRef.current;
      const prevValue = prevValueRef.current;

      if (prevPlayerId === playerId && prevValue !== undefined && value !== prevValue) {
        setFlash({
          type: prevValue && value > prevValue ? 'gain' : 'loss',
          id: Date.now() + Math.random(),
        });
        const timer = setTimeout(() => setFlash(null), 600);
        return () => clearTimeout(timer);
      }
      return;
    }, [value, playerId]);

    // Mettre à jour les refs après l'effet principal pour la prochaine comparaison
    useEffect(() => {
      prevValueRef.current = value;
      prevPlayerIdRef.current = playerId;
    });

    return flash;
  };

  const mediaFlash = useResourceFlash(currentPlayer.mediaCoverage, currentPlayer.id);
  const creditFlash = useResourceFlash(currentPlayer.credits, currentPlayer.id);
  const energyFlash = useResourceFlash(currentPlayer.energy, currentPlayer.id);
  const revenueCreditFlash = useResourceFlash(currentPlayer.revenueCredits, currentPlayer.id);
  const revenueEnergyFlash = useResourceFlash(currentPlayer.revenueEnergy, currentPlayer.id);
  const revenueCardFlash = useResourceFlash(currentPlayer.revenueCards, currentPlayer.id);
  const dataFlash = useResourceFlash(currentPlayer.data, currentPlayer.id);
  const scoreFlash = useResourceFlash(currentPlayer.score, currentPlayer.id);
  const cardsFlash = useResourceFlash(handCards.length, currentPlayer.id);

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: isCurrentTurn && !isRobot && !hasPerformedMainAction && ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.ORBIT]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: isCurrentTurn && !isRobot && !hasPerformedMainAction && ScanSystem.canScanSector(game, currentPlayer.id).canScan,
    [ActionType.ANALYZE_DATA]: isCurrentTurn && !isRobot && !hasPerformedMainAction && ComputerSystem.canAnalyzeData(game, currentPlayer.id).canAnalyze,
    [ActionType.PLAY_CARD]: isCurrentTurn && !isRobot && !hasPerformedMainAction && CardSystem.canPlayCards(game, currentPlayer.id).canPlay,
    [ActionType.RESEARCH_TECH]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA,
    [ActionType.PASS]: isCurrentTurn && !isRobot && !hasPerformedMainAction,
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
    let bonus: React.ReactNode = '';
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
        cost = <ResourceSymbols bonus={{ energy: GAME_CONSTANTS.ANALYZE_COST_ENERGY }} note="et les données de l'ordinateur" />;
        bonus = <BlueTraceSymbol />;
        action = 'Cliquez pour analyser les données';
        if (!currentPlayer.dataComputer.canAnalyze) reason = "Ligne du haut de l'ordinateur incomplète";
        else if (currentPlayer.energy < 1) reason = `Vous avez ${currentPlayer.energy} énergie`;
        break;

      case ActionType.RESEARCH_TECH:
        cost = <ResourceSymbols bonus={{ media: GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA }} />;
        bonus = <TechSymbol note="puis le système solaire tourne" />;
        action = 'Cliquez pour rechercher une technologie';
        if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) reason = `Vous avez ${currentPlayer.mediaCoverage} média(s)`;
        break;

      case ActionType.PASS:
        cost = 'Garder au plus 4 cartes en main';
        bonusLabel = 'Effet';
        bonus = 'Une carte de fin de manche ; vous ne jouez plus avant la prochaine manche';
        action = 'Cliquez pour passer';
        break;

      case ActionType.PLAY_CARD: {
        bonus = 'Les effets de la carte';
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

  // Actions gratuites d'une ressource (échanges, achat d'une carte), proposées dans son infobulle
  type FreeAction = {
    key: string; title: string; spend: TradeKind; spendAmount: number; gain: TradeKind; gainAmount: number; note?: string;
    available: boolean; lacking: string; onClick: () => void;
  };
  type TradeKind = 'credit' | 'energy' | 'card' | 'media';
  const TRADE_BONUS: Record<TradeKind, keyof Bonus> = { credit: 'credits', energy: 'energy', card: 'card', media: 'media' };
  const tradeBonus = (kind: TradeKind, amount: number): Bonus => ({ [TRADE_BONUS[kind]]: amount });
  const freeActionReason = (lacking: string) => !isCurrentTurn ? "Ce n'est pas votre tour" : isInteractiveMode ? "Terminez d'abord l'action en cours" : lacking;
  const trade = (spend: 'credit' | 'energy', gain: 'credit' | 'energy' | 'card'): FreeAction => {
    const have = spend === 'credit' ? currentPlayer.credits : currentPlayer.energy;
    return {
      key: `${spend}-${gain}`, title: 'Échanger', spend, spendAmount: 2, gain, gainAmount: 1, available: isCurrentTurn && !isInteractiveMode && have >= 2,
      lacking: `Vous avez ${have} ${spend === 'credit' ? 'crédit(s)' : 'énergie(s)'}`, onClick: () => onDirectTradeAction && onDirectTradeAction(spend, gain),
    };
  };
  const cardTrade = (gain: 'credit' | 'energy'): FreeAction => ({
    key: `card-${gain}`, title: 'Échanger des cartes', spend: 'card', spendAmount: 2, gain, gainAmount: 1, note: 'cartes de la main au choix',
    available: isCurrentTurn && !isInteractiveMode && handCards.length >= 2,
    lacking: `Vous avez ${handCards.length} carte(s) en main`, onClick: () => onTradeCardAction && onTradeCardAction(gain),
  });
  const buyCard: FreeAction = {
    key: 'buy-card', title: 'Acheter une carte', spend: 'media', spendAmount: 3, gain: 'card', gainAmount: 1, note: 'rangée ou pioche',
    available: isCurrentTurn && !isInteractiveMode && currentPlayer.mediaCoverage >= 3,
    lacking: `Vous avez ${currentPlayer.mediaCoverage} média(s)`, onClick: () => onBuyCardAction && onBuyCardAction(),
  };
  // Actions gratuites d'une ressource : boutons à icônes seules, chacun avec une infobulle d'action (coût, bonus, clic ou raison)
  const resourceTooltip = (status: string, color: string, note: string, actions: FreeAction[]) => (
    <div className="seti-resource-tooltip">
      <SlotTooltip status={status} statusColor={color} note={note} />
      {!isRobot && actions.length > 0 && (
        <div className="seti-resource-tooltip-actions">
          <div className="seti-resource-tooltip-actions-title">Actions gratuites</div>
          <div className="seti-resource-tooltip-action-row">
            {actions.map(action => (
              <HoverTooltip key={action.key} nested content={
                <ActionTooltip title={action.title} cost={<ResourceSymbols bonus={tradeBonus(action.spend, action.spendAmount)} />}
                  bonus={<ResourceSymbols bonus={tradeBonus(action.gain, action.gainAmount)} note={action.note} />}
                  available={action.available} hint={action.available ? (action.key === 'buy-card' ? 'Cliquez pour acheter' : 'Cliquez pour échanger') : freeActionReason(action.lacking)} />
              }>
                <button
                  type="button"
                  className="seti-resource-tooltip-action"
                  aria-label={action.title}
                  aria-disabled={!action.available}
                  onClick={() => { if (!action.available) return; setActiveTooltip(null); action.onClick(); }}
                >
                  <ResourceIcon kind={action.spend} amount={action.spendAmount} size={18} />
                  <span aria-hidden="true">→</span>
                  <ResourceIcon kind={action.gain} amount={action.gainAmount} size={18} />
                </button>
              </HoverTooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="seti-player-board-container">
      {/* Onglets des joueurs */}
      <div className="seti-player-tabs">
        {game.players.map((p, index) => {
           const isViewed = p.id === currentPlayer.id;
           const isActive = p.id === game.players[game.currentPlayerIndex].id;
           const isFirstPlayer = index === game.firstPlayerIndex;
           const shouldFlash = tabFlashes[p.id];

           return (
             <div 
               key={p.id}
               className={`seti-player-tab ${isActive ? 'active' : 'inactive'}`}
               onClick={() => onViewPlayer && onViewPlayer(p.id)}
               style={{
                 backgroundColor: shouldFlash ? '#4caf50' : (isViewed ? (p.color || '#444') : '#2a2a2a'),
                 borderBottom: isViewed ? `1px solid ${p.color || '#444'}` : '1px solid #555',
                 opacity: isViewed ? 1 : 0.7,
               }}
             >
               {p.type === 'robot' && !remoteHumanIds.includes(p.id) ? '🤖' : '👤'} {p.name}
               {isFirstPlayer && <span>👑</span>}
               {isActive && <span className="seti-player-tab-indicator"></span>}
             </div>
           );
        })}
        <button
            onClick={onDocumentationClick}
            className="seti-action-btn"
            style={{ marginLeft: 'auto', marginRight: '2px', fontSize: '1.2rem', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', alignSelf: 'center' }}
            onMouseEnter={(e) => handleTooltipHover(e, 'Documentation')}
            onMouseLeave={handleTooltipLeave}
        >
            📖
        </button>
        <button
            onClick={onSettingsClick}
            className="seti-action-btn"
            style={{ marginRight: '8px', fontSize: '1.2rem', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', alignSelf: 'center' }}
            onMouseEnter={(e) => handleTooltipHover(e, 'Paramètres')}
            onMouseLeave={handleTooltipLeave}
        >
            ⚙️
        </button>
      </div>

      {/* Plateau du joueur */}
      <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}`, borderTopLeftRadius: 0 }}>
        <div className="seti-player-layout-container">
          {/* Sections Ressources (tuiles symbole + valeur, revenus) et Actions (actions principales, fin du tour) */}
          <div className="seti-stats-bar">
            {(() => {
              const flashClass = (flash: { type: string } | null) => (flash ? (flash.type === 'gain' ? 'flash-gain' : 'flash-loss') : '');
              const tile = (key: string, flash: { id: number; type: string } | null, icon: React.ReactNode, tooltip: React.ReactNode) => (
                <div
                  key={flash ? `${key}-${flash.id}` : `${key}-static`}
                  className={`seti-stat-tile ${flashClass(flash)}`}
                  onMouseEnter={(e) => showInteractiveTooltip(e, tooltip)}
                  onMouseLeave={scheduleTooltipClose}
                >
                  <div className="seti-stat-main">{icon}</div>
                </div>
              );
              return (
                <>
                  <div className="seti-player-section">
                  <div className="seti-player-section-title">Ressources</div>
                  <div className="seti-stats-row">
                  {tile('score', scoreFlash, <VictoryPointsIcon amount={currentPlayer.score} size={32} />, <SlotTooltip status="Score" statusColor="#6fd8bf" note={`${currentPlayer.score} points de victoire`} />)}
                  {tile('credit', creditFlash, <ResourceIcon kind="credit" amount={currentPlayer.credits} size={30} />,
                    resourceTooltip('Crédits', '#ffd700', `${currentPlayer.credits} crédit${currentPlayer.credits > 1 ? 's' : ''} : sondes, orbites, scans, cartes`, [trade('credit', 'energy'), trade('credit', 'card')]))}
                  {tile('energy', energyFlash, <ResourceIcon kind="energy" amount={currentPlayer.energy} size={30} />,
                    resourceTooltip('Énergie', '#3daa3a', `${currentPlayer.energy} énergie${currentPlayer.energy > 1 ? 's' : ''} : déplacements, atterrissages, scans, analyse`, [trade('energy', 'credit'), trade('energy', 'card')]))}
                  {tile('cards', cardsFlash, <ResourceIcon kind="card" amount={handCards.length} size={30} />,
                    resourceTooltip('Cartes en main', '#e8e8e8', `${handCards.length} / ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS} : au-delà, défausse en passant`, [cardTrade('credit'), cardTrade('energy')]))}
                  {tile('media', mediaFlash, <ResourceIcon kind="media" amount={currentPlayer.mediaCoverage} size={30} />,
                    resourceTooltip('Couverture médiatique', '#e5197e', `${currentPlayer.mediaCoverage} / ${GAME_CONSTANTS.MAX_MEDIA_COVERAGE} : technologies (6), achat d'une carte (3)`, [buyCard]))}
                  {tile('data', dataFlash, <ResourceIcon kind="data" amount={currentPlayer.data || 0} size={30} />,
                    resourceTooltip('Données', '#6f9be0', `${currentPlayer.data || 0} / ${GAME_CONSTANTS.MAX_DATA} : à transférer vers l'ordinateur`, []))}

                  {/* Revenus : bouton Réservation, revenus de chaque manche en miniature, détail en infobulle */}
                  {(() => {
                    const revenues = [
                      { kind: 'credit' as const, label: 'Crédits', total: currentPlayer.revenueCredits, base: GAME_CONSTANTS.INITIAL_REVENUE_CREDITS, flash: revenueCreditFlash },
                      { kind: 'energy' as const, label: 'Énergie', total: currentPlayer.revenueEnergy, base: GAME_CONSTANTS.INITIAL_REVENUE_ENERGY, flash: revenueEnergyFlash },
                      { kind: 'card' as const, label: 'Cartes', total: currentPlayer.revenueCards, base: GAME_CONSTANTS.INITIAL_REVENUE_CARDS, flash: revenueCardFlash },
                      // Revenus apportés par les espèces (cartes Centauriens, réservations de cartes à revenu Média ou Donnée)
                      { kind: 'media' as const, label: 'Médias', total: currentPlayer.revenueMedia || 0, base: 0, flash: null },
                      { kind: 'data' as const, label: 'Données', total: currentPlayer.revenueData || 0, base: 0, flash: null },
                    ];
                    const reserved = currentPlayer.reservedCards || [];
                    const tooltip = (
                      <div className="seti-revenue-tooltip">
                        <div className="seti-revenue-tooltip-title">Revenus à chaque fin de manche</div>
                        {revenues.map(r => (
                          <div key={r.kind} className="seti-revenue-tooltip-row">
                            <ResourceIcon kind={r.kind} size={16} />
                            <span>{r.label}</span>
                            <strong>{r.total}</strong>
                            <span className="seti-revenue-tooltip-detail">{r.base > 0 ? `${r.base} de départ` : ''}{r.base > 0 && r.total > r.base ? ' + ' : ''}{r.total > r.base ? `${r.total - r.base} réservé${r.total - r.base > 1 ? 's' : ''}` : ''}</span>
                          </div>
                        ))}
                        <div className="seti-revenue-tooltip-cards">
                          {reserved.length > 0
                            ? <>Cartes réservées ({reserved.length}) : {reserved.map(c => c.name).join(', ')}</>
                            : 'Aucune carte réservée'}
                        </div>
                      </div>
                    );
                    const anyFlash = revenues.find(r => r.flash)?.flash ?? null;
                    return (
                      <div
                        key={anyFlash ? `revenue-${anyFlash.id}` : 'revenue-static'}
                        className={`seti-stat-tile seti-revenue-tile ${flashClass(anyFlash)}`}
                        onMouseEnter={(e) => handleTooltipHover(e, tooltip)}
                        onMouseLeave={handleTooltipLeave}
                        aria-label="Revenus"
                      >
                        <div className="seti-stat-main">
                          <ReservationIcon size={26} />
                          <span className="seti-revenue-count">{reserved.length}</span>
                        </div>
                        <div className="seti-revenue-mini">
                          {revenues.map(r => <span key={r.kind} className={r.total === 0 ? 'empty' : undefined}><ResourceIcon kind={r.kind} amount={r.total} size={12} /></span>)}
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                  </div>

                  {/* Les 8 actions principales en hexagones, puis la fin du tour dans son propre cadre */}
                  {!isRobot && (() => {
                    // Une interaction obligatoire en cours (ex : technologie à choisir) empêche de finir le tour ou de passer
                    const interactionBlocks = isInteractiveMode || TurnManager.blocksEndOfTurn(interactionState);
                    const canEndTurn = isCurrentTurn && hasPerformedMainAction && !interactionBlocks;
                    let endTurnReason = "Terminez d'abord l'action en cours";
                    if (!isCurrentTurn) endTurnReason = "Ce n'est pas votre tour";
                    else if (!hasPerformedMainAction) endTurnReason = "Effectuez d'abord une action principale";
                    const endTurnTooltip = <ActionTooltip title="Fin du tour" bonusLabel="Effet" bonus="Les paliers de score sont vérifiés, puis le joueur suivant joue"
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
                              clickable={available} flash={available && actionType !== ActionType.PASS} onClick={() => onAction(actionType)}
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
                  })()}
                </>
              );
            })()}
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
            <div className="seti-player-list seti-cards-list" ref={cardsListRef}>
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
            <div className="seti-player-list seti-cards-list">
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
                  <PlayedMissionCard
                    key={card.id}
                    card={card}
                    isCurrentTurn={isCurrentTurn}
                    isRobot={isRobot}
                    onMissionClick={onMissionClick}
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
