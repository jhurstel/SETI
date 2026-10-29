import React from 'react';
import { Bonus, LifeTraceType } from '../../core/types';
import { ResourceSystem } from '../../systems/ResourceSystem';
import { ResourceIcon, LifeTraceIcon, VictoryPointsIcon } from './GameIcons';
import { ReservationIcon } from './ObjectiveSymbol';
import { LifeTraceColor } from '../styles/lifeTraceColors';

const LIFE_TRACE_ICON: Partial<Record<LifeTraceType, LifeTraceColor>> = {
  [LifeTraceType.RED]: 'red',
  [LifeTraceType.YELLOW]: 'yellow',
  [LifeTraceType.BLUE]: 'blue',
};

/** Quantité écrite devant une icône qui n'a pas d'emplacement pour un nombre (trace, réservation) */
const Counted: React.FC<{ amount: number; children: React.ReactNode }> = ({ amount, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', fontWeight: 'bold' }}>{amount}{children}</span>
);

/**
 * Gains d'un bonus avec les icônes du livret (PV, crédits, énergie, médias, données, déplacements, traces de vie, réservation) ;
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
    if (bonus.data) items.push(<ResourceIcon key="data" kind="data" amount={bonus.data} size={size} />);
    if (bonus.movements) items.push(<ResourceIcon key="movements" kind="movement" amount={bonus.movements} size={size} />);
    if (bonus.revenue) items.push(<Counted key="revenue" amount={bonus.revenue}><ReservationIcon size={size} /></Counted>);
    delete rest.pv; delete rest.credits; delete rest.energy; delete rest.media; delete rest.data; delete rest.movements; delete rest.revenue; delete rest.card; delete rest.anycard;
    const otherTraces = (bonus.lifetraces || []).filter(l => !LIFE_TRACE_ICON[l.scope]);
    (bonus.lifetraces || []).forEach((l, i) => {
      const color = LIFE_TRACE_ICON[l.scope];
      if (color) items.push(<Counted key={`trace-${i}`} amount={l.amount}><LifeTraceIcon color={color} size={size} /></Counted>);
    });
    rest.lifetraces = otherTraces.length > 0 ? otherTraces : undefined;
    (ResourceSystem.formatBonus(rest) || []).forEach((text, i) => items.push(<span key={`text-${i}`}>{text}</span>));
  }
  if (items.length === 0) return <>{empty}</>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', verticalAlign: 'middle' }}>{items}</span>;
};
