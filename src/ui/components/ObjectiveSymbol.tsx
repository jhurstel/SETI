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
      <path d="M0 0 H31 L0 31 Z" fill={COLORS.exploration} />
      <path d="M40 9 V40 H9 Z" fill={COLORS.computing} />
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

// Crédit : « C » anguleux traversé de deux barres, comme sur le matériel
const CreditGlyph = () => (
  <g fill="none" stroke="#fff">
    <path d="M25 13.5 H19.5 L14 20 L19.5 26.5 H25" strokeWidth={3.4} strokeLinejoin="miter" />
    <path d="M19 10.5 V15 M23 10.5 V15 M19 25 V29.5 M23 25 V29.5" strokeWidth={1.8} />
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
    <path d="M8 6 H32 Q38 6 35.5 11 L23.5 33 Q20 38.5 16.5 33 L4.5 11 Q2 6 8 6 Z" fill={fill} />
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

// Largeur commune à tous les symboles (3 pictogrammes et le symbole revenu de Revenus A)
const VIEW_WIDTH = 132;
const ITEM_WIDTH = 40;
const MARK_WIDTH = 12;

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
        ? [<Tag fill={COLORS.credit}><CreditGlyph /></Tag>, <Tag fill={COLORS.energy}><EnergyGlyph /></Tag>, <Tag fill={COLORS.card}><CardGlyph /></Tag>, <RevenueMark x={3} y={33} />]
        : [<g><Tag fill={COLORS.credit}><CreditGlyph /></Tag><RevenueMark x={34} y={33} /></g>, <Slash />, <g><Tag fill={COLORS.energy}><EnergyGlyph /></Tag><RevenueMark x={34} y={33} /></g>];
    case 'obj_other':
      return tile.side === 'A'
        ? [
          // Molécule : grosse sphère reliée à deux petites en haut et une moyenne en bas
          <LifeTrace fill={COLORS.lifeRed}>
            <path d="M11.5 10.5 L20 16.5 L28.5 10.5 M20 16.5 V25" fill="none" stroke="#fff" strokeWidth={2.4} />
            <circle cx={20} cy={16.5} r={5.2} fill="#fff" /><circle cx={11.5} cy={10.5} r={2.6} fill="#fff" /><circle cx={28.5} cy={10.5} r={2.6} fill="#fff" /><circle cx={20} cy={25.5} r={3.4} fill="#fff" />
          </LifeTrace>,
          // Roche fendue
          <LifeTrace fill={COLORS.lifeYellow}>
            <path d="M12.5 13 L17 8.5 L24.5 9 L28.5 14 L27 20.5 L20.5 26 L14.5 23 Z" fill="#fff" />
            <path d="M15.5 11 L16.5 18 L19.5 15.5 L20 22 M22 9.5 L21.5 14 L25 13" fill="none" stroke={COLORS.lifeYellow} strokeWidth={1.6} strokeLinejoin="round" />
          </LifeTrace>,
          // Micro-organismes : deux filaments et quelques points
          <LifeTrace fill={COLORS.lifeBlue}>
            <path d="M15.5 9.5 Q11.5 11.5 14.5 14.5 Q17.5 17.5 13.5 20.5 M23 9 Q28 9.5 25.5 13.5 Q23 17.5 26.5 19.5 Q29 22 24.5 24.5" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" />
            <circle cx={30.5} cy={10} r={0.9} fill="#fff" /><circle cx={19.5} cy={19} r={0.9} fill="#fff" /><circle cx={28.5} cy={25} r={0.9} fill="#fff" /><circle cx={10} cy={13} r={0.9} fill="#fff" />
          </LifeTrace>,
        ]
        : [<CoveredSector />, <OrbiterOrLander />];
    default:
      return [];
  }
};

/** Symbole d'une tuile Score dorée (face A ou B) */
export const ObjectiveSymbol: React.FC<{ tile: ObjectiveTile; height?: number }> = ({ tile, height = 30 }) => {
  const items = symbolItems(tile);
  // Le symbole revenu seul (Revenus A) n'occupe qu'une petite place à droite
  const widths = items.map(item => React.isValidElement(item) && item.type === RevenueMark ? MARK_WIDTH : ITEM_WIDTH);
  let x = (VIEW_WIDTH - widths.reduce((a, b) => a + b, 0)) / 2;
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} 40`} height={height} width={(height * VIEW_WIDTH) / 40} role="img" aria-label={tile.name}>
      {items.map((item, i) => {
        const g = <g key={i} transform={`translate(${x} 0)`}>{item}</g>;
        x += widths[i];
        return g;
      })}
    </svg>
  );
};
