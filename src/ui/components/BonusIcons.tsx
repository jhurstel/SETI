import React from 'react';
import { Bonus, LifeTraceType, SectorType } from '../../core/types';
import { ResourceSystem } from '../../systems/ResourceSystem';
import { ResourceIcon, LifeTraceIcon, AnyLifeTraceIcon, VictoryPointsIcon, SignalGainIcon, SignalBadge, ActionHexIcon } from './GameIcons';
import { ReservationIcon, TechCategoryIcon } from './ObjectiveSymbol';
import { HoverTooltip } from './HoverTooltip';
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
  [SectorType.OUMUAMUA]: { badge: 'oumuamua' },
};

/** Symbole du signal d'une carte (coin de scan) : disque à la couleur du secteur ; à défaut, le nom du secteur */
export const SectorSignalIcon: React.FC<{ sector: SectorType; size?: number }> = ({ sector, size = 16 }) => {
  const signal = SIGNAL_SCOPES[sector];
  return signal ? <SignalGainIcon color={signal.color} badge={signal.badge} size={size} /> : <span>{sector}</span>;
};

/** Icône sans emplacement pour un nombre (trace, réservation) : répétée autant de fois que la quantité */
export const Repeated: React.FC<{ amount: number; children: React.ReactNode }> = ({ amount, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
    {Array.from({ length: Math.max(1, amount) }, (_, i) => <React.Fragment key={i}>{children}</React.Fragment>)}
  </span>
);

/** « 1 Média », « 2 Médias », « 1 Trace Bleue »… : libellé d'un gain (infobulles des symboles) */
const amountLabel = (amount: number, singular: string, plural = `${singular}s`) => `${amount} ${amount > 1 ? plural : singular}`;

/**
 * Gains d'un bonus avec les icônes du livret (PV, crédits, énergie, médias, cartes, données, déplacements, réservation, sondes, orbite, atterrissage, scan,
 * technologies, signaux, traces de vie) ;
 * les autres gains restent écrits en toutes lettres. Avec `tooltips`, chaque symbole a son infobulle (le gain en toutes lettres).
 */
export const BonusIcons: React.FC<{ bonus?: Bonus | null; size?: number; empty?: React.ReactNode; tooltips?: boolean }> = ({ bonus, size = 16, empty = 'Aucun', tooltips = false }) => {
  const items: { key: string; node: React.ReactNode; label: string }[] = [];
  const add = (key: string, node: React.ReactNode, label: string) => items.push({ key, node, label });
  if (bonus) {
    const rest: Bonus = { ...bonus };
    if (bonus.pv) add('pv', <VictoryPointsIcon amount={bonus.pv} size={size + 2} />, `${bonus.pv} PV`);
    if (bonus.credits) add('credits', <ResourceIcon kind="credit" amount={bonus.credits} size={size} />, amountLabel(bonus.credits, 'Crédit'));
    if (bonus.energy) add('energy', <ResourceIcon kind="energy" amount={bonus.energy} size={size} />, amountLabel(bonus.energy, 'Énergie'));
    if (bonus.media) add('media', <ResourceIcon kind="media" amount={bonus.media} size={size} />, amountLabel(bonus.media, 'Média'));
    if (bonus.card || bonus.anycard) {
      const cards = (bonus.card || 0) + (bonus.anycard || 0);
      add('card', <ResourceIcon kind="card" amount={cards} size={size} />, amountLabel(cards, 'Carte'));
    }
    if (bonus.speciesCard) add('speciesCard', <ResourceIcon kind="alienCard" amount={bonus.speciesCard} size={size} />, amountLabel(bonus.speciesCard, 'Carte Alien', 'Cartes Alien'));
    if (bonus.token && bonus.token > 0) add('token', <ResourceIcon kind="token" amount={bonus.token} size={size} />, amountLabel(bonus.token, 'Jeton Oumuamua', 'Jetons Oumuamua'));
    if (bonus.data) add('data', <ResourceIcon kind="data" amount={bonus.data} size={size} />, amountLabel(bonus.data, 'Donnée'));
    if (bonus.movements) add('movements', <ResourceIcon kind="movement" amount={bonus.movements} size={size} />, amountLabel(bonus.movements, 'Déplacement'));
    if (bonus.revenue) add('revenue', <Repeated amount={bonus.revenue}><ReservationIcon size={size} /></Repeated>, amountLabel(bonus.revenue, 'Réservation'));
    if (bonus.probe) add('probe', <Repeated amount={bonus.probe}><ActionHexIcon kind="launch" size={size + 2} /></Repeated>, amountLabel(bonus.probe, 'Sonde'));
    if (bonus.landing) add('landing', <Repeated amount={bonus.landing}><ActionHexIcon kind="land" size={size + 2} /></Repeated>, amountLabel(bonus.landing, 'Atterrissage'));
    if (bonus.scan) add('scan', <Repeated amount={bonus.scan}><ActionHexIcon kind="scan" size={size + 2} /></Repeated>, amountLabel(bonus.scan, 'Scan'));
    (bonus.technologies || []).forEach((t, i) => add(`tech-${i}`, <Repeated amount={t.amount}><TechCategoryIcon category={t.scope} size={size + 2} /></Repeated>,
      `${amountLabel(t.amount, 'Technologie')}${t.scope ? ` ${Array.isArray(t.scope) ? t.scope.join(' ou ') : t.scope}` : ''}`));
    const otherSignals = (bonus.signals || []).filter(s => !SIGNAL_SCOPES[s.scope]);
    (bonus.signals || []).forEach((s, i) => {
      const signal = SIGNAL_SCOPES[s.scope];
      if (signal) add(`signal-${i}`, <Repeated amount={s.amount}><SignalGainIcon color={signal.color} badge={signal.badge} size={size + 2} /></Repeated>, `${amountLabel(s.amount, 'Signal', 'Signaux')} (${s.scope})`);
    });
    rest.signals = otherSignals.length > 0 ? otherSignals : undefined;
    delete rest.speciesCard; delete rest.token;
    delete rest.probe; delete rest.landing; delete rest.scan; delete rest.technologies;
    delete rest.pv; delete rest.credits; delete rest.energy; delete rest.media; delete rest.data; delete rest.movements; delete rest.revenue; delete rest.card; delete rest.anycard;
    (bonus.lifetraces || []).forEach((l, i) => {
      const color = LIFE_TRACE_ICON[l.scope];
      add(`trace-${i}`, <Repeated amount={l.amount}>{color ? <LifeTraceIcon color={color} size={size} /> : <AnyLifeTraceIcon size={size} />}</Repeated>,
        ResourceSystem.formatBonus({ lifetraces: [l] })?.[0] ?? amountLabel(l.amount, 'Trace de vie', 'Traces de vie'));
    });
    delete rest.lifetraces;
    (ResourceSystem.formatBonus(rest) || []).forEach((text, i) => add(`text-${i}`, <span>{text}</span>, ''));
  }
  if (items.length === 0) return <>{empty}</>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', verticalAlign: 'middle' }}>
      {items.map(item => (tooltips && item.label
        ? <HoverTooltip key={item.key} content={item.label} style={{ alignItems: 'center', cursor: 'help' }}>{item.node}</HoverTooltip>
        : <React.Fragment key={item.key}>{item.node}</React.Fragment>))}
    </span>
  );
};
