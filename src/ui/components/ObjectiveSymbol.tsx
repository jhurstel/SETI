import React from 'react';
import { ObjectiveTile } from '../../core/types';

// Symboles des tuiles Score dorées, redessinés d'après le livret de règles (p. 21).
// Chaque pictogramme est dessiné dans une case de 40 × 40, puis placé côte à côte.

const COLORS = {
  exploration: '#f28c1e',
  observation: '#e5197e',
  computing: '#1f78c8',
  credit: '#7d6116',
  energy: '#3daa4a',
  card: '#3b3b3b',
  check: '#4caf50',
  lifeRed: '#e5197e',
  lifeYellow: '#e8a21a',
  lifeBlue: '#1ea7e8',
  sector: '#a9a9a9',
};

/** Puce de technologie : octogone à broches */
const Chip: React.FC<{ fill: string; children?: React.ReactNode }> = ({ fill, children }) => {
  const pins = [10, 16, 22, 28];
  return (
    <g>
      {pins.map(p => (
        <g key={p} stroke={fill} strokeWidth={2.2} strokeLinecap="round">
          <line x1={p + 1} y1={2} x2={p + 1} y2={6} />
          <line x1={p + 1} y1={34} x2={p + 1} y2={38} />
          <line x1={2} y1={p + 1} x2={6} y2={p + 1} />
          <line x1={34} y1={p + 1} x2={38} y2={p + 1} />
        </g>
      ))}
      <path d="M12 5 H28 L35 12 V28 L28 35 H12 L5 28 V12 Z" fill={fill} />
      {children}
    </g>
  );
};

const Rocket = () => (
  <path d="M20 8 C23 11 24 15 24 20 V27 L27 30 H13 L16 27 V20 C16 15 17 11 20 8 Z M18.5 30 H21.5 L20 33 Z" fill="#fff" />
);

const Dish = () => (
  <g fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
    <path d="M10 15 C12 24 20 28 27 24 Z" fill="#fff" />
    <line x1={17} y1={20} x2={25} y2={12} />
    <circle cx={26} cy={11} r={1.6} fill="#fff" />
    <path d="M18 26 L16 32 H25 L22 26" fill="#fff" />
  </g>
);

const Server = () => (
  <g fill="#fff">
    {[10, 17, 24].map(y => (
      <g key={y}>
        <rect x={10} y={y} width={20} height={5.5} rx={1} />
        <circle cx={26.5} cy={y + 2.75} r={1.1} fill={COLORS.computing} />
      </g>
    ))}
  </g>
);

/** Technologie quelconque : puce rayée des trois couleurs */
const AnyTech: React.FC<{ id: string }> = ({ id }) => (
  <g>
    <defs>
      <clipPath id={id}>
        <path d="M12 5 H28 L35 12 V28 L28 35 H12 L5 28 V12 Z" />
      </clipPath>
    </defs>
    <Chip fill={COLORS.observation} />
    <g clipPath={`url(#${id})`}>
      <path d="M0 0 H27 L0 27 Z" fill={COLORS.exploration} />
      <path d="M40 13 V40 H13 Z" fill={COLORS.computing} />
    </g>
  </g>
);

const Check: React.FC<{ x: number; y: number; size?: number; color?: string }> = ({ x, y, size = 1, color = COLORS.check }) => (
  <path transform={`translate(${x} ${y}) scale(${size})`} d="M0 5 L4 9 L12 0" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
);

/** Carte Mission accomplie */
const MissionCard = () => (
  <g>
    <rect x={10} y={4} width={20} height={30} rx={3} fill="#fff" stroke="#333" strokeWidth={1.8} />
    <path d="M10.9 20 H29.1 V31 A2.2 2.2 0 0 1 26.9 33.1 H13.1 A2.2 2.2 0 0 1 10.9 31 Z" fill="#c9c9c9" />
    <Check x={17} y={23} />
  </g>
);

/** Carte Mission accomplie ou Fin de partie : carte jaune barrée d'une diagonale */
const MissionOrEndCard = () => (
  <g>
    <rect x={10} y={4} width={20} height={30} rx={3} fill="#fff" stroke="#333" strokeWidth={1.8} />
    <path d="M10.9 18 H29.1 V20 L13 33.1 A2.2 2.2 0 0 1 10.9 31 Z" fill="#f2c500" />
    <path d="M29.1 20 V31 A2.2 2.2 0 0 1 26.9 33.1 H13 Z" fill="#c9c9c9" />
    <line x1={7} y1={36} x2={33} y2={8} stroke="#111" strokeWidth={2.4} />
    <Check x={20} y={24} size={0.8} />
  </g>
);

/** Ressource réservée sous les revenus : étiquette à coin coupé */
const Tag: React.FC<{ fill: string; children: React.ReactNode }> = ({ fill, children }) => (
  <g>
    <path d="M10 9 H34 V31 H4 V17 Z" fill={fill} stroke="rgba(255, 240, 200, 0.7)" strokeWidth={1.2} />
    {children}
  </g>
);

// « C » barré du crédit
const CreditGlyph = () => (
  <g fill="none" stroke="#fff" strokeLinecap="round">
    <path d="M24 14.5 A7 7 0 1 0 24 25.5" strokeWidth={3.2} />
    <line x1={19} y1={10} x2={19} y2={30} strokeWidth={2} />
  </g>
);
const EnergyGlyph = () => <path d="M21 11 L14 22 H19 L17 30 L25 18 H20 Z" fill="#fff" />;
const CardGlyph = () => (
  <g>
    <rect x={13} y={12} width={12} height={16} rx={1.5} fill="#fff" />
    <text x={19} y={25} textAnchor="middle" fontSize={11} fontWeight="bold" fill={COLORS.card} fontFamily="Arial, sans-serif">?</text>
  </g>
);

/** Petit symbole « revenu » (graphique montant) */
const RevenueMark: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={6} fill="#fff" stroke="#333" strokeWidth={1} />
    <rect x={-3.5} y={0} width={1.8} height={3} fill={COLORS.energy} />
    <rect x={-1} y={-1.5} width={1.8} height={4.5} fill="#333" />
    <rect x={1.5} y={-3} width={1.8} height={6} fill="#333" />
    <path d="M-4 -1 L0 -3.5 L3.5 -5" fill="none" stroke="#333" strokeWidth={0.9} />
  </g>
);

/** Trace de vie : triangle pointe en bas */
const LifeTrace: React.FC<{ fill: string; children: React.ReactNode }> = ({ fill, children }) => (
  <g>
    <path d="M6 8 Q4 6 7 6 H33 Q36 6 34 8 L22 33 Q20 36 18 33 Z" fill={fill} />
    {children}
  </g>
);

/** Secteur couvert : bande de secteur avec signal, et coche */
const CoveredSector = () => (
  <g>
    <path d="M2 10 Q20 5 38 10 L35 28 Q20 24 5 28 Z" fill={COLORS.sector} />
    {[10, 14, 18, 22, 26, 30].map((x, i) => (
      <rect key={x} x={x - 0.9} y={17 - [2, 4, 6, 6, 4, 2][i]} width={1.8} height={[2, 4, 6, 6, 4, 2][i] * 2} rx={0.9} fill="#fff" />
    ))}
    <circle cx={30} cy={29} r={8} fill="#333" stroke="#fff" strokeWidth={1.2} />
    <Check x={25.5} y={25} size={0.75} color="#fff" />
  </g>
);

/** Orbiteur ou atterrisseur : disque coupé en diagonale */
const OrbiterOrLander = () => (
  <g>
    <circle cx={20} cy={20} r={16} fill={COLORS.lifeYellow} />
    <path d="M8.7 31.3 A16 16 0 0 1 31.3 8.7 Z" fill={COLORS.energy} />
    {/* satellite */}
    <g transform="translate(15 15) rotate(-45)" fill="#fff">
      <rect x={-2} y={-2.5} width={4} height={5} />
      <rect x={-8} y={-1.5} width={5} height={3} />
      <rect x={3} y={-1.5} width={5} height={3} />
    </g>
    {/* atterrisseur */}
    <g fill="#fff" transform="translate(26 24)">
      <rect x={-4} y={-3} width={8} height={4} rx={1} />
      <circle cx={-3.5} cy={3.5} r={1.4} />
      <circle cx={0} cy={3.5} r={1.4} />
      <circle cx={3.5} cy={3.5} r={1.4} />
    </g>
  </g>
);

/** Séparateur « / » entre deux possibilités */
const Slash = () => <line x1={23} y1={10} x2={17} y2={30} stroke="#8a6d1d" strokeWidth={3} strokeLinecap="round" />;

const row = (items: React.ReactNode[], width = 40) => items.map((item, i) => (
  <g key={i} transform={`translate(${i * width} 0)`}>{item}</g>
));

const symbolItems = (tile: ObjectiveTile): React.ReactNode[] => {
  const uid = `${tile.id}-${tile.side}`;
  switch (tile.id) {
    case 'obj_tech':
      return tile.side === 'A'
        ? [<Chip fill={COLORS.exploration}><Rocket /></Chip>, <Chip fill={COLORS.observation}><Dish /></Chip>, <Chip fill={COLORS.computing}><Server /></Chip>]
        : [<AnyTech id={`${uid}-1`} />, <AnyTech id={`${uid}-2`} />];
    case 'obj_mission':
      return tile.side === 'A' ? [<MissionCard />] : [<MissionOrEndCard />, <MissionOrEndCard />];
    case 'obj_revenue':
      return tile.side === 'A'
        ? [<Tag fill={COLORS.credit}><CreditGlyph /></Tag>, <Tag fill={COLORS.energy}><EnergyGlyph /></Tag>, <g><Tag fill={COLORS.card}><CardGlyph /></Tag><RevenueMark x={34} y={33} /></g>]
        : [<g><Tag fill={COLORS.credit}><CreditGlyph /></Tag><RevenueMark x={34} y={33} /></g>, <Slash />, <g><Tag fill={COLORS.energy}><EnergyGlyph /></Tag><RevenueMark x={34} y={33} /></g>];
    case 'obj_other':
      return tile.side === 'A'
        ? [
          <LifeTrace fill={COLORS.lifeRed}><circle cx={20} cy={16} r={4} fill="#fff" /><circle cx={13} cy={12} r={2} fill="#fff" /><circle cx={27} cy={12} r={2} fill="#fff" /><circle cx={20} cy={24} r={2.4} fill="#fff" /></LifeTrace>,
          <LifeTrace fill={COLORS.lifeYellow}><path d="M14 11 L22 9 L27 14 L24 22 L17 22 L13 16 Z M19 12 L18 17 L22 16" fill="#fff" stroke={COLORS.lifeYellow} strokeWidth={1} /></LifeTrace>,
          <LifeTrace fill={COLORS.lifeBlue}><path d="M12 13 C15 9 19 15 22 11 C25 8 28 12 26 15 C24 18 20 15 18 19 C16 23 21 24 19 27" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" /></LifeTrace>,
        ]
        : [<CoveredSector />, <OrbiterOrLander />];
    default:
      return [];
  }
};

/** Symbole d'une tuile Score dorée (face A ou B) */
export const ObjectiveSymbol: React.FC<{ tile: ObjectiveTile; height?: number }> = ({ tile, height = 30 }) => {
  const items = symbolItems(tile);
  const width = Math.max(1, items.length) * 40;
  return (
    <svg viewBox={`0 0 ${width} 40`} height={height} width={(height * width) / 40} role="img" aria-label={tile.name}>
      {row(items)}
    </svg>
  );
};
