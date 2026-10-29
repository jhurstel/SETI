import React from 'react';
import { ObjectiveTile } from '../../core/types';
import { LifeTraceShape } from './GameIcons';

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

/** Symbole « revenu » : rosette blanche, barres montantes et flèche en zigzag */
const RevenueMark: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const bumps = Array.from({ length: 10 }, (_, i) => (i * Math.PI) / 5);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g fill="#fff" stroke="rgba(60, 40, 0, 0.45)" strokeWidth={0.6}>
        <circle r={6.2} />
        {bumps.map(a => <circle key={a} cx={6 * Math.cos(a)} cy={6 * Math.sin(a)} r={1.6} />)}
      </g>
      <circle r={6.4} fill="#fff" />
      <rect x={-2.6} y={2.2} width={2} height={2} fill={COLORS.energy} />
      <rect x={1.2} y={-0.6} width={1.9} height={4.8} rx={0.4} fill="#d6a21c" />
      <path d="M-4.4 1.6 L-1.8 -1.2 L-0.6 0.2 L2.9 -3.6" fill="none" stroke="#1d1d1d" strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M1.2 -4.4 L3.9 -4.6 L3.6 -1.9 Z" fill="#1d1d1d" />
    </g>
  );
};

/** Symbole « réservation » (revenu) seul, pour les emplacements qui en donnent une */
export const ReservationIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="-9 -9 18 18" style={{ display: 'block' }}>
    <RevenueMark x={0} y={0} />
  </svg>
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

/** Orbiteur ou atterrisseur : disque coupé en diagonale, satellite (vert) en haut à gauche, atterrisseur (jaune) en bas à droite */
const OrbiterOrLander = () => (
  <g>
    <circle cx={20} cy={20} r={17} fill={COLORS.lifeYellow} />
    <path d="M7.98 32.02 A17 17 0 0 1 32.02 7.98 Z" fill={COLORS.energy} />
    <line x1={7.98} y1={32.02} x2={32.02} y2={7.98} stroke="#fff" strokeWidth={1.2} />
    {/* satellite : corps et deux panneaux solaires */}
    <g transform="translate(14 14) rotate(-45)" fill="#fff">
      <rect x={-2.6} y={-3.2} width={5.2} height={6.4} rx={0.8} />
      <rect x={-9.5} y={-2} width={6} height={4} rx={0.5} />
      <rect x={3.5} y={-2} width={6} height={4} rx={0.5} />
      <line x1={0} y1={3.2} x2={0} y2={5.5} stroke="#fff" strokeWidth={1.2} />
    </g>
    {/* atterrisseur : caisse, antenne et trois roues */}
    <g fill="#fff" transform="translate(26.5 25.5)">
      <rect x={-5} y={-4} width={10} height={4.5} rx={1} />
      <line x1={2.5} y1={-4} x2={4} y2={-7.5} stroke="#fff" strokeWidth={1.2} />
      <circle cx={-4} cy={2.6} r={1.7} />
      <circle cx={0} cy={2.6} r={1.7} />
      <circle cx={4} cy={2.6} r={1.7} />
    </g>
  </g>
);

/** Orbiteur ou atterrisseur seul (icône du panneau des planètes) */
export const OrbiterOrLanderIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="2 2 36 36" style={{ display: 'block' }}>
    <OrbiterOrLander />
  </svg>
);

/** Technologie quelconque seule (icône du panneau des technologies) */
export const AnyTechIcon: React.FC<{ size?: number }> = ({ size = 22 }) => {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block' }}>
      <AnyTech id={`anytech-${uid}`} />
    </svg>
  );
};

/** Séparateur « / » entre deux possibilités */
const Slash = () => <line x1={23} y1={10} x2={17} y2={30} stroke="#8a6d1d" strokeWidth={3} strokeLinecap="round" />;

// Cadre commun : 3 pictogrammes et le symbole revenu du coin
const VIEW_WIDTH = 136;
const VIEW_HEIGHT = 44;
const ITEM_WIDTH = 40;
const VIEW_MARGIN = 3;
const PANEL_CORNER = 7;
const SEPARATOR_WIDTH = 16;

/** Réduit un pictogramme autour du centre de sa case (les broches des puces dépasseraient du creux) */
const Shrink: React.FC<{ children: React.ReactNode; scale?: number }> = ({ children, scale = 0.82 }) => (
  <g transform={`translate(20 20) scale(${scale}) translate(-20 -20)`}>{children}</g>
);

/** Creux gravé de la tuile : rectangle à coins coupés qui regroupe une série */
const Panel: React.FC<{ width: number }> = ({ width }) => {
  const c = PANEL_CORNER, h = 38, y = 1;
  return (
    <path
      d={`M${c} ${y} H${width - c} L${width} ${y + c} V${y + h - c} L${width - c} ${y + h} H${c} L0 ${y + h - c} V${y + c} Z`}
      fill="rgba(70, 50, 0, 0.18)" stroke="rgba(60, 40, 0, 0.6)" strokeWidth={1.2}
    />
  );
};

interface SymbolLayout {
  /** Séries de pictogrammes, chacune dans son creux */
  groups: React.ReactNode[][];
  /** Symbole revenu sur le coin bas droit de chaque creux */
  revenue?: boolean;
}

const symbolLayout = (tile: ObjectiveTile): SymbolLayout => {
  const uid = `${tile.id}-${tile.side}`;
  switch (tile.id) {
    case 'obj_tech':
      return tile.side === 'A'
        ? { groups: [[<Shrink><Chip fill={COLORS.exploration}><Rocket /></Chip></Shrink>, <Shrink><Chip fill={COLORS.observation}><Dish /></Chip></Shrink>, <Shrink><Chip fill={COLORS.computing}><Server /></Chip></Shrink>]] }
        : { groups: [[<Shrink><AnyTech id={`${uid}-1`} /></Shrink>, <Shrink><AnyTech id={`${uid}-2`} /></Shrink>]] };
    case 'obj_mission':
      return { groups: [tile.side === 'A' ? [<MissionCard />] : [<MissionOrEndCard />, <MissionOrEndCard />]] };
    case 'obj_revenue':
      // A : une série des 3 types dans un seul creux ; B : chaque type compte seul (deux creux séparés par « / »)
      return tile.side === 'A'
        ? { groups: [[<Tag fill={COLORS.credit}><CreditGlyph /></Tag>, <Tag fill={COLORS.energy}><EnergyGlyph /></Tag>, <Tag fill={COLORS.card}><CardGlyph /></Tag>]], revenue: true }
        : { groups: [[<Tag fill={COLORS.credit}><CreditGlyph /></Tag>], [<Tag fill={COLORS.energy}><EnergyGlyph /></Tag>]], revenue: true };
    case 'obj_other':
      return tile.side === 'A'
        ? { groups: [[
          <LifeTraceShape color="red" />,
          <LifeTraceShape color="yellow" />,
          <LifeTraceShape color="blue" />,
        ]] }
        : { groups: [[<CoveredSector />, <OrbiterOrLander />]] };
    default:
      return { groups: [] };
  }
};

/** Symbole d'une tuile Score dorée (face A ou B) */
export const ObjectiveSymbol: React.FC<{ tile: ObjectiveTile; height?: number }> = ({ tile, height = 32 }) => {
  const { groups, revenue } = symbolLayout(tile);
  // Les creux occupent toute la largeur, comme sur la tuile ; plusieurs creux se la partagent
  const separators = SEPARATOR_WIDTH * Math.max(0, groups.length - 1);
  const groupWidths = groups.map(() => (VIEW_WIDTH - 2 * VIEW_MARGIN - separators) / groups.length);
  const total = groupWidths.reduce((a, b) => a + b, 0) + SEPARATOR_WIDTH * Math.max(0, groups.length - 1);
  let x = (VIEW_WIDTH - total) / 2;
  const parts: React.ReactNode[] = [];
  groups.forEach((items, g) => {
    if (g > 0) {
      parts.push(<g key={`sep-${g}`} transform={`translate(${x + SEPARATOR_WIDTH / 2 - 20} 0)`}><Slash /></g>);
      x += SEPARATOR_WIDTH;
    }
    const w = groupWidths[g];
    parts.push(
      <g key={g} transform={`translate(${x} 0)`}>
        <Panel width={w} />
        {items.map((item, i) => <g key={i} transform={`translate(${(w - items.length * ITEM_WIDTH) / 2 + i * ITEM_WIDTH} 0)`}>{item}</g>)}
        {revenue && <RevenueMark x={w - PANEL_CORNER / 2} y={39 - PANEL_CORNER / 2} />}
      </g>
    );
    x += w;
  });
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} height={height} width={(height * VIEW_WIDTH) / VIEW_HEIGHT} role="img" aria-label={tile.name}>
      {parts}
    </svg>
  );
};
