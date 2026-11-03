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

/** « 1 Média », « 2 Médias »… : libellé d'un gain (infobulles des symboles) */
const amountLabel = (amount: number, singular: string, plural = `${singular}s`) => `${amount} ${amount > 1 ? plural : singular}`;

/** Secteur visé par un signal, en toutes lettres (« dans un secteur noir », « dans le secteur de Jupiter ») */
const SIGNAL_TARGETS: Partial<Record<SectorType, string>> = {
  [SectorType.RED]: 'dans un secteur rouge',
  [SectorType.YELLOW]: 'dans un secteur jaune',
  [SectorType.BLUE]: 'dans un secteur bleu',
  [SectorType.BLACK]: 'dans un secteur noir',
  [SectorType.ANY]: 'dans un secteur au choix',
  [SectorType.ROW]: "dans le secteur d'une carte de la rangée",
  [SectorType.DECK]: 'dans le secteur de la carte du dessus de la pioche',
  [SectorType.PROBE]: "dans le secteur d'une de vos sondes",
  [SectorType.EARTH]: 'dans le secteur de la Terre',
  [SectorType.MERCURY]: 'dans le secteur de Mercure',
  [SectorType.VENUS]: 'dans le secteur de Vénus',
  [SectorType.MARS]: 'dans le secteur de Mars',
  [SectorType.JUPITER]: 'dans le secteur de Jupiter',
  [SectorType.SATURN]: 'dans le secteur de Saturne',
  [SectorType.OUMUAMUA]: "dans le secteur d'Oumuamua",
};

const LIFE_TRACE_NAMES: Record<LifeTraceType, string> = {
  [LifeTraceType.RED]: 'Trace de vie rouge',
  [LifeTraceType.YELLOW]: 'Trace de vie jaune',
  [LifeTraceType.BLUE]: 'Trace de vie bleue',
  [LifeTraceType.ANY]: 'Trace de vie au choix',
};

/**
 * Gains d'un bonus avec les icônes du livret (PV, crédits, énergie, médias, cartes, données, déplacements, réservation, sondes, orbite, atterrissage, scan,
 * technologies, signaux, traces de vie) ;
 * les autres gains restent écrits en toutes lettres. Avec `tooltips` (dans une infobulle), chaque symbole a son infobulle, le gain en toutes lettres :
 * un symbole répété (2 réservations, 2 traces) en a une par exemplaire.
 */
export const BonusIcons: React.FC<{ bonus?: Bonus | null; size?: number; empty?: React.ReactNode; tooltips?: boolean }> = ({ bonus, size = 16, empty = 'Aucun', tooltips = false }) => {
  const items: React.ReactNode[] = [];
  const withTooltip = (key: string, node: React.ReactNode, label: string) => (tooltips
    ? <HoverTooltip key={key} content={label} nested style={{ alignItems: 'center', cursor: 'help' }}>{node}</HoverTooltip>
    : <React.Fragment key={key}>{node}</React.Fragment>);
  const add = (key: string, node: React.ReactNode, label: string) => items.push(withTooltip(key, node, label));
  // Symbole répété autant de fois que la quantité (sans chiffre) : une infobulle par exemplaire
  const addRepeated = (key: string, amount: number, node: React.ReactNode, label: string) => items.push(
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
      {Array.from({ length: Math.max(1, amount) }, (_, i) => withTooltip(`${key}-${i}`, node, label))}
    </span>
  );
  if (bonus) {
    const rest: Bonus = { ...bonus };
    if (bonus.pv) add('pv', <VictoryPointsIcon amount={bonus.pv} size={size + 2} />, amountLabel(bonus.pv, 'PV', 'PVs'));
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
    if (bonus.revenue) addRepeated('revenue', bonus.revenue, <ReservationIcon size={size} />, 'Réservation');
    if (bonus.probe) addRepeated('probe', bonus.probe, <ActionHexIcon kind="launch" size={size + 2} />, 'Sonde');
    if (bonus.landing) addRepeated('landing', bonus.landing, <ActionHexIcon kind="land" size={size + 2} />, 'Atterrissage');
    if (bonus.scan) addRepeated('scan', bonus.scan, <ActionHexIcon kind="scan" size={size + 2} />, 'Scan');
    (bonus.technologies || []).forEach((t, i) => addRepeated(`tech-${i}`, t.amount, <TechCategoryIcon category={t.scope} size={size + 2} />, t.scope ? `Technologie ${t.scope}` : 'Technologie'));
    const otherSignals = (bonus.signals || []).filter(s => !SIGNAL_SCOPES[s.scope]);
    (bonus.signals || []).forEach((s, i) => {
      const signal = SIGNAL_SCOPES[s.scope];
      if (signal) addRepeated(`signal-${i}`, s.amount, <SignalGainIcon color={signal.color} badge={signal.badge} size={size + 2} />, `Signal ${SIGNAL_TARGETS[s.scope] ?? `(${s.scope})`}`);
    });
    rest.signals = otherSignals.length > 0 ? otherSignals : undefined;
    delete rest.speciesCard; delete rest.token;
    delete rest.probe; delete rest.landing; delete rest.scan; delete rest.technologies;
    delete rest.pv; delete rest.credits; delete rest.energy; delete rest.media; delete rest.data; delete rest.movements; delete rest.revenue; delete rest.card; delete rest.anycard;
    (bonus.lifetraces || []).forEach((l, i) => {
      const color = LIFE_TRACE_ICON[l.scope];
      addRepeated(`trace-${i}`, l.amount, color ? <LifeTraceIcon color={color} size={size} /> : <AnyLifeTraceIcon size={size} />, LIFE_TRACE_NAMES[l.scope]);
    });
    delete rest.lifetraces;
    (ResourceSystem.formatBonus(rest) || []).forEach((text, i) => items.push(<span key={`text-${i}`}>{text}</span>));
  }
  if (items.length === 0) return <>{empty}</>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', verticalAlign: 'middle' }}>{items}</span>;
};
