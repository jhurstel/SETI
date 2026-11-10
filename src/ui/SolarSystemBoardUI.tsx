import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Game, Probe, DiskName, SectorNumber, DISK_NAMES, RotationDisk, ProbeState, GAME_CONSTANTS, InteractionState, CelestialObject, GamePhase, LifeTraceType } from '../core/types';
import { FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, sectorToIndex } from '../core/SolarSystemPosition';
import { polarToCartesian, calculateObjectPosition } from './solarGeometry';
import { ProbeSystem } from '../systems/ProbeSystem';
import { BonusIcons } from './components/BonusIcons';
import { AnomalyIcon, MascamiteIcon } from './components/GameIcons';
import { ResourceSystem } from '../systems/ResourceSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { Tooltip } from './Tooltip';
import { PLANET_STYLES, PLANET_SIZES } from './styles/celestialStyles';
import { PlanetIcon } from './components/PlanetIcon';
import { RotationDiskSector } from './components/RotationDiskSector';
import { SectorDetails } from './components/SectorDetails';
import { PlanetGlobe, CometSvg, AsteroidFieldSvg, SunSvg, ProbeSvg, CapsuleSvg } from './components/CelestialBodies';
import { SectorStars } from './components/SectorStars';
import { SlotTooltipContent } from './solar/slotTooltip';
import { findPlanet } from './solar/planets';
import { highlightedSectors } from './solar/highlightedSectors';
import { useProbeSelection } from './solar/useProbeSelection';
import { OumuamuaSignals } from './solar/OumuamuaSignals';
import { PiecesSummary } from './solar/pieces';
import { piecesAt, specimenRewardText } from './solar/cellPieces';
import './SolarSystemBoardUI.css'
import { useCloseTooltipOnClick } from './hooks/useCloseTooltipOnClick';

interface SolarSystemBoardUIProps {
  game: Game;
  interactionState: InteractionState;
  onProbeMove: (probeId: string, path: string[]) => void;
  onPlanetClick: (planetId: string) => void;
  onOrbit: (planetId: string, slotIndex?: number) => void;
  onLand: (planetId: string, slotIndex?: number) => void;
  onBackgroundClick: () => void;
  onSectorClick: (sectorId: string) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null) => void;
  onMascamiteClick: (planetId: string, tokenIndex: number) => void;
  /** Action Orbite ou Atterrissage choisie : ouvre la fenêtre des planètes où elle est possible */
  planetFocus?: 'orbit' | 'land' | null;
}

/** Diamètre de l'anneau extérieur (E) rapporté au côté du plateau */
const OUTER_RING_RATIO = 0.88;
/** Taille (px) en dessous de laquelle le plateau est dessiné à cette taille puis réduit en entier (proportions gardées) */
const MIN_BOARD_RENDER_SIZE = 700;

const SolarSystemBoardUIView: React.FC<SolarSystemBoardUIProps> = ({ game, interactionState, onProbeMove, onPlanetClick, onOrbit, onLand, onBackgroundClick, onSectorClick, setActiveTooltip, onMascamiteClick, planetFocus }) => {

  const planetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [hoveredSlot, setHoveredSlot] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number, rect: DOMRect } | null>(null);
  useCloseTooltipOnClick(() => setHoveredSlot(null));

  // Données d'une planète (Oumuamua compris)
  const getPlanetData = (planetId: string) => findPlanet(game, planetId);

  // État pour gérer l'animation de retrait
  const [removingItem, setRemovingItem] = useState<{ type: 'orbiter' | 'lander', planetId: string, index: number } | null>(null);
  const processingRef = useRef(false);


  // Helper pour gérer le clic sur un slot (orbite ou atterrissage) avec animation de retrait si nécessaire
  const handleSlotClick = (
    e: React.MouseEvent,
    isClickable: boolean,
    actionFn: ((planetId: string, index: number) => void) | undefined,
    planetId: string,
    index: number,
    removalType?: 'orbiter' | 'lander'
  ) => {
    if (processingRef.current) return;

    if (isClickable && actionFn) {
      e.stopPropagation();
      if (removalType) {
        processingRef.current = true;
        setRemovingItem({ type: removalType, planetId, index });
        setTimeout(() => {
          actionFn(planetId, index);
          setRemovingItem(null);
          processingRef.current = false;
        }, 500);
      } else {
        actionFn(planetId, index);
      }
    }
  };



  const highlightPlayerProbes = interactionState.type === 'MOVING_PROBE';

  // Utiliser les angles de rotation depuis le jeu, ou les angles initiaux si non définis
  const initialAngle1 = (sectorToIndex[game.board.solarSystem.initialSectorLevel1] || 0) * 45;
  const initialAngle2 = (sectorToIndex[game.board.solarSystem.initialSectorLevel2] || 0) * 45;
  const initialAngle3 = (sectorToIndex[game.board.solarSystem.initialSectorLevel3] || 0) * 45;
  const gameAngle1 = useMemo(() => game.board.solarSystem.rotationAngleLevel1 ?? initialAngle1, [game.board.solarSystem.rotationAngleLevel1, initialAngle1]);
  const gameAngle2 = useMemo(() => game.board.solarSystem.rotationAngleLevel2 ?? initialAngle2, [game.board.solarSystem.rotationAngleLevel2, initialAngle2]);
  const gameAngle3 = useMemo(() => game.board.solarSystem.rotationAngleLevel3 ?? initialAngle3, [game.board.solarSystem.rotationAngleLevel3, initialAngle3]);

  // État pour gérer l'angle de rotation des plateaux
  const [rotationAngle1, setRotationAngle1] = useState<number>(() => gameAngle1);
  const [rotationAngle2, setRotationAngle2] = useState<number>(() => gameAngle2);
  const [rotationAngle3, setRotationAngle3] = useState<number>(() => gameAngle3);

  // Sonde sélectionnée et cases qu'elle peut atteindre (solar/useProbeSelection)
  const { selectedProbeId, setSelectedProbeId, reachableCells, highlightedPath, setHighlightedPath, clearSelection } = useProbeSelection(game, interactionState, rotationAngle1, rotationAngle2, rotationAngle3);


  // Clic hors du plateau (et hors des infobulles) : annule la sélection de sonde et ferme les fenêtres de planète
  // ouvertes par « Mettre en orbite » / « Poser une sonde ». Le fond du plateau est géré par ses propres calques.
  const boardInnerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedProbeId && !planetFocus) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || boardInnerRef.current?.contains(target) || target.closest('.seti-tooltip')) return;
      if (selectedProbeId) {
        clearSelection();
      }
      if (planetFocus) onBackgroundClick();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [selectedProbeId, planetFocus, onBackgroundClick, clearSelection]);


  // Mémo pour obtenir toutes les sondes dans le système solaire
  const probesInSystem = useMemo(() => {
    return game.board.solarSystem.probes || [];
  }, [game.board.solarSystem.probes]);

  // Joueur qui regarde le plateau (le joueur humain ; en ligne, les autres humains apparaissent comme robots) :
  // les spécimens Mascamites, face cachée, ne lui sont montrés que s'il a le droit de les voir
  const viewerId = game.players.find(p => p.type === 'human')?.id;
  /** Sondes et capsules posées sur une case (position relative à son anneau) */
  const piecesOnCell = (disk: DiskName, sector: SectorNumber, level: number) => piecesAt(probesInSystem, disk, sector, level);

  /** Sondes et capsules d'une case, regroupées par joueur (une ligne par joueur, à sa couleur) */
  const piecesSummary = (pieces: Probe[]) => <PiecesSummary game={game} pieces={pieces} viewerId={viewerId} />;

  /** Pièces du joueur humain en cours sur la case d'une planète (sélectionnables en cliquant sur la planète) */
  const ownPiecesOnPlanet = (obj: CelestialObject) => {
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.type === 'robot') return [];
    return piecesOnCell(obj.position.disk, obj.position.sector, obj.level || 0).filter(p => p.ownerId === currentPlayer.id);
  };

  /** Clic sur une planète : sélectionne la sonde ou la capsule du joueur qui s'y trouve (la suivante à chaque clic), sinon l'action de la planète */
  const handlePlanetObjectClick = (obj: CelestialObject) => {
    const removing = interactionState.type === 'REMOVING_ORBITER' || interactionState.type === 'REMOVING_LANDER';
    const mine = removing ? [] : ownPiecesOnPlanet(obj);
    if (mine.length > 0) {
      setActiveTooltip(null);
      const current = mine.findIndex(p => p.id === selectedProbeId);
      setSelectedProbeId(mine[(current + 1) % mine.length].id);
      return;
    }
    if (onPlanetClick) onPlanetClick(obj.id);
  };

  // Ref pour le timeout de fermeture du tooltip
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnterObject = (e: React.MouseEvent<HTMLDivElement>, obj: CelestialObject) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    let content: React.ReactNode;
    let tooltipProps: Partial<Parameters<typeof setActiveTooltip>[0]> = {};

    const currentPlayer = game.players[game.currentPlayerIndex];
    // Infobulle qu'on peut survoler (symboles avec leur propre infobulle)
    const hoverable: Partial<Parameters<typeof setActiveTooltip>[0]> = {
      onMouseEnter: () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); },
      onMouseLeave: handleMouseLeaveObject,
      pointerEvents: 'auto'
    };
    const subtitleStyle: React.CSSProperties = { fontSize: '0.8em', marginTop: '4px', color: '#aaa', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' };
    // « Visiter pour gagner [Média] » : symbole avec son infobulle
    const visitMedia = <div style={subtitleStyle}>Visiter pour gagner <BonusIcons bonus={{ media: 1 }} size={14} tooltips /></div>;

    // Special handling for Oumuamua which might be typed as asteroid but behaves like a planet with slots
    const isOumuamua = obj.id === 'oumuamua';
    const effectiveType = isOumuamua ? 'planet' : obj.type;

    switch (effectiveType) {
      case 'planet': {
        const planetData = getPlanetData(obj.id);
        if (planetData) {
          content = (
            <div className="planet-window">
              <div className="planet-window-header">
                <div className="planet-window-title">
                  {planetData.name}
                </div>
                {visitMedia}
              </div>
              <div className="planet-window-body">
                <PlanetIcon id={planetData.id} size={planetData.id === 'oumuamua' ? 80 : 220} planetData={planetData} game={game} interactionState={interactionState} onOrbit={onOrbit} onLand={onLand} handleSlotClick={handleSlotClick} removingItem={removingItem} hoverTimeoutRef={hoverTimeoutRef} setHoveredSlot={setHoveredSlot} />
              </div>
            </div>
          );
          tooltipProps = hoverable;
        } else {
          // Fallback for Earth or other objects without detailed data
          let subContent;
          const isRobot = currentPlayer.type === 'robot';
          if (obj.id === 'earth') {
            const check = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
            let text = `Lancer une sonde (coût: ${GAME_CONSTANTS.PROBE_LAUNCH_COST} Crédits)`;
            let color = '#aaa';
            if (currentPlayer.hasPerformedMainAction || isRobot) {
              text = isRobot ? "Tour du robot" : "Action principale déjà effectuée";
              color = '#ff6b6b';
            } else if (!check.canLaunch) {
              text = check.reason || "Impossible";
              color = '#ff6b6b';
            } else if (check.canLaunch) {
              color = '#4a9eff';
            }
            const ownHere = ownPiecesOnPlanet(obj).length > 0;
            subContent = (
              <>
                {piecesSummary(piecesOnCell(obj.position.disk, obj.position.sector, obj.level || 0))}
                <div style={{ fontSize: '0.8em', marginTop: '4px', color: ownHere ? '#4a9eff' : color, fontStyle: 'italic' }}>
                  {ownHere ? "Cliquer pour sélectionner votre sonde (lancer : bouton de l'action)" : text}
                </div>
              </>
            );
          } else {
            subContent = visitMedia;
            tooltipProps = hoverable;
          }
          content = <><div className="solar-tooltip-title">{obj.name}</div>{subContent}</>;
        }
        break;
      }
      case 'comet': {
        content = <><div className="solar-tooltip-title">{obj.name}</div>{visitMedia}</>;
        tooltipProps = hoverable;
        break;
      }
      case 'asteroid': {
        const hasTech = currentPlayer.technologies.some(t => t.id.startsWith('exploration-2'));
        const subContent = hasTech
          ? visitMedia
          : <div style={subtitleStyle}>Quitter nécessite <BonusIcons bonus={{ movements: 1 }} size={14} tooltips /> supplémentaire</div>;
        content = <><div className="solar-tooltip-title">{obj.name}</div>{subContent}</>;
        tooltipProps = hoverable;
        break;
      }
      case 'anomaly': {
        const bonusText = obj.anomalyData ? <BonusIcons bonus={obj.anomalyData.bonus} tooltips /> : 'Inconnu';
        content = (
          <div>
            <div style={{ fontWeight: 'bold', color: obj.anomalyData?.color === LifeTraceType.YELLOW ? '#ffd700' : obj.anomalyData?.color === LifeTraceType.RED ? '#ff6b6b' : '#4a9eff' }}>{obj.name}</div>
            <div className="solar-tooltip-bonus">Bonus: {bonusText}</div>
          </div>
        );
        tooltipProps = hoverable;
        break;
      }
      default:
        content = <div className="solar-tooltip-title">{obj.name}</div>;
        break;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      content,
      rect,
      ...tooltipProps
    });
  };

  const handleMouseLeaveObject = () => {
    hoverTimeoutRef.current = setTimeout(() => setActiveTooltip(null), 300);
  };

  // Gestion du redimensionnement pour maintenir le ratio carré
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<number>(0);

  // Effet pour redimensionner pour maintenir le ratio carré
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // L'anneau extérieur (88 % du plateau) occupe toute la hauteur (le toast est au-dessus du panneau) ;
        // les marges vides du carré peuvent déborder du conteneur
        setBoardSize(Math.min(width, height / OUTER_RING_RATIO));
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Planètes, sondes, astéroïdes, comètes et chevrons ont une taille fixe en pixels : sur un petit écran (mobile),
  // le plateau est dessiné à une taille minimale puis réduit en entier, pour garder leurs proportions
  const renderSize = Math.max(boardSize, MIN_BOARD_RENDER_SIZE);
  const boardScale = boardSize / renderSize;

  // Synchroniser les angles avec le jeu seulement lors du montage initial ou si le jeu change de manière significative
  // Utiliser une ref pour suivre les valeurs précédentes
  const prevGameAnglesRef = React.useRef({ gameAngle1, gameAngle2, gameAngle3 });

  useEffect(() => {
    // Ne synchroniser que si la différence est significative ET que ce n'est pas juste un re-render
    const prev = prevGameAnglesRef.current;
    if (Math.abs(gameAngle1 - prev.gameAngle1) > 1 && Math.abs(gameAngle1 - rotationAngle1) > 1) {
      setRotationAngle1(gameAngle1);
      prevGameAnglesRef.current.gameAngle1 = gameAngle1;
    }
  }, [gameAngle1, rotationAngle1]);

  useEffect(() => {
    const prev = prevGameAnglesRef.current;
    if (Math.abs(gameAngle2 - prev.gameAngle2) > 1 && Math.abs(gameAngle2 - rotationAngle2) > 1) {
      setRotationAngle2(gameAngle2);
      prevGameAnglesRef.current.gameAngle2 = gameAngle2;
    }
  }, [gameAngle2, rotationAngle2]);

  useEffect(() => {
    const prev = prevGameAnglesRef.current;
    if (Math.abs(gameAngle3 - prev.gameAngle3) > 1 && Math.abs(gameAngle3 - rotationAngle3) > 1) {
      setRotationAngle3(gameAngle3);
      prevGameAnglesRef.current.gameAngle3 = gameAngle3;
    }
  }, [gameAngle3, rotationAngle3]);

  // Fonction helper pour rendre l'indicateur de rotation (signe >) adossé à la tuile
  const renderRotationIndicator = (planetId: string, level: number, sectorOffset: number = 0, keySuffix: string = '') => {
    let obj: CelestialObject | undefined;
    if (planetId === 'saturn') {
      obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(o => o.id === 'saturn');
    } else if (planetId === 'jupiter') {
      obj = INITIAL_ROTATING_LEVEL1_OBJECTS.find(o => o.id === 'jupiter');
    } else if (planetId === 'mars') {
      obj = INITIAL_ROTATING_LEVEL2_OBJECTS.find(o => o.id === 'mars');
    } else if (planetId === 'earth') {
      obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'earth');
    } else if (planetId === 'mercury') {
      obj = INITIAL_ROTATING_LEVEL3_OBJECTS.find(o => o.id === 'mercury');
    }

    if (!obj) return null;

    const originalSector = obj.position.sector;
    const newSector = (((originalSector - 1) + sectorOffset) % 8) + 1 as SectorNumber;

    const { sectorCenterAngle, diskIndex } = calculateObjectPosition(obj.position.disk, newSector);

    // Positionner sur le bord extérieur du disque
    const diskWidth = 8;
    const sunRadius = 4;
    const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);
    const indicatorRadius = outerRadius - 1.7;

    // Décalage angulaire pour ne pas être centré (vers le bord du secteur)
    const angleOffset = diskIndex === 0 ? 30 : diskIndex === 1 ? 27 : 25;
    const indicatorAngle = sectorCenterAngle - angleOffset;

    const { x, y } = polarToCartesian(0, 0, indicatorRadius, indicatorAngle);

    return (
      <div
        key={`indicator-${planetId}${keySuffix}`}
        className={`seti-rotation-indicator level-${level}`}
        style={{
          left: `calc(50% + ${x}%)`,
          top: `calc(50% + ${y}%)`,
          transform: `translate(-50%, -50%) rotate(${indicatorAngle + 270}deg)`,
        }}
      >
        &gt;
      </div>
    );
  };

  // Fonction helper pour rendre une anomalie
  const renderAnomaly = (obj: CelestialObject, zIndex: number = 30) => {
    let { x, y, sectorCenterAngle } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    // Décaler l'anomalie selon l'angle du secteur
    const anomalyOffset = 7; // décalage de 9% vers l'extérieur (à adapter selon le design)
    x += anomalyOffset * Math.cos((sectorCenterAngle - 90) * Math.PI / 180);
    y += anomalyOffset * Math.sin((sectorCenterAngle - 90) * Math.PI / 180);

    const colorMap: Record<LifeTraceType, string> = {
      [LifeTraceType.RED]: '#ff6b6b',
      [LifeTraceType.BLUE]: '#4a9eff',
      [LifeTraceType.YELLOW]: '#ffd700',
      [LifeTraceType.ANY]: '#fff'
    };

    if (!obj.anomalyData) return null;
    const color = colorMap[obj.anomalyData.color] || '#fff';

    // Jeton : anneau de distorsion à la couleur de l'anomalie (anneau pointillé qui tourne), récompense au centre
    return (
      <div
        key={obj.id}
        className="seti-anomaly"
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: '34px',
          height: '34px',
          zIndex,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'help',
          pointerEvents: selectedProbeId ? 'none' : 'auto',
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
      >
        <AnomalyIcon color={color} size={34} className="solar-anomaly-svg" />
        <div className="solar-anomaly-token">
          <BonusIcons bonus={obj.anomalyData.bonus} size={11} empty={null} />
        </div>
      </div>
    );
  };

  // Fonction helper pour rendre une planète
  const renderPlanet = (obj: CelestialObject, zIndex: number = 30) => {
    let { x, y, sectorCenterAngle } = calculateObjectPosition(obj.position.disk, obj.position.sector);

    const style = PLANET_STYLES[obj.id] || {
      background: 'radial-gradient(circle, #888, #555)',
      border: '2px solid #aaa',
      boxShadow: '0 0 3px rgba(136, 136, 136, 0.8)',
    };
    const size = PLANET_SIZES[obj.id] || 24;

    // Check if planet has orbiters on it (dashed circle)
    const planetData = getPlanetData(obj.id);
    const hasOrbiters = planetData && planetData.orbiters && planetData.orbiters.length > 0;

    // Check if user can interact with a planet where he has a probe (glow effect)
    const currentPlayer = game.players[game.currentPlayerIndex];
    const isRobot = currentPlayer.type === 'robot';
    const playerProbe = currentPlayer.probes.find(p =>
      p.ownerId === currentPlayer.id &&
      p.state === ProbeState.IN_SOLAR_SYSTEM &&
      p.solarPosition.disk === obj.position.disk &&
      p.solarPosition.sector === obj.position.sector &&
      p.solarPosition.level === obj.level
    );
    let canInteract = false;

    if (interactionState.type === 'REMOVING_ORBITER') {
      const planetData = getPlanetData(obj.id);
      if (planetData && planetData.orbiters.some(p => p.ownerId === currentPlayer.id)) {
        canInteract = true;
      }
    } else if (interactionState.type === 'REMOVING_LANDER') {
      const planetData = getPlanetData(obj.id);
      if (planetData && planetData.landers.some(p => p.ownerId === currentPlayer.id)) {
        canInteract = true;
      }
    } else if (!currentPlayer.hasPerformedMainAction && !isRobot && game.phase !== GamePhase.SETUP) {
      if (obj.id === 'earth') {
        canInteract = ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch;
      } else if (playerProbe) {
        const canOrbit = ProbeSystem.canOrbit(game, currentPlayer.id, playerProbe.id).canOrbit;
        const canLand = ProbeSystem.canLand(game, currentPlayer.id, playerProbe.id).canLand;
        canInteract = canOrbit || canLand;
      }
    }

    // Handle transform separation for Oumuamua to avoid scaling slots
    let containerTransform = style.transform;
    let bodyTransform = undefined;
    if (obj.id === 'oumuamua') {
      const pos = polarToCartesian(0, 0, 24, sectorCenterAngle + 14);
      x = pos.x;
      y = pos.y;
      containerTransform = 'translate(-50%, -50%) rotate(60deg)';
      bodyTransform = 'translate(-50%, -50%) scale(2.8, 0.6)';
    }

    return (
      <div
        key={obj.id}
        className="seti-planet"
        ref={(el) => {
          if (el) planetRefs.current.set(obj.id, el);
          else planetRefs.current.delete(obj.id);
        }}
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: `${size}px`,
          height: `${size}px`,
          zIndex,
          pointerEvents: selectedProbeId ? 'none' : 'auto',
          filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.4))',
          transform: containerTransform,
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
        onClick={() => handlePlanetObjectClick(obj)}
      >
        {hasOrbiters && (
          <div className="seti-planet-orbit-ring"
            style={{
              width: `${size + 15}px`,
              height: `${size + 15}px`,
            }}
          />
        )}
        {/* Anneau fixe et anneau qui s'agrandit, comme pour les slots de signaux */}
        {canInteract && (
          <>
            <div className="seti-planet-interaction-ring" style={{ width: `${size + 10}px`, height: `${size + 10}px` }} />
            <div className="seti-planet-interaction-ring seti-pulse-green" style={{ width: `${size + 10}px`, height: `${size + 10}px` }} />
          </>
        )}
        {obj.id === 'oumuamua' ? (
          <div className="seti-planet-body"
            style={{
              width: `${size - 4}px`,
              height: `${size - 4}px`,
              background: style.background,
              border: style.border,
              boxShadow: style.boxShadow,
              borderRadius: style.borderRadius || '50%',
              transform: bodyTransform,
            }}
          />
        ) : (
          <div className="seti-planet-globe">
            <PlanetGlobe id={obj.id} size={size - 4} />
          </div>
        )}

        {/* Mascamite Tokens */}
        {planetData && planetData.mascamiteTokens && planetData.mascamiteTokens.map((token, i) => {
          const count = planetData.mascamiteTokens!.length;
          const dist = count === 1 ? 0 : size * 0.35;
          const angle = (360 / count) * i - 90;
          const { x: tx, y: ty } = polarToCartesian(0, 0, dist, angle);
          const isClickable = (interactionState.type === 'COLLECTING_SPECIMEN' && interactionState.planetId === planetData.id)
            || (interactionState.type === 'CONSULTING_SPECIMEN' && SpeciesSystem.consultablePlanets(game, game.players[game.currentPlayerIndex].id, interactionState).includes(planetData.id));

          const visible = !!viewerId && SpeciesSystem.canSeeSpecimens(game, viewerId, planetData.id);

          return (
            <div
              key={`masc-${i}`}
              className={`solar-specimen-token ${isClickable ? 'clickable' : ''}`}
              style={{ top: `calc(50% + ${ty}px)`, left: `calc(50% + ${tx}px)` }}
              onClick={(e) => {
                if (isClickable) { e.stopPropagation(); onMascamiteClick(planetData.id, i); }
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                // Infobulle où la souris peut entrer : chaque gain a la sienne
                setActiveTooltip({
                  content: (
                    <div className="solar-specimen-tooltip">
                      <div className="solar-specimen-title">Spécimen Mascamite</div>
                      <div className="solar-tooltip-bonus">
                        {visible
                          ? (ResourceSystem.formatBonus(token.bonus).length > 0 ? <BonusIcons bonus={token.bonus} size={16} tooltips /> : 'Aucune récompense')
                          : 'Spécimen inconnu (face cachée)'}
                      </div>
                    </div>
                  ),
                  rect: e.currentTarget.getBoundingClientRect(),
                  pointerEvents: 'auto',
                  onMouseEnter: () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); },
                  onMouseLeave: () => setActiveTooltip(null),
                });
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                hoverTimeoutRef.current = setTimeout(() => setActiveTooltip(null), 250);
              }}
            >
              <MascamiteIcon size={16} hidden={!visible} />
            </div>
          );
        })}
      </div>
    );
  };

  // Fonction helper pour rendre une comète
  const renderComet = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y, sectorCenterAngle } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    // Direction tangentielle dans le sens horaire (croissant 1→8) : angle - 90°
    const tailAngle = sectorCenterAngle - 90;
    const tailLength = obj.position.disk === 'A' ? 30 : obj.position.disk === 'B' ? 50 : 70;

    return (
      <div
        key={obj.id}
        className="seti-celestial-object"
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: '20px',
          height: '20px',
          zIndex,
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
      >
        {/* Repère centré sur l'objet et tourné dans le sens de la queue ; le noyau est à l'avant */}
        <div className="seti-comet-anchor" style={{ transform: `rotate(${tailAngle}deg)` }}>
          <CometSvg length={tailLength} />
        </div>
      </div>
    );
  };

  // Fonction helper pour générer un nombre pseudo-aléatoire basé sur une seed pour astéroïdes et sondes
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Fonction helper pour rendre un nuage d'astéroïdes
  const renderAsteroid = (obj: CelestialObject, zIndex: number = 30) => {
    const { x, y } = calculateObjectPosition(obj.position.disk, obj.position.sector);
    const asteroidCount = obj.position.disk === 'A' ? 6 : obj.position.disk === 'B' ? 8 : 10;
    const spread = obj.position.disk === 'A' ? 10 : obj.position.disk === 'B' ? 15 : 20;
    // Utiliser l'ID comme seed pour avoir un pattern cohérent
    const seed = obj.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return (
      <div
        key={obj.id}
        className="seti-celestial-object"
        style={{
          top: `calc(50% + ${y}%)`,
          left: `calc(50% + ${x}%)`,
          width: `${spread * 3}px`,
          height: `${spread * 2}px`,
          zIndex,
          pointerEvents: selectedProbeId ? 'none' : 'auto',
        }}
        onMouseEnter={(e) => handleMouseEnterObject(e, obj)}
        onMouseLeave={handleMouseLeaveObject}
      >
        <AsteroidFieldSvg width={spread * 3} height={spread * 2} count={asteroidCount} seed={seed} />
      </div>
    );
  };

  // Fonction helper pour rendre une sonde
  const renderProbe = (probe: Probe, zIndex: number = 150) => {
    if (!probe.solarPosition) return null;

    const player = game.players.find(p => p.id === probe.ownerId);
    const playerName = player?.name || 'Joueur inconnu';
    const playerColor = player?.color || '#8888ff';
    const isSelected = selectedProbeId === probe.id;
    const { x, y } = calculateObjectPosition(probe.solarPosition.disk, probe.solarPosition.sector);

    // Calculer un décalage aléatoire stable basé sur l'ID de la sonde pour éviter la superposition
    const seed = probe.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetX = (seededRandom(seed) - 0.5) * 4;       // +/- 2%
    const offsetY = (seededRandom(seed + 42) - 0.5) * 4;  // +/- 2%

    const isOwner = probe.ownerId === game.players[game.currentPlayerIndex].id;
    const shouldHighlight = highlightPlayerProbes && isOwner;
    const isRobot = player?.type === 'robot';
    const isCapsule = probe.state === ProbeState.CAPSULE;
    const specimenReward = probe.specimen ? specimenRewardText(probe.specimen.bonus, probe.ownerId === viewerId) : '';

    return (
      <div
        key={probe.id}
        onClick={(e) => {
          e.stopPropagation();
          if (!isRobot && isOwner) {
            handleProbeClick(probe);
            return;
          }
          // Pièce d'un autre joueur (souvent posée par-dessus) : sélectionne celle du joueur sur la même case, s'il en a une
          const currentPlayer = game.players[game.currentPlayerIndex];
          if (currentPlayer.type === 'robot') return;
          const mine = piecesOnCell(probe.solarPosition.disk, probe.solarPosition.sector, probe.solarPosition.level || 0).filter(p => p.ownerId === currentPlayer.id);
          if (mine.length === 0) return;
          setActiveTooltip(null);
          const current = mine.findIndex(p => p.id === selectedProbeId);
          setSelectedProbeId(mine[(current + 1) % mine.length].id);
        }}
        onMouseEnter={(e) => {
          // Toutes les sondes et capsules de la case, regroupées par joueur, puis l'action de la pièce survolée
          const here = piecesOnCell(probe.solarPosition.disk, probe.solarPosition.sector, probe.solarPosition.level || 0);
          const content = here.length > 1 ? (
            <>
              <div className="solar-tooltip-title">{here.length} pièces sur cette case</div>
              {piecesSummary(here)}
              {(() => {
                const currentPlayer = game.players[game.currentPlayerIndex];
                const ownHere = currentPlayer.type !== 'robot' && here.some(p => p.ownerId === currentPlayer.id);
                return ownHere && <div className="solar-probe-hint">Cliquer pour sélectionner votre {isOwner && isCapsule ? 'capsule' : 'sonde'}</div>;
              })()}
            </>
          ) : (
            <>
              <div className="solar-tooltip-title">{playerName}</div>
              {isCapsule ? (
                <>
                  <div className="solar-capsule-label">Capsule : spécimen Mascamite{specimenReward ? ` (${specimenReward})` : ''}</div>
                  <div className="solar-probe-note">Déplacer la capsule (énergie ou déplacements) jusqu'à sa destination pour réclamer la mission</div>
                </>
              ) : (
                <div className="solar-probe-note">Déplacer la sonde</div>
              )}
            </>
          );
          setActiveTooltip({ content, rect: e.currentTarget.getBoundingClientRect() });
        }}
        onMouseLeave={() => setActiveTooltip(null)}
        className="seti-probe"
        style={{
          top: `calc(50% + ${y + offsetY}%)`,
          left: `calc(50% + ${x + offsetX}%)`,
          // Les pièces du joueur en cours passent au-dessus des autres (la sélectionnée en premier)
          zIndex: zIndex + (isSelected ? 2 : isOwner && !isRobot ? 1 : 0),
          cursor: isRobot ? 'default' : 'pointer',
        }}
      >
        {/* Effet de surbrillance (pour action gratuite mouvement) */}
        {shouldHighlight && (
          <div className="seti-probe-highlight" />
        )}

        {/* Ombre portée au sol */}
        <div className="seti-probe-shadow" />

        <div className="seti-probe-body" style={{ filter: isSelected ? 'drop-shadow(0 0 3px #00ff00)' : 'none' }}>
          {/* Capsule Mascamite (spécimen) ou sonde, à la couleur du joueur */}
          {isCapsule ? <CapsuleSvg color={playerColor} /> : <ProbeSvg color={playerColor} />}
        </div>
      </div>
    );
  };

  // Fonction helper pour rendre les cases accessibles
  const renderReachableCells = () => {
    if (!selectedProbeId) return null;

    return Array.from(reachableCells.entries()).map(([cellKey, data]) => {
      const [disk, sector] = [cellKey[0] as DiskName, parseInt(cellKey.substring(1)) as SectorNumber];
      const { x, y, diskIndex } = calculateObjectPosition(disk, sector, 0);
      const diskWidth = 8;
      const sunRadius = 4;
      const innerRadius = sunRadius + (diskIndex * diskWidth);
      const outerRadius = sunRadius + ((diskIndex + 1) * diskWidth);

      const isPathStep = highlightedPath.includes(cellKey);
      const isTarget = highlightedPath.length > 0 && highlightedPath[highlightedPath.length - 1] === cellKey;

      return (
        <div
          key={`reachable-${cellKey}`}
          className="seti-reachable-cell"
          onClick={(e) => {
            e.stopPropagation();
            if (onProbeMove && selectedProbeId) {
              onProbeMove(selectedProbeId, data.path);
              clearSelection();
            }
          }}
          onMouseEnter={(e) => {
            setHighlightedPath(data.path);
            setActiveTooltip({ content: `Accessible en ${data.movements} déplacement(s)${data.media > 0 ? ` (+${data.media} Média)` : ''}`, rect: e.currentTarget.getBoundingClientRect() });
          }}
          onMouseLeave={() => { setHighlightedPath([]); setActiveTooltip(null); }}
          style={{
            top: `calc(50% + ${y}%)`,
            left: `calc(50% + ${x}%)`,
            width: `${(outerRadius - innerRadius) * 0.8}%`,
            height: `${(outerRadius - innerRadius) * 0.8}%`,
            border: isTarget ? '2px solid #ffeb3b' : (isPathStep ? '2px solid #ffeb3b' : '2px solid #00ff00'),
            backgroundColor: isTarget ? 'rgba(255, 235, 59, 0.5)' : (isPathStep ? 'rgba(255, 235, 59, 0.3)' : 'rgba(0, 255, 0, 0.2)'),
            zIndex: isTarget ? 2002 : (isPathStep ? 2001 : 2000),
          }}
        >
          {isPathStep && (
            <span className="seti-reachable-cell-text">
              {highlightedPath.indexOf(cellKey)}
            </span>
          )}
        </div>
      );
    });
  };

  // Fonction pour gérer le clic sur une sonde
  const handleProbeClick = (probe: Probe) => {
    setActiveTooltip(null);
    if (selectedProbeId === probe.id) {
      // Désélectionner si déjà sélectionnée
      setSelectedProbeId(null);
    } else {
      // Sélectionner la sonde
      setSelectedProbeId(probe.id);
    }
  };

  return (
    <>
      <div className="seti-panel seti-solar-system-container">

        {/* Conteneur pour positionner les éléments directement dans le panel */}
        <div
          ref={containerRef}
          className="seti-board-container"
        >
          {/* Conteneur interne pour positionner les éléments */}
          <div
            ref={boardInnerRef}
            className="seti-board-inner"
            style={{
              width: boardSize ? `${renderSize}px` : '0px',
              height: boardSize ? `${renderSize}px` : '0px',
              transform: boardScale < 1 ? `scale(${boardScale})` : undefined,
              opacity: boardSize ? 1 : 0,
              pointerEvents: removingItem ? 'none' : 'auto',
            }}>
            {/* Zone de clic arrière-plan pour annuler l'interaction (z-index 0, sous les planètes) */}
            <div
              className="seti-background-click-area"
              onClick={() => { if (onBackgroundClick && !selectedProbeId) onBackgroundClick(); }}
            />

            {/* Étoiles qui donnent leur nom aux secteurs, en fond */}
            {game.board.sectors && <SectorStars sectors={game.board.sectors} />}

            {/* Plateau fixe */}
            <div className="seti-fixed-plateau">
              {/* Soleil au centre */}
              <div className="seti-sun"><SunSvg /></div>

              {/* Traits de délimitation et labels des 8 secteurs radiaux */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                // Calculs pour le trait de séparation
                const sectorAngle = -(360 / 8) * sectorIndex - 90; // 0° = midi (12h), sens horaire, -90° pour CSS

                return (
                  <React.Fragment key={`sector-group-${sectorIndex}`}>
                    {/* Trait de séparation */}
                    <div
                      className="seti-sector-separator"
                      style={{
                        transform: `translate(-50%, 0%) rotate(${sectorAngle}deg)`,
                      }}
                    />
                  </React.Fragment>
                );
              })}

              {/* Traits de délimitation et labels des 5 cercles concentriques (A à E) */}
              {Object.keys(DISK_NAMES).map((disk, index) => {
                // Le soleil a un rayon d'environ 4% (8% de diamètre / 2)
                // Chaque anneau a une largeur de 8%
                // A commence juste après le soleil à 4% et va jusqu'à 12%
                // B: 12% à 20%, C: 20% à 28%, D: 28% à 36%, E: 36% à 44%
                const diskWidth = 8; // Largeur de chaque anneau (augmentée)
                const sunRadius = 4; // Rayon du soleil
                const innerRadius = sunRadius + (index * diskWidth);
                const outerRadius = sunRadius + ((index + 1) * diskWidth);

                return (
                  <React.Fragment key={disk}>
                    {/* Cercle extérieur de l'anneau */}
                    <div
                      className={`seti-solar-disk disk-${disk}`}
                      style={{
                        width: `${outerRadius * 2}%`,
                        height: `${outerRadius * 2}%`,
                        zIndex: 2 + index,
                      }}
                    />
                    {/* Cercle intérieur pour créer l'anneau (masquer l'intérieur) */}
                    <div
                      className={`seti-solar-disk-inner disk-${disk}`}
                      style={{
                        width: `${innerRadius * 2}%`,
                        height: `${innerRadius * 2}%`,
                        zIndex: 2 + index + 0.5,
                      }}
                    />
                  </React.Fragment>
                );
              })}

              {/* Objets fixes */}
              {[...FIXED_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 0)].map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 10);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 10);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 10);
                } else if (obj.type === 'anomaly') {
                  return renderAnomaly(obj, 10);
                }
                return null;
              })}

              {/* Affichage des sondes fixes (disque D) */}
              {probesInSystem.filter(probe => {
                if (!probe.solarPosition) return false;
                const level = probe.solarPosition.level;
                return level === 0;
              }).map((probe) => renderProbe(probe, 150)
              )}
            </div>

            {/* Plateau rotatif niveau 1 avec 3 disques (A, B, C) - se superpose au plateau fixe */}
            <div
              className="seti-rotating-overlay seti-rotating-level-1"
              style={{
                transform: `translate(-50%, -50%) rotate(${rotationAngle1}deg)`, // Rotation dynamique
              }}
            >
              {/* Disque C (extérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk1C-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'C',
                  level: 1,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Disque B (moyen) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk1B-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'B',
                  level: 1,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Disque A (intérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk1A-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'A',
                  level: 1,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Signaux d'Oumuamua (attachés au plateau niveau 1) */}
              <svg className="seti-rotating-sector-svg solar-oumuamua-layer" viewBox="0 0 200 200"><OumuamuaSignals game={game} interactionState={interactionState} rotationAngle1={rotationAngle1} onSectorClick={onSectorClick} setActiveTooltip={setActiveTooltip} /></svg>

              {/* Sondes sur les disques A, B, C (niveau 1) */}
              {probesInSystem
                .filter(probe => {
                  if (!probe.solarPosition) return false;
                  const level = probe.solarPosition.level;
                  return level === 1;
                })
                .map((probe) => renderProbe(probe, 150))}

              {/* Objets célestes sur le plateau rotatif niveau 1 - basés sur INITIAL_ROTATING_LEVEL1_OBJECTS */}
              {[...INITIAL_ROTATING_LEVEL1_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 1)].filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 3);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 2);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 2);
                }
                return null;
              })}

              {/* Indicateur de rotation pour Saturne */}
              {game.board.solarSystem.nextRingLevel === 1 && renderRotationIndicator('saturn', 1)}
              {game.board.solarSystem.nextRingLevel === 1 && renderRotationIndicator('jupiter', 1, 1, '-offset1')}
            </div>

            {/* Plateau rotatif niveau 2 avec 2 disques (A, B) - se superpose au niveau 3 */}
            <div
              className="seti-rotating-overlay seti-rotating-level-2"
              style={{
                transform: `translate(-50%, -50%) rotate(${rotationAngle2}deg)`,
              }}
            >
              {/* Disque B (extérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk2B-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'B',
                  level: 2,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Disque A (intérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk2A-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'A',
                  level: 2,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Sondes sur les disques A, B (niveau 2) */}
              {probesInSystem
                .filter(probe => {
                  if (!probe.solarPosition) return false;
                  const level = probe.solarPosition.level;
                  return level === 2;
                })
                .map((probe) => renderProbe(probe, 150))}

              {/* Objets célestes sur le plateau rotatif niveau 2 - basés sur INITIAL_ROTATING_LEVEL2_OBJECTS */}
              {[...INITIAL_ROTATING_LEVEL2_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 2)].filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 3);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 2);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 2);
                }
                return null;
              })}

              {/* Indicateur de rotation pour Mars */}
              {game.board.solarSystem.nextRingLevel === 2 && renderRotationIndicator('mars', 2)}
              {game.board.solarSystem.nextRingLevel === 2 && renderRotationIndicator('mars', 2, 5, '-offset5')}
            </div>

            {/* Plateau rotatif niveau 3 avec 1 disque (A) - se superpose au niveau 2 */}
            <div
              className="seti-rotating-overlay seti-rotating-level-3"
              style={{
                transform: `translate(-50%, -50%) rotate(${rotationAngle3}deg)`, // Rotation dynamique
              }}
            >
              {/* Disque A (intérieur) - 8 secteurs */}
              {Array.from({ length: 8 }).map((_, sectorIndex) => {
                const obj: RotationDisk =
                {
                  id: `disk3A-${sectorIndex}`,
                  sectorIndex: sectorIndex,
                  diskName: 'A',
                  level: 3,
                }
                return <RotationDiskSector key={obj.id} obj={obj} zIndex={1} game={game} selectedProbeId={selectedProbeId} />;
              })}

              {/* Sondes sur le disque A (niveau 3) */}
              {probesInSystem.filter(probe => {
                if (!probe.solarPosition) return false;
                const level = probe.solarPosition.level;
                return level === 3;
              }).map((probe) => renderProbe(probe, 150)
              )}

              {/* Objets célestes sur le plateau rotatif niveau 3 - basés sur INITIAL_ROTATING_LEVEL3_OBJECTS */}
              {[...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || []).filter(o => o.level === 3)].filter(obj => obj.type !== 'hollow' && obj.type !== 'empty').map((obj) => {
                if (obj.type === 'planet') {
                  return renderPlanet(obj, 3);
                } else if (obj.type === 'comet') {
                  return renderComet(obj, 2);
                } else if (obj.type === 'asteroid') {
                  return renderAsteroid(obj, 2);
                }
                return null;
              })}

              {/* Indicateur de rotation pour Terre */}
              {game.board.solarSystem.nextRingLevel === 3 && renderRotationIndicator('earth', 3)}
              {game.board.solarSystem.nextRingLevel === 3 && renderRotationIndicator('mercury', 3)}
            </div>

            {/* Backdrop pour désélectionner si on clique à côté (quand une sonde est sélectionnée) */}
            {selectedProbeId && (
              <div
                className="seti-probe-selection-backdrop"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
              />
            )}

            {/* Surbrillance des cases accessibles */}
            {renderReachableCells()}

            {/* Détails des secteurs sur le disque E (Noms + Slots) : dans le carré du plateau pour le suivre */}
            <SectorDetails game={game} interactionState={interactionState} highlightedSectorSlots={highlightedSectors(game, interactionState)} onSectorClick={onSectorClick} setActiveTooltip={setActiveTooltip} />
          </div>

          {/* Fenêtres persistantes des planètes : atterrissage bonus (Dragonfly…) ou action Orbite/Atterrissage choisie */}
          {(interactionState.type === 'LANDING_PROBE' || (interactionState.type === 'IDLE' && !!planetFocus)) && (() => {
            const currentPlayer = game.players[game.currentPlayerIndex];
            // Trouver toutes les planètes où le joueur a une sonde
            const planetsWithProbes = new Set<string>();
            const allObjects = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])];

            game.board.solarSystem.probes.forEach(p => {
              if (p.ownerId === currentPlayer.id && p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition) {
                const planet = allObjects.find(o =>
                  o.type === 'planet' &&
                  o.position.disk === p.solarPosition!.disk &&
                  o.position.sector === p.solarPosition!.sector &&
                  (o.level || 0) === (p.solarPosition!.level || 0)
                );
                if (planet) planetsWithProbes.add(planet.id);
              }
            });

            const planetIds = interactionState.type === 'IDLE' && planetFocus
              ? ProbeSystem.getPlayablePlanets(game, currentPlayer.id, planetFocus)
              : Array.from(planetsWithProbes);
            return planetIds.map(planetId => {
              const el = planetRefs.current.get(planetId);
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              const planetData = getPlanetData(planetId);
              if (!planetData) return null;

              const content = (
                <div className="planet-window">
                  <div className="planet-window-header">
                    <div className="planet-window-title">
                      {planetData.name}
                    </div>
                  </div>
                  <div className="planet-window-body">
                    <PlanetIcon id={planetData.id} size={planetData.id === 'oumuamua' ? 80 : 220} planetData={planetData} game={game} interactionState={interactionState} onOrbit={onOrbit} onLand={onLand} handleSlotClick={handleSlotClick} removingItem={removingItem} hoverTimeoutRef={hoverTimeoutRef} setHoveredSlot={setHoveredSlot} />
                  </div>
                </div>
              );
              return <Tooltip key={`landing-tooltip-${planetId}`} content={content} targetRect={rect} pointerEvents="auto" />;
            });
          })()}
        </div>
      </div>

      {/* Tooltip pour les slots (recalculé dynamiquement) */}
      {hoveredSlot && !removingItem && (
        <Tooltip
          content={<SlotTooltipContent game={game} interactionState={interactionState} slot={hoveredSlot} actions={{ orbit: !!onOrbit, land: !!onLand }} />}
          targetRect={hoveredSlot.rect}
          pointerEvents="auto"
          disableCollision={true}
        />
      )}
    </>
  );
};

/** Mémoïsé : redessiné seulement quand ses props changent (partie, interaction…), pas à chaque rendu de BoardUI */
export const SolarSystemBoardUI = React.memo(SolarSystemBoardUIView);
SolarSystemBoardUI.displayName = 'SolarSystemBoardUI';
