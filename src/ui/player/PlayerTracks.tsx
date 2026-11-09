import React from 'react';
import { Game, GAME_CONSTANTS, SectorType } from '../../core/types';
import { TechSpot } from '../components/TechSpot';
import { SignalIcon } from '../components/GameIcons';
import { ActionTooltip, TechTooltip, ResourceSymbols, PieceSymbol, DiscardSymbol, AmountSymbol, ActionSymbol } from '../components/BoardTooltips';

/** Pistes du plateau joueur : emplacements des technologies Exploration et étapes du scan (Observation) */

/** Emplacement d'une piste du plateau joueur (exploration, observation) ; dans un cadre s'il reçoit une technologie */
export const TrackSlot: React.FC<{
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
export const ExplorationTrack: React.FC<ExplorationTrackProps> = ({ game, playerId, handleTooltipHover, handleTooltipLeave }) => {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const hasTech = (level: number) => player.technologies.some(t => t.id.startsWith(`exploration-${level}`));
  // Pouvoir sans la technologie, puis ce qu'elle apporte
  const techSlot = (base: React.ReactNode, benefit: React.ReactNode, level: number, roman: string) => (
    <TrackSlot icon={null} tooltip={<TechTooltip name={`Exploration ${roman}`} acquired={hasTech(level)} base={base} benefit={benefit} />}
      techFrame={{ acquired: hasTech(level), tile: `exploration-${level}` }}
      onHover={handleTooltipHover} onLeave={handleTooltipLeave} />
  );
  // Champ d'astéroïdes : Médias gagnés en le visitant, déplacements pour le quitter
  const asteroids = (media: number, movements: number) => (
    <>Astéroïdes : visiter <AmountSymbol kind="media" amount={media} label={`${media} Média`} />, quitter <AmountSymbol kind="movement" amount={movements} label={`${movements} Déplacement${movements > 1 ? 's' : ''}`} /></>
  );
  // Coût réel d'un atterrissage, sans et avec un orbiteur sur la planète
  const landCost = (alone: number, withOrbiter: number) => (
    <><ActionSymbol kind="land" label="Atterrir" /> <AmountSymbol kind="energy" amount={alone} label={`${alone} Énergies`} />,{' '}
      <PieceSymbol kind="orbiter" label="Avec un orbiteur" /> <AmountSymbol kind="energy" amount={withOrbiter} label={`${withOrbiter} Énergie${withOrbiter > 1 ? 's' : ''}`} /></>
  );
  // Les quatre emplacements de technologie Exploration, espacés régulièrement
  return (
    <div className="obs-track-container evenly">
      {techSlot(<><PieceSymbol kind="probe" label="Sonde" /> maximum : 1</>, <><PieceSymbol kind="probe" label="Sonde" /> maximum : 2</>, 1, 'I')}
      {techSlot(asteroids(0, 2), asteroids(1, 1), 2, 'II')}
      {techSlot(landCost(GAME_CONSTANTS.LAND_COST_ENERGY, GAME_CONSTANTS.LAND_COST_ENERGY_WITH_ORBITER),
        landCost(GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY, GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY_AND_ORBITER), 3, 'III')}
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

export const ObservationTrack: React.FC<ObservationTrackProps> = ({ game, playerId, handleTooltipHover, handleTooltipLeave }) => {
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
