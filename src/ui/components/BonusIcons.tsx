import React from 'react';
import { Bonus, LifeTraceType, SectorType } from '../../core/types';
import { ResourceSystem } from '../../systems/ResourceSystem';
import { ResourceIcon, LifeTraceIcon, AnyLifeTraceIcon, VictoryPointsIcon, SignalGainIcon, SignalBadge, ActionHexIcon } from './GameIcons';
import { ReservationIcon, TechCategoryIcon } from './ObjectiveSymbol';
import { LIFE_TRACE_COLORS, LifeTraceColor } from '../styles/lifeTraceColors';

const LIFE_TRACE_ICON: Partial<Record<LifeTraceType, LifeTraceColor>> = {
  [LifeTraceType.RED]: 'red',
  [LifeTraceType.YELLOW]: 'yellow',
  [LifeTraceType.BLUE]: 'blue',
};

/** Signal selon le secteur visé : disque coloré (secteur d'une couleur) ou gris avec un badge (Terre, planète, rangée, pioche, sonde) */
const SIGNAL_SCOPES: Partial<Record<SectorType, { color?: string; badge?: SignalBadge }>> = {
  [SectorType.RED]: { color: LIFE_TRACE_COLORS.red },
  [SectorType.YELLOW]: { color: LIFE_TRACE_COLORS.yellow },
  [SectorType.BLUE]: { color: LIFE_TRACE_COLORS.blue },
  [SectorType.BLACK]: { color: '#2b2b2b' },
  [SectorType.ANY]: {},
  [SectorType.ROW]: { badge: 'card' },
  [SectorType.DECK]: { badge: 'deck' },
  [SectorType.PROBE]: { badge: 'probe' },
  [SectorType.EARTH]: { badge: 'earth' },
  [SectorType.MERCURY]: { badge: 'mercury' },
  [SectorType.VENUS]: { badge: 'venus' },
  [SectorType.MARS]: { badge: 'mars' },
  [SectorType.JUPITER]: { badge: 'jupiter' },
  [SectorType.SATURN]: { badge: 'saturn' },
};

/** Icône sans emplacement pour un nombre (trace, réservation) : répétée autant de fois que la quantité */
export const Repeated: React.FC<{ amount: number; children: React.ReactNode }> = ({ amount, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
    {Array.from({ length: Math.max(1, amount) }, (_, i) => <React.Fragment key={i}>{children}</React.Fragment>)}
  </span>
);

/**
 * Gains d'un bonus avec les icônes du livret (PV, crédits, énergie, médias, cartes, données, déplacements, réservation, sondes, orbite, atterrissage, scan,
 * technologies, signaux, traces de vie) ;
 * les autres gains restent écrits en toutes lettres.
 */
export const BonusIcons: React.FC<{ bonus?: Bonus | null; size?: number; empty?: React.ReactNode }> = ({ bonus, size = 16, empty = 'Aucun' }) => {
  const items: React.ReactNode[] = [];
  if (bonus) {
    const rest: Bonus = { ...bonus };
    if (bonus.pv) items.push(<VictoryPointsIcon key="pv" amount={bonus.pv} size={size + 2} />);
    if (bonus.credits) items.push(<ResourceIcon key="credits" kind="credit" amount={bonus.credits} size={size} />);
    if (bonus.energy) items.push(<ResourceIcon key="energy" kind="energy" amount={bonus.energy} size={size} />);
    if (bonus.media) items.push(<ResourceIcon key="media" kind="media" amount={bonus.media} size={size} />);
    if (bonus.card || bonus.anycard) items.push(<ResourceIcon key="card" kind="card" amount={(bonus.card || 0) + (bonus.anycard || 0)} size={size} />);
    if (bonus.speciesCard) items.push(<ResourceIcon key="speciesCard" kind="alienCard" amount={bonus.speciesCard} size={size} />);
    if (bonus.token && bonus.token > 0) items.push(<ResourceIcon key="token" kind="token" amount={bonus.token} size={size} />);
    if (bonus.data) items.push(<ResourceIcon key="data" kind="data" amount={bonus.data} size={size} />);
    if (bonus.movements) items.push(<ResourceIcon key="movements" kind="movement" amount={bonus.movements} size={size} />);
    if (bonus.revenue) items.push(<Repeated key="revenue" amount={bonus.revenue}><ReservationIcon size={size} /></Repeated>);
    if (bonus.probe) items.push(<Repeated key="probe" amount={bonus.probe}><ActionHexIcon kind="launch" size={size + 2} /></Repeated>);
    if (bonus.orbiting) items.push(<Repeated key="orbiting" amount={bonus.orbiting}><ActionHexIcon kind="orbit" size={size + 2} /></Repeated>);
    if (bonus.landing) items.push(<Repeated key="landing" amount={bonus.landing}><ActionHexIcon kind="land" size={size + 2} /></Repeated>);
    if (bonus.scan) items.push(<Repeated key="scan" amount={bonus.scan}><ActionHexIcon kind="scan" size={size + 2} /></Repeated>);
    (bonus.technologies || []).forEach((t, i) => items.push(<Repeated key={`tech-${i}`} amount={t.amount}><TechCategoryIcon category={t.scope} size={size + 2} /></Repeated>));
    const otherSignals = (bonus.signals || []).filter(s => !SIGNAL_SCOPES[s.scope]);
    (bonus.signals || []).forEach((s, i) => {
      const signal = SIGNAL_SCOPES[s.scope];
      if (signal) items.push(<Repeated key={`signal-${i}`} amount={s.amount}><SignalGainIcon color={signal.color} badge={signal.badge} size={size + 2} /></Repeated>);
    });
    rest.signals = otherSignals.length > 0 ? otherSignals : undefined;
    delete rest.speciesCard; delete rest.token;
    delete rest.probe; delete rest.orbiting; delete rest.landing; delete rest.scan; delete rest.technologies;
    delete rest.pv; delete rest.credits; delete rest.energy; delete rest.media; delete rest.data; delete rest.movements; delete rest.revenue; delete rest.card; delete rest.anycard;
    (bonus.lifetraces || []).forEach((l, i) => {
      const color = LIFE_TRACE_ICON[l.scope];
      items.push(<Repeated key={`trace-${i}`} amount={l.amount}>{color ? <LifeTraceIcon color={color} size={size} /> : <AnyLifeTraceIcon size={size} />}</Repeated>);
    });
    delete rest.lifetraces;
    (ResourceSystem.formatBonus(rest) || []).forEach((text, i) => items.push(<span key={`text-${i}`}>{text}</span>));
  }
  if (items.length === 0) return <>{empty}</>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', verticalAlign: 'middle' }}>{items}</span>;
};
