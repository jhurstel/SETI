import React, { useId } from 'react';
import { LIFE_TRACE_COLORS, LifeTraceColor } from '../styles/lifeTraceColors';

// Icônes du matériel redessinées d'après le livret de règles : actions principales (hexagones, p. 7),
// symbole « signal » (p. 12) et tuiles Technologie (p. 17).

const useUid = () => useId().replace(/[^a-zA-Z0-9_-]/g, '');

/* ------------------------------------------------------------------ */
/* Actions principales : hexagone coloré, intérieur sombre, pictogramme */
/* ------------------------------------------------------------------ */

export type ActionIconKind = 'launch' | 'orbit' | 'land' | 'scan' | 'analyze' | 'card' | 'research' | 'pass';

const HEX = 'M0 -46 L39.8 -23 L39.8 23 L0 46 L-39.8 23 L-39.8 -23 Z';
const HEX_INNER = 'M0 -38 L32.9 -19 L32.9 19 L0 38 L-32.9 19 L-32.9 -19 Z';

const ACTION_STYLES: Record<ActionIconKind, { frame: string; inner: string; glyph: string }> = {
  launch: { frame: '#f28c1e', inner: '#3d1a08', glyph: '#ff9a3c' },
  orbit: { frame: '#8ccf2e', inner: '#123d10', glyph: '#a6e64a' },
  land: { frame: '#f5c400', inner: '#3d2a05', glyph: '#ffcf3a' },
  scan: { frame: '#e5197e', inner: '#3a0b2a', glyph: '#f05aa6' },
  analyze: { frame: '#2f9be8', inner: '#0b2340', glyph: '#44b4ff' },
  card: { frame: '#c8cdd8', inner: '#2b3040', glyph: '#ffffff' },
  research: { frame: '#ffffff', inner: '#f2f2f2', glyph: '#e5197e' },
  pass: { frame: '#c8cdd8', inner: '#2b3040', glyph: '#ff2a2a' },
};

const actionGlyph = (kind: ActionIconKind, c: string): React.ReactNode => {
  switch (kind) {
    case 'launch':
      // Navette et ses fumées
      return (
        <g fill={c}>
          <path d="M0 -26 C6 -18 7 -8 7 4 L13 14 H-13 L-7 4 C-7 -8 -6 -18 0 -26 Z" />
          <path d="M-5 16 H5 L3 24 H-3 Z" />
          <circle cx={-16} cy={22} r={6} opacity={0.6} /><circle cx={16} cy={22} r={6} opacity={0.6} />
          <circle cx={-22} cy={-6} r={4} opacity={0.45} /><circle cx={22} cy={-10} r={5} opacity={0.45} />
        </g>
      );
    case 'orbit':
      // Satellite au-dessus de sa trajectoire
      return (
        <g>
          <path d="M-30 26 Q0 4 30 18" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" opacity={0.75} />
          <g transform="rotate(-35)" fill={c}>
            <rect x={-5} y={-7} width={10} height={14} rx={1.5} />
            <rect x={-27} y={-5} width={19} height={10} rx={1} />
            <rect x={8} y={-5} width={19} height={10} rx={1} />
          </g>
          <circle cx={-18} cy={-22} r={1.6} fill={c} /><circle cx={22} cy={-18} r={1.6} fill={c} />
        </g>
      );
    case 'land':
      // Atterrisseur : mât, plateforme, trois roues, poussière
      return (
        <g fill={c}>
          <rect x={-1.5} y={-28} width={3} height={18} />
          <rect x={-20} y={-12} width={40} height={4} rx={1} />
          <path d="M-14 -8 H14 L10 6 H-10 Z" />
          {[-14, 0, 14].map(x => <circle key={x} cx={x} cy={14} r={6} />)}
          <ellipse cx={0} cy={22} rx={28} ry={5} opacity={0.4} />
        </g>
      );
    case 'scan':
      // Radiotélescope
      return (
        <g fill={c}>
          <path d="M-22 -14 C-18 6 2 16 18 10 C6 2 -6 -6 -22 -14 Z" />
          <line x1={-2} y1={0} x2={14} y2={-16} stroke={c} strokeWidth={3} />
          <circle cx={15} cy={-17} r={3} />
          <path d="M-6 8 L-12 26 H10 L4 10 Z" />
        </g>
      );
    case 'analyze':
      // Ordinateur : trois baies de données sur un pied
      return (
        <g>
          <rect x={-20} y={-24} width={40} height={36} rx={2} fill="none" stroke={c} strokeWidth={2.5} />
          {[-19, -7, 5].map(y => (
            <g key={y}>
              <rect x={-16} y={y} width={32} height={8} rx={1} fill="none" stroke={c} strokeWidth={2} />
              <rect x={-13} y={y + 2.5} width={8} height={3} fill={c} />
            </g>
          ))}
          <line x1={0} y1={12} x2={0} y2={22} stroke={c} strokeWidth={2.5} />
          <line x1={-14} y1={22} x2={14} y2={22} stroke={c} strokeWidth={2.5} />
          <circle cx={0} cy={22} r={3} fill={c} />
        </g>
      );
    case 'card':
      // Carte jouée (flèche verte)
      return (
        <g>
          <rect x={-22} y={-20} width={24} height={34} rx={2.5} fill="#f4f4f4" transform="rotate(-8 -10 -3)" />
          <path d="M-2 -10 Q16 -14 18 4" fill="none" stroke="#1fb28a" strokeWidth={7} strokeLinecap="round" />
          <path d="M10 2 L18 14 L26 2 Z" fill="#1fb28a" />
        </g>
      );
    case 'research':
      // Puce de technologie aux trois couleurs
      return (
        <g>
          <clipPath id="seti-research-chip"><path d="M-14 -22 H14 L24 -12 V12 L14 22 H-14 L-24 12 V-12 Z" /></clipPath>
          <g clipPath="url(#seti-research-chip)">
            <rect x={-26} y={-26} width={52} height={52} fill="#e5197e" />
            <path d="M-26 -26 H8 L-26 8 Z" fill="#f28c1e" />
            <path d="M26 -6 V26 H-6 Z" fill="#2f9be8" />
          </g>
        </g>
      );
    case 'pass':
      return (
        <g stroke={c} strokeWidth={10} strokeLinecap="square">
          <line x1={-15} y1={-15} x2={15} y2={15} /><line x1={15} y1={-15} x2={-15} y2={15} />
        </g>
      );
  }
};

/** Hexagone d'action principale (livret p. 7) */
export const ActionHexIcon: React.FC<{ kind: ActionIconKind; size?: number }> = ({ kind, size = 28 }) => {
  const uid = useUid();
  const st = ACTION_STYLES[kind];
  const isResearch = kind === 'research';
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`hex-in-${uid}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={st.inner} stopOpacity={isResearch ? 1 : 0.75} />
          <stop offset="100%" stopColor={isResearch ? '#dcdcdc' : '#05060a'} />
        </radialGradient>
        {isResearch && (
          <linearGradient id={`hex-tri-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f28c1e" /><stop offset="33%" stopColor="#f28c1e" />
            <stop offset="34%" stopColor="#e5197e" /><stop offset="66%" stopColor="#e5197e" />
            <stop offset="67%" stopColor="#2f9be8" /><stop offset="100%" stopColor="#2f9be8" />
          </linearGradient>
        )}
      </defs>
      <path d={HEX} fill={`url(#hex-in-${uid})`} stroke={isResearch ? `url(#hex-tri-${uid})` : st.frame} strokeWidth={7} strokeLinejoin="round" />
      <path d={HEX_INNER} fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth={1.5} strokeLinejoin="round" />
      {actionGlyph(kind, st.glyph)}
    </svg>
  );
};

/* ---------------------------------------------------- */
/* Signal (livret p. 12) : disque gris à barres sonores */
/* ---------------------------------------------------- */

export type SignalBadge = 'earth' | 'card' | 'mercury' | 'discard';

const SignalBars: React.FC<{ color?: string }> = ({ color = '#ffffff' }) => (
  <g fill={color}>
    <rect x={-13} y={-8} width={7} height={16} rx={3.5} />
    <rect x={-3.5} y={-14} width={7} height={28} rx={3.5} />
    <rect x={6} y={-6} width={7} height={12} rx={3.5} />
  </g>
);

const signalBadge = (badge: SignalBadge): React.ReactNode => {
  switch (badge) {
    case 'earth':
      return (
        <g transform="translate(20 20)">
          <circle r={15} fill="#1f2a44" stroke="#0b0f1e" strokeWidth={1.5} />
          <path d="M-9 -8 C-4 -12 2 -10 1 -5 C0 0 -6 0 -5 5 C-4 10 -9 9 -11 4 C-12 0 -12 -5 -9 -8 Z M4 2 C8 0 12 4 10 9 C7 12 3 9 4 2 Z M5 -11 C9 -10 11 -6 8 -5 Z" fill="#f2f2f2" />
        </g>
      );
    case 'card':
      // Carte de la rangée : carte blanche au coin sombre
      return (
        <g transform="translate(20 18)">
          <rect x={-10} y={-14} width={20} height={28} rx={2.5} fill="#f4f4f4" stroke="#2a2a2a" strokeWidth={2} />
          <path d="M2 -14 H7.5 Q10 -14 10 -11.5 V-4 Z" fill="#2a2a2a" />
        </g>
      );
    case 'mercury':
      return (
        <g transform="translate(20 20)">
          <circle r={14} fill="#c95aa8" stroke="#0b0f1e" strokeWidth={1.5} />
          <circle cx={-4} cy={-3} r={3} fill="#a8468a" /><circle cx={5} cy={4} r={2.2} fill="#a8468a" /><circle cx={2} cy={-7} r={1.5} fill="#a8468a" />
        </g>
      );
    case 'discard':
      // Carte défaussée : carte barrée d'une croix rouge
      return (
        <g transform="translate(20 18) rotate(-12)">
          <rect x={-10} y={-14} width={20} height={28} rx={2.5} fill="#f4f4f4" stroke="#2a2a2a" strokeWidth={2} />
          <g stroke="#ff2a2a" strokeWidth={3.5} strokeLinecap="round"><line x1={-5} y1={-6} x2={5} y2={4} /><line x1={5} y1={-6} x2={-5} y2={4} /></g>
        </g>
      );
  }
};

/** Symbole « signal », avec un badge précisant le secteur (Terre, carte de la rangée, Mercure, carte défaussée) */
/** Carte de la rangée seule (carte blanche au coin haut droit noir), comme sur la piste d'observation */
export const RowCardIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="4 2 32 32" style={{ display: 'block' }}>
    {signalBadge('card')}
  </svg>
);

export const SignalIcon: React.FC<{ badge?: SignalBadge; size?: number }> = ({ badge, size = 28 }) => (
  <svg width={size} height={size} viewBox="-30 -30 60 60" style={{ display: 'block', overflow: 'visible' }}>
    <circle r={24} fill="#b8b8b8" />
    <SignalBars />
    {badge && <g transform="scale(0.8)">{signalBadge(badge)}</g>}
  </svg>
);

/* --------------------------------------------- */
/* Tuiles Technologie (livret p. 17), sans texte */
/* --------------------------------------------- */

const TILE_COLORS = {
  exploration: { light: '#f47a2a', dark: '#c94a10', edge: '#6e2208' },
  observation: { light: '#c23aae', dark: '#8e1f80', edge: '#4a0c42' },
  computing: { light: '#2f86d8', dark: '#1a5aa6', edge: '#0c2c5c' },
};

/** Petit hexagone d'action dans une tuile */
const MiniHex: React.FC<{ kind: ActionIconKind; x: number; y: number; r?: number }> = ({ kind, x, y, r = 9 }) => {
  const st = ACTION_STYLES[kind];
  const s = r / 46;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={HEX} fill={st.inner} stroke={st.frame} strokeWidth={7} strokeLinejoin="round" />
      {actionGlyph(kind, st.glyph)}
    </g>
  );
};

/** Pastille Déplacement réduite pour une tuile, avec un nombre éventuel */
const MiniMovement: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <g transform={`translate(${x} ${y}) scale(${label ? 0.42 : 0.36})`}>
    <Movement amount={label} />
  </g>
);

/** Pastille de ressource du matériel (flèche colorée, symbole et nombre), réduite pour une tuile */
const MiniResource: React.FC<{ kind: 'credit' | 'energy' | 'media'; x: number; y: number; label: string }> = ({ kind, x, y, label }) => {
  // Le signe (+ / −) se place devant la pastille, le chiffre dessus comme sur le matériel
  const sign = label[0] === '+' || label[0] === '-' ? label[0] : '';
  return (
    <g transform={`translate(${x} ${y}) scale(0.42)`}>
      {sign && <text x={-22} y={9} textAnchor="end" fontSize={30} fontWeight={900} fill="#fff" stroke="#2b2b2b" strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{sign === '-' ? '−' : '+'}</text>}
      <ArrowResource kind={kind} amount={label.slice(sign.length)} />
    </g>
  );
};

const SmallSignal: React.FC<{ x: number; y: number; badge?: SignalBadge }> = ({ x, y, badge }) => (
  <g transform={`translate(${x} ${y}) scale(0.5)`}>
    <circle r={24} fill="#b8b8b8" />
    <SignalBars />
    {badge && <g transform="scale(0.8)">{signalBadge(badge)}</g>}
  </g>
);

const Satellite: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y}) rotate(-40)`} fill="#fff">
    <rect x={-3} y={-4} width={6} height={8} rx={1} />
    <rect x={-13} y={-3} width={9} height={6} rx={0.6} />
    <rect x={4} y={-3} width={9} height={6} rx={0.6} />
  </g>
);

const tileGlyph = (techId: string): React.ReactNode => {
  if (techId.startsWith('exploration-1')) return <><Satellite x={29} y={30} /><Satellite x={29} y={52} /></>;
  if (techId.startsWith('exploration-2')) {
    // Champ d'astéroïdes : +1 Média à la visite
    return (
      <>
        <path d="M14 46 L22 34 L36 33 L44 42 L40 54 L26 58 L16 54 Z" fill="#2b2b2b" stroke="#fff" strokeWidth={1} />
        <circle cx={26} cy={44} r={2} fill="#555" /><circle cx={36} cy={48} r={1.5} fill="#555" />
        <MiniResource kind="media" x={38} y={22} label="+1" />
        {/* Quitter le champ d'astéroïdes ne coûte plus de déplacement supplémentaire */}
        <MiniMovement x={38} y={68} label="1" />
      </>
    );
  }
  if (techId.startsWith('exploration-3')) {
    // Atterrissage : 1 Énergie de moins
    return <><MiniHex kind="land" x={29} y={32} r={12} /><MiniResource kind="energy" x={31} y={60} label="-1" /></>;
  }
  if (techId.startsWith('exploration-4')) {
    // Lunes
    return (
      <>
        <circle cx={26} cy={40} r={13} fill="#4a4036" stroke="#fff" strokeWidth={1} />
        <circle cx={22} cy={36} r={3} fill="#f2ead8" /><circle cx={30} cy={44} r={2} fill="#f2ead8" /><circle cx={28} cy={33} r={1.4} fill="#f2ead8" />
        <MiniHex kind="land" x={38} y={52} r={8} />
      </>
    );
  }
  if (techId.startsWith('observation-1')) {
    // Signal sur la Terre ou un secteur adjacent (arc)
    return (
      <>
        <path d="M14 36 A16 16 0 0 1 44 36" fill="none" stroke="#fff" strokeWidth={3} pathLength={30} strokeDasharray="8 3" />
        <SmallSignal x={29} y={46} badge="earth" />
      </>
    );
  }
  if (techId.startsWith('observation-2')) return <><MiniResource kind="media" x={27} y={24} label="1" /><SmallSignal x={29} y={52} badge="mercury" /></>;
  if (techId.startsWith('observation-3')) return <SmallSignal x={29} y={42} badge="discard" />;
  if (techId.startsWith('observation-4')) {
    // 1 Énergie : lancer une sonde ou se déplacer
    return <><MiniResource kind="energy" x={21} y={28} label="1" /><MiniHex kind="launch" x={22} y={52} r={10} /><line x1={36} y1={22} x2={36} y2={62} stroke="#2b2b2b" strokeWidth={2} /><MiniMovement x={47} y={42} /></>;
  }
  // Fond d'un emplacement de l'Informatique : tuile unie, les emplacements de la piste portent déjà les bonus
  if (techId === 'computing') return null;
  // Informatique : 2 PV et le bonus de la case recouverte
  return (
    <>
      <circle cx={29} cy={30} r={11} fill="#14724f" stroke="#fff" strokeWidth={1.5} />
      <text x={29} y={34.5} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#fff" fontFamily="Arial, sans-serif">2</text>
      <circle cx={29} cy={56} r={10} fill="none" stroke="#fff" strokeWidth={1.4} strokeDasharray="3 2" />
    </>
  );
};

/** Tuile Technologie (forme du matériel : coin coupé, tranche sombre), à la couleur de sa catégorie */
export const TechTileIcon: React.FC<{ techId: string; width?: number; height?: number }> = ({ techId, width = 58, height = 82 }) => {
  const uid = useUid();
  const category = techId.startsWith('exploration') ? 'exploration' : techId.startsWith('observation') ? 'observation' : 'computing';
  const col = TILE_COLORS[category];
  return (
    <svg width={width} height={height} viewBox="0 0 58 82" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`tile-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={col.light} />
          <stop offset="100%" stopColor={col.dark} />
        </linearGradient>
      </defs>
      <path d="M4 1 H44 L57 14 V77 Q57 81 53 81 H5 Q1 81 1 77 V5 Q1 1 4 1 Z" fill={`url(#tile-${uid})`} stroke={col.edge} strokeWidth={1.5} />
      <path d="M1 5 Q1 1 4 1 H7 V81 H5 Q1 81 1 77 Z" fill={col.edge} opacity={0.7} />
      {tileGlyph(techId)}
    </svg>
  );
};

/* ------------------------------------------------------------- */
/* Ressources (livret p. 6, 14, 23, 28) : pastilles du matériel   */
/* ------------------------------------------------------------- */

export type ResourceIconKind = 'credit' | 'energy' | 'media' | 'card' | 'data' | 'movement' | 'revenue';
/** Pastilles fléchées du matériel */
type ArrowKind = 'credit' | 'energy' | 'media' | 'card';

const RESOURCE_COLORS: Record<ArrowKind, string> = {
  credit: '#b8901c',
  energy: '#3daa3a',
  media: '#e8452a',
  card: '#2b2b2b',
};

/** Pictogramme blanc d'une pastille fléchée, centré sur (0, 0) */
const resourceGlyph = (kind: ArrowKind): React.ReactNode => {
  switch (kind) {
    case 'credit':
      // « C » anguleux traversé de deux barres
      return (
        <g fill="none" stroke="#fff">
          <path d="M6 -7 H0 L-6 0 L0 7 H6" strokeWidth={3.6} />
          <path d="M-0.5 -11 V-6 M3.5 -11 V-6 M-0.5 6 V11 M3.5 6 V11" strokeWidth={2} />
        </g>
      );
    case 'energy':
      return <path d="M2 -12 L-6 2 H0 L-3 12 L6 -3 H0 Z" fill="#fff" />;
    case 'card':
      // Carte blanche inclinée marquée « ? » (livret p. 11) : carte tirée au hasard
      return (
        <g transform="rotate(8)">
          <rect x={-7} y={-11} width={14} height={21} rx={2} fill="#fff" />
          <text y={6} textAnchor="middle" fontSize={16} fontWeight={900} fill="#2b2b2b" fontFamily="Arial Black, Arial, sans-serif">?</text>
        </g>
      );
    case 'media':
      // Micro sur son pied
      return (
        <g fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
          <rect x={-3.5} y={-12} width={7} height={13} rx={3.5} fill="#fff" />
          <path d="M-7 -2 Q-7 6 0 6 Q7 6 7 -2" />
          <line x1={0} y1={6} x2={0} y2={11} />
          <line x1={-4} y1={11} x2={4} y2={11} />
        </g>
      );
  }
};

/** Pastille fléchée (crédit, énergie, média), avec le nombre en blanc détouré à gauche */
const ArrowResource: React.FC<{ kind: ArrowKind; amount?: number | string }> = ({ kind, amount }) => {
  const color = RESOURCE_COLORS[kind];
  return (
    <>
      <path d="M-10 -16 H12 L24 0 L12 16 H-10 Q-14 16 -14 12 V-12 Q-14 -16 -10 -16 Z" fill={color}
        stroke={kind === 'card' ? '#e8e8e8' : undefined} strokeWidth={kind === 'card' ? 2.5 : undefined} strokeLinejoin="round" />
      <g transform={amount !== undefined ? 'translate(6 0)' : 'translate(2 0)'}>{resourceGlyph(kind)}</g>
      {amount !== undefined && (
        <text x={-12} y={10} textAnchor="middle" fontSize={30} fontWeight={900} fill="#fff" stroke={color} strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{amount}</text>
      )}
    </>
  );
};

/** Jeton Donnée : losange bleu, disque de chiffres binaires */
const DataToken = () => (
  <g>
    <rect x={-17} y={-17} width={34} height={34} rx={5} transform="rotate(45)" fill="#4a7fd0" />
    <circle r={13} fill="none" stroke="#dce8ff" strokeWidth={1.6} />
    <g fill="#dce8ff" fontSize={6.5} fontWeight="bold" fontFamily="Consolas, monospace" textAnchor="middle">
      <text y={-3}>0100</text><text y={3.5}>0011</text><text y={10}>0100</text>
    </g>
  </g>
);

/** Déplacement (livret p. 9) : disque bleu nuit cerclé de blanc, sonde blanche et flèche lavande vers la droite */
const Movement: React.FC<{ amount?: number | string }> = ({ amount }) => (
  <g>
    <g transform={amount !== undefined ? 'translate(6 0)' : undefined}>
      <circle r={17} fill="#1d2133" stroke="#e6e8f2" strokeWidth={1.8} />
      {/* Flèche */}
      <path d="M-1 -11 H8 L18 0 L8 11 H-1 L4 0 Z" fill="#c9cbe6" />
      {/* Sonde : antenne et corps */}
      <g fill="#fff" transform="rotate(-25)">
        <rect x={-9} y={-15} width={6} height={10} rx={1} />
        <path d="M-12 -3 L-2 -6 L1 3 L-9 6 Z" />
        <path d="M-14 3 L-11 9 M-4 5 L-3 11" stroke="#fff" strokeWidth={1.6} />
      </g>
    </g>
    {amount !== undefined && (
      <text x={-12} y={10} textAnchor="middle" fontSize={30} fontWeight={900} fill="#fff" stroke="#1d2133" strokeWidth={3} paintOrder="stroke" fontFamily="Arial Black, Arial, sans-serif">{amount}</text>
    )}
  </g>
);

/** Revenu : rosette blanche, barres et flèche montante en zigzag */
const Revenue = () => {
  const bumps = Array.from({ length: 10 }, (_, i) => (i * Math.PI) / 5);
  return (
    <g>
      <g fill="#fff" stroke="rgba(60, 60, 80, 0.5)" strokeWidth={1}>
        <circle r={16} />
        {bumps.map(a => <circle key={a} cx={15.5 * Math.cos(a)} cy={15.5 * Math.sin(a)} r={4} />)}
      </g>
      <circle r={16.5} fill="#fff" />
      <rect x={-7} y={5} width={5} height={5} fill="#3daa3a" />
      <rect x={3} y={-2} width={5} height={12} rx={1} fill="#c9a23a" />
      <path d="M-12 4 L-5 -3 L-2 1 L8 -9" fill="none" stroke="#222" strokeWidth={3} strokeLinejoin="round" />
      <path d="M3 -12 L11 -12 L10 -4 Z" fill="#222" />
    </g>
  );
};

/** Icône de ressource du matériel ; `amount` affiche le nombre comme sur les cartes */
export const ResourceIcon: React.FC<{ kind: ResourceIconKind; amount?: number; size?: number }> = ({ kind, amount, size = 24 }) => {
  const wide = (kind === 'credit' || kind === 'energy' || kind === 'media' || kind === 'card' || kind === 'movement') && amount !== undefined;
  return (
    <svg width={wide ? size * 1.5 : size} height={size} viewBox={wide ? '-36 -24 72 48' : '-24 -24 48 48'} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {kind === 'data' ? <DataToken /> : kind === 'movement' ? <Movement amount={amount} /> : kind === 'revenue' ? <Revenue /> : <ArrowResource kind={kind} amount={amount} />}
    </svg>
  );
};

/* ------------------------------------------------------- */
/* Points de victoire (livret p. 10) et traces de vie (p. 11) */
/* ------------------------------------------------------- */


/** Trace de vie dans une case de 40 × 40 : triangle arrondi pointe en bas et pictogramme blanc */
export const LifeTraceShape: React.FC<{ color: LifeTraceColor }> = ({ color }) => {
  const fill = LIFE_TRACE_COLORS[color];
  return (
    <g>
      <path d="M8 6 H32 Q38 6 35.5 11 L23.5 33 Q20 38.5 16.5 33 L4.5 11 Q2 6 8 6 Z" fill={fill} />
      {color === 'red' && (
        // Molécule : grosse sphère reliée à deux petites en haut et une moyenne en bas
        <g fill="#fff">
          <path d="M11.5 10.5 L20 16.5 L28.5 10.5 M20 16.5 V25" fill="none" stroke="#fff" strokeWidth={2.4} />
          <circle cx={20} cy={16.5} r={5.2} /><circle cx={11.5} cy={10.5} r={2.6} /><circle cx={28.5} cy={10.5} r={2.6} /><circle cx={20} cy={25.5} r={3.4} />
        </g>
      )}
      {color === 'yellow' && (
        // Roche fendue
        <g>
          <path d="M12.5 13 L17 8.5 L24.5 9 L28.5 14 L27 20.5 L20.5 26 L14.5 23 Z" fill="#fff" />
          <path d="M15.5 11 L16.5 18 L19.5 15.5 L20 22 M22 9.5 L21.5 14 L25 13" fill="none" stroke={fill} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      )}
      {color === 'blue' && (
        // Micro-organismes : deux filaments et quelques points
        <g fill="#fff">
          <path d="M15.5 9.5 Q11.5 11.5 14.5 14.5 Q17.5 17.5 13.5 20.5 M23 9 Q28 9.5 25.5 13.5 Q23 17.5 26.5 19.5 Q29 22 24.5 24.5" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" />
          <circle cx={30.5} cy={10} r={0.9} /><circle cx={19.5} cy={19} r={0.9} /><circle cx={28.5} cy={25} r={0.9} /><circle cx={10} cy={13} r={0.9} />
        </g>
      )}
    </g>
  );
};

/** Trace de vie seule, à la taille voulue */
export const LifeTraceIcon: React.FC<{ color: LifeTraceColor; size?: number }> = ({ color, size = 20 }) => (
  <svg width={size} height={size} viewBox="2 4 36 36" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <LifeTraceShape color={color} />
  </svg>
);

/** Points de victoire : écusson vert, couronne de laurier claire et nombre blanc */
export const VictoryPointsIcon: React.FC<{ amount?: number; size?: number }> = ({ amount, size = 20 }) => {
  const leaves = [0, 1, 2, 3, 4];
  const text = amount === undefined ? 'PV' : String(amount);
  return (
    <svg width={size} height={size} viewBox="-20 -20 40 40" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M0 -19 C11 -19 19 -12 19 -1 C19 10 10 17 0 19.5 C-10 17 -19 10 -19 -1 C-19 -12 -11 -19 0 -19 Z" fill="#14705c" />
      {/* Laurier : feuilles le long de deux arcs, de la base vers le haut */}
      {[-1, 1].map(side => (
        <g key={side} fill="#6fd8bf" transform={`scale(${side} 1)`}>
          <path d="M3 16 Q-12 12 -13 -8" fill="none" stroke="#6fd8bf" strokeWidth={1.4} />
          {leaves.map(i => {
            const t = (i + 0.5) / leaves.length;
            const x = -3 - 11 * Math.sin(t * Math.PI * 0.62) - 1;
            const y = 15 - 25 * t;
            return <ellipse key={i} cx={x - 2.2} cy={y} rx={3.4} ry={1.6} transform={`rotate(${-35 - 40 * t} ${x - 2.2} ${y})`} />;
          })}
        </g>
      ))}
      <text y={text.length > 2 ? 4 : text.length > 1 ? 5.5 : 7} textAnchor="middle" fontSize={text.length > 2 ? 11 : text.length > 1 ? 15 : 20} fontWeight={900} fill="#fff" fontFamily="Arial Black, Arial, sans-serif">{text}</text>
    </svg>
  );
};
