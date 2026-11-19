import React, { useLayoutEffect, useRef, useState } from 'react';
import { Bonus, Card, RevenueType } from '../../core/types';
import { cardSpecies } from '../cardSpecies';
import { BonusIcons } from './BonusIcons';
import { ActionHexIcon, AnyLifeTraceIcon, CentaurienMessageIcon, CentaurienReceptionIcon, LifeTraceIcon, MascamiteIcon, MissionCompleteIcon, ResourceIcon, SignalGainIcon } from './GameIcons';
import { AnyTechIcon, CoveredSectorIcon, LanderIcon, OrbiterIcon, OrbiterOrLanderIcon, TechCategoryIcon } from './ObjectiveSymbol';
import { LIFE_TRACE_COLORS } from '../styles/lifeTraceColors';
import { CardFaceModel, ConditionSymbol, describeCard, EffectSegment, FaceColor, MissionCircle, MissionPanel, richText } from './cardFaceModel';
import './CardFace.css';

/** Élément de la carte mis en avant dans une fenêtre de choix (action gratuite, secteur, revenu) */
export type CardHighlight = 'freeAction' | 'sector' | 'revenue';

/** État d'un cercle de mission jouée (recouvert, réalisable) et clic sur un cercle réalisable */
export interface MissionCircleState {
  completed: boolean;
  fulfillable: boolean;
  /** Cercle réalisable qui clignote (tutoriel : seulement quand l'étape décrit les missions) */
  flash?: boolean;
  onClick?: () => void;
  /** Couleur du marqueur posé sur un cercle recouvert */
  markerColor?: string;
}

/** Classe du pied de carte selon le revenu (couleur) */
const REVENUE_CLASS: Partial<Record<RevenueType, string>> = {
  [RevenueType.CREDIT]: 'credit', [RevenueType.ENERGY]: 'energy', [RevenueType.CARD]: 'card', [RevenueType.DATA]: 'data', [RevenueType.MEDIA]: 'media',
};

const Gains: React.FC<{ bonus: Bonus | null; size: number }> = ({ bonus, size }) => (
  <BonusIcons bonus={bonus} size={size} empty={null} />
);

/** Couleurs des symboles colorés (signal, secteur couvert) */
const SYMBOL_COLORS: Record<FaceColor, string> = {
  red: LIFE_TRACE_COLORS.red, yellow: LIFE_TRACE_COLORS.yellow, blue: LIFE_TRACE_COLORS.blue, black: '#2b2b2b',
};

/** Symbole répété (2 ou 3 exemplaires), ou précédé de son nombre au-delà */
const Counted: React.FC<{ count?: number; repeat?: boolean; children: React.ReactNode }> = ({ count, repeat = false, children }) => {
  if (!count || count === 1) return <>{children}</>;
  if (count <= 3 || repeat) return <>{Array.from({ length: count }, (_, i) => <React.Fragment key={i}>{children}</React.Fragment>)}</>;
  return <><span className="card-face-count">{count}×</span>{children}</>;
};

const ConditionIcon: React.FC<{ symbol: ConditionSymbol; size: number }> = ({ symbol, size }) => {
  switch (symbol.kind) {
    case 'text': return <span className="card-face-words">{symbol.text}</span>;
    case 'lifetrace': {
      const icon = symbol.color ? <LifeTraceIcon color={symbol.color} size={size + (symbol.embedded ? 4 : 0)} /> : <AnyLifeTraceIcon size={size + (symbol.embedded ? 4 : 0)} />;
      // Nombre incrusté dans la trace, comme pour les ressources (ET.52 à ET.54)
      if (symbol.embedded && symbol.count && symbol.count > 1) return <span className="card-face-embedded">{icon}<span className="card-face-embedded-count">{symbol.count}</span></span>;
      return <Counted count={symbol.count}>{icon}</Counted>;
    }
    case 'missionDone': return <Counted count={symbol.count} repeat><MissionCompleteIcon size={size} /></Counted>;
    case 'signal': return <Counted count={symbol.count}><SignalGainIcon color={symbol.color ? SYMBOL_COLORS[symbol.color] : undefined} size={size + 2} /></Counted>;
    case 'action': return <ActionHexIcon kind={symbol.action} size={size + 2} />;
    case 'orbiterOrLander': return <Counted count={symbol.count}><OrbiterOrLanderIcon size={size + 2} /></Counted>;
    case 'orbiter': return <Counted count={symbol.count}><OrbiterIcon size={size + 2} /></Counted>;
    case 'lander': return <Counted count={symbol.count} repeat={symbol.repeat}><LanderIcon size={size + 2} /></Counted>;
    case 'tech': return <Counted count={symbol.count}>{symbol.category ? <TechCategoryIcon category={symbol.category} size={size + 2} /> : <AnyTechIcon size={size + 2} />}</Counted>;
    case 'covered': return <Counted count={symbol.count}><CoveredSectorIcon color={symbol.color ? SYMBOL_COLORS[symbol.color] : undefined} size={size + 4} /></Counted>;
    case 'bonus': return <Gains bonus={symbol.bonus} size={size} />;
    case 'specimen': return symbol.resolved ? <ResolvedSpecimenIcon size={size + 2} /> : <MascamiteIcon size={size + 2} />;
    case 'centaurienMarker': return <CentaurienMessageIcon size={size + 10} />;
    case 'break': return <span className="card-face-break" aria-hidden="true" />;
  }
};

/** Jeton Mascamite avec une coche verte : on gagne la récompense du spécimen (glossaire des Mascamites) */
export const ResolvedSpecimenIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <span className="card-face-specimen-resolved" style={{ width: size, height: size }}>
    <MascamiteIcon size={size} />
    <svg viewBox="0 0 10 10" className="card-face-specimen-check" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill="#3a9d48" /><path d="M2.6 5.2 L4.3 6.9 L7.5 3.4" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

/** Texte écrit avec ses symboles (ressources chiffrées, traces de vie, orbiteurs, jetons Mascamites : `richText`) */
const RichText: React.FC<{ text: string; size: number; className?: string; style?: React.CSSProperties }> = ({ text, size, className = '', style }) => (
  <span className={`card-face-rich ${className}`} style={style}>{richText(text).map((symbol, i) => <ConditionIcon key={i} symbol={symbol} size={size} />)}</span>
);

/** Longueur d'un texte de panneau : sa police s'y ajuste pour tenir sur deux lignes tant que possible (CardFace.css) */
const chars = (text: string) => ({ '--chars': Math.max(text.length, 10) } as React.CSSProperties);

/**
 * Longueur de la plus longue ligne d'une condition dessinée (un symbole compte pour 3 caractères, `break` change de ligne) :
 * la police des mots s'y ajuste pour que chaque ligne tienne (carte 10 : deux lignes en tout)
 */
const lineChars = (symbols: ConditionSymbol[]) => {
  const lines = [0];
  for (const symbol of symbols) {
    if (symbol.kind === 'break') lines.push(0);
    else lines[lines.length - 1] += symbol.kind === 'text' ? symbol.text.length + 1 : 3 * ('count' in symbol && symbol.count && symbol.count <= 3 ? symbol.count : 1);
  }
  // Sans retour à la ligne imposé, le texte peut s'étaler sur deux lignes (police plus grande : carte 127)
  return { '--chars': Math.max(...lines, 10), '--lines': lines.length > 1 ? 1 : 2 } as React.CSSProperties;
};

/** Condition dessinée (symboles et mots), ou son texte faute de symbole */
/** Condition dessinée ou écrite ; `lead` la débute dans la même phrase (PV d'une carte Fin de partie), compté comme un symbole */
const Condition: React.FC<{ symbols: ConditionSymbol[]; text: string; size: number; lead?: React.ReactNode }> = ({ symbols, text, size, lead }) => {
  if (symbols.length === 0) {
    const style = chars(`${lead ? '   ' : ''}${text}`);
    if (!lead) return <RichText text={text} size={size} className="card-face-condition-text" style={style} />;
    return (
      <span className="card-face-rich card-face-condition-text" style={style}>
        {lead}{richText(text).map((symbol, i) => <ConditionIcon key={i} symbol={symbol} size={size} />)}
      </span>
    );
  }
  const counted: ConditionSymbol[] = lead ? [{ kind: 'bonus', bonus: {} }, ...symbols] : symbols;
  return (
    <span className="card-face-condition-symbols" style={lineChars(counted)}>
      {lead}{symbols.map((symbol, i) => <ConditionIcon key={i} symbol={symbol} size={size} />)}
    </span>
  );
};

const Segment: React.FC<{ segment: EffectSegment; size: number }> = ({ segment, size }) => {
  if (segment.kind === 'bonus') {
    return (
      <span className="card-face-segment">
        <Gains bonus={segment.bonus} size={size} />
        {segment.caption && <span className="card-face-caption">{segment.caption}</span>}
      </span>
    );
  }
  if (segment.kind === 'conditional') {
    return (
      <span className="card-face-segment card-face-conditional">
        <span className={`card-face-label${segment.color ? ` color-${segment.color}` : ''}`}>{segment.label}</span>
        <span className="card-face-arrow" aria-hidden="true">▸</span>
        <Gains bonus={segment.reward} size={size} />
      </span>
    );
  }
  if (segment.kind === 'or') return <span className="card-face-or" aria-label="ou">/</span>;
  if (segment.kind === 'symbols') return <span className="card-face-segment">{segment.symbols.map((symbol, i) => <ConditionIcon key={i} symbol={symbol} size={size - 2} />)}</span>;
  return <span className="card-face-segment card-face-text-segment">{segment.text}</span>;
};

/** Cercle (ou carré en creux) de récompense : recouvert du marqueur du joueur, ou réalisable, clignotant et cliquable */
const Circle: React.FC<{ circle: MissionCircle; size: number; state?: MissionCircleState; slot?: boolean }> = ({ circle, size, state, slot = false }) => {
  // Mission conditionnelle : récompense dans un carré en creux (FAQ), pas dans un cercle
  const classes = [slot ? 'card-face-slot' : 'card-face-circle'];
  // Gains + spécimen résolu (Mascamites) : deux récompenses en ligne, trois en triangle (gains dessus, spécimen réduit dessous)
  const specimenOnly = circle.rewardSymbols?.length === 1 && circle.rewardSymbols[0].kind === 'specimen';
  const rewardCount = gainCount(circle.reward) + (specimenOnly ? 1 : 0);
  if (slot && specimenOnly && rewardCount === 2) classes.push('rewards-row');
  // Spécimen réduit : sous deux gains (triangle), ou dans une phrase (« Résolvez … deux fois », ET.7)
  const inSentence = !!circle.rewardSymbols && !specimenOnly;
  const specimenSize = (specimenOnly && rewardCount >= 3) || inSentence ? Math.round(size * 0.7) : size;
  if (state?.completed) classes.push('completed');
  if (state?.fulfillable && !state.completed) classes.push('fulfillable');
  if (state?.flash && !state.completed) classes.push('seti-flash-green');
  return (
    <span className={classes.join(' ')} onClick={state?.fulfillable && !state.completed ? state.onClick : undefined}
      style={state?.completed && state.markerColor ? { borderColor: state.markerColor } : undefined}>
      {state?.completed && <span className="card-face-marker" style={state.markerColor ? { backgroundColor: state.markerColor } : undefined} />}
      {circle.rewardText ? <span className="card-face-reward-text">{circle.rewardText}</span> : <Gains bonus={circle.reward} size={gainCount(circle.reward) > 1 ? Math.round(size * (slot ? 0.85 : 0.7)) : size} />}
      {circle.rewardSymbols && (() => {
        // Phrase longue (consultation d'un spécimen, ET.8 à ET.10) : petit texte continu pour tenir dans le carré
        const long = circle.rewardSymbols.reduce((n, symbol) => n + (symbol.kind === 'text' ? symbol.text.length : 0), 0) > 40;
        return (
          <span className={`card-face-reward-symbols${long ? ' long' : ''}`} style={lineChars(circle.rewardSymbols)}>
            {circle.rewardSymbols.map((symbol, i) => <ConditionIcon key={i} symbol={symbol} size={long ? 9 : specimenSize} />)}
          </span>
        );
      })()}
      {circle.rewardCaption && <span className="card-face-reward-caption">{circle.rewardCaption}</span>}
    </span>
  );
};

/** Taille des symboles de la condition d'une carte Exertien : plus grands si elle n'a que 4 symboles au plus, sans texte */
const exertienSymbolSize = (symbols: ConditionSymbol[], panelSize: number): number => {
  const icons = symbols.reduce((n, s) => n + (s.kind === 'text' || s.kind === 'break' ? 0 : ('count' in s && s.count && s.count <= 3) || ('repeat' in s && s.repeat) || s.kind === 'missionDone' ? (s as { count?: number }).count ?? 1 : 1), 0);
  return symbols.some(s => s.kind === 'text') || icons > 4 ? panelSize + 2 : panelSize + 6;
};

/** Nombre de symboles d'un gain : un cercle de taille fixe réduit ses symboles quand il en porte plusieurs */
const gainCount = (bonus: Bonus): number => Object.values(bonus).reduce<number>((total, value) =>
  total + (Array.isArray(value) ? value.length : value ? 1 : 0), 0);

/**
 * Panneau de mission comme sur la FAQ. Déclenchable : intitulé (« Lorsque vous visitez : ») à gauche, ou au-dessus s'il y a
 * plus de deux cercles, puis un onglet (planète, couleur…) au-dessus de chaque cercle. Conditionnelle : une ligne par cercle,
 * condition écrite à gauche, récompense à droite.
 */
const MissionPanelView: React.FC<{ mission: MissionPanel; size: number; states?: MissionCircleState[] }> = ({ mission, size, states }) => {
  if (mission.kind === 'conditional') {
    return (
      <div className="card-face-panel mission conditional">
        {mission.circles.map((circle, i) => (
          <div key={i} className="card-face-condition-row">
            <span className="card-face-condition"><Condition symbols={circle.symbols} text={circle.label} size={size} /></span>
            <Circle circle={circle} size={size + 6} state={states?.[i]} slot />
          </div>
        ))}
      </div>
    );
  }
  const introSide = !!mission.intro && mission.circles.length <= 2;
  return (
    <div className={`card-face-panel mission triggered${introSide ? ' intro-side' : mission.intro ? ' intro-top' : ''}`}>
      {mission.intro && <div className="card-face-panel-intro" style={chars(mission.intro)}>{mission.intro}</div>}
      <div className="card-face-circles">
        {mission.circles.map((circle, i) => (
          <div key={i} className="card-face-circle-column">
            {!circle.noCriterion && <span className="card-face-tab"><Condition symbols={circle.symbols} text={circle.label} size={size - 2} /></span>}
            <Circle circle={circle} size={size} state={states?.[i]} />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Face d'une carte, disposée comme les vraies cartes (livret p. 7, FAQ) : illustration (fond décoratif) avec l'action gratuite
 * en haut à gauche, le triangle du secteur en haut à droite et le numéro en petit en bas à droite ; badge de coût et bandeau
 * du nom (une ligne, police ajustée à sa longueur) ; zone blanche de l'effet et du texte propre à la carte ; panneau de mission,
 * de fin de partie ou de réception ; liseré à la couleur du revenu, le revenu en grand dans le coin inférieur droit.
 * `compact` : miniature (main, rangée, fenêtres) = la même carte réduite à son emplacement ; sinon grande taille (infobulle, planches).
 */
export const CardFace: React.FC<{
  card: Card;
  compact?: boolean;
  highlight?: CardHighlight;
  /** État des cercles d'une mission jouée, dans l'ordre de ses prérequis */
  circleStates?: MissionCircleState[];
  className?: string;
}> = ({ card, compact = false, highlight, circleStates, className = '' }) => {
  // Miniature (main, rangée, fenêtres) : la carte de l'infobulle, réduite à la taille de son emplacement
  if (compact) return <CardMini><CardFace card={card} highlight={highlight} circleStates={circleStates} className={className} /></CardMini>;
  return <FullCardFace card={card} highlight={highlight} circleStates={circleStates} className={className} />;
};

/** Largeur et hauteur de la carte en grande taille (CardFace.css) : la miniature la réduit sans la modifier */
const CARD_WIDTH = 210;
const CARD_HEIGHT = 300;

/** Emplacement d'une miniature : la carte entière y est mise à l'échelle (la plus grande qui tienne) et centrée */
const CardMini: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(160 / CARD_HEIGHT);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      if (element.clientWidth && element.clientHeight) setScale(Math.min(element.clientWidth / CARD_WIDTH, element.clientHeight / CARD_HEIGHT));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="card-face-mini">
      <div className="card-face-mini-inner" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
};

const FullCardFace: React.FC<{
  card: Card;
  highlight?: CardHighlight;
  circleStates?: MissionCircleState[];
  className?: string;
}> = ({ card, highlight, circleStates, className = '' }) => {
  const face: CardFaceModel = describeCard(card);
  const species = cardSpecies(card);
  // Gains de la carte en grand ; symboles des panneaux un peu plus petits
  const iconSize = 30;
  const panelSize = 16;
  const classes = ['card-face', 'large', className];
  if (face.sectorColor) classes.push(`sector-${face.sectorColor}`);
  if (species) classes.push(`species-${species.toLowerCase()}`);
  if (face.danger !== undefined) classes.push('exertien');
  const revenueClass = face.revenueType ? REVENUE_CLASS[face.revenueType] : undefined;
  if (revenueClass) classes.push(`revenue-${revenueClass}`);
  const mark = (part: CardHighlight) => highlight === part ? ' highlighted' : '';
  const showText = !!face.text;
  const hasTop = face.effects.length > 0 || showText;
  const hasPanel = !!face.mission || !!face.scorePanel;
  // Trois signaux ou plus, seuls sur la ligne d'effet (ET.24) : plus petits, pour laisser la place au texte
  const signalsOnly = face.effects.length >= 3 && face.effects.every(s => s.kind === 'bonus' && Object.keys(s.bonus).every(key => key === 'signals'));

  return (
    <div className={classes.join(' ')} data-card-id={card.id}>
      <div className="card-face-art">
        {face.freeAction && (
          <span className={`card-face-free-action${mark('freeAction')}`} aria-label={`Action gratuite : ${face.freeActionType}`}>
            <Gains bonus={face.freeAction} size={24} />
          </span>
        )}
        {face.sector && (
          <span className={`card-face-sector${mark('sector')}`} aria-label={`Secteur ${face.sector}`}>
            <svg viewBox="0 0 10 10" className="card-face-signal" aria-hidden="true">
              <rect x="1" y="3.5" width="1.4" height="3" rx="0.7" /><rect x="3.4" y="2" width="1.4" height="6" rx="0.7" />
              <rect x="5.8" y="0.5" width="1.4" height="9" rx="0.7" /><rect x="8.2" y="2.5" width="1.4" height="5" rx="0.7" />
            </svg>
          </span>
        )}
        <span className="card-face-number">{card.id}</span>
      </div>
      {/* Longueur du nom : la police du bandeau s'y ajuste (une seule ligne, même règle pour toutes les cartes) */}
      <div className="card-face-name-band" style={{ '--name-chars': Math.max(face.name.length, 14) } as React.CSSProperties}>
        {face.cost && (
          <span className={`card-face-cost ${face.cost.kind}`} aria-label={`Coût : ${face.cost.amount} ${face.cost.kind === 'energy' ? 'énergie' : 'crédit'}`}>
            <ResourceIcon kind={face.cost.kind} amount={face.cost.amount} size={22} />
          </span>
        )}
        {/* Danger : badge de la taille du coût des autres cartes */}
        {face.danger !== undefined && <span className="card-face-danger" aria-label={`Danger ${face.danger}`}><span className="card-face-danger-value">{face.danger}</span></span>}
        <span className="card-face-name">{face.name}</span>
      </div>
      {/* Zone blanche : gains de la carte (et son texte) dans la moitié haute, panneau dans la moitié basse ;
          sans gain, le panneau est centré et occupe à peu près la moitié de la zone */}
      <div className={`card-face-body${hasTop ? ' has-top' : ''}${hasPanel ? ' has-panel' : ''}`}>
        {hasTop && (
          <div className="card-face-top">
            {/* Précision d'un gain (« sur une planète ou une lune… ») : à droite de ses symboles ; le reste du texte dessous */}
            {face.effects.length > 0 && (
              <div className={`card-face-effects${face.inlineText ? ' with-detail' : ''}`}>
                {face.effects.map((segment, i) => <Segment key={i} segment={segment} size={signalsOnly ? iconSize - 8 : iconSize} />)}
                {face.inlineText && <RichText text={face.inlineText} size={panelSize} className="card-face-text card-face-detail" />}
              </div>
            )}
            {/* Une phrase par ligne (carte 17) */}
            {/* Texte long (ET.5 ; ET.24 au-dessus de son panneau) : un peu plus petit et plus large, pour tenir en moins de lignes */}
            {showText && face.text.split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/).map((sentence, i) => <RichText key={i} text={sentence} size={panelSize} className={`card-face-text${face.text.length > 140 || (hasPanel && face.text.length > 80) ? ' long' : ''}`} />)}
            {face.textGains && (
              <div className="card-face-effects card-face-text-gains">
                {face.textGainsLead && <span className="card-face-text">{face.textGainsLead}</span>}
                {face.textGains.map((bonus, i) => <Gains key={i} bonus={bonus} size={iconSize} />)}
              </div>
            )}
          </div>
        )}
        {hasPanel && (
          <div className="card-face-bottom">
            {face.mission && <MissionPanelView mission={face.mission} size={panelSize} states={circleStates} />}
            {face.scorePanel?.kind === 'endGame' && (
              // Fin de partie : les PV d'abord, puis la condition (« Pour chaque… »), le tout centré
              face.danger !== undefined ? (
                // Exertien : la condition, un chevron, puis les PV qu'elle rapporte (condition ▸ conséquence)
                <div className="card-face-panel endGame consequence">
                  {/* Symboles plus grands que sur les autres panneaux quand la condition n'en compte que quelques-uns, sans texte (ET.41 à ET.48) */}
                  <span className="card-face-condition"><Condition symbols={face.scorePanel.symbols} text={face.scorePanel.text} size={exertienSymbolSize(face.scorePanel.symbols, panelSize)} /></span>
                  <span className="card-face-chevron" aria-hidden="true">▸</span>
                  <Gains bonus={face.scorePanel.reward} size={panelSize + 4} />
                </div>
              ) : (
                <div className="card-face-panel endGame">
                  {/* Les PV débutent la phrase de la condition, sur sa première ligne */}
                  <span className="card-face-condition"><Condition symbols={face.scorePanel.symbols} text={face.scorePanel.text} size={panelSize}
                    lead={<Gains bonus={face.scorePanel.reward} size={panelSize + 4} />} /></span>
                </div>
              )
            )}
            {face.scorePanel?.kind === 'reception' && (
              <div className="card-face-panel reception">
                {/* À gauche le socle coché et « À réception du message. », un chevron, à droite ce qu'elle rapporte */}
                <span className="card-face-condition card-face-reception-condition">
                  <CentaurienReceptionIcon size={panelSize + 6} />
                  <Condition symbols={face.scorePanel.symbols} text={face.scorePanel.text} size={panelSize} />
                </span>
                <span className="card-face-chevron" aria-hidden="true">▸</span>
                {face.scorePanel.rewardSentence ? (
                  <span className="card-face-reward-sentence">
                    {face.scorePanel.rewardSentence.before} <Gains bonus={face.scorePanel.reward} size={panelSize} /> {face.scorePanel.rewardSentence.after}
                  </span>
                ) : <Gains bonus={face.scorePanel.reward} size={panelSize + 2} />}
              </div>
            )}
          </div>
        )}
      </div>
      {face.revenue && (
        <div className="card-face-footer" aria-label={`Revenu : ${face.revenueType}`}>
          <span className={`card-face-revenue${mark('revenue')}`}>
            <Gains bonus={face.revenue} size={22} />
          </span>
        </div>
      )}
    </div>
  );
};
